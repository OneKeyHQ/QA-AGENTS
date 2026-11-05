import test from "node:test";
import assert from "node:assert/strict";
import { formModeFixture } from "./form-mode-fixture.mjs";
const plain = (v) => JSON.parse(JSON.stringify(v));
const seed = (f, inputMode) =>
  Object.assign(f.state.form, {
    type: "limit",
    orderMode: "standard",
    price: "99",
    side: "short",
    leverage: 12,
    size: inputMode === "manual" ? "0.5" : "",
    sizePercent: inputMode === "slider" ? 35 : 0,
    sizeInputMode: inputMode,
    bboPriceMode: { type: "queue", offsetTicks: 5 },
    hasTpsl: true,
    tpTriggerPx: "120",
    slTriggerPx: "80",
    tpValue: "12",
    slValue: "7",
    tpType: "percent",
    slType: "percent",
    tpGainPercent: "12",
    slLossPercent: "7",
    triggerPrice: "110",
    executionPrice: "105",
    triggerReduceOnly: false,
  });
for (const inputMode of ["manual", "slider"])
  for (const type of ["triggerMarket", "triggerLimit", "scale", "twap"])
    test(`D08-16/D20 actual ${inputMode} -> ${type} resets all attached TP/SL and BBO, preserves general fields`, () => {
      const f = formModeFixture();
      seed(f, inputMode);
      const before = { ...f.state.form };
      f.advanced(type);
      for (const key of [
        "size",
        "sizePercent",
        "sizeInputMode",
        "side",
        "leverage",
        "price",
        "triggerPrice",
        "executionPrice",
        "triggerReduceOnly",
      ])
        assert.deepEqual(f.state.form[key], before[key], key);
      assert.equal(f.state.form.hasTpsl, false);
      assert.equal(f.state.form.bboPriceMode, null);
      for (const key of [
        "tpTriggerPx",
        "slTriggerPx",
        "tpValue",
        "slValue",
        "tpGainPercent",
        "slLossPercent",
      ])
        assert.equal(f.state.form[key], "", key);
      assert.equal(f.state.form.tpType, "price");
      assert.equal(f.state.form.slType, "price");
      assert.equal(
        f.state.form.orderMode,
        type.startsWith("trigger") ? "trigger" : type,
      );
      assert.equal(
        f.state.form.type,
        type === "triggerLimit" || type === "scale" ? "limit" : "market",
      );
      assert.equal(f.state.settings.lastAdvancedOrderType, type);
      if (type.startsWith("trigger"))
        assert.equal(f.state.settings.lastTriggerOrderType, type);
      for (const target of ["market", "limit"]) {
        const advanced = { ...f.state.form };
        f.primary(target);
        assert.deepEqual(plain(f.state.form), {
          ...advanced,
          orderMode: "standard",
          type: target,
        });
        f.primary("trigger");
        assert.equal(
          f.state.form.orderMode,
          type.startsWith("trigger") ? "trigger" : type,
        );
      }
      assert.deepEqual(f.calls, []);
    });
test("D08-16 actual menu option order and spot excludes both conditional types", () => {
  const f = formModeFixture();
  assert.deepEqual(
    JSON.parse(JSON.stringify(f.options())).map((x) => x.value),
    ["triggerMarket", "triggerLimit", "scale", "twap"],
  );
  f.state.instrument.mode = "spot";
  assert.deepEqual(
    JSON.parse(JSON.stringify(f.options())).map((x) => x.value),
    ["scale", "twap"],
  );
  f.advanced("triggerLimit");
  assert.equal(f.state.form.orderMode, "scale");
  assert.equal(f.state.form.scaleReduceOnly, false);
});
test("D08-16 actual opposite side clears size/percentage but preserves conditional fields; same side is inert", () => {
  const f = formModeFixture();
  seed(f, "slider");
  f.advanced("triggerLimit");
  const before = { ...f.state.form };
  f.side("short");
  assert.deepEqual(plain(f.state.form), before);
  f.side("long");
  assert.deepEqual(plain(f.state.form), {
    ...before,
    side: "long",
    size: "",
    sizePercent: 0,
    sizeInputMode: "manual",
    twapStopPrice: "",
  });
});
for (const [value, expected] of [
  [-1, 0],
  [0, 0],
  [35, 35],
  [100, 100],
  [101, 100],
  [NaN, 0],
  [Infinity, 0],
  [[75], 75],
  [[], 0],
])
  test(`D08-16 actual slider boundary ${JSON.stringify(value)} clears manual size and clamps`, () => {
    const f = formModeFixture();
    seed(f, "manual");
    f.slider(value);
    assert.equal(f.state.form.size, "");
    assert.equal(f.state.form.sizePercent, expected);
    assert.equal(f.state.form.sizeInputMode, "slider");
    f.manual("0.25");
    assert.equal(f.state.form.sizePercent, 0);
    assert.equal(f.state.form.sizeInputMode, "manual");
    assert.equal(f.state.form.size, "0.25");
  });
