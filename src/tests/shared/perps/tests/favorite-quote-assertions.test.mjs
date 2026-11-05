import test from "node:test";
import assert from "node:assert/strict";
import {
  quotePrice,
  assertFavoriteQuote,
} from "../favorite-quote-assertions.mjs";
const row = {
  name: "BTC",
  lines: ["BTC", "123.45"],
  iconCount: 1,
  displayMode: "price",
  quotes: [{ price: "123.459", change: 1.235 }],
  colors: ["rgb(44, 190, 62)"],
};
test("five significant digits truncate, leading-zero decimals and integer precision retained", () => {
  for (const [raw, out] of [
    ["123.459", "123.45"],
    ["0.001234567", "0.001234"],
    ["123456.7", "123456"],
    ["123456000", "123456000"],
    ["1.2300", "1.23"],
    ["0.0000001", "0"],
  ])
    assert.equal(quotePrice(raw), out);
  assert.throws(() => quotePrice("Infinity"));
});
test("raw price/direction match passes; wrong value, color, mode and missing icon fail", () => {
  assertFavoriteQuote(row, "$");
  for (const patch of [
    { lines: ["BTC", "123.46"] },
    { colors: ["rgb(240, 3, 3)"] },
    { displayMode: "percent" },
    { iconCount: 0 },
    { quotes: [] },
  ])
    assert.throws(() => assertFavoriteQuote({ ...row, ...patch }, "$"));
});
test("percentage uses raw change, sign and precision; arbitrary percentages never pass", () => {
  assertFavoriteQuote(
    { ...row, displayMode: "percent", lines: ["BTC", "+1.24%"] },
    "%",
  );
  for (const text of ["1.24%", "+99.00%", "+1.2%", "-1.24%"])
    assert.throws(() =>
      assertFavoriteQuote(
        { ...row, displayMode: "percent", lines: ["BTC", text] },
        "%",
      ),
    );
});

test("production memo without displayName resolves only the instrumented quote component", async () => {
  const { favoriteTopProjection } =
    await import("../favorite-quote-assertions.mjs");
  const quote = {
    type: {},
    memoizedProps: {
      "data-sentry-element": "CtxPriceDisplay",
      displayMode: "percent",
    },
    memoizedState: {
      memoizedState: { current: { markPrice: "100", change24hPercent: 2 } },
      next: null,
    },
  };
  const span = { innerText: "+2.00%", querySelector: () => null };
  const element = {
    innerText: "BTC\n+2.00%",
    querySelectorAll: (s) => (s === "span" ? [span] : [{}]),
  };
  const previous = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({ color: "rgb(10, 180, 50)" });
  try {
    const result = favoriteTopProjection({ child: quote }, element);
    assertFavoriteQuote(result, "%");
    quote.memoizedProps["data-sentry-element"] = "Other";
    assert.throws(
      () => favoriteTopProjection({ child: quote }, element),
      /unique committed/,
    );
  } finally {
    globalThis.getComputedStyle = previous;
  }
});
