import test from "node:test";
import assert from "node:assert/strict";
import { renderer } from "./source.mjs";
import {
  spotHoldingsFixture,
  holding,
  spotUniverse,
} from "./spot-holdings-fixture.mjs";
const plain = (value) => JSON.parse(JSON.stringify(value));
const item = (f, coin) =>
  f.table.props.data.find((item) => item.rawCoin === coin);
const buttons = (f, coin, id) =>
  f
    .row(coin)
    .findAllByType("IconButton")
    .filter((node) => node.props.testID === id);
test("D10-92/93 actual Desktop holdings six columns, raw token alias, total/available/value and canonical tokenId", async () => {
  const f = await spotHoldingsFixture();
  try {
    assert.deepEqual(
      plain(f.table.props.columns.map((col) => [col.key, col.title])),
      [
        ["coin", "资产"],
        ["total", "余额"],
        ["available", "可用"],
        ["usdcValue", "价值"],
        ["pnl", "盈亏 (ROE%)"],
        ["contract", "合约"],
      ],
    );
    assert.deepEqual(f.texts(f.row("UBTC")), [
      "BTC",
      "2 BTC",
      "1.5 BTC",
      "$200.00",
      "+$100.00 (+100.0%)",
      "0xabcd...7890",
    ]);
    assert.equal(item(f, "UBTC").rawCoin, "UBTC");
    assert.equal(
      item(f, "UBTC").contract,
      "0xabcdef1234567890abcdef1234567890",
    );
    assert.equal(item(f, "UETH").available, "0");
    assert.equal(buttons(f, "UBTC", f.ids.BalanceRowShareButton).length, 1);
  } finally {
    await f.close();
  }
});
for (const mode of ["classic", "unified", "portfolio", "foreignUnified"])
  test(`D10-94 actual USDC ${mode} one row and correct current-owner account semantics`, async () => {
    const f = await spotHoldingsFixture();
    try {
      if (mode !== "classic")
        await f.update({
          mode: {
            mode:
              mode === "portfolio"
                ? f.types.EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN
                : f.types.EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
            accountAddress: mode === "foreignUnified" ? "0xbbb" : "0xAaA",
          },
        });
      const unified = ["unified", "portfolio"].includes(mode),
        usdc = item(f, "USDC");
      assert.equal(
        f.table.props.data.filter((item) => item.coin === "USDC").length,
        1,
      );
      assert.equal(usdc.total, unified ? "2" : "12");
      assert.equal(usdc.available, unified ? "1" : "8");
      assert.equal(usdc.pnl, undefined);
      assert.equal(usdc.contract, undefined);
      assert.equal(usdc.isAssetClickable, false);
      assert.equal(buttons(f, "USDC", f.ids.BalanceRowShareButton).length, 0);
    } finally {
      await f.close();
    }
  });
for (const coin of ["USDC", "USDT", "USDB", "USDH"])
  test(`D10-95 actual stable ${coin} valued one-to-one and no PnL/share even if a price/cost exists`, async () => {
    const f = await spotHoldingsFixture({
      balances: [holding(coin, "12", "2", "6")],
      summary: {},
      meta: { universes: [spotUniverse(coin)], tokens: [] },
      prices: { [`${coin}/USDC`]: { markPx: "99" } },
    });
    try {
      const current = item(f, coin);
      assert.equal(current.usdcValue, "12.00");
      assert.equal(current.pnl, undefined);
      assert.equal(buttons(f, coin, f.ids.BalanceRowShareButton).length, 0);
      assert.ok(f.texts(f.row(coin)).includes("--"));
    } finally {
      await f.close();
    }
  });
