// Mount the actual pinned AddPositionForm with inert UI and service sinks.
// The form, its effects, refs, submit handler, validation and TP/SL conversion
// are production source. Only external hooks/components/services are fixtures.
// This is offline component evidence, never a Desktop UI execution result.
import assert from "node:assert/strict";
import {
  React,
  renderer,
  evaluateSource,
  perpsUtils,
  BigNumber,
  readSource,
} from "./source.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const utils = perpsUtils();
const add = evaluateSource(
  "packages/kit/src/views/Perp/components/OrderInfoPanel/utils/addPosition.ts",
  { mocks: { "@onekeyhq/shared/src/utils/perpsUtils": utils } },
);
const tpsl = evaluateSource(
  "packages/kit/src/views/Perp/utils/resolveTpSlTriggerPx.ts",
  {
    mocks: { "@onekeyhq/shared/src/utils/perpsUtils": utils },
  },
);
const seed = evaluateSource("packages/kit/src/views/Perp/utils/tpslSeed.ts");
const ETranslations = Object.fromEntries(
  [
    ...readSource("packages/shared/src/locale/enum/translations.ts").matchAll(
      /^\s+(\w+) = '([^']+)'/gmu,
    ),
  ].map((m) => [m[1], m[2]]),
);
const translations = JSON.parse(
  readSource("packages/shared/src/locale/json/zh_CN.json"),
);
const intl = {
  formatMessage: ({ id }, values = {}) => {
    assert.equal(typeof translations[id], "string", `Known translation: ${id}`);
    return translations[id].replace(/\{(\w+)\}/gu, (_, key) => {
      assert.ok(Object.hasOwn(values, key), `Translation value: ${key}`);
      return String(values[key]);
    });
  },
};
const sourceFile =
  "packages/kit/src/views/Perp/components/OrderInfoPanel/AddPositionModal.tsx";
const host =
  (type) =>
  ({ children, ...props }) =>
    React.createElement(type, props, children);

