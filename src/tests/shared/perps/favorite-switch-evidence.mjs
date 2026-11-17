// Read-only evidence for D03-66. The header, ticker price, chart and favorite
// appearance are independent observations; no product setter is invoked.
import assert from "node:assert/strict";
import { tradingViewSymbolMatches } from "./trading-view-chart-state.mjs";

export function assertFavoriteChart(state, coin) {
  assert.equal(state.visibleCount, 1, "One visible active chart required");
  if (state.engine === "tradingView") {
    assert.equal(state.ready, true, "TradingView model loaded");
    assert.equal(
      tradingViewSymbolMatches(state.symbol, coin),
      true,
      "TradingView symbol matches canonical market",
    );
  } else {
    assert.equal(state.engine, "native", "Known chart engine required");
    assert.equal(state.source?.kind, "hyperliquid");
    assert.equal(
      state.source.coin,
      coin,
      "Native canvas source matches canonical market",
    );
    assert.ok(state.points?.length >= 10, "Loaded candles required");
    assert.ok(
      state.paint?.width > 50 &&
        state.paint.height > 50 &&
        state.paint.colors >= 20 &&
        state.paint.nontransparent > 0,
      "Actual painted native chart required",
    );
  }
}

export function projectFavoriteAppearance(_fiber, element) {
  const nodes = [element, ...element.querySelectorAll("*")].filter(
    (node) => !node.closest("svg") && node.tagName !== "IMG",
  );
  return {
    hovered: element.matches(":hover"),
    selected: nodes.some(
      (node) =>
        node.getAttribute("aria-selected") === "true" ||
        ["true", "page"].includes(node.getAttribute("aria-current")) ||
        node.getAttribute("data-state") === "active",
    ),
    // Quotes can tick/change color during a switch. Backgrounds, borders and
    // outlines must remain unchanged after moving the pointer off the bar.
    paint: nodes.map((node) => {
      const s = getComputedStyle(node);
      const outline =
        s.outlineStyle === "none" || parseFloat(s.outlineWidth) === 0
          ? []
          : [s.outlineStyle, s.outlineWidth, s.outlineColor];
      return [
        node.tagName,
        s.backgroundColor,
        s.boxShadow,
        outline,
        ...["Top", "Right", "Bottom", "Left"].map((side) =>
          parseFloat(s[`border${side}Width`]) > 0 &&
          s[`border${side}Style`] !== "none"
            ? [
                s[`border${side}Width`],
                s[`border${side}Style`],
                s[`border${side}Color`],
              ]
            : [],
        ),
      ];
    }),
  };
}

export function assertFavoriteAppearance(before, after) {
  assert.ok(
    before.length > 1,
    "Multiple favorites required for switch comparison",
  );
  assert.equal(after.length, before.length, "Favorite membership retained");
  for (const states of [before, after])
    for (const state of states) {
      assert.equal(
        state.hovered,
        false,
        "Move pointer off favorites before style observation",
      );
      assert.equal(
        state.selected,
        false,
        "No selected/current favorite marker",
      );
      assert.ok(state.paint.length > 0, "Actual computed styles required");
    }
  assert.deepEqual(
    after,
    before,
    "Selecting a favorite must not change background/border/outline",
  );
}

