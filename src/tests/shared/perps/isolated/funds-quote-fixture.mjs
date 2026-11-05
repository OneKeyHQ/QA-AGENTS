// Full actual usePerpDeposit hook and actual async-result hook. Quote/account
// responses are local deferred promises; build/sign services fail closed.
import { React, renderer, evaluateSource, appRequire } from "./source.mjs";
import { promiseHookFixture } from "./promise-hook-fixture.mjs";
import { intl, ETranslations } from "./twap-source-fixture.mjs";
import { fundsConstants } from "./funds-submit-fixture.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
export function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
export function quoteResponse(tag = "local", patch = {}) {
  return {
    orderId: tag,
    result: {
      fromAmount: "10",
      toAmount: "9.5",
      fromTokenInfo: {
        networkId: "evm--1",
        contractAddress: "0xtoken",
        symbol: "TEST",
      },
      toTokenInfo: {
        networkId: "evm--42161",
        contractAddress: fundsConstants.USDC_TOKEN_INFO.address,
        symbol: "USDC",
      },
      ...patch,
    },
  };
}
export async function fundsQuoteFixture(patch = {}) {
  const state = {
    amount: "10",
    selectedAction: "deposit",
    accountId: "local-A",
    indexedAccountId: undefined,
    token: {
      networkId: "evm--1",
      contractAddress: "0xtoken",
      symbol: "TEST",
      decimals: 6,
    },
    minimum: true,
    availableBalanceError: false,
    accountPending: null,
    quotePending: null,
    quote: quoteResponse(),
    external: false,
    hardware: false,
    ...patch,
  };
  const runtime = promiseHookFixture(state),
    { globals, usePromiseResult } = runtime;
  const requests = [],
    accounts = [],
    cancellations = [],
    events = [],
    history = { orders: [] };
  let value, tree;
  const forbidden = new Proxy(
    {},
    {
      get: (_, key) => () => {
        throw Error(
          `Financial endpoint forbidden in quote fixture: ${String(key)}`,
        );
      },
    },
  );
  const serviceSwap = {
    cancelFetchPerpDepositQuote: async () => cancellations.push(true),
    fetchPerpDepositQuote: async (args) => {
      requests.push(args);
      const pending = state.quotePending,
        response = state.quote;
      return pending ? pending.promise : response;
    },
    perpDepositOrderFetchLoop: async (args) =>
      events.push(["history-poll", args]),
  };
  const accountUtils = {
    isExternalAccount: () => state.external,
    isHwOrQrAccount: () => state.hardware,
  };
  const swapEnums = evaluateSource("packages/shared/types/swap/types.ts", {
    names: [
      "EProtocolOfExchange",
      "ESwapFetchCancelCause",
      "ESwapTxHistoryStatus",
    ],
  });
  const tokenUtils = evaluateSource("packages/shared/src/utils/tokenUtils.ts", {
    names: ["normalizeTokenContractAddress", "equalTokenNoCaseSensitive"],
    globals: {
      networkUtils: {
        getNetworkImpl: ({ networkId }) => networkId.split("--")[0],
      },
      caseSensitiveNetworkImpl: ["sol", "tron"],
    },
  });
  const hook = evaluateSource(
    "packages/kit/src/views/Perp/hooks/usePerpDeposit.ts",
    {
      globals,
      mocks: {
        lodash: appRequire("lodash"),
        "react-intl": { useIntl: () => intl },
        "@onekeyhq/components": {
          Toast: { success: (args) => events.push(["toast", args]) },
          rootNavigationRef: { current: {} },
        },
        "@onekeyhq/kit-bg/src/states/jotai/atoms": {
          usePerpsActiveAccountAtom: () => [{ walletType: "hd" }],
          usePerpsDepositOrderAtom: () => [
            history,
            (next) => Object.assign(history, next(history)),
          ],
        },
        "@onekeyhq/shared/src/consts/perp": { PERPS_NETWORK_ID: "evm--42161" },
        "@onekeyhq/shared/src/consts/walletConsts": {
          BATCH_APPROVE_GAS_FEE_RATIO_FOR_SWAP: 0.2,
          BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP: 1.2,
        },
        "@onekeyhq/shared/src/errors": { OneKeyError: Error },
        "@onekeyhq/shared/src/locale": { ETranslations },
        "@onekeyhq/shared/src/logger/logger": {
          defaultLogger: {
            perp: {
              deposit: {
                perpDepositInitiate: (...args) => events.push(["log", ...args]),
              },
            },
          },
        },
        "@onekeyhq/shared/src/routes": { EScanQrCodeModalPages: {} },
        "@onekeyhq/shared/src/utils/accountUtils": accountUtils,
        "@onekeyhq/shared/src/utils/feeUtils": {
          calculateFeeForSend: forbidden.calculateFeeForSend,
        },
        "@onekeyhq/shared/src/utils/numberUtils": {
          toBigIntHex: forbidden.toBigIntHex,
        },
        "@onekeyhq/shared/src/utils/tokenUtils": tokenUtils,
        "@onekeyhq/shared/types/hyperliquid/perp.constants": fundsConstants,
        "@onekeyhq/shared/types/send": { ESendPreCheckTimingEnum: {} },
        "@onekeyhq/shared/types/swap/types": swapEnums,
        "../../../background/instance/backgroundApiProxy": {
          serviceSwap,
          serviceNetwork: {
            getGlobalDeriveTypeOfNetwork: async () => "default",
          },
          serviceAccount: {
            getNetworkAccount: async (args) => {
              accounts.push(args);
              const pending = state.accountPending;
              const owner = args.indexedAccountId || args.accountId;
              const answer = {
                id: `${owner}:${args.networkId}`,
                addressDetail: {
                  address: `${owner}:${args.networkId}:address`,
                  normalizedAddress: `${owner}:${args.networkId}:normalized`,
                },
              };
              if (pending) await pending.promise;
              return answer;
            },
          },
          serviceSend: forbidden,
          serviceGas: forbidden,
          serviceTransaction: forbidden,
          serviceHistory: forbidden,
        },
        "../../../hooks/usePromiseResult": { usePromiseResult },
        "../utils/perpDepositAnalytics": evaluateSource(
          "packages/kit/src/views/Perp/utils/perpDepositAnalytics.ts",
          { globals: { Error } },
        ),
        "./usePerpDepositUtils": evaluateSource(
          "packages/kit/src/views/Perp/hooks/usePerpDepositUtils.ts",
        ),
      },
    },
  ).default;
  function Probe() {
    value = hook(
      state.amount,
      state.selectedAction,
      state.indexedAccountId,
      state.accountId,
      state.token,
      state.minimum,
      state.availableBalanceError,
    );
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
    runtime,
    requests,
    accounts,
    cancellations,
    events,
    history,
    swapEnums,
    get value() {
      return value;
    },
    update: async (patch) => {
      Object.assign(state, patch);
      await render();
    },
    flush: async () =>
      renderer.act(async () => {
        await Promise.resolve();
      }),
    settle: async (pending, result, reject = false) =>
      renderer.act(async () => {
        pending[reject ? "reject" : "resolve"](result);
        await Promise.resolve();
      }),
    refresh: async () =>
      renderer.act(async () => value.perpDepositQuoteAction()),
    tick: async (ms) => renderer.act(async () => runtime.clock.tickAsync(ms)),
    close: async () => renderer.act(async () => tree.unmount()),
  };
}
