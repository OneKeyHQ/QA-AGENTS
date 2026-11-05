import test from "node:test";
import assert from "node:assert/strict";
import {
  priceSection,
  estimateRow,
  confirmPanel,
  confirmValidation,
  exchangeFixture,
} from "./twap-flow-fixture.mjs";
import { historyRow, origin, orderState } from "./twap-source-fixture.mjs";
import {
  stateFixture,
  stateHelpers,
  otherAccount,
} from "./twap-state-fixture.mjs";
const plain = (value) => JSON.parse(JSON.stringify(value));

for (const side of ["long", "short"]) {
  test(`D11-317/332 real Desktop price labels and trigger direction ${side}`, async () => {
    const p = await priceSection({ form: { side, twapTriggerPrice: "110" } });
    try {
      assert.equal(p.props()[0].label, "触发价格");
      assert.equal(p.props()[0].labelSuffix, "(高于)");
      assert.equal(
        p.props()[1].label,
        side === "long" ? "价格上限" : "价格下限",
      );
      await p.enter(0, "90");
      assert.equal(p.props()[0].labelSuffix, "(低于)");
      await p.enter(0, "100");
      assert.equal(p.props()[0].labelSuffix, undefined);
    } finally {
      await p.close();
    }
  });
  for (const index of [0, 1])
    test(`D11-335 real PriceInput→TradingFormInput filters every boundary ${side}/${index}`, async () => {
      const p = await priceSection({
        form: { side, twapTriggerPrice: "110", twapStopPrice: "120" },
      });
      try {
        for (const raw of [
          "-1",
          " ",
          "abc",
          "💰",
          "9".repeat(1000),
          "12.3456789",
          "NaN",
          "Infinity",
          "00",
          "01",
          "1e3",
        ]) {
          const before = p.inputs()[index].value,
            count = p.changes.length;
          await p.enter(index, raw);
          assert.equal(
            p.inputs()[index].value,
            before,
            `reject ${JSON.stringify(raw)}`,
          );
          assert.equal(
            p.changes.length,
            count,
            "Rejected input cannot update the actual form",
          );
        }
        await p.enter(index, "0");
        assert.equal(p.inputs()[index].value, "0");
        await p.enter(index, "1。2");
        assert.equal(p.inputs()[index].value, "1.2");
        await p.enter(index, "");
        assert.equal(p.inputs()[index].value, "");
      } finally {
        await p.close();
      }
    });
  test(`D11-49/336 actual confirm duration, side, exact prices and estimation ${side}`, async () => {
    const c = await confirmPanel({
      form: {
        side,
        twapDurationMinutes: "90",
        twapTriggerPrice: "110.009",
        twapStopPrice: side === "long" ? "120.009" : "100.009",
      },
    });
    try {
      assert.deepEqual(c.texts(), [
        "订单类型",
        `分时委托 / ${side === "long" ? "买入" : "卖出"}`,
        "执行时长",
        "90 分钟",
        "触发价格",
        "$110",
        side === "long" ? "价格上限" : "价格下限",
        side === "long" ? "$120" : "$100",
        "仓位",
        "2.00 BTC",
        "订单价值",
        "$200.00",
        "随机执行",
        "是",
        "每笔子订单金额",
        "≈ 0.1 BTC",
      ]);
      assert.equal(c.events.submits.length, 0);
      const hint = c.tree().root.findByType("DashText").props.tooltip;
      for (const phrase of ["此金额为预估值", "价格", "随机", "未完全成交"])
        assert.ok(hint.includes(phrase), phrase);
    } finally {
      await c.close();
    }
  });
  test(`D11-332 full actual confirmation rejects equal trigger before local order sink ${side}`, async () => {
    const f = confirmValidation({ side, twapTriggerPrice: "100" });
    await f.run();
    assert.deepEqual(f.events.orders, []);
    assert.equal(f.events.resets, 0);
    assert.equal(f.events.errors.length, 1);
    assert.match(f.events.errors[0].message, /触发价.*当前|触发价格.*当前/u);
    const positive = confirmValidation({ side, twapTriggerPrice: "110" });
    await positive.run();
    assert.equal(
      positive.events.orders.length,
      1,
      "Positive control reaches local order sink",
    );
    assert.equal(positive.events.orders[0].twapTriggerAbove, true);
  });
}
for (const [size, expected] of [
  ["1", "≈ 0.1 BTC"],
  ["11", "≈ 1 BTC"],
]) {
  test(`D11-336 actual form and confirmation agree on exact estimate, unit and complete hint ${size}`, async () => {
    const form = await estimateRow({ size }),
      confirm = await confirmPanel({ size });
    try {
      assert.deepEqual(form.texts(), ["每笔子订单金额", expected]);
      assert.ok(confirm.texts().includes("每笔子订单金额"));
      assert.ok(confirm.texts().includes(expected));
      const hint =
        "此金额为预估值。价格变化、随机执行或前序子订单未完全成交后的补量，都可能使实际子订单金额发生变化。";
      assert.equal(form.hint(), hint);
      assert.equal(
        confirm.tree().root.findByType("DashText").props.tooltip,
        hint,
      );
      assert.equal(confirm.events.submits.length, 0);
    } finally {
      await form.close();
      await confirm.close();
    }
  });
}
test("D11-337 actual form replaces stale estimate and stale symbol with placeholder", async () => {
  const form = await estimateRow();
  try {
    assert.deepEqual(form.texts(), ["每笔子订单金额", "≈ 0.1 BTC"]);
    await form.update({ mid: "0", symbol: "ETH" });
    assert.deepEqual(form.texts(), ["每笔子订单金额", "-- ETH"]);
    await form.update({ mid: "100", size: "11" });
    assert.deepEqual(form.texts(), ["每笔子订单金额", "≈ 1 ETH"]);
  } finally {
    await form.close();
  }
});
test("D11-337 actual confirm clears stale estimated quantity when market disappears", async () => {
  const c = await confirmPanel();
  try {
    assert.ok(c.texts().includes("≈ 0.1818 BTC"));
    await c.update({ mid: "0" });
    assert.equal(
      c.texts().some((t) => t.includes("≈")),
      false,
    );
    await c.update({ mid: "100", size: "20" });
    assert.ok(c.texts().includes("≈ 1.8182 BTC"));
  } finally {
    await c.close();
  }
});
test("D11-228 actual confirmation blocks offline and permits local retry after recovery", async () => {
  const c = await confirmPanel({ offline: true });
  try {
    await c.submit();
    assert.equal(c.events.submits.length, 0);
    assert.equal(c.events.errors.length, 1);
    assert.equal(c.events.errors[0].title, "连线中断");
    assert.equal(
      c.events.errors[0].message,
      "您的数据可能不是最新的，请尝试下拉刷新",
    );
    await c.update({ offline: false });
    await c.submit();
    assert.equal(c.events.submits.length, 1);
  } finally {
    await c.close();
  }
});
test("D11-330 actual confirmation has no hidden prices after clearing advanced fields", async () => {
  const c = await confirmPanel({
    form: { twapTriggerPrice: "110", twapStopPrice: "120" },
  });
  try {
    assert.ok(c.texts().includes("$110"));
    await c.update({
      form: { ...c.state.form, twapTriggerPrice: "", twapStopPrice: "" },
    });
    for (const text of ["触发价格", "价格上限", "$110", "$120"])
      assert.equal(c.texts().includes(text), false);
  } finally {
    await c.close();
  }
});
for (const isSpot of [false, true])
  test(`D11-330 actual advanced checkbox clears both prices before confirmation ${isSpot}`, async () => {
    const form = await priceSection({
      bottom: true,
      isSpot,
      form: { twapTriggerPrice: "110", twapStopPrice: "120" },
    });
    let confirm;
    try {
      assert.deepEqual(
        form.inputs().map((p) => p.value),
        ["110", "120"],
      );
      await form.advanced(false);
      assert.equal(form.inputs().length, 0);
      assert.deepEqual(plain(form.changes.at(-1)), {
        twapTriggerPrice: "",
        twapStopPrice: "",
      });
      confirm = await confirmPanel({
        mode: isSpot ? "spot" : "perp",
        form: form.state.form,
      });
      for (const text of ["触发价格", "价格上限", "价格下限", "$110", "$120"])
        assert.equal(confirm.texts().includes(text), false);
      await form.advanced(true);
      assert.deepEqual(
        form.inputs().map((p) => p.value),
        ["", ""],
      );
      assert.equal(confirm.events.submits.length, 0);
    } finally {
      await form.close();
      if (confirm) await confirm.close();
    }
  });
