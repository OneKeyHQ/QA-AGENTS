import assert from "node:assert/strict";
// Chart libraries create separate plot, axes and overlay canvases. All may
// share one React owner; the last canvas is often the tiny axis intersection.
export function coherentChartProjection(data) {
  const rows = data.filter(Boolean);
  if (!rows.length) return null;
  const series = new Set(
    rows.map(({ rect, ...value }) => JSON.stringify(value)),
  );
  assert.equal(series.size, 1, "One coherent visible chart series");
  const s = rows.reduce((largest, row) =>
    row.rect.width * row.rect.height > largest.rect.width * largest.rect.height
      ? row
      : largest,
  );
  assert.ok(
    s.rect.width > 50 && s.rect.height > 50,
    "Visible main plot canvas exceeds 50px on both axes",
  );
  assert.ok(
    s.data.every(
      (r) =>
        Array.isArray(r) &&
        r.length >= 2 &&
        Number.isFinite(r[0]) &&
        Number.isFinite(r[1]),
    ),
    "Finite chart time/value pairs",
  );
  return s;
}
