import test from "node:test";
import assert from "node:assert/strict";
import { assertFavoriteListRow } from "../favorite-list-assertions.mjs";
const fixture = () => ({
  context: { name: "BTC", price: "100.1234", change: 2.123 },
  starBeforeName: true,
  cells: {
    TokenPriceCellDesktop: { visible: true, text: "100.12" },
    Token24hChangeCellDesktop: { visible: true, text: "+2.09 / +2.12%" },
  },
});
test("actual price and percent columns agree with quote at display precision", () =>
  assertFavoriteListRow(fixture(), "BTC"));
test("digits elsewhere cannot substitute for a missing price column", () => {
  const f = fixture();
  delete f.cells.TokenPriceCellDesktop;
  assert.throws(() => assertFavoriteListRow(f, "BTC"), /price cell/);
});
test("wrong price, percent, identity and star position each fail", () => {
  for (const mutate of [
    (f) => (f.cells.TokenPriceCellDesktop.text = "10.12"),
    (f) => (f.cells.Token24hChangeCellDesktop.text = "+9 / +9.00%"),
    (f) => (f.context.name = "ETH"),
    (f) => (f.starBeforeName = false),
  ]) {
    const f = fixture();
    mutate(f);
    assert.throws(() => assertFavoriteListRow(f, "BTC"));
  }
});

test("production anonymous memo columns resolve precise DebugRenderTracker names", async () => {
  const { favoriteListProjection } =
    await import("../favorite-list-assertions.mjs");
  const previous = globalThis.HTMLElement;
  class Host {
    constructor(text) {
      this.innerText = text;
    }
    checkVisibility() {
      return true;
    }
  }
  globalThis.HTMLElement = Host;
  const host = (text) => ({
    stateNode: new Host(text),
    child: null,
    sibling: null,
  });
  const cell = (name, text) => ({
    type: {},
    memoizedProps: {},
    child: {
      type: { displayName: "DebugRenderTracker" },
      memoizedProps: { name },
      child: host(text),
    },
  });
  const price = cell("TokenPriceCellDesktop", "100.12"),
    change = cell("Token24hChangeCellDesktop", "+2.09 / +2.12%");
  price.sibling = change;
  const start = {
    child: price,
    return: {
      memoizedProps: {
        value: {
          token: { name: "BTC" },
          assetCtx: { markPrice: "100.1234", change24hPercent: 2.123 },
        },
      },
    },
  };
  const e = {
    contains: () => true,
    querySelector: () => ({ getBoundingClientRect: () => ({ right: 10 }) }),
    querySelectorAll: () => [
      { innerText: "BTC", getBoundingClientRect: () => ({ left: 20 }) },
    ],
  };
  try {
    assertFavoriteListRow(favoriteListProjection(start, e), "BTC");
    price.child.memoizedProps.name = "UnrelatedColumn";
    assert.throws(
      () => assertFavoriteListRow(favoriteListProjection(start, e), "BTC"),
      /price cell/,
    );
  } finally {
    globalThis.HTMLElement = previous;
  }
});
