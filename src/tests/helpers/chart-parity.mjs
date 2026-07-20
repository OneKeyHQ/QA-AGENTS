// Chart parity helpers
// Shared comparison utilities for built-in chart vs reference chart.

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function relativeDiffPct(actual, expected) {
  if (expected === 0) return actual === 0 ? 0 : Infinity;
  return Math.abs((actual - expected) / expected) * 100;
}

export function compareNumber(actualRaw, expectedRaw, opts = {}) {
  const actual = toNumber(actualRaw);
  const expected = toNumber(expectedRaw);
  const pctTolerance = opts.pctTolerance ?? 0.1;
  const absTolerance = opts.absTolerance ?? 0;

  if (actual === null || expected === null) {
    return { match: false, actual, expected, reason: 'non_numeric' };
  }

  const absDiff = Math.abs(actual - expected);
  const pctDiff = relativeDiffPct(actual, expected);
  const match = absDiff <= absTolerance || pctDiff <= pctTolerance;
  return { match, actual, expected, absDiff, pctDiff };
}

function normalizeBar(bar) {
  if (!bar || typeof bar !== 'object') return null;
  const time = Number(bar.time ?? bar.timestamp ?? bar.ts);
  if (!Number.isFinite(time)) return null;
  return {
    time,
    open: toNumber(bar.open ?? bar.o),
    high: toNumber(bar.high ?? bar.h),
    low: toNumber(bar.low ?? bar.l),
    close: toNumber(bar.close ?? bar.c),
    volume: toNumber(bar.volume ?? bar.v),
  };
}

function normalizeSeriesPoint(point, fallbackIndex = 0) {
  if (typeof point === 'number' || typeof point === 'string') {
    return { time: fallbackIndex, value: toNumber(point) };
  }
  if (!point || typeof point !== 'object') return null;
  const time = Number(point.time ?? point.timestamp ?? point.ts ?? fallbackIndex);
  const value = toNumber(point.value ?? point.v ?? point.y ?? point.close);
  if (value === null) return null;
  return { time: Number.isFinite(time) ? time : fallbackIndex, value };
}

function trimLast(items, count) {
  if (!Array.isArray(items)) return [];
  return items.slice(Math.max(0, items.length - count));
}

export function pickSampleIndices(length, count = 3) {
  if (!Number.isFinite(length) || length <= 0) return [];
  if (length <= count) return Array.from({ length }, (_, i) => i);
  const indices = new Set([0, length - 1]);
  while (indices.size < count) {
    const ratio = indices.size === 2 ? 0.5 : (indices.size - 1) / (count - 1);
    indices.add(Math.max(0, Math.min(length - 1, Math.round((length - 1) * ratio))));
  }
  return [...indices].sort((a, b) => a - b);
}

export function compareBarSeries(actualBarsRaw, expectedBarsRaw, opts = {}) {
  const sampleSize = opts.sampleSize ?? 20;
  const pctTolerance = opts.pctTolerance ?? 0.1;
  const volumePctTolerance = opts.volumePctTolerance ?? 1;

  const actualBars = trimLast((actualBarsRaw || []).map(normalizeBar).filter(Boolean), sampleSize);
  const expectedBars = trimLast((expectedBarsRaw || []).map(normalizeBar).filter(Boolean), sampleSize);

  if (actualBars.length === 0 || expectedBars.length === 0) {
    return { match: false, reason: 'empty_series', compared: 0, mismatches: [] };
  }
  if (actualBars.length !== expectedBars.length) {
    return {
      match: false,
      reason: 'length_mismatch',
      compared: 0,
      actualLength: actualBars.length,
      expectedLength: expectedBars.length,
      mismatches: [],
    };
  }

  const mismatches = [];
  let maxPctDiff = 0;
  for (let i = 0; i < actualBars.length; i++) {
    const actual = actualBars[i];
    const expected = expectedBars[i];
    if (actual.time !== expected.time) {
      mismatches.push({
        index: i,
        field: 'time',
        actual: actual.time,
        expected: expected.time,
      });
      continue;
    }
    for (const field of ['open', 'high', 'low', 'close']) {
      const cmp = compareNumber(actual[field], expected[field], { pctTolerance });
      if (!cmp.match) {
        mismatches.push({
          index: i,
          time: actual.time,
          field,
          actual: cmp.actual,
          expected: cmp.expected,
          pctDiff: cmp.pctDiff,
        });
      }
      if (Number.isFinite(cmp.pctDiff)) maxPctDiff = Math.max(maxPctDiff, cmp.pctDiff);
    }
    if (actual.volume !== null && expected.volume !== null) {
      const cmp = compareNumber(actual.volume, expected.volume, { pctTolerance: volumePctTolerance });
      if (!cmp.match) {
        mismatches.push({
          index: i,
          time: actual.time,
          field: 'volume',
          actual: cmp.actual,
          expected: cmp.expected,
          pctDiff: cmp.pctDiff,
        });
      }
      if (Number.isFinite(cmp.pctDiff)) maxPctDiff = Math.max(maxPctDiff, cmp.pctDiff);
    }
  }

  return {
    match: mismatches.length === 0,
    compared: actualBars.length,
    maxPctDiff,
    mismatches,
  };
}

export function compareLineSeries(actualSeriesRaw, expectedSeriesRaw, opts = {}) {
  const sampleSize = opts.sampleSize ?? 20;
  const pctTolerance = opts.pctTolerance ?? 0.5;

  const actualSeries = trimLast((actualSeriesRaw || []).map(normalizeSeriesPoint).filter(Boolean), sampleSize);
  const expectedSeries = trimLast((expectedSeriesRaw || []).map(normalizeSeriesPoint).filter(Boolean), sampleSize);

  if (actualSeries.length === 0 || expectedSeries.length === 0) {
    return { match: false, reason: 'empty_series', compared: 0, mismatches: [] };
  }
  if (actualSeries.length !== expectedSeries.length) {
    return {
      match: false,
      reason: 'length_mismatch',
      compared: 0,
      actualLength: actualSeries.length,
      expectedLength: expectedSeries.length,
      mismatches: [],
    };
  }

  const mismatches = [];
  let maxPctDiff = 0;
  for (let i = 0; i < actualSeries.length; i++) {
    const actual = actualSeries[i];
    const expected = expectedSeries[i];
    const cmp = compareNumber(actual.value, expected.value, { pctTolerance });
    if (!cmp.match) {
      mismatches.push({
        index: i,
        time: actual.time,
        actual: cmp.actual,
        expected: cmp.expected,
        pctDiff: cmp.pctDiff,
      });
    }
    if (Number.isFinite(cmp.pctDiff)) maxPctDiff = Math.max(maxPctDiff, cmp.pctDiff);
  }

  return {
    match: mismatches.length === 0,
    compared: actualSeries.length,
    maxPctDiff,
    mismatches,
  };
}

export function summarizeMismatches(label, result, maxItems = 3) {
  if (!result || result.match) {
    return `${label}: matched (${result?.compared ?? 0})`;
  }
  const items = (result.mismatches || []).slice(0, maxItems).map((item) => {
    const pct = Number.isFinite(item.pctDiff) ? ` ${item.pctDiff.toFixed(3)}%` : '';
    return `${item.field || 'value'}@${item.time ?? item.index}: ${item.actual} vs ${item.expected}${pct}`;
  });
  return `${label}: ${result.reason || 'mismatch'}; ${items.join(' | ')}`;
}
