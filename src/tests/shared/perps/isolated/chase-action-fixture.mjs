// Actual chase resolver -> press -> confirmed action callbacks, with the actual
// per-order React task lock. RPC, enable-trading and amendment are local sinks.
// No application proxy, wallet, network or key material is imported.
import {
  React,
  BigNumber,
  renderer,
  evaluateSource,
  evaluateCallback,
  perpsUtils,
  readSource,
  appRequire,
} from "./source.mjs";
const file =
  "packages/kit/src/views/Perp/components/OrderInfoPanel/List/PerpOpenOrdersList.tsx";
export const chaseAccount = "0x" + "1".repeat(40),
  otherChaseAccount = "0x" + "2".repeat(40);
export const chaseOrder = {
  oid: 1,
  coin: "BTC",
  side: "B",
  sz: "0.1",
  origSz: "0.2",
  limitPx: "70000",
  reduceOnly: false,
  orderType: "Limit",
  tif: "Gtc",
  isTrigger: false,
  isPositionTpsl: false,
};
export async function chaseActionFixture(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const state = {
    account: chaseAccount,
    scoped: chaseAccount,
    canMutate: true,
    locale: "zh_CN",
    meta: { isSpot: false, universe: { szDecimals: 5 } },
    book: { levels: [[{ px: "81000" }], [{ px: "81001" }]] },
    ...patch,
  };
  const events = {
    meta: [],
    books: [],
    dialogs: [],
    orders: [],
    errors: [],
    enabled: 0,
  };
  const activeRef = { current: state.account },
    scopedRef = { current: state.scoped };
  const utils = perpsUtils(),
    { ETranslations } = evaluateSource(
      "packages/shared/src/locale/enum/translations.ts",
    );
  const intl = appRequire("react-intl").createIntl({
    locale: state.locale.replace("_", "-"),
    messages: JSON.parse(
      readSource("packages/shared/src/locale/json/" + state.locale + ".json"),
    ),
    onError: (e) => {
      throw e;
    },
  });
  const { useChasingOrderTask } = evaluateSource(
    "packages/kit/src/views/Perp/components/OrderInfoPanel/hooks/useChasingOrderTask.ts",
  );
  let task, tree;
  function Probe() {
    task = useChasingOrderTask();
    return null;
  }
  await renderer.act(async () => {
    tree = renderer.create(React.createElement(Probe));
  });
  const eligible = evaluateSource(
    "packages/kit/src/views/Perp/components/OrderInfoPanel/utils.ts",
    {
      names: ["canChasePerpsOrder"],
      globals: {
        BigNumber,
        ...utils,
        getPerpsChaseOrderAmendKind: evaluateSource(
          "packages/shared/src/utils/perpsTpSlUtils.ts",
        ).getPerpsChaseOrderAmendKind,
      },
    },
  ).canChasePerpsOrder;
  const common = {
    ...utils,
    intl,
    ETranslations,
    Error,
    OneKeyLocalError: class extends Error {},
    Toast: { error: (v) => events.errors.push(JSON.parse(JSON.stringify(v))) },
    activeAccountAddressRef: activeRef,
    scopedAccountAddressRef: scopedRef,
    backgroundApiProxy: {
      serviceHyperliquid: {
        getSymbolMeta: async (p) => {
          events.meta.push(p);
          return state.meta;
        },
        fetchL2BookByCoin: async (p) => {
          events.books.push(p);
          if (state.bookRequest) return state.bookRequest();
          return state.book;
        },
      },
    },
    currentUser: { accountAddress: state.account },
    accountScopedAddress: state.scoped,
    canMutateScopedOrders: state.canMutate,
    canChasePerpsOrder: eligible,
    isChasingOrder: (oid) => task.isChasingOrder(oid),
    runChasingOrderTask: (oid, fn) => task.runChasingOrderTask(oid, fn),
    ensureTradingEnabled: async () => {
      events.enabled++;
      if (state.ensure) return state.ensure();
    },
    actions: {
      current: {
        chaseOrder: async (p) => {
          events.orders.push(JSON.parse(JSON.stringify(p)));
          if (state.amend) return state.amend(p);
        },
      },
    },
    perpsCustomSettings: { skipOrderConfirm: false },
    showChaseOrderConfirmDialog: (v) => events.dialogs.push(v),
  };
  const resolve = evaluateCallback(file, "resolveChaseTargetPrice", common);
  const amend = evaluateCallback(file, "handleChaseOrder", {
    ...common,
    resolveChaseTargetPrice: resolve,
  });
  const press = evaluateCallback(file, "handleChaseOrderPress", {
    ...common,
    resolveChaseTargetPrice: resolve,
    handleChaseOrder: amend,
  });
  return {
    state,
    events,
    activeRef,
    scopedRef,
    press: async (order = chaseOrder) => renderer.act(async () => press(order)),
    confirm: async (index = events.dialogs.length - 1) =>
      renderer.act(async () => events.dialogs[index].onConfirm()),
    async beginPress(order = chaseOrder) {
      let pending;
      await renderer.act(async () => {
        pending = press(order);
        await Promise.resolve();
      });
      return { pending };
    },
    async beginConfirm(index = events.dialogs.length - 1) {
      let pending;
      await renderer.act(async () => {
        pending = events.dialogs[index].onConfirm();
        await Promise.resolve();
      });
      return { pending };
    },
    async finish(pending, release) {
      await renderer.act(async () => {
        release();
        await pending;
      });
    },
    busy: () => [chaseOrder.oid].filter((oid) => task.isChasingOrder(oid)),
    resolve,
    close: () => renderer.act(async () => tree.unmount()),
  };
}
