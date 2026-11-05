// Independent fixed-point preview expectations. No product calculator import.
import assert from "node:assert/strict";
const SCALE = 10n ** 24n;
function value(raw) {
  assert.match(
    String(raw),
    /^\d+(?:\.\d{1,24})?$/u,
    "Finite unsigned decimal required",
  );
  const [a, b = ""] = String(raw).split(".");
  return BigInt(a) * SCALE + BigInt(b.padEnd(24, "0"));
}
function format(lots, decimals) {
  const unit = 10n ** BigInt(decimals);
  const fraction = String(lots % unit)
    .padStart(decimals, "0")
    .replace(/0+$/u, "");
  return String(lots / unit) + (fraction ? "." + fraction : "");
}
function precision(decimals) {
  assert.ok(Number.isInteger(decimals) && decimals >= 0 && decimals <= 8);
  return 10n ** BigInt(decimals);
}
export function expectedAddSize({ display, unit, price, leverage, decimals }) {
  const amount = value(display),
    p = value(price),
    lev = value(leverage),
    lots = precision(decimals);
  assert.ok(p > 0n && lev > 0n);
  assert.ok(["token", "usd", "margin"].includes(unit));
  const size =
    unit === "token"
      ? (amount * lots) / SCALE
      : unit === "usd"
        ? (amount * lots) / p
        : (amount * lev * lots) / (p * SCALE);
  return format(size, decimals);
}
export function expectedAddMax({ maximum, mark, price, type, side, decimals }) {
  assert.ok(["market", "limit"].includes(type));
  assert.ok(["long", "short"].includes(side));
  const raw = value(maximum),
    m = value(mark),
    p = value(price),
    lots = precision(decimals);
  assert.ok(m > 0n && p > 0n);
  const denominator = type === "market" ? m : side === "short" && m > p ? m : p;
  return format((raw * m * lots) / (SCALE * denominator), decimals);
}
export function expectedAddPercent({ maximum, percent, decimals }) {
  assert.ok(Number.isInteger(percent) && percent >= 0 && percent <= 100);
  return format(
    (value(maximum) * BigInt(percent) * precision(decimals)) / (SCALE * 100n),
    decimals,
  );
}
export function expectedAddCost({ quantity, price, leverage }) {
  const q = value(quantity),
    p = value(price),
    lev = value(leverage);
  assert.ok(lev > 0n);
  const numerator = q * p * 100n,
    denominator = lev * SCALE;
  return format((2n * numerator + denominator) / (2n * denominator), 2);
}
export function assertAddRawCost(raw, { quantity, price, leverage }) {
  // BigNumber's final division is stored to 20 decimal places. Compare its
  // visible raw NumberSizeableText input at 12 places, before UI cents rounding.
  const tolerance = SCALE / 10n ** 12n;
  const actual = value(raw),
    q = value(quantity),
    p = value(price),
    lev = value(leverage);
  assert.ok(lev > 0n);
  const expected = (q * p) / lev;
  assert.ok(
    (actual > expected ? actual - expected : expected - actual) <= tolerance,
    "Unrounded cost must use the independently resolved token quantity",
  );
}
export function expectedAddMinimum({
  price,
  leverage,
  unit,
  decimals,
  symbol,
}) {
  const p = value(price),
    lev = value(leverage),
    lots = precision(decimals);
  assert.ok(p > 0n && lev > 0n);
  assert.ok(["token", "usd", "margin"].includes(unit));
  const minimumLots = (10n * SCALE * lots + p - 1n) / p;
  if (unit === "token") {
    const q = format(minimumLots, decimals),
      [a, b = ""] = q.split(".");
    return a + (decimals ? "." + b.padEnd(decimals, "0") : "") + " " + symbol;
  }
  const n = minimumLots * p * 100n,
    denom = unit === "usd" ? lots * SCALE : lots * lev;
  const cents = (n + denom - 1n) / denom;
  return (
    "$" + String(cents / 100n) + "." + String(cents % 100n).padStart(2, "0")
  );
}
export function assertAddCost(text, expected) {
  assert.match(
    text,
    /^\$[\d,]+(?:\.\d+)?$/u,
    "Actual numeric cost field required",
  );
  assert.equal(
    value(text.replace(/[$,]/gu, "")),
    value(expected),
    "Displayed cost vs independent rounded notional/leverage",
  );
}
// This function is serialized into the renderer. Only committed props/hooks are
// read; callbacks, setters and product services are never invoked.
export function projectAddPositionEvidence(start, element) {
  let size;
  const raw = [];
  const costs = [];
  for (let f = start; f; f = f.return) {
    const props = f.memoizedProps;
    if (
      props?.testID === "perp-add-position-amount-input" &&
      Object.hasOwn(props, "referencePrice") &&
      Object.hasOwn(props, "sizeInputMode")
    ) {
      const candidate = {
        quantity: props.value,
        price: props.referencePrice,
        side: props.side,
        leverage: props.leverage,
        mode: props.sizeInputMode,
        percent: props.sliderPercent,
        coin: props.activeAsset?.coin,
        decimals: props.activeAsset?.universe?.szDecimals,
        ready: props.isAssetCtxReady,
        allowMargin: props.allowMarginInput,
        display: element.value,
      };
      if (size && JSON.stringify(size) !== JSON.stringify(candidate))
        throw Error("Conflicting add-position SizeInput props");
      size = candidate;
    }
    const name =
      f.type?.displayName || f.type?.type?.displayName || f.type?.name;
    if (!name?.includes("AddPositionForm")) continue;
    const scan = (node, depth) => {
      if (!node || depth > 35) return;
      const props = node.memoizedProps;
      if (
        props?.formatter === "value" &&
        props.formatterOptions?.currency === "$" &&
        typeof props.children === "string"
      )
        costs.push(props.children);
      for (let c = node.child; c; c = c.sibling) scan(c, depth + 1);
    };
    scan(f, 0);
    const seenHooks = new Set();
    for (let h = f.memoizedState; h; h = h.next) {
      if (seenHooks.has(h) || seenHooks.size > 4096)
        throw Error("Invalid add-position hook chain");
      seenHooks.add(h);
      const seen = new Set();
      const visit = (v, depth) => {
        if (!v || typeof v !== "object" || depth > 4 || seen.has(v)) return;
        seen.add(v);
        if (
          v.coin &&
          v.user &&
          Array.isArray(v.maxTradeSzs) &&
          v.markPx !== undefined
        )
          raw.push({
            coin: v.coin,
            account: v.user,
            mark: v.markPx,
            maxima: v.maxTradeSzs.map(String),
          });
        for (const k of ["0", "1", "value", "current", "v"])
          if (Object.hasOwn(v, k)) visit(v[k], depth + 1);
      };
      visit(h.memoizedState, 0);
    }
  }
  if (!size) throw Error("Committed add-position SizeInput required");
  return {
    ...size,
    rawCosts: [...new Set(costs)],
    raw: [...new Set(raw.map((v) => JSON.stringify(v)))].map((v) =>
      JSON.parse(v),
    ),
  };
}
export function assertAddEvidence(state, sample, account) {
  assert.equal(state.ready, true, "Target asset must have finished loading");
  assert.equal(state.coin, sample.coin);
  assert.equal(state.side, Number(sample.szi) > 0 ? "long" : "short");
  assert.equal(state.leverage, sample.leverage.value);
  precision(state.decimals);
  assert.equal(
    state.raw.length,
    1,
    "One target-market raw asset snapshot required",
  );
  const raw = state.raw[0];
  assert.equal(raw.coin, sample.coin);
  assert.equal(raw.account.toLowerCase(), account.toLowerCase());
  assert.equal(raw.maxima.length, 2);
  raw.maxima.forEach(value);
  assert.ok(value(raw.mark) > 0n && value(state.price) > 0n);
  return raw;
}
