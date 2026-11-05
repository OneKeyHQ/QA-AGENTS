// Actual withdraw routing hook + actual usePromiseResult. Local route endpoint,
// settings/clock/visibility adapters; no signing or exchange imports.
import test from "node:test";
import assert from "node:assert/strict";
import { React, renderer, evaluateSource } from "./source.mjs";
import { promiseHookFixture } from "./promise-hook-fixture.mjs";
import { fundsConstants } from "./funds-submit-fixture.mjs";
import { deferred } from "./funds-quote-fixture.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const plain = (value) => JSON.parse(JSON.stringify(value));
async function fixture(patch = {}) {
  const state = {
    enabled: true,
    isSubmitting: false,
    policy: "cctp",
    route: "cctp",
    settings: {
      lastUsdcWithdrawDestinationId: "ethereum",
      preserveOther: true,
    },
    pending: null,
    fail: false,
    ...patch,
  };
  const runtime = promiseHookFixture(state),
    requests = [],
    changes = [],
    settingsWrites = [];
  let tree, value;
  const setSettings = (next) => {
    state.settings = next(state.settings);
    settingsWrites.push(plain(state.settings));
  };
  const change = () => changes.push(true);
  const { useUsdcWithdrawRouting } = evaluateSource(
    "packages/kit/src/views/Perp/components/TradingPanel/modals/useUsdcWithdrawRouting.ts",
    {
      mocks: {
        "@onekeyhq/components": runtime.components,
        "@onekeyhq/kit/src/background/instance/backgroundApiProxy": {
          serviceHyperliquidExchange: {
            getUsdcWithdrawRoute: async (args) => {
              requests.push(args);
              const pending = state.pending,
                fail = state.fail,
                route = state.route;
              if (pending) return pending.promise;
              if (fail) throw Error("local offline");
              return route;
            },
          },
        },
        "@onekeyhq/kit/src/hooks/usePromiseResult": {
          usePromiseResult: runtime.usePromiseResult,
        },
        "@onekeyhq/kit-bg/src/states/jotai/atoms": {
          usePerpsCommonConfigPersistAtom: () => [
            { perpConfigCommon: { withdrawChannel: state.policy } },
          ],
          usePerpsCustomSettingsAtom: () => [state.settings, setSettings],
        },
        "@onekeyhq/shared/types/hyperliquid/perp.constants": fundsConstants,
      },
    },
  );
  function Probe() {
    value = useUsdcWithdrawRouting({
      enabled: state.enabled,
      isSubmitting: state.isSubmitting,
      onRoutingChange: change,
    });
    return null;
  }
  const render = () =>
    renderer.act(async () => {
      if (tree) tree.update(React.createElement(Probe));
      else tree = renderer.create(React.createElement(Probe));
    });
  await render();
  // Actual usePromiseResult schedules an initial polling-interval change at
  // zero delay; flush the controlled queue, not an arbitrary wall-clock wait.
  await renderer.act(async () => runtime.clock.tickAsync(0));
  return {
    state,
    runtime,
    requests,
    changes,
    settingsWrites,
    get value() {
      return value;
    },
    update: async (patch) => {
      Object.assign(state, patch);
      await render();
    },
    tick: async (ms) => renderer.act(async () => runtime.clock.tickAsync(ms)),
    refresh: async () => renderer.act(async () => value.refreshWithdrawRoute()),
    settle: async (pending, result) =>
      renderer.act(async () => {
        pending.resolve(result);
        await Promise.resolve();
      }),
    visibility: async (visible) =>
      renderer.act(async () => runtime.visibility(visible)),
    close: async () => renderer.act(async () => tree.unmount()),
  };
}
test("D20-61/66 actual route hook starts from saved network, exposes all six choices, legacy restricts Arb and preserves unrelated settings", async () => {
  const f = await fixture();
  try {
    assert.equal(f.requests.length, 1);
    assert.equal(f.requests[0].forceRefresh, true);
    assert.equal(f.value.withdrawRoute, "cctp");
    assert.equal(f.value.withdrawDestinationId, "ethereum");
    assert.deepEqual(plain(f.value.withdrawDestinations.map((d) => d.id)), [
      "ethereum",
      "avalanche",
      "optimism",
      "arbitrum",
      "base",
      "hyperevm",
    ]);
    await f.update({ policy: "legacy", route: "bridge" });
    assert.equal(f.value.withdrawRoute, "bridge");
    assert.equal(f.value.withdrawDestinationId, "arbitrum");
    assert.deepEqual(plain(f.value.withdrawDestinations.map((d) => d.id)), [
      "arbitrum",
    ]);
    assert.deepEqual(plain(f.state.settings), {
      lastUsdcWithdrawDestinationId: "arbitrum",
      preserveOther: true,
    });
    assert.equal(f.changes.length, 1);
    await f.update({ policy: "cctp", route: "cctp" });
    assert.equal(f.value.withdrawRoute, "cctp");
    assert.equal(f.value.withdrawDestinations.length, 6);
    assert.equal(f.value.withdrawDestinationId, "arbitrum");
    assert.equal(f.changes.length, 2);
  } finally {
    await f.close();
  }
});
test("D20-61/68 actual invalid saved network falls back to Arb without clobbering preferences", async () => {
  const f = await fixture({
    settings: {
      lastUsdcWithdrawDestinationId: "not-a-network",
      preserveOther: true,
    },
  });
  try {
    assert.equal(f.value.withdrawDestinationId, "arbitrum");
    assert.equal(f.settingsWrites.length, 0);
  } finally {
    await f.close();
  }
});
test("D20-68 actual route poll fires at 30000ms, visibility retry runs once and unmount removes listener/timer", async () => {
  const f = await fixture();
  try {
    assert.equal(f.requests.length, 1);
    await f.tick(29999);
    assert.equal(f.requests.length, 1);
    await f.tick(1);
    assert.equal(f.requests.length, 2);
    await f.visibility(false);
    assert.equal(f.requests.length, 2);
    await f.visibility(true);
    assert.equal(f.requests.length, 3);
  } finally {
    await f.close();
  }
  const before = f.requests.length;
  await f.tick(90000);
  await f.visibility(true);
  assert.equal(f.requests.length, before);
  assert.equal(f.runtime.listeners.size, 0);
});
for (const patch of [{ enabled: false }, { isSubmitting: true }])
  test(`D20-75/76 actual route refresh suppressed ${JSON.stringify(patch)}`, async () => {
    const f = await fixture(patch);
    try {
      assert.equal(f.requests.length, 0);
      await f.tick(90000);
      await f.visibility(true);
      await f.refresh();
      assert.equal(f.requests.length, 0);
      assert.equal(f.changes.length, 0);
    } finally {
      await f.close();
    }
  });
