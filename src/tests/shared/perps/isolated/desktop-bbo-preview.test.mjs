// D01 preview assertions; actual pinned hooks/callback/leaf, local fixtures only.
import test from "node:test";
import assert from "node:assert/strict";
import {
  bboPreviewFixture,
  bboInstrumentFixture,
  bboEpoch,
} from "./bbo-preview-fixture.mjs";
import { expectedBboPrice } from "../bbo-price-evidence.mjs";
import {
  expectedBboAmounts,
  expectedBboLiquidation,
  assertBboNumeric,
} from "../bbo-preview-evidence.mjs";
const modes = [
  { type: "counterparty", offsetTicks: 0 },
  { type: "counterparty", offsetTicks: 5 },
  { type: "queue", offsetTicks: 0 },
  { type: "queue", offsetTicks: 5 },
];
function assertPreview(f) {
  const s = f.state,
    spot = s.instrument.mode === "spot";
  for (const side of ["long", "short"]) {
    const v = f.values[side];
    const price = expectedBboPrice({
      bid: s.book.bbo[0].px,
      ask: s.book.bbo[1].px,
      side,
      ...s.form.bboPriceMode,
      szDecimals: spot
        ? s.instrument.universe.baseSzDecimals
        : s.instrument.universe.szDecimals,
      spot,
    });
    assert.equal(v.price, price, `${side}: actual price chain vs own raw book`);
    assert.equal(v.error, null);
    const amounts = expectedBboAmounts({
      quantity: v.quantity,
      price,
      leverage: spot ? 1 : s.assetData.leverage.value,
    });
    assertBboNumeric(v.notional, amounts.notional, `${side} notional`);
    assertBboNumeric(v.margin, amounts.margin, `${side} margin`);
    assert.equal(
      v.secondary,
      amounts.usdSecondary,
      `${side} exact button text`,
    );
    const row = f.root.findAllByType("side").find((r) => r.props.side === side);
    if (spot) {
      assert.equal(v.liq, null);
      assert.equal(row.findAllByType("liq-value").length, 0);
      continue;
    }
    const p = s.positions.find(
      (r) => r.position.coin === s.asset.coin,
    )?.position;
    const expected = expectedBboLiquidation({
      side,
      quantity: v.quantity,
      price,
      mark: s.ctx.ctx.markPrice,
      leverage: s.assetData.leverage.value,
      maxLeverage: s.asset.universe.maxLeverage,
      marginMode: s.assetData.leverage.type,
      tiers: s.asset.margin.marginTiers,
      positionSize: p?.szi ?? "0",
      isolatedRawUsd: p?.leverage?.rawUsd,
      crossAvailable: s.crossAvailable,
      reduceOnly: s.form.reduceOnly,
    });
    if (expected === null) {
      assert.equal(v.liq, null);
      assert.equal(row.findByType("liq-empty").children.join(""), "--");
    } else {
      assertBboNumeric(v.liq, expected, `${side} liquidation`);
      assertBboNumeric(
        row.findByType("liq-value").props.raw,
        expected,
        `${side} actual leaf numeric prop`,
      );
      assert.match(
        row.findByType("liq-value").children.join(""),
        /^\$[\d,.]+$/u,
      );
    }
  }
}
for (const marginMode of ["isolated", "cross"])
  for (const mode of modes) {
    test(`D01-45 ${marginMode} ${mode.type}/${mode.offsetTicks} raw BBO→both amounts/costs/liquidation update together`, async () => {
      const f = await bboPreviewFixture();
      try {
        await f.update((s) => {
          s.form = { ...s.form, bboPriceMode: mode };
          s.assetData = {
            ...s.assetData,
            leverage: { type: marginMode, value: 10 },
          };
        });
        assertPreview(f);
        const prior = JSON.parse(JSON.stringify(f.values));
        await f.update((s) => {
          s.book = {
            ...s.book,
            time: s.now,
            bbo: [
              { px: "90", sz: "10", n: 1 },
              { px: "91", sz: "20", n: 2 },
            ],
          };
        });
        assertPreview(f);
        for (const side of ["long", "short"]) {
          assert.notEqual(f.values[side].price, prior[side].price);
          assert.notEqual(f.values[side].margin, prior[side].margin);
          assert.notEqual(f.values[side].secondary, prior[side].secondary);
        }
      } finally {
        await f.close();
      }
    });
  }
