// Actual usePromiseResult with explicit local visibility/focus/time boundaries.
import { React, evaluateSource, appRequire } from "./source.mjs";
export function promiseHookFixture(state = {}) {
  const clock = appRequire("@sinonjs/fake-timers").createClock(1800000000000);
  const listeners = new Set();
  const globals = {
    Date: clock.Date,
    setTimeout: clock.setTimeout.bind(clock),
    clearTimeout: clock.clearTimeout.bind(clock),
  };
  const components = {
    getCurrentVisibilityState: () => state.visible !== false,
    onVisibilityStateChange: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    useNetInfo: () => ({ isRawInternetReachable: state.online !== false }),
    useDeferredPromise: () =>
      React.useMemo(
        () => ({
          resolve: () => {},
          reset: () => {},
          promise: Promise.resolve(),
        }),
        [],
      ),
  };
  const promise = evaluateSource("packages/kit/src/hooks/usePromiseResult.ts", {
    globals,
    mocks: {
      lodash: appRequire("lodash"),
      "@onekeyhq/components": components,
      "@onekeyhq/kit/src/hooks/useRouteIsFocused": {
        useRouteIsFocusedWhenEnabled: () => state.focused !== false,
      },
      "@onekeyhq/shared/src/platformEnv": { isNative: false },
      "@onekeyhq/shared/src/utils/swrCacheUtils": {
        swrCacheUtils: {
          getWithTimestamp: (key) => {
            if (state.swrCache) return state.swrCache.get(key);
            throw Error("Unexpected SWR cache boundary");
          },
          set: (key, data) => {
            if (state.swrCache)
              return state.swrCache.set(key, { data, timestamp: clock.now });
            throw Error("Unexpected SWR cache boundary");
          },
        },
      },
      "@onekeyhq/shared/src/utils/timerUtils": {
        wait: (ms) => new Promise((resolve) => clock.setTimeout(resolve, ms)),
      },
      "./useIsMounted": evaluateSource(
        "packages/kit/src/hooks/useIsMounted.ts",
      ),
      "./usePrevious": evaluateSource("packages/kit/src/hooks/usePrevious.ts"),
    },
  });
  return {
    clock,
    globals,
    components,
    usePromiseResult: promise.usePromiseResult,
    listeners,
    visibility: (visible) => {
      state.visible = visible;
      for (const listener of listeners) listener(visible);
    },
  };
}
