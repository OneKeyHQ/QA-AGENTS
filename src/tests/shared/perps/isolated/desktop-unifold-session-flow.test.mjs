import test from "node:test";
import assert from "node:assert/strict";
import {
  unifoldSessionFixture as mount,
  sourceCatalog,
  sessionRecipient,
  depositAddress,
  sessionAddress,
} from "./unifold-session-fixture.mjs";
const plain = (v) => JSON.parse(JSON.stringify(v));
const record = (id, status = "pending") => ({
  executionId: id,
  status,
  terminal: ["succeeded", "failed", "refunded"].includes(status),
});
test("D14-37/38/47 actual full session chain-family selection reuses address; same source never recreates wallet", async () => {
  const f = await mount();
  try {
    assert.equal(f.result().addressState.status, "ready");
    assert.equal(f.result().qrAddress, depositAddress);
    assert.equal(f.result().selection.asset.symbol, "USDC");
    assert.equal(f.result().selection.chain.chain_id, "42161");
    assert.equal(f.events.address.length, 1);
    await f.action((r) => r.selectChain(r.supportedAssets[0].chains[1]));
    assert.equal(f.result().qrAddress, depositAddress);
    assert.equal(f.result().selection.chain.minimum_deposit_amount_usd, 10);
    await f.action((r) => r.selectChain(r.selection.chain));
    assert.equal(f.events.address.length, 1);
    assert.equal(f.result().qrAddress, depositAddress);
    await f.action((r) => r.selectToken(r.supportedAssets[1]));
    assert.equal(f.result().selection.chain.chain_type, "bitcoin");
    assert.equal(f.result().qrAddress, "bc1qlocaltestaddress");
    assert.equal(f.result().selection.asset.chains.length, 1);
    assert.equal(f.events.address.length, 1);
  } finally {
    await f.close();
  }
});
test("D14-89 actual session network address failure has null QR and retries only at5000ms then recovers", async () => {
  const f = await mount({
    createDepositAddress: () => {
      throw Error("local timeout");
    },
  });
  try {
    assert.equal(f.result().addressState.status, "error");
    assert.equal(f.result().addressState.errorType, "network");
    assert.equal(f.result().qrAddress, null);
    assert.equal(f.events.address.length, 1);
    await f.tick(4999);
    assert.equal(f.events.address.length, 1);
    await f.update({ createDepositAddress: undefined });
    await f.tick(1);
    assert.equal(f.events.address.length, 2);
    assert.equal(f.result().addressState.status, "ready");
    assert.equal(f.result().qrAddress, depositAddress);
  } finally {
    await f.close();
  }
});
test("D14-89 actual catalog request failure retries5000ms and never exposes QR without usable assets", async () => {
  const f = await mount({
    getSupportedAssets: () => {
      throw Error("catalog timeout");
    },
  });
  try {
    assert.equal(f.result().qrAddress, null);
    assert.equal(f.result().assetsLoading, true);
    await f.tick(4999);
    assert.equal(f.events.assets.length, 1);
    await f.update({ getSupportedAssets: undefined });
    await f.tick(1);
    assert.equal(f.events.assets.length, 2);
    assert.equal(f.result().qrAddress, depositAddress);
  } finally {
    await f.close();
  }
});
for (const verdict of [null, {}, { isSanctioned: true }])
  test(`D14-91 actual activation verdict fail-closed ${JSON.stringify(verdict)}`, async () => {
    const f = await mount({ activation: verdict });
    try {
      assert.equal(f.result().qrAddress, null);
      assert.equal(
        f.result().addressState.status,
        verdict?.isSanctioned ? "error" : "loading",
      );
      if (verdict?.isSanctioned)
        assert.equal(f.result().addressState.errorType, "sanctioned");
    } finally {
      await f.close();
    }
  });
test("D14-89/91 actual activation network retry is bounded at3 attempts and never shows cached address", async () => {
  const f = await mount({
    getActivationStatus: () => {
      throw Error("activation timeout");
    },
  });
  try {
    assert.equal(f.result().activationRetrying, true);
    assert.equal(f.result().qrAddress, null);
    await f.tick(5000);
    assert.equal(f.events.activation.length, 2);
    await f.tick(5000);
    assert.equal(f.events.activation.length, 3);
    assert.equal(f.result().addressState.errorType, "unavailable");
    await f.tick(15000);
    assert.equal(f.events.activation.length, 3);
    assert.equal(f.result().qrAddress, null);
  } finally {
    await f.close();
  }
});
for (const codeName of [
  "UNIFOLD_ERROR_CODE_FEATURE_DISABLED",
  "UNIFOLD_ERROR_CODE_GEO_BLOCKED",
  "UNIFOLD_ERROR_CODE_LOCAL_RECIPIENT_SANCTIONED",
])
  test(`D14-91 actual sticky veto ${codeName} cannot be overwritten by delayed successful address`, async () => {
    let release;
    const pending = new Promise((r) => {
      release = r;
    });
    let code;
    const f = await mount({
      getSupportedAssets: () => {
        throw { code };
      },
      createDepositAddress: () => pending,
      enabled: false,
    });
    try {
      code = f.types[codeName];
      assert.equal(typeof code, "number");
      await f.update({ enabled: true });
      assert.equal(f.result().addressState.status, "error");
      const type = f.result().addressState.errorType;
      release(sessionAddress);
      await f.tick(1);
      assert.equal(f.result().addressState.errorType, type);
      assert.equal(f.result().qrAddress, null);
      const count = f.events.assets.length;
      await f.tick(15000);
      assert.equal(f.events.assets.length, count);
    } finally {
      await f.close();
    }
  });
