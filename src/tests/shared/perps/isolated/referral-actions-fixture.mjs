// Actual pinned MessageConfirmActions + referral hook + eligibility/snooze
// service. Only controlled in-memory transport/signature/storage adapters exist.
import {
  React,
  renderer,
  evaluateSource,
  readSource,
  appRequire,
} from "./source.mjs";
import { sourceClass } from "./twap-flow-fixture.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createIntl } = appRequire("react-intl");
const { ETranslations } = evaluateSource(
  "packages/shared/src/locale/enum/translations.ts",
);
const { SignatureConfirmTestIDs: IDs } = evaluateSource(
  "packages/kit/src/views/SignatureConfirm/testIDs.ts",
);
const origin = "https://app.hyperliquid.xyz";
const message = JSON.stringify({
  message: { type: "approveAgent" },
  primaryType: "HyperliquidTransaction:ApproveAgent",
});
const host =
  (type) =>
  ({ children, ...props }) =>
    React.createElement(type, props, children);
export async function referralActionsFixture(config = {}) {
  const state = {
    now: 1800000000000,
    role: "user",
    referredBy: undefined,
    locale: "zh_CN",
    failureAt: null,
    ...config,
  };
  const requests = [],
    signatures = [],
    submitted = [],
    resolved = [],
    rejected = [],
    logs = [],
    toasts = [],
    snoozes = config.storage ?? new Map();
  class Clock extends Date {
    static now() {
      return state.now;
    }
  }
  const accountUtils = evaluateSource(
    "packages/shared/src/utils/accountUtils.ts",
    {
      names: [
        "getWalletIdFromAccountId",
        "isHdWallet",
        "isHwWallet",
        "isImportedWallet",
        "isHdAccount",
        "isHwAccount",
        "isImportedAccount",
      ],
      globals: {
        extractBotWalletIdPrefix: () => "",
        SEPERATOR: "--",
        WALLET_TYPE_HD: "hd",
        WALLET_TYPE_HW: "hw",
        WALLET_TYPE_IMPORTED: "imported",
      },
    },
  );
  const Service = sourceClass(
    "packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidReferral.ts",
    [
      "checkReferralPromotionConditions",
      "getReferralBannerSnoozedUntil",
      "snoozeReferralBanner",
      "getUserRole",
      "getUserReferralInfo",
    ],
    {
      accountUtils,
      HYPER_LIQUID_ORIGIN: origin,
      Date: Clock,
      defaultLogger: {
        perp: { hyperliquid: { referralConditionCheck: (v) => logs.push(v) } },
      },
      logHyperLiquidApiFailure: async (v) => logs.push(v),
      HttpTransport: class {
        async request(endpoint, payload) {
          requests.push({ endpoint, payload });
          if (state.failureAt === payload.type)
            throw Error(`${payload.type} unavailable`);
          return payload.type === "userRole"
            ? { role: state.role }
            : { referredBy: state.referredBy, cumVlm: "0" };
        }
      },
    },
  );
  const service = new Service();
  const simpleDb = {
    perp: {
      getReferralBannerSnoozedUntil: async (address) =>
        snoozes.get(address) ?? 0,
      setReferralBannerSnoozedUntil: async (address, time) => {
        snoozes.set(address, time);
      },
    },
  };
  service.backgroundApi = { simpleDb };
  Object.assign(service, {
    logReferralBindingStep: async () => {},
    logReferralBindingResult: async () => {},
    logReferralCheckboxInteraction: async () => {},
    invalidateBannerCache: async () => {},
    buildSetReferrerTypedData: async ({ code }) => {
      submitted.push({ stage: "build", code });
      if (state.failureAt === "build") throw Error("build failed");
      return {
        typedData: { primaryType: "SetReferrer-local-only" },
        action: { type: "setReferrer", code },
        nonce: 1,
      };
    },
    submitSetReferrerWithSignature: async (v) => {
      submitted.push({ stage: "submit", ...v });
      if (state.failureAt === "submit") throw Error("submit failed");
      state.referredBy = "local-referrer";
      return { status: "ok" };
    },
  });
  const backgroundApiProxy = {
    simpleDb,
    serviceHyperliquidReferral: service,
    serviceAccount: {
      getAccountAddressForApi: async () => state.address ?? "0xaaa",
      checkIsWalletNotBackedUp: async () => false,
    },
    serviceSignature: { addItemFromSignMessage: async () => {} },
    serviceSend: {
      signMessage: async (v) => {
        const binding =
          JSON.parse(v.unsignedMessage.message).primaryType ===
          "SetReferrer-local-only";
        signatures.push({ binding, ...v });
        if (state.failureAt === (binding ? "binding-sign" : "approve-sign")) {
          const e = Error("User cancelled");
          e.code = "cancelled";
          throw e;
        }
        return binding
          ? "0xlocal-referral-signature"
          : "0xlocal-approve-signature";
      },
    },
  };
  function usePromiseResult(fn, deps) {
    const [value, set] = React.useState({ result: undefined, isLoading: true });
    React.useEffect(() => {
      let active = true;
      void fn().then(
        (result) => {
          if (active) set({ result, isLoading: false });
        },
        (error) => {
          if (active) set({ result: undefined, isLoading: false, error });
        },
      );
      return () => {
        active = false;
      };
    }, deps);
    return value;
  }
  const { useHyperliquidReferralPromotion } = evaluateSource(
    "packages/kit/src/views/SignatureConfirm/hooks/useHyperliquidReferralPromotion.ts",
    {
      globals: { Date: Clock },
      mocks: {
        "@onekeyfe/hd-shared": {
          HardwareErrorCode: { ActionCancelled: "cancelled" },
        },
        "@onekeyhq/kit/src/background/instance/backgroundApiProxy":
          backgroundApiProxy,
        "@onekeyhq/kit/src/hooks/usePromiseResult": { usePromiseResult },
        "@onekeyhq/shared/src/consts/perp": {
          HYPERLIQUID_REFERRAL_CODE: "1KREF",
          HYPER_LIQUID_ORIGIN: origin,
          PERPS_NETWORK_ID: "evm--42161",
        },
        "@onekeyhq/shared/types/message": {
          EMessageTypesEth: { TYPED_DATA_V4: "typed-v4" },
        },
      },
    },
  );
  const intl = createIntl({
    locale: state.locale === "en_US" ? "en" : "zh-CN",
    messages: JSON.parse(
      readSource(`packages/shared/src/locale/json/${state.locale}.json`),
    ),
    onError: (e) => {
      throw e;
    },
  });
  const EMessageTypesEth = { TYPED_DATA_V4: "typed-v4" };
  const { MessageConfirmActions } = evaluateSource(
    "packages/kit/src/views/SignatureConfirm/components/SignatureConfirmActions/MessageConfirmActions.tsx",
    {
      names: ["MessageConfirmActions"],
      globals: {
        ...React,
        useIntl: () => intl,
        useAccountData: () => ({ network: { impl: "evm" } }),
        useAppNavigation: () => ({ popStack() {} }),
        useScopedAcknowledgement: () => ({
          isAccepted: true,
          setAccepted() {},
        }),
        usePromiseResult,
        backgroundApiProxy,
        useHyperliquidReferralPromotion,
        SignatureConfirmTestIDs: IDs,
        useDappApproveAction: () => ({
          resolve: (v) => resolved.push(v),
          reject: (v) => rejected.push(v),
        }),
        usePageUnMounted: () => {},
        accountUtils: { ...accountUtils, isQrAccount: () => false },
        networkUtils: { getNetworkChainId: () => "42161" },
        validateSignMessageData: async () => {},
        validateTypedSignMessageDataV1: async () => {},
        validateTypedSignMessageDataV3V4: async () => {},
        ETranslations,
        EMessageTypesEth,
        EDAppModalPageStatus: { Confirmed: "confirmed" },
        Toast: { success: (v) => toasts.push(v) },
        Page: { Footer: host("Footer"), FooterActions: host("FooterActions") },
        Stack: host("Stack"),
        Checkbox: host("Checkbox"),
      },
    },
  );
  const props = {
    accountId: "hd-local--m/44/60",
    networkId: "evm--42161",
    unsignedMessage: { type: "typed-v4", message },
    securityCheckConfirmation: "risk",
    securityCheckAcknowledgementKey: "local",
    sourceInfo: { origin },
    skipBackupCheck: true,
    ...config.props,
  };
  let tree;
  const render = () =>
    renderer.act(async () => {
      if (tree) tree.update(React.createElement(MessageConfirmActions, props));
      else
        tree = renderer.create(
          React.createElement(MessageConfirmActions, props),
        );
    });
  await render();
  const checkbox = () =>
    tree.root
      .findAllByType("Checkbox")
      .find((n) => n.props.testID === IDs.MessageConfirmReferralCheckbox);
  return {
    state,
    props,
    requests,
    signatures,
    submitted,
    resolved,
    rejected,
    toasts,
    snoozes,
    service,
    render,
    checkbox,
    root: () => tree.root,
    async toggle(value) {
      assertCheckbox();
      await renderer.act(async () => checkbox().props.onChange(value));
    },
    async confirm() {
      await renderer.act(async () =>
        tree.root.findByType("FooterActions").props.onConfirm(() => {}),
      );
    },
    async remount() {
      await renderer.act(async () => tree.unmount());
      tree = null;
      await render();
    },
    async close() {
      await renderer.act(async () => tree.unmount());
    },
  };
  function assertCheckbox() {
    if (!checkbox()) throw Error("Referral checkbox unavailable");
  }
}
