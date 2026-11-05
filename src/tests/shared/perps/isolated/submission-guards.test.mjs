// Executes the actual pre-submit callback. No outer order handler is loaded.
import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateCallback,
  evaluateSource,
  perpsUtils,
  BigNumber,
} from "./source.mjs";
const utils = perpsUtils();
const translations = new Proxy({}, { get: (_, key) => key });
const twap = evaluateSource(
  "packages/shared/src/utils/hyperliquidTwapUtils.ts",
  {
    mocks: {
      "../locale/enum/translations": { ETranslations: translations },
      "./numberUtils": {
        formatLocalizedNumberString: String,
        numberFormat: String,
      },
      "./perpsUtils": utils,
    },
  },
);
const scale = evaluateSource(
  "packages/shared/src/utils/hyperliquidScaleOrderUtils.ts",
  {
    mocks: {
      "@onekeyhq/shared/src/errors": { OneKeyLocalError: Error },
      "@onekeyhq/shared/src/utils/perpsUtils": utils,
    },
  },
);
const skip = evaluateSource(
  "packages/kit/src/views/Perp/utils/perpsOrderPanelEnableTrading.ts",
  { names: ["shouldSkipPerpsOrderPanelComputedSizeValidation"] },
);
const state = (patch = {}, form = {}) => ({
  computedSizeForSide: new BigNumber(1),
  effectivePriceBN: new BigNumber(100),
  formData: { type: "market", size: "1", sizeInputMode: "manual", ...form },
  isMinimumOrderNotMetForSide: false,
  isNoEnoughMargin: false,
  isSpot: false,
  isScaleMode: false,
  isTriggerMode: false,
  isTwapMode: false,
  midPriceBN: new BigNumber(100),
  priceError: undefined,
  shouldBlockForMarketData: false,
  szDecimals: 2,
  twapReferencePriceBN: new BigNumber(100),
  twapTriggerReferencePriceBN: new BigNumber(100),
  ...patch,
});
function fixture() {
  const toast = [],
    focus = [],
    actions = [];
  const intl = {
    formatMessage: ({ id }, args) => `${id}:${JSON.stringify(args ?? {})}`,
  };
  const validate = evaluateCallback(
    "packages/kit/src/views/Perp/components/TradingPanel/TradingButtonGroup.tsx",
    "validateOrderPanelState",
    {
      ...twap,
      ...scale,
      ...skip,
      BigNumber,
      intl,
      ETranslations: translations,
      ETriggerOrderType: { TRIGGER_LIMIT: "triggerLimit" },
      Toast: { message: (x) => toast.push(x), error: (x) => toast.push(x) },
      minimumOrderActionRef: {
        current: { amountLabel: "$10.57", onPress: () => actions.push("fill") },
      },
      onRequestSizeInputFocus: () => focus.push(true),
      showNoEnoughMarginToast: (isSpot) => toast.push({ margin: true, isSpot }),
      getMinimumOrderToastActionProps: (action) => ({ action }),
      getScaleOrderValidationErrorMessage: () => "Invalid scale order",
    },
  );
  return {
    validate,
    toast,
    focus,
    actions,
    run: (s, side = "long", bbo = true) =>
      validate({
        orderPanelState: s,
        validationSide: side,
        shouldValidateBboPriceError: bbo,
      }),
  };
}
for (const isSpot of [false, true])
  for (const type of ["market", "limit"])
    for (const side of ["long", "short"])
      for (const boundary of ["empty", "zero", "below", "margin", "valid"])
        test(`提交前守卫 ${isSpot ? "spot" : "perp"}/${type}/${side}/${boundary}`, () => {
          const f = fixture();
          const form = {
            type,
            price: "100",
            size: boundary === "empty" ? "" : "1",
          };
          const patch =
            boundary === "zero"
              ? { computedSizeForSide: new BigNumber(0) }
              : boundary === "below"
                ? { isMinimumOrderNotMetForSide: true }
                : boundary === "margin"
                  ? { isNoEnoughMargin: true }
                  : {};
          const result = f.run(state({ ...patch, isSpot }, form), side);
          assert.equal(
            result,
            {
              empty: "emptySize",
              zero: "minimumOrderNotMet",
              below: "minimumOrderNotMet",
              margin: "insufficientMargin",
              valid: undefined,
            }[boundary],
          );
          if (["empty", "zero", "below"].includes(boundary)) {
            assert.equal(f.focus.length, 1);
            assert.equal(f.toast[0].action.amountLabel, "$10.57");
            f.toast[0].action.onPress();
            assert.deepEqual(f.actions, ["fill"]);
          }
          if (boundary === "margin") {
            assert.equal(f.toast[0].margin, true);
            assert.equal(f.toast[0].action, undefined);
          }
        });
