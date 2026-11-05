import test from "node:test";
import assert from "node:assert/strict";
import { expectedPositionTp, selectPreviewPosition } from "../position-tpsl-evidence.mjs";
test("TP preview can use an existing native position when current ticker has no position", () => {
  const btc = { coin: "BTC", size: "0.02194", entry: "78579.2" };
  const eth = { coin: "ETH", size: "-1", entry: "2000" };
  assert.deepEqual(selectPreviewPosition([eth, btc], "xyz:SOXL"), btc);
  assert.deepEqual(selectPreviewPosition([eth, btc], "ETH"), eth);
  assert.equal(selectPreviewPosition([], "BTC"), null);
  assert.equal(selectPreviewPosition([{ ...btc, size: "0" }], "BTC"), null);
  // Do not erase a DEX prefix to guess a native selector result.
  assert.equal(selectPreviewPosition([{ ...btc, coin: "xyz:BTC" }], "ETH"), null);
});
test("TP estimate uses position size and leverage with exact decimal rounding", () => {
  assert.deepEqual(
    expectedPositionTp({
      entry: "80392",
      exit: "81392",
      size: "0.01284",
      leverage: "17",
    }),
    { profit: "$12.84", percent: "21.15" },
  );
  assert.deepEqual(
    expectedPositionTp({
      entry: "80392",
      exit: "82392",
      size: "0.01284",
      leverage: "17",
    }),
    { profit: "$25.68", percent: "42.29" },
  );
  assert.deepEqual(
    expectedPositionTp({ entry: "100", exit: "90", size: "-2", leverage: "3" }),
    { profit: "$20.00", percent: "30" },
  );
  assert.deepEqual(
    expectedPositionTp({
      entry: "100",
      exit: "100.005",
      size: "1",
      leverage: "1",
    }),
    { profit: "$0.01", percent: "0.01" },
  );
  assert.deepEqual(
    expectedPositionTp({
      entry: "100",
      exit: "100.005",
      size: "-1",
      leverage: "1",
    }),
    { profit: "-$0.01", percent: "-0.01" },
  );
});
