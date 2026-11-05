import test from "node:test";
import assert from "node:assert/strict";
import { renderer } from "./source.mjs";
import { unifoldTrackingFixture } from "./unifold-tracking-fixture.mjs";
import {
  unifoldSessionFixture,
  sessionRecipient,
} from "./unifold-session-fixture.mjs";
import { unifoldDeliveryFixture } from "./unifold-menu-delivery-fixture.mjs";
import { execution } from "./unifold-tracker-fixture.mjs";
const plain = (v) => JSON.parse(JSON.stringify(v));
async function drain(bg) {
  await renderer.act(async () => {
    for (let i = 0; i < 60; i++) await Promise.resolve();
    await bg.clock.tickAsync(0);
  });
}
for (const presented of [false, true])
  test(`D14-64/102 actual session close -> actual tracking state -> real terminal container ${presented ? "does not repeat foreground outcome" : "presents background success exactly once"}`, async () => {
    const pending = execution({ status: "pending", terminal: false }),
      success = { ...pending, status: "succeeded", terminal: true };
    const bg = unifoldTrackingFixture({ records: [pending] });
    const ui = await unifoldDeliveryFixture({
      clock: bg.clock,
      bus: bg.bus,
      service: bg.service,
    });
    const front = await unifoldSessionFixture({
      clock: bg.clock,
      ...bg.sessionBindings(),
    });
    let frontClosed = false;
    try {
      assert.equal(front.result().sessionExecutions.length, 1);
      assert.equal(bg.state.tracking.items.length, 1);
      assert.ok(bg.state.tracking.watches[0].mutedAt);
      if (presented) {
        bg.state.records = [success];
        await front.tick(3000);
        assert.equal(front.result().sessionExecutions[0].status, "succeeded");
        await front.action((r) => r.acknowledgePresentedExecution(success));
        await drain(bg);
        assert.deepEqual(
          plain(bg.state.tracking.watches[0].knownExecutionIds),
          [success.executionId],
        );
      }
      await front.close();
      frontClosed = true;
      await drain(bg);
      assert.equal(bg.state.tracking.watches[0].mutedAt, null);
      if (!presented) {
        bg.state.records = [success];
        await renderer.act(async () => {
          await bg.service.unifoldDepositTrackingLoop();
        });
        await drain(bg);
      }
      assert.equal(ui.events.toasts.length, presented ? 0 : 1);
      if (!presented) {
        assert.deepEqual(ui.events.toasts, [
          {
            type: "success",
            toastId: `${sessionRecipient}:${success.executionId}:succeeded`,
            title: "存款成功",
            message: "$3.40",
          },
        ]);
        assert.equal(ui.events.acks.length, 1);
        assert.equal(bg.events.ledger, 1);
      }
      assert.deepEqual(plain(bg.state.tracking.pendingDeliveries), []);
      assert.deepEqual(plain(bg.state.tracking.items), []);
      assert.deepEqual(plain(bg.state.tracking.watches[0].knownExecutionIds), [
        success.executionId,
      ]);
      await ui.tick(10000);
      await drain(bg);
      assert.equal(
        ui.events.toasts.length,
        presented ? 0 : 1,
        "Next actual polling round must not resurrect acknowledged outcome",
      );
    } finally {
      if (!frontClosed) await front.close();
      await ui.close();
      bg.close();
    }
  });
test("D14-64/102 actual final tracking write rechecks foreground settle during an in-flight list response, so stale candidate cannot toast", async () => {
  const e = execution(),
    bg = unifoldTrackingFixture();
  const ui = await unifoldDeliveryFixture({
    clock: bg.clock,
    bus: bg.bus,
    service: bg.service,
  });
  try {
    bg.state.tracking = {
      items: [
        {
          executionId: e.executionId,
          recipientAddress: sessionRecipient,
          sessionId: "session",
          lastStatus: "pending",
          trackedAt: bg.clock.now,
          mutedAt: null,
        },
      ],
      watches: [
        {
          recipientAddress: sessionRecipient,
          sessionId: "session",
          sessionStart: bg.clock.now - 10000,
          knownExecutionIds: [],
          watchedAt: bg.clock.now,
          mutedAt: null,
          claims: [],
        },
      ],
      pendingDeliveries: [],
    };
    let release;
    const response = new Promise((r) => {
      release = r;
    });
    bg.state.load = () => response;
    let inFlight;
    await renderer.act(async () => {
      inFlight = bg.service.unifoldDepositTrackingLoop();
      for (let i = 0; i < 10; i++) await Promise.resolve();
    });
    assert.equal(bg.events.loads.length, 1);
    await bg.service.settleAnnouncedExecution({
      recipientAddress: sessionRecipient,
      executionId: e.executionId,
    });
    await renderer.act(async () => {
      release([e]);
      await inFlight;
    });
    await drain(bg);
    assert.deepEqual(plain(bg.state.tracking.pendingDeliveries), []);
    assert.equal(ui.events.toasts.length, 0);
    assert.deepEqual(plain(bg.state.tracking.watches[0].knownExecutionIds), [
      e.executionId,
    ]);
  } finally {
    await ui.close();
    bg.close();
  }
});
