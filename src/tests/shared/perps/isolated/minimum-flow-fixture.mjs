// Actual SizeInput -> current actual calculation hooks -> exact live-button
// minimum memo -> actual pre-submit validation. No submit/signing/service loads.
import {
  React,
  renderer,
  evaluateSource,
  evaluateCallback,
  perpsUtils,
  BigNumber,
} from "./source.mjs";
import { intl, ETranslations, twap } from "./twap-source-fixture.mjs";
import { bboPreviewFixture } from "./bbo-preview-fixture.mjs";
import { scopedCallback } from "./scoped-callback.mjs";
import { formModeFixture } from "./form-mode-fixture.mjs";
const inputFile =
  "packages/kit/src/views/Perp/components/TradingPanel/inputs/SizeInput.tsx";
const buttonFile =
  "packages/kit/src/views/Perp/components/TradingPanel/TradingButtonGroup.tsx";
const utils = {
  ...perpsUtils(),
  ...evaluateSource("packages/kit/src/views/Perp/utils/minimumOrderGuard.ts"),
};
const host =
  (type) =>
  ({ children, ...props }) =>
    React.createElement(type, props, children);
const components = Object.fromEntries(
  [
    "Button",
    "Divider",
    "Icon",
    "SizableText",
    "Select",
    "XStack",
    "YStack",
  ].map((n) => [n, host(n)]),
);
// Render the actual SizeInput suffix so its real mode-change callback is reachable.
components.Input = ({ children, customSuffix, ...props }) =>
  React.createElement(
    "Input",
    { ...props, customSuffix },
    children,
    customSuffix,
  );
