// Actual complete Desktop PerpTradingForm, actual initial atom form and action
// updater. Pricing/computed-size hooks and component layout are explicit local
// boundaries; this fixture never loads any signing or network endpoint.
import {
  React,
  renderer,
  ts,
  readSource,
  evaluateText,
  evaluateSource,
  perpsUtils,
  BigNumber,
} from "./source.mjs";
import {
  actualPriceInput,
  actualTradingFormInput,
} from "./twap-flow-fixture.mjs";
import { triggerOrderFixture } from "./trigger-order-fixture.mjs";
import { intl, ETranslations, twap } from "./twap-source-fixture.mjs";
import { numberUtils } from "./number-format-source.mjs";
const base = "packages/kit/src/views/Perp/",
  file = base + "components/TradingPanel/panels/PerpTradingForm.tsx";
const host =
  (name) =>
  ({ children, ...props }) =>
    React.createElement(name, props, children);
const enums = evaluateSource("packages/shared/types/hyperliquid/types.ts", {
  names: [
    "EPerpsSizeInputMode",
    "ETriggerOrderType",
    "EHyperLiquidAbstractionMode",
  ],
});
const utils = perpsUtils(),
  constants = evaluateSource(
    "packages/shared/types/hyperliquid/perp.constants.ts",
  );
const source = readSource(file),
  ast = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
const formSource =
  ast.statements
    .filter((n) => !ts.isImportDeclaration(n) && !ts.isExportDeclaration(n))
    .map((n) => n.getText(ast))
    .join("\n") + "\nexport {PerpTradingForm};";
