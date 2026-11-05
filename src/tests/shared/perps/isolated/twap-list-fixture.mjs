// Actual pinned TWAP list → CommonTableListView → PaginationFooter/Input and
// rows. Hosts replace layout/shadows only; atom/HTTP containers remain local.
// No production wallet, socket, network or exchange modules are imported.
import {
  React,
  renderer,
  evaluateSource,
  perpsUtils,
  BigNumber,
  appRequire,
  readSource,
} from "./source.mjs";
import { ETranslations, twap } from "./twap-source-fixture.mjs";
import { numberUtils } from "./number-format-source.mjs";
import { stateFixture } from "./twap-state-fixture.mjs";

const listFile =
  "packages/kit/src/views/Perp/components/OrderInfoPanel/List/PerpTwapList.tsx";
const tableFile =
  "packages/kit/src/views/Perp/components/OrderInfoPanel/List/CommonTableListView.tsx";
const utils = perpsUtils();
const host =
  (type) =>
  ({ children, ...props }) =>
    React.createElement(type, props, children);
const unexpected = () => {
  throw Error(
    "Trading/authorization callback is forbidden in the offline list fixture",
  );
};
const components = Object.fromEntries(
  [
    "Button",
    "IconButton",
    "Icon",
    "Input",
    "SizableText",
    "DashText",
    "XStack",
    "YStack",
    "Stack",
    "ScrollView",
    "PerpTableScrollView",
    "FixedColumnShadowOverlay",
    "Divider",
    "Popover",
    "ListItem",
    "DebugRenderTracker",
    "Spinner",
  ].map((name) => [name, host(name)]),
);
components.Tooltip = ({ renderTrigger }) => renderTrigger;
const localePackages = appRequire("date-fns/locale");
const layouts = {
  PERP_DESKTOP_ORDER_INFO_SUB_TABS_HEIGHT: 40,
  PERP_DESKTOP_TABLE_ROW_PADDING_LEFT: 16,
  PERP_DESKTOP_TABLE_ROW_PADDING_RIGHT: 16,
  PERP_DESKTOP_TABLE_ROW_HORIZONTAL_PADDING: 32,
  PERP_DESKTOP_EMPTY_STATE_TOP_INSET: 48,
};
const utility = evaluateSource(
  "packages/kit/src/views/Perp/components/OrderInfoPanel/utils.ts",
  {
    names: [
      "getOrderAssetDisplayName",
      "getOrderSizeDisplayName",
      "normalizeEpochMs",
      "getTwapHistoryEventTimeMs",
      "getPerpFillDirectionType",
      "getFillDirectionDisplayInfo",
    ],
    globals: { ...utils, ETranslations },
  },
);
const scoped = evaluateSource(
  "packages/kit/src/views/Perp/utils/accountScopedData.ts",
  { mocks: { "@onekeyhq/shared/src/utils/perpsUtils": utils } },
);
const dicts = Object.fromEntries(
  ["zh_CN", "en_US"].map((locale) => [
    locale,
    JSON.parse(readSource(`packages/shared/src/locale/json/${locale}.json`)),
  ]),
);
export async function twapListFixture(options = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const f = options.store ?? stateFixture(),
    events = { viewAll: 0, switches: [] },
    actions = {
      current: new Proxy(f.actions, {
        get(target, key, receiver) {
          if (key === "switchTradeInstrument")
            return async ({ coin }) => events.switches.push(coin);
          if (key === "cancelTwapOrder") return unexpected;
          return Reflect.get(target, key, receiver);
        },
      }),
    };
  // Local atom notification adapter: source actions replace these store fields.
  // React must see those writes just as it sees Jotai notifications in the app.
  const listeners = new Set();
  let version = 0;
  const observed = ["active", "orders", "history", "fills"];
  for (const key of observed) {
    let value = f.state[key];
    Object.defineProperty(f.state, key, {
      configurable: true,
      enumerable: true,
      get: () => value,
      set: (next) => {
        value = next;
        version++;
        for (const notify of listeners) notify();
      },
    });
  }
  const subscribe = (notify) => {
    listeners.add(notify);
    return () => listeners.delete(notify);
  };
  const state = {
    locale: "zh_CN",
    now: new Date(2026, 9, 30, 8, 0, 0).getTime(),
    ...options.state,
  };
  let intl, tree;
  const formatters = {
    zh_CN: numberUtils("zh-CN"),
    en_US: numberUtils("en-US"),
  };
  const localizedNumbers = Object.fromEntries(
    Object.keys(formatters.zh_CN).map((key) => [
      key,
      (...args) => formatters[state.locale][key](...args),
    ]),
  );
  const createIntl = () => {
    intl = appRequire("react-intl").createIntl({
      locale: state.locale === "en_US" ? "en" : "zh-CN",
      messages: dicts[state.locale],
      onError: (error) => {
        throw error;
      },
    });
  };
  createIntl();
  class Clock extends Date {
    static now() {
      return state.now;
    }
  }
  const timers = new Map();
  let timerId = 0;
  const date = evaluateSource("packages/shared/src/utils/dateUtils.ts", {
    names: [
      "DATE_FORMAT_TEMPLATES",
      "timeZoneFormatters",
      "parseToDateFnsLocale",
      "getDateFormatTemplate",
      "omitDateFormatFields",
      "formatDateTimeParts",
      "getDateTimeParts",
      "getDateTimePartsInTimeZone",
      "formatDateFns",
      "formatDate",
      "formatTime",
    ],
    globals: {
      Date: Clock,
      appLocale: {
        getLocale: () => (state.locale === "en_US" ? "en-US" : "zh-CN"),
      },
      getDefaultLocale: () => "zh-CN",
      DateLocaleMap: {
        "zh-CN": localePackages.zhCN,
        "en-US": localePackages.enUS,
      },
      OneKeyLocalError: Error,
      fnsFormat: appRequire("date-fns").format,
      parseISO: appRequire("date-fns").parseISO,
      formatInTimeZone: unexpected,
    },
  });
  const { CommonTableListView } = evaluateSource(tableFile, {
    names: [
      "InputWithAccessoryDoneView",
      "PaginationFooter",
      "CommonTableListView",
    ],
    globals: {
      ...React,
      ...components,
      ...layouts,
      Tabs: { FlatList: host("MobileListNotRendered") },
      ListView: host("MobileListNotRendered"),
      useIntl: () => intl,
      ETranslations,
      platformEnv: {
        isNative: false,
        isNativeIOS: false,
        isNativeAndroid: false,
      },
      useThemeVariant: () => "light",
      useMedia: () => ({ md: false, gtMd: true }),
      useFixedColumnShadow: () => ({
        showShadow: false,
        scrollViewRef: React.useRef(null),
        handleNativeScroll: () => {},
        handleWebScroll: () => {},
        shadowTransitionEnabled: false,
      }),
      getColumnStyle: () => ({}),
      calcCellAlign: () => "left",
      getPerpDesktopTableFixedSectionWidth: (value) => value,
      getWebShadowStyle: () => ({}),
      getWebClipPath: () => undefined,
      SHADOW_CONSTANTS: { TRANSITION_DURATION: "0ms" },
      HTMLElement: class LayoutElement {},
      PerpDesktopEmptyState: host("Empty"),
    },
  });
  const { OrderInfoSubTabs } = evaluateSource(
    "packages/kit/src/views/Perp/components/OrderInfoPanel/Components/OrderInfoSubTabs.tsx",
    {
      names: ["OrderInfoSubTabs"],
      globals: { ...components, ...layouts },
    },
  );
  const { usePerpsAccountScopedActiveTwapOrders } = evaluateSource(
    "packages/kit/src/views/Perp/hooks/usePerpsAccountScopedActiveTwapOrders.ts",
    {
      mocks: {
        "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms": {
          usePerpsActiveTwapOrdersAtom: () => [f.state.orders],
          usePerpsTwapHistoryAtom: () => [f.state.history],
        },
        "@onekeyhq/shared/src/utils/hyperliquidTwapUtils": twap,
        "../utils/accountScopedData": scoped,
      },
    },
  );
  const list = evaluateSource(listFile, {
    names: [
      "TWAP_PAGE_SIZE",
      "TWAP_TABLE_ROW_MIN_HEIGHT",
      "balanceFormatter",
      "valueFormatter",
      "TWAP_ORDERS_SUB_TABS",
      "TWAP_EMPTY_STATE_MAP",
      "formatTwapDateTime",
      "formatElapsedDuration",
      "formatTotalDuration",
      "TWAP_HISTORY_STATUS_TEXT_MAP",
      "humanizeTwapHistoryStatus",
      "getTwapHistoryStatusText",
      "getTableRowBgColor",
      "getTwapSideInfo",
      "getTwapBaseInfo",
      "getFillKey",
      "sortTwapSliceFills",
      "getFillDirectionInfo",
      "TwapEmptyState",
      "TwapActiveRow",
      "TwapHistoryRow",
      "TwapFillRow",
      "PerpTwapList",
    ],
    globals: {
      ...React,
      ...components,
      ...layouts,
      ...utils,
      ...twap,
      ...utility,
      ...date,
      ...localizedNumbers,
      BigNumber,
      Date: Clock,
      ETranslations,
      useIntl: () => intl,
      useMedia: () => ({ gtMd: true }),
      useHyperliquidActions: () => actions,
      useEnsureTradingEnabled: () => unexpected,
      usePerpsTwapSliceFillsAtom: () => [f.state.fills],
      usePerpsActiveAccountAtom: () => [{ accountAddress: f.state.active }],
      useSpotPairDisplayMapAtom: () => [{}],
      useSpotPairDisplayNameMapAtom: () => [{}],
      usePerpsAccountScopedActiveTwapOrders,
      usePerpTwapHistoryViewAllUrl: () => ({
        onViewAllUrl: () => events.viewAll++,
      }),
      backgroundApiProxy: {
        simpleDb: { perp: { getExpectMaxBuilderFee: async () => 0 } },
      },
      OrderInfoSubTabs,
      CommonTableListView,
      getColumnStyle: () => ({}),
      calcCellAlign: () => "left",
      PERP_TEXT_ACTION_HOVER_STYLE: {},
      PerpDesktopEmptyState: host("Empty"),
      Toast: { message: unexpected, error: unexpected },
      setInterval: (callback) => {
        const id = ++timerId;
        timers.set(id, callback);
        return id;
      },
      clearInterval: (id) => timers.delete(id),
    },
  });
  const { TabBarItem } = evaluateSource(
    "packages/kit/src/views/Perp/components/OrderInfoPanel/PerpOrderInfoPanel.tsx",
    {
      names: ["tabNameToTranslationKey", "TabBarItem"],
      globals: {
        ...React,
        ...components,
        ETranslations,
        useIntl: () => intl,
        usePerpsActiveOpenOrdersAtom: () => [
          { accountAddress: f.state.active, openOrders: [] },
        ],
        useSpotActiveOpenOrdersAtom: () => [
          { accountAddress: f.state.active, openOrders: [] },
        ],
        usePerpsActivePositionAtom: () => [
          { accountAddress: f.state.active, activePositions: [] },
        ],
        usePerpsAccountScopedCacheAddress: () => f.state.active,
        usePerpsAccountScopedActiveTwapOrders,
        ...scoped,
        ...utils,
        DesktopHoldingsTabCount: unexpected,
      },
    },
  );
  function Screen(props) {
    React.useSyncExternalStore(
      subscribe,
      () => version,
      () => version,
    );
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(TabBarItem, {
        name: "TWAP",
        isFocused: true,
        onPress: () => {},
      }),
      React.createElement(list.PerpTwapList, props),
    );
  }
  const props = {
    isMobile: false,
    initialTab: options.initialTab ?? "active",
    onSwitchInstrument: (coin) => events.switches.push(coin),
  };
  await renderer.act(async () => {
    tree = renderer.create(React.createElement(Screen, props));
  });
  const render = () =>
    renderer.act(async () =>
      tree.update(React.createElement(Screen, { ...props })),
    );
  const table = () => tree.root.findByType(CommonTableListView);
  const rows = () => {
    const tab = tree.root.findByType(OrderInfoSubTabs).props.activeTab;
    const type = {
      active: list.TwapActiveRow,
      history: list.TwapHistoryRow,
      fills: list.TwapFillRow,
    }[tab];
    return tree.root
      .findAllByType(type)
      .filter((n) => n.props.renderMode !== "right")
      .map((n) => {
        const p = n.props,
          record = p.order ?? p.record;
        const group = tree.root
          .findAllByType(type)
          .filter(
            (other) => (other.props.order ?? other.props.record) === record,
          );
        const cellValues = group.flatMap((other) => {
          const outer = other.findAllByType("XStack")[0];
          return outer.children
            .filter((v) => typeof v !== "string")
            .map((cell) => {
              const collect = (node) =>
                typeof node === "string"
                  ? node
                  : (node.children ?? []).map(collect).join("");
              return collect(cell);
            });
        });
        return {
          id: record.twapId,
          record,
          props: p,
          cellValues,
          texts: group.flatMap((other) =>
            other
              .findAllByType("SizableText")
              .map((t) =>
                t.children.filter((v) => typeof v === "string").join(""),
              ),
          ),
        };
      });
  };
  const oneInput = () =>
    tree.root
      .findAllByType("Input")
      .find(
        (n) => n.props.testID === "perp-input-with-accessory-done-view-input",
      );
  return {
    store: f,
    state,
    events,
    table,
    rows,
    mutate: (callback) => renderer.act(callback),
    root: () => tree.root,
    timerCount: () => timers.size,
    mainTitle: () =>
      tree.root
        .findByType(TabBarItem)
        .findAllByType("SizableText")
        .map((n) => n.children.join(""))
        .join(""),
    tabs: () => tree.root.findByType(OrderInfoSubTabs).props.tabs,
    selected: () => tree.root.findByType(OrderInfoSubTabs).props.activeTab,
    select: async (key) => {
      const tabs = tree.root.findByType(OrderInfoSubTabs),
        label = tabs.props.tabs.find((t) => t.key === key)?.label;
      if (!label) throw Error(`Missing actual TWAP subtab ${key}`);
      const target = tabs
        .findAllByType("YStack")
        .find(
          (n) =>
            typeof n.props.onPress === "function" &&
            n
              .findAllByType("SizableText")
              .some((t) => t.props.children === label),
        );
      if (!target) throw Error(`Actual subtab control missing ${key}`);
      await renderer.act(async () => target.props.onPress());
    },
    button: (direction) =>
      tree.root
        .findAllByType("IconButton")
        .find(
          (n) =>
            n.props.icon ===
            (direction === "next"
              ? "ChevronRightOutline"
              : "ChevronLeftOutline"),
        ),
    press: async (direction) => {
      const b = tree.root
        .findAllByType("IconButton")
        .find(
          (n) =>
            n.props.icon ===
            (direction === "next"
              ? "ChevronRightOutline"
              : "ChevronLeftOutline"),
        );
      if (!b || b.props.disabled)
        throw Error(`Pagination ${direction} unavailable`);
      await renderer.act(async () => b.props.onPress());
    },
    page: () => table().props.currentListPage,
    jump: async (value) => {
      if (!oneInput()) throw Error("Actual page input missing");
      await renderer.act(async () => oneInput().props.onChangeText(value));
      await renderer.act(async () => oneInput().props.onSubmitEditing());
    },
    refresh: async () => {
      await renderer.act(async () => {
        await table().props.onPullToRefresh();
      });
      await render();
    },
    update: async (patch) => {
      Object.assign(state, patch);
      createIntl();
      await render();
    },
    rerender: render,
    switchCoin: async (id) => {
      const type = {
        active: list.TwapActiveRow,
        history: list.TwapHistoryRow,
        fills: list.TwapFillRow,
      }[tree.root.findByType(OrderInfoSubTabs).props.activeTab];
      const row = tree.root
        .findAllByType(type)
        .find(
          (n) =>
            (n.props.order ?? n.props.record).twapId === id &&
            n.props.renderMode !== "right",
        );
      const entry = row
        ?.findAllByType("SizableText")
        .find((n) => typeof n.props.onPress === "function");
      if (!entry) throw Error("Actual coin navigation entry missing");
      await renderer.act(async () => entry.props.onPress());
    },
    tick: async (now) => {
      state.now = now;
      await renderer.act(async () => {
        for (const callback of timers.values()) callback();
      });
    },
    close: async () => {
      await renderer.act(async () => tree.unmount());
      for (const key of observed) {
        const value = f.state[key];
        Object.defineProperty(f.state, key, {
          configurable: true,
          enumerable: true,
          writable: true,
          value,
        });
      }
      listeners.clear();
    },
  };
}
