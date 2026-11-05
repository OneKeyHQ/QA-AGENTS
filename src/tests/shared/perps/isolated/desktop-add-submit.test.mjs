// Offline actual-component assertions. Service/order sinks are inert; no CDP.
import test from "node:test";
import assert from "node:assert/strict";
import { expectedAddMinimum } from "../add-position-evidence.mjs";
import {
  mountAddForm,
  account,
  otherAccount,
  deferred,
} from "./add-position-fixture.mjs";

function assertNoSubmit(f, before = { fetch: 1, metadata: 1 }) {
  assert.equal(
    f.calls.ensure,
    0,
    "Invalid local input never requests trading enablement",
  );
  assert.equal(f.calls.fetch, before.fetch, "No submit-time target refresh");
  assert.equal(f.calls.metadata, before.metadata);
  assert.deepEqual(
    f.calls.orders,
    [],
    "No order service invocation, even an unsuccessful one",
  );
  assert.equal(f.calls.closed, 0);
  assert.equal(f.one("Button").props.loading, false);
}
function assertMinimum(f, unit) {
  const toast = f.calls.toasts.at(-1);
  assert.equal(toast.kind, "message");
  assert.equal(
    toast.title,
    "最小 " +
      expectedAddMinimum({
        price: "100",
        leverage: 10,
        unit,
        decimals: 5,
        symbol: "BTC",
      }),
  );
  assert.equal(toast.duration, 3000);
  assert.equal(toast.actions.props.testID, "perp-minimum-order-toast-action");
  assert.equal(toast.actions.props.children, "填入最小金额");
  assert.equal(typeof toast.actions.props.onPress, "function");
}

// Five significant digits: the leading 0 in 0.012345 is not significant.
for (const [mid, expected] of [
  ["100", "100"],
  ["100.12345", "100.12"],
  ["0.01234567", "0.012345"],
])
  test(`D13-23 限价预填独立中间价夹具${mid}→${expected}，可编辑且行情刷新不覆盖手输`, async () => {
    const f = await mountAddForm({ mark: mid });
    try {
      assert.equal(f.find("PriceInput").length, 0, "Default market form");
      await f.limit();
      assert.equal(f.one("PriceInput").props.value, expected);
      assert.equal(f.one("PriceInput").props.disabled, false);
      await f.price("123");
      assert.equal(f.one("PriceInput").props.value, "123");
      f.state.mark = "200";
      await f.refresh();
      assert.equal(f.one("PriceInput").props.value, "123");
      assertNoSubmit(f);
    } finally {
      await f.close();
    }
  });

for (const isBuy of [true, false])
  for (const unit of ["token", "usd", "margin"])
    test(`D13-47/49 ${isBuy ? "多" : "空"}/${unit}: 空、零、小于一手和<$10，精确Toast/快捷入口/零服务调用`, async () => {
      const f = await mountAddForm({ isBuy, unit });
      try {
        await f.limit("100");
        // These are token values at the controlled form boundary, regardless
        // of the leaf display unit. Leaf conversion is separately source-tested.
        for (const quantity of ["", "0", "0.000001", "0.09999"]) {
          await f.amount(quantity);
          assert.equal(f.one("Button").props.disabled, false);
          const old = f.calls.toasts.length;
          await f.submit();
          assert.equal(f.calls.toasts.length, old + 1);
          assertMinimum(f, unit);
          assertNoSubmit(f);
        }
        await f.tick(() => f.calls.toasts.at(-1).actions.props.onPress());
        assert.equal(
          f.one("SizeInput").props.value,
          "0.1",
          "Minimum action really changes the form value",
        );
        assert.equal(
          f.calls.orders.length,
          0,
          "Shortcut fills only, never submits",
        );
      } finally {
        await f.close();
      }
    });

for (const isBuy of [true, false])
  test(`D13-48 ${isBuy ? "多" : "空"}: 空/零限价使用正数量到达价格分支，不发请求`, async () => {
    const f = await mountAddForm({ isBuy });
    try {
      await f.limit("100");
      await f.amount("1");
      for (const price of ["", "0"]) {
        await f.price(price);
        const old = f.calls.toasts.length;
        await f.submit();
        assert.equal(f.calls.toasts.length, old + 1);
        assert.equal(f.calls.toasts.at(-1).title, "输入价格");
        assertNoSubmit(f);
      }
    } finally {
      await f.close();
    }
  });