// Serialized by projectReactAll. Start from the independent header selector,
// ascend to the ticker owner, then locate its actual price subtree.
export function projectTickerPrice(start) {
  const named = (f, target) =>
    [
      f.type?.displayName,
      f.elementType?.displayName,
      f.type?.type?.displayName,
      f.type?.name,
      f.memoizedProps?.["data-sentry-component"],
      f.memoizedProps?.["data-sentry-element"],
      f.memoizedProps?.name,
    ].includes(target);
  let owner;
  const parents = new Set();
  for (let f = start; f; f = f.return) {
    if (parents.has(f) || parents.size >= 4096)
      throw Error("Invalid ticker parent chain");
    parents.add(f);
    if (named(f, "PerpTickerBarDesktop")) {
      owner = f;
      break;
    }
  }
  if (!owner) throw Error("Actual Desktop ticker owner required");
  const markers = [],
    pending = [owner],
    seen = new Set();
  while (pending.length) {
    const f = pending.pop();
    if (seen.has(f) || seen.size >= 10000) throw Error("Invalid ticker tree");
    seen.add(f);
    if (named(f, "TickerBarMarkPrice")) markers.push(f);
    for (let c = f.child; c; c = c.sibling) {
      if (pending.includes(c) || seen.has(c))
        throw Error("Cyclic ticker children");
      pending.push(c);
    }
  }
  function readContexts(fiber) {
    const contexts = [],
      hooks = new Set();
    for (let h = fiber.memoizedState; h; h = h.next) {
      if (hooks.has(h) || hooks.size >= 4096)
        throw Error("Invalid ticker hooks");
      hooks.add(h);
      const visited = new Set();
      const visit = (v, depth) => {
        if (!v || typeof v !== "object" || depth > 4 || visited.has(v)) return;
        visited.add(v);
        if (typeof v.coin === "string" && v.ctx?.markPrice)
          contexts.push({ coin: v.coin, price: String(v.ctx.markPrice) });
        for (const key of ["0", "1", "value", "current", "v", "assetCtx"])
          if (Object.hasOwn(v, key)) visit(v[key], depth + 1);
      };
      visit(h.memoizedState, 0);
    }
    return [...new Map(contexts.map((x) => [JSON.stringify(x), x])).values()];
  }
  // Production minification may erase TickerBarMarkPrice's function name.
  // Its source DebugRenderTracker name survives. Ascend from that marker to
  // the nearest hook owner with raw quote context, never to another stat.
  const prices = new Map();
  for (const marker of markers) {
    const ancestors = new Set();
    let found = false;
    for (let f = marker; f && f !== owner; f = f.return) {
      if (ancestors.has(f) || ancestors.size >= 4096)
        throw Error("Invalid price owner chain");
      ancestors.add(f);
      const contexts = readContexts(f);
      if (contexts.length) {
        prices.set(f, contexts);
        found = true;
        break;
      }
    }
    if (!found) throw Error("Actual ticker price hook context required");
  }
  if (prices.size !== 1)
    throw Error(`Unique actual ticker price required, got ${prices.size}`);
  const [[price, contexts]] = prices;
  const hosts = [],
    queue = [price],
    hostSeen = new Set();
  while (queue.length) {
    const f = queue.pop();
    if (hostSeen.has(f) || hostSeen.size >= 10000)
      throw Error("Invalid ticker host tree");
    hostSeen.add(f);
    if (typeof f.type === "string" && f.stateNode instanceof HTMLElement) {
      if (f.stateNode.checkVisibility())
        hosts.push(f.stateNode.innerText.trim());
      continue;
    }
    for (let c = f.child; c; c = c.sibling) {
      if (queue.includes(c) || hostSeen.has(c))
        throw Error("Cyclic ticker host children");
      queue.push(c);
    }
  }
  return {
    contexts,
    text: hosts,
  };
}

export function assertTickerPrice(state, coin) {
  assert.equal(
    state.contexts.length,
    1,
    "One independent ticker quote identity required",
  );
  assert.equal(
    state.contexts[0].coin,
    coin,
    "Ticker price must belong to selected canonical coin",
  );
  assert.equal(state.text.length, 1, "One visible ticker price required");
  const visible = state.text[0].replaceAll(",", "");
  assert.match(
    visible,
    /^\d+(?:\.\d+)?$/u,
    "Actual ticker price, not skeleton or placeholder",
  );
  assert.ok(Number(visible) > 0);
  assert.equal(
    Number(visible),
    Number(state.contexts[0].price),
    "Visible ticker price equals its independent raw context",
  );
}
