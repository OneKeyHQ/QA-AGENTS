import test from "node:test";
import assert from "node:assert/strict";
import { coherentChartProjection } from "../chart-projection.mjs";
const row = (width, height, patch = {}) => ({
  data: [[1, 2]],
  series: "baseline",
  rect: { width, height },
  ...patch,
});
test("real plot/overlay/48px Y axis/28px X axis/shared corner choose plot regardless of DOM order", () => {
  const rows = [
    row(508, 452),
    row(508, 452),
    row(48, 452),
    row(48, 452),
    row(508, 28),
    row(508, 28),
    row(48, 28),
  ];
  for (const items of [rows, [...rows].reverse()])
    assert.deepEqual(coherentChartProjection(items).rect, {
      width: 508,
      height: 452,
    });
});
test("missing plot, conflicting chart data/config and nonfinite points fail", () => {
  assert.equal(coherentChartProjection([null]), null);
  assert.throws(() => coherentChartProjection([row(48, 452)]), /main plot/);
  for (const patch of [
    { series: "histogram" },
    { data: [[1, 3]] },
    { baseline: { baseValue: { price: 1 } } },
  ])
    assert.throws(
      () => coherentChartProjection([row(508, 452), row(48, 28, patch)]),
      /coherent/,
    );
  assert.throws(
    () => coherentChartProjection([row(508, 452, { data: [[1, NaN]] })]),
    /Finite/,
  );
});