for (const isBuy of [true, false])
  test(`D13-50 ${isBuy ? "多" : "空"}: 超出该方向最大值一手即保证金不足；等于上限允许进入隔离服务`, async () => {
    const f = await mountAddForm({ isBuy });
    try {
      await f.limit("100");
      const maximum = isBuy ? "10" : "8",
        tooLarge = isBuy ? "10.00001" : "8.00001";
      await f.amount(tooLarge);
      await f.submit();
      assert.equal(f.calls.toasts.at(-1).title, "保证金不足");
      assert.equal(f.calls.toasts.at(-1).kind, "error");
      assertNoSubmit(f);
      await f.amount(maximum);
      await f.submit();
      assert.equal(
        f.calls.orders.length,
        1,
        "Boundary control proves validation is not a universal rejection",
      );
      assert.equal(f.calls.orders[0].size, maximum);
      assert.equal(f.calls.orders[0].expectedAccountAddress, account);
      assert.equal(f.calls.orders[0].isBuy, isBuy);
    } finally {
      await f.close();
    }
  });

for (const isBuy of [true, false])
  test(`D13-25 ${isBuy ? "多" : "空"}: 10%预填、保留编辑值，取消后隔离提交参数不带TP/SL`, async () => {
    const f = await mountAddForm({ isBuy });
    try {
      await f.limit("100");
      await f.amount("1");
      await f.checkbox(true);
      const legs = () =>
        f.find("TpSlFormInput").map((n) => ({
          type: n.props.type,
          inputType: n.props.inputType,
          value: n.props.value,
        }));
      assert.deepEqual(legs(), [
        { type: "tp", inputType: "percentage", value: "10" },
        { type: "sl", inputType: "percentage", value: "10" },
      ]);
      await f.tick(() => f.find("TpSlFormInput")[0].props.onChange("20"));
      await f.checkbox(false);
      assert.deepEqual(legs(), []);
      await f.checkbox(true);
      assert.equal(
        legs()[0].value,
        "20",
        "Reopen does not overwrite the edited TP",
      );
      await f.checkbox(false);
      await f.submit();
      assert.equal(f.calls.orders.length, 1);
      assert.equal(f.calls.orders[0].tpTriggerPx, undefined);
      assert.equal(f.calls.orders[0].slTriggerPx, undefined);
      assert.equal(f.calls.orders[0].size, "1");
      assert.equal(f.calls.orders[0].expectedAccountAddress, account);
    } finally {
      await f.close();
    }
  });

for (const isBuy of [true, false])
  test(`D13-25 ${isBuy ? "多" : "空"}: 勾选状态的阳性对照，10x/10%独立预期为±1%价格`, async () => {
    const f = await mountAddForm({ isBuy });
    try {
      await f.limit("100");
      await f.amount("1");
      await f.checkbox(true);
      await f.submit();
      assert.equal(f.calls.orders.length, 1);
      assert.equal(f.calls.orders[0].tpTriggerPx, isBuy ? "101" : "99");
      assert.equal(f.calls.orders[0].slTriggerPx, isBuy ? "99" : "101");
    } finally {
      await f.close();
    }
  });

for (const mutation of ["account", "closed", "reversed", "coin"])
  test(`D13-51 提交前${mutation}变化：提示仓位或账户变化，零授权/刷新/订单调用`, async () => {
    const f = await mountAddForm();
    try {
      await f.limit("100");
      await f.amount("1");
      if (mutation === "account") f.state.active = otherAccount;
      if (mutation === "closed") f.state.positions = [];
      if (mutation === "reversed")
        f.state.positions = [{ position: { ...f.position, szi: "-1" } }];
      if (mutation === "coin")
        f.state.positions = [{ position: { ...f.position, coin: "ETH" } }];
      await f.refresh();
      await f.submit();
      assert.equal(
        f.calls.toasts.at(-1).title,
        "仓位或当前账户已变化，请重试。",
      );
      assertNoSubmit(f);
    } finally {
      await f.close();
    }
  });

