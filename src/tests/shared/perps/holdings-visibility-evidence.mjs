// Independent threshold oracle over unfiltered holding quantities and raw marks.
// Never imports the product filter or uses its rounded dollar presentation.
import assert from "node:assert/strict";
const decimal = (value) => {
  const text = String(value);
  assert.match(
    text,
    /^\d+(?:\.\d+)?$/u,
    "Nonnegative plain raw decimal required",
  );
  const [whole, fraction = ""] = text.split(".");
  return { n: BigInt(whole + fraction), scale: 10n ** BigInt(fraction.length) };
};
export function expectedVisibleHoldings(rows, hide) {
  const seen = new Set();
  return rows
    .filter((row) => {
      assert.ok(row.rawCoin);
      assert.ok(!seen.has(row.rawCoin), "No duplicate raw holding identities");
      seen.add(row.rawCoin);
      if (!hide || row.rawCoin === "USDC" || row.hasPriceSource === false)
        return true;
      const total = decimal(row.total),
        stable = ["USDT", "USDB", "USDH"].includes(row.rawCoin),
        price = decimal(stable ? "1" : row.markPrice);
      return total.n * price.n >= 5n * total.scale * price.scale;
    })
    .map((row) => row.rawCoin);
}
export function projectHoldingsTable(start) {
  let root = start;
  while (root.return) root = root.return;
  const stack = [root],
    seen = new Set(),
    tables = [];
  for (let count = 0; stack.length && count < 100000; count++) {
    const f = stack.pop(),
      v = f.memoizedProps;
    if (
      v?.listViewDebugRenderTrackerProps?.name === "SpotBalanceList" &&
      Array.isArray(v.data) &&
      Array.isArray(v.columns) &&
      !seen.has(v)
    ) {
      seen.add(v);
      tables.push({
        data: v.data,
        page: v.currentListPage ?? 1,
        pageSize: v.pageSize ?? 20,
        loading: Boolean(v.listLoading),
        columns: v.columns.map((c) => ({ key: c.key, title: c.title })),
      });
    }
    if (f.sibling) stack.push(f.sibling);
    if (f.child) stack.push(f.child);
  }
  if (stack.length) throw Error("Holding tree scan limit reached");
  return tables;
}
