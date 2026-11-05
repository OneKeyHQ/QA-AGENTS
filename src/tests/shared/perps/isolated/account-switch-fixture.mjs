// Actual account change method including all request-id guards. Local atom,
// account-resolution and persistence adapters replace the background runtime.
import { appRequire, evaluateSource } from "./source.mjs";
import { sourceClass } from "./twap-flow-fixture.mjs";
const file =
  "packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquid.ts";
export function accountSwitchFixture(patch = {}) {
  const clock = appRequire("@sinonjs/fake-timers").createClock(1800000000000);
  const timerUtils = evaluateSource("packages/shared/src/utils/timerUtils.ts", {
    globals: {
      setTimeout: clock.setTimeout.bind(clock),
      clearTimeout: clock.clearTimeout.bind(clock),
      global: {},
    },
  }).default;
  const { HIDE_SELECT_ACCOUNT_LOADING_DELAY_MS } = evaluateSource(file, {
    names: ["HIDE_SELECT_ACCOUNT_LOADING_DELAY_MS"],
    globals: { timerUtils },
  });
  const { PERPS_NETWORK_ID } = evaluateSource(
    "packages/shared/src/consts/perp.ts",
    {
      names: ["PERPS_NETWORK_ID"],
      globals: { presetNetworksMap: { arbitrum: { id: "evm--42161" } } },
    },
  );
  const state = {
    walletType: "hd",
    btcOnly: false,
    beforeSet: undefined,
    resolve: async (params) => ({
      id: params.accountId ?? params.indexedAccountId,
      address: params.accountId === "A" ? "0xAaA" : "0xBbB",
    }),
    profile: async () => "hd",
    hydrate: async () => {},
    persist: async () => {},
    ...patch,
  };
  const data = {
    perpsActiveAccountAtom: { accountId: "A", accountAddress: "0xaaa" },
    perpsAccountLoadingInfoAtom: { selectAccountLoading: false },
    perpsAbstractionModeAtom: { accountAddress: "0xaaa", mode: "old" },
    perpsSpotBalancesAtom: { accountAddress: "0xaaa", old: true },
    perpsActiveAccountSummaryAtom: {
      accountAddress: "0xaaa",
      totalRawUsd: "123",
    },
    perpsLiquidationRiskInputsAtom: { accountAddress: "0xaaa" },
    perpsActiveAccountStatusInfoAtom: {
      accountAddress: "0xaaa",
      canTrade: true,
    },
    spotBalancesAtom: {
      balances: [{ coin: "OLD", total: "2" }],
      isLoaded: true,
    },
    perpsUnifoldActiveRecipientAtom: { accountAddress: "0xaaa" },
  };
  const calls = {
    events: [],
    resolves: [],
    saves: [],
    hydrated: [],
    snapshots: [],
    invalidated: 0,
    abstractionCleared: 0,
    errors: [],
  };
  const atoms = Object.fromEntries(
    Object.keys(data).map((name) => [
      name,
      {
        get: async () => data[name],
        set: async (update) => {
          if (state.beforeSet) await state.beforeSet(name);
          const next =
            typeof update === "function" ? update(data[name]) : update;
          if (name === "perpsUnifoldActiveRecipientAtom")
            await state.persist(next);
          data[name] = next;
          calls.events.push([name, next]);
        },
      },
    ]),
  );
  const Service = sourceClass(
    file,
    [
      "activePerpsAccountChangeRequestId",
      "beginActivePerpsAccountChange",
      "isLatestActivePerpsAccountChange",
      "hideSelectAccountLoadingTimer",
      "changeActivePerpsAccount",
    ],
    {
      ...atoms,
      PERPS_NETWORK_ID,
      HIDE_SELECT_ACCOUNT_LOADING_DELAY_MS,
      setTimeout: clock.setTimeout.bind(clock),
      clearTimeout: clock.clearTimeout.bind(clock),
      invalidatePerpsLiquidationRiskInputs: async () => {
        calls.invalidated += 1;
      },
      console: {
        error: (error) => calls.errors.push(String(error)),
        warn: (...args) => calls.errors.push(args.map(String).join(" ")),
      },
    },
  );
  const service = new Service();
  service.backgroundApi = {
    serviceAccountProfile: {
      _getRequestWalletType: async (params) => state.profile(params),
    },
    serviceAccount: {
      isBtcOnlyFirmwareByWalletId: async () => state.btcOnly,
      getNetworkAccount: async (params) => {
        calls.resolves.push(params);
        return state.resolve(params);
      },
      saveAccountAddresses: async (params) => calls.saves.push(params),
    },
  };
  service.cacheService = {
    hydratePerpsAccountDisplayCache: async (address, current) => {
      calls.hydrated.push(address);
      await state.hydrate(address, current);
    },
    writePerpsAccountDisplaySnapshot: async (data) =>
      calls.snapshots.push(data),
  };
  service.fetchUserAbstractionRawWithCache = {
    clear: () => {
      calls.abstractionCleared += 1;
    },
  };
  const change = (patch = {}) =>
    service.changeActivePerpsAccount({
      walletId: "wallet",
      accountId: "B",
      indexedAccountId: null,
      deriveType: "default",
      ...patch,
    });
  return {
    state,
    data,
    calls,
    service,
    clock,
    atoms,
    change,
    delay: HIDE_SELECT_ACCOUNT_LOADING_DELAY_MS,
  };
}
