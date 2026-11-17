// Independent rational arithmetic oracle. Never imports product calculators.
import assert from "node:assert/strict";
import { assertBboPriceState } from "./bbo-price-evidence.mjs";
import { expectedAddCost } from "./add-position-evidence.mjs";
const gcd = (a, b) => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a || 1n;
};
const q = (n, d = 1n) => {
  assert.notEqual(d, 0n);
  if (d < 0n) [n, d] = [-n, -d];
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
};
const val = (raw) => {
  assert.match(
    String(raw),
    /^-?\d+(?:\.\d{1,24})?$/u,
    "Exact decimal required",
  );
  const negative = String(raw).startsWith("-");
  const [a, b = ""] = String(raw).replace(/^-/, "").split(".");
  return q(BigInt(a + b) * (negative ? -1n : 1n), 10n ** BigInt(b.length));
};
const add = (a, b) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const neg = (a) => q(-a.n, a.d);
const sub = (a, b) => add(a, neg(b));
const mul = (a, b) => q(a.n * b.n, a.d * b.d);
const div = (a, b) => q(a.n * b.d, a.d * b.n);
const cmp = (a, b) => Math.sign(Number(a.n * b.d - b.n * a.d));
const abs = (a) => q(a.n < 0n ? -a.n : a.n, a.d);
const min = (a, b) => (cmp(a, b) < 0 ? a : b);
const max = (a, b) => (cmp(a, b) > 0 ? a : b);
const num = (a) => Number(a.n) / Number(a.d);
const zero = q(0n),
  one = q(1n);
function tiersFor(input) {
  const raw = input.tiers?.length
    ? input.tiers
    : [{ lowerBound: "0", maxLeverage: input.maxLeverage }];
  let deduction = zero;
  return raw.map((t, i) => {
    const lower = val(t.lowerBound),
      rate = div(one, mul(val(t.maxLeverage), q(2n)));
    assert.ok(t.maxLeverage > 0);
    if (i) {
      assert.ok(cmp(lower, val(raw[i - 1].lowerBound)) > 0);
      const priorRate = div(one, mul(val(raw[i - 1].maxLeverage), q(2n)));
      deduction = add(deduction, mul(lower, sub(rate, priorRate)));
    } else assert.equal(cmp(lower, zero), 0);
    return {
      lower,
      upper: raw[i + 1] ? val(raw[i + 1].lowerBound) : null,
      rate,
      deduction,
      maxLeverage: t.maxLeverage,
    };
  });
}
const inside = (tier, n) =>
  cmp(n, tier.lower) >= 0 && (!tier.upper || cmp(n, tier.upper) < 0);
const maintenance = (tier, n) => sub(mul(n, tier.rate), tier.deduction);

export function expectedBboAmounts({ quantity, price, leverage }) {
  const size = val(quantity),
    p = val(price),
    lev = val(leverage);
  assert.ok(cmp(size, zero) > 0 && cmp(p, zero) > 0 && cmp(lev, zero) > 0);
  const notional = mul(size, p);
  const cents = (notional.n * 100n) / notional.d; // Button truncates, cost formatter rounds.
  return {
    notional: num(notional),
    margin: num(div(notional, lev)),
    usdSecondary: `≈ $${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`,
  };
}

// Solve equity-at-price == piecewise maintenance-at-price. This formulation
// uses rational equations rather than the production iterative calculator.
export function expectedBboLiquidation(input) {
  assert.ok(["long", "short"].includes(input.side));
  assert.ok(["cross", "isolated"].includes(input.marginMode));
  const size = val(input.quantity),
    existing = val(input.positionSize ?? "0"),
    mark = val(input.mark),
    order = val(input.price);
  assert.ok(cmp(size, zero) > 0 && cmp(mark, zero) > 0 && cmp(order, zero) > 0);
  const lev = val(input.leverage || input.maxLeverage);
  assert.ok(cmp(lev, zero) > 0);
  const reference = input.side === "long" ? min(mark, order) : max(mark, order);
  let fill = size;
  const direction = input.side === "long" ? one : neg(one);
  if (input.reduceOnly)
    fill =
      cmp(mul(existing, direction), zero) >= 0
        ? zero
        : min(abs(existing), size);
  const delta = mul(fill, direction),
    resulting = add(existing, delta);
  if (cmp(resulting, zero) === 0) return null;
  const tiers = tiersFor(input),
    notional = mul(reference, abs(resulting));
  const tier = tiers.find((t) => inside(t, notional));
  assert.ok(tier, "Notional belongs to a known margin tier");
  let equity;
  if (input.marginMode === "isolated") {
    if (cmp(existing, zero) !== 0 && input.isolatedRawUsd == null) return null;
    const originalEquity = add(
      val(input.isolatedRawUsd ?? "0"),
      mul(existing, reference),
    );
    const opposite = cmp(mul(existing, delta), zero) < 0;
    const closed = opposite ? min(abs(existing), abs(delta)) : zero;
    const survivingFraction =
      cmp(existing, zero) === 0 ? zero : sub(one, div(closed, abs(existing)));
    const opened = sub(abs(delta), closed);
    equity = add(
      mul(originalEquity, survivingFraction),
      div(mul(opened, reference), lev),
    );
  } else {
    if (input.crossAvailable == null) return null;
    const existingNotional = mul(abs(existing), mark);
    const oldTier = tiers.find((t) => inside(t, existingNotional));
    assert.ok(oldTier);
    equity = add(
      val(input.crossAvailable),
      maintenance(oldTier, existingNotional),
    );
  }
  equity = max(equity, div(notional, min(lev, val(tier.maxLeverage))));
  for (const t of tiers) {
    const denominator = sub(resulting, mul(abs(resulting), t.rate));
    if (cmp(denominator, zero) === 0) continue;
    const candidate = div(
      sub(sub(mul(resulting, reference), equity), t.deduction),
      denominator,
    );
    if (
      cmp(candidate, zero) > 0 &&
      cmp(candidate, val("1000000000000000")) <= 0 &&
      inside(t, mul(candidate, abs(resulting)))
    )
      return num(candidate);
  }
  return null;
}

