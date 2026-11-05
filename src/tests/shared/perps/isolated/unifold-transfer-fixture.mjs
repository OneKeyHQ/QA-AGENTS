// Actual complete Desktop transfer content + selector + QR/history children.
// Session output is controlled here (the complete session is separately tested).
// Component primitives, QR pixels, clipboard, URLs, clock and analytics are local
// boundaries. No service proxy, wallet, signing or network module is imported.
import {
  React,
  renderer,
  ts,
  readSource,
  evaluateText,
  evaluateSource,
  appRequire,
} from "./source.mjs";
import {
  sourceCatalog,
  sessionRecipient,
  depositAddress,
} from "./unifold-session-fixture.mjs";
const dir =
  "packages/kit/src/views/Perp/components/TradingPanel/modals/UnifoldDeposit/";
const host =
  (name) =>
  ({ children, ...props }) =>
    React.createElement(name, props, children);
export async function unifoldTransferFixture(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const clock =
    patch.runtime?.clock ??
    appRequire("@sinonjs/fake-timers").createClock(1800000000000);
  const state = {
    locale: "zh_CN",
    props: {},
    ...patch,
    session: {
      recipientAddress: sessionRecipient,
      isLiveAccountAligned: true,
      isHyperCoreDestination: true,
      addressState: { status: "ready" },
      sessionId: "session-local-123",
      supportedAssets: sourceCatalog,
      assetsLoading: false,
      selection: { asset: sourceCatalog[0], chain: sourceCatalog[0].chains[0] },
      qrAddress: depositAddress,
      sessionExecutions: [],
      activationFee: null,
      showActivationWarning: false,
      activationRetrying: false,
      ...patch.session,
    },
  };
  const events = {
    copies: [],
    urls: [],
    toasts: [],
    analytics: [],
    ready: [],
    unavailable: 0,
    handled: 0,
    opens: 0,
    acks: [],
    counts: [],
  };
  const intls = Object.fromEntries(
    ["zh_CN", "en_US"].map((l) => [
      l,
      appRequire("react-intl").createIntl({
        locale: l.replace("_", "-"),
        messages: JSON.parse(
          readSource("packages/shared/src/locale/json/" + l + ".json"),
        ),
        onError: (e) => {
          throw e;
        },
      }),
    ]),
  );
  const locale = evaluateSource(
    "packages/shared/src/locale/enum/translations.ts",
  );
  const constants = evaluateSource(
    "packages/kit/src/views/Perp/consts/unifold.ts",
  );
  const shared = evaluateSource(
    "packages/shared/src/utils/unifoldDepositUtils.ts",
    {
      mocks: {
        "../../types/unifoldDeposit": {
          UNIFOLD_ERROR_CODE_LOCAL_INVALID_DEPOSIT_ADDRESS_RESPONSE: 10400,
        },
        "../errors": {
          OneKeyError: class extends Error {
            constructor(v) {
              super(v.message);
              Object.assign(this, v);
            }
          },
        },
      },
    },
  );
  const format = evaluateSource(dir + "unifoldFormat.ts", {
    mocks: {
      "@onekeyhq/kit/src/views/Perp/consts/unifold": constants,
      "@onekeyhq/shared/src/locale": locale,
      "@onekeyhq/shared/src/platformEnv": { isNative: false },
      "@onekeyhq/shared/src/utils/dateUtils": {
        formatDate: () => {
          throw Error("Unexpected transfer date formatter");
        },
      },
      "@onekeyhq/shared/src/utils/unifoldDepositUtils": shared,
    },
    globals: { URL, Date: clock.Date },
  });
  const components = Object.fromEntries(
    [
      "Button",
      "DashText",
      "Empty",
      "Icon",
      "IconButton",
      "ScrollView",
      "SizableText",
      "Skeleton",
      "Stack",
      "Tooltip",
      "XStack",
      "YStack",
      "QRCode",
    ].map((k) => [k, host(k)]),
  );
  components.Popover = ({ renderTrigger, renderContent, open, ...p }) =>
    React.createElement(
      "Popover",
      p,
      renderTrigger,
      open ? renderContent : null,
    );
  components.Dialog = { Header: host("DialogHeader") };
  components.Page = { Footer: host("PageFooter") };
  components.Toast = { error: (v) => events.toasts.push(v) };
  components.useClipboard = () => ({ copyText: (v) => events.copies.push(v) });
  const token = {
    Token: ({ children, cornerBadge, ...p }) =>
      React.createElement("Token", p, children, cornerBadge),
  };
  const common = {
    "react-intl": { useIntl: () => intls[state.locale] },
    "@onekeyhq/components": components,
    "@onekeyhq/kit/src/components/Token": token,
    "@onekeyhq/shared/src/locale": locale,
    "@onekeyhq/shared/src/platformEnv": { isNative: false },
    "@onekeyhq/kit/src/views/Perp/consts/unifold": constants,
    "./unifoldFormat": format,
  };
  const selector = evaluateSource(dir + "UnifoldSourceSelector.tsx", {
    mocks: common,
  });
  const qr = evaluateSource(dir + "UnifoldDepositQRCard.tsx", {
    mocks: {
      ...common,
      "@onekeyhq/kit/src/components/HighlightAddress": {
        HighlightAddress: host("HighlightAddress"),
      },
      "@onekeyhq/shared/src/utils/openUrlUtils": {
        openUrlExternal: (v) => events.urls.push(v),
      },
    },
  });
  const badge = evaluateSource(dir + "UnifoldDepositHistoryCard.tsx", {
    mocks: common,
  });
  const file = dir + "UnifoldTransferContent.tsx",
    source = readSource(file),
    ast = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
  const code =
    ast.statements
      .filter((n) => !ts.isImportDeclaration(n) && !ts.isExportDeclaration(n))
      .map((n) => n.getText(ast))
      .join("\n") + "\nexport {UnifoldTransferContent};";
  let notify, tree;
  const selectSource = (asset, chain) => {
    state.session = { ...state.session, selection: { asset, chain } };
    notify((n) => n + 1);
  };
  const selectToken = (asset) =>
    selectSource(
      asset,
      asset.chains.find(
        (c) => c.chain_id === state.session.selection?.chain.chain_id,
      ) ?? asset.chains[0],
    );
  const selectChain = (chain) =>
    selectSource(state.session.selection.asset, chain);
  const callbacks = {
    selectSource,
    selectToken,
    selectChain,
    acknowledgePresentedExecution: (e) => events.acks.push(e.executionId),
  };
  const actualConstants = evaluateSource("packages/shared/src/consts/perp.ts", {
    names: ["UNIFOLD_THIRD_PARTY_CONVERSION_FEE_PERCENT"],
  });
  const { UnifoldTransferContent } = evaluateText(file, code, {
    globals: {
      ...React,
      ...components,
      ...token,
      ...constants,
      ...locale,
      ...format,
      ...selector,
      ...qr,
      ...badge,
      ...shared,
      ...actualConstants,
      useIntl: () => intls[state.locale],
      usePerpsActiveAccountAtom: () => [
        {
          accountAddress: patch.runtime?.state.account ?? sessionRecipient,
          walletType: "hd",
        },
      ],
      usePerpsUnifoldDepositSession:
        patch.runtime?.useSession ??
        (() => ({ ...state.session, ...callbacks })),
      getPresetNetworks: () => [
        { shortcode: "hyperevm", logoURI: "https://icons.local/hyperevm.svg" },
      ],
      defaultLogger: {
        perp: {
          deposit: {
            perpDepositAddressSourceSelect: (v) => events.analytics.push(v),
          },
        },
      },
      Date: clock.Date,
      setTimeout: clock.setTimeout.bind(clock),
      clearTimeout: clock.clearTimeout.bind(clock),
    },
  });
  const callbacksProps = {
    onOpenTracker: () => events.opens++,
    onTrackedExecutionCountChange: (n) => events.counts.push(n),
    onSourceSelectorReady: (v) => events.ready.push(v),
    onSourceSelectorUnavailable: () => events.unavailable++,
    onSourceSelectorResultHandled: () => events.handled++,
  };
  function Root() {
    const [, set] = React.useState(0);
    notify = set;
    return React.createElement(UnifoldTransferContent, {
      expectedRecipient: sessionRecipient,
      useDialogHeader: true,
      bodyMaxHeight: 600,
      ...callbacksProps,
      ...state.props,
    });
  }
  if (!patch.deferMount)
    await renderer.act(async () => {
      tree = renderer.create(React.createElement(Root));
    });
  return {
    Component: UnifoldTransferContent,
    state,
    events,
    clock,
    get root() {
      return tree.root;
    },
    nodes: (name) => tree.root.findAllByType(name),
    texts: () =>
      tree.root
        .findAllByType("SizableText")
        .flatMap((n) => n.children.filter((c) => typeof c === "string")),
    async action(fn) {
      return renderer.act(async () => {
        await fn(tree.root);
      });
    },
    async update(changes) {
      const { session, props, ...rest } = changes;
      Object.assign(state, rest);
      if (session) state.session = { ...state.session, ...session };
      if (props) state.props = { ...state.props, ...props };
      await renderer.act(async () => notify((n) => n + 1));
    },
    async tick(ms) {
      await renderer.act(async () => clock.tickAsync(ms));
    },
    async close() {
      await renderer.act(async () => tree.unmount());
    },
    async remount() {
      await renderer.act(async () => tree.unmount());
      await renderer.act(async () => {
        tree = renderer.create(React.createElement(Root));
      });
    },
  };
}
