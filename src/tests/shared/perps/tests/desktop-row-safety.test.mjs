import test from "node:test";
import assert from "node:assert/strict";
import {
  readTradingPermission,
  rejectClick,
  assertMinimumValidationSnapshot,
} from "../desktop-form-boundaries.mjs";

function fakePage(statuses, size = "") {
  let clicks = 0;
  const hooks = statuses.map((s) => ({
    memoizedState: [
      { canTrade: s, details: { agentOk: s, activatedOk: true } },
    ],
  }));
  for (let i = 0; i < hooks.length - 1; i++) hooks[i].next = hooks[i + 1];
  const root = { tag: 3, return: null, stateNode: {} };
  root.stateNode.current = root;
  const button = {
    __reactFiber$test: {
      type: { displayName: "EmptySizeSideButton" },
      memoizedState: hooks[0],
      return: root,
    },
  };
  const loc = {
    filter() {
      return this;
    },
    async evaluate(fn) {
      return fn(button);
    },
    async evaluateAll(fn, arg) {
      return fn([button], arg);
    },
    async inputValue() {
      return size;
    },
    async click() {
      clicks++;
    },
  };
  return {
    page: {
      locator() {
        return loc;
      },
    },
    clicks: () => clicks,
  };
}
test("交易权限不能由已有持仓或买卖按钮标签推断", async () => {
  const { page } = fakePage([false]);
  assert.deepEqual(await readTradingPermission(page), {
    canTrade: false,
    agentOk: false,
    activatedOk: true,
  });
});
test("未授权账户在任何点击之前返回前置阻塞", async () => {
  const f = fakePage([false]);
  await assert.rejects(
    rejectClick(f.page, "请输入触发价格"),
    /交易授权未就绪/u,
  );
  assert.equal(f.clicks(), 0);
});
test("缺失或相互冲突的权限证据必须失败，不放行", async () => {
  await assert.rejects(
    readTradingPermission(fakePage([]).page),
    /Cannot prove/u,
  );
  await assert.rejects(
    readTradingPermission(fakePage([true, false]).page),
    /Ambiguous/u,
  );
});
test("有权限仍拒绝任何非空数量的校验点击", async () => {
  const f = fakePage([true], "1");
  await assert.rejects(rejectClick(f.page, "提示"), /Only empty-size/u);
  assert.equal(f.clicks(), 0);
});
test("正数最小金额例外同时要求当前BTC限价100、正确单位和实际规整名义严格不足10", () => {
  const good = {
    coin: "BTC",
    side: "long",
    unit: "usd",
    type: "limit",
    price: "100",
    spot: false,
    advanced: false,
    belowMinimum: true,
    quantity: "0.01",
    effectivePrice: "100",
  };
  const fixture = { displayValue: "1", unit: "usd" };
  assertMinimumValidationSnapshot(good, fixture, false);
  for (const patch of [
    { coin: "ETH" },
    { side: "short" },
    { unit: "token" },
    { type: "market" },
    { price: "1000" },
    { spot: true },
    { advanced: true },
    { belowMinimum: false },
    { quantity: "0.1" },
    { quantity: "NaN" },
    { effectivePrice: "1000" },
  ])
    assert.throws(() =>
      assertMinimumValidationSnapshot({ ...good, ...patch }, fixture, false),
    );
  for (const displayValue of ["10", "100", "NaN", "-1", "0"])
    assert.throws(() =>
      assertMinimumValidationSnapshot(
        good,
        { ...fixture, displayValue },
        false,
      ),
    );
  assert.throws(() =>
    assertMinimumValidationSnapshot(
      good,
      { ...fixture, unreviewedOverride: true },
      false,
    ),
  );
});
