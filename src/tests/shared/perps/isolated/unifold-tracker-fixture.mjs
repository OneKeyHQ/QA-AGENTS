// Actual Desktop tracker, row, detail and history badge, through actual
// usePromiseResult. RPC replies, storage, clock, clipboard, URL and layout are
// explicit local boundaries; no OneKey/network/financial action is reachable.
import {
  React,
  renderer,
  evaluateSource,
  evaluateText,
  readSource,
  ts,
  appRequire,
} from "./source.mjs";
import { promiseHookFixture } from "./promise-hook-fixture.mjs";
export const recipient = "0x" + "a".repeat(40);
export const execution = (patch = {}) => ({
  executionId: "exec-12345678-abcdef-0000-12345678",
  status: "succeeded",
  terminal: true,
  destinationTransactionHashes: ["0xdestinationhash12345678"],
  vendorStatus: null,
  recipientAddress: recipient,
  depositWalletId: "wallet-local",
  depositAddress: recipient,
  transactionHash: "0xsourcehash12345678",
  sourceChainType: "ethereum",
  sourceChainId: "42161",
  sourceAmountBaseUnit: "3500000",
  sourceAmountUsd: "3.5",
  sourceCurrency: "USDC",
  sourceTokenDecimals: 6,
  destinationAmountBaseUnit: "340000000",
  destinationAmountUsd: "3.4",
  destinationCurrency: "USDC",
  destinationTokenDecimals: 8,
  destinationTokenIconUrl: "https://icons.example/perp.png",
  explorerUrl: "https://arbiscan.io/tx/source",
  destinationExplorerUrl: "https://hypurrscan.io/tx/destination",
  failureReason: null,
  createdAt: "2027-01-15T07:00:00.000Z",
  ...patch,
});
const dir =
  "packages/kit/src/views/Perp/components/TradingPanel/modals/UnifoldDeposit/";
const host =
  (name) =>
  ({ children, ...props }) =>
    React.createElement(name, props, children);
