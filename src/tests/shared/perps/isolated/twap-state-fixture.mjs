// Actual atom actions and account-scoped hook, with an in-memory store and HTTP
// result promises only. No subscription, transport, signing or exchange client.
import { React, renderer, evaluateSource, perpsUtils } from "./source.mjs";
import { twap } from "./twap-source-fixture.mjs";
import { sourceClass } from "./twap-flow-fixture.mjs";
const file = "packages/kit/src/states/jotai/contexts/hyperliquid/actions.ts";
export const stateHelpers = evaluateSource(file, {
  names: [
    "TWAP_SLICE_FILLS_MAX_COUNT",
    "buildTwapOrdersByCoinMap",
    "sortTwapOrders",
    "getTwapHistoryKey",
    "sortAndDedupeTwapHistory",
    "getTwapSliceFillKey",
    "sortAndDedupeTwapSliceFills",
  ],
});
const account = "0x" + "1".repeat(40);
export const otherAccount = "0x" + "2".repeat(40);
export function stateFixture() {
  const state = {
    active: account,
    orders: { accountAddress: account, twapOrders: [], twapOrdersByCoin: {} },
    history: { accountAddress: account, history: [], isLoaded: false },
    fills: {
      accountAddress: account,
      fills: [],
      isLoaded: false,
      latestTime: 0,
    },
    form: {},
    preferences: {},
  };
  const responses = { orders: undefined, history: [], fills: [] },
    calls = [];
  const get = (key) => state[key],
    set = (key, value) => {
      state[key] = typeof value === "function" ? value(state[key]) : value;
    };
  const Class = sourceClass(
    file,
    [
      "canceledTwapIds",
      "loadTwapDataRequestId",
      "loadTwapDataInFlightByAccount",
      "filterCanceledTwapOrders",
      "getTwapDataLoadPromises",
      "fetchTwapData",
      "updateTwapStates",
      "updateTwapHistory",
      "updateTwapSliceFills",
      "loadTwapData",
      "updateTradingForm",
      "resetTradingForm",
    ],
    {
      ...stateHelpers,
      ...perpsUtils(),
      ...evaluateSource("packages/shared/types/hyperliquid/types.ts", {
        names: ["EPerpsSizeInputMode"],
      }),
      contextAtomMethod: (callback) =>
        function (...args) {
          return callback.call(this, get, set, ...args);
        },
      perpsActiveAccountAtom: {
        get: async () => ({ accountAddress: state.active }),
      },
      perpsActiveTwapOrdersAtom: () => "orders",
      perpsTwapHistoryAtom: () => "history",
      perpsTwapSliceFillsAtom: () => "fills",
      tradingFormAtom: () => "form",
      backgroundApiProxy: {
        serviceHyperliquid: {
          getTwapStates: async (params) => {
            calls.push(["orders", params]);
            return responses.orders;
          },
          getTwapHistory: async (params) => {
            calls.push(["history", params]);
            return responses.history;
          },
          getUserTwapSliceFills: async (params) => {
            calls.push(["fills", params]);
            return responses.fills;
          },
        },
      },
    },
  );
  const actions = new Class();
  const scoped = evaluateSource(
    "packages/kit/src/views/Perp/utils/accountScopedData.ts",
    { mocks: { "@onekeyhq/shared/src/utils/perpsUtils": perpsUtils() } },
  );
  const { usePerpsAccountScopedActiveTwapOrders } = evaluateSource(
    "packages/kit/src/views/Perp/hooks/usePerpsAccountScopedActiveTwapOrders.ts",
    {
      mocks: {
        "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms": {
          usePerpsActiveTwapOrdersAtom: () => [state.orders],
          usePerpsTwapHistoryAtom: () => [state.history],
        },
        "@onekeyhq/shared/src/utils/hyperliquidTwapUtils": twap,
        "../utils/accountScopedData": scoped,
      },
    },
  );
  return {
    state,
    actions,
    responses,
    calls,
    account,
    async view() {
      globalThis.IS_REACT_ACT_ENVIRONMENT = true;
      let value, tree;
      function Harness() {
        value = usePerpsAccountScopedActiveTwapOrders(state.active);
        return null;
      }
      await renderer.act(async () => {
        tree = renderer.create(React.createElement(Harness));
      });
      await renderer.act(async () => tree.unmount());
      return value;
    },
  };
}
