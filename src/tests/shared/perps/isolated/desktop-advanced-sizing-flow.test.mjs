import test from "node:test";
import assert from "node:assert/strict";
import { minimumFlowFixture as mount } from "./minimum-flow-fixture.mjs";
const config = (mode) => ({
  orderMode: mode,
  twapDurationMinutes: "10",
  scaleLowerPrice: "90",
  scaleUpperPrice: "110",
  scaleOrderCount: "5",
});
for (const mode of ["twap", "scale"])
  for (const side of ["long", "short"])
    test(`D11-62/78/179 actual ${mode}/${side} slider0/20/40/60/80/100 drives quantity/notional/secondary`, async () => {
      const f = await mount({
        inputMode: "slider",
        side,
        referencePrice: "100",
        markPrice: "100",
        maxTradeSzs: ["10", "20"],
        unit: "usd",
        formOverrides: config(mode),
      });
      try {
        for (const pct of [0, 20, 40, 60, 80, 100]) {
          await f.slider(pct);
          const v = f.market.values[side],
            quantity = pct * (side === "long" ? 0.1 : 0.2);
          assert.equal(Number(v.quantity), quantity);
          assert.equal(Number(v.notional), quantity * 100);
          assert.equal(Number(v.margin), quantity * 5);
          assert.equal(
            v.secondary,
            pct ? `≈ $${(quantity * 100).toFixed(2)}` : null,
          );
          assert.equal(v.noEnoughMargin, false);
          if (pct) assert.equal(f.validate(), undefined);
        }
      } finally {
        await f.close();
      }
    });
for (const mode of ["twap", "scale"])
  test(`D11-63/181/D15-62/63/64 actual ${mode} typed USD200 -> token2 -> cost20 -> USD200 remains same order`, async () => {
    const f = await mount({
      referencePrice: "100",
      markPrice: "100",
      leverage: 10,
      precision: 2,
      formOverrides: config(mode),
    });
    try {
      await f.type("200");
      assert.equal(f.input().value, "200");
      assert.equal(f.state.token, "2");
      assert.equal(f.market.values.long.notional, "200");
      assert.equal(f.validate(), undefined);
      await f.mode("token");
      assert.equal(f.state.unit, "token");
      assert.equal(f.input().value, "2");
      assert.equal(f.state.token, "2");
      assert.equal(f.market.values.long.secondary, "2.00 BTC");
      await f.mode("margin");
      assert.equal(f.state.unit, "margin");
      assert.equal(f.input().value, "20");
      assert.equal(f.state.token, "2");
      assert.equal(f.market.values.long.notional, "200");
      assert.equal(f.market.values.long.margin, "20");
      await f.mode("usd");
      assert.equal(f.input().value, "200");
      assert.equal(f.state.token, "2");
      assert.equal(f.market.values.long.secondary, "≈ $200.00");
      assert.equal(f.validate(), undefined);
    } finally {
      await f.close();
    }
  });
for (const mode of ["twap", "scale"])
  for (const side of ["long", "short"])
    test(`D11-292/293 actual spot ${mode}/${side} 100% floors available USDC and base including holds`, async () => {
      const f = await mount({
        spot: true,
        symbol: "PURRDAT",
        side,
        inputMode: "slider",
        sliderPercent: 100,
        referencePrice: "11",
        precision: 2,
        balances: [
          { coin: "USDC", total: "110", hold: "10" },
          { coin: "PURRDAT", total: "40", hold: "5" },
        ],
        formOverrides: {
          ...config(mode),
          scaleLowerPrice: "10",
          scaleUpperPrice: "12",
        },
      });
      try {
        const v = f.market.values[side];
        assert.equal(v.quantity, side === "long" ? "9.09" : "35");
        assert.equal(v.notional, side === "long" ? "99.99" : "385");
        assert.equal(v.leverage, 1);
        assert.equal(v.noEnoughMargin, false);
        assert.equal(v.secondary, side === "long" ? "≈ $99.99" : "≈ $385.00");
        // TWAP's raw minimum100 still rejects floor-truncated99.99; no rounding-up oracle.
        assert.equal(
          f.validate(),
          mode === "twap" && side === "long" ? "invalidTwapConfig" : undefined,
        );
      } finally {
        await f.close();
      }
    });
for (const side of ["long", "short"])
  test(`D11-177 actual reduce-only scale ${side} 100% caps at reverse35, not free-margin maximum`, async () => {
    const pos = side === "long" ? "-35" : "35",
      f = await mount({
        symbol: "PURRDAT",
        side,
        inputMode: "slider",
        sliderPercent: 100,
        referencePrice: "11",
        markPrice: "11",
        precision: 2,
        maxTradeSzs: ["100", "100"],
        positions: [{ position: { coin: "PURRDAT", szi: pos } }],
        formOverrides: {
          ...config("scale"),
          scaleLowerPrice: "10",
          scaleUpperPrice: "12",
          scaleReduceOnly: true,
        },
      });
    try {
      const v = f.market.values[side];
      assert.equal(v.quantity, "35");
      assert.equal(v.notional, "385");
      assert.equal(v.noEnoughMargin, false);
      assert.equal(f.validate(), undefined);
    } finally {
      await f.close();
    }
  });
for (const pos of ["0", "35"])
  test(`D11-174 actual reduce-only scale buy with position${pos} 100% keeps maximum quantity for subsequent reduce-only guard`, async () => {
    const f = await mount({
      symbol: "PURRDAT",
      inputMode: "slider",
      sliderPercent: 100,
      referencePrice: "11",
      markPrice: "11",
      precision: 2,
      positions: [{ position: { coin: "PURRDAT", szi: pos } }],
      formOverrides: { ...config("scale"), scaleReduceOnly: true },
    });
    try {
      assert.equal(f.market.values.long.quantity, "2.2");
      assert.equal(f.market.values.long.secondary, "≈ $220.00");
    } finally {
      await f.close();
    }
  });
for (const mode of ["twap", "scale"])
  test(`D11-233/234 actual ${mode} margin metadata change retains complete draft while recomputing cost`, async () => {
    const form = {
        ...config(mode),
        size: "2",
        twapRandomize: false,
        twapReduceOnly: false,
        scaleSizeDistribution: "increasing",
        scaleReduceOnly: false,
        tif: "Ioc",
      },
      f = await mount({ token: "2", leverage: 10, formOverrides: form });
    try {
      const before = JSON.parse(JSON.stringify(f.market.state.form));
      assert.equal(f.market.values.long.margin, "20");
      await f.update({ leverage: 20, maxTradeSzs: ["40", "40"] });
      assert.deepEqual(f.market.state.form, before);
      assert.equal(f.market.values.long.quantity, "2");
      assert.equal(f.market.values.long.notional, "200");
      assert.equal(f.market.values.long.margin, "10");
    } finally {
      await f.close();
    }
  });
