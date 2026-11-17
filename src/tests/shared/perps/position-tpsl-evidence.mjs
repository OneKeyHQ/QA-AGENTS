import assert from "node:assert/strict";
// Prefer the current existing position; otherwise a native long sample can
// exercise all three preview rows. Never guess a DEX market by its base name.
export function selectPreviewPosition(positions, currentCoin) {
  const nonzero = positions.filter((p) => Number.isFinite(Number(p.size)) && Number(p.size) !== 0);
  const native = nonzero.filter((p) => /^[A-Za-z0-9._-]+$/u.test(p.coin));
  return nonzero.find((p) => p.coin === currentCoin) ??
    native.find((p) => Number(p.size) > 0) ?? native[0] ?? null;
}
// Independent decimal arithmetic for the displayed position TP estimate.
const S = 10n ** 12n;
function decimal(v) {
  assert.match(String(v), /^-?\d+(?:\.\d{1,12})?$/u);
  const sign = String(v).startsWith("-") ? -1n : 1n;
  const [a, b = ""] = String(v).replace(/^-/u, "").split(".");
  return sign * (BigInt(a) * S + BigInt(b.padEnd(12, "0")));
}
function rounded(n, d) {
  assert.ok(d > 0n);
  return (n < 0n ? -1n : 1n) * ((2n * (n < 0n ? -n : n) + d) / (2n * d));
}
function fixed(n) {
  return `${n < 0n ? "-" : ""}${(n < 0n ? -n : n) / 100n}.${String((n < 0n ? -n : n) % 100n).padStart(2, "0")}`;
}
export function expectedPositionTp({ entry, exit, size, leverage }) {
  const e = decimal(entry),
    x = decimal(exit),
    q = decimal(size),
    l = decimal(leverage);
  assert.ok(e > 0n && x > 0n && q !== 0n && l > 0n);
  const signed = (x - e) * (q > 0n ? 1n : -1n),
    profit = rounded(signed * (q < 0n ? -q : q) * 100n, S * S),
    percent = rounded(signed * l * 10000n, e * S);
  const pnl = fixed(profit),
    pct = fixed(percent).replace(/\.?0+$/u, "");
  return {
    profit: (profit < 0n ? "-$" : "$") + pnl.replace(/^-/u, ""),
    percent: pct,
  };
}
