// Actual pinned exchange method -> account-bound status updater -> atom reducer.
// Only local sinks: no wallet signing, SDK client, network, or app connection.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSource } from "./source.mjs";
import { sourceClass } from "./twap-flow-fixture.mjs";
import { fixture as componentFixture } from "./dusting-fixture.mjs";
const A = "0xaaa",
  B = "0xbbb";
function serviceFixture() {
  const state = {
    account: A,
    dust: undefined,
    now: 100000,
    server: { [A]: true, [B]: false },
    permitted: true,
    failure: null,
    wait: null,
  };
  const requests = [],
    logs = [];
  const { getPerpsSpotDustingNextState } = evaluateSource(
    "packages/kit-bg/src/states/jotai/atoms/perps.ts",
    {
      names: ["getPerpsSpotDustingNextState"],
      globals: { SPOT_DUSTING_LIVE_RECONCILE_GRACE_MS: 15000 },
    },
  );
  const Status = sourceClass(
    "packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquid.ts",
    ["updateSpotDustingOptOutStatus"],
    {
      Date: { now: () => state.now },
      getPerpsSpotDustingNextState,
      perpsActiveAccountAtom: {
        get: async () => ({ accountAddress: state.account }),
      },
      perpsSpotDustingAtom: {
        set: async (fn) => {
          state.dust = fn(state.dust);
        },
      },
    },
  );
  const status = new Status();
  const Exchange = sourceClass(
    "packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidExchange.ts",
    ["setSpotDustingOptOut"],
    {
      Date: { now: () => state.now },
      convertHyperLiquidResponse: (fn) => fn(),
      defaultLogger: {
        perp: { hyperliquid: { setSpotDustingOptOut: (v) => logs.push(v) } },
      },
      buildHyperLiquidLogResult: () => ({}),
      extractHyperLiquidErrorResponse: () => undefined,
      serializeHyperLiquidError: (e) => e.message,
    },
  );
  const exchange = new Exchange();
  exchange.checkAccountCanTrade = async () => {
    if (!state.permitted) throw Error("permission denied");
  };
  exchange.getExchangeClientForTrading = async () => {
    const account = state.account;
    return {
      spotUser: async (payload) => {
        requests.push({ account, payload });
        if (state.wait) await state.wait;
        if (state.failure) throw state.failure;
        state.server[account] = payload.toggleSpotDusting.optOut;
        return { status: "ok" };
      },
    };
  };
  exchange._buildLogContext = async () => ({ accountAddress: state.account });
  exchange.backgroundApi = { serviceHyperliquid: status };
  const refresh = () =>
    status.updateSpotDustingOptOutStatus({
      accountAddress: state.account,
      optOut: state.server[state.account],
      source: "live",
    });
  return { state, requests, logs, status, exchange, refresh };
}
for (const optOut of [false, true])
  test(`D19-18/26/30 actual service optOut=${optOut} payload, atom ownership and fresh-load readback`, async () => {
    const f = serviceFixture();
    const response = await f.exchange.setSpotDustingOptOut({ optOut });
    assert.equal(response.status, "ok");
    assert.equal(f.requests.length, 1);
    assert.equal(f.requests[0].account, A);
    assert.equal(f.requests[0].payload.toggleSpotDusting.optOut, optOut);
    assert.equal(f.state.dust.optOut, optOut);
    assert.equal(f.state.dust.accountAddress, A);
    assert.equal(f.state.dust.source, "local");
    f.state.dust = undefined;
    await f.refresh();
    assert.equal(f.state.dust.optOut, optOut);
    assert.equal(f.state.dust.source, "live");
    const ui = await componentFixture({
      optOut: f.state.dust.optOut,
      address: A,
      statusAddress: A,
    });
    try {
      assert.equal(ui.switch().value, !optOut);
      assert.equal(ui.switch().disabled, false);
    } finally {
      await ui.dispose();
    }
  });
