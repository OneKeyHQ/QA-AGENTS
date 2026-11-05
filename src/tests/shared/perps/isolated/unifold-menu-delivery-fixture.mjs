// Complete pinned menu and terminal-delivery container. Layout, dialog portal,
// event bus, clock, storage and RPC replies are explicit in-memory boundaries.
import { EventEmitter } from "node:events";
import {
  React,
  renderer,
  evaluateSource,
  readSource,
  appRequire,
} from "./source.mjs";
import { promiseHookFixture } from "./promise-hook-fixture.mjs";
const dir =
  "packages/kit/src/views/Perp/components/TradingPanel/modals/UnifoldDeposit/";
const host =
  (name) =>
  ({ children, ...props }) =>
    React.createElement(name, props, children);
const unexpected = () => {
  throw Error(
    "Unconfigured external action forbidden in offline Unifold fixture",
  );
};
const locale = evaluateSource(
  "packages/shared/src/locale/enum/translations.ts",
);
function intlFor(l) {
  return appRequire("react-intl").createIntl({
    locale: l.replace("_", "-"),
    messages: JSON.parse(
      readSource("packages/shared/src/locale/json/" + l + ".json"),
    ),
    onError: (e) => {
      throw e;
    },
  });
}
export async function unifoldMenuFixture(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const state = {
    locale: "zh_CN",
    catalog: [],
    tokens: [],
    showTracker: true,
    account: { accountId: "hd-local", accountAddress: "0x" + "a".repeat(40) },
    config: { perpConfigCommon: { unifoldDepositEnabled: true } },
    ...patch,
  };
  const events = {
    assets: [],
    actions: [],
    closes: 0,
    forms: [],
    analytics: [],
    preload: 0,
  };
  const hook = promiseHookFixture({ swrCache: new Map() });
  const constants = evaluateSource(
    "packages/kit/src/views/Perp/hooks/usePerpsUnifoldDepositSession.ts",
    {
      names: [
        "UNIFOLD_DEPOSIT_DESTINATION",
        "UNIFOLD_DEV_TEST_DESTINATION",
        "resolveUnifoldDepositDestination",
      ],
      globals: {
        ...evaluateSource("packages/kit/src/views/Perp/consts/unifold.ts"),
        platformEnv: { isDev: false },
      },
    },
  );
  const format = evaluateSource(dir + "unifoldFormat.ts", {
    names: ["normalizeUnifoldIconUrl"],
    globals: { platformEnv: { isNative: false } },
  });
  const components = Object.fromEntries(
    ["Button", "Icon", "SizableText", "Stack", "XStack", "YStack"].map((n) => [
      n,
      host(n),
    ]),
  );
  let config,
    tree,
    result,
    notify = () => {};
  const Dialog = {
    show: (v) => {
      config = v;
      notify();
      return {
        close: async () => {
          events.closes++;
          if (state.closeRequest) await state.closeRequest();
          config = undefined;
          notify();
        },
      };
    },
  };
  const menu = evaluateSource(dir + "showUnifoldDepositModals.tsx", {
    globals: hook.globals,
    mocks: {
      "react-native": { useWindowDimensions: () => ({ height: 800 }) },
      "@onekeyhq/components": { ...components, Dialog },
      "@onekeyhq/kit/src/background/instance/backgroundApiProxy": {
        serviceUnifoldDeposit: {
          getSupportedAssets: async (destination) => {
            events.assets.push(JSON.parse(JSON.stringify(destination)));
            return state.catalog;
          },
        },
      },
      "@onekeyhq/kit/src/components/Token": { Token: host("Token") },
      "@onekeyhq/kit/src/hooks/usePromiseResult": {
        usePromiseResult: hook.usePromiseResult,
      },
      "@onekeyhq/kit/src/views/Perp/hooks/usePerpsUnifoldDepositSession":
        constants,
      "@onekeyhq/kit-bg/src/states/jotai/atoms": {
        useDevSettingsPersistAtom: () => [{}],
        usePerpsDepositTokensAtom: () => [
          { serverTokens: state.tokens, tokens: {} },
        ],
      },
      "@onekeyhq/shared/src/locale": locale,
      "@onekeyhq/shared/src/platformEnv": { isNative: false },
      "./unifoldDialogLayout": {
        getUnifoldDesktopDialogBodyMaxHeight: patch.TransferComponent
          ? evaluateSource(dir + "unifoldDialogLayout.ts")
              .getUnifoldDesktopDialogBodyMaxHeight
          : unexpected,
      },
      "./unifoldFormat": format,
      "./UnifoldTrackerContent": {
        UnifoldTrackerContent: patch.TrackerComponent ?? unexpected,
      },
      "./UnifoldTransferContent": {
        UnifoldTransferContent: patch.TransferComponent ?? unexpected,
      },
    },
  });
  const recipients = evaluateSource(
    "packages/kit/src/views/Perp/utils/unifoldRecipient.ts",
    {
      mocks: {
        "@onekeyhq/shared/src/utils/accountUtils": {
          isWatchingAccount: ({ accountId }) =>
            accountId.startsWith("watching--"),
        },
      },
    },
  );
  const hooks = evaluateSource(
    "packages/kit/src/views/Perp/hooks/useShowDepositWithdrawModal.ts",
    {
      mocks: {
        "react-intl": { useIntl: () => intlFor(state.locale) },
        "@onekeyhq/components": {
          useInTabDialog: () => (patch.TransferComponent ? Dialog : {}),
          useMedia: () => ({ gtMd: true }),
        },
        "@onekeyhq/kit/src/hooks/useAppNavigation": () => ({
          pushModal: unexpected,
        }),
        "@onekeyhq/kit-bg/src/states/jotai/atoms": {
          usePerpsActiveAccountAtom: () => [state.account],
          usePerpsCommonConfigPersistAtom: () => [state.config],
          perpsActiveAccountAtom: { atom: () => "local-account" },
          perpsCommonConfigPersistAtom: {
            get: async () =>
              state.configRequest ? state.configRequest() : state.config,
          },
        },
        "@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore": {
          jotaiDefaultStore: { get: () => state.account },
        },
        "@onekeyhq/shared/src/locale": locale,
        "@onekeyhq/shared/src/logger/logger": {
          defaultLogger: {
            perp: {
              deposit: {
                perpDepositMethodSelect: (v) => events.analytics.push(v),
                perpDepositMethodPanelView: (v) => events.analytics.push(v),
              },
            },
          },
        },
        "@onekeyhq/shared/src/platformEnv": { isNative: false },
        "@onekeyhq/shared/src/routes": {},
        "@onekeyhq/shared/src/routes/perp": {},
        "@onekeyhq/shared/src/utils/accountUtils": {
          isExternalAccount: () => false,
        },
        "../utils/preloadPerpsDepositWithdrawModal": {
          loadPerpsDepositWithdrawModal: async () => ({
            showDepositWithdrawDialog: async (p) =>
              events.forms.push(JSON.parse(JSON.stringify(p))),
          }),
        },
        "../utils/preloadPerpsUnifoldDeposit": {
          loadPerpsUnifoldDepositModals: async () => {
            events.preload++;
            return menu;
          },
        },
        "../utils/unifoldRecipient": recipients,
      },
    },
  );
  if (!state.fromHook)
    menu.showPerpsUnifoldDepositMenuDialog({
      onAction: (v) => events.actions.push(v),
      showTrackerAction: state.showTracker,
      intl: intlFor(state.locale),
      walletName: "产品",
    });
  function Root() {
    const [, set] = React.useState(0);
    notify = () => set((v) => v + 1);
    if (state.fromHook)
      result = hooks.useShowDepositWithdrawModal("local-desktop");
    return config?.renderContent ?? null;
  }
  await renderer.act(async () => {
    tree = renderer.create(React.createElement(Root));
    await hook.clock.tickAsync(1);
  });
  return {
    root: () => tree.root,
    clock: hook.clock,
    dismiss: () =>
      renderer.act(async () => {
        config = undefined;
        notify();
      }),
    state,
    events,
    get config() {
      return config;
    },
    result: () => result,
    open: () =>
      renderer.act(async () => {
        await result.showDepositWithdrawModal("deposit");
      }),
    row: (name) =>
      tree.root.findAll(
        (n) =>
          n.type === "Button" &&
          n.props.testID === "perps-deposit-menu-" + name,
      )[0],
    action: (fn) =>
      renderer.act(async () => {
        await fn();
      }),
    close: () => renderer.act(async () => tree.unmount()),
  };
}
export async function unifoldDeliveryFixture(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const clock =
    patch.clock ??
    appRequire("@sinonjs/fake-timers").createClock(1800000000000);
  const state = { locale: "zh_CN", pending: [], ...patch };
  const events = { claims: [], acks: [], toasts: [], errors: [] },
    bus = state.bus ?? new EventEmitter();
  let nonce = 0,
    tree;
  const shared = evaluateSource(
    "packages/shared/src/utils/unifoldDepositUtils.ts",
    {
      mocks: {
        "../../types/unifoldDeposit": {
          UNIFOLD_ERROR_CODE_LOCAL_INVALID_DEPOSIT_ADDRESS_RESPONSE: 10400,
        },
        "../errors": { OneKeyError: Error },
      },
    },
  );
  const { PerpsUnifoldDepositTerminalDeliveryContainer: Container } =
    evaluateSource(
      "packages/kit/src/provider/Container/PerpsUnifoldDepositTerminalDeliveryContainer.tsx",
      {
        globals: {
          setTimeout: clock.setTimeout.bind(clock),
          clearTimeout: clock.clearTimeout.bind(clock),
        },
        mocks: {
          "react-intl": { useIntl: () => intlFor(state.locale) },
          "@onekeyhq/components": {
            Toast: Object.fromEntries(
              ["error", "success"].map((type) => [
                type,
                (value) =>
                  events.toasts.push({
                    type,
                    ...JSON.parse(JSON.stringify(value)),
                  }),
              ]),
            ),
          },
          "@onekeyhq/shared/src/errors/utils/errorUtils": {
            autoPrintErrorIgnore: (e) => events.errors.push(e.message),
          },
          "@onekeyhq/shared/src/eventBus/appEventBus": {
            EAppEventBusNames: {
              PerpsUnifoldDepositTerminalDelivery: "delivery",
            },
            appEventBus: bus,
          },
          "@onekeyhq/shared/src/locale": locale,
          "@onekeyhq/shared/src/utils/miscUtils": {
            generateUUID: () => "local-claim-" + ++nonce,
          },
          "@onekeyhq/shared/src/utils/unifoldDepositUtils": shared,
          "../../background/instance/backgroundApiProxy": {
            serviceUnifoldDeposit: {
              getPendingTerminalDeliveries: async () =>
                state.service
                  ? state.service.getPendingTerminalDeliveries()
                  : state.pending,
              tryClaimTerminalDelivery: async (p) => {
                events.claims.push(JSON.parse(JSON.stringify(p)));
                if (state.service)
                  return state.service.tryClaimTerminalDelivery(p);
                return state.claim
                  ? state.claim(p)
                  : { status: "claimed", delivery: state.delivery };
              },
              acknowledgeTerminalDelivery: async (p) => {
                events.acks.push(JSON.parse(JSON.stringify(p)));
                if (state.service)
                  return state.service.acknowledgeTerminalDelivery(p);
                return state.ack ? state.ack(p) : { updated: true };
              },
            },
          },
        },
      },
    );
  await renderer.act(async () => {
    tree = renderer.create(React.createElement(Container));
  });
  return {
    state,
    events,
    bus,
    clock,
    emit: (deliveryId = state.delivery.deliveryId) =>
      renderer.act(async () => {
        bus.emit("delivery", { deliveryId });
      }),
    tick: (ms) =>
      renderer.act(async () => {
        await clock.tickAsync(ms);
      }),
    close: () => renderer.act(async () => tree.unmount()),
  };
}