test("D20-76 actual policy change during signing freezes form; signing completion then applies new policy and resets only destination", async () => {
  const f = await fixture();
  try {
    await f.update({ isSubmitting: true });
    const count = f.requests.length;
    await f.update({ policy: "legacy", route: "bridge" });
    assert.equal(f.value.withdrawDestinationId, "ethereum");
    assert.equal(f.value.withdrawDestinations.length, 6);
    assert.equal(f.changes.length, 0);
    await f.tick(60000);
    await f.visibility(true);
    assert.equal(f.requests.length, count);
    await f.update({ isSubmitting: false });
    assert.equal(f.value.withdrawRoute, "bridge");
    assert.equal(f.value.withdrawDestinationId, "arbitrum");
    assert.equal(f.value.withdrawDestinations.length, 1);
    assert.equal(f.changes.length, 1);
  } finally {
    await f.close();
  }
});
test("D20-76 actual late bridge response after force-legacy removed is ineligible until current cctp result resolves", async () => {
  const old = deferred(),
    next = deferred(),
    f = await fixture({ policy: "legacy", route: "bridge", pending: old });
  try {
    assert.equal(f.value.withdrawRoute, "bridge");
    await f.update({ policy: "cctp", route: "cctp", pending: next });
    assert.equal(f.value.withdrawRoute, undefined);
    await f.settle(old, "bridge");
    assert.equal(f.value.withdrawRoute, undefined);
    await f.settle(next, "cctp");
    assert.equal(f.value.withdrawRoute, "cctp");
    assert.equal(f.value.withdrawDestinations.length, 6);
  } finally {
    old.resolve("bridge");
    next.resolve("cctp");
    await f.close();
  }
});
test("D20-68 actual route failure preserves same-policy accepted route; recovery route change invalidates reviewed form exactly once", async () => {
  const f = await fixture();
  try {
    f.state.fail = true;
    await f.refresh();
    assert.equal(f.value.withdrawRoute, "cctp");
    assert.equal(f.changes.length, 0);
    f.state.fail = false;
    f.state.route = "bridge";
    await f.refresh();
    assert.equal(f.value.withdrawRoute, "bridge");
    assert.equal(f.changes.length, 1);
    await f.refresh();
    assert.equal(f.changes.length, 1);
  } finally {
    await f.close();
  }
});
test("D20-76 failed new-policy refresh cannot reuse prior forced bridge quote", async () => {
  const f = await fixture({ policy: "legacy", route: "bridge" });
  try {
    await f.update({ policy: "cctp", fail: true });
    assert.equal(f.value.withdrawRoute, undefined);
    assert.equal(f.value.withdrawDestinations.length, 6);
    f.state.fail = false;
    f.state.route = "cctp";
    await f.refresh();
    assert.equal(f.value.withdrawRoute, "cctp");
  } finally {
    await f.close();
  }
});
