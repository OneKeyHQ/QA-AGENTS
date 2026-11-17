import test from "node:test";
import assert from "node:assert/strict";
import {
  assertHealthFields,
  assertHealthColor,
  assertPnlColor,
  reloadPerps,
} from "../runtime.mjs";
const good = {
  accountAsset: "$100.00",
  available: "$80.00",
  leverage: "2x",
  usedMargin: "$20.00",
  mmr: "20%",
  healthLevel: "健康",
};
test("账户健康字段缺失或非有限数值必须失败", () => {
  assert.doesNotThrow(() => assertHealthFields(good));
  for (const key of [
    "accountAsset",
    "available",
    "leverage",
    "usedMargin",
    "mmr",
  ]) {
    assert.throws(
      () => assertHealthFields({ ...good, [key]: null }),
      new RegExp(key),
    );
    assert.throws(() => assertHealthFields({ ...good, [key]: "NaN" }));
  }
});
test("健康等级缺失、未知或错误颜色不能通过", () => {
  assert.throws(() => assertHealthColor(null));
  assert.throws(() => assertHealthColor({ label: "no-health-label" }));
  assert.throws(() => assertHealthColor({ label: "健康", isRed: true }));
  assert.throws(() => assertHealthColor({ label: "高风险", isGreen: true }));
  assert.doesNotThrow(() =>
    assertHealthColor({ label: "中等风险", isYellow: true }),
  );
});
test("健康等级还需符合评分，不能只比标签和颜色", () => {
  assert.throws(() =>
    assertHealthColor(
      { label: "健康", isGreen: true },
      { ...good, leverage: "25x", usedMargin: "$80", mmr: "50%" },
    ),
  );
  assert.doesNotThrow(() =>
    assertHealthColor(
      { label: "高风险", isRed: true },
      { ...good, leverage: "25x", usedMargin: "$80", mmr: "50%" },
    ),
  );
});
test("正负总盈亏错误颜色和缺失必须失败，零值允许中性色", () => {
  assert.throws(() => assertPnlColor(null));
  assert.throws(() => assertPnlColor({ value: "+$2", isRed: true }));
  assert.throws(() => assertPnlColor({ value: "-$2", isGreen: true }));
  assert.doesNotThrow(() => assertPnlColor({ value: "$0.00" }));
  assert.doesNotThrow(() => assertPnlColor({ value: "-$2", isRed: true }));
});
test("真实刷新必须先执行 reload，再解锁导航并等待新图表", async () => {
  const calls = [];
  await reloadPerps(
    { reload: async (o) => calls.push(["reload", o.waitUntil]) },
    {
      unlock: async () => calls.push("unlock"),
      navigate: async () => calls.push("navigate"),
      ready: async () => calls.push("ready"),
    },
  );
  assert.deepEqual(calls, [
    ["reload", "domcontentloaded"],
    "unlock",
    "navigate",
    "ready",
  ]);
});
test("刷新失败不能降级成导航并通过", async () => {
  let navigated = false;
  await assert.rejects(
    reloadPerps(
      {
        reload: async () => {
          throw Error("reload failed");
        },
      },
      {
        unlock: async () => {},
        navigate: async () => {
          navigated = true;
        },
        ready: async () => {},
      },
    ),
    /reload failed/,
  );
  assert.equal(navigated, false);
});
test("Electron 路由刷新重新加载 Chromium 记录的真实 shell 文档", async () => {
  const calls = [];
  await reloadPerps(
    {
      url: () => "file:///perps",
      evaluate: async () => "file:///index.html",
      goto: async (url) => calls.push(url),
    },
    {
      unlock: async () => calls.push("unlock"),
      navigate: async () => calls.push("navigate"),
      ready: async () => calls.push("ready"),
    },
  );
  assert.deepEqual(calls, [
    "file:///index.html",
    "unlock",
    "navigate",
    "ready",
  ]);
  await assert.rejects(
    reloadPerps(
      { url: () => "file:///perps", evaluate: async () => undefined },
      {},
    ),
    /Cannot identify/,
  );
});
test("MMR 不可用时取较差已知信号，不能默认为健康", () => {
  const data = { ...good, mmr: "--", leverage: "20x", usedMargin: "$90" };
  assert.throws(
    () => assertHealthColor({ label: "健康", isGreen: true }, data),
    /risk score/,
  );
  assert.doesNotThrow(() =>
    assertHealthColor({ label: "高风险", isRed: true }, data),
  );
});
