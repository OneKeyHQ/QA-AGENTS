import test from "node:test";
import assert from "node:assert/strict";
import { renderer } from "./source.mjs";
import { chartLineActionsFixture } from "./chart-line-actions-fixture.mjs";
import { deferred } from "./funds-quote-fixture.mjs";
const plain = (value) => JSON.parse(JSON.stringify(value));
const pendingIds = (f) => Object.keys(f.value.pending);
for (const patch of [
  { enabled: false },
  { account: { accountId: "A" } },
  { loading: true },
  { selected: { ready: false, account: { id: "A" } } },
  {
    selected: {
      ready: true,
      account: { id: "B" },
      indexedAccount: { id: "J" },
    },
  },
])
  test(`Chart line actual unresolved account gate ${JSON.stringify(patch)} prevents ensure and mutation`, async () => {
    const f = await chartLineActionsFixture(patch);
    try {
      assert.equal(f.value.canInteract, false);
      await assert.rejects(f.run(), /order changed/u);
      assert.equal(f.calls.ensure, 0);
      assert.equal(f.calls.amend.length + f.calls.cancel.length, 0);
    } finally {
      await f.close();
    }
  });
for (const [name, patch] of [
  ["removed", { lines: [] }],
  [
    "changed price",
    {
      lines: [
        { id: "order:1", price: 99, editable: true, meta: { orderId: 1 } },
      ],
    },
  ],
  [
    "not editable",
    {
      lines: [
        { id: "order:1", price: 100, editable: false, meta: { orderId: 1 } },
      ],
    },
  ],
  ["not an order", { lines: [{ id: "order:1", price: 100, editable: true }] }],
])
  test(`Chart line actual stale ${name} rejects captured callback before mutation`, async () => {
    const f = await chartLineActionsFixture();
    try {
      const action = f.action(),
        callback = f.value.onReferenceLineAction;
      await f.update(patch);
      await assert.rejects(async () => {
        await renderer.act(async () => callback(action));
      }, /order changed/u);
      assert.equal(f.calls.ensure, 0);
      assert.equal(f.calls.amend.length, 0);
    } finally {
      await f.close();
    }
  });
for (const price of [0, -1, NaN, Infinity, 100, 100.00000001])
  test(`Chart line actual invalid/no-change formatted price ${price} is request-free`, async () => {
    const f = await chartLineActionsFixture();
    try {
      await f.run(f.action({ price }));
      assert.equal(f.calls.ensure, 0);
      assert.equal(f.calls.amend.length, 0);
      assert.deepEqual(pendingIds(f), []);
    } finally {
      await f.close();
    }
  });
for (const oid of [-1, 1.2, "bad", Number.MAX_SAFE_INTEGER + 1])
  test(`Chart line actual invalid exchange id ${oid} never requests ensure or mutation`, async () => {
    const f = await chartLineActionsFixture({
      lines: [
        { id: "order:1", price: 100, editable: true, meta: { orderId: oid } },
      ],
    });
    try {
      await f.run();
      assert.equal(f.calls.ensure, 0);
      assert.equal(f.calls.amend.length, 0);
    } finally {
      await f.close();
    }
  });
for (const type of ["cancel", "priceChange"])
  test(`Chart line actual ${type} pending deduplicates clicks before enable completes and sends exact scoped local request`, async () => {
    const gate = deferred(),
      f = await chartLineActionsFixture({ ensure: () => gate.promise });
    try {
      const act = f.action({ type }),
        { request } = await f.start(act);
      assert.equal(pendingIds(f).length, 1);
      await f.run(act);
      assert.equal(f.calls.ensure, 1);
      await f.settle(gate);
      await request;
      if (type === "cancel") {
        assert.deepEqual(plain(f.calls.cancel), [
          { oid: 1, coin: "BTC", expectedAccountAddress: "0xaaa" },
        ]);
        assert.equal(f.calls.amend.length, 0);
        assert.deepEqual(pendingIds(f), []);
      } else {
        assert.deepEqual(plain(f.calls.amend), [
          {
            oid: 1,
            coin: "BTC",
            newPrice: "101.2",
            expectedAccountAddress: "0xaaa",
          },
        ]);
        assert.equal(f.calls.cancel.length, 0);
        assert.equal(pendingIds(f).length, 1);
        await f.run(act);
        assert.equal(f.calls.ensure, 1);
      }
    } finally {
      gate.resolve();
      await f.close();
    }
  });