export async function unifoldTrackerFixture(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const state = {
    account: recipient,
    recipient,
    records: [],
    locale: "zh_CN",
    view: "tracker",
    cache: new Map(),
    ...patch,
  };
  const events = {
    loads: [],
    assets: [],
    copies: [],
    urls: [],
    deposits: 0,
    selections: [],
  };
  const hook = promiseHookFixture({ swrCache: state.cache }),
    { clock } = hook;
  const constants = evaluateSource(
    "packages/kit/src/views/Perp/consts/unifold.ts",
  );
  const locale = evaluateSource(
    "packages/shared/src/locale/enum/translations.ts",
  );
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
  const dates = evaluateSource("packages/shared/src/utils/dateUtils.ts", {
    mocks: {
      "date-fns": appRequire("date-fns"),
      "date-fns-tz": {
        formatInTimeZone: () => {
          throw Error("Unexpected timezone conversion");
        },
      },
      "@onekeyhq/shared/src/errors": { OneKeyLocalError: Error },
      "../locale": locale,
      "../locale/appLocale": {
        appLocale: {
          get intl() {
            return intls[state.locale];
          },
          getLocale: () => (state.locale === "en_US" ? "en-US" : "zh-CN"),
        },
      },
      "../locale/dateLocaleMap": {
        DateLocaleMap: {
          "zh-CN": appRequire("date-fns/locale").zhCN,
          "en-US": appRequire("date-fns/locale").enUS,
        },
      },
      "../locale/getDefaultLocale": { getDefaultLocale: () => "zh-CN" },
    },
  });
  const format = evaluateSource(dir + "unifoldFormat.ts", {
    mocks: {
      "@onekeyhq/kit/src/views/Perp/consts/unifold": constants,
      "@onekeyhq/shared/src/locale": locale,
      "@onekeyhq/shared/src/platformEnv": { isNative: false },
      "@onekeyhq/shared/src/utils/dateUtils": dates,
      "@onekeyhq/shared/src/utils/unifoldDepositUtils": shared,
    },
    globals: { URL, Date: clock.Date },
  });
  const dest = evaluateSource(
    "packages/kit/src/views/Perp/hooks/usePerpsUnifoldDepositSession.ts",
    {
      names: [
        "UNIFOLD_DEPOSIT_DESTINATION",
        "UNIFOLD_DEV_TEST_DESTINATION",
        "isUnifoldHyperCoreDestination",
        "resolveUnifoldDepositDestination",
      ],
      globals: { ...constants, platformEnv: { isDev: false } },
    },
  );
  const safe = evaluateSource(
    "packages/kit/src/views/Perp/utils/unifoldRecipient.ts",
    {
      mocks: {
        "@onekeyhq/shared/src/utils/accountUtils": {
          isWatchingAccount: () => false,
        },
      },
    },
  );
  const components = Object.fromEntries(
    [
      "Alert",
      "Button",
      "Divider",
      "Empty",
      "Icon",
      "ScrollView",
      "SizableText",
      "Skeleton",
      "Stack",
      "XStack",
      "YStack",
      "Illustration",
      "Token",
    ].map((n) => [n, host(n)]),
  );
  components.Token = ({ children, cornerBadge, ...props }) =>
    React.createElement(
      "Token",
      { ...props, cornerBadge },
      children,
      cornerBadge,
    );
  components.Dialog = {
    Header: host("DialogHeader"),
    Title: host("DialogTitle"),
  };
  const empty = evaluateSource(
    "packages/kit/src/views/Perp/components/OrderInfoPanel/Components/PerpDesktopEmptyState.tsx",
    { mocks: { "@onekeyhq/components": components } },
  );
  const background = {
    getSupportedAssets: async (d) => {
      events.assets.push(d);
      return (
        state.assets ?? [
          {
            symbol: "USDC",
            icon_url: "https://icons.example/usdc.png",
            chains: [
              {
                chain_type: "ethereum",
                chain_id: "42161",
                icon_url: "https://icons.example/arb.png",
              },
            ],
          },
        ]
      );
    },
    listDepositExecutions: async (p) => {
      events.loads.push(p);
      const records = state.records,
        error = state.error;
      if (state.pending) await state.pending;
      if (error) throw error;
      return records;
    },
  };
  const globals = {
    ...React,
    ...components,
    ...locale,
    ...constants,
    ...dest,
    ...safe,
    ...format,
    ...empty,
    useIntl: () => intls[state.locale],
    platformEnv: { isNative: false, isNativeAndroid: false },
    getPresetNetworks: () => [
      { shortcode: "hyperevm", logoURI: "https://icons.example/hyper.png" },
    ],
    useBackHandler: () => {},
    useClipboard: () => ({ copyText: (v) => events.copies.push(v) }),
    useDevSettingsPersistAtom: () => [{}],
    usePerpsActiveAccountAtom: () => [{ accountAddress: state.account }],
    jotaiDefaultStore: { get: () => ({ accountAddress: state.account }) },
    perpsActiveAccountAtom: { atom: () => ({}) },
    usePromiseResult: hook.usePromiseResult,
    backgroundApiProxy: { serviceUnifoldDeposit: background },
    openUrlExternal: (u) => events.urls.push(u),
    PerpMobileEmptyState: () => {
      throw Error("Mobile forbidden");
    },
  };
  const trackerFile = dir + "UnifoldTrackerContent.tsx",
    src = readSource(trackerFile),
    ast = ts.createSourceFile(
      trackerFile,
      src,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
  const code = ast.statements
    .filter((n) => !ts.isImportDeclaration(n) && !ts.isExportDeclaration(n))
    .map((n) => n.getText(ast))
    .join("\n");
  const actual = evaluateText(trackerFile, code, { globals });
  const badge = evaluateSource(dir + "UnifoldDepositHistoryCard.tsx", {
    mocks: {
      "react-intl": { useIntl: globals.useIntl },
      "@onekeyhq/components": components,
      "@onekeyhq/shared/src/locale": locale,
    },
  });
  let tree,
    notify = () => {};
  function Root() {
    const [, set] = React.useState(0);
    notify = () => set((n) => n + 1);
    return state.view === "row"
      ? React.createElement(actual.UnifoldExecutionRow, {
          execution: state.execution ?? execution(),
          onPress: () => events.selections.push("row"),
        })
      : state.view === "detail"
        ? React.createElement(actual.UnifoldExecutionDetail, {
            execution: state.execution ?? execution(),
            supportedAssets: state.assets,
            estimatedProcessingTimeSeconds: state.eta,
          })
        : state.view === "badge"
          ? React.createElement(badge.UnifoldDepositHistoryCard, {
              trackedCount: state.count ?? 0,
              onPress: () => events.deposits++,
            })
          : React.createElement(actual.UnifoldTrackerContent, {
              recipientAddress: state.recipient,
              useDialogHeader: true,
              listHeight: state.height,
              onDepositPress: () => events.deposits++,
              onDetailExecutionIdChange: (v) => events.selections.push(v),
            });
  }
  if (!patch.deferMount)
    await renderer.act(async () => {
      tree = renderer.create(React.createElement(Root));
    });
  const nodes = (t) => tree.root.findAllByType(t),
    texts = () =>
      nodes("SizableText").map((n) =>
        n.children.filter((c) => typeof c === "string").join(""),
      );
  return {
    Component: actual.UnifoldTrackerContent,
    state,
    events,
    clock,
    nodes,
    texts,
    root: () => tree.root,
    async update(p) {
      Object.assign(state, p);
      await renderer.act(async () => notify());
    },
    async tick(ms = 0) {
      await renderer.act(async () => {
        await clock.tickAsync(ms);
      });
    },
    async action(fn) {
      await renderer.act(async () => fn());
    },
    async close() {
      await renderer.act(async () => tree.unmount());
    },
  };
}
