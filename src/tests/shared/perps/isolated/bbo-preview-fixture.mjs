// Actual pinned price -> side calculations -> liquidation hook/leaf chain.
// Atom values, layout hosts and timers are local. All imports are allowlisted;
// no wallet/service/transport module is loaded, and no order callback exists.
import {
  React,
  renderer,
  BigNumber,
  evaluateSource,
  evaluateCallback,
} from "./source.mjs";
import { perpsUtils } from "./source.mjs";
import { numberUtils } from "./number-format-source.mjs";
import { sourceClass } from "./twap-flow-fixture.mjs";

const hooks = "packages/kit/src/views/Perp/hooks/";
const buttons =
  "packages/kit/src/views/Perp/components/TradingPanel/TradingButtonGroup.tsx";
const actionsFile =
  "packages/kit/src/states/jotai/contexts/hyperliquid/actions.ts";
const context = "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid";
const atoms = "@onekeyhq/kit-bg/src/states/jotai/atoms";
const utils = perpsUtils();
const scale = evaluateSource(
  "packages/shared/src/utils/hyperliquidScaleOrderUtils.ts",
  {
    mocks: {
      "@onekeyhq/shared/src/errors": { OneKeyLocalError: Error },
      "@onekeyhq/shared/src/utils/perpsUtils": utils,
    },
  },
);
const enums = evaluateSource("packages/shared/types/hyperliquid/types.ts", {
  names: ["EPerpsSizeInputMode", "ETriggerOrderType"],
});
const getReceived = evaluateSource(
  "packages/kit/src/states/jotai/contexts/hyperliquid/utils/l2BookUtils.ts",
  { names: ["getPerpsMarketDataLocalReceivedAt"] },
);
export const bboEpoch = 1_800_000_000_000;
const account = "0x" + "1".repeat(40);
const number = numberUtils("zh-CN");
const plain = (v) => JSON.parse(JSON.stringify(v));
export async function bboPreviewFixture(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const state = {
    now: bboEpoch,
    instrument: {
      mode: "perp",
      coin: "BTC",
      assetId: 0,
      universe: { szDecimals: 4, maxLeverage: 20 },
    },
    form: {
      type: "limit",
      orderMode: "standard",
      price: "777",
      size: "2",
      sizeInputMode: "manual",
      sizePercent: 0,
      bboPriceMode: { type: "counterparty", offsetTicks: 0 },
    },
    asset: {
      coin: "BTC",
      universe: { szDecimals: 4, maxLeverage: 20 },
      margin: { marginTiers: [{ lowerBound: "0", maxLeverage: 20 }] },
    },
    assetData: {
      coin: "BTC",
      accountAddress: account,
      markPx: "100.5",
      leverage: { type: "isolated", value: 10 },
      maxTradeSzs: ["20", "20"],
    },
    ctx: { ctx: { markPrice: "100.5" } },
    account: { accountAddress: account },
    positions: [],
    crossAvailable: "10",
    mid: "100.5",
    unit: "usd",
    balances: [
      { coin: "HYPE", total: "20", hold: "0" },
      { coin: "USDC", total: "2000", hold: "0" },
    ],
    book: {
      coin: "BTC",
      time: bboEpoch,
      bbo: [
        { px: "100", sz: "8", n: 1 },
        { px: "101", sz: "9", n: 2 },
      ],
    },
    ...patch,
  };
  const timers = new Map();
  let timerId = 0,
    tree,
    values;
  class Clock extends Date {
    static now() {
      return state.now;
    }
  }
  const globals = {
    Date: Clock,
    setTimeout: (fn, delay) => {
      const id = ++timerId;
      timers.set(id, { fn, delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  const freshness = evaluateSource(
    "packages/kit/src/views/Perp/utils/l2BookFreshness.ts",
    {
      names: [
        "isPerpsL2BookInteractive",
        "getPerpsL2BookInteractiveRefreshDelayMs",
        "isPerpsBboInteractive",
        "getPerpsBboInteractiveRefreshDelayMs",
      ],
      globals: { Date: Clock, PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS: 30000 },
    },
  );
  const sharedContext = {
    useActiveTradeInstrumentAtom: () => [state.instrument],
    useTradingFormAtom: () => [state.form],
    useTradingFormOrderPriceParams: () => state.form,
    useTradingFormCalculationParams: () => state.form,
    useBboForOrderPrice: (enabled) =>
      enabled && state.book?.coin === state.instrument.coin ? state.book : null,
  };
  const sharedAtoms = {
    usePerpsActiveAssetAtom: () => [state.asset],
    usePerpsActiveAssetDataAtom: () => [state.assetData],
    usePerpsActiveAssetCtxAtom: () => [state.ctx],
    usePerpsActiveAccountAtom: () => [state.account],
    usePerpsTwapMarkPrice: () => state.ctx?.ctx?.markPrice,
    useSpotBalancesAtom: () => [{ balances: state.balances }],
  };
  const tradingPrice = {
    useTradingPrice: () => ({ midPriceBN: new BigNumber(state.mid) }),
  };
  const price = evaluateSource(hooks + "useOrderPrice.ts", {
    globals,
    mocks: {
      [context]: sharedContext,
      [context + "/utils/l2BookUtils"]: getReceived,
      "@onekeyhq/shared/src/utils/hyperliquidScaleOrderUtils": scale,
      "@onekeyhq/shared/src/utils/perpsUtils": utils,
      "../utils/l2BookFreshness": freshness,
      "./useTradingPrice": tradingPrice,
    },
  });
  const positions = {
    usePerpsAccountScopedActivePositions: () => state.positions,
  };
  const { useTradingCalculationsForSide } = evaluateSource(
    hooks + "useTradingCalculationsForSide.ts",
    {
      mocks: {
        [context]: sharedContext,
        [atoms]: sharedAtoms,
        "@onekeyhq/shared/src/utils/hyperliquidScaleOrderUtils": scale,
        "@onekeyhq/shared/src/utils/perpsUtils": utils,
        "@onekeyhq/shared/types/hyperliquid/types": enums,
        "./useOrderPrice": price,
        "./useTradingPrice": tradingPrice,
        "./usePerpsAccountScopedActivePositions": positions,
      },
    },
  );
  const { useLiquidationPrice } = evaluateSource(
    hooks + "useLiquidationPrice.ts",
    {
      mocks: {
        [context]: sharedContext,
        [atoms]: sharedAtoms,
        "@onekeyhq/shared/src/utils/perpsUtils": utils,
        "@onekeyhq/shared/types/hyperliquid/types": enums,
        "./useOrderPrice": price,
        "./usePerpsAccountScopedActivePositions": positions,
        "./usePerpsCrossAvailableAfterMaintenance": {
          usePerpsCrossAvailableAfterMaintenance: () =>
            state.crossAvailable == null
              ? undefined
              : new BigNumber(state.crossAvailable),
        },
      },
    },
  );
  const { EstLiqPriceLeaf } = evaluateSource(buttons, {
    names: ["EstLiqPriceLeaf"],
    globals: {
      memo: React.memo,
      useLiquidationPrice,
      // Timing is controlled here; TF debounce scheduling is not verified.
      useDebounce: (v) => v,
      NumberSizeableText: ({ children, formatter, formatterOptions }) =>
        React.createElement(
          "liq-value",
          { raw: children },
          number.numberFormat(children, { formatter, formatterOptions }),
        ),
      SizableText: ({ children }) =>
        React.createElement("liq-empty", {}, children),
    },
  });
  function Side({ side }) {
    const calc = useTradingCalculationsForSide(side);
    const liq = useLiquidationPrice({ side, size: calc.computedSizeForSide });
    const secondary = evaluateCallback(buttons, "buttonSecondaryText", {
      BigNumber,
      formData: state.form,
      isMobile: false,
      orderValue: calc.orderValue,
      resolvedSizeInputUnit: state.unit,
      computedSizeForSide: calc.computedSizeForSide,
      szDecimals:
        state.instrument.universe?.baseSzDecimals ??
        state.asset.universe.szDecimals,
      isSpot: state.instrument.mode === "spot",
      activeTradeInstrument: state.instrument,
      activeAsset: state.asset,
      ...utils,
    })();
    values[side] = {
      price: calc.effectivePriceBN.toFixed(),
      error: calc.priceError,
      quantity: calc.computedSizeForSide.toFixed(),
      notional: calc.orderValue.toFixed(),
      margin: calc.marginRequired.toFixed(),
      noEnoughMargin: calc.isNoEnoughMargin,
      leverage: calc.leverage,
      maxTradeSize: calc.maxTradeSz,
      liq: liq?.toFixed() ?? null,
      secondary,
    };
    return React.createElement(
      "side",
      { side },
      secondary,
      React.createElement(EstLiqPriceLeaf, {
        side,
        size: calc.computedSizeForSide,
      }),
    );
  }
  function Harness() {
    values = {};
    return React.createElement(
      React.Fragment,
      {},
      ...["long", "short"].map((side) =>
        React.createElement(Side, { key: side, side }),
      ),
    );
  }
  if (!patch.deferMount)
    await renderer.act(async () => {
      tree = renderer.create(React.createElement(Harness));
    });
  return {
    state,
    Probe: Harness,
    hooks: {
      useOrderPrice: price.useOrderPrice,
      useTradingCalculationsForSide,
      useLiquidationPrice,
      useActiveTradeInstrumentAtom: sharedContext.useActiveTradeInstrumentAtom,
    },
    timers,
    get values() {
      return values;
    },
    get root() {
      return tree.root;
    },
    async update(fn) {
      await renderer.act(async () => {
        fn(state);
        tree.update(React.createElement(Harness));
      });
      return plain(values);
    },
    async expire() {
      await renderer.act(async () => {
        state.now += 30001;
        for (const [id, timer] of [...timers]) {
          timers.delete(id);
          timer.fn();
        }
      });
      return plain(values);
    },
    async close() {
      await renderer.act(async () => tree?.unmount());
      if (timers.size) throw Error("BBO freshness timer leaked");
    },
  };
}

// Actual instrument actions, in-memory atoms and market-data-only local sinks.
// Request-generation/subscription infrastructure is inert; order APIs absent.
export function bboInstrumentFixture() {
  const store = {
    instrument: { mode: "perp", coin: "BTC", assetId: 0 },
    tradingMode: "perp",
    asset: { coin: "BTC", assetId: 0, universe: { szDecimals: 4 } },
    spot: undefined,
    spotCtxs: {},
    preferences: { sizeInputUnit: "usd" },
    mids: { mids: { BTC: "100.5", ETH: "201.5" } },
    form: {
      type: "limit",
      orderMode: "standard",
      price: "123",
      size: "2",
      bboPriceMode: { type: "queue", offsetTicks: 5 },
    },
    book: null,
    bbo: null,
    ticks: {},
    view: {},
  };
  const calls = [];
  const get = (k) => store[k],
    set = (k, v) => {
      store[k] = typeof v === "function" ? v(store[k]) : v;
    };
  const atom = (key) =>
    Object.assign(() => key, {
      get: async () => store[key],
      set: async (v) => set(key, v),
    });
  const Eq = sourceClass(actionsFile, ["_isTradeInstrumentEqual"], {});
  const Class = sourceClass(
    actionsFile,
    [
      "changeActiveAsset",
      "changeActiveSpotAsset",
      "clearActiveAssetData",
      "updateTradingForm",
    ],
    {
      BigNumber,
      ...utils,
      ...enums,
      ContextJotaiActionsHyperliquid: Eq,
      contextAtomMethod: (callback) =>
        function (...args) {
          return callback(get, set, ...args);
        },
      activeTradeInstrumentAtom: atom("instrument"),
      tradingFormAtom: atom("form"),
      l2BookAtom: atom("book"),
      bboAtom: atom("bbo"),
      orderBookTickOptionsAtom: atom("ticks"),
      perpsAllMidsAtom: atom("mids"),
      tradeRouteViewStateAtom: atom("view"),
      perpsActiveAssetAtom: atom("asset"),
      tradingModeAtom: atom("tradingMode"),
      spotActiveAssetAtom: atom("spot"),
      spotAssetCtxsMapAtom: atom("spotCtxs"),
      spotActiveAssetCtxAtom: atom("spotCtx"),
      perpsActiveAssetCtxAtom: atom("ctx"),
      perpsActiveAssetCtxDisplayAtom: atom("ctxDisplay"),
      perpsActiveAssetDataAtom: atom("data"),
      perpsTradingPreferencesAtom: atom("preferences"),
      shouldClearPerpsMarketDataForInstrument: ({ dataCoin, activeCoin }) =>
        dataCoin !== activeCoin,
      getPerpsOrderBookTickOptionWithCache: () => undefined,
      swrCacheUtils: { getFreshPerpsL2BookSnapshot: () => undefined },
      PERPS_L2_BOOK_SWR_CACHE_MAX_AGE_MS: 1,
      PERPS_L2_BOOK_SNAPSHOT_CACHE_WRITE_INTERVAL_MS: 1,
      recoverSubscriptionsWithProof: async () => {},
      backgroundApiProxy: {
        serviceHyperliquid: {
          cancelPendingActiveAssetChange: async () => {},
          changeActiveAsset: async ({ coin }) => {
            calls.push(["market-data", coin]);
            store.asset = {
              coin,
              assetId: coin === "BTC" ? 0 : 1,
              universe: { szDecimals: 4 },
            };
            return store.asset;
          },
        },
      },
    },
  );
  const actions = new Class();
  let request = 0;
  Object.assign(actions, {
    beginActiveInstrumentChange: () => ++request,
    isLatestActiveInstrumentChange: (id) => id === request,
    waitForActiveInstrumentChangeSettle: async (id) => id === request,
    ensureOrderBookTickOptionsLoaded: () => {},
    _buildActiveTradeInstrument: async (mode) => ({
      mode,
      ...(mode === "perp" ? store.asset : store.spot),
    }),
    syncSubscriptionsAfterInstrumentChange: () => {},
  });
  return {
    store,
    actions,
    calls,
    spotUniverse: {
      name: "@107",
      assetId: 10107,
      baseName: "HYPE",
      quoteName: "USDC",
      displayName: "HYPE",
      baseSzDecimals: 2,
    },
  };
}
