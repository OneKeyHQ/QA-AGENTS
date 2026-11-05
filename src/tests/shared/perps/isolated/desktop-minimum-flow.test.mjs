import test from "node:test";
import assert from "node:assert/strict";
import { minimumFlowFixture } from "./minimum-flow-fixture.mjs";
for (const leverage of [1, 20])
  test(`D15-85/89 actual margin minimum follows ${leverage}x and has no subtitle or order action`, async () => {
    const f = await minimumFlowFixture({ unit: "margin", leverage });
    try {
      assert.equal(f.validate(), "emptySize");
      const toast = f.toasts.at(-1);
      assert.equal(
        toast.title,
        `仓位大小必须至少 $${leverage === 1 ? "10.00" : "0.50"}`,
      );
      assert.equal(toast.message, undefined);
      assert.equal(toast.actions.props.children, "填入最小金额");
      await f.fill();
      assert.equal(f.input().value, leverage === 1 ? "10.00" : "0.50");
      assert.equal(f.validate(), undefined);
      assert.equal(f.toasts.length, 1);
    } finally {
      await f.close();
    }
  });
test("D15-90 actual same SizeInput recalculates new symbol/price/precision minimum before next validation", async () => {
  const f = await minimumFlowFixture({ unit: "token" });
  try {
    assert.equal(f.validate(), "emptySize");
    assert.equal(f.toasts.at(-1).title, "仓位大小必须至少 0.10000 BTC");
    await f.update({
      symbol: "kPEPE",
      referencePrice: "0.00123",
      precision: 0,
    });
    assert.equal(f.validate(), "emptySize");
    assert.equal(f.toasts.at(-1).title, "仓位大小必须至少 8131 kPEPE");
    await f.fill();
    assert.equal(f.state.token, "8131");
    assert.equal(f.validate(), undefined);
  } finally {
    await f.close();
  }
});
test("D15-91 limit-price conversion and shortcut clear minimum on next local validation", async () => {
  const f = await minimumFlowFixture({
    unit: "token",
    referencePrice: "33",
    precision: 2,
    token: "0.3",
  });
  try {
    assert.equal(f.validate(), "minimumOrderNotMet");
    assert.equal(f.toasts.at(-1).title, "仓位大小必须至少 0.31 BTC");
    await f.fill();
    assert.equal(f.state.token, "0.31");
    assert.equal(f.market.values.long.notional, "10.23");
    assert.equal(f.validate(), undefined);
    assert.equal(f.toasts.length, 1);
  } finally {
    await f.close();
  }
});
test("D15-119 actual sufficient notional with insufficient margin uses separate toast without minimum shortcut", async () => {
  const f = await minimumFlowFixture({ token: "1000", unit: "token" });
  try {
    assert.equal(f.market.values.long.noEnoughMargin, true);
    assert.equal(f.validate(), "insufficientMargin");
    assert.equal(f.toasts.length, 1);
    assert.equal(f.toasts[0].title, "保证金不足");
    assert.notEqual(f.toasts[0].actions.props.children, "填入最小金额");
    assert.equal(
      f.toasts[0].actions.props.testID,
      "perp-margin-toast-deposit-button",
    );
  } finally {
    await f.close();
  }
});
test("D15-120 actual slider minimum shortcut changes to manual and fills dynamic margin amount", async () => {
  const f = await minimumFlowFixture({
    inputMode: "slider",
    sliderPercent: 0,
    unit: "margin",
    leverage: 20,
  });
  try {
    assert.equal(f.validate(), "emptySize");
    assert.equal(f.toasts.at(-1).title, "仓位大小必须至少 $0.50");
    await f.fill();
    assert.equal(f.state.inputMode, "manual");
    assert.deepEqual(f.manual, [true]);
    assert.equal(f.state.token, "0.1");
    assert.equal(f.input().value, "0.50");
    assert.equal(f.validate(), undefined);
  } finally {
    await f.close();
  }
});
for (const price of ["", "0", "NaN"])
  test(`D15-121 missing price ${JSON.stringify(price)} gives finite $10 fallback without shortcut`, async () => {
    const f = await minimumFlowFixture({
      referencePrice: price,
      orderType: "market",
    });
    try {
      assert.equal(f.actionRef.current, undefined);
      assert.equal(f.validate(), "emptySize");
      assert.equal(f.toasts.at(-1).title, "仓位大小必须至少 $10");
      assert.equal(f.toasts.at(-1).actions, undefined);
      assert.doesNotMatch(JSON.stringify(f.toasts), /NaN|Infinity/);
    } finally {
      await f.close();
    }
  });
test("D15-123 captured old shortcut fills its original token value, then actual current price creates one new minimum without looping", async () => {
  const f = await minimumFlowFixture({ unit: "token" });
  try {
    assert.equal(f.validate(), "emptySize");
    const old = f.toasts.at(-1);
    await f.update({ referencePrice: "50" });
    await f.fill(old);
    assert.equal(f.state.token, "0.10000");
    assert.equal(f.validate(), "minimumOrderNotMet");
    assert.equal(f.toasts.at(-1).title, "仓位大小必须至少 0.20000 BTC");
    assert.equal(f.toasts.length, 2);
    await f.fill();
    assert.equal(f.validate(), undefined);
    assert.equal(f.toasts.length, 2);
  } finally {
    await f.close();
  }
});
for (const bbo of [false, true])
  for (const side of ["long", "short"])
    test(`D15-122/173 actual spot ${bbo ? "BBO" : "limit"} ${side} compares submitted lot-normalized notional at below/exact/above $10`, async () => {
      const f = await minimumFlowFixture({
        spot: true,
        bbo,
        side,
        unit: "token",
        symbol: "HYPE",
        precision: 2,
        referencePrice: "100",
      });
      try {
        for (const [token, expected, notional] of [
          ["0.09999", "minimumOrderNotMet", "9"],
          ["0.1", undefined, "10"],
          ["0.11", undefined, "11"],
        ]) {
          await f.update({ token });
          assert.equal(f.market.values[side].notional, notional);
          const count = f.toasts.length;
          assert.equal(f.validate(), expected);
          if (expected) {
            assert.equal(f.toasts.at(-1).title, "仓位大小必须至少 0.10 HYPE");
            assert.equal(
              f.toasts.at(-1).actions.props.children,
              "填入最小金额",
            );
          } else assert.equal(f.toasts.length, count);
        }
      } finally {
        await f.close();
      }
    });
test("D15-89 same mounted margin input switches 1x→20x→1x and refreshes the exact next minimum action", async () => {
  const f = await minimumFlowFixture({
    unit: "margin",
    referencePrice: "33333",
    precision: 5,
    leverage: 1,
  });
  try {
    for (const [leverage, amount] of [
      [1, "10.34"],
      [20, "0.52"],
      [1, "10.34"],
    ]) {
      await f.update({ leverage });
      assert.equal(f.validate(), "emptySize");
      assert.equal(f.toasts.at(-1).title, `仓位大小必须至少 $${amount}`);
    }
    assert.equal(f.changes.length, 0);
  } finally {
    await f.close();
  }
});
