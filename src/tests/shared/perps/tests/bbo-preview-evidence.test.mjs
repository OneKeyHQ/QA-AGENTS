import test from "node:test";
import assert from "node:assert/strict";
import {
  expectedBboAmounts,
  expectedBboLiquidation,
  assertBboNumeric,
} from "../bbo-preview-evidence.mjs";
test("BBO amount oracle separates truncated button cents from unrounded cost", () => {
  assert.deepEqual(
    expectedBboAmounts({ quantity: "2.345", price: "101.05", leverage: 10 }),
    { notional: 236.96225, margin: 23.696225, usdSecondary: "≈ $236.96" },
  );
  assert.equal(
    expectedBboAmounts({ quantity: "1.005", price: "1", leverage: 1 })
      .usdSecondary,
    "≈ $1.00",
  );
});
const base = {
  quantity: "2",
  price: "100",
  mark: "100",
  leverage: 10,
  maxLeverage: 20,
  marginMode: "isolated",
  positionSize: "0",
};
test("BBO liquidation oracle solves isolated/cross equity equations on both sides", () => {
  assertBboNumeric(
    expectedBboLiquidation({ ...base, side: "long" }),
    90 / 0.975,
    "isolated long",
  );
  assertBboNumeric(
    expectedBboLiquidation({ ...base, side: "short" }),
    110 / 1.025,
    "isolated short",
  );
  assertBboNumeric(
    expectedBboLiquidation({
      ...base,
      side: "long",
      marginMode: "cross",
      crossAvailable: "40",
    }),
    80 / 0.975,
    "cross long",
  );
});
test("BBO liquidation closes, reduces and reverses existing isolated equity", () => {
  assert.equal(
    expectedBboLiquidation({
      ...base,
      side: "short",
      positionSize: "2",
      isolatedRawUsd: "-180",
    }),
    null,
  );
  assert.equal(
    expectedBboLiquidation({ ...base, side: "long", reduceOnly: true }),
    null,
  );
  assertBboNumeric(
    expectedBboLiquidation({
      ...base,
      quantity: "3",
      side: "short",
      positionSize: "2",
      isolatedRawUsd: "-180",
    }),
    110 / 1.025,
    "reverse opens one short",
  );
});
test("BBO rational oracle rejects absent collateral and mismatched/invalid numbers", () => {
  assert.equal(
    expectedBboLiquidation({ ...base, side: "long", marginMode: "cross" }),
    null,
  );
  assert.equal(
    expectedBboLiquidation({ ...base, side: "long", positionSize: "1" }),
    null,
  );
  for (const bad of ["NaN", "Infinity", "1e4", ""])
    assert.throws(() =>
      expectedBboAmounts({ quantity: bad, price: "1", leverage: 10 }),
    );
  assert.throws(() => assertBboNumeric(101, 100, "stale value"));
  assert.throws(() => assertBboNumeric(NaN, 100, "invalid value"));
});
