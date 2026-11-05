import test from "node:test";
import assert from "node:assert/strict";
import { twapListFixture } from "./twap-list-fixture.mjs";
import { stateFixture, otherAccount } from "./twap-state-fixture.mjs";
import { orderState, origin } from "./twap-source-fixture.mjs";
const plain = (v) => JSON.parse(JSON.stringify(v));
const history = (id, status = "finished", patch = {}) => ({
  twapId: id,
  time: origin + id * 1000,
  state: orderState({ side: "B", ...patch }),
  status: { status },
});
const fill = (id, tid = 0, patch = {}) => ({
  twapId: id,
  fill: {
    tid,
    time: origin + tid * 1000,
    coin: "BTC",
    side: "B",
    sz: "0.5",
    px: "100",
    fee: "0",
    feeToken: "USDC",
    closedPnl: "0",
    ...patch,
  },
});
const descending = (first, last) =>
  Array.from({ length: first - last + 1 }, (_, i) => first - i);
const ids = (f) => f.rows().map((r) => r.id);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

for (const count of [21, 40, 45])
  test(`D11-206 actual Desktop TWAP pagination walks every history record and returns ${count}`, async () => {
    const store = stateFixture();
    store.responses.history = Array.from({ length: count }, (_, i) =>
      history(i + 1),
    );
    const f = await twapListFixture({ store, initialTab: "history" });
    try {
      assert.equal(f.page(), 1);
      assert.equal(f.table().props.pageSize, 20);
      assert.equal(f.button("previous").props.disabled, true);
      const all = [];
      let page = 1;
      while (true) {
        const first = count - (page - 1) * 20,
          last = Math.max(1, first - 19);
        assert.deepEqual(ids(f), descending(first, last));
        all.push(...ids(f));
        if (f.button("next").props.disabled) break;
        await f.press("next");
        page++;
        assert.equal(f.page(), page);
      }
      assert.equal(page, Math.ceil(count / 20));
      assert.equal(new Set(all).size, count);
      assert.deepEqual(all, descending(count, 1));
      while (f.page() > 1) await f.press("previous");
      assert.deepEqual(ids(f), descending(count, count - 19));
      assert.equal(f.button("previous").props.disabled, true);
    } finally {
      await f.close();
    }
  });
