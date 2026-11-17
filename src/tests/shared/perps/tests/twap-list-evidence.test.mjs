import test from "node:test";
import assert from "node:assert/strict";
import {
  twapRecordKey,
  assertTwapRecords,
  twapPageRecords,
  expectedActiveTwapIds,
} from "../twap-list-evidence.mjs";
const history = Array.from({ length: 45 }, (_, i) => ({
  twapId: i,
  time: i,
  status: { status: "finished" },
}));
test("TWAP page oracle retains exact 20/20/5 identities and rejects stale/noninteger pages", () => {
  assert.deepEqual(
    [1, 2, 3].map((p) => twapPageRecords("history", history, p).length),
    [20, 20, 5],
  );
  assert.deepEqual(
    [1, 2, 3].flatMap((p) => twapPageRecords("history", history, p)),
    history,
  );
  for (const page of [0, -1, 4, 1.5, NaN])
    assert.throws(() => twapPageRecords("history", history, page));
});
test("TWAP identities retain fill tid zero, same tid across orders, and distinct status events", () => {
  const f = (id, tid) => ({ twapId: id, fill: { tid, time: 1 } });
  assert.equal(assertTwapRecords("fills", [f(1, 0), f(2, 0)]).length, 2);
  assert.throws(() => assertTwapRecords("fills", [f(1, 0), f(1, 0)]));
  assert.notEqual(
    twapRecordKey("history", history[0]),
    twapRecordKey("history", { ...history[0], status: { status: "stopped" } }),
  );
});
test("TWAP active count oracle excludes four terminal statuses per ID, retains other orders", () => {
  const terminal = ["finished", "terminated", "stopped", "error"].map(
    (status, i) => ({ twapId: i + 1, status: { status } }),
  );
  assert.deepEqual(
    expectedActiveTwapIds(
      [1, 2, 3, 4, 5, 6],
      [...terminal, { twapId: 5, status: { status: "activated" } }],
    ),
    ["5", "6"],
  );
  assert.throws(() => expectedActiveTwapIds([1, 1], []));
});
test("TWAP fallback fill identities reject exact duplicates without collapsing distinct records", () => {
  const a = {
      twapId: 1,
      fill: { time: 1, coin: "BTC", side: "B", sz: "1", px: "100" },
    },
    b = { ...a, fill: { ...a.fill, px: "101" } };
  assert.equal(assertTwapRecords("fills", [a, b]).length, 2);
  assert.throws(() => assertTwapRecords("fills", [a, a]));
  assert.throws(() => twapRecordKey("fills", { twapId: 1, fill: {} }));
  assert.throws(() => twapRecordKey("unknown", a));
});
