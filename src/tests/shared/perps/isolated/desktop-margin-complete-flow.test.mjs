// Full selector/modal/form composition; actual service feed guard and side hooks.
import test from "node:test";
import assert from "node:assert/strict";
import { marginCompleteFixture } from "./margin-complete-fixture.mjs";
const plain = (v) => JSON.parse(JSON.stringify(v));
const label = (f) => f.select().findByType("SizableText").children.join("");
const withoutLeverage = ({ leverage, ...v }) => v;
for (const mode of ["twap", "scale"])
  test(`D11-${mode === "twap" ? "233" : "234"} actual full ${mode} form isolated -> cross -> actual feed preserves complete draft and recalculates`, async () => {
    const form = {
      orderMode: mode,
      type: "limit",
      price: "100",
      size: "2",
      sizeInputMode: "manual",
      twapDurationMinutes: "75",
      twapRandomize: false,
      twapReduceOnly: true,
      scaleLowerPrice: "90",
      scaleUpperPrice: "110",
      scaleOrderCount: "4",
      scaleTif: "Alo",
      scaleSizeDistribution: "increasing",
      scaleReduceOnly: false,
    };
    const f = await marginCompleteFixture({
      form,
      mid: "100",
      ctx: { ctx: { markPrice: "100" } },
      assetData: { markPx: "100" },
    });
    try {
      const draft = plain(f.state.form);
      assert.equal(label(f), "逐仓");
      assert.equal(f.select().props.disabled, false);
      assert.equal(f.calc.values.long.quantity, "2");
      assert.equal(f.calc.values.long.notional, "200");
      assert.equal(f.calc.values.long.margin, "20");
      assert.equal(f.calc.values.long.maxTradeSize, 20);
      await f.open();
      assert.match(f.config.title, /BTC/);
      assert.equal(
        f.root().findByType("MarginDialog").props.title,
        f.config.title,
      );
      await f.choose("cross");
      await f.confirm();
      assert.equal(f.config, undefined);
      assert.deepEqual(f.events.exchanges, [
        { asset: 0, leverage: 10, isCross: true },
      ]);
      assert.equal(
        label(f),
        "逐仓",
        "Successful response alone must not invent a live feed",
      );
      assert.deepEqual(plain(f.state.form), draft);
      await f.feed({
        leverage: { type: "cross", value: 10 },
        markPx: "100",
        maxTradeSzs: ["40", "60"],
        availableToTrade: ["400", "600"],
      });
      assert.equal(label(f), "全仓");
      assert.deepEqual(plain(f.state.form), draft);
      assert.equal(f.calc.values.long.quantity, "2");
      assert.equal(f.calc.values.long.notional, "200");
      assert.equal(f.calc.values.long.margin, "20");
      assert.equal(f.calc.values.long.maxTradeSize, 40);
      assert.equal(f.calc.values.short.maxTradeSize, 60);
      assert.deepEqual(plain(f.state.env.maxTradeSzs), ["40", "60"]);
      assert.deepEqual(plain(f.state.env.availableToTrade), [600, 600]);
      // Independent feed leverage change must propagate through the real form effect.
      await f.feed({
        leverage: { type: "cross", value: 20 },
        markPx: "100",
        maxTradeSzs: ["80", "120"],
        availableToTrade: ["400", "600"],
      });
      assert.equal(f.state.form.leverage, 20);
      assert.deepEqual(
        withoutLeverage(plain(f.state.form)),
        withoutLeverage(draft),
      );
      assert.equal(f.calc.values.long.quantity, "2");
      assert.equal(f.calc.values.long.notional, "200");
      assert.equal(f.calc.values.long.margin, "10");
      assert.equal(f.calc.values.long.maxTradeSize, 80);
      assert.equal(f.events.errors.length, 0);
      assert.equal(f.events.snapshots.length, 2);
    } finally {
      await f.close();
    }
  });
test("D11-233 actual full TWAP slider quantity/max recompute from cross feed, retaining duration/randomize/reduce flags", async () => {
  const f = await marginCompleteFixture({
    mid: "100",
    ctx: { ctx: { markPrice: "100" } },
    assetData: { markPx: "100" },
    form: {
      orderMode: "twap",
      size: "",
      sizeInputMode: "slider",
      sizePercent: 50,
      twapDurationMinutes: "90",
      twapRandomize: true,
      twapReduceOnly: false,
    },
  });
  try {
    const draft = plain(f.state.form);
    assert.equal(f.calc.values.long.quantity, "10");
    assert.equal(f.calc.values.long.notional, "1000");
    assert.equal(f.calc.values.long.margin, "100");
    await f.open();
    await f.choose("cross");
    await f.confirm();
    await f.feed({
      leverage: { type: "cross", value: 10 },
      markPx: "100",
      maxTradeSzs: ["40", "60"],
      availableToTrade: ["400", "600"],
    });
    assert.equal(label(f), "全仓");
    assert.deepEqual(plain(f.state.form), draft);
    assert.equal(f.calc.values.long.quantity, "20");
    assert.equal(f.calc.values.short.quantity, "30");
    assert.equal(f.calc.values.long.notional, "2000");
    assert.equal(f.calc.values.long.margin, "200");
  } finally {
    await f.close();
  }
});
test("D11-233/234 actual margin selector ignores stale coin feed and rejected update preserves form/live mode", async () => {
  const f = await marginCompleteFixture({
    reject: true,
    form: { orderMode: "twap", size: "2", twapDurationMinutes: "75" },
  });
  try {
    const draft = plain(f.state.form);
    await f.open();
    await f.choose("cross");
    await f.confirm();
    assert.equal(f.events.exchanges.length, 1);
    assert.equal(f.events.errors.length, 1);
    assert.equal(label(f), "逐仓");
    assert.deepEqual(plain(f.state.form), draft);
    await f.feed({
      coin: "ETH",
      leverage: { type: "cross", value: 20 },
      maxTradeSzs: ["999", "999"],
    });
    assert.equal(f.calc.state.assetData.coin, "BTC");
    assert.equal(label(f), "逐仓");
    assert.deepEqual(plain(f.state.form), draft);
    await f.update({});
    assert.equal(f.config, undefined);
  } finally {
    await f.close();
  }
});
