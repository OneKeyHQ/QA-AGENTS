// D04 手动用例：docs/qa/testcases/cases/perps/2026-01-21_Perps-TV图表功能与设置.md
// Desktop native chart evidence uses the real canvas, committed market inputs,
// independent public closed candles, and an actual Electron shell refresh.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { RESULTS_DIR } from "../../helpers/index.mjs";
import { locator, setChartMode, currentPair } from "../../helpers/perps-ui.mjs";
import { projectReactAll } from "./react-projection.mjs";
import { createDesktopRowSuite } from "./desktop-row-suite.mjs";
import { closePop, pollForm } from "./non-order-ui.mjs";
import { reloadPerps, markRestoreFailure } from "./runtime.mjs";
import { recordBeforeRestore } from "./restore-diagnostics.mjs";
import { PerpsPage } from "../../helpers/pages/perps.mjs";
import { waitInstrumentBoundary } from "./instrument-readiness.mjs";
import { assertNativeCandles } from "./native-candle-evidence.mjs";
const canvas = (p) => locator(p, "perps.chart.native_canvas");
export async function readNativeChartSnapshot(p) {
  assert.equal(await canvas(p).count(), 1, "Exactly one visible native chart");
  const [state] = await projectReactAll(canvas(p), (f, e) => {
    let source, chart;
    for (; f; f = f.return) {
      const props = f.memoizedProps;
      if (
        !chart &&
        Array.isArray(props?.points) &&
        props?.candleIntervalSeconds
      )
        chart = {
          points: props.points,
          seconds: props.candleIntervalSeconds,
          chartType: props.chartType,
        };
      if (!source && props?.source?.kind) source = props.source;
    }
    if (!chart || !source)
      throw Error("Committed canvas market and candle inputs required");
    const context = e.getContext("2d");
    if (!context) throw Error("Actual canvas context required");
    const image = context.getImageData(0, 0, e.width, e.height),
      colors = new Set();
    let nontransparent = 0;
    for (let y = 0; y < e.height; y += 4)
      for (let x = 0; x < e.width; x += 4) {
        const i = (y * e.width + x) * 4;
        if (image.data[i + 3]) {
          nontransparent++;
          colors.add(image.data.slice(i, i + 4).join(","));
        }
      }
    return {
      ...chart,
      source,
      paint: {
        width: e.width,
        height: e.height,
        colors: colors.size,
        nontransparent,
      },
    };
  });
  return state;
}
async function evidence(p, label) {
  const pair = await currentPair(p);
  const instrument = await waitInstrumentBoundary(
    p,
    pair,
    locator(p, "perps.form.root"),
  );
  const coin = instrument.instruments[0].coin;
  const actual = await pollForm(
    () => readNativeChartSnapshot(p),
    (s) => s.points.length >= 10 && s.paint.colors >= 20,
    "Native candles and actual bitmap loaded",
    30000,
  );
  assert.equal(
    actual.source.coin,
    coin,
    "Native canvas must match the independently settled form market",
  );
  const interval = {
    60: "1m",
    180: "3m",
    300: "5m",
    900: "15m",
    1800: "30m",
    3600: "1h",
    7200: "2h",
    14400: "4h",
    28800: "8h",
    43200: "12h",
    86400: "1d",
    259200: "3d",
    604800: "1w",
    2592000: "1M",
  }[actual.seconds];
  assert.ok(interval, `Supported native interval ${actual.seconds}`);
  const now = Date.now(),
    request = {
      type: "candleSnapshot",
      req: {
        coin: actual.source.coin,
        interval,
        startTime: actual.points[0].t * 1000,
        endTime: now,
      },
    };
  const response = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(response.status, 200, "Independent public candle response");
  const raw = await response.json();
  let matched;
  const dir = resolve(RESULTS_DIR, "perps-desktop-completion");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    resolve(dir, `native-${label}.json`),
    JSON.stringify(
      { at: new Date().toISOString(), request, raw, actual, matched },
      null,
      2,
    ),
  );
  matched = assertNativeCandles(actual, raw, coin, now);
  await canvas(p).screenshot({ path: resolve(dir, `native-${label}.png`) });
  return actual;
}
async function withNative(p, check) {
  await closePop(p);
  const engine = (await locator(p, "perps.chart.engine").innerText()).includes(
    "TradingView",
  )
    ? "tradingView"
    : "native";
  let primary;
  try {
    await setChartMode(p, "native");
    await canvas(p).waitFor({ state: "visible", timeout: 30000 });
    return await check();
  } catch (error) {
    primary = error;
    await recordBeforeRestore(p, "native", error);
    throw error;
  } finally {
    try {
      await closePop(p);
      await setChartMode(p, engine);
      assert.equal(
        (await locator(p, "perps.chart.engine").innerText()).includes(
          "TradingView",
        ),
        engine === "tradingView",
      );
    } catch (error) {
      throw markRestoreFailure(primary, error, "恢复原图表引擎");
    }
  }
}
export const nativeDefinitions = [
  {
    id: "PERPS-DESKTOP-NATIVE-001",
    name: "Desktop 原生图真实刷新与独立行情对账",
    rows: [
      {
        ids: ["D04-191"],
        name: "原生图真实刷新、当前市场八根K线与实际绘制",
        check: (p) =>
          withNative(p, async () => {
            const pair = await currentPair(p),
              before = await evidence(p, "before-reload");
            await reloadPerps(p, {
              navigate: () => new PerpsPage(p).navigate(),
              ready: () =>
                canvas(p).waitFor({ state: "visible", timeout: 30000 }),
            });
            assert.ok(
              !(await locator(p, "perps.chart.engine").innerText()).includes(
                "TradingView",
              ),
              "Native engine persisted",
            );
            assert.equal(await currentPair(p), pair);
            const after = await evidence(p, "after-reload");
            assert.deepEqual(
              after.source,
              before.source,
              "Same actual chart market after real reload",
            );
            assert.equal(
              await p.locator("webview").filter({ visible: true }).count(),
              0,
              "No visible TradingView webview",
            );
            return `原生版真实shell刷新保持${pair}；前后实际画布已绘制，市场身份一致，各8根已收盘OHLC与独立公开行情精确对账`;
          }),
      },
    ],
  },
];
export const nativeSuite = createDesktopRowSuite(nativeDefinitions);

export { withNative as withNativeChart };