export const account = "0x" + "1".repeat(40);
export const otherAccount = "0x" + "2".repeat(40);
export const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
export async function mountAddForm({
  isBuy = true,
  unit = "token",
  mark = "100",
  initialOffline = false,
  guard,
} = {}) {
  const position = {
    coin: "BTC",
    szi: isBuy ? "1" : "-1",
    positionValue: "100",
    leverage: { type: "cross", value: 10 },
  };
  const data = {
    coin: "BTC",
    user: account,
    markPx: mark,
    maxTradeSzs: ["10", "8"],
    leverage: { type: "cross", value: 10 },
  };
  const universe = { name: "BTC", szDecimals: 5, maxLeverage: 40 };
  const state = {
    active: account,
    positions: [{ position }],
    connected: !initialOffline,
    unit,
    mark,
    fetchData: async () => {
      if (initialOffline) throw Error("initial-offline-fixture");
      return structuredClone(data);
    },
    ensure: async () => {},
    place: async () => {},
  };
  const calls = {
    orders: [],
    ensure: 0,
    fetch: 0,
    metadata: 0,
    closed: 0,
    toasts: [],
    loading: [],
  };
  const components = Object.fromEntries(
    [
      "Button",
      "Checkbox",
      "DashText",
      "Divider",
      "Icon",
      "NumberSizeableText",
      "SizableText",
      "XStack",
      "YStack",
      "PriceInput",
      "TpSlFormInput",
      "PerpsSlider",
      "AggressiveLimitPriceWarning",
      "TradingGuardWrapper",
    ].map((name) => [name, host(name)]),
  );
  if (guard) components.TradingGuardWrapper = guard.TradingGuardWrapper;
  // Leaf SizeInput formatting has separate source/oracle tests. This adapter
  // exposes the form's controlled token callback, not an invented converter.
  components.SizeInput = (props) => {
    React.useEffect(() => {
      props.minimumOrderActionRef.current = {
        onPress: () => props.onChange("0.1"),
      };
      return () => {
        props.minimumOrderActionRef.current = undefined;
      };
    }, [props.minimumOrderActionRef, props.onChange]);
    return React.createElement("SizeInput", props);
  };
  const platformEnv = { isNative: false, isNativeIOS: false };
  const minimum = evaluateSource(
    "packages/kit/src/views/Perp/components/TradingPanel/inputs/SizeInput.tsx",
    {
      names: ["getMinimumOrderToastActionProps"],
      globals: { platformEnv, Button: components.Button },
    },
  );
  const { AddPositionForm } = evaluateSource(sourceFile, {
    names: ["AddPositionForm"],
    globals: {
      ...React,
      Error,
      BigNumber,
      ...utils,
      ...add,
      ...tpsl,
      ...seed,
      ...components,
      ...minimum,
      intl,
      ETranslations,
      OneKeyLocalError: Error,
      platformEnv,
      EPerpsSizeInputMode: { MANUAL: "manual", SLIDER: "slider" },
      getFontSize: (value) => value,
      PERP_DIALOG_BUTTON_SIZE: "large",
      PerpTestIDs: {
        AddPositionAmountInput: "amount",
        AddPositionTypeToggle: "type",
        AddPositionConfirmButton: "submit",
      },
      Toast: Object.fromEntries(
        ["message", "error"].map((kind) => [
          kind,
          (payload) => calls.toasts.push({ kind, ...payload }),
        ]),
      ),
      useIntl: () => intl,
      useKeyboardHeight: () => 0,
      usePerpsActiveAccountAtom: () => [{ accountAddress: state.active }],
      useConnectionStateAtom: () => [{ isConnected: state.connected }],
      usePerpsTradingPreferencesAtom: () => [{ sizeInputUnit: state.unit }],
      usePerpsAllMidsAtom: () => [{ mids: { BTC: state.mark } }],
      usePerpsAccountScopedActivePositions: () => state.positions,
      useCoinOrderBookTop: () => ({ bestBid: "99", bestAsk: "101" }),
      usePerpsCrossAvailableAfterMaintenance: () => new BigNumber("10000"),
      getAggressiveLimitPriceWarning: () => undefined,
      useEnsureTradingEnabled: () => async () => {
        calls.ensure++;
        await state.ensure();
      },
      useHyperliquidActions: () => ({
        current: {
          placeOrderByCoin: async (params) => {
            calls.orders.push(structuredClone(params));
            return state.place(params);
          },
        },
      }),
      backgroundApiProxy: {
        serviceHyperliquid: {
          getActiveAssetDataByCoin: async (params) => {
            assert.deepEqual(Object.keys(params).sort(), ["coin", "user"]);
            assert.equal(params.coin, "BTC");
            assert.equal(params.user, account);
            calls.fetch++;
            return state.fetchData();
          },
          getSymbolMeta: async () => {
            calls.metadata++;
            return { coin: "BTC", assetId: 0, isSpot: false, universe };
          },
        },
      },
    },
  });
  let tree;
  const props = {
    coin: "BTC",
    isBuy,
    accountAddress: account,
    onClose: () => {
      calls.closed++;
    },
  };
  const renderForm = (formProps = props) =>
    React.createElement(
      React.Fragment,
      {},
      React.createElement(AddPositionForm, formProps),
      guard ? React.createElement(guard.Portal) : null,
    );
  await renderer.act(async () => {
    tree = renderer.create(renderForm());
  });
  const find = (type) => tree.root.findAllByType(type);
  const one = (type) => {
    const all = find(type);
    assert.equal(all.length, 1, `One ${type}`);
    return all[0];
  };
  const submit = () =>
    find("Button").find((n) => n.props.testID === "submit") ||
    find("Button").find((n) => n.props.testID === "perp-is-disabled-btn");
  // Record the actual committed button loading state on every render.
  const tick = async (fn) => {
    await renderer.act(async () => {
      await fn?.();
    });
    calls.loading.push(submit().props.loading);
  };
  return {
    tree,
    state,
    calls,
    data,
    position,
    one,
    find,
    tick,
    // Real atom hooks subscribe to changes. The inert hook fixture must force
    // a memo render explicitly, otherwise mutable fixture data never reaches
    // the production refs and produces a false account-race failure.
    refresh: () =>
      tick(() =>
        tree.update(renderForm({ ...props, onClose: () => props.onClose() })),
      ),
    amount: (value) => tick(() => one("SizeInput").props.onChange(value)),
    limit: async (value) => {
      if (!find("PriceInput").length)
        await tick(() =>
          tree.root.findByProps({ testID: "type" }).props.onPress(),
        );
      if (value !== undefined)
        await tick(() => one("PriceInput").props.onChange(value));
    },
    price: (value) => tick(() => one("PriceInput").props.onChange(value)),
    checkbox: (checked) => tick(() => one("Checkbox").props.onChange(checked)),
    submit: () => tick(() => submit().props.onPress()),
    submitHandler: () => submit().props.onPress,
    close: () => renderer.act(async () => tree.unmount()),
  };
}