test("D11-206 actual page-number input changes rendered page and rejects out-of-range values", async () => {
  const store = stateFixture();
  store.responses.history = Array.from({ length: 45 }, (_, i) =>
    history(i + 1),
  );
  const f = await twapListFixture({ store, initialTab: "history" });
  try {
    await f.jump("3");
    assert.equal(f.page(), 3);
    assert.deepEqual(ids(f), [5, 4, 3, 2, 1]);
    for (const invalid of ["0", "4", "-1", "", "abc"]) {
      await f.jump(invalid);
      assert.equal(f.page(), 3);
      assert.deepEqual(ids(f), [5, 4, 3, 2, 1]);
      assert.equal(
        f
          .root()
          .findAllByType("Input")
          .find(
            (n) =>
              n.props.testID === "perp-input-with-accessory-done-view-input",
          ).props.value,
        "3",
      );
    }
    await f.select("fills");
    assert.equal(f.page(), 1);
    assert.equal(f.rows().length, 0);
    await f.select("history");
    assert.equal(f.page(), 1);
    assert.deepEqual(ids(f), descending(45, 26));
  } finally {
    await f.close();
  }
});
test("D11-206 short history push and refresh retain all pages and independent terminal filters", async () => {
  const store = stateFixture(),
    records = Array.from({ length: 45 }, (_, i) => history(i + 1));
  store.responses.history = records;
  store.responses.orders = {
    user: store.account,
    twapStates: [
      [
        46,
        orderState({
          side: "B",
          trigger: undefined,
          executedSz: "1",
          executedNtl: "100",
        }),
      ],
    ],
  };
  const f = await twapListFixture({ store, initialTab: "history" });
  try {
    await f.press("next");
    assert.deepEqual(ids(f), descending(25, 6));
    await f.mutate(async () =>
      store.actions.updateTwapHistory({
        user: store.account,
        history: records.slice(-30).toReversed(),
      }),
    );
    await f.rerender();
    assert.equal(f.page(), 2);
    assert.deepEqual(ids(f), descending(25, 6));
    await f.refresh();
    assert.deepEqual(ids(f), descending(25, 6));
    assert.equal(f.table().props.data.length, 45);
    await f.select("active");
    assert.deepEqual(ids(f), [46]);
    for (const status of ["finished", "terminated", "stopped", "error"]) {
      await f.mutate(async () =>
        store.actions.updateTwapHistory({
          user: store.account,
          history: [history(46, status)],
        }),
      );
      await f.rerender();
      assert.deepEqual(ids(f), []);
    }
  } finally {
    await f.close();
  }
});
test("D11-204/207 actual three Desktop subtabs have independent exact empty states", async () => {
  const f = await twapListFixture();
  try {
    assert.deepEqual(plain(f.tabs()), [
      { key: "active", label: "当前委托" },
      { key: "history", label: "历史委托" },
      { key: "fills", label: "成交历史" },
    ]);
    for (const [key, title] of [
      ["active", "暂无分时委托"],
      ["history", "暂无分时委托历史"],
      ["fills", "暂无分时委托成交历史"],
    ]) {
      await f.select(key);
      assert.equal(f.selected(), key);
      assert.equal(
        f.table().props.listViewDebugRenderTrackerProps.name,
        `PerpTwapList_${key}`,
      );
      assert.deepEqual(ids(f), []);
      assert.equal(f.table().props.data.length, 0);
      const empty = f.root().findAllByType("Empty");
      assert.equal(empty.length, 1);
      assert.equal(empty[0].props.title, title);
      assert.equal(
        f
          .root()
          .findAll(
            (n) =>
              n.type === "PerpTableScrollView" &&
              n.props.testID === "perp-desktop-table-body",
          ).length,
        0,
      );
    }
  } finally {
    await f.close();
  }
});
test("D11-231 actual current/history/fill entries hide A while B is loading and show latest A after return", async () => {
  const store = stateFixture(),
    a = orderState({
      side: "B",
      coin: "PURRDAT",
      executedSz: "1",
      executedNtl: "100",
      trigger: undefined,
    });
  const aHistory = history(7, "activated", { ...a }),
    aFill = fill(7, 0, { coin: "PURRDAT" });
  store.responses.orders = {
    user: store.account,
    twapStates: [
      [7, a],
      [8, orderState({ side: "B", coin: "BTC", trigger: undefined })],
    ],
  };
  store.responses.history = [aHistory];
  store.responses.fills = [aFill];
  const f = await twapListFixture({ store });
  try {
    assert.deepEqual(ids(f), [8, 7]);
    await f.switchCoin(8);
    assert.deepEqual(f.events.switches, ["BTC"]);
    assert.deepEqual(ids(f), [8, 7]);
    for (const [tab, expected] of [
      ["history", [7]],
      ["fills", [7]],
    ]) {
      await f.select(tab);
      assert.deepEqual(ids(f), expected);
    }
    const bOrders = deferred(),
      bHistory = deferred(),
      bFills = deferred();
    store.responses.orders = bOrders.promise;
    store.responses.history = bHistory.promise;
    store.responses.fills = bFills.promise;
    await f.mutate(async () => {
      store.state.active = otherAccount;
    });
    await f.rerender();
    for (const tab of ["active", "history", "fills"]) {
      await f.select(tab);
      assert.deepEqual(ids(f), [], `${tab} must hide A before B response`);
    }
    await f.mutate(async () => {
      bOrders.resolve({
        user: otherAccount,
        twapStates: [
          [
            99,
            orderState({
              side: "B",
              coin: "ETH",
              trigger: undefined,
              executedSz: "1",
              executedNtl: "90",
            }),
          ],
        ],
      });
      bHistory.resolve([history(99, "activated", { coin: "ETH" })]);
      bFills.resolve([fill(99, 0, { coin: "ETH" })]);
    });
    await f.rerender();
    for (const tab of ["active", "history", "fills"]) {
      await f.select(tab);
      assert.deepEqual(ids(f), [99]);
      assert.ok(f.rows()[0].texts.includes("ETH"));
      assert.equal(f.rows()[0].texts.includes("PURRDAT"), false);
    }
    const latest = { ...a, executedSz: "1.5", executedNtl: "165" };
    store.responses.orders = { user: store.account, twapStates: [[7, latest]] };
    store.responses.history = [history(7, "activated", latest)];
    store.responses.fills = [
      aFill,
      fill(7, 1, { coin: "PURRDAT", sz: "1", px: "115" }),
    ];
    await f.mutate(async () => {
      store.state.active = store.account;
    });
    await f.rerender();
    await f.select("active");
    assert.deepEqual(ids(f), [7]);
    assert.ok(f.rows()[0].texts.includes("1.5 PURRDAT"));
    await f.select("history");
    assert.deepEqual(ids(f), [7]);
    assert.equal(f.rows()[0].record.state.executedSz, "1.5");
    await f.select("fills");
    assert.deepEqual(ids(f), [7, 7]);
    assert.equal(
      f.rows().some((r) => r.texts.includes("ETH")),
      false,
    );
  } finally {
    await f.close();
  }
});
test("D11-229 actual failed refresh preserves displayed progress, then recovery adds missing fill", async () => {
  const store = stateFixture(),
    initial = orderState({
      side: "B",
      trigger: undefined,
      executedSz: "1",
      executedNtl: "105",
      sz: "4",
    }),
    first = [fill(7, 0), fill(7, 1, { px: "110" })];
  store.responses.orders = { user: store.account, twapStates: [[7, initial]] };
  store.responses.history = [history(7, "activated", initial)];
  store.responses.fills = first;
  const f = await twapListFixture({ store, state: { now: origin + 60_000 } });
  try {
    assert.ok(f.rows()[0].texts.includes("1 BTC"));
    const errors = [deferred(), deferred(), deferred()];
    [store.responses.orders, store.responses.history, store.responses.fills] =
      errors.map((e) => e.promise);
    const pending = f.refresh();
    for (const e of errors) e.reject(Error("local simulated offline"));
    await pending;
    assert.ok(f.rows()[0].texts.includes("1 BTC"));
    await f.select("fills");
    assert.equal(f.rows().length, 2);
    const latest = { ...initial, executedSz: "1.5", executedNtl: "165" };
    store.responses.orders = { user: store.account, twapStates: [[7, latest]] };
    store.responses.history = [history(7, "activated", latest)];
    store.responses.fills = [
      ...first,
      fill(7, 2, { px: "120", time: origin + 90_000 }),
    ];
    await f.refresh();
    assert.equal(f.rows().length, 3);
    assert.equal(store.state.fills.latestTime, origin + 90_000);
    assert.deepEqual(
      f.rows().map((r) => r.record.fill.tid),
      [2, 1, 0],
    );
    assert.deepEqual(
      f.rows().map((r) => r.record.fill.px),
      ["120", "110", "100"],
    );
    await f.select("active");
    assert.ok(f.rows()[0].texts.includes("1.5 BTC"));
    assert.ok(f.rows()[0].texts.includes("110"));
    await f.tick(origin + 90_000);
    assert.ok(f.rows()[0].texts.includes("00:01:23 / 5 分钟"));
    await f.select("history");
    assert.equal(f.rows()[0].record.state.executedSz, "1.5");
  } finally {
    await f.close();
  }
});