for (const value of ["", "   "])
  test(`普通限价缺少价格 ${JSON.stringify(value)}`, () =>
    assert.equal(
      fixture().run(state({}, { type: "limit", price: value })),
      "missingLimitPrice",
    ));
for (const side of ["long", "short"])
  for (const type of ["triggerMarket", "triggerLimit"])
    for (const value of ["", "0", "-1", "100"])
      test(`条件单触发价空/非正/等于mid ${side}/${type}/${value}`, () =>
        assert.equal(
          fixture().run(
            state(
              { isTriggerMode: true },
              {
                triggerOrderType: type,
                triggerPrice: value,
                executionPrice: "99",
              },
            ),
            side,
          ),
          "invalidTriggerPrice",
        ));
for (const value of ["", "0", "-1"])
  test(`限价条件单执行价无效 ${value}`, () =>
    assert.equal(
      fixture().run(
        state(
          { isTriggerMode: true },
          {
            triggerOrderType: "triggerLimit",
            triggerPrice: "110",
            executionPrice: value,
          },
        ),
      ),
      "invalidLimitPrice",
    ));
for (const value of ["90", "110"])
  for (const side of ["long", "short"])
    test(`条件单不按方向限制触发价 ${side}/${value}`, () =>
      assert.equal(
        fixture().run(
          state(
            { isTriggerMode: true },
            { triggerOrderType: "triggerMarket", triggerPrice: value },
          ),
          side,
        ),
        undefined,
      ));
for (const raw of ["", "0", "4", "4.5", "10081", "NaN"])
  test(`TWAP 时长禁止 ${raw}`, () =>
    assert.equal(
      fixture().run(state({ isTwapMode: true }, { twapDurationMinutes: raw })),
      "invalidTwapConfig",
    ));
for (const raw of ["5", "1440", "1441", "10080"])
  test(`TWAP 时长边界允许 ${raw}`, () =>
    assert.equal(
      fixture().run(state({ isTwapMode: true }, { twapDurationMinutes: raw })),
      undefined,
    ));
for (const value of ["0", "0.99", "1", "1.01"])
  test(`TWAP $100 最低名义金额 ${value}`, () =>
    assert.equal(
      fixture().run(
        state(
          { isTwapMode: true, computedSizeForSide: new BigNumber(value) },
          { twapDurationMinutes: "10" },
        ),
      ),
      new BigNumber(value).lt(1) ? "invalidTwapConfig" : undefined,
    ));
for (const price of ["0", "NaN", "Infinity"])
  test(`TWAP 无效行情 ${price}`, () =>
    assert.equal(
      fixture().run(
        state(
          { isTwapMode: true, twapReferencePriceBN: new BigNumber(price) },
          { twapDurationMinutes: "10" },
        ),
      ),
      "marketDataUnavailable",
    ));
for (const count of ["0", "1", "1.5", "101", "NaN", ""])
  test(`Scale 订单数非法 ${count}`, () =>
    assert.equal(
      fixture().run(
        state(
          { isScaleMode: true },
          {
            scaleLowerPrice: "90",
            scaleUpperPrice: "110",
            scaleOrderCount: count,
          },
        ),
      ),
      "invalidScaleConfig",
    ));
for (const [lo, hi] of [
  ["0", "100"],
  ["-1", "100"],
  ["100", "100"],
  ["NaN", "110"],
  ["90", "Infinity"],
])
  test(`Scale 区间非法 ${lo}/${hi}`, () =>
    assert.equal(
      fixture().run(
        state(
          { isScaleMode: true },
          { scaleLowerPrice: lo, scaleUpperPrice: hi, scaleOrderCount: "5" },
        ),
      ),
      "invalidScaleConfig",
    ));
for (const count of ["2", "100"])
  test(`Scale 两端合法订单数 ${count}`, () =>
    assert.equal(
      fixture().run(
        state(
          { isScaleMode: true, computedSizeForSide: new BigNumber(1000) },
          {
            scaleLowerPrice: "90",
            scaleUpperPrice: "110",
            scaleOrderCount: count,
          },
        ),
      ),
      undefined,
    ));
for (const side of ["long", "short"])
  for (const field of ["tpValue", "slValue"])
    test(`附带止盈止损价格方向守卫 ${side}/${field}`, () => {
      const f = fixture();
      assert.equal(
        f.run(
          state(
            {},
            { hasTpsl: true, tpType: "price", slType: "price", [field]: "100" },
          ),
          side,
        ),
        "invalidTpsl",
      );
    });
test("BBO 不可用、行情陈旧和保证金错误分别拦截", () => {
  const f = fixture();
  assert.equal(
    f.run(state({ priceError: "bbo_unavailable" })),
    "bboUnavailable",
  );
  assert.equal(
    f.run(state({ shouldBlockForMarketData: true })),
    "marketDataUnavailable",
  );
  assert.equal(f.run(state({ isNoEnoughMargin: true })), "insufficientMargin");
});
