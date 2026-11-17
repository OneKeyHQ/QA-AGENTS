import test from "node:test";
import assert from "node:assert/strict";
import {
  assertMinimumToastDisplay,
  minimumToastAmount,
  normalizeDecimal,
} from "../minimum-toast.mjs";
test("actual zh minimum title is parsed independently of action text and numeric padding", () => {
  assert.equal(
    minimumToastAmount("仓位大小必须至少 $10.00\n填入最小金额", "usd"),
    "10",
  );
  assert.equal(
    minimumToastAmount("仓位大小必须至少 0.10000 BTC\n填入最小金额", "token"),
    "0.1",
  );
  assert.equal(
    minimumToastAmount("仓位大小必须至少 $0.5900\n填入最小金额", "margin"),
    "0.59",
  );
  assert.equal(normalizeDecimal("00010.000"), "10");
});

test("minimum title checks exact decimal padding, current amount and asset independently of normalized fill", () => {
  assertMinimumToastDisplay("仓位大小必须至少 $10.00\n填入最小金额", "$10.00");
  assertMinimumToastDisplay("最小 0.10000 BTC\n填入最小金额", "0.10000 BTC");
  for (const bad of [
    "仓位大小必须至少 $10",
    "仓位大小必须至少 $10.000",
    "仓位大小必须至少 $11.00",
    "仓位大小必须至少 $10.00 USD",
    "仓位大小必须至少 0.10000 ETH",
    "填入最小金额",
  ])
    assert.throws(() => assertMinimumToastDisplay(bad, "$10.00"));
  assert.throws(() => assertMinimumToastDisplay("最小 0.1 BTC", "0.10000 BTC"));
  assert.throws(() =>
    assertMinimumToastDisplay("最小 0.10000 ETH", "0.10000 BTC"),
  );
});
test("action alone, wrong unit, negative/nonfinite/missing amounts fail", () => {
  for (const text of [
    "填入最小金额",
    "仓位大小必须至少 $-10",
    "仓位大小必须至少 NaN",
    "仓位大小必须至少 $Infinity",
  ])
    assert.throws(() => minimumToastAmount(text, "usd"));
  assert.throws(() => minimumToastAmount("仓位大小必须至少 $10", "token"));
  assert.throws(() => minimumToastAmount("仓位大小必须至少 0.1 ETH", "token"));
  assert.throws(() => minimumToastAmount("仓位大小必须至少 10 BTC", "usd"));
});