test("D10-96 actual PnL gain/loss/zero/no-cost/no-price with exact text and color", async () => {
  const f = await spotHoldingsFixture();
  try {
    const gain = f
      .row("UBTC")
      .findAllByType("SizableText")
      .find((node) => node.children.join("").startsWith("+$"));
    const loss = f
      .row("UETH")
      .findAllByType("SizableText")
      .find((node) => node.children.join("").startsWith("-$"));
    assert.equal(gain.props.color, "$green11");
    assert.equal(loss.props.color, "$red11");
    assert.equal(loss.children.join(""), "-$60.00 (-50.0%)");
    for (const patch of [
      { balances: [holding("UBTC", "2", "0", "200")] },
      { balances: [holding("UBTC", "2", "0", "0")] },
      { prices: {} },
    ]) {
      await f.update(patch);
      assert.ok(f.texts(f.row("UBTC")).includes("--"));
      assert.equal(buttons(f, "UBTC", f.ids.BalanceRowShareButton).length, 0);
    }
  } finally {
    await f.close();
  }
});
test("D10-97 actual share callback contains current canonical token, amount-derived PnL and prices, no trade callback", async () => {
  const f = await spotHoldingsFixture();
  try {
    let stopped = 0;
    await renderer.act(async () =>
      buttons(f, "UBTC", f.ids.BalanceRowShareButton)[0].props.onPress({
        stopPropagation: () => stopped++,
      }),
    );
    const share = plain(f.calls.shares[0]);
    assert.deepEqual(share, {
      mode: "spot",
      side: "long",
      token: "UBTC",
      tokenDisplayName: "BTC",
      tokenImageUrl: "https://uni.onekey-asset.com/static/hyperliquid/BTC.png",
      pnl: "100",
      pnlPercent: "100",
      leverage: 1,
      entryPrice: "50",
      markPrice: "100",
      priceType: "mark",
    });
    assert.equal(stopped, 1);
    assert.equal(f.calls.changes.length, 0);
  } finally {
    await f.close();
  }
});
test("D10-98 actual zero holding removed even with positive cost; other holdings retained", async () => {
  const f = await spotHoldingsFixture({
    balances: [holding("UBTC", "0", "0", "100"), holding("UETH", "3")],
    summary: {},
  });
  try {
    assert.deepEqual(plain(f.table.props.data.map((item) => item.rawCoin)), [
      "UETH",
    ]);
    assert.equal(f.tabCount, 1);
  } finally {
    await f.close();
  }
});
test("D10-99 actual USDC first then descending value, tie uses amount, price refresh reorders deterministically", async () => {
  const f = await spotHoldingsFixture({
    balances: [
      holding("UBTC", "2"),
      holding("UETH", "10"),
      holding("USDC", "1"),
    ],
    summary: {},
  });
  try {
    assert.deepEqual(plain(f.table.props.data.map((item) => item.rawCoin)), [
      "USDC",
      "UETH",
      "UBTC",
    ]);
    await f.update({
      prices: { "UBTC/USDC": { markPx: "101" }, "UETH/USDC": { markPx: "20" } },
    });
    assert.deepEqual(plain(f.table.props.data.map((item) => item.rawCoin)), [
      "USDC",
      "UBTC",
      "UETH",
    ]);
  } finally {
    await f.close();
  }
});
for (const quote of ["USDC", "USDH"])
  test(`D10-100/101 actual holding click targets available ${quote} pair; USDC inert`, async () => {
    const f = await spotHoldingsFixture({
      meta: { universes: [spotUniverse("UBTC", quote)], tokens: [] },
    });
    try {
      const clickable = f
        .row("UBTC")
        .findAllByType("XStack")
        .filter((node) => typeof node.props.onPress === "function");
      assert.equal(clickable.length, 1);
      await renderer.act(async () => clickable[0].props.onPress());
      assert.deepEqual(plain(f.calls.changes), [
        {
          coin: `UBTC/${quote}`,
          spotUniverse: {
            baseName: "UBTC",
            quoteName: quote,
            name: `UBTC/${quote}`,
          },
        },
      ]);
      assert.equal(
        f
          .row("USDC")
          .findAllByType("XStack")
          .filter((node) => typeof node.props.onPress === "function").length,
        0,
      );
    } finally {
      await f.close();
    }
  });
