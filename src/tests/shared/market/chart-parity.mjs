// Market Chart Parity — PoC shared logic
// Compares built-in chart hooks against TradingView hooks on the same harness page.

import { createStepTracker, safeStep } from '../../helpers/components.mjs';
import { sleep } from '../../helpers/constants.mjs';
import { createBuiltInChartAdapter } from '../../helpers/chart-adapters/builtin.mjs';
import { createTradingViewHookAdapter } from '../../helpers/chart-adapters/tradingview.mjs';
import {
  compareBarSeries,
  compareLineSeries,
  compareNumber,
  pickSampleIndices,
  summarizeMismatches,
} from '../../helpers/chart-parity.mjs';

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeMacdSeries(series) {
  if (!series) return null;
  if (Array.isArray(series)) return { line: series };
  if (!isObject(series)) return null;
  return {
    line: Array.isArray(series.line) ? series.line : [],
    signal: Array.isArray(series.signal) ? series.signal : [],
    histogram: Array.isArray(series.histogram) ? series.histogram : [],
  };
}

export function createWebMarketChartParityTests({
  prefix = 'MARKET-CHART-PARITY',
  namePrefix = '',
  navigateToParityHarness,
  screenshotDir,
  requireHooks = process.env.CHART_PARITY_REQUIRED === '1',
}) {
  const _safeStep = (page, t, name, fn) =>
    safeStep(page, t, name, fn, screenshotDir);

  async function testParity001(page) {
    const t = createStepTracker(`${prefix}-001`);

    await _safeStep(page, t, '进入图表对照 Harness 页面', async () => {
      await navigateToParityHarness(page);
      return 'harness opened';
    });

    const builtIn = createBuiltInChartAdapter(page);
    const tv = createTradingViewHookAdapter(page);
    const builtInExists = await builtIn.hasHook();
    const tvExists = await tv.hasHook();
    if (!builtInExists || !tvExists) {
      const reason = `missing hook: built-in=${builtInExists}, tv=${tvExists}`;
      if (requireHooks) {
        t.add('检测图表对比 hooks', 'failed', reason);
      } else {
        t.skip('检测图表对比 hooks', `${reason}; 当前仅落 PoC 骨架，待页面接入 window.__chartTest / window.__tvTest`);
      }
      return t.result();
    }

    await _safeStep(page, t, '等待 BuiltIn / TradingView hooks ready', async () => {
      const [builtMeta, tvMeta] = await Promise.all([
        builtIn.waitForReady(15000),
        tv.waitForReady(15000),
      ]);
      return `builtIn=${JSON.stringify(builtMeta)} | tv=${JSON.stringify(tvMeta)}`;
    });

    await _safeStep(page, t, '统一分辨率为 15m', async () => {
      await Promise.all([
        builtIn.setResolution('15m'),
        tv.setResolution('15m'),
      ]);
      await sleep(1000);
      return 'resolution=15m';
    });

    let builtBars = [];
    let tvBars = [];
    await _safeStep(page, t, '最近 20 根已收盘 bars 对比', async () => {
      [builtBars, tvBars] = await Promise.all([
        builtIn.getBars({ resolution: '15m', limit: 20, closedOnly: true }),
        tv.getBars({ resolution: '15m', limit: 20, closedOnly: true }),
      ]);
      const cmp = compareBarSeries(builtBars, tvBars, {
        sampleSize: 20,
        pctTolerance: 0.1,
        volumePctTolerance: 1,
      });
      if (!cmp.match) throw new Error(summarizeMismatches('bars', cmp));
      return `bars matched: ${cmp.compared}, maxDiff=${cmp.maxPctDiff.toFixed(3)}%`;
    });

    await _safeStep(page, t, 'MACD 序列对比（line / signal / histogram）', async () => {
      const [builtRaw, tvRaw] = await Promise.all([
        builtIn.getIndicatorSeries('MACD', { fast: 12, slow: 26, signal: 9, limit: 20 }),
        tv.getIndicatorSeries('MACD', { fast: 12, slow: 26, signal: 9, limit: 20 }),
      ]);
      const builtMacd = normalizeMacdSeries(builtRaw);
      const tvMacd = normalizeMacdSeries(tvRaw);
      if (!builtMacd || !tvMacd) return 'SKIP: MACD series not exposed by hook';

      const lines = [
        ['line', builtMacd.line, tvMacd.line],
        ['signal', builtMacd.signal, tvMacd.signal],
        ['histogram', builtMacd.histogram, tvMacd.histogram],
      ];

      const summaries = [];
      for (const [label, builtSeries, tvSeries] of lines) {
        if (!builtSeries?.length || !tvSeries?.length) {
          summaries.push(`${label}: skip`);
          continue;
        }
        const cmp = compareLineSeries(builtSeries, tvSeries, { sampleSize: 20, pctTolerance: 0.5 });
        if (!cmp.match) throw new Error(summarizeMismatches(`MACD.${label}`, cmp));
        summaries.push(`${label}: ok (${cmp.compared})`);
      }
      return summaries.join(' | ');
    });

    await _safeStep(page, t, 'Crosshair 采样点对比（3 points）', async () => {
      const sampleIndices = pickSampleIndices(Math.min(builtBars.length, tvBars.length), 3);
      if (sampleIndices.length === 0) return 'SKIP: no sampled bars';

      const summaries = [];
      for (const sampleIndex of sampleIndices) {
        await Promise.all([
          builtIn.moveCrosshairToIndex(sampleIndex),
          tv.moveCrosshairToIndex(sampleIndex),
        ]);
        await sleep(150);

        const [builtSnap, tvSnap] = await Promise.all([
          builtIn.getCrosshairSnapshot(),
          tv.getCrosshairSnapshot(),
        ]);
        if (!builtSnap || !tvSnap) return `SKIP: crosshair snapshot missing at index ${sampleIndex}`;

        const fields = ['open', 'high', 'low', 'close'];
        for (const field of fields) {
          const cmp = compareNumber(builtSnap[field], tvSnap[field], { pctTolerance: 0.1 });
          if (!cmp.match) {
            throw new Error(`crosshair ${field}@${sampleIndex}: ${cmp.actual} vs ${cmp.expected}`);
          }
        }
        summaries.push(`idx=${sampleIndex} t=${builtSnap.time ?? builtSnap.timestamp ?? 'n/a'}`);
      }
      return summaries.join(' | ');
    });

    return t.result();
  }

  const testCases = [
    {
      id: `${prefix}-001`,
      name: `${namePrefix}Market-内置图表-TradingView对比-PoC`,
      fn: testParity001,
    },
  ];

  return { testCases };
}
