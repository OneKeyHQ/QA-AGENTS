// Pinned actual Desktop funding toolbar/list/row/export; atom arrival, virtual
// table layout and file handoff are local boundaries. No live OneKey/CDP/API.
import {
  React,
  renderer,
  evaluateSource,
  evaluateText,
  ts,
  readSource,
  perpsUtils,
  appRequire,
  BigNumber,
} from "./source.mjs";
import { numberUtils } from "./number-format-source.mjs";
const panel = "packages/kit/src/views/Perp/components/OrderInfoPanel/";
const host =
  (name) =>
  ({ children, ...props }) =>
    React.createElement(name, props, children);
const locale = evaluateSource(
  "packages/shared/src/locale/enum/translations.ts",
);
const dict = Object.fromEntries(
  ["zh_CN", "en_US"].map((l) => [
    l,
    JSON.parse(readSource(`packages/shared/src/locale/json/${l}.json`)),
  ]),
);
const intls = Object.fromEntries(
  Object.entries(dict).map(([l, d]) => [
    l,
    {
      formatMessage: ({ id }) => {
        if (!(id in d)) throw Error("Missing locale " + id);
        return d[id];
      },
    },
  ]),
);
export const fundingRecord = (id, patch = {}) => ({
  hash: "funding-" + id,
  time: 1800000000000 + id * 1000,
  delta: { coin: "BTC", szi: "2", usdc: "1.25", fundingRate: "0.0001" },
  ...patch,
});
export async function fundingListFixture(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const state = {
    account: "0xaaa",
    records: [],
    locale: "zh_CN",
    isLoading: false,
    isError: false,
    side: "all",
    market: undefined,
    exportSaved: true,
    tokens: { BTC: "USDC", ETH: "USDC", "xyz:SOXL": "USDH" },
    ...patch,
  };
  const events = {
      routes: [],
      ledger: 0,
      loads: [],
      metadata: [],
      exports: [],
      toasts: [],
      logs: [],
      options: [],
      viewAll: 0,
      refresh: 0,
    },
    blobs = new Map();
  let tree,
    notify = () => {};
  const utils = perpsUtils(),
    numbers = numberUtils("en-US");
  const display = evaluateSource(panel + "fundingHistoryDisplay.ts", {
    mocks: {
      "@onekeyhq/shared/src/errors": { OneKeyLocalError: Error },
      "@onekeyhq/shared/src/utils/perpsUtils": utils,
    },
  });
  const clock = appRequire("@sinonjs/fake-timers").createClock(1800000000000);
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
          intl: intls[state.locale],
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
  const logger = { app: { error: { log: (v) => events.logs.push(v) } } };
  const csv = evaluateSource("packages/shared/src/utils/csvExporterUtils.ts", {
    names: ["convertToCSV", "exportCSVWeb", "exportCSV"],
    globals: {
      Blob,
      URL: {
        createObjectURL: (blob) => {
          const url = "local:blob-" + blobs.size;
          blobs.set(url, blob);
          return url;
        },
        revokeObjectURL: () => {},
      },
      document: {
        createElement: () => {
          const link = {
            click() {
              if (state.exportError) throw state.exportError;
              events.exports.push({
                filename: link.download,
                blob: blobs.get(link.href),
              });
            },
          };
          return link;
        },
      },
      platformEnv: { isNative: false },
      defaultLogger: logger,
      exportCSVExpo: () => {
        throw Error("Native export forbidden");
      },
    },
  });
  const components = Object.fromEntries(
    [
      "Button",
      "SizableText",
      "Skeleton",
      "Spinner",
      "XStack",
      "YStack",
      "Icon",
      "IconButton",
      "Divider",
      "SearchBar",
      "Illustration",
      "Stack",
      "DebugRenderTracker",
    ].map((n) => [n, host(n)]),
  );
  const { PerpDesktopEmptyState } = evaluateSource(
    panel + "Components/PerpDesktopEmptyState.tsx",
    { mocks: { "@onekeyhq/components": components } },
  );
  const tableFile = panel + "List/CommonTableListView.tsx",
    tableSource = readSource(tableFile),
    tableAst = ts.createSourceFile(
      tableFile,
      tableSource,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
  let desktopEmptyExpression;
  const visit = (n) => {
    if (ts.isVariableDeclaration(n) && n.name?.text === "desktopEmptyComponent")
      desktopEmptyExpression = n.initializer.getText(tableAst);
    ts.forEachChild(n, visit);
  };
  visit(tableAst);
  if (!desktopEmptyExpression) throw Error("Desktop empty expression changed");
  const { renderActualEmpty } = evaluateText(
    tableFile,
    `export const renderActualEmpty=(ListEmptyComponent,emptyMessage)=>{const emptyComponent=ListEmptyComponent;return ${desktopEmptyExpression};};`,
    { globals: { PerpDesktopEmptyState } },
  );
  const common = {
    ...React,
    ...components,
    ...display,
    ...dates,
    ...numbers,
    BigNumber,
    Date: clock.Date,
    useIntl: () => intls[state.locale],
    ETranslations: locale.ETranslations,
    ...utils,
    usePerpsActiveAccountAtom: () => [{ accountAddress: state.account }],
    usePerpUserFundingHistory: () => ({
      accountAddress: state.account,
      records: state.records,
      isError: state.isError,
      isLoading: state.isLoading,
      refresh: async () => {
        events.refresh++;
      },
    }),
    usePerpFundingHistoryViewAllUrl: () => ({
      onViewAllUrl: () => {
        events.viewAll++;
      },
    }),
    PERP_USER_FUNDING_HISTORY_LIMIT: 2000,
    defaultLogger: logger,
    csvExporterUtils: csv,
    Toast: Object.fromEntries(
      ["error", "success"].map((k) => [
        k,
        (v) => events.toasts.push({ kind: k, ...v }),
      ]),
    ),
    backgroundApiProxy: {
      serviceHyperliquid: {
        getUserFundingHistory: async (p) => {
          events.loads.push(p);
          if (state.waitExport) await state.waitExport;
          if (state.loadError) throw state.loadError;
          return state.exportRecords ?? state.records;
        },
        getFundingHistoryPaymentTokens: async (p) => {
          events.metadata.push(p);
          if (state.metadataError) throw state.metadataError;
          return state.tokens;
        },
      },
    },
    getColumnStyle: (c) => ({ columnKey: c.key }),
    calcCellAlign: () => "left",
  };
  const fns = evaluateSource(panel + "List/PerpFundingHistoryList.tsx", {
    names: [
      "FUNDING_HISTORY_PAGE_SIZE",
      "balanceFormatter",
      "valueFormatter",
      "FundingHistoryExportAction",
      "FundingHistoryRow",
      "PerpFundingHistoryList",
    ],
    globals: {
      ...common,
      CommonTableListView: Table,
      PerpMobileEmptyState: host("MobileEmpty"),
      MobileFundingHistoryLoadingSkeleton: host("MobileSkeleton"),
    },
  });
  function Table(props) {
    return React.createElement(
      "Table",
      props,
      props.paginationAction,
      props.data.length
        ? props.data
            .slice(
              (props.currentListPage - 1) * props.pageSize,
              props.currentListPage * props.pageSize,
            )
            .map((r, i) =>
              React.createElement(
                "FundingRow",
                { key: props.keyExtractor(r), hash: r.hash },
                props.renderRow(r, i),
              ),
            )
        : renderActualEmpty(props.ListEmptyComponent, props.emptyMessage),
    );
  }
  function Popover({ renderTrigger, renderContent, open, onOpenChange }) {
    return React.createElement(
      "Popover",
      { open },
      React.cloneElement(renderTrigger, { onPress: () => onOpenChange(true) }),
      open ? renderContent({ closePopover: () => onOpenChange(false) }) : null,
    );
  }
  const toolbar = evaluateSource(
    panel + "Components/FundingHistoryFilterToolbar.tsx",
    {
      names: [
        "FundingHistoryFilterTrigger",
        "FundingHistoryFilterOption",
        "createFundingHistoryMarketOptionsStore",
        "FundingHistorySideFilterContent",
        "MobileFundingHistorySideDialogContent",
        "FundingHistoryMarketFilterContent",
        "MobileFundingHistoryMarketDialogContent",
        "FundingHistoryFilterToolbar",
      ],
      globals: {
        ...common,
        Popover,
        Dialog: {
          show: () => {
            throw Error("Native forbidden");
          },
          ScrollView: host("DialogScroll"),
        },
        useDialogInstance: () => {
          throw Error("Native forbidden");
        },
        useWindowDimensions: () => ({ height: 900 }),
        useKeyboardHeight: () => 0,
        useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
        platformEnv: { isNative: false, isNativeAndroid: false },
      },
    },
  );
  // The complete actual parent owns filters, tab mounting, account reset and
  // option reconciliation. Other tabs remain explicit inert layout hosts.
  const parentFile = panel + "PerpOrderInfoPanel.tsx",
    parentText = readSource(parentFile),
    parentAst = ts.createSourceFile(
      parentFile,
      parentText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
  const parentCode =
    parentAst.statements
      .filter((n) => !ts.isImportDeclaration(n) && !ts.isExportDeclaration(n))
      .map((n) => n.getText(parentAst))
      .join("\n") + "\nexport {PerpOrderInfoPanel};";
  const scoped = evaluateSource(
    "packages/kit/src/views/Perp/utils/accountScopedData.ts",
    { mocks: { "@onekeyhq/shared/src/utils/perpsUtils": utils } },
  );
  const mode = evaluateSource(
    "packages/kit/src/views/Perp/utils/accountMode.ts",
    {
      mocks: {
        "@onekeyhq/shared/types/hyperliquid": evaluateSource(
          "packages/shared/types/hyperliquid/types.ts",
          { names: ["EHyperLiquidAbstractionMode"] },
        ),
      },
    },
  );
  const actionRef = {
    current: { setTradeRouteViewState: (v) => events.routes.push(v) },
  };
  const tradeFilters = { filters: {}, onMarketOptionsChange: () => {} };
  const emptyOrders = () => [{ accountAddress: state.account, openOrders: [] }];
  const { PerpOrderInfoPanel } = evaluateText(parentFile, parentCode, {
    globals: {
      ...common,
      ...mode,
      ...scoped,
      FundingHistoryFilterToolbar: toolbar.FundingHistoryFilterToolbar,
      PerpFundingHistoryList: fns.PerpFundingHistoryList,
      ...Object.fromEntries(
        [
          "HideSmallSpotHoldingsCheckbox",
          "OrderInfoTabBar",
          "TradesHistoryFilterToolbar",
          "PerpAccountList",
          "PerpOpenOrdersList",
          "PerpPositionsList",
          "PerpTradesHistoryList",
          "PerpTwapList",
          "SpotBalanceList",
        ].map((n) => [n, host(n)]),
      ),
      useHyperliquidActions: () => actionRef,
      useTradeRouteViewStateAtom: () => [{ infoPanelTab: "Positions" }],
      usePerpsActiveOpenOrdersAtom: emptyOrders,
      useSpotActiveOpenOrdersAtom: emptyOrders,
      usePerpsActivePositionAtom: () => [
        { accountAddress: state.account, activePositions: [] },
      ],
      usePerpsAccountScopedCacheAddress: () => state.account,
      usePerpsAccountScopedActiveTwapOrders: () => ({ twapOrders: [] }),
      useSpotBalancesAtom: () => [{ balances: [] }],
      usePerpsActiveAccountSummaryAtom: () => [{}],
      usePerpsAbstractionModeAtom: () => [{}],
      useVisibleSpotHoldingsCount: () => 0,
      usePerpsPendingInfoPanelTabAtom: () => React.useState("Funding"),
      useTradeHistoryFilters: () => tradeFilters,
      useShowUnifoldDepositTracker: () => ({
        isUnifoldDepositTrackerAvailable: false,
      }),
      EAppEventBusNames: { PerpSwitchInfoPanelTab: "switch" },
      appEventBus: { on: () => {}, off: () => {} },
      backgroundApiProxy: {
        serviceHyperliquidSubscription: {
          enableLedgerUpdatesSubscription: async () => {
            events.ledger++;
          },
        },
      },
    },
  });
  function Root() {
    const [, set] = React.useState(0);
    notify = () => set((x) => x + 1);
    const [options, setOptions] = React.useState([]);
    return state.parent
      ? React.createElement(PerpOrderInfoPanel)
      : React.createElement(
          React.Fragment,
          null,
          React.createElement(toolbar.FundingHistoryFilterToolbar, {
            sideFilter: state.side,
            marketFilter: state.market,
            marketOptions: options,
            onSideFilterChange: (v) => {
              state.side = v;
              notify();
            },
            onMarketFilterChange: (v) => {
              state.market = v;
              notify();
            },
          }),
          React.createElement(fns.PerpFundingHistoryList, {
            isMobile: false,
            isActive: true,
            sideFilter: state.side,
            marketFilter: state.market,
            onMarketOptionsChange: setOptions,
          }),
        );
  }
  await renderer.act(async () => {
    tree = renderer.create(React.createElement(Root));
  });
  const nodes = (t) => tree.root.findAllByType(t),
    byId = (id) => {
      const x = nodes("XStack")
        .concat(nodes("Button"))
        .filter((n) => n.props.testID === id);
      if (x.length !== 1)
        throw Error("Expected unique " + id + " got " + x.length);
      return x[0];
    };
  return {
    state,
    events,
    clock,
    table: () => nodes("Table")[0].props,
    nodes,
    byId,
    rows: () => nodes("FundingRow").map((n) => n.props.hash),
    cells(hash) {
      const row = nodes("FundingRow").find((n) => n.props.hash === hash);
      return Object.fromEntries(
        row
          .findAll((n) => typeof n.type === "string" && n.props.columnKey)
          .map((n) => [
            n.props.columnKey,
            {
              text: n
                .findAllByType("SizableText")
                .map((s) =>
                  s.children.filter((c) => typeof c === "string").join(""),
                )
                .join(" / "),
              color: n.findAllByType("SizableText")[0]?.props.color,
            },
          ]),
      );
    },
    async update(p) {
      Object.assign(state, p);
      await renderer.act(async () => notify());
    },
    async choose(kind, value) {
      await renderer.act(async () =>
        byId(`perps-funding-history-${kind}-filter`).props.onPress(),
      );
      await renderer.act(async () =>
        byId(`perps-funding-history-${kind}-${value ?? "all"}`).props.onPress(),
      );
    },
    async open(kind) {
      await renderer.act(async () =>
        byId(`perps-funding-history-${kind}-filter`).props.onPress(),
      );
    },
    async search(s) {
      await renderer.act(async () =>
        byId("perps-funding-history-market-filter").props.onPress(),
      );
      await renderer.act(async () =>
        nodes("SearchBar")[0].props.onChangeText(s),
      );
    },
    async tab(name) {
      await renderer.act(async () =>
        byId("perp-info-panel-tab-" + name).props.onPress(),
      );
    },
    async page(p) {
      await renderer.act(async () =>
        nodes("Table")[0].props.setCurrentListPage(p),
      );
    },
    async export() {
      await renderer.act(async () =>
        byId("perp-funding-history-export").props.onPress(),
      );
    },
    exportPress: () => byId("perp-funding-history-export").props.onPress,
    async close() {
      await renderer.act(async () => tree.unmount());
    },
  };
}