test("D11-204 actual main tab count follows nonterminal account-scoped orders across all entries", async () => {
  const store = stateFixture();
  store.responses.orders = {
    user: store.account,
    twapStates: Array.from({ length: 6 }, (_, i) => [
      i + 1,
      orderState({ side: "B", trigger: undefined }),
    ]),
  };
  store.responses.history = ["finished", "terminated", "stopped", "error"].map(
    (status, i) => history(i + 1, status),
  );
  const f = await twapListFixture({ store });
  try {
    assert.equal(f.mainTitle(), "分时委托 (2)");
    assert.deepEqual(ids(f), [6, 5]);
    for (const tab of ["history", "fills", "active"]) {
      await f.select(tab);
      assert.equal(f.mainTitle(), "分时委托 (2)");
    }
    await f.mutate(async () =>
      store.actions.updateTwapHistory({
        user: store.account,
        history: [history(5, "finished"), history(6, "stopped")],
      }),
    );
    await f.rerender();
    assert.deepEqual(ids(f), []);
    assert.equal(f.mainTitle(), "分时委托");
    await f.mutate(async () => {
      store.state.active = otherAccount;
    });
    await f.rerender();
    assert.equal(f.mainTitle(), "分时委托");
  } finally {
    await f.close();
  }
});

test("D11-208/249 actual six status labels and three table schemas translate without changing records", async () => {
  const store = stateFixture(),
    statuses = [
      "waitingForTrigger",
      "activated",
      "finished",
      "terminated",
      "stopped",
      "error",
    ];
  const states = statuses.map((status, i) =>
    history(i + 1, status, {
      coin: i % 2 ? "ETH" : "BTC",
      sz: "4",
      executedSz: i === 0 ? "0" : "1",
      executedNtl: i === 0 ? "0" : "105",
      minutes: 5,
    }),
  );
  store.responses.history = states;
  store.responses.fills = [fill(2, 1)];
  store.responses.orders = {
    user: store.account,
    twapStates: [
      [1, orderState({ side: "B", trigger: { px: "120" } })],
      [
        2,
        orderState({
          side: "B",
          trigger: undefined,
          executedSz: "1",
          executedNtl: "105",
        }),
      ],
    ],
  };
  const f = await twapListFixture({ store, state: { now: origin + 60_000 } });
  const schemas = {
    active: [
      "coin",
      "size",
      "executedSize",
      "averagePrice",
      "triggerPrice",
      "stopPrice",
      "runningTime",
      "status",
      "reduceOnly",
      "randomize",
      "creationTime",
      "terminate",
    ],
    history: [
      "time",
      "coin",
      "sz",
      "executedSz",
      "avgPx",
      "triggerPrice",
      "stopPrice",
      "totalRuntime",
      "reduceOnly",
      "randomize",
      "status",
    ],
    fills: [
      "time",
      "coin",
      "direction",
      "price",
      "size",
      "value",
      "fee",
      "closePnl",
    ],
  };
  const labels = {
    zh_CN: ["等待触发", "活跃中", "已完成", "已终止", "已停止", "异常"],
    en_US: [
      "Waiting for Trigger",
      "Activated",
      "Finished",
      "Terminated",
      "Stopped",
      "Error",
    ],
  };
  try {
    for (const locale of ["zh_CN", "en_US", "zh_CN"]) {
      await f.update({ locale });
      await f.refresh();
      for (const tab of ["active", "history", "fills"]) {
        await f.select(tab);
        assert.deepEqual(
          plain(f.table().props.columns.map((c) => c.key)),
          schemas[tab],
        );
      }
      await f.select("history");
      assert.deepEqual(ids(f), [6, 5, 4, 3, 2, 1]);
      for (const r of f.rows()) {
        assert.ok(
          r.texts.includes(labels[locale][r.id - 1]),
          JSON.stringify({ locale, id: r.id, texts: r.texts }),
        );
        assert.equal(r.record.state.sz, "4");
        assert.equal(r.record.state.executedSz, r.id === 1 ? "0" : "1");
        assert.equal(r.record.state.minutes, 5);
        assert.equal(r.record.state.coin, r.id % 2 ? "BTC" : "ETH");
        assert.ok(r.texts.includes("4 " + r.record.state.coin));
        if (r.id > 2) assert.ok(r.texts.includes("1 " + r.record.state.coin));
        else assert.ok(r.texts.filter((t) => t === "--").length >= 2);
        if (r.id > 1)
          assert.ok(
            r.texts.includes(locale === "en_US" ? "5 minutes" : "5 分钟"),
          );
        else assert.ok(r.texts.includes("--"));
      }
      await f.select("active");
      assert.deepEqual(ids(f), [2, 1]);
      assert.equal(
        f.mainTitle(),
        locale === "en_US" ? "TWAP Orders (2)" : "分时委托 (2)",
      );
      assert.ok(
        f
          .rows()
          .find((r) => r.id === 1)
          .texts.includes(labels[locale][0]),
      );
      assert.ok(
        f
          .rows()
          .find((r) => r.id === 2)
          .texts.includes(labels[locale][1]),
      );
    }
  } finally {
    await f.close();
  }
});