for (const phase of ["authorization", "target-refresh"])
  test(`D13-51 等待${phase}时账户变化：异步完成后再次校验，绝不以新旧账户提交`, async () => {
    const f = await mountAddForm(),
      gate = deferred();
    try {
      await f.limit("100");
      await f.amount("1");
      if (phase === "authorization") f.state.ensure = () => gate.promise;
      else f.state.fetchData = () => gate.promise;
      let pending;
      await f.tick(() => {
        pending = f.submitHandler()();
      });
      assert.equal(f.one("Button").props.loading, true);
      f.state.active = otherAccount;
      await f.refresh();
      gate.resolve(structuredClone(f.data));
      await f.tick(() => pending);
      assert.equal(f.calls.orders.length, 0);
      assert.equal(f.calls.closed, 0);
      assert.equal(
        f.calls.toasts.at(-1).title,
        "仓位或当前账户已变化，请重试。",
      );
      assert.equal(f.one("Button").props.loading, false);
    } finally {
      await f.close();
    }
  });

test("D13-50 刷新后可开上限缩小：重新校验数量，提示不足且零订单调用", async () => {
  const f = await mountAddForm();
  try {
    await f.limit("100");
    await f.amount("1");
    f.state.fetchData = async () => ({
      ...f.data,
      maxTradeSzs: ["0.9", "0.8"],
    });
    await f.submit();
    assert.equal(f.calls.fetch, 2);
    assert.equal(f.calls.ensure, 1);
    assert.equal(f.calls.toasts.at(-1).title, "保证金不足");
    assert.equal(f.calls.orders.length, 0);
    assert.equal(f.calls.closed, 0);
    assert.equal(f.one("Button").props.loading, false);
  } finally {
    await f.close();
  }
});

test("D13-53 提交刷新请求离线失败→明确错误→恢复后可重试，不假关闭或残留loading", async () => {
  const f = await mountAddForm();
  try {
    f.state.fetchData = async () => {
      throw Error("offline-fixture");
    };
    f.state.connected = false;
    await f.refresh();
    // Reuse the production submit-time fetch error path to exercise a real
    // network rejection without altering any product catch/validation logic.
    await f.amount("1");
    await f.submit();
    assert.equal(f.calls.toasts.at(-1).title, "offline-fixture");
    assert.equal(f.one("Button").props.loading, false);
    assert.equal(f.calls.orders.length, 0);
    assert.equal(f.calls.closed, 0);
    f.state.fetchData = async () => structuredClone(f.data);
    f.state.connected = true;
    await f.refresh();
    await f.submit();
    assert.equal(
      f.calls.orders.length,
      1,
      "Recoverable retry reaches inert sink, never a network order",
    );
  } finally {
    await f.close();
  }
});

test("D13-53 首次打开离线：加载失败可点击解释；连接恢复自动重新加载，不需重开弹窗", async () => {
  const f = await mountAddForm({ initialOffline: true });
  try {
    assert.equal(f.one("SizeInput").props.isAssetCtxReady, false);
    assert.equal(f.one("Button").props.disabled, false);
    await f.submit();
    assert.equal(f.calls.toasts.at(-1).title, "目标市场数据已变化，请重试。");
    assert.equal(f.calls.fetch, 2, "Click initiates an actual reload attempt");
    assert.equal(f.calls.ensure, 0);
    assert.equal(f.calls.orders.length, 0);
    assert.equal(f.calls.closed, 0);
    f.state.fetchData = async () => structuredClone(f.data);
    f.state.connected = true;
    await f.refresh();
    assert.equal(
      f.calls.fetch,
      3,
      "Reconnect effect performs another actual reload",
    );
    assert.equal(f.one("SizeInput").props.isAssetCtxReady, true);
    assert.equal(f.one("Button").props.disabled, false);
    await f.amount("1");
    await f.submit();
    assert.equal(f.calls.orders.length, 1);
  } finally {
    await f.close();
  }
});

test("D13-51 提交中再次点击不重复调用授权、刷新或隔离订单服务", async () => {
  const f = await mountAddForm(),
    gate = deferred();
  try {
    await f.limit("100");
    await f.amount("1");
    f.state.place = () => gate.promise;
    let pending;
    await f.tick(() => {
      pending = f.submitHandler()();
    });
    assert.equal(f.one("Button").props.loading, true);
    const counts = {
      orders: f.calls.orders.length,
      ensure: f.calls.ensure,
      fetch: f.calls.fetch,
    };
    await f.submit();
    assert.deepEqual(
      {
        orders: f.calls.orders.length,
        ensure: f.calls.ensure,
        fetch: f.calls.fetch,
      },
      counts,
    );
    gate.resolve();
    await f.tick(() => pending);
    assert.equal(f.calls.closed, 1);
    assert.equal(f.one("Button").props.loading, false);
  } finally {
    await f.close();
  }
});
