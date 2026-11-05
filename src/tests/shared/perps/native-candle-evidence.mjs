import assert from "node:assert/strict";
// Independently compare closed historical bars; the current bar is mutable.
export function assertNativeCandles(actual, raw, coin, now = Date.now()) {
  assert.equal(actual.source?.kind, "hyperliquid");
  assert.equal(actual.source.coin, coin, "Canvas market identity");
  assert.equal(actual.source.environment, "mainnet");
  assert.ok(
    ["candlestick", "heikinAshi", "bars", "line", "area"].includes(
      actual.chartType,
    ),
    "Recognized actual render type required",
  );
  assert.ok(actual.seconds > 0 && Number.isFinite(actual.seconds));
  assert.ok(actual.points.length >= 10, "Loaded historical candles required");
  const byTime = new Map(actual.points.map((p) => [p.t, p]));
  assert.equal(
    byTime.size,
    actual.points.length,
    "Unique canvas bar timestamps",
  );
  const closed = raw
    .filter((p) => p.s === coin && p.T < now - actual.seconds * 1000)
    .slice(-8);
  assert.equal(closed.length, 8, "Eight independent closed candles required");
  let reference = raw;
  if (actual.chartType === "heikinAshi") {
    assert.equal(
      raw[0].t / 1000,
      actual.points[0].t,
      "Heikin Ashi requires the same historical starting bar",
    );
    let previous;
    reference = raw.map((bar) => {
      const o = previous
        ? (previous.o + previous.c) / 2
        : (Number(bar.o) + Number(bar.c)) / 2;
      const c =
        (Number(bar.o) + Number(bar.h) + Number(bar.l) + Number(bar.c)) / 4;
      previous = { o, c };
      return {
        ...bar,
        o,
        c,
        h: Math.max(Number(bar.h), o, c),
        l: Math.min(Number(bar.l), o, c),
      };
    });
  }
  const oracleByTime = new Map(reference.map((bar) => [bar.t, bar]));
  for (const rawBar of closed) {
    const bar = oracleByTime.get(rawBar.t);
    const point = byTime.get(bar.t / 1000);
    assert.ok(point, "Raw bar present in actual canvas input");
    for (const field of ["o", "h", "l", "c"])
      assert.equal(
        point[field],
        Number(bar[field]),
        `${coin} ${bar.t} ${field}`,
      );
  }
  assert.ok(
    actual.paint.width > 100 && actual.paint.height > 100,
    "Rendered canvas dimensions",
  );
  assert.ok(
    actual.paint.colors >= 20 && actual.paint.nontransparent > 100,
    "Canvas contains painted chart, not an empty bitmap",
  );
  return closed.length;
}