test("D10-100 actual holding with no trading pair is not clickable, no fallback to unrelated market", async () => {
  const f = await spotHoldingsFixture({
    balances: [holding("MISSING", "1")],
    summary: {},
  });
  try {
    assert.equal(item(f, "MISSING").isAssetClickable, false);
    assert.equal(
      f
        .row("MISSING")
        .findAllByType("XStack")
        .filter((node) => typeof node.props.onPress === "function").length,
      0,
    );
    assert.equal(f.calls.changes.length, 0);
  } finally {
    await f.close();
  }
});
test("D10-103 actual refresh dispatches once and actual loaded flags release Desktop loading", async () => {
  const f = await spotHoldingsFixture({ loaded: false });
  try {
    assert.equal(f.table.props.listLoading, true);
    await renderer.act(async () => f.table.props.onPullToRefresh());
    assert.equal(f.calls.refresh, 1);
    await f.update({ loaded: true });
    assert.equal(Boolean(f.table.props.listLoading), false);
    await f.update({ computed: { isLoading: true } });
    assert.equal(f.table.props.listLoading, true);
  } finally {
    await f.close();
  }
});
test("D10-104 actual canonical tokenId shortening/copy/explorer, propagation stopped and no asset switch", async () => {
  const f = await spotHoldingsFixture();
  try {
    let stopped = 0;
    for (const id of [
      f.ids.BalanceRowCopyContractButton,
      f.ids.BalanceRowOpenContractButton,
    ])
      await renderer.act(async () =>
        buttons(f, "UBTC", id)[0].props.onPress({
          stopPropagation: () => stopped++,
        }),
      );
    assert.deepEqual(f.calls.copied, ["0xabcdef1234567890abcdef1234567890"]);
    assert.deepEqual(plain(f.calls.opened), [
      { tokenId: "0xabcdef1234567890abcdef1234567890" },
    ]);
    assert.equal(stopped, 2);
    assert.equal(f.calls.changes.length, 0);
    for (const coin of ["USDC", "UETH"]) {
      assert.equal(
        buttons(f, coin, f.ids.BalanceRowCopyContractButton).length,
        0,
      );
      assert.equal(
        buttons(f, coin, f.ids.BalanceRowOpenContractButton).length,
        0,
      );
    }
  } finally {
    await f.close();
  }
});
for (const account of [true, false])
  test(`D10-105 actual Desktop empty account=${account} illustration and deposit/guide controls without spinner`, async () => {
    const f = await spotHoldingsFixture({
      balances: [],
      summary: {},
      loaded: true,
      account: account ? { accountAddress: "0xaaa" } : {},
      computed: {},
    });
    try {
      assert.equal(f.table.props.data.length, 0);
      assert.equal(Boolean(f.table.props.listLoading), false);
      assert.equal(f.root.findAllByType("Illustration").length, 1);
      assert.ok(f.texts().includes("没有现货资产"));
      assert.ok(f.texts().includes("存款"));
      assert.ok(f.texts().includes("交易指南"));
      const deposit = f.root
        .findAllByType("Button")
        .find((node) => node.props.testID === f.ids.HoldingsEmptyDepositButton);
      assert.equal(deposit.props.disabled, !account);
      assert.equal(f.root.findAllByType("GuidePopover").length, 1);
      if (account) {
        await renderer.act(async () => deposit.props.onPress());
        assert.deepEqual(f.calls.deposits, ["deposit"]);
      }
    } finally {
      await f.close();
    }
  });
