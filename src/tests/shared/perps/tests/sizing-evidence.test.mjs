import test from "node:test";
import assert from "node:assert/strict";
import {
  assertManualSizing,
  assertSliderSizing,
} from "../desktop-sizing-boundaries.mjs";
import {
  projectSizingInput,
  projectSizingSide,
} from "../sizing-projection.mjs";
const input = () => ({
  mode: "manual",
  ready: true,
  symbol: "BTC",
  reference: "100",
  leverage: 10,
  decimals: 4,
  display: "200",
  token: "2",
});
const sides = () =>
  ["long", "short"].map((side) => ({
    side,
    spot: false,
    coin: "BTC",
    account: "Account-A",
    unit: "usd",
    mode: "manual",
    leverage: 10,
    decimals: 4,
    price: "100",
    quantity: "2",
    value: "200",
    text: "预览\n≈ $200.00",
  }));
test("Sizing assertions check both DOM sides against independently fixed input quantity", () => {
  assert.equal(assertManualSizing(input(), sides(), "usd"), "2");
  assert.equal(
    assertManualSizing(
      { ...input(), display: "2" },
      sides().map((v) => ({ ...v, unit: "token", text: "预览\n2.0000 BTC" })),
      "token",
    ),
    "2",
  );
  assert.equal(
    assertManualSizing(
      { ...input(), display: "20" },
      sides().map((v) => ({ ...v, unit: "margin", text: "预览\n2.0000 BTC" })),
      "margin",
    ),
    "2",
  );
});
for (const [label, mutate] of [
  ["missing second side", (i, v) => v.pop()],
  ["duplicate side", (i, v) => (v[1].side = "long")],
  ["stale input unit", (i, v) => (v[0].unit = "token")],
  ["stale coin", (i, v) => (v[1].coin = "ETH")],
  ["wrong quantity", (i, v) => (v[1].quantity = "3")],
  ["wrong committed input", (i, v) => (i.token = "3")],
  ["wrong notional", (i, v) => (v[1].value = "201")],
  ["stale DOM estimate", (i, v) => (v[1].text = "预览\n≈ $201.00")],
  ["different reference", (i, v) => (v[1].price = "101")],
  ["wrong leverage", (i, v) => (v[1].leverage = 20)],
  ["invalid display", (i, v) => (i.display = "NaN")],
  ["infinite reference", (i, v) => (i.reference = "Infinity")],
  ["zero price", (i, v) => (i.reference = "0")],
  ["zero leverage", (i, v) => (i.leverage = 0)],
])
  test(`Manual sizing rejects ${label}`, () => {
    const i = input(),
      v = sides();
    mutate(i, v);
    assert.throws(() => assertManualSizing(i, v, "usd"));
  });
const slider = (mode = "scale", percent = 40) => ({
  input: { ...input(), mode: "slider", percent },
  values: sides().map((v) => ({
    ...v,
    mode: "slider",
    percent,
    orderMode: mode,
    reduceOnly: false,
    twapMark: "100",
    quantity: v.side === "long" ? "1.2" : "2",
    value: v.side === "long" ? "120" : "200",
    text: `预览\n≈ $${v.side === "long" ? "120" : "200"}.00`,
    feeds: [
      {
        coin: "BTC",
        account: "account-a",
        mark: "100",
        leverage: 10,
        maxima: ["3", "5"],
      },
    ],
  })),
});
test("Slider checks distinct long/short remote maxima and actual estimates", () => {
  const s = slider();
  assertSliderSizing(s.input, s.values, "scale", 40);
});
test("TWAP maxima and notional use market-wide mark when the account mark differs", () => {
  const s = slider("twap");
  for (const v of s.values) v.feeds[0].mark = "90";
  assertSliderSizing(s.input, s.values, "twap", 40);
});
test("Scale adjusts account max at mark to midpoint price before percent rounding", () => {
  const s = slider();
  for (const v of s.values) {
    v.feeds[0].mark = "90";
    v.quantity = v.side === "long" ? "1.08" : "1.8";
    v.value = v.side === "long" ? "108" : "180";
    v.text = `≈ $${v.value}.00`;
  }
  assertSliderSizing(s.input, s.values, "scale", 40);
});
test("Zero percent requires zero quantity/value and no estimate", () => {
  const s = slider("scale", 0);
  for (const v of s.values) {
    // Actual EmptySizeSideButton does not subscribe to the account max feed.
    v.feeds = [];
    v.quantity = "0";
    v.value = "0";
    v.text = "预览";
  }
  assertSliderSizing(s.input, s.values, "scale", 0);
  s.values[1].text = "≈ $1.00";
  assert.throws(() => assertSliderSizing(s.input, s.values, "scale", 0));
});
for (const [label, mutate] of [
  ["wrong direction max", (s) => (s.values[1].quantity = "1.2")],
  ["wrong account", (s) => (s.values[1].feeds[0].account = "account-b")],
  ["missing feed", (s) => (s.values[0].feeds = [])],
  [
    "ambiguous feed",
    (s) => s.values[0].feeds.push({ ...s.values[0].feeds[0] }),
  ],
  ["stale DOM", (s) => (s.values[0].text = "≈ $999.00")],
  ["wrong percent", (s) => (s.input.percent = 60)],
  ["wrong order mode", (s) => (s.values[0].orderMode = "twap")],
  ["unexpected reduce only", (s) => (s.values[1].reduceOnly = true)],
  ["wrong notional", (s) => (s.values[1].value = "199")],
])
  test(`Slider rejects ${label}`, () => {
    const s = slider();
    mutate(s);
    assert.throws(() => assertSliderSizing(s.input, s.values, "scale", 40));
  });
