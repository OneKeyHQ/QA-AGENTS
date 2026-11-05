// Actual Desktop open-order list + actual row + account isolation/formatters.
// Table layout, atom arrival and external action endpoints are local boundaries.
// Controlled order/fill transitions test rendering, not exchange matching.
import {
  React,
  renderer,
  evaluateSource,
  perpsUtils,
  BigNumber,
  appRequire,
} from "./source.mjs";
import { numberUtils } from "./number-format-source.mjs";
import { intl, ETranslations, twap } from "./twap-source-fixture.mjs";
const panel = "packages/kit/src/views/Perp/components/OrderInfoPanel/";
const host =
  (name) =>
  ({ children, ...props }) =>
    React.createElement(name, props, children);
const unexpected = () => {
  throw Error(
    "External/mutating action forbidden in offline open-order fixture",
  );
};
export const openOrder = (oid, patch = {}) => ({
  oid,
  coin: "BTC",
  timestamp: 1800000000000 + oid * 1000,
  side: "B",
  orderType: "Limit",
  limitPx: "105",
  triggerPx: "110",
  triggerCondition: "N/A",
  sz: "0.2",
  origSz: "0.2",
  reduceOnly: false,
  isTrigger: false,
  isPositionTpsl: false,
  children: [],
  ...patch,
});
export async function openOrdersListFixture(
  patch = {},
  { chase = false, scopeFromSnapshot = false } = {},
) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const state = {
    account: "0xaaa",
    dataAccount: "0xaaa",
    spotAccount: "0xaaa",
    scopedAccount: "0xaaa",
    orders: [],
    spotOrders: [],
    filterCurrent: false,
    instrument: { mode: "perp", coin: "BTC" },
    book: { levels: [[{ px: "81000" }], [{ px: "81001" }]] },
    ...patch,
  };
  const activity = {
    books: [],
    dialogs: [],
    amends: [],
    errors: [],
    enabled: 0,
  };
  let useScopedCacheAddress = () => state.scopedAccount;
  if (scopeFromSnapshot) {
    const timer = evaluateSource("packages/shared/src/utils/timerUtils.ts", {
      names: [
        "MS_ONE_SECOND",
        "MS_ONE_MINUTE",
        "MS_ONE_HOUR",
        "MS_ONE_DAY",
        "MS_ONE_WEEK",
        "MS_ONE_MONTH",
        "MS_ONE_YEAR",
        "getTimeDurationMs",
      ],
    });
    const cache = evaluateSource("packages/shared/src/consts/perpCache.ts", {
      names: ["PERPS_ACCOUNT_DISPLAY_CACHE_MAX_AGE_MS"],
      globals: { timerUtils: timer },
    });
    const snapshot = evaluateSource(
      "packages/kit-bg/src/states/jotai/atoms/perps.ts",
      {
        names: ["getPerpsAccountDisplaySnapshotEntry"],
        globals: cache,
      },
    );
    useScopedCacheAddress = evaluateSource(
      "packages/kit/src/views/Perp/hooks/usePerpsAccountScopedCacheAddress.ts",
      {
        mocks: {
          "@onekeyhq/kit-bg/src/states/jotai/atoms": {
            ...snapshot,
            usePerpsActiveAccountAtom: () => [
              { accountAddress: state.account },
            ],
            usePerpsAccountDisplaySnapshotAtom: () => [state.displaySnapshot],
          },
          "../../../states/jotai/contexts/accountSelector/atoms": {
            useActiveAccount: () => ({
              activeAccount: state.selectedWalletAccount,
            }),
          },
        },
      },
    ).usePerpsAccountScopedCacheAddress;
  }
  const { useChasingOrderTask } = evaluateSource(
    panel + "hooks/useChasingOrderTask.ts",
  );
  const events = [],
    components = Object.fromEntries(
      ["XStack", "YStack", "SizableText", "Button"].map((n) => [n, host(n)]),
    );
  const utils = perpsUtils(),
    number = numberUtils("zh-CN");
  const utility = evaluateSource(panel + "utils.ts", {
    mocks: {
      "@onekeyhq/shared/src/locale": { ETranslations },
      "@onekeyhq/shared/src/utils/numberUtils": number,
      "@onekeyhq/shared/src/utils/perpsTpSlUtils": evaluateSource(
        "packages/shared/src/utils/perpsTpSlUtils.ts",
      ),
      "@onekeyhq/shared/src/utils/perpsUtils": utils,
    },
  });
  const scoped = evaluateSource(
    "packages/kit/src/views/Perp/utils/accountScopedData.ts",
    { mocks: { "@onekeyhq/shared/src/utils/perpsUtils": utils } },
  );
  const dates = evaluateSource("packages/shared/src/utils/dateUtils.ts", {
    mocks: {
      "date-fns": appRequire("date-fns"),
      "date-fns-tz": { formatInTimeZone: unexpected },
      "@onekeyhq/shared/src/errors": { OneKeyLocalError: Error },
      "../locale": { ETranslations },
      "../locale/appLocale": { appLocale: { intl, getLocale: () => "zh-CN" } },
      "../locale/dateLocaleMap": {
        DateLocaleMap: { "zh-CN": appRequire("date-fns/locale").zhCN },
      },
      "../locale/getDefaultLocale": { getDefaultLocale: () => "zh-CN" },
    },
  });
  const actions = {
    current: {
      loadTwapData: unexpected,
      cancelOrder: unexpected,
      cancelTwapOrder: unexpected,
      chaseOrder: async (p) => {
        if (!chase) unexpected();
        activity.amends.push(JSON.parse(JSON.stringify(p)));
        if (state.amend) return state.amend(p);
      },
      refreshAllPerpsData: async () => events.push(["refresh"]),
      switchTradeInstrument: async (p) =>
        events.push(["switch", JSON.parse(JSON.stringify(p))]),
    },
  };
  const common = {
    ...React,
    ...components,
    ...utils,
    ...utility,
    ...number,
    ...dates,
    ...scoped,
    ...twap,
    BigNumber,
    intl,
    useIntl: () => intl,
    ETranslations,
    useHyperliquidActions: () => actions,
    PERP_TEXT_ACTION_HOVER_STYLE: {},
    useSpotPairDisplayMapAtom: () => [{ "@1": "BTC" }],
    useSpotPairDisplayNameMapAtom: () => [{ "@1": "BTC/USDC" }],
    ListItem: host("ListItem"),
    getColumnStyle: (c) => ({ columnKey: c.key }),
    calcCellAlign: () => "left",
    PERP_DESKTOP_TABLE_ROW_PADDING_LEFT: 16,
    PERP_DESKTOP_TABLE_ROW_PADDING_RIGHT: 16,
    PerpTestIDs: evaluateSource("packages/kit/src/views/Perp/testIDs.ts")
      .PerpTestIDs,
  };
  const { OpenOrdersRow } = evaluateSource(
    panel + "Components/OpenOrdersRow.tsx",
    {
      names: [
        "balanceFormatter",
        "balanceCurrencyFormatter",
        "priceFormatter",
        "OpenOrdersRow",
      ],
      globals: common,
    },
  );
  const Table = (props) =>
    React.createElement(
      "Table",
      props,
      props.data
        .slice(
          (props.currentListPage - 1) * props.pageSize,
          props.currentListPage * props.pageSize,
        )
        .map((item, index) =>
          React.createElement(
            "OrderRow",
            { key: item.order.oid, oid: item.order.oid },
            props.renderRow(item, index),
          ),
        ),
    );
  const visibility = evaluateSource(
    panel + "List/mobileOpenOrdersVisibility.ts",
  );
  const { PerpOpenOrdersList } = evaluateSource(
    panel + "List/PerpOpenOrdersList.tsx",
    {
      names: ["useOpenOrdersColumnsConfig", "PerpOpenOrdersList"],
      globals: {
        ...common,
        ...visibility,
        usePerpsActiveOpenOrdersAtom: () => [
          { accountAddress: state.dataAccount, openOrders: state.orders },
        ],
        useSpotActiveOpenOrdersAtom: () => [
          { accountAddress: state.spotAccount, openOrders: state.spotOrders },
        ],
        usePerpsActiveTwapOrdersAtom: () => [
          { accountAddress: state.dataAccount, twapOrders: [] },
        ],
        usePerpsActiveAccountAtom: () => [{ accountAddress: state.account }],
        usePerpsCustomSettingsAtom: () => [{ skipOrderConfirm: false }],
        usePerpsAccountScopedCacheAddress: useScopedCacheAddress,
        useOrderFilterByCurrentTokenAtom: () => [state.filterCurrent],
        useActiveTradeInstrumentAtom: () => [state.instrument],
        useEnsureTradingEnabled:
          patch.useEnsureTradingEnabled ??
          (() => async () => {
            if (!chase) unexpected();
            activity.enabled++;
            if (state.ensure) return state.ensure();
          }),
        useChasingOrderTask,
        usePerpsAccountScopedActiveTwapOrders: () => ({
          twapOrders: [],
          activeRuntimeInfoById: new Map(),
        }),
        platformEnv: { isNative: false, isRuntimeBrowser: true },
        CommonTableListView: Table,
        OpenOrdersRow,
        showCancelAllOrdersDialog: unexpected,
        showChaseOrderConfirmDialog: (v) => {
          if (!chase) unexpected();
          activity.dialogs.push(v);
        },
        Error,
        OneKeyLocalError: Error,
        backgroundApiProxy: {
          serviceHyperliquid: {
            getSymbolMeta: async () => {
              if (!chase) unexpected();
              return { isSpot: false, universe: { szDecimals: 5 } };
            },
            fetchL2BookByCoin: async (p) => {
              if (!chase) unexpected();
              activity.books.push(JSON.parse(JSON.stringify(p)));
              if (state.bookRequest) return state.bookRequest();
              return state.book;
            },
          },
        },
        Toast: {
          message: unexpected,
          error: (v) => {
            if (!chase) unexpected();
            activity.errors.push(JSON.parse(JSON.stringify(v)));
          },
        },
      },
    },
  );
  let tree;
  const render = () =>
    renderer.act(async () => {
      if (tree)
        tree.update(
          React.createElement(PerpOpenOrdersList, {
            isMobile: false,
            isPanelActive: true,
          }),
        );
      else
        tree = renderer.create(
          React.createElement(PerpOpenOrdersList, {
            isMobile: false,
            isPanelActive: true,
          }),
        );
    });
  await render();
  const texts = (node) =>
    node
      .findAllByType("SizableText")
      .map((n) => n.children.filter((v) => typeof v === "string").join(""));
  return {
    state,
    events,
    activity,
    chaseButton(oid) {
      return tree.root.findAll(
        (n) =>
          typeof n.type === "string" &&
          n.props.testID === common.PerpTestIDs.ChaseOrderButton(oid),
      )[0];
    },
    tick: (fn = () => {}) =>
      renderer.act(async () => {
        await fn();
      }),
    table: () => tree.root.findByType("Table").props,
    rows: () => tree.root.findAllByType("OrderRow"),
    cells(oid) {
      const row = tree.root
        .findAllByType("OrderRow")
        .find((n) => n.props.oid === oid);
      if (!row) throw Error("Missing order " + oid);
      return Object.fromEntries(
        row
          .findAll((n) => typeof n.type === "string" && n.props.columnKey)
          .map((n) => [n.props.columnKey, texts(n).join(" / ")]),
      );
    },
    async switchAsset(oid) {
      const row = tree.root
        .findAllByType("OrderRow")
        .find((n) => n.props.oid === oid);
      const coin = row
        .findAllByType("SizableText")
        .find((n) => n.props.onPress);
      await renderer.act(async () => coin.props.onPress());
    },
    async update(next) {
      Object.assign(state, next);
      await render();
    },
    async page(n) {
      await renderer.act(async () =>
        tree.root.findByType("Table").props.setCurrentListPage(n),
      );
    },
    close: () => renderer.act(async () => tree.unmount()),
  };
}
