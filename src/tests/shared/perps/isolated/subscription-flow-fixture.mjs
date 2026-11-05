// Actual UI subscription planner -> required specs -> service debounce/core ->
// actual reconcile/mutation queues. Transport subscribe/unsubscribe are local
// recording sinks; no socket/SDK/background instance is loaded.
import { evaluateSource, appRequire } from "./source.mjs";
import { sourceClass } from "./twap-flow-fixture.mjs";
const serviceFile =
  "packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidSubscription.ts";
const base = "packages/kit-bg/src/services/ServiceHyperLiquid/utils/";
const types = evaluateSource("packages/shared/types/hyperliquid/types.ts", {
  names: ["EPerpsSubscriptionCategory", "ESubscriptionType"],
});
const constants = evaluateSource(
  "packages/shared/types/hyperliquid/perp.constants.ts",
);
export const subscriptionConfig = evaluateSource(
  `${base}SubscriptionConfig.ts`,
  {
    mocks: {
      "@onekeyhq/shared/src/consts/perp": {
        PERPS_EMPTY_ADDRESS: "0x0000000000000000000000000000000000000000",
      },
      "@onekeyhq/shared/src/utils/stringUtils": {
        stableStringify: appRequire("fast-json-stable-stringify"),
      },
      "@onekeyhq/shared/types/hyperliquid/perp.constants": constants,
      "@onekeyhq/shared/types/hyperliquid/types": types,
    },
  },
);
const planner = evaluateSource(
  "packages/kit/src/views/Perp/utils/subscriptionPlanner.ts",
  {
    mocks: {
      "./tokenSelectorTabs": evaluateSource(
        "packages/kit/src/views/Perp/utils/tokenSelectorTabs.ts",
        {
          names: [
            "ALL_TAB_IDS",
            "normalizeTabId",
            "isPerpTokenSelectorAllTab",
            "isPerpTokenSelectorSpotTab",
          ],
        },
      ),
    },
  },
);
const mutation = evaluateSource(`${base}SubscriptionMutationQueue.ts`);
const reconcile = evaluateSource(`${base}SubscriptionReconcileQueue.ts`, {
  mocks: { "@onekeyhq/shared/src/errors": { OneKeyLocalError: Error } },
});
export function subscriptionFlowFixture(patch = {}) {
  const clock = appRequire("@sinonjs/fake-timers").createClock(1800000000000);
  const lodash = appRequire("lodash").runInContext({
    Date: clock.Date,
    setTimeout: clock.setTimeout.bind(clock),
    clearTimeout: clock.clearTimeout.bind(clock),
  });
  const state = {
    currentUser: null,
    currentSymbol: "BTC",
    currentSpotSymbol: "@1",
    tradingMode: "perp",
    isConnected: true,
    l2BookOptions: { nSigFigs: 5, mantissa: null },
    orderBookTransport: "l2Book",
    view: {
      routeFocused: true,
      tokenSelectorOpen: false,
      tokenSelectorTab: "perps",
      favoritesBarSpotActive: false,
      infoPanelTab: "Positions",
    },
    create: async () => {},
    destroy: async () => true,
    ready: 1,
    ...patch,
  };
  const self = {},
    calls = {
      created: [],
      destroyed: [],
      reconciles: 0,
      recovery: 0,
      stateUpdates: 0,
      fundedReset: 0,
    };
  const Service = sourceClass(
    serviceFile,
    [
      "_currentState",
      "_activeSubscriptions",
      "_destroyingSubscriptionKeys",
      "_subscriptionMutationQueue",
      "_subscriptionReconcileQueue",
      "_routeSubscriptionStateVersion",
      "ORDER_BOOK_MUTATION_KEY",
      "_hasInitialSubscription",
      "_shouldUpdateSubscriptionsImmediately",
      "_applyStateUpdates",
      "_updateSubscriptionsCore",
      "_enqueueSubscriptionReconcile",
      "_updateSubscriptionsDebounced",
      "updateSubscriptions",
      "setRouteSubscriptionState",
      "_executeSubscriptionChanges",
    ],
    {
      ...subscriptionConfig,
      ...types,
      ...mutation,
      ...reconcile,
      ServiceHyperliquidSubscription: self,
      debounce: lodash.debounce,
      isEqual: lodash.isEqual,
      WebSocket: { OPEN: 1 },
      markPerpsColdStartPerf: () => {},
      console: { log: () => {} },
      timerUtils: {
        wait: (ms) => new Promise((resolve) => clock.setTimeout(resolve, ms)),
      },
    },
  );
  self.ORDER_BOOK_MUTATION_KEY = Service.ORDER_BOOK_MUTATION_KEY;
  const service = new Service(),
    client = {
      clientId: "local",
      transport: {
        socket: {
          get readyState() {
            return state.ready;
          },
        },
      },
    };
  service.allSubSpecsMap = {};
  service.pendingSubSpecsMap = {};
  service.subscriptionsHandlerDisabled = false;
  service.getWebSocketClient = async () => client;
  service._recoverNotOpenSocketBeforeSubscriptionUpdate = async () => {
    calls.recovery += 1;
  };
  service._getStaleCriticalOpenSubscriptionTypes = () => [];
  service._emitConnectionStatus = () => {
    calls.stateUpdates += 1;
  };
  service._scheduleCriticalSubscriptionHealthCheck = () => {};
  service._startPostOpenDataCheck = () => {};
  service._resetFundedActivationRefreshState = () => {
    calls.fundedReset += 1;
  };
  service._isSubscriptionSpecPending = (spec) =>
    Boolean(service.pendingSubSpecsMap[spec.key]);
  service._forceReconnectTransport = async () => {
    calls.recovery += 1;
  };
  service._createSubscription = async (spec) => {
    await state.create(spec);
    calls.created.push(spec);
    service._activeSubscriptions.set(spec.key, {
      key: spec.key,
      type: spec.type,
      spec,
    });
  };
  service._destroySubscription = async (spec) => {
    const okay = await state.destroy(spec);
    calls.destroyed.push(spec);
    if (okay) {
      service._activeSubscriptions.delete(spec.key);
      delete service.allSubSpecsMap[spec.key];
    }
    return okay;
  };
  service.buildRequiredSubscriptionsMap = async () => {
    calls.reconciles += 1;
    const params = {
      ...service._currentState,
      currentUser: state.currentUser,
      currentSymbol: state.currentSymbol,
      currentSpotSymbol: state.currentSpotSymbol,
      tradingMode: state.tradingMode,
      l2BookOptions: state.l2BookOptions,
      orderBookTransport: state.orderBookTransport,
      isConnected: state.ready === 1,
    };
    return {
      params,
      requiredSubSpecsMap:
        subscriptionConfig.calculateRequiredSubscriptionsMap(params),
    };
  };
  const plan = () =>
    planner.planTradeSubscriptions({
      activeInstrument: {
        mode: state.tradingMode,
        coin:
          state.tradingMode === "spot"
            ? state.currentSpotSymbol
            : state.currentSymbol,
      },
      hasAccount: Boolean(state.currentUser),
      viewState: state.view,
    });
  const update = async (patch) => {
    Object.assign(state, patch);
    const result = plan();
    await service.setRouteSubscriptionState(result);
    if (result.shouldSyncSubscriptions) await service.updateSubscriptions();
    return result;
  };
  return {
    service,
    state,
    clock,
    calls,
    types: types.ESubscriptionType,
    plan,
    update,
    active: () =>
      Array.from(service._activeSubscriptions.values()).map(
        (value) => value.spec,
      ),
    tick: (ms) => clock.tickAsync(ms),
    close: () => service._updateSubscriptionsDebounced.cancel(),
  };
}
