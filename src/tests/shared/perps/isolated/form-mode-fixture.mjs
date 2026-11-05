// Actual form mode handlers -> actual updateTradingForm atom action. The
// rendered tabs, focus and visual highlight are separately covered by Desktop.
import { triggerOrderFixture } from "./trigger-order-fixture.mjs";
import { evaluateSource, evaluateCallback } from "./source.mjs";
const file =
  "packages/kit/src/views/Perp/components/TradingPanel/panels/PerpTradingForm.tsx";
export function formModeFixture(patch = {}) {
  const f = triggerOrderFixture(patch);
  f.state.settings = { lastAdvancedOrderType: "triggerMarket" };
  const declarations = evaluateSource(file, {
    names: [
      "migrateTriggerOrderType",
      "resolveAdvancedOrderType",
      "TRIGGER_MODE_TPSL_RESET",
    ],
  });
  const enums = evaluateSource("packages/shared/types/hyperliquid/types.ts", {
    names: ["ETriggerOrderType", "EPerpsSizeInputMode"],
  });
  function globals() {
    return {
      ...enums,
      ...declarations,
      isSpot: f.state.instrument.mode === "spot",
      formData: f.state.form,
      updateForm: (next) => f.actions.updateTradingForm(next),
      tradingComputed: f.state.form,
      setPerpsCustomSettings: (fn) => {
        f.state.settings = fn(f.state.settings);
      },
    };
  }
  const applyAdvanced = (next) =>
    evaluateCallback(file, "applyAdvancedOrderType", globals())(next);
  return {
    ...f,
    advanced: applyAdvanced,
    primary(next) {
      return evaluateCallback(file, "applyPrimaryOrderType", {
        ...globals(),
        applyAdvancedOrderType: applyAdvanced,
        lastSelectableAdvancedOrderType: f.state.settings.lastAdvancedOrderType,
      })(next);
    },
    side(next) {
      return evaluateCallback(file, "handleSideChange", globals())(next);
    },
    slider(next) {
      return evaluateCallback(
        file,
        "handleSliderPercentChange",
        globals(),
      )(next);
    },
    manual(next) {
      return evaluateCallback(file, "handleManualSizeChange", globals())(next);
    },
    options() {
      const intl = { formatMessage: ({ id }) => id };
      return evaluateCallback(file, "triggerTypeOptions", {
        ...globals(),
        intl,
        ETranslations: new Proxy({}, { get: (_, key) => key }),
      })();
    },
  };
}
