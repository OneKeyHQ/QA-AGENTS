// Actual full form -> selector -> modal -> context action -> local exchange
// reply -> actual background feed guard -> atoms -> real calculation hooks.
// Portal, signing/exchange response and atom storage are explicit local hosts.
import {
  React,
  renderer,
  evaluateSource,
  perpsUtils,
  appRequire,
} from "./source.mjs";
import { sourceClass } from "./twap-flow-fixture.mjs";
import { tradingFormFixture } from "./trading-form-fixture.mjs";
import { bboPreviewFixture } from "./bbo-preview-fixture.mjs";
import { tradingGuardFixture } from "./trading-guard-fixture.mjs";
import { intl, ETranslations } from "./twap-source-fixture.mjs";
const base = "packages/kit/src/views/Perp/";
const host =
  (t) =>
  ({ children, ...p }) =>
    React.createElement(t, p, children);
export async function marginCompleteFixture(patch = {}) {
  const { assetData: assetDataPatch, form: formPatch, ...rest } = patch;
  const calc = await bboPreviewFixture({ deferMount: true, ...rest });
  calc.state.form = {
    ...calc.state.form,
    bboPriceMode: undefined,
    ...formPatch,
  };
  calc.state.asset = { ...calc.state.asset, assetId: 0 };
  calc.state.assetData = {
    ...calc.state.assetData,
    availableToTrade: ["200", "300"],
    ...assetDataPatch,
  };
  const events = { exchanges: [], snapshots: [], errors: [] };
  let formState,
    notify = () => {},
    config;
  const getForm = () => formState?.form ?? calc.state.form;
  const atom = (key) => ({
    get: async () => calc.state[key],
    set: async (v) => {
      calc.state[key] = typeof v === "function" ? v(calc.state[key]) : v;
      notify();
    },
  });
  const dataAtom = atom("assetData");
  const last = { get: async () => ({}), set: async () => {} };
  const Service = sourceClass(
    "packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquid.ts",
    ["updateActiveAssetData"],
    {
      perpsActiveAssetAtom: atom("asset"),
      perpsActiveAccountAtom: atom("account"),
      perpsActiveAssetDataAtom: dataAtom,
      perpsLastUsedLeverageAtom: last,
      omit: appRequire("lodash").omit,
      console: { warn: (...v) => events.errors.push(v) },
    },
  );
  const service = new Service();
  service.cacheService = {
    writePerpsAccountDisplaySnapshot: async (p) => events.snapshots.push(p),
  };
  const enums = evaluateSource(
    "packages/kit/src/states/jotai/contexts/hyperliquid/utils/types.ts",
    { names: ["EActionType"] },
  );
  const Action = sourceClass(
    "packages/kit/src/states/jotai/contexts/hyperliquid/actions.ts",
    ["updateLeverage"],
    {
      contextAtomMethod: (fn) => (p) =>
        fn(
          () => getForm(),
          (_, v) => {
            if (formState) formState.form = v;
            calc.state.form = v;
            notify();
          },
          p,
        ),
      tradingFormAtom: () => "form",
      withToast: async ({ asyncFn }) => asyncFn(),
      ...enums,
      backgroundApiProxy: {
        serviceHyperliquidExchange: {
          updateLeverage: async (p) => {
            events.exchanges.push({ ...p });
            if (patch.reject) throw Error("local leverage rejected");
          },
        },
      },
    },
  );
  const action = { current: new Action() };
  const hooks = {
    usePerpsActiveAssetAtom: () => [calc.state.asset],
    usePerpsActiveAssetDataAtom: () => [calc.state.assetData],
    usePerpsActiveAccountAtom: () => [calc.state.account],
    usePerpsAccountDisplaySnapshotAtom: () => [{}],
    getPerpsAccountDisplaySnapshotEntry: () => undefined,
  };
  const Dialog = {
    show: (c) => {
      config = c;
      notify();
      return {
        close: async () => {
          config = undefined;
          notify();
        },
      };
    },
  };
  const guard = tradingGuardFixture({
    account: calc.state.account,
    status: {
      accountAddress: calc.state.account.accountAddress,
      canTrade: true,
      accountNotSupport: false,
      details: { agentOk: true, activatedOk: true },
    },
    explicit: false,
  });
  const comps = {
    Button: host("Button"),
    YStack: host("YStack"),
    XStack: host("XStack"),
    SizableText: host("SizableText"),
    Dialog,
    useInPageDialog: () => Dialog,
  };
  const modal = evaluateSource(
    base + "components/TradingPanel/modals/MarginModeModal.tsx",
    {
      globals: { console: { error: (...v) => events.errors.push(v) } },
      mocks: {
        "react-intl": { useIntl: () => intl },
        "@onekeyhq/components": comps,
        "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid": {
          useHyperliquidActions: () => action,
        },
        "@onekeyhq/kit-bg/src/states/jotai/atoms": hooks,
        "@onekeyhq/shared/src/locale": { ETranslations },
        "@onekeyhq/shared/src/platformEnv": { isNativeAndroid: false },
        "@onekeyhq/shared/src/utils/perpsUtils": perpsUtils(),
        "../../../PerpsProviderMirror": {
          PerpsProviderMirror: ({ children }) => children,
        },
        "../../PerpDialogLayout": {
          PERP_DIALOG_BUTTON_SIZE: "large",
          PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS: {},
        },
        "../../TradingGuardWrapper": guard,
      },
    },
  );
  const { MarginModeSelector } = evaluateSource(
    base + "components/TradingPanel/selectors/MarginModeSelector.tsx",
    {
      mocks: {
        "react-intl": { useIntl: () => intl },
        "@onekeyhq/components": comps,
        "@onekeyhq/kit/src/states/jotai/contexts/accountSelector": {
          useActiveAccount: () => ({
            activeAccount: {
              ready: true,
              account: { id: "hd-local" },
              deriveType: "default",
            },
          }),
        },
        "@onekeyhq/kit-bg/src/states/jotai/atoms": hooks,
        "@onekeyhq/shared/src/locale": { ETranslations },
        "../../../testIDs": evaluateSource(base + "testIDs.ts"),
        "../modals/MarginModeModal": modal,
      },
    },
  );
  function Extra() {
    return React.createElement(
      React.Fragment,
      {},
      React.createElement(calc.Probe),
      config
        ? React.createElement(
            "MarginDialog",
            { title: config.title },
            config.renderContent,
          )
        : null,
    );
  }
  const full = await tradingFormFixture({
    form: calc.state.form,
    integration: {
      Selector: MarginModeSelector,
      Extra,
      useAsset: hooks.usePerpsActiveAssetAtom,
      useAssetData: hooks.usePerpsActiveAssetDataAtom,
      useComputedSize: () =>
        calc.hooks.useTradingCalculationsForSide("long").computedSizeForSide,
      bind: (s, _a, n) => {
        formState = s;
        calc.state.form = s.form;
        notify = n;
      },
    },
  });
  const select = () =>
    full
      .root()
      .findAll(
        (n) =>
          typeof n.type === "string" &&
          n.props.testID === "perp-margin-mode-selector",
      )[0];
  return {
    ...full,
    calc,
    events,
    service,
    select,
    get config() {
      return config;
    },
    async open() {
      const n = select();
      if (!n) throw Error("Missing actual margin selector");
      await full.action(() => n.props.onPress());
    },
    async choose(mode) {
      await full.action(() => {
        const nodes = full
          .nodes("YStack")
          .filter(
            (n) =>
              n.props.onPress &&
              n
                .findAllByType("SizableText")
                .some((t) =>
                  t.children.includes(mode === "cross" ? "全仓" : "逐仓"),
                ),
          );
        if (nodes.length !== 1) throw Error("Missing mode option " + mode);
        nodes[0].props.onPress();
      });
    },
    async confirm() {
      await full.action(() =>
        full
          .root()
          .findByType("MarginDialog")
          .findAllByType("Button")
          .find((n) => n.props.testID === "perp-btn")
          .props.onPress(),
      );
    },
    async feed(p) {
      await full.action(() =>
        service.updateActiveAssetData({
          user: calc.state.account.accountAddress,
          coin: "BTC",
          ...p,
        }),
      );
    },
    async close() {
      await full.close();
      await calc.close();
    },
  };
}