export function assertBboNumeric(actual, expected, label) {
  assert.ok(
    Number.isFinite(Number(actual)) && Number.isFinite(expected),
    `${label}: finite numbers required`,
  );
  assert.ok(
    Math.abs(Number(actual) - expected) <=
      Math.max(1e-10, Math.abs(expected) * 2e-13),
    `${label}: ${actual} vs ${expected}`,
  );
}

export function assertBboPreviewEvidence(state, fixture) {
  assertBboPriceState(state, fixture);
  assert.equal(
    state.spot,
    false,
    "Perpetual margin/liquidation sample required",
  );
  assert.equal(state.orderMode, "standard");
  assert.equal(state.sizeInputMode, "manual");
  assert.equal(
    Number(state.quantity),
    Number(state.rawSize),
    "Submitted manual token size must match the visible form's raw size",
  );
  const amounts = expectedBboAmounts({
    quantity: state.quantity,
    price: state.price,
    leverage: state.leverage,
  });
  assertBboNumeric(state.orderValue, amounts.notional, "BBO order value");
  assert.ok(
    state.buttonText
      .split("\n")
      .map((s) => s.trim())
      .includes(amounts.usdSecondary),
    "Actual button DOM contains its own exact USD secondary amount",
  );
  assert.equal(
    state.costs.length,
    1,
    "One visible cost belonging to this side",
  );
  assertBboNumeric(state.costs[0].raw, amounts.margin, "Cost numeric prop");
  assert.match(
    state.costs[0].text.trim(),
    /^\$[\d,]+\.\d{2}$/u,
    "Exact numeric cost DOM",
  );
  assert.equal(
    Number(state.costs[0].text.replace(/[$,]/gu, "")),
    Number(
      expectedAddCost({
        quantity: state.quantity,
        price: state.price,
        leverage: state.leverage,
      }),
    ),
    "Visible cost vs independent rounded amount/leverage",
  );
  assert.equal(
    state.liquidation.length,
    1,
    "One actual liquidation leaf per side",
  );
  const l = state.liquidation[0];
  assert.equal(l.side, state.side);
  assert.equal(l.coin, state.coin);
  assert.equal(l.mode, "perp");
  assert.equal(l.type, "limit");
  assert.equal(l.price, state.price);
  assert.equal(l.quantity, state.quantity);
  assert.ok(l.account, "Active account required");
  assert.equal(
    l.assetData?.accountAddress?.toLowerCase(),
    l.account.toLowerCase(),
    "Liquidation must use current-account asset data",
  );
  assert.equal(l.assetData.coin, state.coin);
  assert.equal(l.assetData.leverage.value, state.leverage);
  const expected = expectedBboLiquidation({
    side: state.side,
    quantity: state.quantity,
    price: state.price,
    mark: l.mark,
    leverage: state.leverage,
    maxLeverage: l.maxLeverage,
    marginMode: l.assetData.leverage.type,
    tiers: l.tiers,
    positionSize: l.position?.szi ?? "0",
    isolatedRawUsd:
      l.position?.leverage?.type === "isolated"
        ? l.position.leverage.rawUsd
        : undefined,
    crossAvailable: l.crossAvailable,
    reduceOnly: l.reduceOnly,
  });
  if (expected === null) {
    assert.equal(l.raw, null);
    assert.equal(l.text.trim(), "--");
    return { ...amounts, liquidation: null, numericLiquidationSample: false };
  }
  assertBboNumeric(
    l.raw,
    expected,
    "Actual liquidation hook vs independent equity equation",
  );
  assert.match(
    l.text.trim(),
    /^\$[\d,]+(?:\.\d+)?$/u,
    "Actual numeric liquidation DOM",
  );
  const digits =
    expected >= 1 ? 2 : 4 + Math.max(0, -Math.floor(Math.log10(expected)) - 1);
  assert.ok(
    Math.abs(Number(l.text.replace(/[$,]/gu, "")) - expected) <=
      0.500001 * 10 ** -digits,
    "Visible liquidation has the specified display precision",
  );
  return { ...amounts, liquidation: expected, numericLiquidationSample: true };
}
