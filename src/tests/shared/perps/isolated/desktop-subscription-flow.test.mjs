import test from "node:test";
import assert from "node:assert/strict";
import { subscriptionFlowFixture } from "./subscription-flow-fixture.mjs";
import { deferred } from "./funds-quote-fixture.mjs";
const has = (f, type) =>
  f.active().filter((spec) => spec.type === f.types[type]);
const keys = (f) =>
  f
    .active()
    .map((spec) => spec.key)
    .sort();
test("D10-130 actual plan/spec/service pipeline subscribes spot state only for current logged-in user", async () => {
  const f = subscriptionFlowFixture();
  try {
    await f.update();
    assert.equal(has(f, "SPOT_STATE").length, 0);
    await f.update({ currentUser: "0xaaa" });
    assert.equal(has(f, "SPOT_STATE").length, 1);
    assert.equal(has(f, "SPOT_STATE")[0].params.user, "0xaaa");
    await f.update({ currentUser: null });
    assert.equal(has(f, "SPOT_STATE").length, 0);
  } finally {
    f.close();
  }
});
test("D10-131 actual selector route flags request spot contexts only while selector/spot market needs them, no duplicate across mode switch", async () => {
  const f = subscriptionFlowFixture();
  try {
    await f.update();
    assert.equal(has(f, "SPOT_ASSET_CTXS").length, 0);
    await f.update({
      view: {
        ...f.state.view,
        tokenSelectorOpen: true,
        tokenSelectorTab: "spot",
      },
    });
    await f.tick(300);
    assert.equal(has(f, "SPOT_ASSET_CTXS").length, 1);
    await f.update({ view: { ...f.state.view, tokenSelectorOpen: false } });
    await f.tick(300);
    assert.equal(has(f, "SPOT_ASSET_CTXS").length, 0);
    await f.update({ tradingMode: "spot" });
    assert.equal(has(f, "SPOT_ASSET_CTXS").length, 1);
    assert.equal(has(f, "ACTIVE_ASSET_CTX")[0].params.coin, "@1");
    assert.equal(has(f, "ACTIVE_ASSET_DATA").length, 0);
    const count = f.calls.created.filter(
      (spec) => spec.type === f.types.SPOT_ASSET_CTXS,
    ).length;
    await f.update();
    await f.tick(300);
    assert.equal(
      f.calls.created.filter((spec) => spec.type === f.types.SPOT_ASSET_CTXS)
        .length,
      count,
    );
  } finally {
    f.close();
  }
});
test("D10-132 actual first subscription is immediate; unchanged routine updates coalesce at 300ms, market switches intentionally bypass debounce", async () => {
  const f = subscriptionFlowFixture();
  try {
    await f.update();
    assert.ok(f.active().length > 0);
    const status = f.calls.stateUpdates;
    for (let i = 0; i < 5; i++) await f.update();
    await f.tick(299);
    assert.equal(f.calls.stateUpdates, status);
    await f.tick(1);
    assert.equal(f.calls.stateUpdates, status + 1);
    await f.update({ currentSymbol: "ETH" });
    assert.equal(has(f, "BBO")[0].params.coin, "ETH");
    assert.equal(f.calls.stateUpdates, status + 2);
  } finally {
    f.close();
  }
});
test("D10-139 actual ten mode switches maintain exact latest target without duplicate active keys or duplicate retained global subscriptions", async () => {
  const f = subscriptionFlowFixture({ currentUser: "0xaaa" });
  try {
    await f.update();
    for (let i = 0; i < 10; i++) {
      const mode = i % 2 ? "perp" : "spot";
      await f.update({ tradingMode: mode });
      assert.equal(new Set(keys(f)).size, keys(f).length);
      assert.equal(has(f, "BBO").length, 1);
      assert.equal(
        has(f, "BBO")[0].params.coin,
        mode === "spot" ? "@1" : "BTC",
      );
      assert.equal(has(f, "SPOT_STATE").length, 1);
    }
    for (const type of ["ALL_MIDS", "ALL_DEXS_ASSET_CTXS", "SPOT_STATE"])
      assert.equal(
        f.calls.created.filter((spec) => spec.type === f.types[type]).length,
        1,
      );
    const createdBook = f.calls.created.filter(
        (spec) => spec.type === f.types.L2_BOOK,
      ),
      destroyedBook = f.calls.destroyed.filter(
        (spec) => spec.type === f.types.L2_BOOK,
      );
    assert.equal(createdBook.length - destroyedBook.length, 1);
    assert.equal(has(f, "SPOT_ASSET_CTXS").length, 0);
  } finally {
    f.close();
  }
});
for (const flag of ["favoritesBarSpotActive", "tokenSelectorAll"])
  test(`D10-131 actual ${flag} enables spot contexts as an additional current-source consumer`, async () => {
    const f = subscriptionFlowFixture();
    try {
      await f.update();
      await f.update({
        view: {
          ...f.state.view,
          ...(flag === "tokenSelectorAll"
            ? { tokenSelectorOpen: true, tokenSelectorTab: "all" }
            : { favoritesBarSpotActive: true }),
        },
      });
      await f.tick(300);
      assert.equal(has(f, "SPOT_ASSET_CTXS").length, 1);
    } finally {
      f.close();
    }
  });
