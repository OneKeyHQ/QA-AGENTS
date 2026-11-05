// Actual account-status, fee and agent orchestration. All keys, signatures,
// timers, credentials and exchange endpoints terminate at explicit local sinks.
import { sourceClass } from "./twap-flow-fixture.mjs";
import { evaluateSource, perpsUtils, BigNumber } from "./source.mjs";
const serviceFile =
  "packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquid.ts";
const accountUtils = evaluateSource(
  "packages/kit-bg/src/services/ServiceHyperLiquid/utils/perpsAccountStatusCheckUtils.ts",
);
export function enableTradingFixture(patch = {}) {
  const state = {
    account: { accountId: "hd-local--m/44/60", accountAddress: "0xAAA" },
    role: "user",
    approvedFee: 0,
    expectedFee: 40,
    abstraction: "unifiedAccount",
    referralCode: undefined,
    agents: [],
    credentials: new Map(),
    ...patch,
  };
  const calls = [],
    reasons = [],
    timers = new Map(),
    cache = { activatedUser: {}, referrerCodeSetDone: {} };
  let seq = 0;
  const record = (name, payload) => {
    calls.push({ name, payload });
    if (state.failureAt === name) throw Error(name + " rejected");
  };
  const atom = (key) => ({
    get: async () => state[key],
    set: async (value) => {
      state[key] = typeof value === "function" ? value(state[key]) : value;
    },
  });
  const exchange = {
    setup: async (p) => record("setup", p),
    approveBuilderFee: async (p) => {
      record("approveBuilderFee", p);
      return state.feeResult ?? { status: "ok", response: { type: "default" } };
    },
    approveAgent: async (p) => {
      record("approveAgent", p);
      return (
        state.agentResult ?? { status: "ok", response: { type: "default" } }
      );
    },
    removeAgent: async (p) => {
      record("removeAgent", p);
      state.agents = state.agents.filter((a) => a.name !== p.agentName);
      return { status: "ok" };
    },
    setAbstractionWithUserWallet: async (p) => {
      record("setAbstraction", p);
      state.abstraction = p.abstraction;
    },
    setReferrerCode: async (p) => {
      record("setReferrerCode", p);
      state.bound = p.code;
    },
  };
  const clock = class extends Date {
    static now() {
      return 1800000000000;
    }
  };
  const Cls = sourceClass(
    serviceFile,
    ["_checkPerpsAccountStatus", "checkBuilderFeeStatus", "checkAgentStatus"],
    {
      ...accountUtils,
      ...perpsUtils(),
      BigNumber,
      Date: clock,
      hyperLiquidApiClients: {
        infoClient: {
          userRole: async (p) => {
            record("userRole", p);
            return { role: state.role };
          },
          extraAgents: async () => state.agents,
        },
      },
      hyperLiquidCache: cache,
      perpsActiveAccountAtom: atom("account"),
      perpsAccountLoadingInfoAtom: atom("loading"),
      perpsActiveAccountStatusInfoAtom: atom("status"),
      spotBalancesAtom: atom("spotBalances"),
      perpsSpotBalancesAtom: atom("perpsSpotBalances"),
      markPerpsColdStartPerf: () => {},
      defaultLogger: {
        perp: { agentLifeCycle: { trackReason: (r) => reasons.push(r) } },
      },
      setTimeout: (fn) => {
        timers.set(++seq, fn);
        return seq;
      },
      clearTimeout: (id) => timers.delete(id),
      HYPERLIQUID_REFERRAL_CODE: "1KREF",
      HYPERLIQUID_AGENT_TTL_DEFAULT: 86400000 * 30,
      EHyperLiquidAgentName: {
        OneKeyAgent1: "OneKeyAgent1",
        OneKeyAgent2: "OneKeyAgent2",
        OneKeyAgent3: "OneKeyAgent3",
      },
      timerUtils: {
        getTimeDurationMs: ({ day }) => day * 86400000,
        wait: async () => {},
      },
      crypto: { getRandomValues: (array) => array.fill(7) },
      bufferUtils: { bytesToHex: () => "LOCAL-FAKE-KEY-NOT-A-PRIVATE-KEY" },
      ethers: {
        Wallet: class {
          address = "0xLOCAL_AGENT";
        },
      },
      getPbkdf2KdfParamsForNonDbTxNoCache: () => ({}),
      invalidateUserAbstractionRawCache: () => {},
      pTimeout: async (p) => p,
    },
  );
  const service = new Cls();
  service.perpsAccountStatusCheckSeq = 0;
  service.exchangeService = exchange;
  service.getBuilderFeeConfig = async () => ({
    expectBuilderAddress: "0xBUILDER",
    expectMaxBuilderFee: state.expectedFee,
  });
  service.getUserApprovedMaxBuilderFeeWithCache = Object.assign(
    async () => state.approvedFee,
    { clear: () => record("clearFeeCache") },
  );
  service.fetchExtraAgentsWithCache = Object.assign(async () => state.agents, {
    clear: () => record("clearAgentCache"),
  });
  service.fetchUserAbstraction = async () => state.abstraction;
  service.backgroundApi = {
    simpleDb: {
      perp: { getPerpData: async () => ({ referralCode: state.referralCode }) },
    },
    servicePassword: {
      ensureHyperLiquidAgentPasswordSessionReady: async () =>
        record("passwordSession"),
      encodeSensitiveText: async () => {
        record("encodeLocalFakeKey");
        return "LOCAL-ENCODED-FAKE";
      },
    },
    serviceAccount: {
      addOrUpdateHyperLiquidAgentCredential: async (p) => {
        record("saveCredential", p);
        const v = { ...p };
        state.credentials.set(p.agentName, v);
        return { credentialId: "local-id" };
      },
      getHyperLiquidAgentCredentialInfo: async (p) =>
        state.credentials.get(p.agentName),
    },
  };
  return {
    state,
    calls,
    reasons,
    cache,
    timers,
    service,
    async check(params) {
      await service._checkPerpsAccountStatus(params);
      for (let i = 0; i < 5; i++) await Promise.resolve();
    },
    async flush() {
      for (const [id, fn] of [...timers]) {
        timers.delete(id);
        await fn();
      }
    },
  };
}
