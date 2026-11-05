// Actual pinned render/callback fragments, controlled local inputs and sinks.
// No production service module is imported; all unknown imports remain blocked.
import {
  React,
  renderer,
  ts,
  evaluateText,
  evaluateSource,
  evaluateCallback,
  readSource,
  perpsUtils,
  BigNumber,
} from "./source.mjs";
import { twap, intl, ETranslations } from "./twap-source-fixture.mjs";
import { numberUtils } from "./number-format-source.mjs";
export { React, renderer };
const utils = perpsUtils(),
  number = numberUtils("zh-CN");
const formFile =
  "packages/kit/src/views/Perp/components/TradingPanel/panels/PerpTradingForm.tsx";
const scaleUtils = evaluateSource(
  "packages/shared/src/utils/hyperliquidScaleOrderUtils.ts",
  {
    mocks: {
      "@onekeyhq/shared/src/errors": { OneKeyLocalError: Error },
      "@onekeyhq/shared/src/utils/perpsUtils": utils,
    },
  },
);
const scaleValidation = evaluateSource(
  "packages/kit/src/views/Perp/utils/scaleOrderValidation.ts",
  { mocks: { "@onekeyhq/shared/src/locale": { ETranslations } } },
);
const confirmFile =
  "packages/kit/src/views/Perp/components/TradingPanel/modals/OrderConfirmModal.tsx";
const host =
  (type) =>
  ({ children, ...props }) =>
    React.createElement(type, props, children);
