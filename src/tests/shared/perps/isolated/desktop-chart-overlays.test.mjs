// Manual D04 overlays; source logic and native props, not external TV painting.
import test from "node:test";
import assert from "node:assert/strict";
import {
  chartOverlayFixture,
  position,
  order,
} from "./chart-overlay-fixture.mjs";
const plain = (value) => JSON.parse(JSON.stringify(value));
const by = (f, kind) => f.value.lines.filter((l) => l.kind === kind);
test("D04-112/113/114/116 actual account scoped hooks build each position/liquidation/order once with exact raw prices and distinct native styles", async () => {
  const f = await chartOverlayFixture();
  try {
    assert.deepEqual(
      plain(f.value.lines.map((l) => [l.id, l.kind, l.price, l.qty])),
      [
        ["liq:BTC:cross", "liquidation", "80.0001", undefined],
        ["pos:BTC:cross", "position", "100.125", "1.23456"],
        ["order:1", "order", "95.12345", "0.12345"],
        ["order:2", "order", "110", "0.12345"],
      ].map((x) => x.map((v) => (v === undefined ? null : v))),
    );
    const [liq, pos, first, second] = f.value.chartComponents;
    assert.equal(liq.props.anchor.price, 80.0001);
    assert.equal(pos.props.anchor.price, 100.125);
    assert.equal(first.props.anchor.price, 95.12345);
    assert.equal(second.props.anchor.price, 110);
    assert.equal(liq.props.label.offset, 140);
    assert.equal(pos.props.label.offset, 16);
    assert.equal(pos.props.style, "dashed");
    assert.equal(first.props.style, "dotted");
    assert.equal(first.props.label.variant, "order");
    assert.notEqual(liq.props.title, pos.props.title);
    assert.equal(new Set(f.value.chartComponents.map((c) => c.id)).size, 4);
    assert.equal(pos.props.draggable, false);
    assert.equal(first.props.draggable, true);
  } finally {
    await f.close();
  }
});
test("D04-115/194 actual settings false hides all three line kinds and reenable restores exact semantic lines", async () => {
  const f = await chartOverlayFixture();
  try {
    const semantic = () => f.value.lines.map(({ version, ...line }) => line);
    const initial = plain(semantic());
    await f.update({ showChartLines: false });
    assert.deepEqual(plain(f.value.lines), []);
    assert.deepEqual(plain(f.value.chartComponents), []);
    await f.update({ showChartLines: true });
    assert.deepEqual(plain(semantic()), initial);
  } finally {
    await f.close();
  }
});
for (const [name, patch] of [
  ["foreign position cache", { positionOwner: "0xbbb" }],
  ["foreign order cache", { orderOwner: "0xbbb" }],
  ["both foreign", { positionOwner: "0xbbb", orderOwner: "0xbbb" }],
  ["no account", { account: {} }],
])
  test(`D04-192/194 actual line caches reject ${name}`, async () => {
    const f = await chartOverlayFixture();
    try {
      assert.equal(f.value.lines.length, 4);
      await f.update(patch);
      assert.equal(
        by(f, "position").length,
        patch.positionOwner || patch.account ? 0 : 1,
      );
      assert.equal(
        by(f, "liquidation").length,
        patch.positionOwner || patch.account ? 0 : 1,
      );
      assert.equal(
        by(f, "order").length,
        patch.orderOwner || patch.account ? 0 : 2,
      );
    } finally {
      await f.close();
    }
  });