test("D10-139 actual account switch replaces all user-scoped keys but keeps global markets", async () => {
  const f = subscriptionFlowFixture({ currentUser: "0xaaa" });
  try {
    await f.update();
    await f.update({ currentUser: "0xbbb" });
    assert.ok(
      f
        .active()
        .filter((spec) => spec.params.user)
        .every((spec) => spec.params.user === "0xbbb"),
    );
    assert.ok(f.calls.destroyed.some((spec) => spec.params.user === "0xaaa"));
    assert.equal(
      f.calls.created.filter((spec) => spec.type === f.types.ALL_MIDS).length,
      1,
    );
  } finally {
    f.close();
  }
});
test("D10-139 actual stale route flag update cannot undo latest selector demand; ledger enable remains sticky", async () => {
  const f = subscriptionFlowFixture();
  try {
    assert.equal(
      await f.service.setRouteSubscriptionState({
        routeStateVersion: 2,
        spotEnabled: true,
        spotAssetCtxsEnabled: true,
        enableLedgerUpdates: true,
      }),
      true,
    );
    assert.equal(
      await f.service.setRouteSubscriptionState({
        routeStateVersion: 1,
        spotEnabled: false,
        spotAssetCtxsEnabled: false,
        enableLedgerUpdates: false,
      }),
      false,
    );
    assert.equal(f.service._currentState.spotAssetCtxsEnabled, true);
    assert.equal(f.service._currentState.spotEnabled, true);
    await f.service.setRouteSubscriptionState({
      routeStateVersion: 3,
      spotEnabled: false,
      spotAssetCtxsEnabled: false,
      enableLedgerUpdates: false,
    });
    assert.equal(f.service._currentState.enableLedgerUpdates, true);
  } finally {
    f.close();
  }
});
test("D10-139 actual serial reconcile coalesces rapid updates while local subscribe is pending and converges to newest market", async () => {
  const gate = deferred(),
    f = subscriptionFlowFixture({
      create: async (spec) => {
        if (spec.params.coin === "BTC") await gate.promise;
      },
    });
  try {
    const first = f.update();
    for (let i = 0; i < 30; i++) await Promise.resolve();
    const second = f.update({ currentSymbol: "ETH" });
    const third = f.update({ currentSymbol: "SOL" });
    gate.resolve();
    await Promise.all([first, second, third]);
    assert.equal(has(f, "BBO").length, 1);
    assert.equal(has(f, "BBO")[0].params.coin, "SOL");
    assert.equal(has(f, "L2_BOOK")[0].params.coin, "SOL");
    assert.equal(new Set(keys(f)).size, keys(f).length);
  } finally {
    gate.resolve();
    f.close();
  }
});
test("D10-139 actual disabled/non-open socket does not create subscriptions and routes recovery locally", async () => {
  const f = subscriptionFlowFixture();
  try {
    f.service.subscriptionsHandlerDisabled = true;
    await f.update();
    assert.equal(f.calls.created.length, 0);
    f.service.subscriptionsHandlerDisabled = false;
    await f.update({ ready: 0 });
    assert.equal(f.calls.created.length, 0);
    assert.equal(f.calls.recovery, 1);
    await f.update({ ready: 1 });
    assert.ok(f.calls.created.length > 0);
  } finally {
    f.close();
  }
});
