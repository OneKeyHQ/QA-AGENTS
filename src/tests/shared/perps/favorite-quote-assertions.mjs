// Independent display oracle: five significant digits, at most six decimals,
// truncation, integer prices preserved; percentage rounding tolerance 0.005%.
import assert from "node:assert/strict";
export function quotePrice(raw) {
  assert.match(
    String(raw),
    /^\d+(?:\.\d+)?$/u,
    "Finite non-negative decimal price required",
  );
  let [whole, fraction = ""] = String(raw).split(".");
  whole = whole.replace(/^0+(?=\d)/u, "");
  fraction = fraction.replace(/0+$/u, "");
  if (!fraction) return whole;
  const significant =
    whole === "0"
      ? 5 + (fraction.match(/^0*/u)?.[0].length ?? 0)
      : Math.max(0, 5 - whole.length);
  fraction = fraction.slice(0, Math.min(6, significant)).replace(/0+$/u, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
export function assertFavoriteQuote(row, mode) {
  assert.ok(row.iconCount > 0, `${row.name} token icon missing`);
  assert.equal(row.lines.length, 2, `${row.name} name and one value`);
  assert.equal(
    row.displayMode,
    mode === "%" ? "percent" : "price",
    "Display mode prop must match selected control",
  );
  assert.ok(row.quotes.length > 0, `${row.name} committed raw quote absent`);
  assert.ok(
    row.quotes.every(
      (q) => JSON.stringify(q) === JSON.stringify(row.quotes[0]),
    ),
    "Ambiguous raw quote",
  );
  const q = row.quotes[0];
  assert.ok(
    Number.isFinite(Number(q.price)) && Number(q.price) > 0,
    "Positive mark price required",
  );
  assert.ok(Number.isFinite(q.change), "Finite 24h change required");
  const text = row.lines[1].replaceAll(",", "").replace("−", "-");
  if (mode === "$")
    assert.equal(
      text,
      quotePrice(q.price),
      `${row.name} raw mark price display`,
    );
  else {
    assert.match(
      text,
      /^[+-]\d+(?:\.\d{2})%$/u,
      `${row.name} signed two-decimal percentage`,
    );
    assert.ok(
      Math.abs(Number(text.slice(0, -1)) - q.change) <= 0.005000001,
      `${row.name} percentage differs from raw 24h change`,
    );
    assert.equal(text.startsWith("-"), q.change < 0, "Percentage sign");
  }
  assert.equal(row.colors.length, 1, "Unique value color required");
  const [red, green, blue] =
    row.colors[0].match(/\d+(?:\.\d+)?/gu)?.map(Number) ?? [];
  assert.ok([red, green, blue].every(Number.isFinite), "Readable RGB required");
  assert.ok(
    q.change >= 0 ? green > red && green > blue : red > green && red > blue,
    `${row.name} color must match 24h direction ${q.change}`,
  );
}
// Production memo components can lose displayName. The instrumented JSX
// element identity survives on committed props; never substitute a row numeral.
export function favoriteTopProjection(f, e) {
  const displays = [];
  function walk(n) {
    for (let c = n.child; c; c = c.sibling) {
      const v = c.memoizedProps;
      const name =
        c.type?.displayName ||
        c.type?.type?.displayName ||
        v?.["data-sentry-element"];
      if (name === "CtxPriceDisplay") displays.push(c);
      else walk(c);
    }
  }
  walk(f);
  const quotes = [];
  for (const d of displays)
    for (let h = d.memoizedState; h; h = h.next) {
      const v = h.memoizedState?.current;
      if (
        v &&
        typeof v === "object" &&
        Object.hasOwn(v, "markPrice") &&
        Object.hasOwn(v, "change24hPercent")
      )
        quotes.push({
          price: String(v.markPrice),
          change: Number(v.change24hPercent),
        });
    }
  const lines = e.innerText.split("\n"),
    value = lines.at(-1);
  const colors = [
    ...new Set(
      [...e.querySelectorAll("span")]
        .filter((n) => !n.querySelector("span") && n.innerText === value)
        .map((n) => getComputedStyle(n).color),
    ),
  ];
  if (displays.length !== 1)
    throw Error(
      `Expected unique committed CtxPriceDisplay, got ${displays.length}`,
    );
  return {
    name: lines[0].trim(),
    lines,
    iconCount: e.querySelectorAll("img,svg").length,
    quotes,
    displayMode: displays[0].memoizedProps.displayMode ?? "price",
    colors,
  };
}
