import test from "node:test";
import assert from "node:assert/strict";
import {
  chaseActionFixture as mount,
  chaseOrder,
  chaseAccount,
  otherChaseAccount,
} from "./chase-action-fixture.mjs";
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
for (const [patch, want] of [
  [{}, true],
  [{ sz: ".05" }, true],
  [{ tif: "Ioc" }, false],
  [{ tif: "Alo" }, false],
  [{ isTrigger: true }, false],
  [{ isPositionTpsl: true }, false],
  [{ coin: "@1" }, false],
  [{ orderType: "Stop Limit" }, false],
  [{ sz: "0" }, false],
])
  test(`D13-61/62 actual full Desktop list renders chase before cancel only for qualified ${JSON.stringify(patch)}`, async () => {
    const f = await openOrdersListFixture({
      orders: [openOrder(1, { tif: "Gtc", ...patch })],
    });
    try {
      assert.equal(f.rows().length, 1);
      assert.equal(f.cells(1).cancel, want ? "追单 / 取消" : "取消");
      assert.equal(f.events.length, 0);
    } finally {
      await f.close();
    }
  });
for (const [side, want] of [
  ["B", "81001"],
  ["A", "81000"],
])
  test(`D13-71 frozen target from actual current ${side === "B" ? "ask" : "bid"} resolver is exactly local amend target`, async () => {
    const f = await mount();
    try {
      await f.press({ ...chaseOrder, side });
      assert.equal(f.events.dialogs.length, 1);
      assert.equal(f.events.dialogs[0].targetPrice, want);
      assert.equal(f.events.orders.length, 0);
      assert.deepEqual(f.busy(), []);
      f.state.book = { levels: [[{ px: "82000" }], [{ px: "82001" }]] };
      await f.confirm();
      assert.deepEqual(f.events.orders, [
        {
          coin: "BTC",
          oid: 1,
          newPrice: want,
          expectedAccountAddress: chaseAccount,
        },
      ]);
      assert.equal(
        f.events.books.length,
        1,
        "Prepared price must not be replaced by later book",
      );
      assert.deepEqual(f.busy(), []);
    } finally {
      await f.close();
    }
  });
for (const book of [
  null,
  { levels: [[], []] },
  { levels: [[{ px: "0" }], [{ px: "0" }]] },
  { levels: [[{ px: "81000" }], [{ px: "NaN" }]] },
])
  test(`D13-93 actual missing/invalid best price gives exact toast and task releases ${JSON.stringify(book)}`, async () => {
    const f = await mount({ book });
    try {
      await f.press();
      assert.deepEqual(f.events.errors, [
        { title: "当前最优价暂不可用，请重试。" },
      ]);
      assert.equal(f.events.dialogs.length, 0);
      assert.equal(f.events.orders.length, 0);
      assert.deepEqual(f.busy(), []);
      f.state.book = { levels: [[{ px: "81000" }], [{ px: "81001" }]] };
      await f.press();
      assert.equal(f.events.dialogs.length, 1);
      assert.deepEqual(f.busy(), []);
    } finally {
      await f.close();
    }
  });
for (const stage of ["loading-book", "open-dialog", "enabling"])
  test(`D13-94 actual account switch at ${stage} refuses local amendment and releases task`, async () => {
    const d = deferred();
    const f = await mount(
      stage === "loading-book"
        ? { bookRequest: () => d.promise }
        : stage === "enabling"
          ? { ensure: () => d.promise }
          : {},
    );
    try {
      if (stage === "loading-book") {
        const { pending } = await f.beginPress();
        assert.deepEqual(f.busy(), [1]);
        f.activeRef.current = otherChaseAccount;
        await f.finish(pending, () =>
          d.resolve({ levels: [[{ px: "81000" }], [{ px: "81001" }]] }),
        );
        assert.equal(f.events.dialogs.length, 0);
      } else {
        await f.press();
        if (stage === "open-dialog") {
          f.activeRef.current = otherChaseAccount;
          await f.confirm();
        } else {
          const { pending } = await f.beginConfirm();
          f.scopedRef.current = otherChaseAccount;
          await f.finish(pending, () => d.resolve());
        }
      }
      assert.equal(f.events.orders.length, 0);
      assert.deepEqual(f.events.errors, [
        { title: "当前交易账户已变化，请重试。" },
      ]);
      assert.deepEqual(f.busy(), []);
    } finally {
      await f.close();
    }
  });
test("D13-93/94 actual per-oid lock blocks repeated press while book pending, finally permits retry", async () => {
  const d = deferred(),
    f = await mount({ bookRequest: () => d.promise });
  try {
    const { pending } = await f.beginPress();
    await f.press();
    assert.equal(f.events.books.length, 1);
    await f.finish(pending, () => d.resolve({ levels: [[], []] }));
    assert.equal(f.events.orders.length, 0);
    assert.deepEqual(f.busy(), []);
    f.state.bookRequest = undefined;
    await f.press();
    assert.equal(f.events.dialogs.length, 1);
  } finally {
    await f.close();
  }
});
for (const locale of ["zh_CN", "en_US"])
  test(`D13-97 actual resolver and account-error formal translations ${locale}`, async () => {
    const f = await mount({ locale, book: { levels: [[], []] } });
    try {
      await f.press();
      assert.deepEqual(f.events.errors, [
        {
          title:
            locale === "zh_CN"
              ? "当前最优价暂不可用，请重试。"
              : "The current best price is unavailable. Please try again.",
        },
      ]);
      assert.ok(
        !f.events.errors.some((v) =>
          /__(?:msg|action)|current_best/.test(v.title),
        ),
      );
    } finally {
      await f.close();
    }
  });

test("D13-63 actual trading-enable rejection blocks prepared amendment, clears lock and permits next local attempt", async () => {
  const f = await mount({
    ensure: async () => {
      throw Error("测试账户未启用交易");
    },
  });
  try {
    await f.press();
    await f.confirm();
    assert.equal(f.events.enabled, 1);
    assert.equal(f.events.orders.length, 0);
    assert.deepEqual(f.events.errors, [{ title: "测试账户未启用交易" }]);
    assert.deepEqual(f.busy(), []);
    f.state.ensure = undefined;
    await f.confirm();
    assert.equal(f.events.orders.length, 1);
  } finally {
    await f.close();
  }
});
