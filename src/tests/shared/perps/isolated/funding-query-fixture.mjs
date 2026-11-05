// Actual usePromiseResult -> actual funding hook. All time, visibility, focus and
// background response sources are local; no request can escape this fixture.
import {
  React,
  renderer,
  evaluateSource,
  appRequire,
  perpsUtils,
} from "./source.mjs";
export async function fundingQueryFixture(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const state = {
    address: "0xAAA",
    isActive: false,
    focused: true,
    fail: false,
    records: [{ time: 1, hash: "local1", delta: { coin: "BTC", usdc: "2" } }],
    pending: null,
    ...patch,
  };
  const clock =
    patch.clock ??
    appRequire("@sinonjs/fake-timers").createClock(1800000000000);
  const globals = {
    Date: clock.Date,
    setTimeout: clock.setTimeout.bind(clock),
    clearTimeout: clock.clearTimeout.bind(clock),
  };
  const requests = [];
  let value, tree;
  const previous = evaluateSource("packages/kit/src/hooks/usePrevious.ts");
  const mounted = evaluateSource("packages/kit/src/hooks/useIsMounted.ts");
  const promise = evaluateSource("packages/kit/src/hooks/usePromiseResult.ts", {
    globals,
    mocks: {
      lodash: appRequire("lodash"),
      "@onekeyhq/components": {
        getCurrentVisibilityState: () => true,
        onVisibilityStateChange: () => () => {},
        useNetInfo: () => ({ isRawInternetReachable: true }),
        useDeferredPromise: () =>
          React.useMemo(
            () => ({
              resolve: () => {},
              reset: () => {},
              promise: Promise.resolve(),
            }),
            [],
          ),
      },
      "@onekeyhq/kit/src/hooks/useRouteIsFocused": {
        useRouteIsFocusedWhenEnabled: () => state.focused,
      },
      "@onekeyhq/shared/src/platformEnv": { isNative: false },
      "@onekeyhq/shared/src/utils/swrCacheUtils": {
        swrCacheUtils: {
          getWithTimestamp: () => {
            throw Error("Unexpected SWR cache");
          },
          set: () => {
            throw Error("Unexpected SWR cache");
          },
        },
      },
      "@onekeyhq/shared/src/utils/timerUtils": {
        wait: (ms) => new Promise((r) => clock.setTimeout(r, ms)),
      },
      "./useIsMounted": mounted,
      "./usePrevious": previous,
    },
  });
  const scoped = evaluateSource(
    "packages/kit/src/views/Perp/utils/accountScopedData.ts",
    { mocks: { "@onekeyhq/shared/src/utils/perpsUtils": perpsUtils() } },
  );
  const hook = evaluateSource(
    "packages/kit/src/views/Perp/hooks/usePerpOrderInfoPanel.ts",
    {
      names: ["usePerpUserFundingHistory"],
      globals: {
        ...React,
        ...globals,
        ...scoped,
        usePromiseResult: promise.usePromiseResult,
        usePerpsActiveAccountAtom: () => [{ accountAddress: state.address }],
        backgroundApiProxy: {
          serviceHyperliquid: {
            getUserFundingHistory: async (args) => {
              requests.push(args);
              if (patch.service) return patch.service(args);
              const records = state.records;
              const fail = state.fail;
              const pending = state.pending;
              if (pending) await pending;
              if (fail) throw Error("local offline");
              return records;
            },
          },
        },
      },
    },
  ).usePerpUserFundingHistory;
  function Probe() {
    value = hook({ isActive: state.isActive });
    return null;
  }
  const render = () =>
    renderer.act(async () => {
      if (tree) tree.update(React.createElement(Probe));
      else tree = renderer.create(React.createElement(Probe));
    });
  await render();
  return {
    state,
    requests,
    clock,
    get value() {
      return value;
    },
    async update(next) {
      Object.assign(state, next);
      await render();
    },
    async tick(ms) {
      await renderer.act(async () => clock.tickAsync(ms));
    },
    startRefresh() {
      let pending;
      renderer.act(() => {
        pending = value.refresh();
      });
      return pending;
    },
    async refresh() {
      await renderer.act(async () => value.refresh());
    },
    async flush() {
      await renderer.act(async () => {
        await Promise.resolve();
      });
    },
    async close() {
      await renderer.act(async () => tree.unmount());
    },
  };
}
