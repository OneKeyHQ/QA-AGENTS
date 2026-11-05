// Complete actual deposit session hook: all RPC endpoints are in-memory local
// responses. No HTTP, wallet import, signing, background instance or fund move.
import { React, renderer, evaluateSource, appRequire } from "./source.mjs";
export const sessionRecipient = "0x" + "a".repeat(40),
  depositAddress = "0x" + "b".repeat(40);
const chain = (chain_id, chain_type, chain_name, min) => ({
  chain_id,
  chain_type,
  chain_name,
  token_address: chain_type === "ethereum" ? "0x" + "c".repeat(40) : "native",
  icon_url: "https://icons.example/" + chain_id + ".png",
  decimals: 6,
  estimated_price_impact_percent: 0.01,
  max_slippage_percent: 0.5,
  estimated_processing_time: 60,
  minimum_deposit_amount_usd: min,
});
export const sourceCatalog = [
  {
    symbol: "USDC",
    name: "USD Coin",
    chains: [
      chain("42161", "ethereum", "Arbitrum", 3),
      chain("1", "ethereum", "Ethereum", 10),
    ],
  },
  {
    symbol: "BTC",
    name: "Bitcoin",
    chains: [chain("bitcoin", "bitcoin", "Bitcoin", 3)],
  },
];
export const sessionAddress = {
  sessionId: "session-local-123",
  depositAddress,
  depositWalletId: "local-wallet",
  sourceChainType: "ethereum",
  wallets: [
    { chainType: "ethereum", address: depositAddress, isPrimary: true },
    { chainType: "bitcoin", address: "bc1qlocaltestaddress", isPrimary: false },
  ],
};
export async function unifoldSessionFixture(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const clock =
      patch.clock ??
      appRequire("@sinonjs/fake-timers").createClock(1800000000000),
    state = {
      enabled: true,
      account: sessionRecipient,
      expectedRecipient: sessionRecipient,
      cache: new Map(),
      records: [],
      ...patch,
    },
    events = {
      assets: [],
      address: [],
      activation: [],
      claims: [],
      loads: [],
      tracks: [],
      settles: [],
      finalizes: [],
      ledger: 0,
    };
  const constants = evaluateSource(
      "packages/kit/src/views/Perp/consts/unifold.ts",
    ),
    types = evaluateSource("packages/shared/types/unifoldDeposit.ts");
  const shared = evaluateSource(
    "packages/shared/src/utils/unifoldDepositUtils.ts",
    {
      mocks: {
        "../../types/unifoldDeposit": types,
        "../errors": { OneKeyError: Error },
      },
    },
  );
  const recipient = evaluateSource(
    "packages/kit/src/views/Perp/utils/unifoldRecipient.ts",
    {
      mocks: {
        "@onekeyhq/shared/src/utils/accountUtils": {
          isWatchingAccount: () => false,
        },
      },
    },
  );
  const api = {};
  for (const [method, event, fallback] of [
    ["getSupportedAssets", "assets", () => state.catalog ?? sourceCatalog],
    ["createDepositAddress", "address", () => state.address ?? sessionAddress],
    [
      "getActivationStatus",
      "activation",
      () =>
        Object.hasOwn(state, "activation")
          ? state.activation
          : {
              isSanctioned: false,
              userExists: true,
              sponsored: true,
              activationFee: "1",
            },
    ],
    [
      "claimDepositSessionTracking",
      "claims",
      () => ({ sessionStart: clock.now - 60000 }),
    ],
    ["listDepositExecutions", "loads", () => state.records],
    ["trackLiveSessionExecutions", "tracks", () => {}],
    ["settleAnnouncedExecution", "settles", () => {}],
    ["finalizeDepositSessionTracking", "finalizes", () => {}],
  ])
    api[method] = async (req) => {
      events[event].push(req);
      return state[method] ? state[method](req) : fallback();
    };
  const actual = evaluateSource(
    "packages/kit/src/views/Perp/hooks/usePerpsUnifoldDepositSession.ts",
    {
      globals: {
        Date: clock.Date,
        Error,
        setTimeout: clock.setTimeout.bind(clock),
        clearTimeout: clock.clearTimeout.bind(clock),
        setInterval: clock.setInterval.bind(clock),
        clearInterval: clock.clearInterval.bind(clock),
      },
      mocks: {
        "@onekeyhq/kit/src/background/instance/backgroundApiProxy": {
          serviceUnifoldDeposit: api,
          serviceHyperliquidSubscription: {
            enableLedgerUpdatesSubscription: async () => events.ledger++,
          },
        },
        "@onekeyhq/kit-bg/src/states/jotai/atoms": {
          perpsActiveAccountAtom: { atom: () => ({}) },
          useDevSettingsPersistAtom: () => [state.dev ?? {}],
          usePerpsActiveAccountAtom: () => [{ accountAddress: state.account }],
        },
        "@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore": {
          jotaiDefaultStore: { get: () => ({ accountAddress: state.account }) },
        },
        "@onekeyhq/shared/src/platformEnv": { isDev: false },
        "@onekeyhq/shared/src/utils/miscUtils": {
          generateUUID: () => "local-claim-id",
        },
        "@onekeyhq/shared/src/utils/swrCacheUtils": {
          swrCacheUtils: {
            get: (k) => state.cache.get(k),
            set: (k, v) => state.cache.set(k, v),
          },
        },
        "@onekeyhq/shared/src/utils/unifoldDepositUtils": shared,
        "@onekeyhq/shared/types/unifoldDeposit": types,
        "../consts/unifold": constants,
        "../utils/unifoldDestination": evaluateSource(
          "packages/kit/src/views/Perp/utils/unifoldDestination.ts",
        ),
        "../utils/unifoldExecution": evaluateSource(
          "packages/kit/src/views/Perp/utils/unifoldExecution.ts",
        ),
        "../utils/unifoldRecipient": recipient,
      },
    },
  );
  let result, notify, tree;
  function Probe() {
    const [, set] = React.useState(0);
    notify = () => set((n) => n + 1);
    result = actual.usePerpsUnifoldDepositSession({
      enabled: state.enabled,
      expectedRecipient: state.expectedRecipient,
    });
    return null;
  }
  if (!patch.deferMount)
    await renderer.act(async () => {
      tree = renderer.create(React.createElement(Probe));
    });
  return {
    useSession: actual.usePerpsUnifoldDepositSession,
    state,
    events,
    clock,
    types,
    result: () => result,
    async update(p) {
      Object.assign(state, p);
      await renderer.act(async () => notify());
    },
    async tick(ms = 0) {
      await renderer.act(async () => {
        await clock.tickAsync(ms);
      });
    },
    async action(fn) {
      await renderer.act(async () => fn(result));
    },
    async close() {
      await renderer.act(async () => tree.unmount());
    },
  };
}
