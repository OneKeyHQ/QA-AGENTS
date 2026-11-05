// Pinned actual Desktop fill row and production date/price/amount formatters.
// Layout, direction color and tooltip hosts are inert; no trading callbacks run.
import {
  React,
  renderer,
  evaluateSource,
  perpsUtils,
  BigNumber,
  appRequire,
} from "./source.mjs";
import { intl, ETranslations } from "./twap-source-fixture.mjs";
import { numberUtils } from "./number-format-source.mjs";
const file =
  "packages/kit/src/views/Perp/components/OrderInfoPanel/List/PerpTwapList.tsx";
const utils = perpsUtils(),
  number = numberUtils("zh-CN");
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
    Date,
    appLocale: { getLocale: () => "zh-CN" },
    getDefaultLocale: () => "zh-CN",
    DateLocaleMap: { "zh-CN": appRequire("date-fns/locale").zhCN },
    OneKeyLocalError: Error,
    fnsFormat: appRequire("date-fns").format,
    parseISO: appRequire("date-fns").parseISO,
    formatInTimeZone: () => {
      throw Error("Explicit timezone branch outside this fill fixture");
    },
  },
});
const display = evaluateSource(file, {
  names: ["formatTwapDateTime"],
  globals: { Date, ...date },
});
const asset = evaluateSource(
  "packages/kit/src/views/Perp/components/OrderInfoPanel/utils.ts",
  { names: ["getOrderAssetDisplayName"], globals: utils },
);
const host =
  (type) =>
  ({ children, ...props }) =>
    React.createElement(type, props, children);
const unexpected = () => {
  throw Error("Unexpected trading callback in offline fill fixture");
};
const { TwapFillRow } = evaluateSource(file, {
  names: ["TwapFillRow"],
  globals: {
    ...React,
    ...utils,
    ...number,
    ...display,
    ...asset,
    BigNumber,
    intl,
    ETranslations,
    useIntl: () => intl,
    useHyperliquidActions: () => ({
      current: { switchTradeInstrument: unexpected },
    }),
    getFillDirectionInfo: () => ({
      text: "direction-host",
      color: "color-host",
    }),
    getColumnStyle: () => ({}),
    calcCellAlign: () => "left",
    getTableRowBgColor: () => undefined,
    XStack: host("stack"),
    YStack: host("stack"),
    SizableText: host("text"),
    DashText: host("text"),
    Tooltip: ({ renderTrigger }) => renderTrigger,
    balanceFormatter: { formatter: "balance" },
    valueFormatter: {
      formatter: "balance",
      formatterOptions: { currency: "$" },
    },
    PERP_DESKTOP_TABLE_ROW_PADDING_LEFT: 0,
    PERP_DESKTOP_TABLE_ROW_PADDING_RIGHT: 0,
    TWAP_TABLE_ROW_MIN_HEIGHT: 48,
    PERP_TEXT_ACTION_HOVER_STYLE: {},
  },
});
export async function fillRow(record, patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const props = {
    record,
    index: 0,
    cellMinWidth: 0,
    columnConfigs: Array.from({ length: 8 }, () => ({ align: "left" })),
    spotDisplayMap: {},
    spotPairDisplayNameMap: {},
    isMobile: false,
    ...patch,
  };
  let tree;
  await renderer.act(async () => {
    tree = renderer.create(React.createElement(TwapFillRow, props));
  });
  return {
    cells: () => tree.root.findAllByType("text").map((n) => n.props.children),
    update: async (next) =>
      renderer.act(async () =>
        tree.update(React.createElement(TwapFillRow, { ...props, ...next })),
      ),
    close: () => renderer.act(async () => tree.unmount()),
  };
}
