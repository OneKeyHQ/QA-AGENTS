import test from "node:test";
import assert from "node:assert/strict";
import {
  assertFavoriteChart,
  assertFavoriteAppearance,
  assertTickerPrice,
  projectTickerPrice,
} from "../favorite-switch-evidence.mjs";

test("favorite switch rejects stale TV symbol even when header/form already changed", () => {
  const good = {
    engine: "tradingView",
    visibleCount: 1,
    ready: true,
    symbol: "ETH",
  };
  assertFavoriteChart(good, "ETH");
  for (const patch of [
    { symbol: "BTC" },
    { symbol: "xyz:ETH" },
    { ready: false },
    { visibleCount: 0 },
    { visibleCount: 2 },
  ])
    assert.throws(() => assertFavoriteChart({ ...good, ...patch }, "ETH"));
});
test("favorite switch rejects stale/blank native canvas rather than trusting form props", () => {
  const good = {
    engine: "native",
    visibleCount: 1,
    source: { kind: "hyperliquid", coin: "ETH" },
    points: Array(10).fill({ t: 1, c: 2 }),
    paint: { width: 700, height: 400, colors: 24, nontransparent: 400 },
  };
  assertFavoriteChart(good, "ETH");
  for (const patch of [
    { source: { kind: "hyperliquid", coin: "BTC" } },
    { points: [] },
    { paint: { ...good.paint, colors: 1 } },
    { engine: "unknown" },
  ])
    assert.throws(() => assertFavoriteChart({ ...good, ...patch }, "ETH"));
});
test("non-hover before/after comparison detects a persistent selected background or marker", () => {
  const baseline = [
    { hovered: false, selected: false, paint: [["DIV", "transparent"]] },
    { hovered: false, selected: false, paint: [["DIV", "transparent"]] },
  ];
  assertFavoriteAppearance(baseline, structuredClone(baseline));
  for (const mutate of [
    (x) => {
      x[1].paint[0][1] = "rgb(10, 10, 10)";
    },
    (x) => {
      x[1].selected = true;
    },
    (x) => {
      x[1].hovered = true;
    },
    (x) => {
      x[1].paint = [];
    },
    (x) => {
      x.pop();
    },
  ]) {
    const after = structuredClone(baseline);
    mutate(after);
    assert.throws(() => assertFavoriteAppearance(baseline, after));
  }
});
test("ticker oracle requires correct raw identity and visible price, including ambiguity and skeleton rejection", () => {
  const good = {
    contexts: [{ coin: "ETH", price: "2345.67" }],
    text: ["2,345.67"],
  };
  assertTickerPrice(good, "ETH");
  for (const patch of [
    { contexts: [{ coin: "BTC", price: "2345.67" }] },
    { text: ["--"] },
    { text: ["2,345.6"] },
    { text: [] },
    { contexts: [...good.contexts, { coin: "BTC", price: "80000" }] },
  ])
    assert.throws(() => assertTickerPrice({ ...good, ...patch }, "ETH"));
});
test("ticker projection reads actual price subtree, ignores other stats, rejects duplicate price owners", () => {
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
  const quote = { coin: "ETH", ctx: { markPrice: "2345.67" } };
  const price = {
    type: { name: "TickerBarMarkPrice" },
    memoizedState: { memoizedState: [{ assetCtx: quote }, []] },
    child: { type: "span", stateNode: new Host("2,345.67") },
  };
  const owner = { type: { name: "PerpTickerBarDesktop" }, child: price };
  const start = { return: owner };
  try {
    assertTickerPrice(projectTickerPrice(start), "ETH");
    price.sibling = {
      type: { name: "UnrelatedVolume" },
      child: { type: "span", stateNode: new Host("999") },
    };
    assertTickerPrice(projectTickerPrice(start), "ETH");
    price.sibling.type.name = "TickerBarMarkPrice";
    price.sibling.memoizedState = price.memoizedState;
    assert.throws(() => projectTickerPrice(start), /Unique/);
    assert.throws(() => projectTickerPrice({}), /owner/);
  } finally {
    globalThis.HTMLElement = previous;
  }
});

test("production anonymous ticker and price owners resolve stable DebugRenderTracker markers", () => {
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
  const owner = { type: {}, memoizedProps: { name: "PerpTickerBarDesktop" } };
  const price = {
    type: { name: "a" },
    return: owner,
    memoizedState: {
      memoizedState: [
        { assetCtx: { coin: "ETH", ctx: { markPrice: "2345.67" } } },
        [],
      ],
    },
  };
  const marker = {
    type: {},
    memoizedProps: { name: "TickerBarMarkPrice" },
    return: price,
    child: { type: "span", stateNode: new Host("2,345.67") },
  };
  owner.child = price;
  price.child = marker;
  try {
    assertTickerPrice(projectTickerPrice({ return: owner }), "ETH");
    marker.memoizedProps.name = "UnrelatedVolume";
    assert.throws(() => projectTickerPrice({ return: owner }), /Unique/);
  } finally {
    globalThis.HTMLElement = previous;
  }
});
