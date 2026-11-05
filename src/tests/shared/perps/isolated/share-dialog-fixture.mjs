// Actual Desktop ShareContent -> ControlPanel/ShareView -> referral/actions hooks.
// Generator, clipboard, download/OS-share/window are explicit local boundaries.
// No real PNG raster, OS clipboard, external browser or native sharing claimed.
import { React, renderer, evaluateSource, readSource } from "./source.mjs";
import { promiseHookFixture } from "./promise-hook-fixture.mjs";
import { deferred } from "./funds-quote-fixture.mjs";
const base = "packages/kit/src/views/Perp/components/PositionShare/";
const host =
  (type) =>
  ({ children, ...props }) =>
    React.createElement(type, props, children);
const locale = evaluateSource(
  "packages/shared/src/locale/enum/translations.ts",
);
const messages = JSON.parse(
  readSource("packages/shared/src/locale/json/zh_CN.json"),
);
const constants = evaluateSource(base + "constants.ts", {
  mocks: { "@onekeyhq/shared/src/locale": locale },
});
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
export async function shareDialogFixture(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const state = {
    data: {
      token: "BTC",
      tokenDisplayName: "BTC",
      side: "long",
      mode: "perp",
      leverage: 5,
      pnl: "10",
      pnlPercent: "50",
      entryPrice: "100",
      markPrice: "110",
    },
    user: { isLoggedIn: false, isLoggedInOnServer: false },
    dev: { enabled: false, settings: {} },
    primary: "PRIMARY",
    fallback: "FALLBACK",
    canSystemShare: true,
    generatorAvailable: true,
    generationError: false,
    generationEmpty: false,
    downloadError: false,
    shareError: null,
    ...patch,
  };
  const events = {
    generations: [],
    downloads: [],
    copies: [],
    windows: [],
    shares: [],
    errors: [],
    success: [],
    referral: [],
    urls: [],
  };
  let tree, generatePending;
  const ph = promiseHookFixture(state),
    intl = { formatMessage: ({ id }) => messages[id] };
  const globals = {
    ...ph.globals,
    Error,
    Blob,
    Uint8Array,
    ArrayBuffer,
    atob,
    URL: {
      createObjectURL: (blob) => {
        events.urls.push(["create", blob]);
        return "blob:local";
      },
      revokeObjectURL: (url) => events.urls.push(["revoke", url]),
    },
    document: {
      createElement: () => ({
        click() {
          if (state.downloadError) throw Error("local write failed");
          events.downloads.push({ href: this.href, name: this.download });
        },
      }),
      body: { appendChild: () => {}, removeChild: () => {} },
    },
    open: (url, target) => events.windows.push({ url, target }),
  };
  const Badge = host("Badge");
  Badge.Text = host("BadgeText");
  const components = {
    ...Object.fromEntries(
      [
        "Button",
        "Image",
        "SizableText",
        "Spinner",
        "Stack",
        "XStack",
        "YStack",
        "IconButton",
      ].map((n) => [n, host(n)]),
    ),
    Badge,
    Toast: {
      error: (v) => events.errors.push(v),
      success: (v) => events.success.push(v),
    },
    Dialog: {
      show: () => {
        throw Error("Unexpected native permission dialog");
      },
    },
    useClipboard: () => ({ copyText: (value) => events.copies.push(value) }),
  };
  // Include the actual delayed clipboard writer and feedback hook as well.
  components.useClipboard = evaluateSource(
    "packages/components/src/hooks/useClipboard.tsx",
    {
      globals: { setTimeout: ph.clock.setTimeout.bind(ph.clock) },
      mocks: {
        "expo-clipboard": {
          getStringAsync: async () => "",
          setStringAsync: async (value) => events.copies.push(value),
        },
        "react-intl": { useIntl: () => intl },
        "use-debounce": { useDebouncedCallback: (fn) => fn },
        "@onekeyhq/shared/src/locale": locale,
        "@onekeyhq/shared/src/platformEnv": {
          isNativeAndroid: false,
          isExtensionUiPopup: false,
          isExtensionUiSidePanel: false,
        },
        "@onekeyhq/shared/src/utils/openUrlUtils": {
          openSettings: () => {
            throw Error("Unexpected clipboard settings");
          },
        },
        "@onekeyhq/shared/src/utils/uriUtils": {
          ensureHttpsPrefix: (value) => value,
        },
        "../actions/Toast": { Toast: components.Toast },
        "../primitives/Button": { Button: components.Button },
      },
    },
  ).useClipboard;
  const shareUtils = {
    canShareImageToSystem: () => state.canSystemShare,
    shareImageOnDesktop: async (value, name) => {
      if (state.shareError) throw Error(state.shareError);
      events.shares.push({ value, name });
    },
  };
  const common = {
    "react-intl": { useIntl: () => intl },
    "@onekeyhq/components": components,
    "@onekeyhq/shared/src/locale": locale,
    "@onekeyhq/shared/src/platformEnv": { isNative: false, isDesktop: true },
    "@onekeyhq/kit/src/utils/shareUtils": shareUtils,
  };
  const { useReferralUrl } = evaluateSource(base + "useReferralUrl.ts", {
    globals,
    mocks: {
      ...common,
      "@onekeyhq/kit/src/background/instance/backgroundApiProxy": {
        serviceReferralCode: {
          getSummaryInfo: async () => {
            events.referral.push(["primary", state.user.onekeyUserId]);
            const result =
              typeof state.primary === "function"
                ? await state.primary()
                : state.primary;
            return { inviteCode: result };
          },
          getMyReferralCode: async ({ onekeyUserId }) => {
            events.referral.push(["fallback", onekeyUserId]);
            return state.fallback;
          },
        },
      },
      "@onekeyhq/kit/src/hooks/usePromiseResult": ph,
      "@onekeyhq/kit-bg/src/states/jotai/atoms": {
        usePrimePersistAtom: () => [state.user],
      },
      "@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings": {
        useDevSettingsPersistAtom: () => [state.dev],
      },
      "@onekeyhq/shared/src/config/appConfig": {
        WEB_APP_URL: "https://app.onekey.so",
        WEB_APP_URL_DEV: "https://app.onekeytest.com",
      },
    },
  });
  const { useShareActions } = evaluateSource(base + "useShareActions.tsx", {
    globals,
    mocks: {
      ...common,
      "react-native": {
        Linking: {
          openURL: () => {
            throw Error("Unexpected native URL");
          },
        },
      },
      "@onekeyhq/shared/src/modules3rdParty/expo-sharing": {},
      "@onekeyhq/shared/src/modules3rdParty/photo-library": {},
      "@onekeyhq/shared/src/modules3rdParty/react-native-fs": {},
    },
  });
  const { ControlPanel } = evaluateSource(base + "ControlPanel.tsx", {
    mocks: common,
  });
  const { ShareView } = evaluateSource(base + "ShareView.tsx", {
    globals,
    mocks: {
      ...common,
      "../../testIDs": evaluateSource(
        "packages/kit/src/views/Perp/testIDs.ts",
        { names: ["PerpTestIDs"] },
      ),
      "./constants": constants,
    },
  });
  function ShareImageGenerator({ ref, ...props }) {
    React.useImperativeHandle(ref, () =>
      state.generatorAvailable
        ? {
            generate: async () => {
              const captured = {
                data: props.data,
                config: props.config,
                referralQrCodeUrl: props.referralQrCodeUrl,
                referralDisplayText: props.referralDisplayText,
              };
              events.generations.push(captured);
              const pending = generatePending;
              const overridden = pending ? await pending.promise : undefined;
              if (state.generationError) throw Error("local generator failure");
              return state.generationEmpty
                ? ""
                : typeof overridden === "string"
                  ? overridden
                  : png;
            },
          }
        : null,
    );
    return React.createElement("GeneratorBoundary", props);
  }
  const timers = evaluateSource("packages/shared/src/utils/timerUtils.ts", {
    names: ["sleepUntil"],
    globals,
  });
  const { ShareContent } = evaluateSource(base + "PositionShareModal.tsx", {
    names: ["REFERRAL_WAIT_TIMEOUT_MS", "ShareContent"],
    globals: {
      ...React,
      ...globals,
      ...components,
      ...constants,
      useIntl: () => intl,
      ETranslations: locale.ETranslations,
      platformEnv: { isNative: false },
      openSettings: () => {
        throw Error("Unexpected settings");
      },
      timerUtils: timers,
      ShareImageGenerator,
      ShareView,
      ControlPanel,
      useReferralUrl,
      useShareActions,
    },
  });
  const render = () =>
    renderer.act(async () => {
      const element = React.createElement(ShareContent, {
        data: state.data,
        isMobile: false,
      });
      if (tree) tree.update(element);
      else tree = renderer.create(element);
    });
  await render();
  return {
    state,
    events,
    clock: ph.clock,
    get tree() {
      return tree;
    },
    buttons: () => tree.root.findAllByType("IconButton"),
    badges: () => tree.root.findAllByType("Badge"),
    generator: () => tree.root.findByType("GeneratorBoundary").props,
    preview: () =>
      tree.root.findAllByType("Image").map((n) => n.props.source.uri),
    async tick(ms) {
      await renderer.act(async () => ph.clock.tickAsync(ms));
    },
    async update(p) {
      Object.assign(state, p);
      await render();
    },
    async toggle(mode) {
      const n = tree.root.findAllByType("Badge")[mode === "pnl" ? 0 : 1];
      if (n.props.disabled) return false;
      await renderer.act(async () => n.props.onPress());
      return true;
    },
    async start(icon) {
      const n = tree.root
        .findAllByType("IconButton")
        .find((n) => n.props.icon === icon);
      if (!n || n.props.disabled) return false;
      let pending;
      await renderer.act(async () => {
        pending = n.props.onPress();
        pending?.catch(() => {});
      });
      return { pending };
    },
    delayGenerator() {
      return (generatePending = deferred());
    },
    async releaseGenerator() {
      await renderer.act(async () => generatePending.resolve());
      generatePending = null;
    },
    async finish(action) {
      await renderer.act(async () => action.pending);
      await renderer.act(async () => ph.clock.tickAsync(200));
    },
    async close() {
      await renderer.act(async () => tree.unmount());
    },
  };
}
