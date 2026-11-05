// Pinned actual Desktop filters -> toolbar -> history hook -> list -> row.
// Atom notification, popover layout, table virtualization and transport are
// explicit local boundaries. No signing/order/cancel or live API is reachable.
import {
  React,
  renderer,
  evaluateSource,
  perpsUtils,
  readSource,
  appRequire,
} from "./source.mjs";
import { numberUtils } from "./number-format-source.mjs";
const base = "packages/kit/src/views/Perp/",
  panel = base + "components/OrderInfoPanel/";
const host =
  (type) =>
  ({ children, ...props }) =>
    React.createElement(type, props, children);
const locale = evaluateSource(
  "packages/shared/src/locale/enum/translations.ts",
);
const dictionaries = Object.fromEntries(
  ["zh_CN", "en_US"].map((l) => [
    l,
    JSON.parse(readSource(`packages/shared/src/locale/json/${l}.json`)),
  ]),
);
const utils = perpsUtils();
export const tradeFill = (tid, patch = {}) => ({
  tid,
  oid: 1000 + tid,
  hash: "0xfill" + tid,
  coin: "BTC",
  time: 1800000000000 + tid * 1000,
  side: "A",
  dir: "Close Long",
  px: "110.125",
  sz: "1.25",
  closedPnl: "12.50",
  fee: "0.125",
  feeToken: "USDC",
  startPosition: "1.25",
  crossed: true,
  ...patch,
});
export async function tradesListFixture(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const state = {
    account: { accountAddress: "0xaaa" },
    history: { accountAddress: "0xaaa", fills: [], isLoaded: true },
    instrument: { coin: "BTC", mode: "perp" },
    pairNames: { "@1": "UBTC/USDC", "@2": "UBTC/USDH", "@3": "UETH/USDC" },
    display: { "@1": "BTC", "@2": "BTC", "@3": "ETH" },
    twap: { accountAddress: "0xaaa", fills: [] },
    refreshHook: 0,
    locale: "zh_CN",
    locked: false,
    ...patch,
  };
  const events = {
      load: [],
      reset: 0,
      refresh: 0,
      twap: 0,
      shares: [],
      switches: [],
      details: [],
      viewAll: 0,
    },
    timers = new Map();
  let timerId = 0,
    tree,
    notify = () => {},
    filterValue;
  const intl = () => ({
    formatMessage: ({ id }) => {
      if (!(id in dictionaries[state.locale]))
        throw Error("Missing translation " + id);
      return dictionaries[state.locale][id];
    },
  });
  const nums = Object.fromEntries(
    Object.keys(numberUtils()).map((k) => [
      k,
      (...args) =>
        numberUtils(state.locale === "en_US" ? "en-US" : "zh-CN")[k](...args),
    ]),
  );
  const utility = evaluateSource(panel + "utils.ts", {
    mocks: {
      "@onekeyhq/shared/src/locale": locale,
      "@onekeyhq/shared/src/utils/numberUtils": nums,
      "@onekeyhq/shared/src/utils/perpsTpSlUtils": evaluateSource(
        "packages/shared/src/utils/perpsTpSlUtils.ts",
      ),
      "@onekeyhq/shared/src/utils/perpsUtils": utils,
    },
  });
  const display = evaluateSource(panel + "Components/tradeFillDisplay.ts", {
    mocks: {
      "@onekeyhq/shared/src/locale": locale,
      "@onekeyhq/shared/src/utils/numberUtils": nums,
      "@onekeyhq/shared/src/utils/perpsUtils": utils,
      "../utils": utility,
    },
  });
  const funding = evaluateSource(panel + "fundingHistoryDisplay.ts", {
    mocks: {
      "@onekeyhq/shared/src/errors": { OneKeyLocalError: Error },
      "@onekeyhq/shared/src/utils/perpsUtils": utils,
    },
  });
  const atoms = {
    usePerpsActiveAccountAtom: () => [state.account],
    usePerpsTradesHistoryDataAtom: () => [state.history],
    usePerpsTradesHistoryRefreshHookAtom: () => [
      { refreshHook: state.refreshHook },
    ],
    useActiveTradeInstrumentAtom: () => [state.instrument],
    useSpotPairDisplayNameMapAtom: () => [state.pairNames],
    useSpotPairDisplayMapAtom: () => [state.display],
    usePerpsTwapSliceFillsAtom: () => [state.twap],
    useAppIsLockedAtom: () => [state.locked],
  };
  const backgroundApiProxy = {
    serviceHyperliquid: {
      loadTradesHistory: async (address, options) => {
        events.load.push([address, options]);
      },
      resetTradesHistory: async () => {
        events.reset++;
      },
    },
    serviceHyperliquidSubscription: {
      refreshSubscriptionForUserFills: async () => {
        events.refresh++;
      },
    },
    simpleDb: { perp: { getExpectMaxBuilderFee: async () => 25 } },
  };
  const history = evaluateSource(base + "hooks/usePerpOrderInfoPanel.ts", {
    names: ["usePerpTradesHistory"],
    globals: {
      ...React,
      ...atoms,
      backgroundApiProxy,
      noop: () => {},
      useListenTabFocusState: () => {},
      ETabRoutes: { Perp: "Perp" },
      setTimeout: (fn, ms) => {
        const id = ++timerId;
        timers.set(id, { fn, ms });
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
    },
  });
  const filter = evaluateSource(base + "hooks/useTradeHistoryFilters.ts", {
    mocks: {
      "@onekeyhq/kit-bg/src/states/jotai/atoms": atoms,
      "../components/OrderInfoPanel/fundingHistoryDisplay": funding,
    },
  });
  const components = Object.fromEntries(
    [
      "XStack",
      "YStack",
      "SizableText",
      "DashText",
      "Icon",
      "IconButton",
      "Divider",
      "SearchBar",
      "Skeleton",
    ].map((t) => [t, host(t)]),
  );
  const Dialog = {
    ScrollView: host("DialogScroll"),
    show: () => {
      throw Error("Native dialog forbidden in Desktop fixture");
    },
  };
  function Popover({ renderTrigger, renderContent, open, onOpenChange }) {
    return React.createElement(
      "Popover",
      { open },
      React.cloneElement(renderTrigger, { onPress: () => onOpenChange(true) }),
      open ? renderContent({ closePopover: () => onOpenChange(false) }) : null,
    );
  }
  const common = {
    ...React,
    ...components,
    useIntl: intl,
    ETranslations: locale.ETranslations,
    Popover,
    Dialog,
    useDialogInstance: () => {
      throw Error("Native dialog forbidden");
    },
    useWindowDimensions: () => ({ height: 900 }),
    useKeyboardHeight: () => 0,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
    platformEnv: { isNative: false, isNativeAndroid: false },
    ...funding,
  };
  const fundingToolbar = evaluateSource(
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
      globals: common,
    },
  );
  const toolbar = evaluateSource(
    panel + "Components/TradesHistoryFilterToolbar.tsx",
    {
      names: ["TypeOptions", "MobileTypeOptions", "TradesHistoryFilterToolbar"],
      globals: { ...common, ...fundingToolbar },
    },
  );
  const date = evaluateSource("packages/shared/src/utils/dateUtils.ts", {
    mocks: {
      "date-fns": appRequire("date-fns"),
      "date-fns-tz": {
        formatInTimeZone: () => {
          throw Error("Timezone conversion outside this fixture");
        },
      },
      "@onekeyhq/shared/src/errors": { OneKeyLocalError: Error },
      "../locale": locale,
      "../locale/appLocale": {
        appLocale: {
          getLocale: () => (state.locale === "en_US" ? "en-US" : "zh-CN"),
          intl: { formatMessage: ({ id }) => dictionaries[state.locale][id] },
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
  const actions = {
    current: {
      loadTwapData: async () => {
        events.twap++;
      },
      switchTradeInstrument: async (value) => events.switches.push(value),
    },
  };
  const row = evaluateSource(panel + "Components/TradesHistoryRow.tsx", {
    names: ["TradesHistoryRow"],
    globals: {
      ...React,
      ...components,
      ...utils,
      ...utility,
      ...date,
      ...display,
      ...nums,
      useIntl: intl,
      ETranslations: locale.ETranslations,
      useHyperliquidActions: () => actions,
      useSpotPairDisplayMapAtom: atoms.useSpotPairDisplayMapAtom,
      ListItem: host("ListItem"),
      Token: host("Token"),
      Tooltip: ({ renderTrigger }) => renderTrigger,
      Popover,
      PERP_DESKTOP_TABLE_ROW_PADDING_LEFT: 16,
      PERP_DESKTOP_TABLE_ROW_PADDING_RIGHT: 16,
      getColumnStyle: (c) => ({ "data-column": c.key }),
      calcCellAlign: () => "left",
      TradesHistoryShareAction: ({ visible, onPress }) =>
        visible ? React.createElement("ShareAction", { onPress }) : null,
    },
  });
  function Table(props) {
    return React.createElement(
      "Table",
      props,
      props.data.length
        ? props.data
            .slice(
              (props.currentListPage - 1) * props.pageSize,
              props.currentListPage * props.pageSize,
            )
            .map((item, index) =>
              React.createElement(
                "TradeRow",
                { key: item.tid ?? item.hash, tid: item.tid },
                props.renderRow(item, index),
              ),
            )
        : React.createElement("Empty", { title: props.emptyMessage }),
    );
  }
  function useUpdateEffect(fn, deps) {
    const mounted = React.useRef(false);
    React.useEffect(() => {
      if (mounted.current) return fn();
      mounted.current = true;
      return undefined;
    }, deps);
  }
  const list = evaluateSource(panel + "List/PerpTradesHistoryList.tsx", {
    names: [
      "TRADES_HISTORY_PAGE_SIZE",
      "DEFAULT_FILTERS",
      "isTwapTradeFill",
      "getFillKey",
      "filterTwapSliceFillsFromTrades",
      "PerpTradesHistoryList",
    ],
    globals: {
      ...React,
      ...components,
      ...atoms,
      ...display,
      useIntl: intl,
      ETranslations: locale.ETranslations,
      isSpotInstrument: utils.isSpotInstrument,
      usePerpTradesHistory: history.usePerpTradesHistory,
      usePerpTradesHistoryViewAllUrl: () => ({
        onViewAllUrl: () => events.viewAll++,
      }),
      useHyperliquidActions: () => actions,
      useShareTradeHistory: () => (fill) => events.shares.push(fill),
      useNavigation: () => ({ push: (...args) => events.details.push(args) }),
      backgroundApiProxy,
      usePromiseResult: () => ({ result: {} }),
      useUpdateEffect,
      CommonTableListView: Table,
      TradesHistoryRow: row.TradesHistoryRow,
      TRADES_HISTORY_SHARE_ACTION_WIDTH: 32,
      EModalPerpRoutes: { PerpTradeHistoryDetails: "detail" },
    },
  });
  function Root() {
    const [, setVersion] = React.useState(0);
    notify = () => setVersion((v) => v + 1);
    filterValue = filter.useTradeHistoryFilters();
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(toolbar.TradesHistoryFilterToolbar, filterValue),
      React.createElement(list.PerpTradesHistoryList, {
        filters: filterValue.filters,
        onMarketOptionsChange: filterValue.onMarketOptionsChange,
        isMobile: false,
      }),
    );
  }
  await renderer.act(async () => {
    tree = renderer.create(React.createElement(Root));
  });
  const nodes = (type) => tree.root.findAllByType(type);
  const byId = (id) => {
    const found = nodes("XStack").filter((n) => n.props.testID === id);
    if (found.length !== 1)
      throw Error("Unique actual filter control " + id + ": " + found.length);
    return found[0];
  };
  return {
    state,
    events,
    get tree() {
      return tree;
    },
    get filters() {
      return filterValue.filters;
    },
    get options() {
      return filterValue.marketOptions;
    },
    table: () => nodes("Table")[0].props,
    rows: () => nodes("TradeRow"),
    texts: (node = tree.root) =>
      node
        .findAllByType("SizableText")
        .map((n) => n.children.filter((c) => typeof c === "string").join(""))
        .filter(Boolean),
    async choose(kind, value) {
      const trigger =
        kind === "type"
          ? "perps-trade-history-type-filter"
          : `perps-funding-history-${kind}-filter`;
      await renderer.act(async () => byId(trigger).props.onPress());
      const option =
        kind === "type"
          ? `perps-trade-history-type-${value}`
          : `perps-funding-history-${kind}-${value ?? "all"}`;
      await renderer.act(async () => byId(option).props.onPress());
    },
    async search(value) {
      await renderer.act(async () =>
        byId("perps-funding-history-market-filter").props.onPress(),
      );
      await renderer.act(async () =>
        nodes("SearchBar")[0].props.onChangeText(value),
      );
    },
    optionIds: () =>
      nodes("XStack")
        .map((n) => n.props.testID)
        .filter(Boolean),
    async update(data) {
      Object.assign(state, data);
      await renderer.act(async () => notify());
    },
    async page(n) {
      await renderer.act(async () =>
        nodes("Table")[0].props.setCurrentListPage(n),
      );
    },
    async refresh() {
      await renderer.act(async () => nodes("Table")[0].props.onPullToRefresh());
    },
    async share(tid) {
      const r = nodes("TradeRow").find((n) => n.props.tid === tid);
      await renderer.act(async () =>
        r.findByType("ShareAction").props.onPress(),
      );
    },
    timers,
    async close() {
      await renderer.act(async () => tree.unmount());
    },
  };
}
