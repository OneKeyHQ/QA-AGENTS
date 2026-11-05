// Pinned Desktop funds callbacks. Every signing/transfer endpoint is a local
// recording sink: no wallet, transport, signature or real funds are available.
// This tests callback contracts; it does not prove the enclosing modal UI.
import { BigNumber, evaluateSource } from "./source.mjs";
import { scopedCallback } from "./scoped-callback.mjs";
import { intl, ETranslations } from "./twap-source-fixture.mjs";
import { numberUtils } from "./number-format-source.mjs";
export const fundsConstants = evaluateSource(
  "packages/shared/types/hyperliquid/perp.constants.ts",
);
export const { ESwapTxHistoryStatus } = evaluateSource(
  "packages/shared/types/swap/types.ts",
  { names: ["ESwapTxHistoryStatus"] },
);
const errors = evaluateSource(
  "packages/kit/src/views/Perp/utils/perpDepositAnalytics.ts",
  { globals: { Error } },
);
const file =
  "packages/kit/src/views/Perp/components/TradingPanel/modals/DepositWithdrawModal.tsx";
export function fundsSubmitFixture(patch = {}) {
  const events = [],
    toasts = [],
    submissions = [],
    logs = [];
  const token = {
    networkId: "evm--42161",
    contractAddress: fundsConstants.USDC_TOKEN_INFO.address,
    symbol: "USDC",
    decimals: 6,
  };
  const state = {
    amount: "10",
    tokenAmount: "10",
    selectedAction: "deposit",
    balance: "100",
    maxWithdraw: "99",
    minWithdraw: "2",
    minimum: { value: true, minFromTokenAmount: "5" },
    showMinAmountError: false,
    isValidAmount: true,
    checkAccountSupport: true,
    isWithdrawDestinationReady: true,
    selectedAccount: {
      accountAddress: "local-account-A",
      accountId: "local-id-A",
      walletType: "hd",
    },
    isArbitrumUsdcToken: true,
    isDepositQuotePendingDebounce: false,
    shouldRefreshDepositQuote: false,
    notBackedUp: false,
    deactivated: false,
    botConfirmed: false,
    depositInputUnit: "token",
    tokenPrice: "1",
    nativeTokenConfigs: [],
    availableBalance: { balance: "100" },
    withdrawDestinationId: "arbitrum",
    selectedWithdrawDestination: { transferType: "cctp" },
    withdrawRoute: "cctp",
    cctpFeeComponent: { amount: "0.5" },
    customSettings: { preserveOther: true },
    withdrawDestinations: [{ id: "arbitrum" }, { id: "ethereum" }],
    ...patch,
  };
  function globals() {
    const g = {
      ...state,
      ...fundsConstants,
      ...errors,
      BigNumber,
      intl,
      ETranslations,
      ...numberUtils("zh-CN"),
      ESwapTxHistoryStatus,
      PERPS_NETWORK_ID: "evm--42161",
      swapDefaultSetTokens: {
        "evm--42161": { toToken: { networkLogoURI: "local-logo" } },
      },
      amountBN: new BigNumber(state.amount),
      tokenAmountBN: new BigNumber(state.tokenAmount),
      availableBalanceBN: new BigNumber(state.balance),
      maximumWithdrawAmountBN: new BigNumber(state.maxWithdraw),
      minimumWithdrawAmountBN: new BigNumber(state.minWithdraw),
      minimumWithdrawAmountText: state.minWithdraw,
      tokenPriceBN: new BigNumber(state.tokenPrice),
      checkFromTokenFiatValue: state.minimum,
      currentPerpsDepositSelectedToken: token,
      currentPerpsDepositSelectedTokenRef: { current: token },
      Toast: {
        error: (v) => toasts.push(["error", v]),
        message: (v) => toasts.push(["message", v]),
      },
      setAmount: (value) => {
        state.amount = value;
        events.push(["amount", value]);
      },
      setDepositInputUnit: (value) => {
        state.depositInputUnit = value(state.depositInputUnit);
      },
      setShowMinAmountError: (value) => {
        state.showMinAmountError = value;
        events.push(["minimum-error", value]);
      },
      setPerpsCustomSettings: (value) => {
        state.customSettings = value(state.customSettings);
      },
      setIsSubmitting: (v) => events.push(["submitting", v]),
      isAccountIdDeactivatedBotWallet: async (v) => {
        events.push(["bot-check", v]);
        return state.deactivated;
      },
      showBotWalletDeactivatedWarningDialog: async () => {
        events.push(["bot-warning"]);
        return state.botConfirmed;
      },
      checkDepositWalletNotBackedUp: async () => {
        events.push(["backup-check"]);
        return state.notBackedUp;
      },
      perpDepositQuoteAction: () => events.push(["quote"]),
      normalizeTxConfirm: async (args) => {
        submissions.push(args);
        if (state.failure) throw state.failure;
      },
      buildPerpDepositTx: async () => {
        events.push(["cross-deposit"]);
        if (state.failure) throw state.failure;
      },
      withdraw: async (args) => {
        events.push(["withdraw", args]);
        if (state.failure) throw state.failure;
      },
      handlePerpDepositTxSuccess: (args) => events.push(["history", args]),
      backgroundApiProxy: {
        serviceHyperliquid: {
          checkPerpsAccountStatus: async () => events.push(["status-check"]),
        },
        serviceHyperliquidSubscription: {
          enableLedgerUpdatesSubscription: () =>
            events.push(["ledger-subscribe"]),
        },
      },
      defaultLogger: {
        perp: { deposit: { perpDepositInitiate: (args) => logs.push(args) } },
      },
      onClose: () => events.push(["close"]),
      refreshWithdrawReserve: () => events.push(["reserve-refresh"]),
      refreshWithdrawRoute: () => events.push(["route-refresh"]),
      console: { error: (...args) => events.push(["error", ...args]) },
    };
    g.checkNativeTokenGasToast = scopedCallback(
      file,
      "DepositWithdrawContent",
      "checkNativeTokenGasToast",
      g,
    );
    g.validateAmountBeforeSubmit = scopedCallback(
      file,
      "DepositWithdrawContent",
      "validateAmountBeforeSubmit",
      g,
    );
    return g;
  }
  const callback = (name) =>
    scopedCallback(file, "DepositWithdrawContent", name, globals());
  return {
    state,
    token,
    events,
    toasts,
    submissions,
    logs,
    confirm: () => callback("handleConfirm")(),
    validate: () => callback("validateAmountBeforeSubmit")(),
    max: (params) => callback("handleMaxPress")(params),
    toggleUnit: () => callback("handleToggleInputUnit")(),
    destination: (value) => callback("handleWithdrawDestinationChange")(value),
  };
}
