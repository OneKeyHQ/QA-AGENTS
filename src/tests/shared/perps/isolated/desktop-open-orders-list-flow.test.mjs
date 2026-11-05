import test from "node:test";
import assert from "node:assert/strict";
import {
  openOrdersListFixture,
  openOrder,
} from "./open-orders-list-fixture.mjs";
import { tradesListFixture, tradeFill } from "./trades-list-fixture.mjs";
const typeCases = [
  ["Stop Market", "市价止损", "Price above 110", "B", true, "市价"],
  ["Take Profit Market", "市价止盈", "Price below 90", "B", false, "市价"],
  ["Stop Limit", "限价止损", "Price below 90", "A", true, "105"],
  ["Take Profit Limit", "限价止盈", "Price above 110", "A", false, "105"],
];
test("D08-94 actual Desktop current orders mixes four conditional types with all independent column assertions", async () => {
  const orders = typeCases.map(
    ([orderType, , triggerCondition, side, reduceOnly], i) =>
      openOrder(i + 1, {
        orderType,
        triggerCondition,
        side,
        reduceOnly,
        isTrigger: true,
      }),
  );
  const f = await openOrdersListFixture({ orders });
  try {
    assert.deepEqual(
      f.rows().map((r) => r.props.oid),
      [4, 3, 2, 1],
    );
    assert.deepEqual(
      Array.from(f.table().columns, (c) => c.key),
      [
        "time",
        "asset",
        "type",
        "size",
        "originalSize",
        "value",
        "executePrice",
        "reduceOnly",
        "triggerCondition",
        "TPSL",
        "cancel",
      ],
    );
    for (const [
      i,
      [, label, condition, side, reduce, execution],
    ] of typeCases.entries()) {
      const cells = f.cells(i + 1);
      assert.equal(cells.type, label);
      assert.equal(cells.triggerCondition, condition);
      assert.equal(cells.executePrice, execution);
      assert.equal(cells.size, "0.2");
      assert.equal(cells.originalSize, "0.2");
      assert.equal(cells.value, "$21");
      assert.equal(cells.reduceOnly, reduce ? "Yes" : "No");
      assert.equal(cells.TPSL, "--/--");
      assert.equal(
        cells.asset,
        `BTC / ${side === "B" ? (reduce ? "平空" : "做多") : reduce ? "平多" : "做空"}`,
      );
      assert.match(cells.time, /16:00:0[1-4]$/);
      assert.equal(cells.cancel, "取消");
    }
    assert.deepEqual(f.events, []);
  } finally {
    await f.close();
  }
});
test("D08-94 conditional row update replaces all fields and retains independent neighboring order", async () => {
  const f = await openOrdersListFixture({
    orders: [
      openOrder(1, {
        orderType: "Stop Market",
        isTrigger: true,
        triggerCondition: "Price below 90",
      }),
      openOrder(2),
    ],
  });
  try {
    const other = f.cells(2);
    await f.update({
      orders: [
        openOrder(1, {
          orderType: "Take Profit Limit",
          isTrigger: true,
          triggerCondition: "Price above 120",
          limitPx: "119.5",
          sz: "0.1",
          origSz: "0.3",
          reduceOnly: true,
        }),
        openOrder(2),
      ],
    });
    assert.deepEqual(f.cells(2), other);
    const c = f.cells(1);
    assert.equal(c.type, "限价止盈");
    assert.equal(c.executePrice, "119.5");
    assert.equal(c.size, "0.1");
    assert.equal(c.originalSize, "0.3");
    assert.equal(c.value, "$35.85");
    assert.equal(c.reduceOnly, "Yes");
    assert.equal(c.triggerCondition, "Price above 120");
  } finally {
    await f.close();
  }
});
for (const outcome of ["fill", "cancel"])
  test(`D08-95/120 actual conditional-to-limit display and current/history removal on controlled ${outcome} atom arrival`, async () => {
    const current = await openOrdersListFixture({
      orders: [
        openOrder(1, {
          orderType: "Stop Market",
          isTrigger: true,
          triggerCondition: "Price below 90",
        }),
        openOrder(2, {
          orderType: "Take Profit Limit",
          isTrigger: true,
          triggerCondition: "Price above 110",
        }),
      ],
    });
    const history = await tradesListFixture();
    try {
      assert.equal(history.rows().length, 0);
      await current.update({
        orders: [
          openOrder(2, {
            orderType: "Limit",
            triggerPx: "0",
            triggerCondition: "N/A",
          }),
        ],
      });
      await history.update({
        history: {
          accountAddress: "0xaaa",
          fills: [tradeFill(101, { oid: 1, sz: "0.2" })],
          isLoaded: true,
        },
      });
      assert.deepEqual(
        current.rows().map((r) => r.props.oid),
        [2],
      );
      assert.equal(current.cells(2).type, "限价");
      assert.equal(current.cells(2).triggerCondition, "N/A");
      assert.equal(current.cells(2).executePrice, "105");
      assert.deepEqual(
        history.rows().map((r) => r.props.tid),
        [101],
      );
      const fills =
        outcome === "fill"
          ? [tradeFill(101, { oid: 1 }), tradeFill(102, { oid: 2 })]
          : [tradeFill(101, { oid: 1 })];
      await current.update({ orders: [] });
      await history.update({
        history: { accountAddress: "0xaaa", fills, isLoaded: true },
      });
      assert.equal(current.rows().length, 0);
      assert.deepEqual(
        history
          .rows()
          .map((r) => r.props.tid)
          .sort(),
        outcome === "fill" ? [101, 102] : [101],
      );
      assert.deepEqual(current.events, []);
      // Transport/matching and tab availability are outside this controlled
      // arrival fixture; no real trigger/fill/cancel result is claimed.
    } finally {
      await current.close();
      await history.close();
    }
  });