test("D11-230 actual remount refetches latest progress and active-only timer has complete cleanup", async () => {
  const store = stateFixture(),
    s = orderState({
      side: "B",
      trigger: undefined,
      executedSz: "1",
      executedNtl: "100",
      sz: "4",
    });
  store.responses.orders = { user: store.account, twapStates: [[7, s]] };
  store.responses.history = [{ ...history(7, "activated", s), time: origin }];
  let f = await twapListFixture({ store, state: { now: origin + 60_000 } });
  try {
    assert.equal(f.timerCount(), 1);
    assert.ok(f.rows()[0].texts.includes("00:01:00 / 5 分钟"));
    await f.tick(origin + 61_000);
    assert.ok(f.rows()[0].texts.includes("00:01:01 / 5 分钟"));
    await f.select("history");
    assert.equal(f.timerCount(), 0);
    await f.select("fills");
    assert.equal(f.timerCount(), 0);
    await f.select("active");
    assert.equal(f.timerCount(), 1);
    await f.close();
    assert.equal(f.timerCount(), 0);
    const latest = { ...s, executedSz: "1.5", executedNtl: "165" };
    store.responses.orders = { user: store.account, twapStates: [[7, latest]] };
    store.responses.history = [
      { ...history(7, "activated", latest), time: origin },
    ];
    f = await twapListFixture({ store, state: { now: origin + 121_000 } });
    assert.deepEqual(ids(f), [7]);
    assert.ok(f.rows()[0].texts.includes("1.5 BTC"));
    assert.ok(f.rows()[0].texts.includes("110"));
    assert.ok(f.rows()[0].texts.includes("00:02:01 / 5 分钟"));
    const stop = f
      .root()
      .findAllByType("SizableText")
      .find(
        (n) =>
          n.props.children === "终止" && typeof n.props.onPress === "function",
      );
    assert.ok(stop, "Real terminate control remains available; never press it");
    await f.mutate(async () =>
      store.actions.updateTwapHistory({
        user: store.account,
        history: [history(7, "finished", latest)],
      }),
    );
    await f.rerender();
    assert.equal(f.timerCount(), 0);
    assert.deepEqual(ids(f), []);
  } finally {
    await f.close();
  }
});

