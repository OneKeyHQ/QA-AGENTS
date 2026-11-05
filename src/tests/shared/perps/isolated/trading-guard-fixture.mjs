// Actual guard -> actual enable steps dialog -> actual fallback hooks. UI portal,
// account atoms, terms response, password and enable service are local boundaries.
import { React, evaluateSource, appRequire, readSource } from "./source.mjs";
export function tradingGuardFixture(patch = {}) {
  const base = "packages/kit/src/views/Perp/";
  const state = {
    account: { accountAddress: "0x" + "1".repeat(40), accountId: "hd-local" },
    status: {
      accountAddress: "0x" + "1".repeat(40),
      canTrade: false,
      details: {
        activatedOk: true,
        agentOk: false,
        builderFeeOk: false,
        abstractionOk: true,
      },
    },
    loading: {},
    explicit: true,
    terms: true,
    password: { isPasswordSet: true, requiresPasswordSetupOrVerify: false },
    ...patch,
  };
  const events = {
    checks: 0,
    passwordRefresh: 0,
    passwords: 0,
    terms: 0,
    enables: 0,
    deposits: [],
    errors: [],
    dialogs: [],
    closes: 0,
  };
  const listeners = new Set();
  let version = 0,
    config;
  const notify = () => {
    version++;
    for (const listener of listeners) listener();
  };
  const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
  const atom = (get) => () => {
    React.useSyncExternalStore(subscribe, () => version);
    return [get()];
  };
  const atoms = {
    usePerpsActiveAccountAtom: atom(() => state.account),
    usePerpsActiveAccountStatusAtom: atom(() => state.status),
    perpsActiveAccountStatusAtom: { get: async () => state.status },
    usePerpsAccountLoadingInfoAtom: atom(() => state.loading),
    usePerpsActiveAccountEnableTradingModeAtom: atom(() => ({
      requiresExplicitEnableTrading: state.explicit,
    })),
    usePerpsActiveAccountIsAgentReadyAtom: atom(() => ({
      isAgentReady: state.status.canTrade,
    })),
    useHyperLiquidAgentPasswordStatusAtom: atom(() => state.password),
    usePerpsAbstractionModeAtom: atom(() => ({})),
  };
  const locale = evaluateSource(
    "packages/shared/src/locale/enum/translations.ts",
  );
  const intl = appRequire("react-intl").createIntl({
    locale: "zh-CN",
    messages: JSON.parse(
      readSource("packages/shared/src/locale/json/zh_CN.json"),
    ),
    onError: (e) => {
      throw e;
    },
  });
  const host =
    (type) =>
    ({ children, ...p }) =>
      React.createElement(type, p, children);
  const components = Object.fromEntries(
    ["Button", "Spinner", "Icon", "SizableText", "XStack", "YStack"].map(
      (n) => [n, host(n)],
    ),
  );
  const Dialog = {
    Header: host("DialogHeader"),
    Title: host("DialogTitle"),
    show: (v) => {
      config = v;
      events.dialogs.push(v);
      notify();
      return {
        close: async () => {
          events.closes++;
          config = undefined;
          v.onClose?.();
          notify();
        },
      };
    },
  };
  const errors = {
    toastIfError: (e) => events.errors.push(e.message),
    withErrorAutoToast: async (fn) => {
      try {
        return await fn();
      } catch (e) {
        events.errors.push(e.message);
        throw e;
      }
    },
  };
  const background = {
    servicePassword: {
      refreshHyperLiquidAgentPasswordStatus: async () => {
        events.passwordRefresh++;
        return state.password;
      },
      promptHyperLiquidAgentPasswordSetupOrVerify: async () => {
        events.passwords++;
        if (state.passwordError) throw Error(state.passwordError);
      },
    },
    serviceHyperliquid: {
      checkPerpsAccountStatus: async () => {
        events.checks++;
        if (state.checkError) throw Error(state.checkError);
      },
      enableTrading: async () => {
        events.enables++;
        const result = state.enable
          ? await state.enable()
          : {
              ...state.status,
              canTrade: true,
              details: {
                ...state.status.details,
                agentOk: true,
                builderFeeOk: true,
              },
            };
        state.status = result;
        notify();
        return result;
      },
    },
  };
  const scoped = evaluateSource(base + "utils/accountScopedData.ts", {
    mocks: {
      "@onekeyhq/shared/src/utils/perpsUtils": evaluateSource(
        "packages/shared/src/utils/perpsUtils.ts",
        { names: ["normalizePerpsAccountAddress"] },
      ),
    },
  });
  const decisions = evaluateSource(
    base + "utils/enableTradingDialogConfirm.ts",
  );
  const steps = evaluateSource(base + "utils/perpsOrderPanelEnableTrading.ts", {
    mocks: {
      "@onekeyhq/shared/src/locale": locale,
      "@onekeyhq/shared/src/utils/accountUtils": {},
      "@onekeyhq/shared/types/hyperliquid": {
        EHyperLiquidAbstractionMode: {
          UNIFIED_ACCOUNT: "unifiedAccount",
          PORTFOLIO_MARGIN: "portfolioMargin",
        },
      },
    },
  });
  const styles = evaluateSource(base + "utils/styleUtils.ts");
  const deposit = {
    useShowDepositWithdrawModal: () => ({
      showDepositWithdrawModal: async (v) => events.deposits.push(v),
    }),
  };
  const dialog = evaluateSource(
    base + "components/TradingPanel/modals/EnableTradingStepsDialog.tsx",
    {
      mocks: {
        "react-intl": { useIntl: () => intl },
        "@onekeyhq/components": { ...components, Dialog },
        "@onekeyhq/kit/src/background/instance/backgroundApiProxy": background,
        "@onekeyhq/kit-bg/src/states/jotai/atoms": {
          ...atoms,
          usePerpsAbstractionMode: atoms.usePerpsAbstractionModeAtom,
        },
        "@onekeyhq/shared/src/errors/utils/errorToastUtils": errors,
        "@onekeyhq/shared/src/locale": locale,
        "../../../utils/perpsOrderPanelEnableTrading": steps,
        "../../../utils/styleUtils": styles,
        "../../Guide/perpGuideData": {
          CONTEXTUAL_ARTICLE_IDS: { enableTrading: "local" },
          buildHelpUrl: () => {
            throw Error("Guide forbidden");
          },
          openGuideUrl: () => {
            throw Error("Guide forbidden");
          },
        },
        "../../PerpDialogLayout": {
          PERP_DIALOG_BUTTON_SIZE: "large",
          PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS: {},
        },
      },
    },
  );
  const hooks = evaluateSource(
    base + "hooks/useEnableTradingWithDepositFallback.ts",
    {
      mocks: {
        "@onekeyhq/kit/src/background/instance/backgroundApiProxy": background,
        "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid": {
          useHyperliquidActions: () => {
            if (patch.actions) return patch.actions;
            throw Error("Ensure action not wired in guard test");
          },
        },
        "@onekeyhq/kit-bg/src/states/jotai/atoms": atoms,
        "@onekeyhq/shared/src/errors/utils/errorToastUtils": errors,
        "../components/HyperliquidTerms": {
          showHyperliquidTermsDialog: async () => {
            events.terms++;
            return state.terms;
          },
        },
        "../components/TradingPanel/modals/EnableTradingStepsDialog": dialog,
        "../utils/accountScopedData": scoped,
        "../utils/enableTradingDialogConfirm": decisions,
        "./useShowDepositWithdrawModal": deposit,
      },
    },
  );
  const { TradingGuardWrapper } = evaluateSource(
    base + "components/TradingGuardWrapper.tsx",
    {
      mocks: {
        "react-intl": { useIntl: () => intl },
        "@onekeyhq/components": components,
        "@onekeyhq/kit/src/background/instance/backgroundApiProxy": background,
        "@onekeyhq/kit-bg/src/states/jotai/atoms": atoms,
        "@onekeyhq/shared/src/errors/utils/errorToastUtils": errors,
        "@onekeyhq/shared/src/locale": locale,
        "../hooks/useEnableTradingWithDepositFallback": hooks,
        "../hooks/useShowDepositWithdrawModal": deposit,
        "../utils/enableTradingDialogConfirm": decisions,
        "../utils/styleUtils": styles,
        "./TradingPanel/modals/EnableTradingStepsDialog": dialog,
      },
    },
  );
  function Portal() {
    React.useSyncExternalStore(subscribe, () => version);
    return config
      ? React.createElement("EnablePortal", {}, config.renderContent)
      : null;
  }
  return {
    state,
    events,
    TradingGuardWrapper,
    hooks,
    Portal,
    notify,
    closeDialog: () => {
      const c = config;
      config = undefined;
      c?.onClose();
      notify();
    },
    update: (p) => {
      Object.assign(state, p);
      notify();
    },
  };
}
