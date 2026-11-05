// Pinned FavoriteButton/EmptyState -> pinned background membership queue ->
// pinned favorites hook -> pinned Desktop bar. DnD, DOM and quotes are hosts;
// market sync is an independent local mirror, not proof of cloud sync.
import { React, renderer, evaluateSource } from "./source.mjs";
import { sourceClass } from "./twap-flow-fixture.mjs";
const host =
  (type) =>
  ({ children, ...props }) =>
    React.createElement(type, props, children);
export async function favoritesFlowFixture(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const constants = evaluateSource(
    "packages/shared/types/hyperliquid/perp.constants.ts",
  );
  const utils = evaluateSource(
    "packages/shared/src/utils/perpsTokenSelectorFavorites.ts",
  );
  const dex = evaluateSource("packages/shared/src/utils/perpsDexUtils.ts", {
    mocks: { "../../types/hyperliquid/perp.constants": constants },
  });
  const perps = evaluateSource("packages/shared/src/utils/perpsUtils.ts", {
    names: [
      "parseDexCoin",
      "formatSpotPairDisplayName",
      "getSpotTokenDisplayName",
      "SPOT_TOKEN_DISPLAY_MAP",
    ],
    globals: { DEX_SEPARATOR: constants.DEX_SEPARATOR },
  });
  const base = ["BTC", "ETH", "BNB", "SOL", "HYPE", "XRP"];
  const universes = [
    base.map((name, i) => ({ name, assetId: i, index: i, maxLeverage: 20 })),
    ...constants.SUB_DEX_LIST.map((d, i) => [
      { name: d.prefix + ":BTC", assetId: 100000 + i * 10000, maxLeverage: 20 },
    ]),
  ];
  const state = {
    universes,
    spots: [
      { name: "@1", baseName: "BTC", quoteName: "USDC", assetId: 10001 },
      { name: "@2", baseName: "ETH", quoteName: "USDH", assetId: 10002 },
    ],
    search: "",
    mode: "perp",
    showRecommendation: true,
    failSync: false,
    market: [],
    ...patch,
  };
  // Stable external-store getters/setters: no product membership logic here.
  const atom = (initial) => {
    let value = initial;
    const listeners = new Set();
    const getSnapshot = () => value;
    const subscribe = (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    };
    const write = (next) => {
      const result = typeof next === "function" ? next(value) : next;
      if (result !== value) {
        value = result;
        for (const fn of listeners) fn();
      }
    };
    return {
      get: async () => value,
      set: async (next) => write(next),
      read: getSnapshot,
      use: () => [React.useSyncExternalStore(subscribe, getSnapshot), write],
    };
  };
  const perp = atom({
      favorites: patch.perp ?? [],
      displayMode: patch.displayMode ?? "price",
    }),
    spot = atom({ favorites: patch.spot ?? [] }),
    order = atom({ sequence: patch.sequence ?? [] });
  const events = [],
    tasks = [];
  const atoms = {
    usePerpTokenFavoritesPersistAtom: perp.use,
    useSpotTokenFavoritesPersistAtom: spot.use,
    usePerpsFavoritesOrderPersistAtom: order.use,
  };
  const Service = sourceClass(
    "packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquid.ts",
    [
      "tokenSelectorFavoriteUpdateQueue",
      "updateTokenSelectorFavoriteInBg",
      "updateTokenSelectorFavorite",
    ],
    {
      ...utils,
      perpTokenFavoritesPersistAtom: perp,
      spotTokenFavoritesPersistAtom: spot,
      perpsFavoritesOrderPersistAtom: order,
    },
  );
  const service = new Service();
  service.backgroundApi = {
    serviceMarketV2: {
      syncToMarketWatchList: async ({ coin, action }) => {
        events.push(["market-sync", coin, action]);
        if (state.failSync) throw Error("local sync failed");
        state.market = utils.updateTokenSelectorFavoriteCoins({
          favorites: state.market,
          coin,
          action,
        }).favorites;
      },
    },
  };
  const background = {
    serviceHyperliquid: {
      updateTokenSelectorFavorite: (args) => {
        const task = service.updateTokenSelectorFavorite(args);
        tasks.push(task);
        return task;
      },
      getTradingUniverse: async () => ({ universesByDex: state.universes }),
      refreshTradingMeta: async () => events.push(["refresh-meta"]),
      getSpotMeta: async () => ({ universes: state.spots }),
      refreshSpotMeta: async () => events.push(["refresh-spot"]),
    },
  };
  const components = Object.fromEntries(
    [
      "Button",
      "Icon",
      "IconButton",
      "SizableText",
      "Stack",
      "XStack",
      "YStack",
    ].map((n) => [n, host(n)]),
  );
  function usePromiseResult(fn, deps) {
    const [result, set] = React.useState();
    React.useEffect(() => {
      let active = true;
      void fn().then((v) => {
        if (active) set(v);
      });
      return () => {
        active = false;
      };
    }, deps);
    return { result };
  }
  const usePerpsFavorites = evaluateSource(
    "packages/kit/src/views/Perp/hooks/usePerpsFavorites.ts",
    {
      mocks: {
        "@onekeyhq/kit/src/background/instance/backgroundApiProxy": background,
        "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid": {
          useActiveTradeInstrumentAtom: () => [{ mode: state.mode }],
        },
        "@onekeyhq/kit-bg/src/states/jotai/atoms": atoms,
        "@onekeyhq/shared/src/utils/perpsDexUtils": dex,
        "@onekeyhq/shared/src/utils/perpsUtils": perps,
        "../../../hooks/usePromiseResult": { usePromiseResult },
        "../utils/tokenSelectorFavorites": utils,
      },
    },
  ).usePerpsFavorites;
  const Button = evaluateSource(
    "packages/kit/src/views/Perp/components/TokenSelector/PerpTokenSelectorRow.tsx",
    {
      names: ["FavoriteButton"],
      globals: {
        ...React,
        ...atoms,
        ...utils,
        platformEnv: { isExtensionUi: false, isDesktop: true },
        IconButton: components.IconButton,
        backgroundApiProxy: background,
      },
    },
  ).FavoriteButton;
  const Empty = evaluateSource(
    "packages/kit/src/views/Perp/components/TokenSelector/FavoritesEmptyState.tsx",
    {
      mocks: {
        "react-intl": {
          useIntl: () => ({ formatMessage: () => "添加到自选" }),
        },
        "@onekeyhq/components": components,
        "@onekeyhq/kit/src/background/instance/backgroundApiProxy": background,
        "@onekeyhq/kit/src/components/Token": { Token: host("Token") },
        "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms": {
          usePerpsAllAssetsFilteredAtom: () => [
            { assetsByDex: state.universes },
          ],
        },
        "@onekeyhq/shared/src/locale": {
          ETranslations: { market_add_to_favorites: "market_add_to_favorites" },
        },
        "@onekeyhq/shared/src/utils/perpsUtils": {
          getHyperliquidTokenImageUrl: (s) => "local:" + s,
        },
      },
    },
  ).FavoritesEmptyState;
  const actions = {
    current: {
      markAllAssetCtxsRequired: () => events.push(["perp-on"]),
      markAllAssetCtxsNotRequired: () => events.push(["perp-off"]),
      setTradeRouteViewState: (s) =>
        events.push(["spot-subscription", s.favoritesBarSpotActive]),
      switchTradeInstrument: async (i) => {
        state.mode = i.mode;
        events.push(["select", i.mode, i.coin]);
      },
    },
  };
  const DragDropContext = ({ children, ...props }) =>
    React.createElement("DragDropContext", props, children);
  const Droppable = ({ children, ...props }) =>
    React.createElement(
      "Droppable",
      props,
      children({ innerRef: () => {}, droppableProps: {}, placeholder: null }),
    );
  const Draggable = ({ children, ...props }) =>
    React.createElement(
      "Draggable",
      props,
      children({ innerRef: () => {}, draggableProps: {}, dragHandleProps: {} }),
    );
  const { FavoritesBar } = evaluateSource(
    "packages/kit/src/views/Perp/components/FavoritesBar/FavoritesBar.web.tsx",
    {
      globals: {
        document: { body: {} },
        requestAnimationFrame: (fn) => {
          fn();
          return 1;
        },
      },
      mocks: {
        lodash: { noop: () => {} },
        "react-beautiful-dnd": { DragDropContext, Droppable, Draggable },
        "@onekeyhq/components": components,
        "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid": {
          useHyperliquidActions: () => actions,
        },
        "@onekeyhq/kit-bg/src/states/jotai/atoms": atoms,
        "../../hooks/usePerpsFavorites": { usePerpsFavorites },
        "../../utils/tokenSelectorFavorites": utils,
        "./FavoriteTokenItem": { FavoriteTokenItem: host("FavoriteTokenItem") },
      },
    },
  );
  let tree;
  function Membership() {
    const a = usePerpsFavorites({ mode: "perp" }),
      b = usePerpsFavorites({ mode: "spot" });
    return React.createElement("Membership", {
      perp: a.favoriteItems.map((x) => x.coinName),
      spot: b.favoriteItems.map((x) => x.coinName),
    });
  }
  function Root() {
    const [p] = perp.use();
    return React.createElement(
      React.Fragment,
      null,
      state.showRecommendation && !p.favorites.length
        ? React.createElement(Empty, { isMobile: false })
        : null,
      React.createElement(
        "perp-stars",
        null,
        ...base.map((coin) => React.createElement(Button, { key: coin, coin })),
      ),
      React.createElement(
        "spot-stars",
        null,
        ...state.spots.map((s) =>
          React.createElement(Button, {
            key: s.name,
            coin: s.name,
            isSpot: true,
          }),
        ),
      ),
      React.createElement(Membership),
      React.createElement(FavoritesBar),
    );
  }
  const node = {
    scrollLeft: 0,
    scrollWidth: 1000,
    clientWidth: 500,
    addEventListener: () => {},
    removeEventListener: () => {},
    scrollBy: (args) => events.push(["scroll", args.left]),
  };
  const render = () =>
    renderer.act(async () => {
      if (tree) tree.update(React.createElement(Root));
      else
        tree = renderer.create(React.createElement(Root), {
          createNodeMock: (e) => (e.type === "div" ? node : null),
        });
    });
  await render();
  const flush = () =>
    renderer.act(async () => {
      await Promise.all(tasks);
    });
  return {
    state,
    events,
    perp,
    spot,
    order,
    service,
    tree: () => tree,
    byType: (t) => tree.root.findAllByType(t),
    async update(patch) {
      Object.assign(state, patch);
      await render();
    },
    flush,
    async remount() {
      await renderer.act(async () => tree.unmount());
      tree = null;
      await render();
    },
    async star(coin, isSpot = false) {
      const parent = tree.root.findByType(isSpot ? "spot-stars" : "perp-stars");
      const button = parent.findAllByType("IconButton").find((n) => {
        for (let p = n.parent; p && p !== parent; p = p.parent)
          if (p.props.coin === coin) return true;
        return false;
      });
      await renderer.act(async () => button.props.onPress());
      await flush();
    },
    async close() {
      await renderer.act(async () => tree.unmount());
    },
  };
}
