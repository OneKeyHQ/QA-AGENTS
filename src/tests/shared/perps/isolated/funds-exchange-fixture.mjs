// Actual withdrawal service + actual destination encoding/fee parsing. The SDK
// exchange client, RPC, wallet and status services are local recording sinks.
import { sourceClass } from "./twap-flow-fixture.mjs";
import { evaluateSource, BigNumber } from "./source.mjs";
import { fundsConstants } from "./funds-submit-fixture.mjs";
const base = "packages/kit-bg/src/services/ServiceHyperLiquid/";
export class LocalHttpRequestError extends Error {
  constructor(status, cause) {
    super("local HTTP failure");
    this.response = status === undefined ? undefined : { status };
    this.cause = cause;
  }
}
export function fundsExchangeFixture(patch = {}) {
  const state = {
    accountAddress: "0x1111111111111111111111111111111111111111",
    config: true,
    legacy: false,
    route: "cctp",
    feeMicros: "200000",
    reserveResponse: { fee: "0.02", isSanctioned: false },
    mode: {
      accountAddress: "0x1111111111111111111111111111111111111111",
      mode: "unifiedAccount",
    },
    ...patch,
  };
  const events = [],
    requests = [],
    logs = [];
  const cctp = evaluateSource(base + "cctpWithdraw.ts", {
    mocks: {
      "@onekeyhq/shared/src/errors": { OneKeyLocalError: Error },
      "@onekeyhq/shared/types/hyperliquid/perp.constants": fundsConstants,
    },
  });
  const { isUnifiedPortfolioMode } = evaluateSource(
    "packages/shared/src/utils/hyperliquidPortfolioUtils.ts",
    {
      names: ["isUnifiedPortfolioMode"],
      globals: {
        EHyperLiquidAbstractionMode: evaluateSource(
          "packages/shared/types/hyperliquid/types.ts",
          { names: ["EHyperLiquidAbstractionMode"] },
        ).EHyperLiquidAbstractionMode,
      },
    },
  );
  const record = async (name, args) => {
    requests.push({ name, args });
    if (state.exchangeFailure) throw state.exchangeFailure;
    return { status: "ok" };
  };
  class ExchangeClient {
    constructor(options) {
      events.push(["client", options.signatureChainId]);
    }
    sendAsset(args) {
      return record("sendAsset", args);
    }
    sendToEvmWithData(args) {
      return record("sendToEvmWithData", args);
    }
    withdraw3(args) {
      return record("withdraw3", args);
    }
  }
  const Cls = sourceClass(
    base + "ServiceHyperliquidExchange.ts",
    [
      "_isLegacyUsdcWithdrawForced",
      "_resolveWithdrawSourceDex",
      "getUsdcWithdrawReserve",
      "withdraw",
    ],
    {
      ...fundsConstants,
      ...cctp,
      BigNumber,
      OneKeyLocalError: Error,
      HttpRequestError: LocalHttpRequestError,
      SyntaxError,
      ExchangeClient,
      HttpTransport: class {},
      isUnifiedPortfolioMode,
      perpsAbstractionModeAtom: { get: async () => state.mode },
      perpsCommonConfigPersistAtom: {
        get: async () => {
          events.push(["legacy-check", state.legacy]);
          return {
            perpConfigCommon: {
              withdrawChannel: state.legacy ? "legacy" : "cctp",
            },
          };
        },
      },
      hyperLiquidApiClients: {
        infoClient: {
          preTransferCheck: async (args) => {
            events.push(["reserve", args]);
            if (state.reserveFailure) throw state.reserveFailure;
            return state.reserveResponse;
          },
        },
      },
      getLiveUsdcWithdrawRoute: async () => {
        events.push(["route"]);
        return state.route;
      },
      convertHyperLiquidResponse: async (fn) => {
        if (state.changeLegacyBeforeSign) state.legacy = !state.legacy;
        return fn();
      },
      buildHyperLiquidLogResult: () => ({ local: true }),
      extractHyperLiquidErrorResponse: () => ({ localFailure: true }),
      serializeHyperLiquidError: (error) => ({ message: error.message }),
      defaultLogger: {
        perp: {
          hyperliquid: {
            withdraw: (args) => logs.push(["withdraw", args]),
            preTransferCheckFailure: (args) => logs.push(["reserve", args]),
          },
        },
      },
      console: { error: (...args) => events.push(["error", ...args]) },
    },
  );
  const service = new Cls();
  service.checkAccountCanTrade = async () => {
    events.push(["can-trade"]);
    if (state.gateFailure) throw state.gateFailure;
  };
  service._createLoggedExchangeClient = (client) => client;
  service._buildLogContext = async () => ({ local: true });
  service._callHyperEvmRpc = async (method, params) => {
    events.push(["rpc", method, params]);
    if (state.feeFailure) throw state.feeFailure;
    return "0x" + BigInt(state.feeMicros).toString(16);
  };
  service.backgroundApi = {
    serviceHyperliquid: {
      updatePerpsConfigByServerSilently: async (args) => {
        events.push(["config", args]);
        return state.config;
      },
    },
    serviceHyperliquidWallet: {
      getOnekeyWallet: async (args) => {
        events.push(["wallet", args]);
        if (state.walletFailure) throw state.walletFailure;
        return { getAddress: async () => state.accountAddress };
      },
    },
  };
  return {
    state,
    events,
    requests,
    logs,
    service,
    withdraw: (patch) =>
      service.withdraw({
        userAccountId: "local-account-A",
        amount: "2",
        destinationId: "arbitrum",
        expectedRoute: "cctp",
        expectedCctpFee: "0.2",
        ...patch,
      }),
  };
}
