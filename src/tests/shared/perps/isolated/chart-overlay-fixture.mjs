// Real pinned scoping hooks -> line builder -> native reference-line projection.
// Atom/theme/intl boundaries are deterministic; no order service is reachable.
import { React, renderer, evaluateSource, perpsUtils } from "./source.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
export const chartBase = "packages/kit/src/views/Perp/";
export const chartComponentsBase = "packages/kit/src/components/TradingView/";
export const chartUtils = perpsUtils();
export const accountScope = evaluateSource(
  `${chartBase}utils/accountScopedData.ts`,
  {
    mocks: { "@onekeyhq/shared/src/utils/perpsUtils": chartUtils },
  },
);
export const position = (coin = "BTC", patch = {}) => ({
  position: {
    coin,
    szi: "1.234567",
    entryPx: "100.125",
    liquidationPx: "80.0001",
    unrealizedPnl: "2.25",
    leverage: { type: "cross", value: 3 },
    ...patch,
  },
});
export const order = (oid = 1, patch = {}) => ({
  oid,
  coin: "BTC",
  side: "B",
  sz: "0.123456",
  limitPx: "95.12345",
  orderType: "Limit",
  tif: "Gtc",
  ...patch,
});
export async function chartOverlayFixture(patch = {}) {
  let state = {
      instrument: {
        coin: "BTC",
        mode: "perp",
        assetId: 0,
        universe: { szDecimals: 5 },
      },
      account: { accountId: "A", accountAddress: "0xAaA" },
      positionOwner: "0xaaa",
      orderOwner: "0xaaa",
      spotOwner: "0xaaa",
      positions: [position(), position("ETH")],
      orders: {
        BTC: [order(), order(2, { side: "A", limitPx: "110" })],
        ETH: [order(3, { coin: "ETH" })],
      },
      spotOrders: [],
      showChartLines: true,
      enabled: true,
      canInteract: true,
      pending: {},
      ...patch,
    },
    tree,
    value;
  const intl = { formatMessage: ({ id }) => id };
  const atoms = {
    useActiveTradeInstrumentAtom: () => [state.instrument],
    usePerpsActivePositionAtom: () => [
      { activePositions: state.positions, accountAddress: state.positionOwner },
    ],
    usePerpsActiveOpenOrdersAtom: () => [
      { openOrdersByCoin: state.orders, accountAddress: state.orderOwner },
    ],
    useSpotActiveOpenOrdersAtom: () => [
      { openOrders: state.spotOrders, accountAddress: state.spotOwner },
    ],
    usePerpsCustomSettingsAtom: () => [
      { showChartLines: state.showChartLines },
    ],
    usePerpsActiveAccountAtom: () => [state.account],
  };
  const scopeMocks = {
    "../utils/accountScopedData": accountScope,
    "./usePerpsAccountScopedCacheAddress": {
      usePerpsAccountScopedCacheAddress: () => state.account.accountAddress,
    },
    "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid": atoms,
    "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms": atoms,
  };
  const positions = evaluateSource(
    `${chartBase}hooks/usePerpsAccountScopedActivePositions.ts`,
    { mocks: scopeMocks },
  );
  const orders = evaluateSource(
    `${chartBase}hooks/usePerpsAccountScopedOpenOrdersByCoin.ts`,
    { mocks: scopeMocks },
  );
  const builder = evaluateSource(
    `${chartComponentsBase}TradingViewPerpsV2/utils/lineBuilder.ts`,
    {
      mocks: {
        "@onekeyhq/shared/src/locale": {
          ETranslations: new Proxy({}, { get: (_, key) => key }),
        },
        "@onekeyhq/shared/src/utils/perpsTpSlUtils": evaluateSource(
          "packages/shared/src/utils/perpsTpSlUtils.ts",
        ),
        "@onekeyhq/shared/src/utils/perpsUtils": chartUtils,
      },
    },
  );
  const lines = evaluateSource(`${chartBase}hooks/usePerpsChartLines.ts`, {
    mocks: {
      "react-intl": { useIntl: () => intl },
      "@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/utils/lineBuilder":
        builder,
      "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid": atoms,
      "@onekeyhq/kit-bg/src/states/jotai/atoms": atoms,
      "@onekeyhq/shared/src/utils/perpsUtils": chartUtils,
      "@onekeyhq/shared/types/hyperliquid/perp.constants": {
        SPOT_ASSET_ID_OFFSET: 10000,
      },
      "./usePerpsAccountScopedActivePositions": positions,
      "./usePerpsAccountScopedOpenOrdersByCoin": orders,
    },
  });
  const actionInputs = [];
  const native = evaluateSource(
    `${chartBase}hooks/usePerpsNativeChartLines.ts`,
    {
      mocks: {
        "@onekeyhq/components": {
          useTheme: () => ({
            bgApp: { val: "background" },
            text: { val: "label" },
            bgInverse: { val: "inverse" },
            textInverse: { val: "inverseText" },
            textOnColor: { val: "onColor" },
          }),
        },
        "@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/chartSettings/TradingViewSettingsThemeColors":
          {
            useTradingViewSettingsThemeColors: () => ({
              positive: "green",
              negative: "red",
            }),
          },
        "@onekeyhq/shared/types/tradingViewNative": {
          TRADING_VIEW_NATIVE_THEME_COLORS: {
            positive: "positive",
            negative: "negative",
          },
        },
        "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid": atoms,
        "@onekeyhq/kit-bg/src/states/jotai/atoms": atoms,
        "./usePerpsChartLines": lines,
        "./usePerpsChartLineActions": {
          usePerpsChartLineActions: (args) => {
            actionInputs.push(args);
            return {
              canInteract: state.canInteract,
              getLineId: (line) => `${state.account.accountId}:${line.id}`,
              pending: state.pending,
              onReferenceLineAction: () => {
                throw Error(
                  "Action invocation is forbidden in projection fixture",
                );
              },
            };
          },
        },
      },
    },
  );
  function Probe() {
    value = {
      lines: lines.usePerpsChartLines({
        symbol: state.instrument.coin,
        szDecimals: 5,
        userAddress: state.account.accountAddress,
      }),
      ...native.usePerpsNativeChartLines(state.enabled),
    };
    return null;
  }
  async function render() {
    await renderer.act(async () => {
      if (tree) tree.update(React.createElement(Probe));
      else tree = renderer.create(React.createElement(Probe));
    });
  }
  await render();
  return {
    state,
    actionInputs,
    get value() {
      return value;
    },
    update: async (patch) => {
      Object.assign(state, patch);
      await render();
    },
    close: async () => renderer.act(async () => tree.unmount()),
  };
}
