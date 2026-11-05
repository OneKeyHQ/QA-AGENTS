// Independent read-only identities and paging expectations for Desktop TWAP.
import assert from "node:assert/strict";
export const twapSchemas = {
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
export function twapRecordKey(tab, record) {
  assert.ok(
    record && Number.isFinite(record.twapId),
    "Finite TWAP order ID required",
  );
  if (tab === "active") return String(record.twapId);
  if (tab === "history") {
    assert.ok(
      Number.isFinite(record.time) && typeof record.status?.status === "string",
      "History event identity required",
    );
    return JSON.stringify([record.twapId, record.time, record.status.status]);
  }
  assert.equal(tab, "fills", "Known TWAP subtab required");
  const f = record.fill;
  assert.ok(f && Number.isFinite(f.time), "Fill timestamp required");
  return f.tid !== undefined && f.tid !== null
    ? JSON.stringify([record.twapId, "tid", f.tid])
    : JSON.stringify([
        record.twapId,
        "fallback",
        f.time,
        f.coin,
        f.side,
        f.sz,
        f.px,
      ]);
}
export function assertTwapRecords(tab, records) {
  const keys = records.map((r) => twapRecordKey(tab, r));
  assert.equal(
    new Set(keys).size,
    keys.length,
    `Duplicate logical ${tab} rows`,
  );
  return keys;
}
export function twapPageRecords(tab, data, page = 1, pageSize = 20) {
  assertTwapRecords(tab, data);
  assert.ok(Number.isInteger(page) && page >= 1, "Positive integer page");
  assert.ok(
    Number.isInteger(pageSize) && pageSize > 0,
    "Positive integer page size",
  );
  assert.ok(
    page <= Math.max(1, Math.ceil(data.length / pageSize)),
    "Page must exist in current data",
  );
  return tab === "active"
    ? data
    : data.slice((page - 1) * pageSize, page * pageSize);
}
export function expectedActiveTwapIds(rawIds, history) {
  assert.equal(
    new Set(rawIds.map(String)).size,
    rawIds.length,
    "Unique raw active IDs",
  );
  const terminal = new Set(
    history
      .filter((r) =>
        ["finished", "terminated", "stopped", "error"].includes(
          r.status?.status,
        ),
      )
      .map((r) => String(r.twapId)),
  );
  return rawIds
    .map(String)
    .filter((id) => !terminal.has(id))
    .sort();
}