test("D08-94 actual account scoping rejects old account data, accepts current mixed spot/perp identities", async () => {
  const f = await openOrdersListFixture({
    orders: [openOrder(1)],
    spotOrders: [openOrder(2, { coin: "@1" })],
  });
  try {
    assert.deepEqual(
      f.rows().map((r) => r.props.oid),
      [2, 1],
    );
    assert.equal(f.cells(2).asset, "BTC/USDC / 购买");
    await f.switchAsset(2);
    assert.deepEqual(f.events[0], ["switch", { mode: "spot", coin: "@1" }]);
    await f.switchAsset(1);
    assert.deepEqual(f.events[1], ["switch", { mode: "perp", coin: "BTC" }]);
    await f.update({ account: "0xbbb", scopedAccount: "0xbbb" });
    assert.equal(f.rows().length, 0);
    assert.equal(f.table().listLoading, true);
    await f.update({
      dataAccount: "0xbbb",
      spotAccount: "0xbbb",
      orders: [openOrder(3, { coin: "ETH" })],
      spotOrders: [],
    });
    assert.deepEqual(
      f.rows().map((r) => r.props.oid),
      [3],
    );
    assert.equal(f.table().listLoading, false);
  } finally {
    await f.close();
  }
});
test("D08-94 actual Desktop always shows mixed markets and clamps last page when data shrinks", async () => {
  const orders = Array.from({ length: 41 }, (_, i) =>
    openOrder(i + 1, { coin: i % 2 ? "ETH" : "BTC" }),
  );
  const f = await openOrdersListFixture({ orders, filterCurrent: true });
  try {
    assert.equal(f.table().data.length, 41);
    assert.equal(f.rows().length, 40);
    assert.equal(f.table().pageSize, 40);
    await f.page(2);
    assert.deepEqual(
      f.rows().map((r) => r.props.oid),
      [1],
    );
    await f.update({ orders: [openOrder(42, { coin: "ETH" })] });
    assert.equal(f.table().currentListPage, 1);
    assert.deepEqual(
      f.rows().map((r) => r.props.oid),
      [42],
    );
  } finally {
    await f.close();
  }
});
