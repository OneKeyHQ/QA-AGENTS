import test from "node:test";
import assert from "node:assert/strict";
import { renderer } from "./source.mjs";
import { fixture } from "./dusting-fixture.mjs";
const { act } = renderer;
const A = "0xaaa",
  B = "0xbbb";
for (const optOut of [true, false])
  test(`碎币 optOut=${optOut} 逆映射、状态文案和两向写入`, async () => {
    const f = await fixture({ optOut });
    try {
      assert.equal(f.switch().value, !optOut);
      assert.equal(f.switch().disabled, false);
      assert.match(f.subtitle(), optOut ? /_off__desc$/u : /_on__desc$/u);
      await f.click(optOut);
      assert.equal(f.requests.length, 1);
      assert.equal(f.requests[0].optOut, !optOut);
      assert.equal(f.switch().disabled, false);
      assert.equal(f.toasts.at(-1).kind, "success");
      // Service-owned atom changes after a write, and remount must use that state.
      f.atoms.dust.optOut = !optOut;
      await f.remount();
      assert.equal(f.switch().value, optOut);
    } finally {
      await f.dispose();
    }
  });
for (const state of [
  { address: undefined },
  { statusAddress: B },
  { statusAddress: undefined },
  { canTrade: false },
  { canTrade: undefined },
])
  test(`碎币加载/权限保护 ${JSON.stringify(state)}`, async () => {
    const f = await fixture(state);
    try {
      assert.equal(f.switch().disabled, true);
      await f.click(true);
      assert.equal(f.requests.length, 0);
      assert.match(
        f.subtitle(),
        state.canTrade === false || Object.hasOwn(state, "canTrade")
          ? /enable_trading_required/
          : /loading/,
      );
    } finally {
      await f.dispose();
    }
  });
test("碎币状态地址大小写归一化；未加载完成再到达可恢复操作", async () => {
  const f = await fixture({ address: "0xAAA", statusAddress: undefined });
  try {
    f.atoms.dust.accountAddress = A;
    await f.update();
    assert.equal(f.switch().disabled, false);
  } finally {
    await f.dispose();
  }
});
test("碎币 pending 展示目标、禁用重复交互，响应后解除 loading", async () => {
  const f = await fixture();
  try {
    const d = f.delay();
    let task;
    await act(async () => {
      task = f.switch().onChange(true);
    });
    assert.equal(f.switch().value, true);
    assert.equal(f.switch().disabled, true);
    await f.click(false);
    assert.equal(f.requests.length, 1);
    f.atoms.dust.optOut = false;
    await act(async () => {
      d.resolve();
      await task;
    });
    assert.equal(f.switch().value, true);
    assert.equal(f.switch().disabled, false);
    assert.equal(f.toasts[0].closed, true);
  } finally {
    await f.dispose();
  }
});
for (const message of [
  "User rejected signing",
  "Network error",
  "Request timeout",
])
  test(`碎币失败回退与可重试 ${message}`, async () => {
    const f = await fixture();
    try {
      const d = f.delay();
      let task;
      await act(async () => {
        task = f.switch().onChange(true);
      });
      await act(async () => {
        d.reject(Error(message));
        await task;
      });
      assert.equal(f.switch().value, false);
      assert.equal(f.switch().disabled, false);
      assert.equal(f.toasts[0].closed, true);
      assert.equal(f.toasts.at(-1).kind, "error");
      assert.equal(f.toasts.at(-1).title, message);
      const retry = f.delay();
      await act(async () => {
        task = f.switch().onChange(true);
      });
      f.atoms.dust.optOut = false;
      await act(async () => {
        retry.resolve();
        await task;
      });
      assert.equal(f.requests.length, 2);
      assert.equal(f.switch().value, true);
    } finally {
      await f.dispose();
    }
  });
for (const optOut of [false, true])
  for (const fail of [false, true])
    test(`碎币 A optOut=${optOut} 请求中切反状态 B，A ${fail ? "失败" : "成功"}不污染 B`, async () => {
      const f = await fixture({ optOut });
      try {
        assert.equal(f.switch().value, !optOut);
        const d = f.delay();
        let task;
        await act(async () => {
          task = f.switch().onChange(optOut);
        });
        assert.equal(f.switch().value, optOut);
        assert.equal(f.switch().disabled, true);
        assert.equal(f.requests.length, 1);
        assert.deepEqual(Object.keys(f.requests[0]), ["optOut"]);
        assert.equal(f.requests[0].optOut, !optOut);
        f.atoms.account = { accountAddress: B };
        // Explicit opposite initial server states, in both directions.
        f.atoms.dust = { accountAddress: B, optOut: !optOut };
        await f.update();
        assert.equal(f.switch().value, optOut);
        assert.equal(f.switch().disabled, false);
        await act(async () => {
          fail ? d.reject(Error("A failed")) : d.resolve();
          await task;
        });
        assert.equal(f.switch().value, optOut);
        assert.equal(f.switch().disabled, false);
        assert.equal(f.toasts.filter((t) => t.kind !== "loading").length, 0);
        assert.equal(f.toasts[0].closed, true);
        f.atoms.account = { accountAddress: A };
        f.atoms.dust = { accountAddress: A, optOut: fail ? optOut : !optOut };
        await f.update();
        assert.equal(f.switch().value, fail ? !optOut : optOut);
        assert.equal(f.switch().disabled, false);
        f.atoms.account = { accountAddress: B };
        f.atoms.dust = { accountAddress: B, optOut: !optOut };
        await f.update();
        assert.equal(f.switch().value, optOut);
        assert.equal(f.requests.length, 1);
      } finally {
        await f.dispose();
      }
    });