test("D19-19/20 service rejects missing permission and ignores missing/wrong-account status before writes", async () => {
  const f = serviceFixture();
  f.state.permitted = false;
  await assert.rejects(
    f.exchange.setSpotDustingOptOut({ optOut: false }),
    /permission denied/u,
  );
  assert.equal(f.requests.length, 0);
  assert.equal(f.logs.length, 0);
  for (const address of [null, undefined, B])
    await f.status.updateSpotDustingOptOutStatus({
      accountAddress: address,
      optOut: false,
      source: "live",
    });
  assert.equal(f.state.dust, undefined);
  await f.status.updateSpotDustingOptOutStatus({
    accountAddress: "0xAAA",
    optOut: true,
    source: "live",
  });
  assert.equal(f.state.dust.accountAddress, A);
  assert.equal(f.state.dust.optOut, true);
});
for (const message of [
  "User rejected signing",
  "Network error",
  "Request timeout",
])
  test(`D19-28 actual service failure ${message} cannot persist a false success and supports retry`, async () => {
    const f = serviceFixture();
    await f.refresh();
    f.state.failure = Error(message);
    await assert.rejects(
      f.exchange.setSpotDustingOptOut({ optOut: false }),
      new RegExp(message, "u"),
    );
    assert.equal(f.state.server[A], true);
    assert.equal(f.state.dust.optOut, true);
    assert.equal(f.logs.at(-1).error, message);
    f.state.failure = null;
    await f.exchange.setSpotDustingOptOut({ optOut: false });
    f.state.dust = undefined;
    await f.refresh();
    assert.equal(f.state.dust.optOut, false);
    assert.equal(f.requests.length, 2);
  });
for (const fail of [false, true])
  test(`D19-29 actual A response ${fail ? "failure" : "success"} after switching B cannot overwrite B, return A refreshes its own server value`, async () => {
    const f = serviceFixture();
    await f.refresh();
    let release;
    f.state.wait = new Promise((r) => {
      release = r;
    });
    const pending = f.exchange.setSpotDustingOptOut({ optOut: false });
    for (let i = 0; !f.requests.length && i < 20; i++)
      await new Promise((r) => setImmediate(r));
    if (!f.requests.length) {
      release();
      await pending;
      assert.fail("Service failed to reach local request sink within 20 turns");
    }
    f.state.account = B;
    f.state.dust = undefined;
    await f.refresh();
    const before = f.state.dust;
    if (fail) f.state.failure = Error("A failed");
    release();
    if (fail) await assert.rejects(pending, /A failed/u);
    else await pending;
    assert.equal(f.state.dust, before);
    assert.equal(f.state.dust.accountAddress, B);
    f.state.account = A;
    f.state.dust = undefined;
    await f.refresh();
    assert.equal(f.state.dust.accountAddress, A);
    assert.equal(f.state.dust.optOut, fail);
  });
test("D19-26/27 stale opposite live push is held only within the actual 15s grace; current acknowledgment and expiry reconcile", async () => {
  for (const optOut of [true, false]) {
    const f = serviceFixture();
    await f.exchange.setSpotDustingOptOut({ optOut });
    const current = f.state.dust;
    f.state.now += 14999;
    await f.status.updateSpotDustingOptOutStatus({
      accountAddress: A,
      optOut: !optOut,
      source: "live",
    });
    assert.equal(
      f.state.dust,
      current,
      "Late opposite push cannot undo local success within grace",
    );
    f.state.now++;
    await f.status.updateSpotDustingOptOutStatus({
      accountAddress: A,
      optOut: !optOut,
      source: "live",
    });
    assert.equal(f.state.dust.optOut, !optOut);
    assert.equal(f.state.dust.localMutation, undefined);
    await f.exchange.setSpotDustingOptOut({ optOut });
    await f.refresh();
    assert.equal(f.state.dust.source, "live");
    assert.equal(f.state.dust.localMutation, undefined);
  }
});
