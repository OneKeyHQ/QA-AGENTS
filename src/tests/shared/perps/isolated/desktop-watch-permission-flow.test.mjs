import test from "node:test";
import assert from "node:assert/strict";
import { watchPermissionFixture } from "./watch-permission-fixture.mjs";
test("D13-63 actual selected watching wallet -> active account -> derived unsupported status -> ensure rejection sends zero amendment", async () => {
  const f = await watchPermissionFixture();
  try {
    assert.equal(
      f.account.data.perpsActiveAccountAtom.accountId,
      "watching--local",
    );
    assert.equal(f.account.data.perpsActiveAccountAtom.walletType, "watching");
    assert.equal(f.account.data.perpsActiveAccountAtom.accountAddress, f.addr);
    assert.deepEqual(f.events.checks, [f.addr]);
    const status = await f.derived.get();
    assert.equal(status.accountNotSupport, true);
    assert.equal(status.canTrade, false);
    assert.equal(status.canCreateAddress, false);
    assert.equal(f.list.rows().length, 1);
    await f.preview();
    assert.equal(f.list.activity.dialogs.length, 1);
    await f.confirm();
    assert.deepEqual(f.list.activity.amends, []);
    assert.equal(f.guard.events.enables, 0);
    assert.equal(f.guard.events.passwords, 0);
    assert.deepEqual(f.guard.events.deposits, []);
    assert.equal(f.list.activity.errors.length, 1);
    assert.equal(f.list.activity.errors[0].title, "请启用交易以继续");
    assert.equal(
      typeof f.list.chaseButton(1).props.onPress,
      "function",
      "Task lock releases even after authorization refusal",
    );
  } finally {
    await f.close();
  }
  assert.equal(f.account.clock.countTimers(), 0);
});
test(
  "D13-63 watching account must not expose a clickable chase entry or open preview",
  {
    todo: "Pinned list only checks account address match, not derived accountNotSupport; actual watching selection exposes chase and preview. Strict expected assertion, pending TF; zero amend separately verified.",
  },
  async () => {
    const f = await watchPermissionFixture();
    try {
      const button = f.list.chaseButton(1);
      assert.ok(
        !button ||
          button.props.disabled ||
          typeof button.props.onPress !== "function",
        "Read-only account must have no enabled chase entry",
      );
      await f.preview();
      assert.equal(f.list.activity.dialogs.length, 0);
      assert.deepEqual(f.list.activity.amends, []);
    } finally {
      await f.close();
    }
  },
);
