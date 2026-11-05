import test from "node:test";
import assert from "node:assert/strict";
import { accountSwitchFixture } from "./account-switch-fixture.mjs";
import { deferred } from "./funds-quote-fixture.mjs";
const plain = (value) => JSON.parse(JSON.stringify(value));
async function reproduceLateAddress() {
  const gate = deferred(),
    f = accountSwitchFixture({
      resolve: async (params) => {
        if (params.accountId === "B") await gate.promise;
        return {
          id: params.accountId,
          address: params.accountId === "B" ? "0xbbb" : "0xccc",
        };
      },
    });
  const old = f.change();
  for (let i = 0; i < 40; i++) await Promise.resolve();
  await f.change({ accountId: "C" });
  gate.resolve();
  await old;
  await f.clock.tickAsync(f.delay * 2);
  return f;
}
test("D10-102 diagnostic late stale address clears newest loading-reset timer while preserving newest recipient", async () => {
  const f = await reproduceLateAddress();
  assert.equal(f.data.perpsActiveAccountAtom.accountAddress, "0xccc");
  assert.equal(f.data.perpsAccountLoadingInfoAtom.selectAccountLoading, true);
  assert.equal(f.clock.countTimers(), 0);
});
test(
  "D10-102 latest account loading must finish even if old address resolves later",
  {
    todo: "Pinned changeActivePerpsAccount finally clears shared newest timer before checking request id; stale replacement timer exits without releasing loading. Source-only reproduction, pending TF.",
  },
  async () => {
    const f = await reproduceLateAddress();
    assert.equal(
      f.data.perpsAccountLoadingInfoAtom.selectAccountLoading,
      false,
    );
  },
);
test("D10-102/136 actual account change clears source and UI spot data before new active account published; recipient guard persisted first", async () => {
  const f = accountSwitchFixture();
  const result = await f.change();
  assert.equal(result.accountAddress, "0xbbb");
  assert.deepEqual(plain(f.data.spotBalancesAtom), {
    balances: [],
    isLoaded: false,
  });
  for (const name of [
    "perpsSpotBalancesAtom",
    "perpsActiveAccountSummaryAtom",
    "perpsAbstractionModeAtom",
    "perpsLiquidationRiskInputsAtom",
    "perpsActiveAccountStatusInfoAtom",
  ])
    assert.equal(f.data[name], undefined);
  const sequence = f.calls.events.map(([name]) => name);
  assert.ok(
    sequence.indexOf("spotBalancesAtom") <
      sequence.indexOf("perpsActiveAccountAtom"),
  );
  assert.ok(
    sequence.indexOf("perpsUnifoldActiveRecipientAtom") <
      sequence.indexOf("perpsActiveAccountAtom"),
  );
  assert.deepEqual(f.calls.hydrated, ["0xbbb"]);
  assert.equal(f.calls.invalidated, 1);
  assert.equal(f.calls.abstractionCleared, 1);
  assert.equal(f.data.perpsAccountLoadingInfoAtom.selectAccountLoading, true);
  await f.clock.tickAsync(f.delay - 1);
  assert.equal(f.data.perpsAccountLoadingInfoAtom.selectAccountLoading, true);
  await f.clock.tickAsync(1);
  assert.equal(f.data.perpsAccountLoadingInfoAtom.selectAccountLoading, false);
});
test("D10-136 actual same-address case-insensitive refresh preserves balances/summary, no empty flash or hydrate", async () => {
  const f = accountSwitchFixture();
  const old = f.data.spotBalancesAtom,
    summary = f.data.perpsActiveAccountSummaryAtom;
  await f.change({ accountId: "A" });
  assert.equal(f.data.spotBalancesAtom, old);
  assert.equal(f.data.perpsActiveAccountSummaryAtom, summary);
  assert.equal(f.calls.hydrated.length, 0);
  assert.equal(f.calls.invalidated, 0);
  await f.clock.tickAsync(f.delay);
});
for (const patch of [
  { accountId: null, indexedAccountId: null },
  { accountId: "B", btcOnly: true },
])
  test(`D10-102 actual no supported account clears balances and publishes null address ${JSON.stringify(patch)}`, async () => {
    const f = accountSwitchFixture({ btcOnly: patch.btcOnly });
    await f.change(patch);
    assert.equal(f.data.perpsActiveAccountAtom.accountAddress, null);
    assert.deepEqual(plain(f.data.spotBalancesAtom), {
      balances: [],
      isLoaded: false,
    });
    assert.equal(f.calls.resolves.length, 0);
    assert.equal(f.calls.hydrated.length, 0);
    await f.clock.tickAsync(f.delay);
  });
