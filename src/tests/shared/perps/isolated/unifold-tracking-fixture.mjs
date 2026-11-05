// Actual service tracking state machine + serialized persisted writes + delivery
// claims/ACK. Only persistence, list transport, event bus and clock are local.
import { EventEmitter } from "node:events";
import { evaluateSource, appRequire } from "./source.mjs";
import { sourceClass } from "./twap-flow-fixture.mjs";
const file = "packages/kit-bg/src/services/ServiceUnifoldDeposit.ts";
export function unifoldTrackingFixture(patch = {}) {
  const clock = appRequire("@sinonjs/fake-timers").createClock(1800000000000),
    bus = new EventEmitter();
  const state = {
    tracking: { items: [], watches: [], pendingDeliveries: [] },
    records: [],
    ...patch,
  };
  const events = { writes: 0, loads: [], ledger: 0 };
  const names = [
    "TRACKING_LOOP_INTERVAL_MS",
    "TRACKING_MAX_AGE_MS",
    "TRACKING_MUTE_MAX_AGE_MS",
    "TRACKING_WATCH_MAX_AGE_MS",
    "TRACKING_WATCH_RESUME_GRACE_MS",
    "TRACKING_RESUME_GAP_MS",
    "TERMINAL_DELIVERY_CLAIM_TTL_MS",
  ];
  const constants = evaluateSource(file, { names });
  const shared = evaluateSource(
    "packages/shared/src/utils/unifoldDepositUtils.ts",
    {
      mocks: {
        "../../types/unifoldDeposit": {
          UNIFOLD_ERROR_CODE_LOCAL_INVALID_DEPOSIT_ADDRESS_RESPONSE: 10400,
        },
        "../errors": { OneKeyError: Error },
      },
    },
  );
  const methods = [
    "trackingMutationQueue",
    "trackingLoopBusy",
    "trackingLoopRerun",
    "trackingLastIterationAt",
    "mutateTrackingState",
    "claimDepositSessionTracking",
    "trackLiveSessionExecutions",
    "settleAnnouncedExecution",
    "finalizeDepositSessionTracking",
    "getPendingTerminalDeliveries",
    "tryClaimTerminalDelivery",
    "acknowledgeTerminalDelivery",
    "notifyTerminalDelivery",
    "unifoldDepositTrackingLoop",
    "runTrackingIteration",
  ];
  const Service = sourceClass(file, methods, {
    ...constants,
    ...shared,
    Date: clock.Date,
    setTimeout: clock.setTimeout.bind(clock),
    clearTimeout: clock.clearTimeout.bind(clock),
    appEventBus: bus,
    EAppEventBusNames: { PerpsUnifoldDepositTerminalDelivery: "delivery" },
    perpsUnifoldDepositTrackingAtom: {
      get: async () => state.tracking,
      set: async (next) => {
        events.writes++;
        state.tracking =
          typeof next === "function" ? next(state.tracking) : next;
      },
    },
  });
  const service = new Service();
  service.listDepositExecutions = async (p) => {
    events.loads.push(JSON.parse(JSON.stringify(p)));
    return state.load ? state.load(p) : state.records;
  };
  service.backgroundApi = {
    serviceHyperliquidSubscription: {
      enableLedgerUpdatesSubscription: async () => events.ledger++,
    },
  };
  return {
    state,
    events,
    clock,
    bus,
    service,
    sessionBindings: () =>
      Object.fromEntries(
        [
          "claimDepositSessionTracking",
          "listDepositExecutions",
          "trackLiveSessionExecutions",
          "settleAnnouncedExecution",
          "finalizeDepositSessionTracking",
        ].map((n) => [n, service[n].bind(service)]),
      ),
    close: () => {
      clock.reset();
      bus.removeAllListeners();
    },
  };
}
