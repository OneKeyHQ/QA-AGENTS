// Actual complete selector content + actual search hook/action/alias matcher,
// category transforms and active-tab validation. UI primitives, list viewport,
// quotes, published RPC replies and atoms are local boundaries. No admin writes.
import {
  React,
  renderer,
  evaluateSource,
  evaluateText,
  readSource,
  ts,
  appRequire,
  perpsUtils,
} from "./source.mjs";
import { sourceClass } from "./twap-flow-fixture.mjs";
const base = "packages/kit/src/views/Perp/";
const host =
  (name) =>
  ({ children, ...props }) =>
    React.createElement(name, props, children);
export async function selectorCompleteFixture(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const state = {
    universes: [
      [
        { name: "BTC", assetId: 0, maxLeverage: 20 },
        { name: "ETH", assetId: 1, maxLeverage: 20 },
      ],
      [
        { name: "xyz:GOLD", assetId: 110000, maxLeverage: 10 },
        { name: "xyz:NVDA", assetId: 110001, maxLeverage: 10 },
      ],
    ],
    aliases: {
      BTC: { subtitle: "比特币", aliases: ["比特币", "bitcoin"] },
      "xyz:GOLD": { subtitle: "黄金", aliases: ["黄金", "gold"] },
    },
    tabs: [
      { tabId: "stocks", name: "股票", tokens: ["xyz:NVDA"] },
      { tabId: "metals", name: "贵金属", tokens: ["xyz:GOLD"] },
    ],
    config: { activeTab: "perps" },
    filtered: { assetsByDex: [], query: "" },
    aliasAtom: {},
    contexts: [],
    favorites: [],
    spotFavorites: [],
    sequence: { sequence: [] },
    spotCaps: {},
    locale: "zh_CN",
    ...patch,
  };
  const clock = appRequire("@sinonjs/fake-timers").createClock(1800000000000);
  const listeners = new Set();
  let version = 0,
    tree,
    search;
  const notify = () => {
    version++;
    for (const fn of listeners) fn();
  };
  const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
  const atom = (key) => () => {
    React.useSyncExternalStore(subscribe, () => version);
    return [
      state[key],
      (next) => {
        state[key] = typeof next === "function" ? next(state[key]) : next;
        notify();
      },
    ];
  };
  const events = {
    requests: [],
    switches: [],
    routes: [],
    closed: 0,
    required: 0,
    errors: [],
  };
  const utils = perpsUtils();
  const Action = sourceClass(
    "packages/kit/src/states/jotai/contexts/hyperliquid/actions.ts",
    ["updateAllAssetsFiltered"],
    {
      contextAtomMethod: (fn) => (data) =>
        fn(
          (key) => state[key],
          (key, val) => {
            state[key] = val;
            notify();
          },
          data,
        ),
      findTokensByAlias: utils.findTokensByAlias,
      perpsTokenSearchAliasesAtom: () => "aliasAtom",
      perpsAllAssetsFilteredAtom: () => "filtered",
    },
  );
  const actions = {
    current: Object.assign(new Action(), {
      setTradeRouteViewState: (p) => events.routes.push(p),
      markAllAssetCtxsRequired: () => events.required++,
      markAllAssetCtxsNotRequired: () => events.required--,
      switchTradeInstrument: async (p) => events.switches.push(p),
    }),
  };
  const background = {
    serviceHyperliquid: {
      getTradingUniverse: async () => {
        events.requests.push("universe");
        return { universesByDex: state.universes };
      },
      getTokenSearchAliases: async () => {
        events.requests.push("aliases");
        return state.aliases;
      },
      refreshTradingMeta: async () => {
        events.requests.push("refresh");
      },
      getSpotMeta: async () => ({ universes: [] }),
      refreshSpotMeta: async () => {},
    },
  };
  const locale = evaluateSource(
    "packages/shared/src/locale/enum/translations.ts",
  );
  const intl = appRequire("react-intl").createIntl({
    locale: state.locale.replace("_", "-"),
    messages: JSON.parse(
      readSource("packages/shared/src/locale/json/" + state.locale + ".json"),
    ),
    onError: (e) => {
      throw e;
    },
  });
  const logger = {
    perp: {
      tokenSelector: new Proxy({}, { get: () => () => {} }),
      hyperliquid: {
        coldStartInitializationError: (e) => events.errors.push(e),
      },
    },
    app: { error: { log: (e) => events.errors.push(e) } },
  };
  const context = { useHyperliquidActions: () => actions };
  const sharedAtoms = {
    usePerpsActiveAccountAtom: () => [{ walletType: "hd" }],
    usePerpTokenSelectorConfigPersistAtom: atom("config"),
  };
  const contextAtoms = {
    usePerpsAllAssetsFilteredAtom: atom("filtered"),
    usePerpsAllAssetCtxsAtom: () => [{ assetCtxsByDex: state.contexts }],
    usePerpsTokenSearchAliasesAtom: atom("aliasAtom"),
  };
  const constants = evaluateSource(
    "packages/shared/types/hyperliquid/perp.constants.ts",
  );
  const globals = {
    Date: clock.Date,
    setTimeout: clock.setTimeout.bind(clock),
    clearTimeout: clock.clearTimeout.bind(clock),
  };
  const { usePerpTokenSelector } = evaluateSource(
    base + "hooks/usePerpTokenSelector.ts",
    {
      globals,
      mocks: {
        lodash: appRequire("lodash"),
        "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid": context,
        "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms":
          contextAtoms,
        "@onekeyhq/kit-bg/src/states/jotai/atoms": sharedAtoms,
        "@onekeyhq/shared/src/logger/logger": { defaultLogger: logger },
        "@onekeyhq/shared/src/utils/timerUtils": {
          getTimeDurationMs: () => 300000,
        },
        "@onekeyhq/shared/types/hyperliquid/perp.constants": constants,
        "../../../background/instance/backgroundApiProxy": background,
      },
    },
  );
  const tabs = evaluateSource(base + "utils/tokenSelectorTabs.ts", {
    mocks: {
      "@onekeyhq/shared/src/utils/perpsUtils": utils,
      "@onekeyhq/shared/types/hyperliquid/perp.constants": constants,
    },
  });
  const dex = evaluateSource("packages/shared/src/utils/perpsDexUtils.ts", {
    mocks: { "../../types/hyperliquid/perp.constants": constants },
  });
  const favorites = evaluateSource(
    "packages/shared/src/utils/perpsTokenSelectorFavorites.ts",
  );
  const favoriteItems = evaluateSource(
    base + "utils/tokenSelectorFavorites.ts",
    {
      mocks: {
        "@onekeyhq/shared/src/utils/perpsDexUtils": dex,
        "@onekeyhq/shared/src/utils/perpsTokenSelectorFavorites": favorites,
        "@onekeyhq/shared/src/utils/perpsUtils": utils,
      },
    },
  );
  const validation = evaluateSource(
    base + "hooks/usePerpActiveTabValidation.ts",
    { mocks: { "../utils/tokenSelectorTabs": tabs } },
  );
  const comps = Object.fromEntries(
    [
      "Badge",
      "DebugRenderTracker",
      "Icon",
      "NumberSizeableText",
      "ScrollView",
      "SearchBar",
      "SizableText",
      "Spinner",
      "Tooltip",
      "XStack",
      "YStack",
    ].map((n) => [n, host(n)]),
  );
  comps.Badge.Text = host("BadgeText");
  comps.ListView = React.forwardRef(
    ({ data, renderItem, ListEmptyComponent, ...p }, ref) => {
      React.useImperativeHandle(ref, () => ({ scrollToOffset: () => {} }));
      return React.createElement(
        "ListView",
        { ...p, data },
        data.length
          ? data.map((item, index) =>
              React.createElement(
                React.Fragment,
                { key: item.tokenName ?? index },
                renderItem({ item, index }),
              ),
            )
          : ListEmptyComponent,
      );
    },
  );
  const file = base + "components/TokenSelector/PerpTokenSelector.tsx",
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
      .join("\n") + "\nexport {BasePerpTokenSelectorContent};";
  const actual = evaluateText(file, code, {
    globals: {
      ...React,
      ...comps,
      ...utils,
      ...tabs,
      ...favoriteItems,
      ...favorites,
      ...dex,
      ...constants,
      ...locale,
      ...context,
      ...contextAtoms,
      ...validation,
      ...evaluateSource(
        base + "components/TokenSelector/PerpTokenSelectorRow.tsx",
        {
          names: [
            "MIXED_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT",
            "SPOT_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT",
          ],
        },
      ),
      ...globals,
      useIntl: () => intl,
      platformEnv: { isNative: false, isNativeIOS: false },
      defaultLogger: logger,
      backgroundApiProxy: background,
      ...sharedAtoms,
      usePerpTokenSelector: () => {
        search = usePerpTokenSelector();
        return search;
      },
      usePerpTokenSelectorTabsAtom: atom("tabs"),
      useSpotExternalMarketCapsAtom: atom("spotCaps"),
      usePerpTokenFavoritesPersistAtom: atom("favorites"),
      useSpotTokenFavoritesPersistAtom: atom("spotFavorites"),
      usePerpsFavoritesOrderPersistAtom: atom("sequence"),
      spotAssetCtxsMapAtom: { get: async () => ({}), sub: () => () => {} },
      usePerpsFavorites: () => ({ favoriteItems: [], isReady: true }),
      usePopoverContext: () => ({ closePopover: () => events.closed++ }),
      PerpTestIDs: evaluateSource(base + "testIDs.ts").PerpTestIDs,
      shortcutsKeys: { CmdOrCtrl: "⌘" },
      ...evaluateSource("packages/shared/src/utils/imeUtils.ts"),
      prewarmPerpsTokenSelectorImages: async () => {},
      startTokenSelectorPerfMeasure: () => undefined,
      markTokenSelectorPerfMeasure: () => {},
      SortableHeaderCell: host("HeaderCell"),
      FavoritesEmptyState: host("FavoritesEmpty"),
      PerpTokenSelectorRow: ({ mockedToken, ...p }) =>
        React.createElement(
          "TokenRow",
          { ...p, ...mockedToken },
          mockedToken.tokenName,
        ),
    },
  });
  const mount = () =>
    renderer.act(async () => {
      tree = renderer.create(
        React.createElement(actual.BasePerpTokenSelectorContent),
      );
    });
  await mount();
  const roots = () => tree.root;
  return {
    state,
    events,
    root: roots,
    clock,
    names: () =>
      roots()
        .findAllByType("TokenRow")
        .map((n) => n.props.tokenName),
    categories: () =>
      roots()
        .findAll((n) => n.type?.displayName === "CategoryTabItem")
        .map((n) => ({
          id: n.props.id,
          name: n.props.name,
          selected: n.props.isFocused,
        })),
    async tab(id) {
      const n = roots().findAll(
        (n) => n.type?.displayName === "CategoryTabItem" && n.props.id === id,
      )[0];
      if (!n) throw Error("Missing actual category " + id);
      await renderer.act(async () => n.props.onPress(id));
    },
    async query(q) {
      await renderer.act(async () => {
        const bar = roots().findAllByType("SearchBar")[0];
        bar.props.onChange({ nativeEvent: { text: q } });
        bar.props.onChangeText(q);
      });
    },
    async update(next) {
      Object.assign(state, next);
      await renderer.act(async () => notify());
    },
    async refresh(next) {
      Object.assign(state, next);
      await renderer.act(async () => {
        notify();
        await search.refreshAllAssets();
      });
    },
    async remount() {
      await renderer.act(async () => tree.unmount());
      await mount();
    },
    async close() {
      await renderer.act(async () => tree.unmount());
    },
  };
}