test("D10-102 actual indexed account resolution uses EVM network and correct index identity, saves returned address", async () => {
  const f = accountSwitchFixture();
  await f.change({
    accountId: "stale",
    indexedAccountId: "INDEX",
    deriveType: "legacy",
  });
  assert.deepEqual(plain(f.calls.resolves), [
    {
      indexedAccountId: "INDEX",
      networkId: "evm--42161",
      deriveType: "legacy",
    },
  ]);
  assert.equal(f.data.perpsActiveAccountAtom.indexedAccountId, "INDEX");
  assert.equal(f.data.perpsActiveAccountAtom.accountId, "INDEX");
  assert.equal(f.calls.saves[0].networkId, "evm--42161");
  await f.clock.tickAsync(f.delay);
});
for (const phase of ["profile", "resolve", "hydrate"])
  test(`D10-136 actual stale ${phase} resolution cannot overwrite newer account or recipient`, async () => {
    const pending = deferred(),
      f = accountSwitchFixture();
    let first = true;
    if (phase === "profile")
      f.state.profile = async () => {
        if (first) {
          first = false;
          await pending.promise;
        }
        return "hd";
      };
    if (phase === "resolve")
      f.state.resolve = async (params) => {
        if (params.accountId === "B") await pending.promise;
        return {
          id: params.accountId,
          address: params.accountId === "B" ? "0xbbb" : "0xccc",
        };
      };
    if (phase === "hydrate")
      f.state.hydrate = async (address) => {
        if (address === "0xbbb") await pending.promise;
      };
    if (phase !== "resolve") {
      const old = f.state.resolve;
      f.state.resolve = async (params) =>
        params.accountId === "C" ? { id: "C", address: "0xccc" } : old(params);
    }
    const requestA = f.change();
    // Let the first request reach the selected local boundary.
    for (let i = 0; i < 50; i++) await Promise.resolve();
    await f.change({ accountId: "C" });
    pending.resolve();
    assert.equal(await requestA, undefined);
    assert.equal(f.data.perpsActiveAccountAtom.accountAddress, "0xccc");
    assert.equal(
      f.data.perpsUnifoldActiveRecipientAtom.accountAddress,
      "0xccc",
    );
    assert.equal(f.calls.snapshots.at(-1).accountAddress, "0xccc");
    await f.clock.tickAsync(f.delay);
    if (phase !== "resolve")
      assert.equal(
        f.data.perpsAccountLoadingInfoAtom.selectAccountLoading,
        false,
      );
  });
test("D10-136 actual delayed stale atom reset cannot erase a newer account value because update function rechecks request id", async () => {
  const gate = deferred(),
    f = accountSwitchFixture();
  let held = false;
  f.state.beforeSet = async (name) => {
    if (name === "perpsSpotBalancesAtom" && !held) {
      held = true;
      await gate.promise;
    }
  };
  const first = f.change();
  for (let i = 0; i < 40; i++) await Promise.resolve();
  f.state.resolve = async () => ({ id: "C", address: "0xccc" });
  await f.change({ accountId: "C" });
  f.data.perpsSpotBalancesAtom = { accountAddress: "0xccc", balances: [1] };
  gate.resolve();
  assert.equal(await first, undefined);
  assert.equal(f.data.perpsSpotBalancesAtom.accountAddress, "0xccc");
  assert.equal(f.data.perpsActiveAccountAtom.accountAddress, "0xccc");
  await f.clock.tickAsync(f.delay);
});
test("D10-136 actual failed recipient persistence refuses to publish new active recipient/account", async () => {
  const f = accountSwitchFixture({
    persist: async () => {
      throw Error("local persistence rejected");
    },
  });
  await assert.rejects(f.change(), /persistence rejected/u);
  assert.equal(f.data.perpsActiveAccountAtom.accountAddress, "0xaaa");
  assert.equal(f.data.perpsUnifoldActiveRecipientAtom.accountAddress, "0xaaa");
  assert.equal(f.calls.snapshots.length, 0);
  await f.clock.tickAsync(f.delay);
});
test("D10-102 actual cache hydrate failure still finishes current account safely and records diagnostic", async () => {
  const f = accountSwitchFixture({
    hydrate: async () => {
      throw Error("local cache failed");
    },
  });
  await f.change();
  assert.equal(f.data.perpsActiveAccountAtom.accountAddress, "0xbbb");
  assert.equal(f.data.spotBalancesAtom.isLoaded, false);
  assert.ok(
    f.calls.errors.some((message) =>
      /hydrate display cache failed/u.test(message),
    ),
  );
  await f.clock.tickAsync(f.delay);
});
test("D10-102 actual address failure clears old assets, releases loading and does not select previous wallet as fallback", async () => {
  const f = accountSwitchFixture({
    resolve: async () => {
      throw Error("local address unsupported");
    },
  });
  await f.change();
  assert.equal(f.data.perpsActiveAccountAtom.accountAddress, null);
  assert.equal(f.data.spotBalancesAtom.balances.length, 0);
  assert.equal(f.calls.saves.length, 0);
  await f.clock.tickAsync(f.delay);
  assert.equal(f.data.perpsAccountLoadingInfoAtom.selectAccountLoading, false);
  assert.ok(f.calls.errors.some((message) => /unsupported/u.test(message)));
});
