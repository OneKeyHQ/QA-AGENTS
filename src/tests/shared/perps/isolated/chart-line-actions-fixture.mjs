// Actual chart action state machine with local mutation sinks and a fake clock.
// Exchange, RPC, CDP, signing and authorization services are not imported.
import {
  React,
  renderer,
  evaluateSource,
  perpsUtils,
  appRequire,
} from "./source.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const scope = evaluateSource(
  "packages/kit/src/views/Perp/utils/accountScopedData.ts",
  { mocks: { "@onekeyhq/shared/src/utils/perpsUtils": perpsUtils() } },
);
export async function chartLineActionsFixture(patch = {}) {
  const state = {
    enabled: true,
    symbol: "BTC",
    szDecimals: 5,
    isSpot: false,
    account: { accountId: "A", indexedAccountId: "I", accountAddress: "0xaaa" },
    selected: {
      ready: true,
      account: { id: "A" },
      indexedAccount: { id: "I" },
    },
    loading: false,
    lines: [
      {
        id: "order:1",
        kind: "order",
        price: 100,
        editable: true,
        meta: { orderId: 1, coin: "BTC" },
      },
    ],
    ensure: async () => {},
    amend: async () => {},
    cancel: async () => {},
    ...patch,
  };
  const clock = appRequire("@sinonjs/fake-timers").createClock(1800000000000);
  const calls = { ensure: 0, amend: [], cancel: [], errors: [] },
    actions = {
      current: {
        amendChartOrder: async (args) => {
          calls.amend.push(args);
          await state.amend(args);
        },
        cancelChartOrder: async (args) => {
          calls.cancel.push(args);
          await state.cancel(args);
        },
      },
    };
  const module = evaluateSource(
    "packages/kit/src/views/Perp/hooks/usePerpsChartLineActions.ts",
    {
      globals: {
        Date: clock.Date,
        setTimeout: clock.setTimeout.bind(clock),
        clearTimeout: clock.clearTimeout.bind(clock),
      },
      mocks: {
        "@onekeyhq/components": {
          Toast: { error: (detail) => calls.errors.push(detail) },
        },
        "@onekeyhq/kit/src/states/jotai/contexts/accountSelector": {
          useActiveAccount: () => ({ activeAccount: state.selected }),
        },
        "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid": {
          useHyperliquidActions: () => actions,
        },
        "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/utils/config": {
          getPerpsOrderChangedMessage: () => "local order changed; retry",
        },
        "@onekeyhq/kit-bg/src/states/jotai/atoms": {
          usePerpsActiveAccountAtom: () => [state.account],
          usePerpsAccountLoadingInfoAtom: () => [
            { selectAccountLoading: state.loading },
          ],
        },
        "@onekeyhq/shared/src/errors": { OneKeyLocalError: Error },
        "@onekeyhq/shared/src/utils/perpsUtils": perpsUtils(),
        "../utils/accountScopedData": scope,
        "./useEnableTradingWithDepositFallback": {
          useEnsureTradingEnabled: () => async () => {
            calls.ensure += 1;
            await state.ensure();
          },
        },
      },
    },
  );
  let tree, value;
  function Probe() {
    value = module.usePerpsChartLineActions(state);
    return null;
  }
  const render = async () =>
    renderer.act(async () => {
      if (tree) tree.update(React.createElement(Probe));
      else tree = renderer.create(React.createElement(Probe));
    });
  await render();
  const action = (patch = {}) => ({
    id: value.getLineId(state.lines[0]),
    type: "priceChange",
    originalPrice: 100,
    price: 101.234567,
    ...patch,
  });
  return {
    state,
    clock,
    calls,
    actions,
    action,
    get value() {
      return value;
    },
    update: async (patch) => {
      Object.assign(state, patch);
      await render();
    },
    run: async (act) =>
      renderer.act(async () => value.onReferenceLineAction(act ?? action())),
    start: async (act) => {
      let request;
      await renderer.act(async () => {
        request = value.onReferenceLineAction(act ?? action());
      });
      return { request };
    },
    settle: async (pending, result) =>
      renderer.act(async () => pending.resolve(result)),
    tick: async (ms) => renderer.act(async () => clock.tickAsync(ms)),
    close: async () => renderer.act(async () => tree.unmount()),
  };
}
