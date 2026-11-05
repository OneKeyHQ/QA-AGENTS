// Pinned production TWAP calculations, validation and actual Desktop active row.
// Layout/date/side-color hosts are inert; no timing, price or status formatter is
// mocked. No wallet, network, termination or order callbacks can run here.
import {
  appRequire,
  React,
  renderer,
  readSource,
  evaluateSource,
  evaluateCallback,
  perpsUtils,
  BigNumber,
} from "./source.mjs";
import { numberUtils } from "./number-format-source.mjs";
export { React, renderer, BigNumber };
export const { ETranslations } = evaluateSource(
  "packages/shared/src/locale/enum/translations.ts",
);
export const intl = appRequire("react-intl").createIntl({
  locale: "zh-CN",
  messages: JSON.parse(
    readSource("packages/shared/src/locale/json/zh_CN.json"),
  ),
  onError: (error) => {
    throw error;
  },
});
const number = numberUtils("zh-CN");
const utils = perpsUtils();
export const twap = evaluateSource(
  "packages/shared/src/utils/hyperliquidTwapUtils.ts",
  {
    mocks: {
      "../locale/enum/translations": { ETranslations },
      "./numberUtils": number,
      "./perpsUtils": utils,
    },
  },
);
const unexpected = () => {
  throw Error("Unexpected external action in offline TWAP fixture");
};
const skip = evaluateSource(
  "packages/kit/src/views/Perp/utils/perpsOrderPanelEnableTrading.ts",
  {
    names: ["shouldSkipPerpsOrderPanelComputedSizeValidation"],
  },
);
export function guard(form = {}, patch = {}, side = "long") {
  const toasts = [];
  const validate = evaluateCallback(
    "packages/kit/src/views/Perp/components/TradingPanel/TradingButtonGroup.tsx",
    "validateOrderPanelState",
    {
      ...twap,
      ...skip,
      BigNumber,
      ETranslations,
      intl,
      Toast: { message: (v) => toasts.push(v), error: (v) => toasts.push(v) },
      minimumOrderActionRef: { current: undefined },
      getMinimumOrderToastActionProps: () => ({}),
      showNoEnoughMarginToast: unexpected,
    },
  );
  const state = {
    computedSizeForSide: new BigNumber(2),
    effectivePriceBN: new BigNumber(100),
    formData: {
      type: "market",
      size: "2",
      sizeInputMode: "manual",
      twapDurationMinutes: "5",
      ...form,
    },
    isMinimumOrderNotMetForSide: false,
    isNoEnoughMargin: false,
    isSpot: false,
    isScaleMode: false,
    isTriggerMode: false,
    isTwapMode: true,
    midPriceBN: new BigNumber(100),
    twapReferencePriceBN: new BigNumber(100),
    twapTriggerReferencePriceBN: new BigNumber(100),
    priceError: undefined,
    shouldBlockForMarketData: false,
    szDecimals: 2,
    ...patch,
  };
  return {
    result: validate({
      orderPanelState: state,
      validationSide: side,
      shouldValidateBboPriceError: false,
    }),
    toasts,
  };
}
const listFile =
  "packages/kit/src/views/Perp/components/OrderInfoPanel/List/PerpTwapList.tsx";
const helpers = evaluateSource(
  "packages/kit/src/views/Perp/components/OrderInfoPanel/utils.ts",
  {
    names: [
      "getOrderAssetDisplayName",
      "getOrderSizeDisplayName",
      "normalizeEpochMs",
      "getTwapHistoryEventTimeMs",
    ],
    globals: utils,
  },
);
const display = evaluateSource(listFile, {
  names: [
    "formatElapsedDuration",
    "formatTotalDuration",
    "getTwapBaseInfo",
    "TWAP_HISTORY_STATUS_TEXT_MAP",
    "humanizeTwapHistoryStatus",
    "getTwapHistoryStatusText",
  ],
  globals: {
    ...twap,
    ...number,
    ...utils,
    ...helpers,
    BigNumber,
    ETranslations,
    balanceFormatter: { formatter: "balance" },
  },
});
export const baseInfo = (state, patch = {}) =>
  display.getTwapBaseInfo({
    state,
    now: state.timestamp,
    spotDisplayMap: {},
    spotPairDisplayNameMap: {},
    intl,
    ...patch,
  });
const host =
  (type) =>
  ({ children, ...props }) =>
    React.createElement(type, props, children);
const { TwapActiveRow, TwapHistoryRow } = evaluateSource(listFile, {
  names: ["TwapActiveRow", "TwapHistoryRow"],
  globals: {
    ...React,
    ...display,
    ...utils,
    ...helpers,
    ETranslations,
    XStack: host("stack"),
    YStack: host("stack"),
    SizableText: host("text"),
    useIntl: () => intl,
    useHyperliquidActions: () => ({
      current: { switchTradeInstrument: unexpected },
    }),
    getTwapSideInfo: () => ({ color: "$text" }),
    formatTwapDateTime: () => ({ inline: "date-host-fixture" }),
    getTableRowBgColor: () => undefined,
    getColumnStyle: () => ({}),
    calcCellAlign: () => "center",
    PERP_DESKTOP_TABLE_ROW_PADDING_LEFT: 0,
    PERP_DESKTOP_TABLE_ROW_PADDING_RIGHT: 0,
    TWAP_TABLE_ROW_MIN_HEIGHT: 48,
    PERP_TEXT_ACTION_HOVER_STYLE: {},
  },
});
export const origin = 1_800_000_000_000;
export const orderState = (patch = {}) => ({
  coin: "BTC",
  sz: "2",
  executedSz: "0",
  executedNtl: "0",
  minutes: 5,
  timestamp: origin,
  trigger: { px: "120" },
  stopPx: undefined,
  reduceOnly: false,
  randomize: true,
  ...patch,
});
export async function activeRow(state, patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let tree;
  const props = {
    order: { twapId: 7, state },
    status: "waitingForTrigger",
    now: origin,
    index: 0,
    columnConfigs: Array.from({ length: 12 }, () => ({ align: "left" })),
    cellMinWidth: 0,
    onTerminate: unexpected,
    spotDisplayMap: {},
    spotPairDisplayNameMap: {},
    ...patch,
  };
  await renderer.act(async () => {
    tree = renderer.create(React.createElement(TwapActiveRow, props));
  });
  return {
    cells: () => tree.root.findAllByType("text").map((n) => n.props.children),
    update: async (next) =>
      renderer.act(async () =>
        tree.update(React.createElement(TwapActiveRow, { ...props, ...next })),
      ),
    close: async () => renderer.act(async () => tree.unmount()),
  };
}

export async function historyRow(state, patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let tree;
  const props = {
    record: {
      twapId: 7,
      state,
      time: origin + 180_000,
      status: { status: "finished" },
    },
    activatedAt: origin + 120_000,
    now: origin + 180_000,
    index: 0,
    columnConfigs: Array.from({ length: 11 }, () => ({ align: "left" })),
    cellMinWidth: 0,
    isMobile: false,
    spotDisplayMap: {},
    spotPairDisplayNameMap: {},
    ...patch,
  };
  await renderer.act(async () => {
    tree = renderer.create(React.createElement(TwapHistoryRow, props));
  });
  return {
    cells: () => tree.root.findAllByType("text").map((n) => n.props.children),
    update: async (next) =>
      renderer.act(async () =>
        tree.update(React.createElement(TwapHistoryRow, { ...props, ...next })),
      ),
    close: async () => renderer.act(async () => tree.unmount()),
  };
}
