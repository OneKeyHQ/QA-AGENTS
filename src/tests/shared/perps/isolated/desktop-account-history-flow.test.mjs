import test from "node:test";
import assert from "node:assert/strict";
import { renderer } from "./source.mjs";
import {
  accountHistoryFixture,
  ledgerRecord as rec,
} from "./account-history-fixture.mjs";
// Date expectations use an explicit Desktop test timezone.
process.env.TZ = "Asia/Shanghai";
const pending = (hash, amount, time = 1800000000000, extra = {}) => ({
  accountId: "local-A",
  amount,
  status: "pending",
  toTxId: hash,
  fromTxId: "from-" + hash,
  time,
  ...extra,
});
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const plain = (x) => JSON.parse(JSON.stringify(x));
test("D20-77 actual Desktop list renders five ordered columns and row-local time, status, amount and nonconstant fee", async () => {
  const records = [
    rec("a", "deposit", "12.5", 1800000000000),
    rec("b", "withdraw", "3", 1799999999000, { fee: "0.21" }),
  ];
  const f = await accountHistoryFixture({
    ledger: { accountAddress: "0xaaa", updates: records, isLoaded: true },
  });
  try {
    assert.deepEqual(plain(f.table().columns.map((x) => x.key)), [
      "time",
      "status",
      "action",
      "amount",
      "fee",
    ]);
    assert.deepEqual(
      f.texts(f.rows()[0]).map((x) => x.text),
      ["2027/01/15", "16:00:00", "已完成", "存款", "+ $12.5", "-"],
    );
    assert.deepEqual(
      f.texts(f.rows()[1]).map((x) => x.text),
      ["2027/01/15", "15:59:59", "已完成", "提现", "- $3", "$0.21"],
    );
    assert.equal(f.texts(f.rows()[0])[4].color, "$green11");
    assert.equal(f.texts(f.rows()[1])[4].color, "$red11");
    assert.equal(f.texts(f.rows()[1])[5].color, "$red11");
  } finally {
    await f.close();
  }
});
for (const [type, extra, amount, fee, sign, color] of [
  [
    "send",
    { user: "0xAAA", destination: "0xbbb", fee: "0.03" },
    "5",
    "$0.03",
    "- ",
    "$red11",
  ],
  ["send", { user: "0xbbb", destination: "0xAAA" }, "5", "-", "+ ", "$green11"],
  [
    "internalTransfer",
    { user: "0xbbb", fee: "0.2" },
    "4.8",
    "$0.2",
    "+ ",
    "$green11",
  ],
  [
    "internalTransfer",
    { user: "0xaaa", fee: "0.2" },
    "5",
    "$0.2",
    "- ",
    "$red11",
  ],
  ["accountClassTransfer", { toPerp: false }, "5", "-", "- ", "$red11"],
  ["accountClassTransfer", { toPerp: true }, "5", "-", "+ ", "$green11"],
  [
    "vaultWithdraw",
    { netWithdrawnUsd: "4", commission: "0.2", closingCost: "0.1" },
    "4",
    "$0.3",
    "+ ",
    "$green11",
  ],
  ["liquidation", { accountValue: "7" }, "7", "-", "- ", "$red11"],
  ["newFutureType", {}, "5", "-", "", "$text"],
])
  test(`D20-77 actual ${type}/${JSON.stringify(extra)} preserves ledger type and explicit direction/fee`, async () => {
    const f = await accountHistoryFixture({
      ledger: {
        accountAddress: "0xaaa",
        updates: [rec("x", type, "5", 1800000000000, extra)],
        isLoaded: true,
      },
    });
    try {
      const text = f.texts(f.rows()[0]);
      assert.equal(text[4].text, sign + "$" + amount);
      assert.equal(text[4].color, color);
      assert.equal(text[5].text, fee);
      if (type === "newFutureType") assert.equal(text[3].text, type);
    } finally {
      await f.close();
    }
  });
