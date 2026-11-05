// Actual ReversePositionContent + actual reverse/add helpers + async hook.
// Layout hosts have no pixel semantics. All submissions are local recording
// sinks; no wallet, agent, RPC, signing or real order API is imported.
import {
  React,
  renderer,
  evaluateSource,
  evaluateCallback,
  perpsUtils,
  BigNumber,
} from "./source.mjs";
import { intl, ETranslations } from "./twap-source-fixture.mjs";
import { numberUtils } from "./number-format-source.mjs";
import { promiseHookFixture } from "./promise-hook-fixture.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const file =
  "packages/kit/src/views/Perp/components/OrderInfoPanel/ReversePositionModal.tsx";
const host =
  (type) =>
  ({ children, ...props }) =>
    React.createElement(type, props, children);
export async function reversePositionFixture(patch = {}) {
  const state = {
    snapshot: { coin: "BTC", accountAddress: "0xaaa", positionSize: "1" },
    account: { accountAddress: "0xAAA" },
    positions: [
      {
        position: {
          coin: "BTC",
          szi: "1",
          leverage: { type: "cross", value: 10 },
        },
      },
    ],
    meta: {
      coin: "BTC",
      assetId: 0,
      isSpot: false,
      universe: { szDecimals: 5, maxLeverage: 40 },
      marginTable: { marginTiers: [{ lowerBound: "0", maxLeverage: 40 }] },
    },
    data: {
      coin: "BTC",
      user: "0xaaa",
      markPx: "100",
      maxTradeSzs: ["100", "100"],
      leverage: { type: "cross", value: 10 },
    },
    mid: "100",
    mark: "100",
    ready: true,
    reference: "100",
    crossAvailable: "1000",
    metaFailure: false,
    bookFailure: false,
    ensure: async () => {},
    place: async () => {},
    target: null,
    ...patch,
  };
  const runtime = promiseHookFixture(state),
    { globals, usePromiseResult } = runtime;
  const calls = {
    orders: [],
    toasts: [],
    requests: [],
    submitting: [],
    closed: 0,
    ensure: 0,
  };
  let tree, dialogProps;
  const dialog = {
    close: () => {
      if (dialogProps?.onBeforeClose() === false) return false;
      calls.closed++;
      return true;
    },
  };
  const utils = perpsUtils();
  const add = evaluateSource(
    "packages/kit/src/views/Perp/components/OrderInfoPanel/utils/addPosition.ts",
    { mocks: { "@onekeyhq/shared/src/utils/perpsUtils": utils } },
  );
  const timerUtils = evaluateSource("packages/shared/src/utils/timerUtils.ts", {
    globals,
  });
  const cache = evaluateSource("packages/shared/src/consts/perpCache.ts", {
    mocks: { "../utils/timerUtils": timerUtils },
  });
  const perp = evaluateSource("packages/shared/src/consts/perp.ts", {
    names: ["DEFAULT_PERPS_SLIPPAGE"],
  });
  const reverse = evaluateSource(
    "packages/kit/src/views/Perp/components/OrderInfoPanel/utils/reversePosition.ts",
    {
      globals,
      mocks: {
        "@onekeyhq/shared/src/consts/perp": perp,
        "@onekeyhq/shared/src/consts/perpCache": cache,
        "@onekeyhq/shared/src/utils/perpsUtils": utils,
        "./addPosition": add,
      },
    },
  );
  const TestIDs = evaluateSource(
    "packages/kit/src/views/Perp/testIDs.ts",
  ).PerpTestIDs;
  const components = Object.fromEntries(
    ["Button", "Divider", "Icon", "SizableText", "XStack", "YStack"].map(
      (name) => [name, host(name)],
    ),
  );
  const content = evaluateSource(file, {
    globals: { ...globals, Error },
    mocks: {
      "react-intl": { useIntl: () => intl },
      "@onekeyhq/components": {
        ...components,
        Dialog: {
          show: (props) => {
            dialogProps = props;
            return dialog;
          },
        },
        Toast: { error: (args) => calls.toasts.push(args) },
      },
      "@onekeyhq/kit/src/background/instance/backgroundApiProxy": {
        serviceHyperliquid: {
          getSymbolMeta: async (args) => {
            calls.requests.push(["meta", args]);
            if (state.metaFailure) throw Error("local metadata offline");
            return state.meta;
          },
          getL2BookSnapshotCache: async (args) => {
            calls.requests.push(["cache", args]);
            return undefined;
          },
          fetchL2BookByCoin: async (args) => {
            calls.requests.push(["book", args]);
            if (state.bookFailure) throw Error("local book offline");
            return {
              coin: state.snapshot.coin,
              time: runtime.clock.now,
              levels: [[{ px: "99", sz: "100" }], [{ px: "101", sz: "100" }]],
            };
          },
          getActiveAssetDataByCoin: async (args) => {
            calls.requests.push(["data", args]);
            if (state.target) await state.target.promise;
            return state.data;
          },
          getMarketOrderReferencePrice: async (coin) => {
            calls.requests.push(["reference", coin]);
            return state.reference;
          },
        },
      },
      "@onekeyhq/kit/src/hooks/usePromiseResult": { usePromiseResult },
      "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid": {
        useHyperliquidActions: () => ({
          current: {
            placeOrderByCoin: async (args) => {
              calls.orders.push(args);
              await state.place(args);
            },
          },
        }),
      },
      "@onekeyhq/kit-bg/src/states/jotai/atoms": {
        usePerpsActiveAccountAtom: () => [state.account],
      },
      "@onekeyhq/shared/src/consts/perpCache": cache,
      "@onekeyhq/shared/src/errors": { OneKeyLocalError: Error },
      "@onekeyhq/shared/src/locale": { ETranslations },
      "@onekeyhq/shared/src/utils/numberUtils": numberUtils("zh-CN"),
      "@onekeyhq/shared/src/utils/perpsUtils": utils,
      "../../hooks/useEnableTradingWithDepositFallback": {
        useEnsureTradingEnabled: () => async () => {
          calls.ensure++;
          await state.ensure();
        },
      },
      "../../hooks/usePerpsAccountScopedActivePositions": {
        usePerpsAccountScopedActivePositions: () => state.positions,
      },
      "../../hooks/usePerpsAssetCtx": {
        usePerpsAssetCtx: () => ({ assetCtx: { markPrice: state.mark } }),
      },
      "../../hooks/usePerpsCrossAvailableAfterMaintenance": {
        usePerpsCrossAvailableAfterMaintenance: () =>
          state.crossAvailable === undefined
            ? undefined
            : new BigNumber(state.crossAvailable),
      },
      "../../hooks/usePerpsMarketDataFreshness": {
        usePerpsMarketDataFreshness: () => ({ isReady: state.ready }),
      },
      "../../hooks/usePerpsMidPrice": {
        usePerpsMidPrice: () => ({ mid: state.mid }),
      },
      "../../PerpsAccountSelectorProviderMirror": {
        PerpsAccountSelectorProviderMirror: host("SelectorMirror"),
      },
      "../../PerpsProviderMirror": { PerpsProviderMirror: host("PerpsMirror") },
      "../../testIDs": { PerpTestIDs: TestIDs },
      "../../utils/styleUtils": {
        getTradingSideTextColor: (side) => (side === "long" ? "green" : "red"),
      },
      "../PerpDialogLayout": { PERP_DIALOG_BUTTON_SIZE: "medium" },
      "../TradingGuardWrapper": { TradingGuardWrapper: host("TradingGuard") },
      "./utils/addPosition": add,
      "./utils/reversePosition": reverse,
    },
  });
  const close = () => {
      calls.closed++;
    },
    submitting = (value) => calls.submitting.push(value);
  if (patch.useOuterDialog) {
    // Actual row callback always opens the dedicated reversal dialog, including
    // when the ordinary order-confirmation setting is skipped.
    const callback = evaluateCallback(
      "packages/kit/src/views/Perp/components/OrderInfoPanel/Components/PositionsRow.tsx",
      "handleReversePosition",
      {
        activeAccount: state.account,
        coin: state.snapshot.coin,
        pos: { szi: state.snapshot.positionSize },
        showReversePositionDialog: content.showReversePositionDialog,
        intl,
        ETranslations,
      },
    );
    callback();
  }
  const render = () =>
    renderer.act(async () => {
      if (patch.useOuterDialog) {
        if (!dialogProps)
          throw Error("Actual reverse row callback did not open dialog");
        if (tree) tree.update(dialogProps.renderContent);
        else tree = renderer.create(dialogProps.renderContent);
        return;
      }
      const props = {
        snapshot: state.snapshot,
        onClose: close,
        onSubmittingChange: submitting,
      };
      if (tree)
        tree.update(React.createElement(content.ReversePositionContent, props));
      else
        tree = renderer.create(
          React.createElement(content.ReversePositionContent, props),
        );
    });
  await render();
  const button = () =>
    tree.root
      .findAllByType("Button")
      .find(
        (node) => node.props.testID === TestIDs.ReversePositionConfirmButton,
      );
  return {
    state,
    calls,
    runtime,
    cache,
    dialog,
    dialogProps: () => dialogProps,
    button,
    hasRetry: () =>
      tree.root
        .findAllByType("Button")
        .some(
          (node) => node.props.testID === "perp-reverse-position-retry-button",
        ),
    texts: () =>
      tree.root
        .findAllByType("SizableText")
        .map((node) =>
          node.children.filter((c) => typeof c === "string").join(""),
        ),
    update: async (patch) => {
      Object.assign(state, patch);
      await render();
    },
    submit: async () => renderer.act(async () => button().props.onPress()),
    startSubmit: async () => {
      let request;
      await renderer.act(async () => {
        request = button().props.onPress();
      });
      return { request };
    },
    retry: async () =>
      renderer.act(async () => {
        const b = tree.root
          .findAllByType("Button")
          .find(
            (node) =>
              node.props.testID === "perp-reverse-position-retry-button",
          );
        if (!b) throw Error("Actual retry button missing");
        await b.props.onPress();
      }),
    tick: async (ms) => renderer.act(async () => runtime.clock.tickAsync(ms)),
    settle: async (pending, result, reject = false) =>
      renderer.act(async () => {
        pending[reject ? "reject" : "resolve"](result);
        await Promise.resolve();
      }),
    close: async () => renderer.act(async () => tree.unmount()),
  };
}
