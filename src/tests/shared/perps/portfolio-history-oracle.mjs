import assert from "node:assert/strict";
// Read only raw promise results in the committed content owner. Computed chart
// props are deliberately not accepted as the input to this independent oracle.
export function portfolioHistoryProjection(fiber) {
  const histories = [];
  for (let f = fiber; f; f = f.return) {
    const name = f.type?.displayName ?? f.type?.name ?? f.type?.type?.name;
    if (name !== "PerpPortfolioContentComponent") continue;
    for (
      let hook = f.memoizedState, n = 0;
      hook && n < 1000;
      hook = hook.next, n++
    ) {
      const seen = new Set();
      const visit = (v, depth) => {
        if (!v || typeof v !== "object" || seen.has(v) || depth > 5) return;
        seen.add(v);
        if (
          Array.isArray(v) &&
          v.length &&
          v.every(
            (e) =>
              Array.isArray(e) &&
              e.length === 2 &&
              typeof e[0] === "string" &&
              Array.isArray(e[1]?.accountValueHistory) &&
              Array.isArray(e[1]?.pnlHistory),
          )
        ) {
          histories.push(v);
          return;
        }
        for (const key of ["result", "current", "value", "v", "0", "1"])
          if (Object.hasOwn(v, key)) visit(v[key], depth + 1);
      };
      visit(hook.memoizedState, 0);
    }
  }
  const unique = [
    ...new Map(histories.map((v) => [JSON.stringify(v), v])).values(),
  ];
  if (unique.length !== 1)
    throw Error(
      `Expected one raw portfolio history result, got ${unique.length}`,
    );
  return unique[0];
}
export function expectedPortfolioHistory(
  raw,
  period,
  kind = "accountValue",
  scope = "all",
) {
  assert.ok(
    ["day", "week", "month", "allTime"].includes(period),
    "Known history period",
  );
  assert.ok(
    ["accountValue", "pnl"].includes(kind),
    "History kind must not be funding",
  );
  assert.ok(["all", "perps", "spot"].includes(scope), "Known asset scope");
  assert.ok(Array.isArray(raw), "Raw history array required");
  const key =
    scope === "perps" && kind === "pnl"
      ? `perp${period[0].toUpperCase()}${period.slice(1)}`
      : period;
  const matches = raw.filter(([k]) => k === key);
  assert.equal(matches.length, 1, `Unique raw period ${key}`);
  const convert = (history) => {
    assert.ok(Array.isArray(history), "Raw time series required");
    return history.map((pair) => {
      assert.ok(Array.isArray(pair) && pair.length === 2);
      const [milliseconds, value] = pair;
      assert.ok(Number.isFinite(milliseconds) && milliseconds >= 0);
      assert.match(
        String(value),
        /^-?\d+(?:\.\d+)?$/u,
        "Exact decimal, no prefix parsing or nonfinite data",
      );
      const n = Number(value);
      assert.ok(Number.isFinite(n));
      return [Math.floor(milliseconds / 1000), n];
    });
  };
  const values = convert(
    matches[0][1][
      kind === "accountValue" ? "accountValueHistory" : "pnlHistory"
    ],
  );
  if (kind === "pnl" && scope === "spot") {
    const perps = expectedPortfolioHistory(raw, period, "pnl", "perps");
    const byTime = new Map(perps);
    assert.equal(
      byTime.size,
      perps.length,
      "Unique raw perp timestamps at second precision",
    );
    return values.map(([time, value]) => [
      time,
      value - (byTime.get(time) ?? 0),
    ]);
  }
  return values;
}
export function assertPortfolioHistory(
  actual,
  raw,
  period,
  kind = "accountValue",
  scope = "all",
) {
  const expected = expectedPortfolioHistory(raw, period, kind, scope);
  assert.ok(expected.length, "A real nonempty history sample is required");
  assert.deepEqual(
    actual,
    expected,
    "Every rendered chart point/time must equal independent raw response history",
  );
  return expected;
}