const conversion = evaluateSource(
  "packages/kit/src/views/Perp/components/TradingPanel/inputs/sizeInputConversion.ts",
  { mocks: { "@onekeyhq/shared/src/utils/perpsUtils": utils } },
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
const scaleValidation = evaluateSource(
  "packages/kit/src/views/Perp/utils/scaleOrderValidation.ts",
  { mocks: { "@onekeyhq/shared/src/locale": { ETranslations } } },
);
const skip = evaluateSource(
  "packages/kit/src/views/Perp/utils/perpsOrderPanelEnableTrading.ts",
  { names: ["shouldSkipPerpsOrderPanelComputedSizeValidation"] },
);
const { ETriggerOrderType } = evaluateSource(
  "packages/shared/types/hyperliquid/types.ts",
  { names: ["ETriggerOrderType"] },
);
const actionProps = evaluateSource(inputFile, {
  names: ["getMinimumOrderToastActionProps"],
  globals: { platformEnv: { isNativeIOS: false }, Button: components.Button },
});
export async function minimumFlowFixture(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const state = {
    unit: "usd",
    token: "",
    referencePrice: "100",
    precision: 5,
    symbol: "BTC",
    leverage: 20,
    side: "long",
    inputMode: "manual",
    sliderPercent: 0,
    spot: false,
    bbo: false,
    orderType: "limit",
    ...patch,
  };
  const actionRef = { current: undefined },
    changes = [],
    toasts = [],
    manual = [],
    focus = [];
  const { SizeInput } = evaluateSource(inputFile, {
    globals: { setTimeout, clearTimeout },
    mocks: {
      "react-intl": { useIntl: () => intl },
      "@onekeyhq/components": components,
      "@onekeyhq/kit-bg/src/states/jotai/atoms": {
        usePerpsTradingPreferencesAtom: () => [
          { sizeInputUnit: state.unit },
          (update) => {
            const next =
              typeof update === "function"
                ? update({ sizeInputUnit: state.unit })
                : update;
            state.unit = next.sizeInputUnit;
          },
        ],
      },
      "@onekeyhq/shared/src/locale": { ETranslations },
      "@onekeyhq/shared/src/platformEnv": { isNativeIOS: false },
      "@onekeyhq/shared/src/utils/perpsUtils": utils,
      "../selectors/SizeInputModeSelector": {
        SizeInputModeSelector: host("ModeSelector"),
      },
      "./sizeInputConversion": conversion,
      "./TradingFormInput": { TradingFormInput: components.Input },
    },
  });
  let tree;
  const market = await bboPreviewFixture();
  const props = () => ({
    value: state.token,
    side: state.side,
    symbol: state.symbol,
    activeAsset: { universe: { szDecimals: state.precision } },
    isAssetCtxReady: true,
    referencePrice: state.referencePrice,
    sizeInputMode: state.inputMode,
    sliderPercent: state.sliderPercent,
    leverage: state.leverage,
    allowMarginInput: !state.spot,
    minimumOrderNotional: state.formOverrides?.orderMode === "twap" ? 100 : 10,
    minimumOrderActionRef: actionRef,
    onChange: (v) => {
      changes.push(v);
      state.token = v;
    },
    onRequestManualMode: () => {
      manual.push(true);
      state.inputMode = "manual";
    },
  });
  async function render() {
    await renderer.act(async () => {
      if (tree) tree.update(React.createElement(SizeInput, props()));
      else tree = renderer.create(React.createElement(SizeInput, props()));
    });
  }
  async function sync() {
    await market.update((s) => {
      s.instrument = {
        mode: state.spot ? "spot" : "perp",
        coin: state.spot ? "@local" : state.symbol,
        assetId: state.spot ? 10001 : 0,
        universe: state.spot
          ? {
              baseSzDecimals: state.precision,
              szDecimals: state.precision,
              baseName: state.symbol,
              quoteName: "USDC",
            }
          : { szDecimals: state.precision, maxLeverage: 20 },
      };
      s.asset = {
        ...s.asset,
        coin: state.symbol,
        universe: { szDecimals: state.precision, maxLeverage: 20 },
      };
      s.assetData = {
        ...s.assetData,
        coin: state.symbol,
        leverage: { type: "isolated", value: state.leverage },
      };
      if (state.markPrice !== undefined) s.assetData.markPx = state.markPrice;
      if (state.maxTradeSzs !== undefined)
        s.assetData.maxTradeSzs = state.maxTradeSzs;
      if (state.positions !== undefined) s.positions = state.positions;
      if (state.balances !== undefined) s.balances = state.balances;
      s.unit = state.spot && state.unit === "margin" ? "usd" : state.unit;
      s.mid = state.midPrice ?? state.referencePrice;
      s.ctx = { ctx: { markPrice: state.midPrice ?? state.referencePrice } };
      s.form = {
        type: state.orderType,
        orderMode: "standard",
        side: state.side,
        price: state.referencePrice,
        size: state.token,
        sizeInputMode: state.inputMode,
        sizePercent: state.sliderPercent,
        bboPriceMode: state.bbo ? { type: "queue", offsetTicks: 0 } : null,
        ...state.formOverrides,
      };
      s.book = {
        coin: s.instrument.coin,
        time: s.now,
        bbo: [{ px: state.referencePrice }, { px: state.referencePrice }],
      };
    });
  }
  const validate = evaluateCallback(buttonFile, "validateOrderPanelState", {
    ...utils,
    ...skip,
    ...twap,
    ...scale,
    ...scaleValidation,
    ...actionProps,
    BigNumber,
    intl,
    ETranslations,
    ETriggerOrderType,
    minimumOrderActionRef: actionRef,
    Toast: { message: (v) => toasts.push(v), error: (v) => toasts.push(v) },
    onRequestSizeInputFocus: () => focus.push(true),
    showNoEnoughMarginToast: scopedCallback(
      buttonFile,
      "SideButtonInternal",
      "showNoEnoughMarginToast",
      {
        intl,
        ETranslations,
        Toast: { error: (v) => toasts.push(v) },
        Button: components.Button,
        PerpTestIDs: evaluateSource("packages/kit/src/views/Perp/testIDs.ts")
          .PerpTestIDs,
        isDepositDisabled: false,
        handleDepositFromToast: () => {
          throw Error("Deposit action must not run in minimum tests");
        },
      },
    ),
  });
  await render();
  await sync();
  return {
    state,
    changes,
    toasts,
    manual,
    focus,
    actionRef,
    market,
    input: () => tree.root.findByType("Input").props,
    async update(next) {
      Object.assign(state, next);
      await render();
      await sync();
    },
    async type(value) {
      await renderer.act(async () =>
        tree.root.findByType("Input").props.onChange(value),
      );
      await render();
      await sync();
    },
    async slider(value) {
      const actual = formModeFixture();
      actual.state.form = { ...market.state.form };
      actual.slider(value);
      state.inputMode = actual.state.form.sizeInputMode;
      state.sliderPercent = actual.state.form.sizePercent;
      state.token = actual.state.form.size;
      await render();
      await sync();
    },
    async mode(unit) {
      await renderer.act(async () =>
        tree.root.findByType("ModeSelector").props.onChange(unit),
      );
      await render();
      await sync();
    },
    async fill(toast = toasts.at(-1)) {
      await renderer.act(async () => toast.actions.props.onPress());
      await render();
      await sync();
    },
    validate(patchPanel = {}) {
      const v = market.values[state.side];
      const notMet = scopedCallback(
        buttonFile,
        "SideButtonInternal",
        "isMinimumOrderNotMetForSide",
        { ...utils, orderValue: new BigNumber(v.notional) },
      )();
      return validate({
        validationSide: state.side,
        shouldValidateBboPriceError: true,
        orderPanelState: {
          computedSizeForSide: new BigNumber(v.quantity),
          effectivePriceBN: new BigNumber(v.price),
          formData: market.state.form,
          isMinimumOrderNotMetForSide: notMet,
          isNoEnoughMargin: v.noEnoughMargin,
          isSpot: state.spot,
          isScaleMode: market.state.form.orderMode === "scale",
          isTriggerMode: market.state.form.orderMode === "trigger",
          isTwapMode: market.state.form.orderMode === "twap",
          twapReferencePriceBN: new BigNumber(state.referencePrice),
          twapTriggerReferencePriceBN: new BigNumber(
            state.midPrice ?? state.referencePrice,
          ),
          midPriceBN: new BigNumber(state.midPrice ?? state.referencePrice),
          priceError: v.error,
          shouldBlockForMarketData: false,
          szDecimals: state.precision,
          ...patchPanel,
        },
      });
    },
    async close() {
      try {
        await renderer.act(async () => tree.unmount());
      } finally {
        await market.close();
      }
    },
  };
}