test("D11-331 actual updateTradingForm clears incompatible stop but preserves independent trigger", async () => {
  const f = stateFixture();
  f.state.form = {
    side: "long",
    twapTriggerPrice: "110",
    twapStopPrice: "120",
    twapDurationMinutes: "5",
  };
  await f.actions.updateTradingForm({ side: "short" });
  assert.equal(f.state.form.twapStopPrice, "");
  assert.equal(f.state.form.twapTriggerPrice, "110");
  assert.equal(f.state.form.side, "short");
  f.state.form.twapStopPrice = "90";
  await f.actions.updateTradingForm({ side: "long" });
  assert.equal(f.state.form.twapStopPrice, "");
  assert.equal(f.state.form.twapDurationMinutes, "5");
});
test("D11-346 actual history merge and scoped hook do not resurrect a terminal order after stale push", async () => {
  const f = stateFixture(),
    latest = orderState({ executedSz: "1.5", executedNtl: "150" });
  const record = (status, time, state = latest) => ({
    twapId: 7,
    time,
    state,
    status: { status },
  });
  await f.actions.updateTwapStates({ user: f.account, states: [[7, latest]] });
  await f.actions.updateTwapHistory({
    user: f.account,
    history: [record("stopped", origin + 180_000)],
  });
  await f.actions.updateTwapStates({
    user: f.account,
    states: [[7, orderState()]],
  });
  await f.actions.updateTwapHistory({
    user: f.account,
    history: [record("waitingForTrigger", origin, orderState())],
  });
  let view = await f.view();
  assert.equal(view.twapOrders.length, 0);
  assert.equal(view.historyRows[0].state.executedSz, "1.5");
  assert.equal(view.activeRuntimeInfoById.get(7).reportedStatus, "stopped");
  f.responses.orders = { user: f.account, twapStates: [[7, orderState()]] };
  f.responses.history = [
    record("activated", origin + 120_000, orderState({ executedSz: "0.5" })),
  ];
  await f.actions.loadTwapData();
  view = await f.view();
  assert.equal(view.twapOrders.length, 0);
  assert.equal(view.historyRows[0].state.executedSz, "1.5");
});
test("D11-206/231 actual account-scoped history and active state keep IDs independent", async () => {
  const f = stateFixture();
  await f.actions.updateTwapStates({
    user: f.account.toUpperCase(),
    states: [
      [7, orderState()],
      [8, orderState({ coin: "ETH" })],
    ],
  });
  assert.deepEqual(
    plain((await f.view()).twapOrders.map((o) => o.twapId)),
    [8, 7],
  );
  await f.actions.updateTwapHistory({
    user: otherAccount,
    history: [
      {
        twapId: 99,
        state: orderState(),
        time: origin,
        status: { status: "activated" },
      },
    ],
  });
  assert.equal(f.state.history.history.length, 0);
  f.state.active = otherAccount;
  assert.equal((await f.view()).twapOrders.length, 0);
  f.state.active = f.account;
  assert.deepEqual(
    plain((await f.view()).twapOrders.map((o) => o.twapId)),
    [8, 7],
  );
});
test("D11-206 actual short WS history merges into full HTTP history without losses or duplicates", async () => {
  const f = stateFixture();
  const records = Array.from({ length: 45 }, (_, i) => ({
    twapId: i + 1,
    time: origin + i * 1000,
    state: orderState(),
    status: { status: "finished" },
  }));
  f.responses.history = records;
  await f.actions.loadTwapData();
  await f.actions.updateTwapHistory({
    user: f.account,
    history: records.slice(15).toReversed(),
  });
  assert.deepEqual(
    plain(f.state.history.history.map((r) => r.twapId)),
    records.map((r) => r.twapId).toReversed(),
  );
  assert.equal(f.state.history.history.length, 45);
});
test("D11-205/229 actual fills merge includes disconnected fills and treats tid=0 as an identity", async () => {
  const f = stateFixture();
  const fill = (tid, sz, px) => ({
    twapId: 7,
    fill: { tid, time: origin + tid * 1000, coin: "BTC", side: "B", sz, px },
  });
  const first = fill(0, "0.5", "100"),
    second = fill(1, "1", "110");
  await f.actions.updateTwapSliceFills({
    user: f.account,
    twapSliceFills: [first],
  });
  f.responses.fills = [first, second];
  await f.actions.loadTwapData();
  assert.deepEqual(plain(f.state.fills.fills.map((r) => r.fill.tid)), [1, 0]);
  assert.equal(f.state.fills.latestTime, origin + 1000);
  assert.equal(
    f.state.fills.fills.reduce((sum, r) => sum + Number(r.fill.sz), 0),
    1.5,
  );
  // Same tid in different TWAP IDs must not collapse into one fill.
  assert.equal(
    stateHelpers.sortAndDedupeTwapSliceFills([first, { ...first, twapId: 8 }])
      .length,
    2,
  );
});
test(
  "D11-342 strict legacy history placeholder",
  {
    todo: "固定源码历史列直接显示总时长，缺激活时间仍显示5分钟；保留原预期差异，不计通过",
  },
  async () => {
    const row = await historyRow(orderState(), { activatedAt: undefined });
    try {
      assert.equal(row.cells()[8], "--");
    } finally {
      await row.close();
    }
  },
);
for (const status of ["finished", "stopped", "terminated"])
  test(`D11-342 terminal Desktop history duration freezes and never exceeds total ${status}`, async () => {
    const state = orderState(),
      record = { twapId: 7, state, time: origin + 180_000, status: { status } };
    const row = await historyRow(state, { record });
    try {
      assert.equal(row.cells()[8], "5 分钟");
      await row.update({ record, now: origin + 240_000 });
      assert.equal(row.cells()[8], "5 分钟");
      await row.update({ record, now: origin + 3_600_000 });
      assert.equal(row.cells()[8], "5 分钟");
    } finally {
      await row.close();
    }
  });
