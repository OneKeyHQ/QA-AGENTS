import test from "node:test";
import assert from "node:assert/strict";
import { unifoldCounterFixture as mount } from "./unifold-counter-fixture.mjs";
const now = 1800000000000;
const item = (id = "x", status = "succeeded", age = 0) => ({
  executionId: id,
  status,
  terminal: !["pending", "delayed"].includes(status),
  createdAt: new Date(now - age).toISOString(),
});
const ids = (f) =>
  Array.from(f.result().trackedExecutions, (e) => e.executionId);
for (const status of ["succeeded", "failed", "refunded"])
  for (const age of [0, 119999, 120000, 120001])
    test(`D14-77 actual tracker counter ${status} terminal ${age}ms cutoff`, async () => {
      const f = await mount({ sessionExecutions: [item("one", status, age)] });
      try {
        assert.deepEqual(ids(f), age <= 120000 ? ["one"] : []);
        assert.equal(f.result().trackedExecutionCount, age <= 120000 ? 1 : 0);
        assert.equal(
          f.result().nextTerminalExpiryAt,
          age <= 120000 ? now - age + 120000 : null,
        );
        assert.equal(f.texts().includes("1"), age <= 120000);
      } finally {
        await f.close();
      }
    });
for (const status of ["pending", "delayed"])
  test(`D14-63/77 actual ${status} is tracked regardless of creation age`, async () => {
    const f = await mount({
      sessionExecutions: [item("old", status, 999999999)],
    });
    try {
      assert.deepEqual(ids(f), ["old"]);
      assert.equal(f.result().nextTerminalExpiryAt, null);
      await f.tick(300000);
      assert.deepEqual(ids(f), ["old"]);
      assert.equal(f.clock.countTimers(), 0);
    } finally {
      await f.close();
    }
  });
test("D14-77 actual counter deduplicates execution ids and selects earliest terminal expiry", async () => {
  const f = await mount({
    sessionExecutions: [
      item("p", "pending", 999999),
      item("a", "succeeded", 1000),
      item("a", "succeeded", 1),
      item("b", "failed", 60000),
      item("c", "refunded", 120001),
    ],
  });
  try {
    assert.deepEqual(ids(f), ["p", "a", "b"]);
    assert.equal(f.result().nextTerminalExpiryAt, now + 60000);
    assert.equal(f.result().trackedExecutionCount, 3);
    assert.ok(f.texts().includes("3"));
    await f.tick(60000);
    assert.deepEqual(ids(f), ["p", "a", "b"]);
    await f.tick(1);
    assert.deepEqual(ids(f), ["p", "a"]);
    assert.equal(f.events.counts.at(-1), 2);
    await f.tick(59000);
    assert.deepEqual(ids(f), ["p"]);
    assert.equal(f.clock.countTimers(), 0);
  } finally {
    await f.close();
  }
});
for (const createdAt of [null, "", "invalid"])
  test(`D14-77 actual terminal with invalid creation ${createdAt} is excluded`, async () => {
    const f = await mount({ sessionExecutions: [{ ...item(), createdAt }] });
    try {
      assert.deepEqual(ids(f), []);
      assert.equal(f.clock.countTimers(), 0);
    } finally {
      await f.close();
    }
  });
test("D14-77 actual observed processing->terminal receives full two-minute window even with old createdAt", async () => {
  const old = item("live", "pending", 9999999),
    f = await mount();
  try {
    await f.update({ sessionExecutions: [old] });
    await f.update({
      sessionExecutions: [{ ...old, status: "succeeded", terminal: true }],
    });
    assert.deepEqual(ids(f), ["live"]);
    assert.equal(f.result().terminalObservedAt.get("live"), now);
    await f.tick(120000);
    assert.deepEqual(ids(f), ["live"]);
    await f.tick(1);
    assert.deepEqual(ids(f), []);
    assert.equal(f.events.counts.at(-1), 0);
  } finally {
    await f.close();
  }
});
for (const placement of ["overlay", "pageFooter", "hidden"])
  test(`D14-64/102 actual presentation ack only succeeds while history card visible: ${placement}`, async () => {
    const f = await mount({
      historyCardPlacement: placement,
      sessionExecutions: [
        item("s"),
        item("p", "pending"),
        item("f", "failed"),
        item("r", "refunded"),
      ],
    });
    try {
      assert.deepEqual(
        [...new Set(f.events.acks)],
        placement === "hidden" ? [] : ["s"],
      );
      assert.equal(f.result().historyCardVisible, placement !== "hidden");
      if (placement === "hidden") {
        await f.update({ historyCardPlacement: "overlay" });
        assert.deepEqual(f.events.acks, ["s"]);
      }
    } finally {
      await f.close();
    }
  });
for (const patch of [
  { recipientAddress: undefined },
  { isLiveAccountAligned: false },
  { noTracker: true },
])
  test(`D14-48 actual counter disables for unavailable or misaligned recipient ${JSON.stringify(patch)}`, async () => {
    const f = await mount({ sessionExecutions: [item("a")], ...patch });
    try {
      assert.deepEqual(ids(f), []);
      assert.equal(f.result().historyCardVisible, false);
      assert.deepEqual(f.events.acks, []);
      assert.deepEqual(f.events.counts, [0]);
      assert.equal(f.clock.countTimers(), 0);
    } finally {
      await f.close();
    }
  });
test("D14-48 actual counter recipient switch clears observed terminal timestamps and expiry timer", async () => {
  const old = item("old", "pending", 999999),
    f = await mount();
  try {
    await f.update({ sessionExecutions: [old] });
    await f.update({
      sessionExecutions: [{ ...old, status: "succeeded", terminal: true }],
    });
    assert.equal(f.result().terminalObservedAt.size, 1);
    await f.update({
      recipientAddress: "0x" + "b".repeat(40),
      sessionExecutions: [],
    });
    assert.equal(f.result().terminalObservedAt.size, 0);
    assert.deepEqual(ids(f), []);
    assert.equal(f.clock.countTimers(), 0);
    await f.tick(200000);
    assert.deepEqual(ids(f), []);
  } finally {
    await f.close();
  }
});
test("D14-77 actual counter unmount clears scheduled terminal expiry", async () => {
  const f = await mount({ sessionExecutions: [item()] });
  assert.equal(f.clock.countTimers(), 1);
  await f.close();
  assert.equal(f.clock.countTimers(), 0);
});

test(
  "D14-77 cached processing present at mount must retain a full observed terminal window",
  {
    todo: "Pinned source candidate: recipient reset effect clears initial previousExecutionTerminalRef, so first transition from cached processing is not observed",
  },
  async () => {
    const old = item("cached", "pending", 9999999),
      f = await mount({ sessionExecutions: [old] });
    try {
      await f.update({
        sessionExecutions: [{ ...old, status: "succeeded", terminal: true }],
      });
      assert.deepEqual(ids(f), ["cached"]);
      assert.equal(f.result().terminalObservedAt.get("cached"), now);
    } finally {
      await f.close();
    }
  },
);
