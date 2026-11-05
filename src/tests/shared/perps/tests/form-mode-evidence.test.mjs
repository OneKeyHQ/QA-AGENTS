import test from "node:test";
import assert from "node:assert/strict";
import {
  projectFormModeDraft,
  assertAdvancedFormReset,
  assertReturnToStandard,
  assertOrderTabAppearance,
} from "../form-mode-evidence.mjs";
test("actual order tabs require one underline and distinct active/subdued text, not just the selected label", () => {
  const good = [
    { label: "市价单", color: "rgb(100, 100, 100)", lines: [] },
    { label: "限价单", color: "rgb(100, 100, 100)", lines: [] },
    { label: "限价止盈止损", color: "rgb(0, 0, 0)", lines: ["rgb(0, 0, 0)"] },
  ];
  assertOrderTabAppearance(good, "限价止盈止损");
  for (const change of [
    (s) => {
      s[0].lines = ["rgb(0, 0, 0)"];
    },
    (s) => {
      s[2].lines = [];
    },
    (s) => {
      s[0].color = s[2].color;
    },
    (s) => {
      s[2].lines[0] = "rgb(255, 0, 0)";
    },
    (s) => {
      s.pop();
    },
  ]) {
    const states = structuredClone(good);
    change(states);
    assert.throws(() => assertOrderTabAppearance(states, "限价止盈止损"));
  }
});
const before = () => ({
  coin: "BTC",
  type: "limit",
  orderMode: "standard",
  size: "0.5",
  sizePercent: 0,
  sizeInputMode: "manual",
  side: "short",
  price: "99",
  hasTpsl: true,
  bboPriceMode: { type: "queue", offsetTicks: 5 },
  tpValue: "120",
  slValue: "80",
  tpTriggerPx: "120",
  slTriggerPx: "80",
  tpGainPercent: "5",
  slLossPercent: "6",
  tpType: "percent",
  slType: "percent",
});
const cleared = (state, target) => ({
  ...state,
  hasTpsl: false,
  bboPriceMode: null,
  tpValue: "",
  slValue: "",
  tpTriggerPx: "",
  slTriggerPx: "",
  tpGainPercent: "",
  slLossPercent: "",
  tpType: "price",
  slType: "price",
  type: ["限价止盈止损", "分段委托"].includes(target) ? "limit" : "market",
  orderMode:
    target === "分段委托"
      ? "scale"
      : target === "分时委托"
        ? "twap"
        : "trigger",
});
test("mode reset checks all populated TP/SL and BBO fields, size identity and both input modes", () => {
  for (const target of ["市价止盈止损", "限价止盈止损", "分段委托", "分时委托"])
    for (const inputMode of ["manual", "slider"]) {
      const initial = {
        ...before(),
        sizeInputMode: inputMode,
        sizePercent: inputMode === "slider" ? 50 : 0,
      };
      const after = cleared(initial, target);
      assertAdvancedFormReset(initial, after, target);
      for (const key of [
        "coin",
        "size",
        "sizePercent",
        "sizeInputMode",
        "side",
        "price",
        "hasTpsl",
        "bboPriceMode",
        "tpValue",
        "slValue",
        "tpTriggerPx",
        "slTriggerPx",
        "tpGainPercent",
        "slLossPercent",
        "tpType",
        "slType",
      ])
        assert.throws(
          () =>
            assertAdvancedFormReset(
              initial,
              { ...after, [key]: key === "sizePercent" ? 25 : "wrong" },
              target,
            ),
          key,
        );
    }
});
test("returning to standard retains hidden values as well as visible inputs", () => {
  const state = {
    ...cleared(before(), "限价止盈止损"),
    triggerPrice: "110",
    executionPrice: "105",
    triggerReduceOnly: false,
  };
  for (const target of ["市价单", "限价单"]) {
    const after = {
      ...state,
      orderMode: "standard",
      type: target === "限价单" ? "limit" : "market",
    };
    assertReturnToStandard(state, after, target);
    for (const patch of [
      { size: "" },
      { triggerPrice: "" },
      { triggerReduceOnly: true },
      { bboPriceMode: { type: "queue" } },
    ])
      assert.throws(() =>
        assertReturnToStandard(state, { ...after, ...patch }, target),
      );
  }
});
test("form projection reads exactly one committed side ref beyond old hook caps and rejects duplicate/cyclic evidence", () => {
  const form = before(),
    hooks = Array.from({ length: 500 }, () => ({ memoizedState: null }));
  hooks.forEach((h, i) => {
    h.next = hooks[i + 1] ?? null;
  });
  hooks[472].memoizedState = {
    current: {
      activeTradeInstrument: { coin: "BTC" },
      formData: form,
      computedSizeForSide: {},
    },
  };
  const owner = {
    type: { displayName: "SideButtonInternal" },
    memoizedState: hooks[0],
  };
  const state = projectFormModeDraft(owner);
  assert.equal(state.size, "0.5");
  assert.equal(state.tpValue, "120");
  assert.deepEqual(form, before(), "Projection cannot alter the draft");
  hooks[473].memoizedState = hooks[472].memoizedState;
  assert.throws(() => projectFormModeDraft(owner), /got 2/);
  hooks[473].memoizedState = null;
  hooks[499].next = hooks[0];
  assert.throws(() => projectFormModeDraft(owner), /hook/);
  assert.throws(() => projectFormModeDraft({}), /owner/);
});
