import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFinancialState } from "../order-observation.mjs";
const account = "0x" + "1".repeat(40);
const fixture = () => [
  {
    account,
    kind: "orders",
    data: [{ oid: 1, coin: "BTC", sz: "0.1", limitPx: "100", side: "B" }],
  },
  { account, kind: "twap", data: [] },
  {
    account,
    kind: "positions",
    data: [
      {
        position: {
          coin: "BTC",
          szi: "0.2",
          entryPx: "99",
          unrealizedPnl: "1",
        },
      },
    ],
  },
];
test("资金状态观察包含仓位、委托内容与账户，行情浮动不触发变更", () => {
  const before = normalizeFinancialState(fixture());
  const same = fixture();
  same[2].data[0].position.unrealizedPnl = "100";
  assert.deepEqual(normalizeFinancialState(same), before);
  for (const change of [
    (s) => (s[0].data[0].limitPx = "101"),
    (s) => (s[0].data = []),
    (s) => (s[2].data[0].position.szi = "0.3"),
    (s) => (s[2].data[0].position.entryPx = "98"),
    (s) => s.forEach((r) => (r.account = "0x" + "2".repeat(40))),
  ]) {
    const after = fixture();
    change(after);
    assert.notDeepEqual(normalizeFinancialState(after), before);
  }
});
test("缺少仓位/委托快照、错误账户或冲突快照不能当作空账户", () => {
  for (const bad of [
    [],
    fixture().slice(0, 2),
    fixture().map((r) => ({ ...r, account: "" })),
    [...fixture(), { ...fixture()[2], data: [] }],
  ])
    assert.throws(() => normalizeFinancialState(bad));
  assert.deepEqual(
    normalizeFinancialState([...fixture(), ...fixture()]),
    normalizeFinancialState(fixture()),
  );
});

test("合约与现货委托按独立来源合并；同一来源冲突仍拒绝", () => {
  const states = fixture();
  states[0].scope = "perp";
  states.push({ account, kind: "orders", scope: "spot", data: [] });
  const before = normalizeFinancialState(states);
  assert.equal(before.orders.length, 1);
  assert.equal(before.orders[0].marketScope, "perp");
  const withSpot = structuredClone(states);
  withSpot
    .at(-1)
    .data.push({ oid: 2, coin: "@1", side: "B", sz: "1", limitPx: "10" });
  const after = normalizeFinancialState(withSpot);
  assert.equal(after.orders.length, 2);
  assert.equal(after.orders.find((o) => o.id === "2").marketScope, "spot");
  assert.notDeepEqual(after, before);
  assert.throws(() =>
    normalizeFinancialState([
      ...states,
      { account, kind: "orders", scope: "perp", data: [] },
    ]),
  );
  assert.throws(() =>
    normalizeFinancialState([
      ...states,
      {
        account: "0x" + "2".repeat(40),
        kind: "orders",
        scope: "spot",
        data: [],
      },
    ]),
  );
});