test("D14-48 actual positive account mismatch is sticky, clears QR/history, does not retarget address", async () => {
  const f = await mount({ records: [record("A")] });
  try {
    assert.equal(f.result().qrAddress, depositAddress);
    assert.equal(f.result().sessionExecutions.length, 1);
    const loads = f.events.loads.length;
    await f.update({ account: "0x" + "d".repeat(40) });
    assert.equal(f.result().addressState.errorType, "accountMismatch");
    assert.equal(f.result().qrAddress, null);
    assert.deepEqual(plain(f.result().sessionExecutions), []);
    await f.tick(9000);
    assert.equal(f.events.loads.length, loads);
    await f.update({ account: sessionRecipient });
    assert.equal(f.result().addressState.errorType, "accountMismatch");
    assert.equal(f.result().qrAddress, null);
    assert.equal(f.events.address.length, 1);
  } finally {
    await f.close();
  }
});
test("D14-48 actual null disconnect pauses QR, same recipient reconnect requires fresh address and activation", async () => {
  let release;
  const wait = new Promise((r) => {
    release = r;
  });
  const f = await mount();
  try {
    await f.update({ account: undefined, createDepositAddress: () => wait });
    assert.equal(f.result().qrAddress, null);
    await f.update({ account: sessionRecipient });
    assert.equal(f.result().qrAddress, null);
    assert.equal(f.result().addressState.status, "loading");
    assert.equal(f.events.address.length, 2);
    assert.equal(f.events.activation.length, 2);
    release({
      ...sessionAddress,
      wallets: [
        { ...sessionAddress.wallets[0], address: "0x" + "e".repeat(40) },
      ],
    });
    await f.tick(1);
    assert.equal(f.result().qrAddress, "0x" + "e".repeat(40));
  } finally {
    await f.close();
  }
});
test("D14-90 actual session transient records failure retains prior result and recovers after3s without throwing", async () => {
  const f = await mount({ records: [record("one")] });
  try {
    assert.equal(f.result().sessionExecutions.length, 1);
    await f.update({
      listDepositExecutions: () => {
        throw Error("poll timeout");
      },
    });
    await f.tick(3000);
    assert.equal(f.result().sessionExecutions[0].executionId, "one");
    await f.update({
      listDepositExecutions: undefined,
      records: [record("one", "succeeded")],
    });
    await f.tick(3000);
    assert.equal(f.result().sessionExecutions[0].status, "succeeded");
    assert.equal(f.events.ledger, 1);
    await f.tick(3000);
    assert.equal(f.events.ledger, 1);
  } finally {
    await f.close();
  }
});
test("D14-64/102 actual presented execution ack is idempotent and unmount hands only unannounced in-flight ids to background", async () => {
  const f = await mount({
    records: [record("p"), record("s", "succeeded"), record("f", "failed")],
  });
  await f.action((r) => {
    r.acknowledgePresentedExecution(record("s", "succeeded"));
    r.acknowledgePresentedExecution(record("s", "succeeded"));
    r.acknowledgePresentedExecution(record("p"));
  });
  assert.deepEqual(plain(f.events.settles), [
    { recipientAddress: sessionRecipient, executionId: "s" },
  ]);
  assert.equal(f.events.tracks.length, 1);
  assert.deepEqual(plain(f.events.tracks[0].executions), [
    { executionId: "p", lastStatus: "pending" },
  ]);
  await f.close();
  assert.equal(f.events.finalizes.length, 1);
  assert.deepEqual(plain(f.events.finalizes[0].announcedExecutionIds), ["s"]);
  assert.deepEqual(plain(f.events.finalizes[0].executions), [
    { executionId: "p", lastStatus: "pending" },
  ]);
  assert.equal(f.clock.countTimers(), 0);
});
test("D14-63 actual waiting hint begins only5s after visible address and suppressed only while a record is in-flight", async () => {
  const f = await mount();
  try {
    assert.equal(f.result().showWaitingUi, false);
    await f.tick(4999);
    assert.equal(f.result().showWaitingUi, false);
    await f.tick(1);
    assert.equal(f.result().showWaitingUi, true);
    await f.update({ records: [record("p")] });
    await f.tick(3000);
    assert.equal(f.result().showWaitingUi, false);
    await f.update({ records: [record("p", "succeeded")] });
    await f.tick(3000);
    assert.equal(f.result().showWaitingUi, true);
  } finally {
    await f.close();
  }
});
test("D14-38 actual remount caches only token/chain selection and creates a fresh session address", async () => {
  const cache = new Map(),
    f = await mount({ cache });
  await f.action((r) => r.selectToken(r.supportedAssets[1]));
  await f.close();
  const b = await mount({
    cache,
    address: { ...sessionAddress, sessionId: "new-session" },
  });
  try {
    assert.equal(b.result().selection.asset.symbol, "BTC");
    assert.equal(b.result().qrAddress, "bc1qlocaltestaddress");
    assert.equal(b.result().sessionId, "new-session");
    assert.equal(b.events.address.length, 1);
    assert.ok(
      [...cache.values()].every(
        (v) => !Object.hasOwn(v, "wallets") && !Object.hasOwn(v, "sessionId"),
      ),
    );
  } finally {
    await b.close();
  }
});
test("D14-90 actual unmount clears all retry/poll/wait timers and no additional local request", async () => {
  const f = await mount({
      createDepositAddress: () => {
        throw Error("offline");
      },
    }),
    before = f.events.address.length;
  await f.close();
  assert.equal(f.clock.countTimers(), 0);
  await f.tick(20000);
  assert.equal(f.events.address.length, before);
});