test("D11-231 late A HTTP completion cannot replace B displayed rows in any entry", async () => {
  const store = stateFixture(),
    late = [deferred(), deferred(), deferred()];
  [store.responses.orders, store.responses.history, store.responses.fills] =
    late.map((d) => d.promise);
  const f = await twapListFixture({ store });
  try {
    assert.equal(store.calls.length, 3);
    store.responses.orders = {
      user: otherAccount,
      twapStates: [
        [99, orderState({ side: "B", coin: "ETH", trigger: undefined })],
      ],
    };
    store.responses.history = [history(99, "activated", { coin: "ETH" })];
    store.responses.fills = [fill(99, 1, { coin: "ETH" })];
    await f.mutate(async () => {
      store.state.active = otherAccount;
    });
    await f.rerender();
    for (const tab of ["active", "history", "fills"]) {
      await f.select(tab);
      assert.deepEqual(ids(f), [99]);
    }
    await f.mutate(async () => {
      late[0].resolve({
        user: store.account,
        twapStates: [[7, orderState({ side: "B", trigger: undefined })]],
      });
      late[1].resolve([history(7)]);
      late[2].resolve([fill(7)]);
    });
    await f.rerender();
    for (const tab of ["active", "history", "fills"]) {
      await f.select(tab);
      assert.deepEqual(ids(f), [99]);
      assert.ok(f.rows()[0].texts.includes("ETH"));
    }
    await f.mutate(async () => {
      store.state.active = undefined;
    });
    await f.rerender();
    for (const tab of ["active", "history", "fills"]) {
      await f.select(tab);
      assert.deepEqual(ids(f), []);
      assert.equal(f.mainTitle(), "分时委托");
    }
  } finally {
    await f.close();
  }
});

