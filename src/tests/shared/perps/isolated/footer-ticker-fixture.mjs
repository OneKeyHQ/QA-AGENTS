// Actual Desktop ticker/settings -> actual popular/favorites hooks -> actual
// marquee/item/formatters. Metadata, atoms, DOM metrics and frame clock are local.
// No TF pixels, backend subscriptions, real storage or external transport claimed.
import {
  React,
  renderer,
  evaluateSource,
  perpsUtils,
  readSource,
} from "./source.mjs";
import { promiseHookFixture } from "./promise-hook-fixture.mjs";
import { deferred } from "./funds-quote-fixture.mjs";
const root = "packages/kit/src/views/Perp/";
const host =
  (type) =>
  ({ children, ...props }) =>
    React.createElement(type, props, children);
export async function footerTickerFixture(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const constants = evaluateSource(
    "packages/shared/types/hyperliquid/perp.constants.ts",
  );
  const dex = evaluateSource("packages/shared/src/utils/perpsDexUtils.ts", {
    mocks: { "../../types/hyperliquid/perp.constants": constants },
  });
  const utils = perpsUtils(),
    favorites = evaluateSource(
      "packages/shared/src/utils/perpsTokenSelectorFavorites.ts",
    );
  const popular = evaluateSource(root + "utils/popularTickers.ts");
  const tabs = evaluateSource(root + "utils/tokenSelectorTabs.ts", {
    mocks: {
      "@onekeyhq/shared/types/hyperliquid/perp.constants": constants,
      "@onekeyhq/shared/src/utils/perpsUtils": utils,
    },
  });
  const locale = evaluateSource(
    "packages/shared/src/locale/enum/translations.ts",
  );
  const messages = JSON.parse(
    readSource("packages/shared/src/locale/json/zh_CN.json"),
  );
  const state = {
    mode: "perp",
    footer: { mode: "popular" },
    perp: { favorites: ["BTC", "ETH"] },
    spot: { favorites: ["@1", "@2"] },
    order: {
      sequence: [
        { mode: "perp", coinName: "ETH" },
        { mode: "spot", coinName: "@2" },
        { mode: "perp", coinName: "BTC" },
        { mode: "spot", coinName: "@1" },
      ],
    },
    universes: [
      [
        { name: "BTC", assetId: 0 },
        { name: "ETH", assetId: 1 },
      ],
      ...constants.SUB_DEX_LIST.map(() => []),
    ],
    spots: [
      {
        name: "@1",
        baseName: "UBTC",
        quoteName: "USDC",
        displayName: "BTC",
        assetId: 10001,
      },
      {
        name: "@2",
        baseName: "UBTC",
        quoteName: "USDH",
        displayName: "BTC",
        assetId: 10002,
      },
    ],
    all: {
      assetCtxsByDex: [
        [
          {
            markPx: "100",
            prevDayPx: "80",
            dayNtlVlm: "100000",
            openInterest: "10",
          },
          {
            markPx: "50",
            prevDayPx: "100",
            dayNtlVlm: "20000",
            openInterest: "20",
          },
        ],
      ],
    },
    prices: {
      "@1": { markPx: "120", prevDayPx: "100", dayNtlVlm: "200000" },
      "@2": { markPx: "60", prevDayPx: "100", dayNtlVlm: "100000" },
    },
    perpActive: null,
    spotActive: null,
    marketCaps: {},
    dynamicTabs: [],
    containerWidth: 400,
    contentWidth: 200,
    reducedMotion: false,
    ...patch,
  };
  const events = {
      subscriptions: [],
      switches: [],
      commits: [],
      settings: [],
      observers: [],
    },
    frames = new Map();
  let nextFrame = 0,
    tree,
    notify = () => {},
    pendingMeta;
  const ph = promiseHookFixture(state);
  let revision = 0;
  const listeners = new Set();
  const read = (fn) => {
    React.useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => revision,
    );
    return [fn()];
  };
  notify = () => {
    revision++;
    for (const listener of [...listeners]) listener();
  };
  const hooks = {
    usePerpTokenFavoritesPersistAtom: () => read(() => state.perp),
    useSpotTokenFavoritesPersistAtom: () => read(() => state.spot),
    usePerpsFavoritesOrderPersistAtom: () => read(() => state.order),
    useSpotAssetCtxsMapAtom: () => read(() => state.prices),
    useSpotExternalMarketCapsAtom: () => read(() => state.marketCaps),
    usePerpTokenSelectorTabsAtom: () => read(() => state.dynamicTabs),
    usePerpsActiveAssetCtxAtom: () => read(() => state.perpActive),
    useSpotActiveAssetCtxAtom: () => read(() => state.spotActive),
    usePerpsFooterTickerModePersistAtom: () => [
      read(() => state.footer)[0],
      (v) => {
        state.footer = v;
        events.settings.push(v.mode);
        notify();
      },
    ],
  };
  const context = {
    useActiveTradeInstrumentAtom: () => read(() => ({ mode: state.mode })),
    usePerpsAllAssetCtxsAtom: () => read(() => state.all),
  };
  const actions = {
    current: {
      markAllAssetCtxsRequired: () => events.subscriptions.push("on"),
      markAllAssetCtxsNotRequired: () => events.subscriptions.push("off"),
      switchTradeInstrument: (v) => {
        events.switches.push(v);
        state.mode = v.mode;
        notify();
      },
    },
  };
  const background = {
    serviceHyperliquid: {
      getTradingUniverse: async () => {
        if (pendingMeta) await pendingMeta.promise;
        return { universesByDex: state.universes };
      },
      getSpotMeta: async () => {
        if (pendingMeta) await pendingMeta.promise;
        return { universes: state.spots };
      },
      refreshTradingMeta: async () => {},
      refreshSpotMeta: async () => {},
    },
  };
  const mocks = {
    "@onekeyhq/kit/src/background/instance/backgroundApiProxy": background,
    "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid": context,
    "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms": context,
    "@onekeyhq/kit-bg/src/states/jotai/atoms": hooks,
    "@onekeyhq/shared/src/utils/perpsDexUtils": dex,
    "@onekeyhq/shared/src/utils/perpsUtils": utils,
    "../../../hooks/usePromiseResult": ph,
    "../utils/tokenSelectorFavorites": favorites,
    "../utils/popularTickers": popular,
    "../utils/tokenSelectorTabs": tabs,
  };
  const { usePerpsFavorites } = evaluateSource(
    root + "hooks/usePerpsFavorites.ts",
    { globals: ph.globals, mocks },
  );
  const { usePopularTickers } = evaluateSource(
    root + "hooks/usePopularTickers.ts",
    { globals: ph.globals, mocks },
  );
  const display = evaluateSource(
    root + "components/FooterTicker/footerTickerUtils.ts",
    { mocks: { "@onekeyhq/shared/src/utils/perpsUtils": utils } },
  );
  const widths = evaluateSource(
    root + "components/FavoritesBar/FavoriteTokenItem.tsx",
    {
      names: ["TABULAR_NUMS_STYLE", "getStablePriceMinWidth"],
      globals: { platformEnv: { isNative: false }, ...constants },
    },
  );
  const { FooterTickerItem } = evaluateSource(
    root + "components/FooterTicker/FooterTickerItem.web.tsx",
    {
      mocks: {
        "@onekeyhq/components": { SizableText: host("Text") },
        "../FavoritesBar/FavoriteTokenItem": widths,
        "./footerTickerUtils": display,
      },
    },
  );
  const components = {
    XStack: host("XStack"),
    YStack: host("YStack"),
    SizableText: host("Text"),
    Icon: host("Icon"),
    Popover: ({ renderContent, renderTrigger, ...props }) =>
      React.createElement(
        "Popover",
        props,
        renderTrigger,
        renderContent({ closePopover: () => events.settings.push("closed") }),
      ),
  };
  const { FooterTickerSettings } = evaluateSource(
    root + "components/FooterTicker/FooterTickerSettings.tsx",
    {
      mocks: {
        "react-intl": {
          useIntl: () => ({ formatMessage: ({ id }) => messages[id] }),
        },
        "@onekeyhq/components": components,
        "@onekeyhq/kit/src/components/ListItem": { ListItem: host("ListItem") },
        "@onekeyhq/kit-bg/src/states/jotai/atoms": hooks,
        "@onekeyhq/shared/src/locale": locale,
      },
    },
  );
  const media = {
    matches: state.reducedMotion,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const { FooterTickerMarquee } = evaluateSource(
    root + "components/FooterTicker/FooterTickerMarquee.web.tsx",
    {
      globals: {
        requestAnimationFrame: (fn) => {
          frames.set(++nextFrame, fn);
          return nextFrame;
        },
        cancelAnimationFrame: (id) => frames.delete(id),
        matchMedia: () => media,
        ResizeObserver: class {
          constructor(fn) {
            this.fn = fn;
          }
          observe() {
            events.observers.push(this);
          }
          disconnect() {
            events.observers = events.observers.filter((o) => o !== this);
          }
        },
      },
      mocks: {
        "@onekeyhq/components": components,
        "./FooterTickerItem.web": { FooterTickerItem },
        "./footerTickerUtils": display,
      },
    },
  );
  const { PerpFooterTicker } = evaluateSource(
    root + "components/FooterTicker/PerpFooterTicker.web.tsx",
    {
      mocks: {
        "@onekeyhq/components": components,
        "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid": {
          ...context,
          useHyperliquidActions: () => actions,
        },
        "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms": context,
        "@onekeyhq/kit-bg/src/states/jotai/atoms": hooks,
        "@onekeyhq/shared/src/utils/perpsDexUtils": dex,
        "@onekeyhq/shared/src/utils/perpsUtils": utils,
        "../../hooks/usePerpsFavorites": { usePerpsFavorites },
        "../../hooks/usePopularTickers": { usePopularTickers },
        "./FooterTickerMarquee.web": { FooterTickerMarquee },
        "./FooterTickerSettings": { FooterTickerSettings },
        "./footerTickerUtils": display,
      },
    },
  );
  function Root() {
    return React.createElement(
      React.Profiler,
      {
        id: "ticker",
        onRender: () => {
          if (tree) events.commits.push(rows());
        },
      },
      React.createElement(PerpFooterTicker),
    );
  }
  const rows = () =>
    tree.root
      .findAllByType("button")
      .map((n) => n.parent)
      .filter((n) => !n.props.isDuplicate)
      .map((n) => ({
        coin: n.props.coinName,
        mode: n.props.mode,
        name: n.props.displayName,
        text: n.findAllByType("Text").map((t) => t.children.join("")),
        colors: n.findAllByType("Text").map((t) => t.props.color),
        assetId: n.props.assetId,
      }));
  const mount = () =>
    renderer.act(async () => {
      tree = renderer.create(React.createElement(Root), {
        createNodeMock: (e) =>
          e.type === "XStack"
            ? {
                style: {},
                clientWidth: state.containerWidth,
                scrollWidth: state.contentWidth,
                getBoundingClientRect: () => ({ width: state.contentWidth }),
              }
            : null,
      });
    });
  await mount();
  return {
    state,
    events,
    frames,
    rows,
    get tree() {
      return tree;
    },
    async update(p) {
      Object.assign(state, p);
      await renderer.act(async () => notify());
    },
    async settle() {
      await renderer.act(async () => {
        await ph.clock.tickAsync(350);
      });
    },
    delayMetadata() {
      return (pendingMeta = deferred());
    },
    async releaseMetadata() {
      await renderer.act(async () => pendingMeta.resolve());
      pendingMeta = null;
    },
    async select(mode) {
      const index = ["none", "popular", "favorites"].indexOf(mode);
      await renderer.act(async () =>
        tree.root.findAllByType("ListItem")[index].props.onPress(),
      );
    },
    async click(index = 0, { duplicate = false } = {}) {
      const row = tree.root
        .findAllByType("button")
        .map((n) => n.parent)
        .filter((n) => Boolean(n.props.isDuplicate) === duplicate)[index];
      if (!row) throw Error("Ticker row unavailable");
      await renderer.act(async () => row.findByType("button").props.onClick());
    },
    async frame(time) {
      await renderer.act(async () => {
        const callbacks = [...frames.values()];
        frames.clear();
        callbacks.forEach((fn) => fn(time));
      });
    },
    async hover(value) {
      await renderer.act(async () => {
        const container = tree.root
          .findAllByType("XStack")
          .find((n) => n.props.onMouseEnter);
        container.props[value ? "onMouseEnter" : "onMouseLeave"]();
      });
    },
    async close() {
      await renderer.act(async () => tree.unmount());
    },
  };
}