test("D10-107 actual filter exact $5 boundary, exempts USDC and unpriced, page resets and unchecking restores all", async () => {
  const f = await spotHoldingsFixture({
    balances: [
      holding("UBTC", ".0499"),
      holding("UETH", ".25"),
      holding("USDC", ".01"),
      holding("UNKNOWN", "1", "0", "1"),
    ],
    summary: {},
  });
  try {
    assert.equal(f.table.props.data.length, 4);
    await renderer.act(async () => f.table.props.setCurrentListPage(3));
    assert.equal(f.table.props.currentListPage, 3);
    await f.update({ hideSmall: true });
    assert.deepEqual(plain(f.table.props.data.map((item) => item.rawCoin)), [
      "USDC",
      "UETH",
      "UNKNOWN",
    ]);
    assert.equal(f.table.props.currentListPage, 1);
    await f.update({ hideSmall: false });
    assert.equal(f.table.props.data.length, 4);
  } finally {
    await f.close();
  }
});
test("D10-107 actual all small hidden uses no-data state, not first-use deposit empty; count current implementation remains unfiltered", async () => {
  const f = await spotHoldingsFixture({
    balances: [holding("UBTC", ".01")],
    summary: {},
    hideSmall: true,
  });
  try {
    assert.equal(f.table.props.data.length, 0);
    assert.ok(f.texts().includes("暂无数据"));
    assert.equal(f.root.findAllByType("Illustration").length, 0);
    assert.equal(f.tabCount, 1);
  } finally {
    await f.close();
  }
});
test(
  "D10-107 original visible-count expectation tracks hidden holdings",
  {
    todo: "Pinned useVisibleSpotHoldingsCount explicitly counts all holdings independently of filter; original manual item expects visible count. Keep document/source discrepancy, not TF result.",
  },
  async () => {
    const f = await spotHoldingsFixture({
      balances: [holding("UBTC", ".01")],
      summary: {},
      hideSmall: true,
    });
    try {
      assert.equal(f.tabCount, f.table.props.data.length);
    } finally {
      await f.close();
    }
  },
);
test("D10-102 actual account dependency resets pagination after new scoped atom data provided; no claim about upstream clearing", async () => {
  const f = await spotHoldingsFixture();
  try {
    await renderer.act(async () => f.table.props.setCurrentListPage(4));
    await f.update({
      account: { accountAddress: "0xbbb" },
      balances: [],
      summary: {},
      loaded: false,
    });
    assert.equal(f.table.props.currentListPage, 1);
    assert.equal(f.table.props.listLoading, true);
    assert.equal(f.table.props.data.length, 0);
    await f.update({ balances: [holding("NEW", "2")], loaded: true });
    assert.deepEqual(plain(f.table.props.data.map((item) => item.rawCoin)), [
      "NEW",
    ]);
  } finally {
    await f.close();
  }
});
test("D10-46 actual metadata empty retries after 500ms, then actual rows gain canonical contracts and current preferred pair", async () => {
  const f = await spotHoldingsFixture({ meta: { universes: [], tokens: [] } });
  try {
    assert.equal(item(f, "UBTC").contract, undefined);
    assert.equal(item(f, "UBTC").isAssetClickable, false);
    const initial = f.calls.meta;
    await f.tick(499);
    assert.equal(f.calls.meta, initial);
    f.state.meta = {
      universes: [spotUniverse("UBTC", "USDH"), spotUniverse("UBTC")],
      tokens: [{ name: "UBTC", tokenId: "0xABCD" }],
    };
    await f.tick(1);
    assert.equal(f.calls.meta, initial + 2);
    assert.equal(item(f, "UBTC").contract, "0xabcd");
    assert.equal(item(f, "UBTC").spotUniverse.quoteName, "USDC");
    assert.equal(f.clock.countTimers(), 0);
  } finally {
    await f.close();
  }
});
test("D10-46 actual metadata capped exponential retry and unmount cleanup, no perpetual polling", async () => {
  const f = await spotHoldingsFixture({ meta: { universes: [], tokens: [] } });
  try {
    await f.tick(40000);
    assert.equal(f.calls.meta, 22);
    assert.equal(f.clock.countTimers(), 0);
    await f.tick(60000);
    assert.equal(f.calls.meta, 22);
  } finally {
    await f.close();
  }
  const g = await spotHoldingsFixture({ meta: { universes: [], tokens: [] } });
  await g.close();
  await g.tick(60000);
  assert.equal(g.calls.meta, 2);
  assert.equal(g.clock.countTimers(), 0);
});
test("D10-92 actual English column labels and current rows have no untranslated key placeholders", async () => {
  const f = await spotHoldingsFixture({ locale: "en_US" });
  try {
    assert.deepEqual(plain(f.table.props.columns.map((col) => col.title)), [
      "Asset",
      "Balance",
      "Available",
      "Value",
      "PnL (ROE%)",
      "Contract",
    ]);
    assert.ok(f.texts().every((text) => !/^(perp_|global_)/u.test(text)));
  } finally {
    await f.close();
  }
});