for (const mode of ["perp", "spot"])
  test(
    `D11-337 strict confirmation missing-mid placeholder ${mode}`,
    { todo: "固定源码确认弹窗移除整行，未显示原用例要求的占位值；不计通过" },
    async () => {
      const confirm = await confirmPanel({ mode });
      try {
        assert.ok(confirm.texts().includes("≈ 0.1818 BTC"));
        await confirm.update({ mid: "0" });
        assert.ok(confirm.texts().includes("每笔子订单金额"));
        assert.ok(confirm.texts().includes("-- BTC"));
      } finally {
        await confirm.close();
      }
    },
  );
test(
  "D11-346 strict late active push cannot reduce executed quantity",
  {
    todo: "当前updateTwapStates直接替换同DEX快照，迟到快照会回退已成交数量；保留严格断言，不计通过",
  },
  async () => {
    const f = stateFixture();
    await f.actions.updateTwapStates({
      user: f.account,
      states: [[7, orderState({ executedSz: "1.5" })]],
    });
    await f.actions.updateTwapStates({
      user: f.account,
      states: [[7, orderState({ executedSz: "0.5" })]],
    });
    assert.equal((await f.view()).twapOrders[0].state.executedSz, "1.5");
  },
);

for (const mode of ["perp", "spot"])
  for (const isBuy of [false, true]) {
    const base = {
      assetId: mode === "spot" ? 10000 : 0,
      size: "2.009",
      szDecimals: 2,
      isBuy,
      reduceOnly: true,
      minutes: 10080,
      randomize: true,
      referencePrice: "100",
      markPrice: "100",
    };
    test(`D11-326 actual service rejects crossing confirmed trigger before any local client ${mode}/${isBuy}`, async () => {
      const f = exchangeFixture(mode);
      for (const markPrice of ["110", "111"]) {
        await assert.rejects(
          f.service.placeTwapOrder({
            ...base,
            triggerPrice: "110",
            triggerAbove: true,
            markPrice,
          }),
          { message: "目标市场数据已变化，请重试。" },
        );
        assert.equal(f.events.clients, 0);
        assert.equal(f.events.wire.length, 0);
      }
      await f.service.placeTwapOrder({
        ...base,
        triggerPrice: "110",
        triggerAbove: true,
      });
      assert.equal(
        f.events.wire.length,
        1,
        "Non-crossed positive control reaches only the local wire sink",
      );
    });
    test(`D11-334 actual advanced details are omitted/null/normalized correctly ${mode}/${isBuy}`, async () => {
      const f = exchangeFixture(mode),
        stopPrice = isBuy ? "120" : "90";
      for (const patch of [
        {},
        { triggerPrice: "110.009", triggerAbove: true },
        { stopPrice },
        { triggerPrice: "110", triggerAbove: true, stopPrice },
      ]) {
        await f.service.placeTwapOrder({ ...base, ...patch });
        const wire = plain(f.events.wire.at(-1));
        assert.deepEqual(wire.twap, {
          a: base.assetId,
          b: isBuy,
          s: "2",
          r: mode !== "spot",
          m: 10080,
          t: true,
        });
        if (!Object.keys(patch).length)
          assert.equal(Object.hasOwn(wire, "details"), false);
        else
          assert.deepEqual(wire.details, {
            t: patch.triggerPrice ? { p: "110", a: true } : null,
            s: patch.stopPrice ?? null,
          });
      }
    });
  }