for (const patch of [
  { symbol: "ETH" },
  {
    account: { accountId: "B", indexedAccountId: "J", accountAddress: "0xbbb" },
  },
  { loading: true },
  { lines: [] },
  {
    lines: [{ id: "order:1", price: 99, editable: true, meta: { orderId: 1 } }],
  },
])
  test(`Chart line actual recheck after enable blocks changed context ${JSON.stringify(patch)}`, async () => {
    const gate = deferred(),
      f = await chartLineActionsFixture({ ensure: () => gate.promise });
    try {
      const { request } = await f.start();
      const rejected = assert.rejects(request, /order changed/u);
      await f.update(patch);
      await f.settle(gate);
      await rejected;
      assert.equal(f.calls.amend.length + f.calls.cancel.length, 0);
      assert.deepEqual(pendingIds(f), []);
    } finally {
      gate.resolve();
      await f.close();
    }
  });
test("Chart line actual pending amendment retained until matching order stream, unrelated line updates do not erase it", async () => {
  const f = await chartLineActionsFixture();
  try {
    await f.run();
    const id = pendingIds(f)[0];
    assert.equal(f.value.pending[id].price, 101.2);
    await f.update({
      lines: [
        ...f.state.lines,
        { id: "order:2", price: 90, meta: { orderId: 2 } },
      ],
    });
    assert.equal(pendingIds(f).length, 1);
    await f.update({ lines: [{ ...f.state.lines[0], price: 101.2 }] });
    assert.deepEqual(pendingIds(f), []);
    assert.equal(f.clock.countTimers(), 0);
  } finally {
    await f.close();
  }
});
test("Chart line actual pending amendment sync timeout exactly 10 seconds permits new action", async () => {
  const f = await chartLineActionsFixture();
  try {
    await f.run();
    await f.tick(9999);
    assert.equal(pendingIds(f).length, 1);
    await f.tick(1);
    assert.deepEqual(pendingIds(f), []);
    await f.run();
    assert.equal(f.calls.amend.length, 2);
  } finally {
    await f.close();
  }
});
for (const stage of ["ensure", "amend", "cancel"])
  test(`Chart line actual ${stage} failure releases pending and allows explicit retry without automatic resubmit`, async () => {
    const f = await chartLineActionsFixture({
      [stage]: async () => {
        throw Error("local rejection");
      },
    });
    try {
      const act = f.action({
        type: stage === "cancel" ? "cancel" : "priceChange",
      });
      await assert.rejects(f.run(act), /local rejection/u);
      assert.deepEqual(pendingIds(f), []);
      const before = f.calls.ensure;
      await f.tick(30000);
      assert.equal(f.calls.ensure, before);
      f.state[stage] = async () => {};
      await f.run(act);
      assert.equal(f.calls.ensure, before + 1);
    } finally {
      await f.close();
    }
  });
test("Chart line actual spot price precision and canonical order coin override display symbol", async () => {
  const f = await chartLineActionsFixture({
    symbol: "UBTC/USDC",
    isSpot: true,
    lines: [
      {
        id: "order:1",
        price: 100,
        editable: true,
        meta: { orderId: 1, coin: "@1" },
      },
    ],
  });
  try {
    await f.run(f.action({ price: 0.012345678 }));
    assert.deepEqual(plain(f.calls.amend), [
      {
        oid: 1,
        coin: "@1",
        newPrice: "0.012",
        expectedAccountAddress: "0xaaa",
      },
    ]);
  } finally {
    await f.close();
  }
});
test("Chart line actual unmount during enable rejects stale mutation and clears timers", async () => {
  const gate = deferred(),
    f = await chartLineActionsFixture({ ensure: () => gate.promise });
  const { request } = await f.start();
  const rejected = assert.rejects(request, /order changed/u);
  await f.close();
  await f.settle(gate);
  await rejected;
  assert.equal(f.calls.amend.length, 0);
  assert.equal(f.clock.countTimers(), 0);
});
test("Chart line actual unrelated orders can prepare independently; completing old A cannot remove pending B", async () => {
  const first = deferred(),
    second = deferred(),
    f = await chartLineActionsFixture({
      amend: (args) => (args.oid === 1 ? first.promise : second.promise),
      lines: [
        { id: "order:1", price: 100, editable: true, meta: { orderId: 1 } },
        { id: "order:2", price: 90, editable: true, meta: { orderId: 2 } },
      ],
    });
  try {
    const a = await f.start();
    const actB = {
      id: f.value.getLineId(f.state.lines[1]),
      type: "priceChange",
      originalPrice: 90,
      price: 91,
    };
    const b = await f.start(actB);
    assert.equal(pendingIds(f).length, 2);
    await f.settle(first);
    await a.request;
    assert.equal(pendingIds(f).length, 2);
    await f.settle(second);
    await b.request;
    assert.equal(pendingIds(f).length, 2);
    assert.equal(f.calls.amend.length, 2);
  } finally {
    first.resolve();
    second.resolve();
    await f.close();
  }
});
