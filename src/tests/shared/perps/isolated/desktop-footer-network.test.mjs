import test from "node:test";
import assert from "node:assert/strict";
import { footerNetworkFixture } from "./footer-network-fixture.mjs";
const plain = (x) => JSON.parse(JSON.stringify(x));
process.env.TZ = "Asia/Shanghai";
for (const [connected, pingMs, label, color, ping] of [
  [true, 279, "连线正常", "$success10", "279ms"],
  [false, 279, "连线中断", "$critical10", "--ms"],
  [true, null, "连线正常", "$success10", "--ms"],
  [undefined, 2, "连线正常", "$success10", "--ms"],
])
  test(`D06-33/34 actual badge+tooltip connected=${connected} ping=${pingMs}`, async () => {
    const f = await footerNetworkFixture({
      status: { connected, pingMs, lastMessageAt: 1800000000000 },
    });
    try {
      assert.deepEqual(f.texts("Trigger"), [label]);
      assert.equal(f.dot().bg, color);
      assert.equal(f.dot().h, 6);
      assert.deepEqual(f.texts("TooltipBody"), [
        "状态",
        label,
        ping,
        "最后更新",
        "16:00:00",
      ]);
      assert.equal(
        f.tree.root.findByType("Badge").props.badgeType,
        connected === false ? "critical" : "success",
      );
    } finally {
      await f.close();
    }
  });
test("D06-33/34 actual missing last message displays -- without invalid date, badge has no latency", async () => {
  const f = await footerNetworkFixture({
    status: { connected: false, pingMs: null },
  });
  try {
    assert.deepEqual(f.texts("Trigger"), ["连线中断"]);
    assert.deepEqual(f.texts("TooltipBody"), [
      "状态",
      "连线中断",
      "--ms",
      "最后更新",
      "--",
    ]);
  } finally {
    await f.close();
  }
});
test("D06-35 actual disconnected refresh cooldown is disabled until exactly 5000ms, connected resets immediately and unmount cancels timer", async () => {
  const f = await footerNetworkFixture({ status: { connected: false } });
  try {
    assert.equal(f.button().disabled, true);
    assert.equal(await f.pressRefresh(), false);
    await f.tick(4999);
    assert.equal(f.button().disabled, true);
    await f.tick(1);
    assert.equal(f.button().disabled, false);
    await f.pressRefresh();
    assert.equal(f.events.refresh, 1);
    await f.update({ status: { connected: true } });
    assert.equal(f.button().disabled, false);
    await f.update({ status: { connected: false } });
    assert.equal(f.button().disabled, true);
    assert.equal(f.timeouts.size, 1);
    await f.update({ status: { connected: true } });
    assert.equal(f.timeouts.size, 0);
  } finally {
    await f.close();
    assert.equal(f.timeouts.size, 0);
  }
});
for (const outcome of ["success", "failure"])
  test(`D06-35 actual refresh ${outcome} sets loading and always releases, retry allowed`, async () => {
    const f = await footerNetworkFixture();
    try {
      const wait = f.delayRefresh(),
        action = await f.pressRefresh();
      assert.equal(f.button().loading, true);
      assert.equal(await f.pressRefresh(), false);
      assert.equal(f.events.refresh, 1);
      if (outcome === "success") wait.resolve();
      else wait.reject(Error("local refresh failed"));
      await action.pending;
      await f.tick(0);
      assert.equal(f.button().loading, false);
      assert.equal(f.events.errors.length, outcome === "success" ? 0 : 1);
      f.delayRefresh().resolve();
      await f.pressRefresh();
      assert.equal(f.events.refresh, 2);
    } finally {
      await f.close();
    }
  });
test("D06-36 actual ping service measures immediately and each 3000ms, hidden callbacks allocate nothing; visible resumes with current value", async () => {
  const f = await footerNetworkFixture();
  try {
    await f.startPing();
    assert.equal(f.events.pings.length, 1);
    assert.deepEqual(
      [...f.intervals.values()].map((t) => [t.name, t.ms]),
      [["hyperliquid:ping", 3000]],
    );
    await f.resolvePing(0, 42);
    assert.equal(f.state.status.pingMs, 42);
    assert.ok(f.texts("TooltipBody").includes("42ms"));
    await f.update({ visible: false });
    for (let i = 0; i < 5; i++) await f.pingTick();
    assert.equal(f.events.pings.length, 1);
    await f.update({ visible: true });
    await f.pingTick();
    assert.equal(f.events.pings.length, 2);
    await f.resolvePing(1, 9999);
    assert.equal(f.state.status.pingMs, 9999);
  } finally {
    await f.close();
    assert.equal(f.intervals.size, 0);
  }
});
test("D06-36 actual ping no overlapping measurement, replaced client late response ignored and stop aborts outstanding request", async () => {
  const f = await footerNetworkFixture();
  try {
    await f.startPing();
    await f.pingTick();
    assert.equal(f.events.pings.length, 1);
    const before = f.state.status.pingMs;
    f.service._client = { ping: () => Promise.resolve() };
    await f.resolvePing(0, 17);
    assert.equal(f.state.status.pingMs, before);
    await f.pingTick();
    assert.equal(f.service._pingMeasurement, null);
    await f.startPing();
    assert.equal(f.intervals.size, 1);
    f.service._stopPingLoop();
    assert.equal(f.intervals.size, 0);
    f.service._client = {
      ping: (signal) => {
        const promise = new Promise(() => {});
        f.events.pings.push({ signal });
        return promise;
      },
    };
    await f.startPing();
    const pending = f.events.pings.at(-1);
    assert.equal(pending.signal.aborted, false);
    f.service._stopPingLoop();
    assert.equal(pending.signal.aborted, true);
    assert.equal(f.service._pingMeasurement, null);
    assert.equal(f.intervals.size, 0);
  } finally {
    await f.close();
  }
});
test("D06-36 actual ping failure clears latency but preserves connected status", async () => {
  const f = await footerNetworkFixture();
  try {
    await f.startPing();
    await f.rejectPing(0);
    assert.equal(f.state.status.connected, true);
    assert.equal(f.state.status.pingMs, null);
    assert.deepEqual(f.texts("Trigger"), ["连线正常"]);
    assert.ok(f.texts("TooltipBody").includes("--ms"));
  } finally {
    await f.close();
  }
});
test("D06-60/61/62 actual Desktop Telegram and exact ordered article URLs call only local external opener", async () => {
  const f = await footerNetworkFixture();
  try {
    assert.equal(f.menu().title, "更多");
    assert.deepEqual(plain(f.menu().sections[0].items.map((x) => x.label)), [
      "关于",
      "帮助",
      "查看教程",
      "用户协议",
      "隐私政策",
    ]);
    await f.pressTelegram();
    for (let i = 0; i < 5; i++) await f.pressLink(i);
    assert.deepEqual(plain(f.events.urls), [
      "https://t.me/OneKeyPerps",
      "https://help.onekey.so/articles/11461135",
      "https://help.onekey.so/collections/15988402",
      "https://help.onekey.so/articles/12568192",
      "https://help.onekey.so/articles/11461292",
      "https://help.onekey.so/articles/11461298",
    ]);
    assert.equal(f.events.refresh, 0);
  } finally {
    await f.close();
  }
});