for (const [bid, ask, szDecimals, mark] of [
  ["80000", "80001", 5, "80000.5"],
  ["9.9999", "10", 0, "10"],
  ["0.001", "0.00101", 0, "0.001005"],
]) {
  test(`D01-35/36/45 BBO magnitude ${bid} all options/side exact derived amounts and valid liquidation`, async () => {
    const f = await bboPreviewFixture();
    try {
      await f.update((s) => {
        s.instrument = {
          ...s.instrument,
          universe: { szDecimals, maxLeverage: 20 },
        };
        s.asset = { ...s.asset, universe: s.instrument.universe };
        s.ctx = { ctx: { markPrice: mark } };
        s.mid = mark;
        s.assetData = { ...s.assetData, markPx: mark };
        s.book = { ...s.book, bbo: [{ px: bid }, { px: ask }] };
      });
      for (const mode of modes) {
        await f.update((s) => {
          s.form = { ...s.form, bboPriceMode: mode };
        });
        assertPreview(f);
      }
    } finally {
      await f.close();
    }
  });
}
for (const positionSize of ["1", "-1", "3", "-3"]) {
  test(`D01-45 existing position ${positionSize} add/reduce/reverse equity and tier reconciliation`, async () => {
    const f = await bboPreviewFixture();
    try {
      await f.update((s) => {
        s.positions = [
          {
            position: {
              coin: "BTC",
              szi: positionSize,
              leverage: {
                type: "isolated",
                rawUsd:
                  Number(positionSize) > 0
                    ? String(-90 * Number(positionSize))
                    : String(-110 * Number(positionSize)),
              },
            },
          },
        ];
        s.asset = {
          ...s.asset,
          margin: {
            marginTiers: [
              { lowerBound: "0", maxLeverage: 20 },
              { lowerBound: "250", maxLeverage: 10 },
              { lowerBound: "1000", maxLeverage: 5 },
            ],
          },
        };
      });
      for (const mode of modes) {
        await f.update((s) => {
          s.form = { ...s.form, bboPriceMode: mode };
        });
        assertPreview(f);
      }
      await f.update((s) => {
        s.assetData = {
          ...s.assetData,
          leverage: { type: "cross", value: 10 },
        };
      });
      assertPreview(f);
    } finally {
      await f.close();
    }
  });
}
test("D01-45 size/n-only pushes preserve every calculated value; raw price change refreshes", async () => {
  const f = await bboPreviewFixture();
  try {
    assertPreview(f);
    const before = JSON.parse(JSON.stringify(f.values));
    await f.update((s) => {
      s.book = {
        ...s.book,
        bbo: s.book.bbo.map((r) => ({ ...r, sz: "999", n: 999 })),
      };
    });
    assert.deepEqual(f.values, before);
    await f.update((s) => {
      s.book = { ...s.book, bbo: [{ px: "101" }, { px: "102" }] };
    });
    assertPreview(f);
    assert.notDeepEqual(f.values, before);
  } finally {
    await f.close();
  }
});
test("D01-83/92 BBO age timer invalidates prices and leaf; fresh reconnect recovers own book", async () => {
  const f = await bboPreviewFixture();
  try {
    assertPreview(f);
    assert.ok(f.timers.size > 0);
    await f.expire();
    for (const side of ["long", "short"]) {
      assert.equal(f.values[side].error, "bbo_unavailable");
      assert.equal(f.values[side].price, "0");
      assert.equal(f.values[side].liq, null);
    }
    await f.update((s) => {
      s.book = { ...s.book, time: s.now, bbo: [{ px: "102" }, { px: "103" }] };
    });
    assertPreview(f);
  } finally {
    await f.close();
  }
});
test("D01-45 account/asset readiness prevents stale liquidation numbers", async () => {
  const f = await bboPreviewFixture();
  try {
    for (const patch of [
      { accountAddress: "0x" + "2".repeat(40) },
      { coin: "ETH" },
      { leverage: { value: 10, type: "unknown" } },
    ]) {
      const before = f.state.assetData;
      await f.update((s) => {
        s.assetData = { ...before, ...patch };
      });
      for (const side of ["long", "short"])
        assert.equal(f.values[side].liq, null);
      await f.update((s) => {
        s.assetData = before;
      });
      assertPreview(f);
    }
  } finally {
    await f.close();
  }
});
test("D01-106 actual spot switch resets BBO/form; return to perp preserves current form snapshot without reselection", async () => {
  const f = bboInstrumentFixture();
  await f.actions.changeActiveSpotAsset({
    coin: "@107",
    spotUniverse: f.spotUniverse,
  });
  assert.equal(f.store.instrument.mode, "spot");
  assert.equal(f.store.form.bboPriceMode, null);
  assert.equal(f.store.form.type, "market");
  assert.equal(f.store.form.size, "");
  f.actions.updateTradingForm({ type: "limit", bboPriceMode: modes[1] });
  const selected = JSON.stringify(f.store.form.bboPriceMode);
  await f.actions.changeActiveAsset({ coin: "BTC" });
  assert.equal(f.store.instrument.mode, "perp");
  assert.equal(
    JSON.stringify(f.store.form.bboPriceMode),
    selected,
    "Current return branch preserves mode; do not silently overwrite it in the test",
  );
  assert.equal(f.store.form.price, "100.5");
  assert.equal(f.store.bbo, null);
  await f.actions.changeActiveAsset({ coin: "ETH" });
  assert.equal(
    JSON.stringify(f.store.form.bboPriceMode),
    selected,
    "Same-mode coin switch preserves BBO",
  );
  assert.equal(f.store.form.price, "201.5");
  assert.ok(f.calls.every(([kind]) => kind === "market-data"));
});
test("D01-106/104 spot and perpetual use independent books and tick grids in the same mounted hook", async () => {
  const f = await bboPreviewFixture();
  try {
    assertPreview(f);
    await f.update((s) => {
      s.instrument = {
        mode: "spot",
        coin: "@107",
        universe: {
          baseSzDecimals: 0,
          baseName: "HYPE",
          quoteName: "USDC",
          displayName: "HYPE",
        },
      };
      s.form = { ...s.form, bboPriceMode: modes[1] };
      s.book = {
        coin: "@107",
        time: bboEpoch,
        bbo: [{ px: "0.00001" }, { px: "0.00001001" }],
      };
    });
    assertPreview(f);
    assert.equal(f.values.long.price, "0.00001006");
    await f.update((s) => {
      s.instrument = { mode: "perp", coin: "BTC", universe: { szDecimals: 4 } };
    });
    for (const side of ["long", "short"])
      assert.equal(
        f.values[side].error,
        "bbo_unavailable",
        "Wrong-market book must not seed return-mode price",
      );
    await f.update((s) => {
      s.book = {
        coin: "BTC",
        time: s.now,
        bbo: [{ px: "100" }, { px: "101" }],
      };
    });
    assertPreview(f);
    assert.equal(f.values.long.price, "101.05");
  } finally {
    await f.close();
  }
});