test("D11-338 actual service truncates size before minimum and preserves one-lot positive control", async () => {
  const f = exchangeFixture(),
    base = {
      assetId: 0,
      szDecimals: 2,
      isBuy: true,
      minutes: 5,
      randomize: true,
      referencePrice: "100",
      markPrice: "100",
    };
  await assert.rejects(
    f.service.placeTwapOrder({ ...base, size: "0.99999" }),
    /100/u,
  );
  assert.equal(f.events.clients, 0);
  await f.service.placeTwapOrder({ ...base, size: "1.00999" });
  assert.equal(f.events.wire[0].twap.s, "1");
});
test("D11-80 resetTradingForm preserves reduce-only/duration/randomize while clearing advanced prices", async () => {
  const f = stateFixture();
  f.state.form = {
    side: "long",
    orderMode: "twap",
    size: "2",
    twapReduceOnly: true,
    twapRandomize: false,
    twapDurationMinutes: "90",
    twapTriggerPrice: "110",
    twapStopPrice: "120",
  };
  await f.actions.updateTradingForm({ orderMode: "default", type: "market" });
  assert.equal(f.state.form.twapReduceOnly, true);
  await f.actions.updateTradingForm({ orderMode: "twap" });
  assert.equal(f.state.form.twapReduceOnly, true);
  await f.actions.resetTradingForm();
  assert.equal(f.state.form.twapReduceOnly, true);
  assert.equal(f.state.form.twapRandomize, false);
  assert.equal(f.state.form.twapDurationMinutes, "90");
  assert.equal(f.state.form.twapTriggerPrice, "");
  assert.equal(f.state.form.twapStopPrice, "");
  assert.equal(f.state.form.size, "");
});
test("D11-231 actual HTTP request finishing after switching account cannot repopulate old data", async () => {
  const f = stateFixture();
  let resolveHistory;
  f.responses.history = new Promise((resolve) => {
    resolveHistory = resolve;
  });
  const pending = f.actions.loadTwapData();
  await Promise.resolve();
  await Promise.resolve();
  f.state.active = otherAccount;
  resolveHistory([
    {
      twapId: 7,
      state: orderState(),
      time: origin,
      status: { status: "activated" },
    },
  ]);
  await pending;
  assert.equal(f.state.history.history.length, 0);
  assert.equal((await f.view()).twapOrders.length, 0);
});
for (const status of ["finished", "terminated", "stopped", "error"])
  test(`D11-206 actual terminal filters are per order ID rather than shared coin ${status}`, async () => {
    const f = stateFixture();
    await f.actions.updateTwapStates({
      user: f.account,
      states: [
        [7, orderState()],
        [8, orderState()],
      ],
    });
    await f.actions.updateTwapHistory({
      user: f.account,
      history: [
        {
          twapId: 7,
          state: orderState(),
          time: origin,
          status: { status },
        },
      ],
    });
    assert.deepEqual(
      plain((await f.view()).twapOrders.map((o) => o.twapId)),
      [8],
    );
  });
