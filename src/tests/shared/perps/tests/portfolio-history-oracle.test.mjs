import test from "node:test";
import assert from "node:assert/strict";
import {
  expectedPortfolioHistory,
  assertPortfolioHistory,
  portfolioHistoryProjection,
} from "../portfolio-history-oracle.mjs";
const raw = [
  [
    "day",
    {
      accountValueHistory: [
        [1001, "100"],
        [2999, "120"],
      ],
      pnlHistory: [
        [1001, "-3"],
        [2999, "11"],
      ],
    },
  ],
  [
    "perpDay",
    {
      accountValueHistory: [],
      pnlHistory: [
        [1001, "-2"],
        [2999, "7"],
      ],
    },
  ],
];
test("independent history converts milliseconds, preserves exact ordering and scope-specific pnl", () => {
  assert.deepEqual(expectedPortfolioHistory(raw, "day"), [
    [1, 100],
    [2, 120],
  ]);
  assert.deepEqual(expectedPortfolioHistory(raw, "day", "pnl"), [
    [1, -3],
    [2, 11],
  ]);
  assert.deepEqual(expectedPortfolioHistory(raw, "day", "pnl", "perps"), [
    [1, -2],
    [2, 7],
  ]);
  assert.deepEqual(expectedPortfolioHistory(raw, "day", "pnl", "spot"), [
    [1, -1],
    [2, 4],
  ]);
});
test("stale period/value, reordered or missing point cannot pass by matching only selection or last value", () => {
  for (const points of [
    [
      [1, 100],
      [2, 121],
    ],
    [[2, 120]],
    [
      [2, 120],
      [1, 100],
    ],
    [
      [0, 100],
      [2, 120],
    ],
  ])
    assert.throws(() => assertPortfolioHistory(points, raw, "day"));
  assertPortfolioHistory(
    [
      [1, 100],
      [2, 120],
    ],
    raw,
    "day",
  );
  assert.throws(
    () => assertPortfolioHistory([], raw, "week"),
    /Unique raw period/,
  );
});
test("malformed/ambiguous raw inputs fail closed", () => {
  for (const value of ["NaN", "Infinity", "12oops", ""]) {
    const broken = structuredClone(raw);
    broken[0][1].accountValueHistory[0][1] = value;
    assert.throws(() => expectedPortfolioHistory(broken, "day"));
  }
  assert.throws(
    () => expectedPortfolioHistory([...raw, raw[0]], "day"),
    /Unique raw period/,
  );
  assert.throws(
    () => expectedPortfolioHistory(raw, "future"),
    /Known history period/,
  );
  assert.throws(
    () => expectedPortfolioHistory(raw, "day", "funding"),
    /History kind/,
  );
});
test("projection accepts only one distinct raw history in actual content owner, never chart props or another owner", () => {
  const owner = {
    type: { name: "PerpPortfolioContentComponent" },
    memoizedState: { memoizedState: { result: raw } },
  };
  assert.deepEqual(portfolioHistoryProjection(owner), raw);
  assert.throws(
    () =>
      portfolioHistoryProjection({
        type: { name: "Other" },
        memoizedState: owner.memoizedState,
      }),
    /got 0/,
  );
  const next = structuredClone(raw);
  next[0][1].pnlHistory[0][1] = "123";
  owner.memoizedState.next = { memoizedState: { result: next } };
  assert.throws(() => portfolioHistoryProjection(owner), /got 2/);
  assert.throws(
    () =>
      portfolioHistoryProjection({
        type: { name: "LightweightChart" },
        memoizedProps: { data: [[1, 100]] },
      }),
    /got 0/,
  );
});