const bn = (v) => ({ toFixed: () => v });
const state = () => ({
  activeTradeInstrument: { coin: "BTC" },
  formData: { orderMode: "twap", sizeInputMode: "slider", sizePercent: 40 },
  computedSizeForSide: bn("1.2"),
  effectivePriceBN: bn("99"),
  orderValue: bn("120"),
  side: "long",
  twapReferencePriceBN: bn("100"),
  twapTriggerReferencePriceBN: bn("100"),
  isSpot: false,
  resolvedSizeInputUnit: "usd",
  perpsAccount: { accountAddress: "Account-A" },
  leverage: 10,
  szDecimals: 4,
});
const fiber = (v) => ({
  type: { displayName: "SideButtonInternal" },
  memoizedState: {
    memoizedState: { current: v },
    next: {
      memoizedState: [
        {
          coin: "BTC",
          user: "Account-A",
          markPx: "90",
          maxTradeSzs: ["3", "5"],
          leverage: { value: 10 },
        },
      ],
    },
  },
});
test("Read-only sizing projection retains both independent feed and TWAP reference instead of mid", () => {
  const v = projectSizingSide(fiber(state()), { innerText: "≈ $120.00" });
  assert.equal(v.price, "100");
  assert.equal(v.twapMark, "100");
  assert.equal(v.feeds[0].mark, "90");
  assert.equal(v.feeds[0].account, "Account-A");
  assert.equal(v.feeds[0].leverage, 10);
});
test("Sizing projection fails closed on missing/ambiguous owners and cyclic hooks", () => {
  assert.throws(() => projectSizingSide({}, {}), /owner/);
  const f = fiber(state());
  f.memoizedState.next = { memoizedState: { current: state() } };
  assert.throws(() => projectSizingSide(f, {}), /one committed/);
  const c = fiber(state());
  c.memoizedState.next = c.memoizedState;
  assert.throws(() => projectSizingSide(c, {}), /hook chain/);
  const parent = {};
  parent.return = parent;
  assert.throws(() => projectSizingSide(parent, {}), /parent chain/);
});
test("SizeInput projection rejects ambiguous evidence and cyclic parents", () => {
  const props = {
    activeAsset: { universe: { szDecimals: 4 } },
    referencePrice: "100",
    leverage: 10,
    onRequestManualMode: () => {
      throw Error("must not invoke");
    },
    symbol: "BTC",
    value: "2",
    sizeInputMode: "manual",
    isAssetCtxReady: true,
  };
  const f = { memoizedProps: props };
  assert.equal(projectSizingInput(f, { value: "200" }).token, "2");
  f.return = { memoizedProps: { ...props, referencePrice: "101" } };
  assert.throws(() => projectSizingInput(f, { value: "200" }), /Ambiguous/);
  f.return = f;
  assert.throws(() => projectSizingInput(f, { value: "200" }), /parent chain/);
  assert.throws(() => projectSizingInput({}, {}), /missing/);
});