test("D04-192/194 same-mount A to B immediately hides A lines, B cache recovers without A residue, coin switch selects only ETH", async () => {
  const f = await chartOverlayFixture();
  try {
    await f.update({ account: { accountId: "B", accountAddress: "0xBBB" } });
    assert.deepEqual(plain(f.value.lines), []);
    await f.update({
      positionOwner: "0xbbb",
      orderOwner: "0xbbb",
      positions: [
        position("BTC", { entryPx: "200", liquidationPx: "175" }),
        position("ETH", { entryPx: "300", liquidationPx: "250" }),
      ],
      orders: {
        BTC: [order(7, { limitPx: "220" })],
        ETH: [order(8, { coin: "ETH", limitPx: "325" })],
      },
    });
    assert.deepEqual(plain(f.value.lines.map((l) => l.price)), [
      "175",
      "200",
      "220",
    ]);
    assert.ok(f.value.chartComponents.every((c) => c.id.startsWith("B:")));
    await f.update({
      instrument: {
        coin: "ETH",
        mode: "perp",
        assetId: 1,
        universe: { szDecimals: 4 },
      },
    });
    assert.deepEqual(plain(f.value.lines.map((l) => [l.symbol, l.price])), [
      ["ETH", "250"],
      ["ETH", "300"],
      ["ETH", "325"],
    ]);
  } finally {
    await f.close();
  }
});
test("D04-118 actual order cache transition removes only filled oid and creates exact resulting position/liquidation; no actual execution", async () => {
  const f = await chartOverlayFixture({
    positions: [],
    orders: { BTC: [order(1), order(2, { limitPx: "90" })] },
  });
  try {
    assert.deepEqual(plain(f.value.lines.map((l) => l.id)), [
      "order:1",
      "order:2",
    ]);
    await f.update({
      orders: { BTC: [order(2, { limitPx: "90" })] },
      positions: [
        position("BTC", { entryPx: "95.12345", liquidationPx: "70" }),
      ],
    });
    assert.deepEqual(plain(f.value.lines.map((l) => [l.id, l.price])), [
      ["liq:BTC:cross", "70"],
      ["pos:BTC:cross", "95.12345"],
      ["order:2", "90"],
    ]);
  } finally {
    await f.close();
  }
});
test("D04-180/194 actual spot aliases accept only this pair and owner, contain no perp position or liquidation, toggle remains effective", async () => {
  const f = await chartOverlayFixture({
    instrument: {
      coin: "@1",
      assetId: 10001,
      mode: "spot",
      universe: { name: "UBTC/USDC", baseSzDecimals: 5 },
    },
    spotOrders: [
      order(1, { coin: "@1" }),
      order(2, { coin: "UBTC/USDC" }),
      order(3, { coin: "@2" }),
      order(4, { coin: "BTC" }),
    ],
  });
  try {
    assert.deepEqual(
      plain(f.value.lines.map((l) => [l.id, l.kind, l.symbol])),
      [
        ["order:1", "order", "@1"],
        ["order:2", "order", "@1"],
      ],
    );
    await f.update({ showChartLines: false });
    assert.equal(f.value.chartComponents.length, 0);
    await f.update({ showChartLines: true, spotOwner: "0xbbb" });
    assert.equal(f.value.chartComponents.length, 0);
    await f.update({ spotOwner: "0xAAA" });
    assert.equal(f.value.chartComponents.length, 2);
    await f.update({
      instrument: {
        coin: "@2",
        assetId: 10002,
        mode: "spot",
        universe: { name: "UETH/USDC", baseSzDecimals: 4 },
      },
    });
    assert.deepEqual(plain(f.value.lines.map((l) => l.id)), ["order:3"]);
  } finally {
    await f.close();
  }
});
for (const price of ["0", "-1", "NaN", "Infinity", ""])
  test(`D04-112/114 invalid reference ${JSON.stringify(price)} is omitted, not rendered at zero`, async () => {
    const f = await chartOverlayFixture({
      positions: [position("BTC", { entryPx: price, liquidationPx: price })],
      orders: {},
    });
    try {
      assert.equal(f.value.lines.length, 0);
      assert.equal(f.value.chartComponents.length, 0);
    } finally {
      await f.close();
    }
  });
test("D04-112/113 actual quantity is floor truncated, short sign and negative PnL produce independent label/color", async () => {
  const f = await chartOverlayFixture({
    positions: [
      position("BTC", { szi: "-1.234567", unrealizedPnl: "-12.345" }),
    ],
  });
  try {
    const pos = by(f, "position")[0];
    assert.equal(pos.side, "short");
    assert.equal(pos.label.right, "-1.23456");
    assert.match(pos.label.left, /-\$12\.35$/u);
    assert.equal(
      f.value.chartComponents.find((c) => c.id.endsWith(pos.id)).props.color,
      "red",
    );
  } finally {
    await f.close();
  }
});
test("D04-194 actual native pending preview uses new price without mutating source lines; invalid pending price is hidden", async () => {
  const f = await chartOverlayFixture({
    pending: { "A:order:1": { type: "priceChange", price: 97.125 } },
  });
  try {
    const item = () =>
      f.value.chartComponents.find((c) => c.id === "A:order:1");
    assert.equal(item().props.anchor.price, 97.125);
    assert.equal(item().props.pending, "priceChange");
    assert.equal(by(f, "order")[0].price, "95.12345");
    await f.update({
      pending: { "A:order:1": { type: "priceChange", price: NaN } },
    });
    assert.equal(item(), undefined);
  } finally {
    await f.close();
  }
});