const atomFile = "packages/kit/src/states/jotai/contexts/hyperliquid/atoms.ts",
  atomSource = readSource(atomFile),
  atomAst = ts.createSourceFile(
    atomFile,
    atomSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
const atomDecl = atomAst.statements.find(
  (n) =>
    ts.isVariableStatement(n) &&
    n.declarationList.declarations.some(
      (d) =>
        ts.isObjectBindingPattern(d.name) &&
        d.name.elements.some((e) => e.name.text === "tradingFormAtom"),
    ),
);
if (!atomDecl) throw Error("Initial tradingForm atom changed");
const initial = evaluateText(atomFile, atomDecl.getText(atomAst), {
  globals: {
    ...enums,
    contextAtom: (v) => ({
      atom: v,
      use: () => {
        throw Error("Unexpected hook");
      },
    }),
  },
}).tradingFormAtom;
export async function tradingFormFixture(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const f = triggerOrderFixture();
  const state = {
    ...f.state,
    mode: "perp",
    mid: "100",
    quantity: "0",
    settings: {},
    positions: [],
    env: {},
    spotBalances: [
      { coin: "USDC", total: "100", hold: "0" },
      { coin: "PURRDAT", total: "35", hold: "0" },
    ],
    ...patch,
    form: { ...initial, leverage: 10, ...patch.form },
  };
  f.state.form = state.form;
  const events = [],
    components = Object.fromEntries(
      [
        "Button",
        "Heading",
        "Badge",
        "Checkbox",
        "DashText",
        "Icon",
        "IconButton",
        "Input",
        "Select",
        "SizableText",
        "Skeleton",
        "XStack",
        "YStack",
      ].map((n) => [n, host(n)]),
    );
  components.Badge.Text = host("BadgeText");
  function Popover({ renderTrigger, renderContent, ...props }) {
    return React.createElement(
      "Popover",
      { ...props, renderContent },
      React.cloneElement(
        renderTrigger,
        renderTrigger.props.onPress
          ? {}
          : { onPress: () => props.onOpenChange?.(!props.open) },
      ),
      props.open
        ? renderContent({ closePopover: () => props.onOpenChange?.(false) })
        : null,
    );
  }
  components.Select = ({ renderTrigger, children, ...props }) =>
    React.createElement(
      "Select",
      props,
      typeof renderTrigger === "function"
        ? renderTrigger({
            onPress: () => props.onOpenChange?.(true),
            disabled: props.disabled,
          })
        : renderTrigger,
      children,
    );
  const comps = {
    ...components,
    Popover,
    Tooltip: ({ renderTrigger, renderContent }) =>
      React.createElement("Tooltip", { renderContent }, renderTrigger),
    useMedia: () => ({ gtMd: true }),
  };
  const setters = {
    env: (fn) => {
      state.env = typeof fn === "function" ? fn(state.env) : fn;
    },
    settings: (fn) => {
      state.settings = typeof fn === "function" ? fn(state.settings) : fn;
      notify();
    },
  };
  let tree,
    notify = () => {};
  const action = {
    current: {
      updateTradingForm: (p) => {
        f.state.form = state.form;
        f.actions.updateTradingForm(p);
        state.form = f.state.form;
        notify();
      },
      getMidPrice: async () => ({ mid: state.mid }),
      switchTradeInstrument: async (p) => {
        events.push(["switch", p]);
        return true;
      },
    },
  };
  const scale = evaluateSource(
    "packages/shared/src/utils/hyperliquidScaleOrderUtils.ts",
    {
      mocks: {
        "@onekeyhq/shared/src/errors": { OneKeyLocalError: Error },
        "@onekeyhq/shared/src/utils/perpsUtils": utils,
      },
    },
  );
  const validation = evaluateSource(base + "utils/scaleOrderValidation.ts", {
    mocks: { "@onekeyhq/shared/src/locale": { ETranslations } },
  });
  const utilFiles = [
    "accountMode",
    "leverageDisplay",
    "styleUtils",
    "tpslSeed",
    "tradingReferencePrice",
  ];
  const util = {};
  for (const n of utilFiles)
    Object.assign(
      util,
      evaluateSource(base + "utils/" + n + ".ts", {
        mocks: {
          "@onekeyhq/shared/src/utils/perpsUtils": utils,
          "@onekeyhq/shared/types/hyperliquid/types": enums,
          "@onekeyhq/shared/types/hyperliquid": enums,
        },
      }),
    );
  const atom =
    (get, set = () => {}) =>
    () => [get(), set];
  const tif = evaluateSource(
    base + "components/TradingPanel/selectors/TimeInForceSelector.tsx",
    {
      mocks: {
        "react-intl": { useIntl: () => intl },
        "@onekeyhq/components": { ...comps, useInPageDialog: () => ({}) },
        "@onekeyhq/shared/src/locale": { ETranslations },
        "../../../utils/timeInForce": evaluateSource(
          base + "utils/timeInForce.ts",
        ),
        "../modals/TimeInForceDialog": {
          showTimeInForceDialog: () => {
            throw Error("Native TIF forbidden");
          },
        },
      },
    },
  );
  const globals = {
    ...React,
    ...comps,
    ...utils,
    ...twap,
    ...scale,
    ...validation,
    ...util,
    ...constants,
    ...enums,
    ...numberUtils("en-US"),
    BigNumber,
    intl,
    ETranslations,
    BRAND_FONT_NATIVE_FAMILY: {},
    platformEnv: { isNative: false, isNativeIOS: false },
    useIntl: () => intl,
    openUrlExternal: (v) => events.push(["url", v]),
    ListItem: host("ListItem"),
    PerpsSlider: host("Slider"),
    PerpIpRestrictionNotice: host("IPNotice"),
    PerpsAccountNumberValue: host("AccountNumber"),
    PriceInput: (props) =>
      React.createElement(
        "PriceInput",
        props,
        React.createElement(actualPriceInput, props),
      ),
    SizeInput: host("SizeInput"),
    TpSlFormInput: host("TpSlInput"),
    TradingFormInput: (props) =>
      React.createElement(
        "FormInput",
        props,
        React.createElement(actualTradingFormInput, props),
      ),
    LeverageAdjustModal: host("LeverageModal"),
    AccountModeSelector: host("AccountMode"),
    BBOSelector: host("BBO"),
    MarginModeSelector: patch.integration?.Selector ?? host("MarginMode"),
    MobileOrderTypeSelector: host("MobileOrder"),
    TimeInForceSelector: tif.TimeInForceSelector,
    TradeSideToggle: host("SideToggle"),
    PerpTestIDs: evaluateSource(base + "testIDs.ts").PerpTestIDs,
    useActiveAccount: () => ({
      activeAccount: {
        ready: true,
        account: { id: "a" },
        deriveType: "default",
      },
    }),
    useTradingFormAtom: atom(() => state.form),
    useTradingFormEnvAtom: atom(() => state.env, setters.env),
    useHyperliquidActions: () => action,
    useActiveTradeInstrumentAtom: atom(() => ({
      mode: state.mode,
      coin: state.mode === "spot" ? "@1" : "BTC",
    })),
    useTradingFormSizeInputComputed: () => ({
      ...state.form,
      sliderEnabled: true,
    }),
    useTradingFormComputedSize:
      patch.integration?.useComputedSize ??
      (() => new BigNumber(state.quantity)),
    usePerpsAccountLoadingInfoAtom: atom(() => ({})),
    usePerpsActiveAccountAtom: atom(() => ({ accountAddress: "0xaaa" })),
    usePerpsActiveAccountEnableTradingModeAtom: atom(() => ({
      requiresExplicitEnableTrading: false,
    })),
    usePerpsActiveAccountStatusAtom: atom(() => ({ canTrade: true })),
    usePerpsAbstractionModeAtom: atom(() => ({})),
    usePerpsCommonConfigPersistAtom: atom(() => ({ perpConfigCommon: {} })),
    usePerpsAccountDisplayReadyAtom: atom(() => ({ statusReady: true })),
    usePerpsAccountDisplaySnapshotAtom: atom(() => ({})),
    getPerpsAccountDisplaySnapshotEntry: () => undefined,
    usePerpsActiveAssetAtom:
      patch.integration?.useAsset ??
      atom(() => ({
        coin: "BTC",
        universe: { szDecimals: 2, maxLeverage: 20 },
      })),
    usePerpsActiveAssetCtxReadyAtom: atom(() => true),
    usePerpsActiveAssetDataAtom:
      patch.integration?.useAssetData ??
      atom(() => ({
        leverage: { value: 10, type: "cross" },
        availableToTrade: ["20", "30"],
        maxTradeSzs: ["2", "3"],
      })),
    usePerpsCustomSettingsAtom: atom(() => state.settings, setters.settings),
    useSpotActiveAssetAtom: atom(() => ({
      coin: "@1",
      assetId: 10001,
      universe: {
        name: "@1",
        baseName: "PURRDAT",
        quoteName: "USDC",
        baseSzDecimals: 2,
      },
    })),
    useSpotActiveAssetCtxReadyAtom: atom(() => true),
    useSpotBalancesAtom: atom(() => ({ balances: state.spotBalances })),
    useActiveTradeDisplay: () => ({
      baseName: state.mode === "spot" ? "PURRDAT" : "BTC",
    }),
    useTradingPrice: () => ({
      midPrice: state.mid,
      midPriceBN: new BigNumber(state.mid),
    }),
    useTwapReferencePrice: () => ({
      sizePriceBN: new BigNumber(state.mid),
      markPriceBN: new BigNumber(state.mid),
    }),
    useOrderPrice: () => ({
      price: new BigNumber(state.form.price || state.mid),
    }),
    useEnableTradingWithDepositFallback: () => () => events.push(["enable"]),
    useShowDepositWithdrawModal: () => ({
      isDepositDisabled: false,
      showDepositWithdrawModal: (p) => events.push(["funds", p]),
    }),
    useSpotMetaMaps: () => ({
      universeByBaseName: {
        PURRDAT: { name: "@1", baseName: "PURRDAT", quoteName: "USDC" },
      },
    }),
    usePerpsAccountScopedActivePositions: () => state.positions,
  };
  const { PerpTradingForm } = evaluateText(file, formSource, { globals });
  function Root() {
    const [, set] = React.useState(0);
    notify = () => set((x) => x + 1);
    patch.integration?.bind(state, action.current, notify);
    return React.createElement(
      React.Fragment,
      {},
      React.createElement(PerpTradingForm, { isMobile: false }),
      patch.integration?.Extra
        ? React.createElement(patch.integration.Extra)
        : null,
    );
  }
  await renderer.act(async () => {
    tree = renderer.create(React.createElement(Root));
  });
  const nodes = (t) => tree.root.findAllByType(t),
    text = (n) => n.children.filter((x) => typeof x === "string").join("");
  return {
    state,
    events,
    nodes,
    root: () => tree.root,
    texts: () => nodes("SizableText").map(text),
    async update(p) {
      Object.assign(state, p);
      await renderer.act(async () => notify());
    },
    async action(fn) {
      await renderer.act(async () => fn());
    },
    async advanced(v) {
      await renderer.act(async () =>
        nodes("Select")
          .find((n) => n.props.testID === "perp-select")
          .props.onChange(v),
      );
    },
    async clickText(label) {
      const n =
        nodes("SizableText").find(
          (n) => text(n) === label && n.props.onPress,
        ) ||
        nodes("XStack").find(
          (n) =>
            n.props.onPress &&
            n.findAllByType("SizableText").some((x) => text(x) === label),
        );
      if (!n) throw Error("Missing clickable " + label);
      await renderer.act(async () => n.props.onPress());
    },
    async close() {
      await renderer.act(async () => tree.unmount());
    },
  };
}
