// Actual list -> actual row onPress -> actual task hook -> real resolver and
// callbacks, in one mounted tree. All RPC/authorization/amend outputs are local.
import test from "node:test";
import assert from "node:assert/strict";
import {
  openOrdersListFixture,
  openOrder,
} from "./open-orders-list-fixture.mjs";
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((r, j) => {
    resolve = r;
    reject = j;
  });
  return { promise, resolve, reject };
};
const order = (oid = 1) => openOrder(oid, { tif: "Gtc", limitPx: "70000" });
function assertButton(f, oid, busy) {
  const button = f.chaseButton(oid);
  assert.ok(button, "Actual order-specific chase entry remains rendered");
  assert.equal(button.props.cursor, busy ? "default" : "pointer");
  assert.equal(typeof button.props.onPress, busy ? "undefined" : "function");
  assert.equal(
    button.findByType("SizableText").props.color,
    busy ? "$textDisabled" : "$bgAccent",
  );
}
for (const failure of ["null", "empty", "zero", "NaN", "rejected"]) {
  test(`D13-93 actual full list task disables row and restores exact clickable entry after ${failure} best-price failure`, async () => {
    const pending = deferred();
    const f = await openOrdersListFixture(
      { orders: [order()], bookRequest: () => pending.promise },
      { chase: true },
    );
    try {
      assertButton(f, 1, false);
      const stalePress = f.chaseButton(1).props.onPress;
      await f.tick(() => {
        stalePress();
      });
      assertButton(f, 1, true);
      assert.equal(f.activity.books.length, 1);
      // A callback queued before rerender must also obey the synchronous task lock.
      await f.tick(() => {
        stalePress();
      });
      assert.equal(f.activity.books.length, 1);
      await f.tick(() => {
        if (failure === "rejected")
          pending.reject(new Error("book transport offline"));
        else
          pending.resolve(
            failure === "null"
              ? null
              : failure === "empty"
                ? { levels: [[], []] }
                : {
                    levels: [
                      [{ px: "81000" }],
                      [{ px: failure === "zero" ? "0" : "NaN" }],
                    ],
                  },
          );
      });
      assert.deepEqual(f.activity.errors, [
        {
          title:
            failure === "rejected"
              ? "book transport offline"
              : "当前最优价暂不可用，请重试。",
        },
      ]);
      assert.equal(f.activity.dialogs.length, 0);
      assert.equal(f.activity.amends.length, 0);
      assertButton(f, 1, false);
      await f.update({ bookRequest: undefined });
      await f.tick(() => {
        f.chaseButton(1).props.onPress();
      });
      assert.equal(f.activity.books.length, 2);
      assert.equal(f.activity.dialogs.length, 1);
      assert.equal(f.activity.dialogs[0].targetPrice, "81001");
      assertButton(f, 1, false);
      assert.equal(f.activity.amends.length, 0, "Retry opens preview only");
    } finally {
      await f.close();
    }
  });
}
for (const failure of [false, true]) {
  test(`D13-81 actual full list confirm disables only target row during local amendment, releases after ${failure ? "failure" : "success"}`, async () => {
    const pending = deferred();
    const f = await openOrdersListFixture(
      { orders: [order(1), order(2)], amend: () => pending.promise },
      { chase: true },
    );
    try {
      await f.tick(() => {
        f.chaseButton(1).props.onPress();
      });
      assert.equal(f.activity.dialogs.length, 1);
      await f.tick(() => {
        void f.activity.dialogs[0].onConfirm();
      });
      assertButton(f, 1, true);
      assertButton(f, 2, false);
      assert.deepEqual(f.activity.amends, [
        {
          coin: "BTC",
          oid: 1,
          newPrice: "81001",
          expectedAccountAddress: "0xaaa",
        },
      ]);
      await f.tick(() => {
        void f.activity.dialogs[0].onConfirm();
      });
      assert.equal(f.activity.amends.length, 1);
      await f.tick(() => {
        f.chaseButton(2).props.onPress();
      });
      assert.equal(
        f.activity.dialogs.length,
        2,
        "Other order remains independently usable",
      );
      assertButton(f, 1, true);
      assertButton(f, 2, false);
      await f.tick(() => {
        if (failure) pending.reject(new Error("local amendment rejected"));
        else pending.resolve();
      });
      assertButton(f, 1, false);
      assertButton(f, 2, false);
      assert.equal(f.activity.amends.length, 1);
      assert.equal(f.activity.enabled, 1);
      // Local response doesn't simulate a matching engine or claim a row price update.
      assert.equal(f.state.orders[0].limitPx, "70000");
    } finally {
      await f.close();
    }
  });
}
test("D13-94 full list account change while book pending rejects old row task and never amends new account", async () => {
  const pending = deferred();
  const f = await openOrdersListFixture(
    { orders: [order()], bookRequest: () => pending.promise },
    { chase: true },
  );
  try {
    await f.tick(() => {
      f.chaseButton(1).props.onPress();
    });
    assertButton(f, 1, true);
    await f.update({
      account: "0xbbb",
      scopedAccount: "0xbbb",
      dataAccount: "0xbbb",
      orders: [order()],
    });
    await f.tick(() =>
      pending.resolve({ levels: [[{ px: "81000" }], [{ px: "81001" }]] }),
    );
    assert.deepEqual(f.activity.errors, [
      { title: "当前交易账户已变化，请重试。" },
    ]);
    assert.equal(f.activity.dialogs.length, 0);
    assert.equal(f.activity.amends.length, 0);
    assertButton(f, 1, false);
  } finally {
    await f.close();
  }
});
