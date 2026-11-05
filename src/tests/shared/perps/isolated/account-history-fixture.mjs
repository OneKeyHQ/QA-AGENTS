// Actual account history list/rows, deposit scoping and ledger REST action.
// In-memory atoms and deferred REST are local. No account balances, signatures,
// transport or real wallet are loaded; table layout/virtualization is a host.
import {
  React,
  renderer,
  evaluateSource,
  readSource,
  perpsUtils,
  appRequire,
} from "./source.mjs";
import { sourceClass } from "./twap-flow-fixture.mjs";
import { numberUtils } from "./number-format-source.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const base = "packages/kit/src/views/Perp/components/OrderInfoPanel/";
const af = "packages/kit/src/states/jotai/contexts/hyperliquid/actions.ts";
const locale = evaluateSource(
  "packages/shared/src/locale/enum/translations.ts",
);
const messages = Object.fromEntries(
  ["zh_CN", "en_US"].map((x) => [
    x,
    JSON.parse(readSource(`packages/shared/src/locale/json/${x}.json`)),
  ]),
);
const host =
  (name) =>
  ({ children, ...props }) =>
    React.createElement(name, props, children);
export const ledgerRecord = (
  hash,
  type,
  usdc,
  time = 1800000000000,
  extra = {},
) => ({ hash, time, delta: { type, usdc, ...extra } });
export async function accountHistoryFixture(patch = {}) {
  const state = {
    account: { accountAddress: "0xaaa", accountId: "local-A" },
    ledger: { accountAddress: "0xaaa", updates: [], isLoaded: true },
    orders: [],
    isActive: true,
    locale: "zh_CN",
    response: [],
    failure: false,
    pending: null,
    ...patch,
  };
  const calls = { rest: [], poll: [], refresh: 0, errors: [] };
  let tree,
    notify = () => {};
  const intl = () => ({
    formatMessage: ({ id }) => {
      if (!(id in messages[state.locale]))
        throw Error(`Missing translation ${id}`);
      return messages[state.locale][id];
    },
  });
  const active = { get: async () => state.account };
  const deposits = {
    get: async () => ({ orders: state.orders }),
    set: async (fn) => {
      state.orders = fn({ orders: state.orders }).orders;
      notify();
    },
  };
  const helpers = evaluateSource(af, {
    names: [
      "MAX_LEDGER_UPDATES",
      "getLedgerUpdateKey",
      "sortAndLimitLedgerUpdates",
      "mergeLedgerUpdates",
      "clearMatchedDepositOrders",
    ],
    globals: { perpsDepositOrderAtom: deposits },
  });
  const Actions = sourceClass(af, ["loadLedgerUpdatesByRest"], {
    ...helpers,
    contextAtomMethod: (fn) =>
      function (...args) {
        return fn.call(
          this,
          () => state.ledger,
          (_, value) => {
            state.ledger =
              typeof value === "function" ? value(state.ledger) : value;
            notify();
          },
          ...args,
        );
      },
    perpsActiveAccountAtom: active,
    perpsLedgerUpdatesAtom: () => "ledger",
    backgroundApiProxy: {
      serviceHyperliquid: {
        getUserNonFundingLedgerUpdates: async (address) => {
          calls.rest.push(address);
          const response = state.response,
            failure = state.failure,
            pending = state.pending;
          if (pending) await pending.promise;
          if (failure) throw Error("local ledger failure");
          return response;
        },
      },
    },
    defaultLogger: {
      app: { error: { log: (text) => calls.errors.push(text) } },
    },
  });
  const action = new Actions(),
    actions = {
      current: {
        loadLedgerUpdatesByRest: (...args) =>
          action.loadLedgerUpdatesByRest(...args),
        refreshAllPerpsData: async () => {
          calls.refresh++;
        },
      },
    };
  const atoms = {
    usePerpsActiveAccountAtom: () => [state.account],
    usePerpsDepositOrderAtom: () => [{ orders: state.orders }],
  };
  const deposit = evaluateSource(
    "packages/kit/src/views/Perp/hooks/usePerpDeposit.ts",
    {
      names: ["usePerpDepositOrder"],
      globals: {
        ...React,
        ...atoms,
        backgroundApiProxy: {
          serviceSwap: {
            perpDepositOrderFetchLoop: async (args) => calls.poll.push(args),
          },
        },
      },
    },
  );
  const utils = evaluateSource(base + "utils.ts", {
    mocks: {
      "@onekeyhq/shared/src/locale": locale,
      "@onekeyhq/shared/src/utils/numberUtils": numberUtils(),
      "@onekeyhq/shared/src/utils/perpsTpSlUtils": evaluateSource(
        "packages/shared/src/utils/perpsTpSlUtils.ts",
      ),
      "@onekeyhq/shared/src/utils/perpsUtils": perpsUtils(),
    },
  });
  const dates = evaluateSource("packages/shared/src/utils/dateUtils.ts", {
    mocks: {
      "date-fns": appRequire("date-fns"),
      "date-fns-tz": {
        formatInTimeZone: () => {
          throw Error("Explicit time-zone conversion outside fixture");
        },
      },
      "@onekeyhq/shared/src/errors": { OneKeyLocalError: Error },
      "../locale": locale,
      "../locale/appLocale": {
        appLocale: {
          getLocale: () => (state.locale === "en_US" ? "en-US" : "zh-CN"),
          intl: { formatMessage: ({ id }) => messages[state.locale][id] },
        },
      },
      "../locale/dateLocaleMap": {
        DateLocaleMap: {
          "zh-CN": appRequire("date-fns/locale").zhCN,
          "en-US": appRequire("date-fns/locale").enUS,
        },
      },
      "../locale/getDefaultLocale": { getDefaultLocale: () => "zh-CN" },
    },
  });
  const components = Object.fromEntries(
    ["Skeleton", "SizableText", "XStack", "YStack", "Icon"].map((x) => [
      x,
      host(x),
    ]),
  );
  const common = {
    "react-intl": { useIntl: intl },
    "@onekeyhq/components": components,
    "@onekeyhq/kit-bg/src/states/jotai/atoms": atoms,
  };
  const row = evaluateSource(base + "Components/AccountRow.tsx", {
    mocks: {
      ...common,
      "@onekeyhq/kit/src/components/ListItem": { ListItem: host("ListItem") },
      "@onekeyhq/shared/src/locale/enum/translations": locale,
      "@onekeyhq/shared/src/utils/dateUtils": dates,
      "@onekeyhq/shared/src/utils/numberUtils": numberUtils(),
      "../utils": utils,
    },
  });
  const list = evaluateSource(base + "List/PerpAccountList.tsx", {
    mocks: {
      ...common,
      "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid": {
        useHyperliquidActions: () => actions,
      },
      "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms": {
        usePerpsLedgerUpdatesAtom: () => [state.ledger],
      },
      "@onekeyhq/shared/src/locale": locale,
      "@onekeyhq/shared/types/swap/types": evaluateSource(
        "packages/shared/types/swap/types.ts",
        { names: ["ESwapTxHistoryStatus"] },
      ),
      "../../../hooks/usePerpDeposit": deposit,
      "../Components/AccountRow": row,
      "../Components/PerpMobileEmptyState": {
        PerpMobileEmptyState: host("MobileEmpty"),
      },
      "./CommonTableListView": {
        CommonTableListView: (props) =>
          React.createElement(
            "AccountTable",
            props,
            props.data.map((item, index) =>
              React.createElement(
                "LedgerRow",
                { key: `${index}:${item.hash}`, record: item },
                props.renderRow(item, index),
              ),
            ),
          ),
      },
    },
  });
  function Probe() {
    const [, bump] = React.useState(0);
    notify = () => bump((x) => x + 1);
    return React.createElement(list.PerpAccountList, {
      isActive: state.isActive,
      isMobile: false,
    });
  }
  const render = () =>
    renderer.act(async () => {
      if (tree) tree.update(React.createElement(Probe));
      else tree = renderer.create(React.createElement(Probe));
    });
  await render();
  return {
    state,
    calls,
    actions: action,
    helpers,
    dates,
    table: () => tree.root.findByType("AccountTable").props,
    rows: () => tree.root.findAllByType("LedgerRow"),
    texts: (row) =>
      row.findAllByType("SizableText").map((n) => ({
        text: n.children
          .filter((v) => typeof v === "string" || typeof v === "number")
          .join(""),
        color: n.props.color,
      })),
    update: async (value) => {
      Object.assign(state, value);
      await render();
    },
    force: async () =>
      renderer.act(async () => action.loadLedgerUpdatesByRest({ force: true })),
    startForce: async () => {
      let promise;
      await renderer.act(async () => {
        promise = action.loadLedgerUpdatesByRest({ force: true });
      });
      return { promise };
    },
    settle: async (deferred) =>
      renderer.act(async () => {
        deferred.resolve();
        await Promise.resolve();
      }),
    close: async () => renderer.act(async () => tree.unmount()),
  };
}
