import test from "node:test";
import assert from "node:assert/strict";
import { assertNativeCandles } from "../native-candle-evidence.mjs";
const make = () => ({
  source: { kind: "hyperliquid", coin: "BTC", environment: "mainnet" },
  seconds: 60,
  chartType: "candlestick",
  points: Array.from({ length: 10 }, (_, i) => ({
    t: i * 60,
    o: 2,
    h: 4,
    l: 1,
    c: 3,
  })),
  paint: { width: 700, height: 400, colors: 24, nontransparent: 10000 },
});
const raw = Array.from({ length: 10 }, (_, i) => ({
  s: "BTC",
  t: i * 60000,
  T: (i + 1) * 60000 - 1,
  o: "2",
  h: "4",
  l: "1",
  c: "3",
}));
test("native chart requires independent closed-bar match and actual painted bitmap", () => {
  assert.equal(assertNativeCandles(make(), raw, "BTC", 800000), 8);
  for (const change of [
    (a) => (a.source.coin = "ETH"),
    (a) => (a.points[5].c = 999),
    (a) => a.points.splice(5, 1),
    (a) => (a.paint.colors = 1),
    (a) => (a.paint.nontransparent = 0),
  ]) {
    const a = make();
    change(a);
    assert.throws(() => assertNativeCandles(a, raw, "BTC", 800000));
  }
});

test("Heikin Ashi closes use independent OHLC means and recursive opens", () => {
  const a = make();
  a.chartType = "heikinAshi";
  a.points = a.points.map((p, i) => ({ ...p, o: 2.5, c: 2.5 }));
  assert.equal(assertNativeCandles(a, raw, "BTC", 800000), 8);
  a.points[5].c = 3;
  assert.throws(() => assertNativeCandles(a, raw, "BTC", 800000));
});