export function sourceArrow(file, name, globals) {
  const source = readSource(file),
    ast = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    ),
    found = [];
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name?.text === name &&
      ts.isArrowFunction(node.initializer)
    )
      found.push(node.initializer);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (found.length !== 1)
    throw Error(`Expected exactly one source arrow ${file}:${name}`);
  return evaluateText(
    file,
    `export const fragment = ${found[0].getText(ast)}`,
    { globals },
  ).fragment;
}
export function sourceClass(file, names, globals) {
  const source = readSource(file),
    ast = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    ),
    found = [];
  function visit(node) {
    if (
      (ts.isMethodDeclaration(node) || ts.isPropertyDeclaration(node)) &&
      names.includes(node.name?.text)
    ) {
      // Decorators register IPC; omit them from the isolated class, keep body exact.
      const start = ts.canHaveDecorators(node)
        ? (ts.getDecorators(node)?.at(-1)?.end ?? node.getStart(ast))
        : node.getStart(ast);
      found.push(source.slice(start, node.end));
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (found.length !== names.length)
    throw Error(`Source methods changed ${file}:${names}`);
  return evaluateText(file, `export class Isolated { ${found.join("\n")} }`, {
    globals,
  }).Isolated;
}
const components = Object.fromEntries(
  [
    "XStack",
    "YStack",
    "SizableText",
    "DashText",
    "Button",
    "Checkbox",
    "Badge",
    "Icon",
    "Input",
  ].map((v) => [v, host(v)]),
);
const { TradingFormInput } = evaluateSource(
  "packages/kit/src/views/Perp/components/TradingPanel/inputs/TradingFormInput.tsx",
  {
    mocks: {
      "react-intl": { useIntl: () => intl },
      "react-native": {
        Keyboard: { dismiss() {} },
        InputAccessoryView: host("Accessory"),
      },
      "@onekeyhq/components": {
        ...components,
        useIsKeyboardShown: () => false,
      },
      "@onekeyhq/components/src/hocs/Provider/fonts/brandFont": {
        BRAND_FONT_NATIVE_FAMILY: {},
      },
      "@onekeyhq/shared/src/locale": { ETranslations },
      "@onekeyhq/shared/src/platformEnv": {
        default: { isNative: false, isNativeIOS: false },
      },
      "@onekeyhq/shared/src/utils/miscUtils": { generateUUID: () => "local" },
    },
  },
);
const { PriceInput } = evaluateSource(
  "packages/kit/src/views/Perp/components/TradingPanel/inputs/PriceInput.tsx",
  {
    mocks: {
      "react-intl": { useIntl: () => intl },
      "@onekeyhq/shared/src/locale": { ETranslations },
      "@onekeyhq/shared/src/utils/perpsUtils": utils,
      "./TradingFormInput": { TradingFormInput },
    },
  },
);
export async function priceSection(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const state = {
    ...patch,
    form: {
      side: "long",
      twapTriggerPrice: "",
      twapStopPrice: "",
      ...patch.form,
    },
    isSpot: patch.isSpot ?? false,
    isTwapMode: patch.isTwapMode ?? true,
    advanced: patch.advanced ?? true,
    submitting: patch.submitting ?? false,
    mark: patch.mark ?? "100",
  };
  let tree;
  const changes = [];
  function Harness() {
    const globals = {
      ...components,
      PriceInput,
      ...twap,
      intl,
      ETranslations,
      formData: state.form,
      isTwapMode: state.isTwapMode,
      isTwapAdvancedVisible: state.advanced,
      isSpot: state.isSpot,
      sizeSzDecimals: 2,
      twapMarkPriceBN: new BigNumber(state.mark),
      isMobile: false,
      isSubmitting: state.submitting,
      updateForm: (update) => {
        changes.push(update);
        state.form = { ...state.form, ...update };
      },
    };
    const details = sourceArrow(formFile, "renderTwapDetailsSection", globals);
    if (!patch.bottom) return details();
    return sourceArrow(formFile, "renderBottomSection", {
      ...globals,
      reserveMobileEnableTradingLayout: false,
      checkboxSizeVal: 16,
      setIsTwapAdvancedVisible: (value) => {
        state.advanced = value;
      },
      renderReduceOnlyCheckbox: () => null,
      renderTwapDetailsSection: details,
      renderTwapChildOrderSizeRow: () => null,
    })();
  }
  const refresh = () =>
    renderer.act(async () => tree.update(React.createElement(Harness)));
  await renderer.act(async () => {
    tree = renderer.create(React.createElement(Harness));
  });
  return {
    state,
    changes,
    props: () =>
      tree.root.findAllByType(TradingFormInput.type).map((n) => n.props),
    inputs: () => tree.root.findAllByType("Input").map((n) => n.props),
    advanced: async (value) => {
      await renderer.act(async () =>
        tree.root
          .findAllByType("Checkbox")
          .find(
            (n) => n.props.testID === "perp-twap-advanced-settings-checkbox",
          )
          .props.onChange(value),
      );
      await refresh();
    },
    enter: async (index, value) => {
      await renderer.act(async () =>
        tree.root.findAllByType("Input")[index].props.onChangeText(value),
      );
      await refresh();
    },
    update: async (next) => {
      Object.assign(state, next);
      await refresh();
    },
    close: () => renderer.act(async () => tree.unmount()),
  };
}
// Real form estimate useMemo body plus the real Desktop summary row. Controlled
// market/size inputs do not replace the production formatting or tooltip.
export async function estimateRow(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const state = {
    size: "1",
    mid: "100",
    minutes: "5",
    symbol: "BTC",
    ...patch,
  };
  let tree;
  function Harness() {
    const globals = {
      ...components,
      ...twap,
      intl,
      ETranslations,
      isMobile: false,
      isTwapMode: true,
      advancedComputedSizeBN: new BigNumber(state.size),
      midPriceBN: new BigNumber(state.mid),
      activeBaseName: state.symbol,
      perpsSelectedDisplayName: "fallback",
      sizeSzDecimals: 2,
      formData: { twapDurationMinutes: state.minutes },
    };
    const display = evaluateCallback(
      formFile,
      "twapEstimatedSliceSizeDisplay",
      globals,
    )();
    return sourceArrow(formFile, "renderTwapChildOrderSizeRow", {
      ...globals,
      twapEstimatedSliceSizeDisplay: display,
    })();
  }
  await renderer.act(async () => {
    tree = renderer.create(React.createElement(Harness));
  });
  return {
    texts: () =>
      tree.root
        .findAll((n) => n.type === "SizableText" || n.type === "DashText")
        .map((n) => n.children.filter((v) => typeof v === "string").join("")),
    hint: () => tree.root.findByType("DashText").props.tooltip,
    update: async (next) => {
      Object.assign(state, next);
      await renderer.act(async () => tree.update(React.createElement(Harness)));
    },
    close: () => renderer.act(async () => tree.unmount()),
  };
}
export async function confirmPanel(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const state = {
    ...patch,
    form: {
      orderMode: "twap",
      type: "market",
      side: "long",
      size: "2",
      leverage: 10,
      twapDurationMinutes: "5",
      twapRandomize: true,
      ...patch.form,
    },
    mode: patch.mode ?? "perp",
    size: patch.size ?? "2",
    mid: patch.mid ?? "100",
    loading: patch.loading ?? false,
  };
  const events = { submits: [], closes: 0, errors: [], resets: 0 },
    actions = {
      current: {
        resetTradingForm: () => events.resets++,
        submitOrder: async (params) => events.submits.push(params),
      },
    };
  const globals = {
    ...React,
    ...twap,
    ...scaleUtils,
    ...scaleValidation,
    ...utils,
    ...number,
    ...components,
    ...evaluateSource("packages/shared/types/hyperliquid/types.ts", {
      names: ["ETriggerOrderType"],
    }),
    ...evaluateSource(
      "packages/kit/src/views/Perp/components/TradingPanel/selectors/bboDisplay.ts",
    ),
    ...evaluateSource(
      "packages/kit/src/views/Perp/utils/resolveTpSlTriggerPx.ts",
      { mocks: { "@onekeyhq/shared/src/utils/perpsUtils": utils } },
    ),
    ETranslations,
    BigNumber,
    intl,
    useIntl: () => intl,
    usePerpsActiveAccountAtom: () => [
      { accountId: "local", accountAddress: "0x" + "1".repeat(40) },
    ],
    usePerpsTradingPreferencesAtom: () => [{ sizeInputUnit: "usd" }],
    useTradingFormAtom: () => [state.form],
    useHyperliquidActions: () => actions,
    useTradingLoadingAtom: () => [state.loading],
    usePerpsActivePositionAtom: () => [
      { activePositions: [], accountAddress: "0x" + "1".repeat(40) },
    ],
    useActiveTradeInstrumentAtom: () => [
      {
        mode: state.mode,
        assetId: 0,
        coin: "BTC",
        universe: { szDecimals: 2, baseSzDecimals: 2, baseName: "BTC" },
      },
    ],
    useActiveTradeDisplay: () => ({ baseName: "BTC" }),
    useTradingCalculationsForSide: () => ({
      computedSizeForSide: new BigNumber(state.size),
      orderValue: new BigNumber(state.size).times(state.mid),
    }),
    useTradingPrice: () => ({
      midPrice: state.mid,
      midPriceBN: new BigNumber(state.mid),
    }),
    useTwapReferencePrice: () => ({
      sizePriceBN: new BigNumber(state.mid),
      markPriceBN: new BigNumber(state.mid),
    }),
    useOrderPrice: () => ({ price: new BigNumber(state.mid) }),
    shouldBlockPerpsTradingForMarketData: () => Boolean(state.offline),
    Toast: { error: (v) => events.errors.push(v) },
    ...patch.hookOverrides,
  };
  const { useOrderConfirmWithMarketDataFreshness } = evaluateSource(
    "packages/kit/src/views/Perp/hooks/useOrderConfirm.ts",
    { names: ["useOrderConfirmWithMarketDataFreshness"], globals },
  );
  const { OrderConfirmContent } = evaluateSource(confirmFile, {
    names: [
      "SAVED_FEE_BENCHMARK_RATE",
      "formatOrderPriceDisplay",
      "getOrderConfirmAccountKey",
      "OrderConfirmContent",
    ],
    globals: {
      ...globals,
      LiquidationPriceDisplay: host("LiquidationPriceDisplay"),
      useOrderConfirm: (options) =>
        useOrderConfirmWithMarketDataFreshness({
          ...options,
          marketDataFreshness: {},
        }),
      usePerpsCustomSettingsAtom: () => [{ skipOrderConfirm: false }, () => {}],
      backgroundApiProxy: {
        simpleDb: { perp: { getExpectMaxBuilderFee: async () => 0 } },
      },
      getTradingSideTextColor: (s) => (s === "long" ? "$green11" : "$red11"),
      getTradingButtonStyleProps: () => ({}),
      getTifLabel: () => "GTC",
      ETriggerOrderType: evaluateSource(
        "packages/shared/types/hyperliquid/types.ts",
        { names: ["ETriggerOrderType"] },
      ).ETriggerOrderType,
      platformEnv: { isNative: false },
      TradingGuardWrapper: host("Guard"),
      PERP_DIALOG_BUTTON_SIZE: "large",
    },
  });
  let tree;
  const props = { onClose: () => events.closes++ };
  await renderer.act(async () => {
    tree = renderer.create(React.createElement(OrderConfirmContent, props));
  });
  const texts = () =>
    tree.root
      .findAll((n) => n.type === "SizableText" || n.type === "DashText")
      .map((n) => n.children.filter((v) => typeof v === "string").join(""));
  return {
    state,
    events,
    texts,
    tree: () => tree,
    submit: () =>
      renderer.act(async () => {
        await tree.root.findByType("Button").props.onPress();
      }),
    update: async (next) => {
      Object.assign(state, next);
      await renderer.act(async () =>
        tree.update(React.createElement(OrderConfirmContent, props)),
      );
    },
    close: () => renderer.act(async () => tree.unmount()),
  };
}
export function confirmValidation(form, patch = {}) {
  const events = { orders: [], resets: 0, errors: [] };
  const callback = evaluateCallback(
    "packages/kit/src/views/Perp/hooks/useOrderConfirm.ts",
    "handleConfirm",
    {
      ...twap,
      BigNumber,
      intl,
      ETranslations,
      ...utils,
      shouldBlockForMarketData: false,
      activeTradeInstrument: {
        mode: "perp",
        coin: "BTC",
        assetId: 0,
        universe: { szDecimals: 2 },
      },
      formData: {
        side: "long",
        type: "market",
        orderMode: "twap",
        twapDurationMinutes: "5",
        ...form,
      },
      longCalculations: { computedSizeForSide: new BigNumber(2) },
      shortCalculations: { computedSizeForSide: new BigNumber(2) },
      twapReferencePriceBN: new BigNumber(100),
      twapMarkPriceBN: new BigNumber(100),
      tradingPreferences: { sizeInputUnit: "usd" },
      baseName: "BTC",
      hyperliquidActions: {
        current: {
          resetTradingForm: () => events.resets++,
          submitOrder: async (v) => events.orders.push(v),
        },
      },
      options: {},
      Toast: { error: (v) => events.errors.push(v) },
      ...patch,
    },
  );
  return { events, run: callback };
}

export function exchangeFixture(mode = "perp") {
  const events = { clients: 0, wire: [], logs: [], completed: [] };
  const Class = sourceClass(
    "packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidExchange.ts",
    ["placeTwapOrder"],
    {
      ...twap,
      ...utils,
      ETranslations,
      OneKeyLocalError: Error,
      appLocale: { intl },
      convertHyperLiquidResponse: (callback) => callback(),
      defaultLogger: {
        perp: {
          hyperliquid: { twapOrder: (value) => events.logs.push(value) },
        },
      },
      buildHyperLiquidLogResult: () => ({}),
      extractHyperLiquidErrorResponse: () => undefined,
      serializeHyperLiquidError: (error) => ({ message: error.message }),
      ERookieTaskType: { PERPS: "local-perps" },
    },
  );
  const service = new Class();
  Object.assign(service, {
    checkAccountCanTrade: async () => {},
    _getOrderAssetPrecisionMap: async (ids) =>
      new Map(ids.map((id) => [id, { type: mode, szDecimals: 2 }])),
    _buildLogContext: async () => ({}),
    getExchangeClientForTrading: async () => {
      events.clients++;
      return {
        twapOrder: async (value) => {
          events.wire.push(value);
          return { status: "ok", response: { type: "twapOrder" } };
        },
      };
    },
    backgroundApi: {
      serviceRookieGuide: {
        recordTaskCompleted: async (value) => events.completed.push(value),
      },
    },
  });
  return { service, events };
}
// Reuse the same pinned real input pipeline for complete Desktop form fixtures.
export {
  PriceInput as actualPriceInput,
  TradingFormInput as actualTradingFormInput,
};
