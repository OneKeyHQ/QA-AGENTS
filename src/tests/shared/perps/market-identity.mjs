import assert from "node:assert/strict";
// Join independent raw metadata with DOM identity. Never infer a raw market from
// a reused React row's old props, a sanitized testid alone, or the base coin alone.
export const rowTestId = (coin) =>
  `perp-token-selector-row-${coin.replace(/[^a-z0-9]+/giu, "-").toLowerCase()}`;
export function identifyMarketRow(rendered, catalog) {
  const matches = catalog.filter(
    (r) =>
      r.id === rendered.id &&
      r.name === rendered.name &&
      r.spot === rendered.spot,
  );
  assert.equal(
    matches.length,
    1,
    `DOM market identity is not unique in raw metadata: ${JSON.stringify(rendered)}`,
  );
  const raw = matches[0];
  if (raw.dex)
    assert.equal(rendered.dex, raw.dex, "DEX badge must match raw market");
  return { ...rendered, coin: raw.coin, base: raw.base, quote: raw.quote };
}
export function marketCatalog(perps, spots, names) {
  return [
    ...perps.map((r) => ({
      id: rowTestId(r.name),
      name: r.name.split(":").at(-1),
      coin: r.name,
      dex: r.name.includes(":") ? r.name.split(":")[0] : null,
      spot: false,
    })),
    ...spots.map((r) => ({
      id: rowTestId(names[r.base] ?? r.base),
      name: `${names[r.base] ?? r.base}/${r.quote}`,
      coin: r.coin,
      base: r.base,
      quote: r.quote,
      spot: true,
    })),
  ];
}
// Read the actual name span. innerText line breaks are not stable on skipped
// offscreen content and must never turn a perp row's '/' change separator into
// a spot identity. The independent catalog still validates the full identity.
export function marketRowDOM(e) {
  const leaves = [...e.querySelectorAll("span")].filter(
    (n) => !n.querySelector("span") && n.textContent.trim(),
  );
  if (!leaves.length)
    throw Error(`Missing market name span: ${e.dataset.testid}`);
  const name = leaves[0].textContent.trim();
  return {
    id: e.dataset.testid,
    name,
    text: e.innerText,
    spot: name.includes("/"),
    dex:
      e.querySelector('[data-testid$="-dex-badge"]')?.textContent.trim() ??
      null,
    selected: e.classList.contains("_bg-bgHover"),
    favorite:
      e
        .querySelector('[data-testid="perp-already-favorite-icon-btn"] svg')
        ?.getAttribute("data-sentry-source-file")
        ?.includes("/solid/") === true,
  };
}
