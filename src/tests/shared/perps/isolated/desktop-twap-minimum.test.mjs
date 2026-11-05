// Actual SizeInput minimum accessory → actual TWAP validation toast → actual
// fill callback. All callbacks remain local; no submit handler is loaded.
import test from "node:test";
import assert from "node:assert/strict";
import {
  React,
  renderer,
  evaluateSource,
  evaluateCallback,
  perpsUtils,
  BigNumber,
} from "./source.mjs";
import { twap, intl, ETranslations } from "./twap-source-fixture.mjs";
import { confirmPanel } from "./twap-flow-fixture.mjs";
const inputFile =
  "packages/kit/src/views/Perp/components/TradingPanel/inputs/SizeInput.tsx";
const utils = perpsUtils();
const conversion = evaluateSource(
  "packages/kit/src/views/Perp/components/TradingPanel/inputs/sizeInputConversion.ts",
  { mocks: { "@onekeyhq/shared/src/utils/perpsUtils": utils } },
);
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
  ].map((v) => [v, host(v)]),
);
const minimumAction = evaluateSource(inputFile, {
  names: ["getMinimumOrderToastActionProps"],
  globals: { platformEnv: { isNativeIOS: false }, Button: components.Button },
});
const skip = evaluateSource(
  "packages/kit/src/views/Perp/utils/perpsOrderPanelEnableTrading.ts",
  { names: ["shouldSkipPerpsOrderPanelComputedSizeValidation"] },
);
for (const initial of ["0", "3.0305"])
  for (const side of ["long", "short"])
    for (const [unit, display, label] of [
      ["token", "3.04", "3.04 BTC"],
      ["usd", "100.32", "$100.32"],
      ["margin", "14.34", "$14.34"],
    ])
      test(`D11-338/339 actual TWAP minimum fill rounds upward and survives lot truncation ${side}/${unit}/${initial}`, async () => {
        globalThis.IS_REACT_ACT_ENVIRONMENT = true;
        const minimumOrderActionRef = { current: undefined },
          changes = [],
          manual = [],
          toasts = [];
        const { SizeInput } = evaluateSource(inputFile, {
          mocks: {
            "react-intl": { useIntl: () => intl },
            "@onekeyhq/components": components,
            "@onekeyhq/kit-bg/src/states/jotai/atoms": {
              usePerpsTradingPreferencesAtom: () => [
                { sizeInputUnit: unit },
                () => {
                  throw Error("Unexpected preference write");
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
            "./TradingFormInput": { TradingFormInput: host("Input") },
          },
          globals: { setTimeout, clearTimeout },
        });
        let tree;
        try {
          await renderer.act(async () => {
            tree = renderer.create(
              React.createElement(SizeInput, {
                value: initial,
                symbol: "BTC",
                side,
                activeAsset: { universe: { szDecimals: 2 } },
                isAssetCtxReady: true,
                referencePrice: "33",
                leverage: 7,
                minimumOrderNotional: 100,
                sizeInputMode: "manual",
                sliderPercent: 0,
                minimumOrderActionRef,
                onChange: (v) => changes.push(v),
                onRequestManualMode: () => manual.push(true),
              }),
            );
          });
          const action = minimumOrderActionRef.current;
          assert.ok(action);
          assert.equal(action.amountLabel, label);
          const validate = evaluateCallback(
            "packages/kit/src/views/Perp/components/TradingPanel/TradingButtonGroup.tsx",
            "validateOrderPanelState",
            {
              ...twap,
              ...skip,
              ...minimumAction,
              BigNumber,
              intl,
              ETranslations,
              minimumOrderActionRef,
              onRequestSizeInputFocus: () => {},
              Toast: {
                message: (v) => toasts.push(v),
                error: (v) => toasts.push(v),
              },
              showNoEnoughMarginToast: () => {
                throw Error("Unexpected margin branch");
              },
            },
          );
          const state = {
            computedSizeForSide: new BigNumber(initial),
            effectivePriceBN: new BigNumber(33),
            formData: {
              type: "market",
              size: initial,
              sizeInputMode: "manual",
              twapDurationMinutes: "5",
            },
            isMinimumOrderNotMetForSide: false,
            isNoEnoughMargin: false,
            isSpot: false,
            isScaleMode: false,
            isTriggerMode: false,
            isTwapMode: true,
            midPriceBN: new BigNumber(33),
            twapReferencePriceBN: new BigNumber(33),
            priceError: undefined,
            shouldBlockForMarketData: false,
            szDecimals: 2,
          };
          assert.equal(
            validate({
              orderPanelState: state,
              validationSide: side,
              shouldValidateBboPriceError: false,
            }),
            "invalidTwapConfig",
          );
          assert.equal(toasts.length, 1);
          assert.equal(toasts[0].title, `最小 ${label}`);
          assert.equal(toasts[0].actions.props.children, "填入最小金额");
          const before = changes.length;
          await renderer.act(async () => toasts[0].actions.props.onPress());
          assert.equal(changes.length, before + 1);
          assert.equal(changes.at(-1), "3.04");
          assert.equal(tree.root.findByType("Input").props.value, display);
          assert.deepEqual(manual, [true]);
          const filled = new BigNumber(changes.at(-1));
          assert.equal(
            filled.decimalPlaces(2, BigNumber.ROUND_DOWN).times(33).toFixed(2),
            "100.32",
          );
          assert.ok(
            filled.minus("0.01").times(33).lt(100),
            "One lot below suggestion is insufficient",
          );
          assert.equal(
            validate({
              orderPanelState: {
                ...state,
                computedSizeForSide: filled,
                formData: { ...state.formData, size: filled.toFixed() },
              },
              validationSide: side,
              shouldValidateBboPriceError: false,
            }),
            undefined,
          );
          assert.equal(
            toasts.length,
            1,
            "Filling suggestion must not create another error",
          );
          const confirmation = await confirmPanel({
            size: filled.toFixed(),
            mid: "33",
            form: { side },
          });
          try {
            assert.ok(confirmation.texts().includes("3.04 BTC"));
            assert.ok(confirmation.texts().includes("$100.32"));
            assert.equal(confirmation.events.submits.length, 0);
          } finally {
            await confirmation.close();
          }
        } finally {
          if (tree) await renderer.act(async () => tree.unmount());
        }
        assert.equal(
          minimumOrderActionRef.current,
          undefined,
          "Unmount clears stale shortcut",
        );
      });
