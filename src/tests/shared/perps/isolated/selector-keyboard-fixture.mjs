// Actual Desktop picker callbacks and selection expressions; JSDOM is local.
// This does not mount the full picker, portal, SearchBar or browser shortcuts.
import {
  appRequire,
  evaluateSource,
  evaluateText,
  readSource,
  ts,
} from "./source.mjs";
import { scopedCallback } from "./scoped-callback.mjs";
const file =
  "packages/kit/src/views/Perp/components/TokenSelector/PerpTokenSelector.tsx";
const ast = ts.createSourceFile(
  file,
  readSource(file),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const owner = ast.statements.find(
  (n) =>
    ts.isFunctionDeclaration(n) &&
    n.name?.text === "BasePerpTokenSelectorContent",
);
const selectionNames = [
  "keyboardResultsReady",
  "selectionMatchesResults",
  "selectedKeyIndex",
  "keyboardSelectedIndex",
  "keyboardSelectedKey",
];
const declarations = new Map();
function walk(n) {
  if (ts.isVariableDeclaration(n) && selectionNames.includes(n.name?.text)) {
    if (declarations.has(n.name.text))
      throw Error("Duplicate selection expression");
    declarations.set(n.name.text, n.getText(ast));
  }
  ts.forEachChild(n, walk);
}
walk(owner);
if (declarations.size !== selectionNames.length)
  throw Error("Incomplete selection expressions");
const selectionCode =
  selectionNames.map((n) => `const ${declarations.get(n)};`).join("\n") +
  `\nexport {${selectionNames.join(",")}};`;
const { getTokenSelectorListItemKey } = evaluateSource(
  "packages/kit/src/views/Perp/utils/tokenSelectorFavorites.ts",
  { names: ["getTokenSelectorListItemKey"] },
);
const tabs = evaluateSource(
  "packages/kit/src/views/Perp/utils/tokenSelectorTabs.ts",
  { names: ["normalizeTabId", "isPerpTokenSelectorSpotTab"] },
);
const ime = evaluateSource("packages/shared/src/utils/imeUtils.ts", {
  names: ["IME_KEYCODE", "isImeComposingKeyboardEvent", "getKeyboardEventKey"],
});
const favorites = evaluateSource(
  "packages/shared/src/utils/perpsTokenSelectorFavorites.ts",
);
export const keyboardPerp = (name, index = 0) => ({
  dexIndex: 0,
  index,
  assetId: index,
  tokenName: name,
});
export const keyboardSpot = (name = "@1") => ({
  dexIndex: -1,
  index: 0,
  assetId: 10001,
  spotUniverse: { name },
});
export function selectorKeyboardFixture(patch = {}) {
  const { JSDOM } = appRequire("jsdom");
  const dom = new JSDOM('<div id="picker"><input></div><input id="outside">');
  const root = dom.window.document.getElementById("picker");
  const input = root.querySelector("input");
  const events = [],
    requests = [];
  const state = {
    activeTabData: ["BTC", "ETH", "SOL"].map(keyboardPerp),
    inputQuery: "",
    searchQuery: "",
    filteredQuery: "",
    displayPrimaryTab: "perps",
    displayActiveTab: "perps",
    keyboardSelection: undefined,
    perpFavorites: { favorites: [] },
    spotFavorites: { favorites: [] },
    order: { sequence: [] },
    pending: null,
    fail: false,
    ...patch,
  };
  input.value = state.inputQuery;
  const inputQueryRef = { current: state.inputQuery },
    pendingKeyboardScroll = { current: undefined },
    keyboardFavoritesPending = { current: new Set() },
    keyboardSubmitPending = { current: false },
    keyboardRowRefs = { current: new Map() },
    listRef = {
      current: { scrollToOffset: (x) => events.push(["offset", x]) },
    };
  const set = (key) => (value) => {
    state[key] = typeof value === "function" ? value(state[key]) : value;
  };
  function globals() {
    return {
      ...state,
      ...ime,
      ...favorites,
      ...tabs,
      platformEnv: { isNative: false, isExtensionUi: false },
      keyExtractor: getTokenSelectorListItemKey,
      primaryTabs: ["favorites", "perps", "spot"].map((tabId) => ({ tabId })),
      Node: dom.window.Node,
      HTMLElement: dom.window.HTMLElement,
      HTMLInputElement: dom.window.HTMLInputElement,
      inputQueryRef,
      pendingKeyboardScroll,
      keyboardFavoritesPending,
      keyboardSubmitPending,
      keyboardRowRefs,
      listRef,
      TOKEN_SELECTOR_DESKTOP_ROW_HEIGHT: 48,
      setInputQuery: set("inputQuery"),
      setSearchQuery: set("searchQuery"),
      setKeyboardSelection: set("keyboardSelection"),
      setPerpFavorites: set("perpFavorites"),
      setSpotFavorites: set("spotFavorites"),
      setFavoritesOrder: set("order"),
      setPrimaryTab: (tab) => {
        state.displayPrimaryTab = tab;
        state.displayActiveTab = tab;
        events.push(["tab", tab]);
      },
      handleSelectToken: async (coin) => {
        events.push(["select", coin]);
        if (state.pending) await state.pending;
      },
      backgroundApiProxy: {
        serviceHyperliquid: {
          updateTokenSelectorFavorite: async (args) => {
            requests.push(args);
            if (state.pending) await state.pending;
            if (state.fail) throw Error("local favorite sync failed");
          },
        },
      },
      console: {
        error: (...args) => events.push(["error", ...args.map(String)]),
      },
    };
  }
  const selection = () =>
    evaluateText(file, selectionCode, { globals: globals() });
  function callback(name) {
    const g = { ...globals(), ...selection() };
    g.scrollToKeyboardItem = scopedCallback(
      file,
      "BasePerpTokenSelectorContent",
      "scrollToKeyboardItem",
      g,
    );
    return scopedCallback(file, "BasePerpTokenSelectorContent", name, g);
  }
  function event(key, patch = {}) {
    const target = patch.target ?? input;
    const nativeEvent = {
      key,
      target,
      text: input.value,
      ...patch.nativeEvent,
    };
    const e = {
      key,
      target,
      currentTarget: root,
      nativeEvent,
      preventDefault() {
        this.prevented = true;
      },
      stopPropagation() {
        this.stopped = true;
      },
      ...patch,
    };
    e.nativeEvent = nativeEvent;
    return e;
  }
  return {
    state,
    events,
    requests,
    input,
    root,
    dom,
    inputQueryRef,
    pendingKeyboardScroll,
    keyboardFavoritesPending,
    keyboardSubmitPending,
    keyboardRowRefs,
    selection,
    event,
    invoke(name, ...args) {
      return callback(name)(...args);
    },
    async flush() {
      for (let i = 0; i < 12; i++) await Promise.resolve();
    },
    close() {
      dom.window.close();
    },
  };
}
