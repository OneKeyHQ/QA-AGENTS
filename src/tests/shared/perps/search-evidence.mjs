import assert from "node:assert/strict";
import { aliasMatches } from "./search-alias-oracle.mjs";

// Expected sets come from independent raw market metadata, never the rendered
// list or its own derived/filter state. Empty matches are legitimate.
export function assertPerpSearchResultSet(catalog, results, query, config) {
  const universe = catalog.filter((r) => !r.spot);
  assert.ok(
    universe.length > 0,
    "Independent perpetual market catalog required",
  );
  const q = query.trim().slice(0, 64).toLowerCase();
  const expected = universe
    .filter(
      (r) =>
        r.coin.toLowerCase().includes(q) || aliasMatches(r.coin, q, config),
    )
    .map((r) => r.coin)
    .sort();
  assert.ok(
    results.every((r) => !r.spot),
    "Perp search cannot contain spot rows",
  );
  assert.deepEqual(
    results.map((r) => r.coin).sort(),
    expected,
    "Rendered full search set must equal independent market metadata/config intersection",
  );
}

// Caller resolves React's committed branch before invoking this projection.
// Return the owner's primitive string hook states; do not guess a hook index or
// accept a matching string from an unrelated component.
export function projectSelectorStringStates(start) {
  for (let f = start; f; f = f.return) {
    const name = f.type?.name || f.type?.displayName;
    if (name !== "BasePerpTokenSelectorContent") continue;
    const values = [];
    for (let h = f.memoizedState, i = 0; h && i < 500; h = h.next, i++) {
      if (typeof h.memoizedState === "string") values.push(h.memoizedState);
    }
    return values;
  }
  throw Error("Committed BasePerpTokenSelectorContent owner unavailable");
}

export async function withSearchPageErrors(page, check) {
  const errors = [];
  const observe = (error) => errors.push(error.message);
  page.on("pageerror", observe);
  try {
    const result = await check();
    assert.deepEqual(
      errors,
      [],
      "Search flow must not emit an uncaught page error",
    );
    return result;
  } finally {
    page.off("pageerror", observe);
  }
}

// Only All is fixed. Every other category (including Hot/New) comes from the
// published catalog. Normalize invalid rows/IDs independently from the UI.
export function expectedSearchCategories(serverTabs) {
  const reserved = new Set(["favorites", "all", "perps", "spot"]);
  const seen = new Set();
  const categories = [{ tabId: "perps", name: "全部", tokens: [] }];
  for (const raw of serverTabs ?? []) {
    const tabId = raw?.tabId?.trim(),
      name = raw?.name?.trim();
    if (!tabId || !name) continue;
    const identity = tabId.toLowerCase();
    if (seen.has(identity)) continue;
    seen.add(identity);
    if (!reserved.has(identity))
      categories.push({
        tabId,
        name,
        tokens: [
          ...new Set(
            Array.isArray(raw.tokens)
              ? raw.tokens.map((t) => t.trim()).filter(Boolean)
              : [],
          ),
        ],
      });
  }
  return categories;
}
