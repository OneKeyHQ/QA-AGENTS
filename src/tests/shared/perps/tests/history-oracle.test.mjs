import test from "node:test";
import assert from "node:assert/strict";
import {
  historyIntersection,
  fillKey,
  assertUniqueFillKeys,
  historyFilterIdentity,
} from "../history-oracle.mjs";
const rows = [
  ["BTC", "B"],
  ["xyz:BTC", "B"],
  ["BTC", "A"],
  ["@1", "B"],
  ["@2", "A"],
].map(([coin, side], i) => ({ coin, side, tid: i }));
test("intersection retains exact DEX identity and raw buy-side semantics", () => {
  assert.deepEqual(
    historyIntersection(rows, {
      type: "perp",
      side: "long",
      market: "xyz:BTC",
    }).map(fillKey),
    ["tid:1"],
  );
  assert.deepEqual(historyIntersection(rows, { side: "long" }).map(fillKey), [
    "tid:0",
    "tid:1",
    "tid:3",
  ]);
});
test("current market follows exact active coin; fixed market remains fixed", () => {
  assert.deepEqual(
    historyIntersection(rows, { market: "active" }, "xyz:BTC").map(fillKey),
    ["tid:1"],
  );
  assert.deepEqual(
    historyIntersection(rows, { market: "BTC" }, "xyz:BTC").map(fillKey),
    ["tid:0", "tid:2"],
  );
});
test("spot aggregation spans quote currencies without dropping full raw identity", () => {
  assert.deepEqual(
    historyIntersection(rows, { market: "spot:BTC" }, "BTC", {
      "@1": "BTC/USDC",
      "@2": "BTC/USDH",
    }).map(fillKey),
    ["tid:3", "tid:4"],
  );
  assert.throws(
    () => historyIntersection(rows, { market: "spot:BTC" }),
    /metadata/,
  );
});
test("duplicate identities fail, distinct identical-looking trades remain", () => {
  assert.throws(() => assertUniqueFillKeys([rows[0], rows[0]]), /Duplicate/);
  assert.deepEqual(assertUniqueFillKeys([rows[0], rows[1]]), [
    "tid:0",
    "tid:1",
  ]);
});
test("restore compares absent and undefined market equally, retaining concrete market and side differences", () => {
  const before = { type: "all", side: "all" };
  assert.deepEqual(
    historyFilterIdentity({ ...before, market: undefined }),
    before,
  );
  assert.notDeepEqual(
    historyFilterIdentity({ ...before, market: "active" }),
    before,
  );
  assert.notDeepEqual(
    historyFilterIdentity({ ...before, market: "BTC" }),
    before,
  );
  assert.notDeepEqual(
    historyFilterIdentity({ ...before, side: "short" }),
    before,
  );
  assert.deepEqual(historyFilterIdentity({ ...before, market: "BTC" }), {
    ...before,
    market: "BTC",
  });
});

test("distinct dust conversions reuse tid=0 without becoming duplicate fills",()=>{
 const a={tid:0,dir:'Spot Dust Conversion',coin:'@142',time:1,oid:1,side:'A',px:'10',sz:'1',hash:'0x0'};
 const b={...a,coin:'@150',time:2,oid:2};
 assert.equal(assertUniqueFillKeys([a,b]).length,2);
 assert.throws(()=>assertUniqueFillKeys([a,a]),/Duplicate/);
});
