import assert from "node:assert/strict";

export function assertMinimumToastDisplay(text, expectedAmountLabel) {
  assert.match(
    expectedAmountLabel,
    /^(?:\$\d+\.\d{2}|\d+\.\d+ [A-Za-z0-9]+)$/u,
  );
  const header = text.split("\n")[0].trim();
  assert.ok(
    [
      `仓位大小必须至少 ${expectedAmountLabel}`,
      `最小 ${expectedAmountLabel}`,
    ].includes(header),
    `Minimum title must preserve the independently calculated amount, unit and precision: ${header}`,
  );
  return header;
}
export function normalizeDecimal(value) {
  assert.match(value, /^\d+(?:\.\d+)?$/u, "Plain decimal amount required");
  const [whole, fraction = ""] = value.split(".");
  const w = whole.replace(/^0+(?=\d)/u, "");
  const f = fraction.replace(/0+$/u, "");
  return f ? `${w}.${f}` : w;
}
export function minimumToastAmount(text, unit, symbol = "BTC") {
  const header = text.split("\n")[0].replaceAll(",", "").trim();
  const match = header.match(
    /(?:至少|最小(?:金额)?(?:为)?)\s*(\$)?\s*(\d+(?:\.\d+)?)\s*([^\d\s]*)/u,
  );
  assert.ok(match, "Fresh minimum notice must contain an explicit amount");
  if (unit === "token") {
    assert.equal(match[1], undefined, "Token shortcut uses token units");
    assert.equal(match[3], symbol, "Token symbol matches current instrument");
  } else {
    assert.equal(match[1], "$", "USD and cost shortcuts show dollar amount");
    assert.ok(!match[3], "No unrelated unit after dollar amount");
  }
  assert.ok(Number(match[2]) > 0, "Minimum amount is positive");
  return normalizeDecimal(match[2]);
}