test("D20-78 actual pending/completed merge sorts descending and real clearMatchedDepositOrders removes only matching local deposit", async () => {
  const f = await accountHistoryFixture({
    orders: [
      pending("confirmed", "5", 1800000001000),
      pending("still-pending", "7", 1800000000500),
    ],
    response: [
      rec("confirmed", "deposit", "5"),
      rec("older", "withdraw", "2", 1799999999000),
    ],
  });
  try {
    assert.equal(f.table().data.length, 2);
    assert.equal(f.texts(f.rows()[0])[2].text, "待处理");
    await f.force();
    assert.deepEqual(
      f.state.orders.map((x) => x.toTxId),
      ["still-pending"],
    );
    assert.deepEqual(plain(f.table().data.map((x) => x.hash)), [
      "still-pending",
      "confirmed",
      "older",
    ]);
    assert.equal(f.texts(f.rows()[1])[2].text, "已完成");
    assert.equal(
      f.table().data.filter((x) => x.hash === "confirmed").length,
      1,
    );
    assert.equal(f.state.ledger.isLoaded, true);
    assert.equal(f.calls.rest.length, 1);
  } finally {
    await f.close();
  }
});
test("D20-78 actual REST+WS merge preserves WS updates arriving during REST and incoming duplicate wins", async () => {
  const d = deferred(),
    f = await accountHistoryFixture({
      pending: d,
      response: [
        rec("same", "deposit", "5"),
        rec("rest", "withdraw", "2", 1799999999000),
      ],
    });
  try {
    const run = await f.startForce();
    await f.update({
      ledger: {
        accountAddress: "0xaaa",
        updates: [
          rec("ws", "deposit", "9", 1800000002000),
          rec("same", "deposit", "1"),
        ],
        isLoaded: false,
      },
    });
    await f.settle(d);
    await run.promise;
    assert.deepEqual(plain(f.table().data.map((x) => [x.hash, x.delta.usdc])), [
      ["ws", "9"],
      ["same", "5"],
      ["rest", "2"],
    ]);
  } finally {
    d.resolve();
    await f.close();
  }
});
test("D20-79 actual account B action clears A data before deferred request and ignores stale A completion, pagination resets", async () => {
  const a = deferred(),
    b = deferred();
  const f = await accountHistoryFixture({
    pending: a,
    response: [rec("a", "deposit", "999")],
  });
  try {
    await renderer.act(async () => f.table().setCurrentListPage(3));
    const runA = await f.startForce();
    await f.update({
      account: { accountAddress: "0xbbb", accountId: "local-B" },
      pending: b,
      response: [rec("b", "deposit", "7")],
    });
    assert.equal(f.table().currentListPage, 1);
    assert.equal(f.table().listLoading, true);
    assert.deepEqual(plain(f.table().data), []);
    await f.settle(b);
    assert.deepEqual(plain(f.table().data.map((x) => x.hash)), ["b"]);
    await f.settle(a);
    await runA.promise;
    assert.deepEqual(plain(f.table().data.map((x) => x.hash)), ["b"]);
  } finally {
    a.resolve();
    b.resolve();
    await f.close();
  }
});
test("D20-79 actual unsupported account clears previous ledger and shows empty instead of infinite loading", async () => {
  const f = await accountHistoryFixture({
    ledger: {
      accountAddress: "0xaaa",
      updates: [rec("a", "deposit", "5")],
      isLoaded: true,
    },
  });
  try {
    await f.update({ account: { accountId: "unsupported" } });
    await f.force();
    assert.equal(f.table().listLoading, false);
    assert.equal(f.table().data.length, 0);
    assert.equal(f.state.ledger.accountAddress, undefined);
  } finally {
    await f.close();
  }
});
test("D20-79 actual failed request remains diagnostic loading until force retry restores same account", async () => {
  const f = await accountHistoryFixture({ failure: true });
  try {
    await f.force();
    assert.equal(f.state.ledger.isLoaded, false);
    assert.equal(f.table().listLoading, true);
    assert.equal(f.calls.errors.length, 1);
    f.state.failure = false;
    f.state.response = [rec("restored", "deposit", "3")];
    await f.force();
    assert.equal(f.table().listLoading, false);
    assert.equal(f.table().data[0].hash, "restored");
  } finally {
    await f.close();
  }
});
test(
  "D20-79 failed account-history request must leave loading and expose distinguishable error/retry",
  {
    todo: "Pinned source catch logs only; leaves isLoaded=false and no error/retry state. Pending TF confirmation.",
  },
  async () => {
    const f = await accountHistoryFixture({ failure: true });
    try {
      await f.force();
      assert.equal(f.table().listLoading, false);
    } finally {
      await f.close();
    }
  },
);
test("D20-78 actual deposit scoping excludes other wallet/indexed owner, hidden confirmations and nonpending statuses", async () => {
  const f = await accountHistoryFixture({
    orders: [
      pending("right", "5"),
      pending("foreign", "6", 1800000000000, { accountId: "local-B" }),
      pending("indexed", "6", 1800000000000, { indexedAccountId: "foreign" }),
      pending("hidden", "7", 1800000000000, {
        keepForHistoryConfirmation: true,
      }),
      pending("failed", "7", 1800000000000, { status: "failed" }),
      pending("success", "7", 1800000000000, { status: "success" }),
    ],
  });
  try {
    assert.deepEqual(plain(f.table().data.map((x) => x.hash)), ["right"]);
    assert.deepEqual(plain(f.calls.poll), [{ accountId: "local-A" }]);
  } finally {
    await f.close();
  }
});