test("D11-229 independent history/fills become visible while active snapshot is pending", async () => {
  const store = stateFixture(),
    orders = deferred();
  store.responses.orders = orders.promise;
  store.responses.history = [history(7)];
  store.responses.fills = [fill(7, 1)];
  const f = await twapListFixture({ store });
  try {
    assert.deepEqual(ids(f), []);
    await f.select("history");
    assert.deepEqual(ids(f), [7]);
    await f.select("fills");
    assert.deepEqual(ids(f), [7]);
    await f.mutate(async () => {
      orders.resolve({
        user: store.account,
        twapStates: [[8, orderState({ side: "B", trigger: undefined })]],
      });
    });
    await f.rerender();
    await f.select("active");
    assert.deepEqual(ids(f), [8]);
    assert.equal(f.mainTitle(), "分时委托 (1)");
  } finally {
    await f.close();
  }
});

test("D11-229 concurrent real refreshes reuse in-flight requests, then allow a new successful retry", async () => {
  const store = stateFixture(),
    pending = [deferred(), deferred(), deferred()];
  [store.responses.orders, store.responses.history, store.responses.fills] =
    pending.map((d) => d.promise);
  const f = await twapListFixture({ store });
  try {
    let a, b;
    await f.mutate(async () => {
      a = store.actions.loadTwapData();
      b = store.actions.loadTwapData();
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(
      store.calls.length,
      3,
      "One call per actual endpoint during a same-account in-flight load",
    );
    await f.mutate(async () => {
      pending[0].resolve({ user: store.account, twapStates: [] });
      pending[1].resolve([history(7)]);
      pending[2].resolve([fill(7)]);
      await Promise.all([a, b]);
    });
    await f.rerender();
    await f.select("history");
    assert.deepEqual(ids(f), [7]);
    store.responses.orders = { user: store.account, twapStates: [] };
    store.responses.history = [history(8)];
    store.responses.fills = [fill(8)];
    await f.refresh();
    assert.equal(store.calls.length, 6);
    assert.deepEqual(ids(f), [8, 7]);
  } finally {
    await f.close();
  }
});

for (const count of [0, 1, 20, 21, 45])
  test(`D11-206 actual fill pagination keeps tid zero and all logical rows ${count}`, async () => {
    const store = stateFixture();
    store.responses.fills = Array.from({ length: count }, (_, i) => fill(7, i));
    const f = await twapListFixture({ store, initialTab: "fills" });
    try {
      const actual = [];
      for (let page = 1; page <= Math.max(1, Math.ceil(count / 20)); page++) {
        actual.push(...f.rows().map((r) => r.record.fill.tid));
        assert.equal(f.table().props.data.length, count);
        if (page < Math.ceil(count / 20)) await f.press("next");
      }
      assert.deepEqual(
        actual,
        Array.from({ length: count }, (_, i) => count - 1 - i),
      );
      assert.equal(new Set(actual).size, count);
    } finally {
      await f.close();
    }
  });

test(
  "D11-231 switching account from history page three to a two-page dataset resets to a valid visible page",
  {
    todo: "Pinned source retains page 3 after switching to B with 21 rows; the rendered page is empty. Requires TF confirmation, not counted as passed.",
  },
  async () => {
    const store = stateFixture();
    store.responses.history = Array.from({ length: 45 }, (_, i) =>
      history(i + 1),
    );
    const f = await twapListFixture({ store, initialTab: "history" });
    try {
      await f.jump("3");
      assert.deepEqual(ids(f), [5, 4, 3, 2, 1]);
      store.responses.history = Array.from({ length: 21 }, (_, i) =>
        history(i + 100),
      );
      await f.mutate(async () => {
        store.state.active = otherAccount;
      });
      assert.equal(f.table().props.data.length, 21);
      assert.equal(
        f.page(),
        1,
        `Account switch must reset page: current=${f.page()}, total=2, visible=${f.rows().length}`,
      );
      assert.deepEqual(
        ids(f),
        descending(120, 101),
        "Latest B history must be visible after account switch",
      );
    } finally {
      await f.close();
    }
  },
);

test("D11-249 actual Desktop rows map every column to its own formatted field", async () => {
  const store = stateFixture(),
    time = new Date(2026, 9, 30, 8, 0, 0).getTime();
  const active = orderState({
    side: "B",
    sz: "4",
    executedSz: "1",
    executedNtl: "110",
    timestamp: time,
    trigger: { px: "120" },
    stopPx: "140",
    reduceOnly: true,
    randomize: false,
  });
  store.responses.orders = { user: store.account, twapStates: [[7, active]] };
  store.responses.history = [
    { twapId: 7, time, state: active, status: { status: "activated" } },
    {
      twapId: 8,
      time: time + 300_000,
      state: { ...active, executedSz: "2", executedNtl: "220" },
      status: { status: "finished" },
    },
  ];
  store.responses.fills = [
    fill(8, 0, {
      time: time + 1000,
      dir: "Open Long",
      sz: "0.5",
      px: "110",
      fee: "0.05",
      closedPnl: "2",
    }),
  ];
  const f = await twapListFixture({ store, state: { now: time + 60_000 } });
  try {
    assert.deepEqual(f.rows()[0].cellValues, [
      "BTC",
      "4 BTC",
      "1 BTC",
      "110",
      "120",
      "140",
      "00:01:00 / 5 分钟",
      "活跃中",
      "是",
      "否",
      "2026/10/30 08:00:00",
      "终止",
    ]);
    await f.select("history");
    assert.deepEqual(f.rows().find((r) => r.id === 8).cellValues, [
      "2026/10/3008:05:00",
      "BTC",
      "4 BTC",
      "2 BTC",
      "110",
      "120",
      "140",
      "5 分钟",
      "是",
      "否",
      "已完成",
    ]);
    await f.select("fills");
    assert.deepEqual(f.rows()[0].cellValues, [
      "2026/10/3008:00:01",
      "BTC",
      "做多",
      "110",
      "0.5",
      "$55",
      "$0.05",
      "$1.95",
    ]);
  } finally {
    await f.close();
  }
});

for (const [dir, side, label] of [
  ["Open Long", "B", "做多"],
  ["Open Short", "A", "做空"],
  ["Close Long", "A", "平多"],
  ["Close Short", "B", "平空"],
])
  test(`D11-249 actual fill direction column ${dir}`, async () => {
    const store = stateFixture();
    store.responses.fills = [
      fill(7, 0, { dir, side, fee: "0.1", closedPnl: "-2" }),
    ];
    const f = await twapListFixture({ store, initialTab: "fills" });
    try {
      const cells = f.rows()[0].cellValues;
      assert.equal(cells.length, 8);
      assert.equal(cells[2], label);
      assert.equal(cells[6], "$0.1");
      assert.equal(cells[7], "-$2.10");
    } finally {
      await f.close();
    }
  });

test("D11-249 actual non-USDC fill fee retains token units and cannot be subtracted from dollars", async () => {
  const store = stateFixture();
  store.responses.fills = [
    fill(7, 0, {
      dir: "Open Long",
      feeToken: "BTC",
      fee: "0.01",
      closedPnl: "2",
    }),
  ];
  const f = await twapListFixture({ store, initialTab: "fills" });
  try {
    assert.equal(f.rows()[0].cellValues[6], "0.01 BTC");
    assert.equal(f.rows()[0].cellValues[7], "$2.00");
  } finally {
    await f.close();
  }
});
