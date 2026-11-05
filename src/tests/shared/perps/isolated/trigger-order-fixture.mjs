// Pinned atom action -> actual exchange request builder -> local raw-order sink.
// No SDK, wallet, signing, transport or production background proxy is loaded.
import { sourceClass } from "./twap-flow-fixture.mjs";
import {
  evaluateSource,
  perpsUtils,
  BigNumber,
  appRequire,
} from "./source.mjs";
import { intl, ETranslations } from "./twap-source-fixture.mjs";
const actionFile =
  "packages/kit/src/states/jotai/contexts/hyperliquid/actions.ts";
const exchangeFile =
  "packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidExchange.ts";
const utils = perpsUtils();
const enums = evaluateSource("packages/shared/types/hyperliquid/types.ts", {
  names: ["ETriggerOrderType"],
});
const constants = evaluateSource(
  "packages/shared/types/hyperliquid/perp.constants.ts",
);
export function triggerOrderFixture(patch = {}) {
  const state = {
    form: {
      type: "market",
      orderMode: "trigger",
      side: "long",
      size: "0.2",
      sizeInputMode: "manual",
      triggerOrderType: "triggerMarket",
      triggerPrice: "110",
      executionPrice: "105",
      triggerReduceOnly: true,
    },
    asset: { universe: { szDecimals: 5, maxLeverage: 20 } },
    ctx: { ctx: { markPrice: "100", midPrice: "100" } },
    data: {
      leverage: { value: 10 },
      availableToTrade: ["20", "30"],
      maxTradeSzs: ["999", "888"],
    },
    loading: false,
    instrument: { mode: "perp", coin: "BTC", assetId: 7 },
    ...patch,
  };
  const calls = [],
    events = [],
    toastCalls = [],
    feedback = [];
  const clock = appRequire("@sinonjs/fake-timers").createClock(1800000000000);
  const toastBase = "packages/kit/src/states/jotai/contexts/hyperliquid/utils/";
  const toastTypes = evaluateSource(toastBase + "types.ts");
  const toastConfig = evaluateSource(toastBase + "config.ts", {
    mocks: {
      "@onekeyhq/shared/src/locale": { ETranslations },
      "@onekeyhq/shared/src/locale/appLocale": { appLocale: { intl } },
      "./types": toastTypes,
    },
  });
  const resolver = evaluateSource(
    "packages/shared/src/utils/hyperLiquidErrorResolver.ts",
  );
  const { withToast } = evaluateSource(toastBase + "withToast.ts", {
    globals: {
      Error,
      setTimeout: clock.setTimeout.bind(clock),
      clearTimeout: clock.clearTimeout.bind(clock),
    },
    mocks: {
      "@onekeyhq/components": {
        Toast: {
          error: (v) => feedback.push({ kind: "error", ...v }),
          success: (v) => feedback.push({ kind: "success", ...v }),
          loading: (v) => {
            feedback.push({ kind: "loading", ...v });
            return { close: () => feedback.push({ kind: "close" }) };
          },
        },
      },
      "@onekeyhq/kit/src/background/instance/backgroundApiProxy": {
        serviceHyperliquid: {
          checkPerpsAccountStatus: async () => {
            events.push("local-agent-recovery");
          },
        },
      },
      "@onekeyhq/shared/src/logger/logger": {
        defaultLogger: {
          perp: {
            agentLifeCycle: {
              trackReason: (v) => events.push(["reason", v.reason]),
            },
          },
        },
      },
      "@onekeyhq/shared/src/utils/hyperLiquidErrorResolver": resolver,
      "./config": toastConfig,
      "./types": toastTypes,
    },
  });
  const Exchange = sourceClass(
    exchangeFile,
    ["orderTrigger", "_calculateSlippagePrice"],
    { ...utils, ...enums, ...constants, BigNumber, OneKeyLocalError: Error },
  );
  const exchange = new Exchange();
  exchange.slippage = 0.08;
  exchange.checkAccountCanTrade = async () => {
    events.push("permission");
    if (state.gateError) throw state.gateError;
  };
  exchange.placeOrderRaw = async (request, log) => {
    calls.push({
      request: JSON.parse(JSON.stringify(request)),
      log: JSON.parse(JSON.stringify(log)),
    });
    if (state.rawError) throw state.rawError;
    if (state.waitRaw) await state.waitRaw;
    return {
      status: "ok",
      response: {
        type: "order",
        data: { statuses: [{ resting: { oid: 123 } }] },
      },
    };
  };
  const get = (key) => state[key],
    set = (key, value) => {
      state[key] = typeof value === "function" ? value(state[key]) : value;
      events.push([key, state[key]]);
    };
  const Actions = sourceClass(
    actionFile,
    ["triggerOrder", "resetTradingForm", "updateTradingForm", "submitOrder"],
    {
      ...utils,
      ...enums,
      ...evaluateSource("packages/shared/types/hyperliquid/types.ts", {
        names: ["EPerpsSizeInputMode"],
      }),
      ...evaluateSource(actionFile, {
        names: ["resolveSubmitOrderTradeInstrument"],
      }),
      BigNumber,
      OneKeyLocalError: Error,
      contextAtomMethod: (fn) =>
        function (...args) {
          return fn.call(this, get, set, ...args);
        },
      tradingFormAtom: () => "form",
      tradingLoadingAtom: () => "loading",
      activeTradeInstrumentAtom: () => "instrument",
      perpsActiveAssetAtom: { get: async () => state.asset },
      perpsActiveAssetCtxAtom: { get: async () => state.ctx },
      perpsActiveAssetDataAtom: { get: async () => state.data },
      withToast: async (options) => {
        toastCalls.push(options.actionType);
        return withToast(options);
      },
      EActionType: toastTypes.EActionType,
      backgroundApiProxy: {
        serviceHyperliquidExchange: {
          orderTrigger: (params) => exchange.orderTrigger(params),
        },
      },
    },
  );
  const actions = new Actions();
  return {
    state,
    calls,
    events,
    toastCalls,
    feedback,
    clock,
    exchange,
    actions,
    async settleToasts() {
      for (let i = 0; i < 8; i++) await Promise.resolve();
    },
    run: (params = {}) =>
      actions.triggerOrder({ assetId: 7, slippage: 0.05, ...params }),
  };
}
