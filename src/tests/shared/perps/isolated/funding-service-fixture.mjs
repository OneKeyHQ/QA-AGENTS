// Real source cache wrapper + real memoizee. Only clock and infoClient transport
// are local. No SDK/account/wallet/signature/background instance is imported.
import { evaluateSource, appRequire } from "./source.mjs";
import { sourceClass } from "./twap-flow-fixture.mjs";
export function fundingServiceFixture() {
  const requests = [];
  const state = { records: [], pending: null, fail: false };
  const cacheUtils = evaluateSource("packages/shared/src/utils/cacheUtils.ts", {
    mocks: {
      "fast-json-stable-stringify": appRequire("fast-json-stable-stringify"),
      memoizee: appRequire("memoizee"),
    },
  }).default;
  const timerUtils = evaluateSource("packages/shared/src/utils/timerUtils.ts", {
    globals: {
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      global: globalThis,
    },
  }).default;
  const recent = evaluateSource(
    "packages/kit-bg/src/services/ServiceHyperLiquid/utils/fundingHistory.ts",
    {
      mocks: {
        "@nktkas/hyperliquid": { HttpRequestError: class extends Error {} },
        "@onekeyhq/shared/src/consts/perp": evaluateSource(
          "packages/shared/src/consts/perp.ts",
          { names: ["PERP_USER_FUNDING_HISTORY_LIMIT"] },
        ),
        "@onekeyhq/shared/src/errors": { OneKeyLocalError: Error },
        "@onekeyhq/shared/src/utils/timerUtils": timerUtils,
      },
    },
  );
  const Service = sourceClass(
    "packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquid.ts",
    [
      "getUserFundingHistory",
      "_fundingHistoryRequestsInFlight",
      "_getUserFundingHistoryMemo",
    ],
    {
      cacheUtils,
      timerUtils,
      fetchRecentUserFundingHistory: recent.fetchRecentUserFundingHistory,
      hyperLiquidApiClients: {
        infoClient: {
          userFunding: async (args) => {
            requests.push(args);
            const records = state.records,
              fail = state.fail,
              pending = state.pending;
            if (pending) await pending;
            if (fail) throw Error("local info unavailable");
            return records;
          },
        },
      },
    },
  );
  const service = new Service();
  return {
    service,
    state,
    requests,
    clear: () => service._getUserFundingHistoryMemo.clear(),
  };
}
