import test from "node:test";
import assert from "node:assert/strict";
import {
  expectedVisibleHoldings,
  projectHoldingsTable,
} from "../holdings-visibility-evidence.mjs";
const row = (rawCoin, total, markPrice, hasPriceSource = true) => ({
  rawCoin,
  total,
  markPrice,
  hasPriceSource,
});
test("Holdings independent exact raw threshold avoids rounded $5 false inclusion", () => {
  const rows = [
    row("USDC", "0.1"),
    row("USDT", "4.99"),
    row("USDB", "5"),
    row("BTC", "0.000049999999999999999999", "100000"),
    row("ETH", "0.0025", "2000"),
    row("UNKNOWN", "1", undefined, false),
  ];
  assert.deepEqual(expectedVisibleHoldings(rows, true), [
    "USDC",
    "USDB",
    "ETH",
    "UNKNOWN",
  ]);
  assert.deepEqual(
    expectedVisibleHoldings(rows, false),
    rows.map((x) => x.rawCoin),
  );
});
for (const patch of [
  { total: "NaN" },
  { total: "-1" },
  { markPrice: undefined },
  { markPrice: "1e3" },
])
  test(`Holdings malformed threshold input fails closed ${JSON.stringify(patch)}`, () =>
    assert.throws(() =>
      expectedVisibleHoldings([{ ...row("BTC", "1", "1"), ...patch }], true),
    ));
test("Holdings duplicate canonical row identity is rejected", () =>
  assert.throws(
    () =>
      expectedVisibleHoldings(
        [row("BTC", "1", "1"), row("BTC", "2", "2")],
        false,
      ),
    /duplicate/u,
  ));
test("Holdings projection selects actual named table and never invokes setters or reads unrelated table", () => {
  let called = false;
  const props = {
    listViewDebugRenderTrackerProps: { name: "SpotBalanceList" },
    data: [row("BTC", "1", "1")],
    columns: [{ key: "coin", title: "资产" }],
    currentListPage: 2,
    setCurrentListPage: () => {
      called = true;
    },
  };
  const root = {
    memoizedProps: {
      listViewDebugRenderTrackerProps: { name: "PerpPositionsList" },
      data: [],
      columns: [],
    },
    child: { memoizedProps: props },
  };
  root.child.return = root;
  assert.deepEqual(projectHoldingsTable(root.child), [
    {
      data: props.data,
      page: 2,
      pageSize: 20,
      loading: false,
      columns: [{ key: "coin", title: "资产" }],
    },
  ]);
  assert.equal(called, false);
});
