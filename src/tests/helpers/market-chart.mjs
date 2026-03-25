// Shared Market Chart helpers
// Extracted from web/market/chart.test.mjs for cross-platform reuse.
// TradingView chart structure is identical across Desktop / Web / Extension:
//   page → tradingview.onekey.so (or .onekeytest.com) iframe → blob: iframe

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

import { createStepTracker, safeStep } from './components.mjs';
import { screenshot } from './index.mjs';

export { createStepTracker, safeStep, screenshot };

// ── TradingView Frame Access ─────────────────────────────────

/**
 * Locate the TradingView blob: iframe inside the page.
 * Handles both tradingview.onekey.so (prod/desktop/extension)
 * and tradingview.onekeytest.com (web test env).
 */
export async function getTVFrame(page) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const frames = page.frames();
    // blob:https://tradingview.onekey... (prod or test domain)
    const blobFrame = frames.find(f => /^blob:https:\/\/tradingview\.onekey/.test(f.url()));
    if (blobFrame) {
      const hasButtons = await blobFrame.evaluate(() =>
        document.querySelectorAll('button').length > 0
      ).catch(() => false);
      if (hasButtons) return blobFrame;
    }
    await sleep(500);
  }
  throw new Error('TradingView iframe not found after 30s');
}

export async function waitForChartReady(page) {
  const tvFrame = await getTVFrame(page);
  for (let i = 0; i < 30; i++) {
    const canvasCount = await tvFrame.evaluate(() =>
      document.querySelectorAll('canvas').length
    ).catch(() => 0);
    if (canvasCount > 0) return tvFrame;
    await sleep(500);
  }
  throw new Error('Chart canvas not rendered within 15s');
}

// ── TradingView Control Helpers ──────────────────────────────

// aria-label is more stable than textContent (which can have duplicates)
export const INTERVAL_ARIA_MAP = {
  '1m': '1 分钟',
  '15m': '15 分钟',
  '1h': '1 小时',
  '4h': '4 小时',
  'D': '1 日',
};

export async function clickTimeInterval(tvFrame, interval) {
  const ariaLabel = INTERVAL_ARIA_MAP[interval];
  if (!ariaLabel) throw new Error(`Unknown interval: ${interval}`);

  await tvFrame.evaluate((label) => {
    const buttons = document.querySelectorAll(`button[aria-label="${label}"]`);
    if (buttons.length === 0) throw new Error(`Interval button [aria-label="${label}"] not found`);
    buttons[0].click();
  }, ariaLabel);
  await sleep(2000);
}

export async function clickIndicatorButton(tvFrame) {
  await tvFrame.evaluate(() => {
    const btn = document.querySelector('button[aria-label="指标 & 策略"]')
      || document.querySelector('button[aria-label="指标"]');
    if (!btn) {
      for (const b of document.querySelectorAll('button')) {
        if (b.textContent?.trim() === '指标') { b.click(); return; }
      }
      throw new Error('Indicator button not found');
    }
    btn.click();
  });
  await sleep(1500);
}

export async function getOHLCFromChart(tvFrame) {
  const ohlc = await tvFrame.evaluate(() => {
    const text = document.body.innerText || '';
    const match = text.match(/O\s*([\d,.]+)\s*H\s*([\d,.]+)\s*L\s*([\d,.]+)\s*C\s*([\d,.]+)/);
    if (match) {
      return {
        O: parseFloat(match[1].replace(/,/g, '')),
        H: parseFloat(match[2].replace(/,/g, '')),
        L: parseFloat(match[3].replace(/,/g, '')),
        C: parseFloat(match[4].replace(/,/g, '')),
      };
    }
    return null;
  });
  return ohlc;
}

export async function getCanvasCount(tvFrame) {
  return tvFrame.evaluate(() => document.querySelectorAll('canvas').length);
}

export async function getIndicatorLabels(tvFrame) {
  return tvFrame.evaluate(() => {
    const labels = [];
    document.querySelectorAll('*').forEach(el => {
      const txt = el.textContent?.trim();
      if (txt && /^(MA|EMA|SMA|MACD|RSI|BOLL|Volume|Vol)/.test(txt) && el.children.length < 3) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.height < 30) {
          labels.push(txt.substring(0, 50));
        }
      }
    });
    return [...new Set(labels)];
  });
}

// ── API Data Fetchers ────────────────────────────────────────

export async function fetchHyperliquidOHLC(symbol, interval) {
  const intervalMap = { '1m': '1m', '15m': '15m', '1h': '1h', '4h': '4h', 'D': '1d' };
  const hlInterval = intervalMap[interval] || '1h';
  const end = Date.now();
  const start = end - 2 * 60 * 60 * 1000;

  try {
    const resp = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'candleSnapshot',
        req: { coin: symbol, interval: hlInterval, startTime: start, endTime: end },
      }),
    });
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const last = data[data.length - 1];
    return {
      O: parseFloat(last.o),
      H: parseFloat(last.h),
      L: parseFloat(last.l),
      C: parseFloat(last.c),
      source: 'hyperliquid',
    };
  } catch (e) {
    console.log(`  [WARN] Hyperliquid API failed: ${e.message}`);
    return null;
  }
}

export async function fetchOKXOHLC(symbol, interval) {
  const intervalMap = { '1m': '1m', '15m': '15m', '1h': '1H', '4h': '4H', 'D': '1D' };
  const okxInterval = intervalMap[interval] || '1H';
  const instId = `${symbol}-USDT`;

  try {
    const resp = await fetch(
      `https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=${okxInterval}&limit=1`
    );
    const data = await resp.json();
    if (data.code !== '0' || !data.data?.[0]) return null;
    const [ts, o, h, l, c] = data.data[0];
    return {
      O: parseFloat(o),
      H: parseFloat(h),
      L: parseFloat(l),
      C: parseFloat(c),
      source: 'okx',
    };
  } catch (e) {
    console.log(`  [WARN] OKX API failed: ${e.message}`);
    return null;
  }
}

export function compareOHLC(chartOHLC, refOHLC, tolerancePct = 0.5) {
  if (!chartOHLC || !refOHLC) return { match: false, reason: 'Missing data' };
  const diffs = {};
  let maxDiff = 0;
  for (const key of ['O', 'H', 'L', 'C']) {
    const chartVal = chartOHLC[key];
    const refVal = refOHLC[key];
    if (!chartVal || !refVal) continue;
    const pctDiff = Math.abs((chartVal - refVal) / refVal) * 100;
    diffs[key] = `${pctDiff.toFixed(3)}%`;
    maxDiff = Math.max(maxDiff, pctDiff);
  }
  return {
    match: maxDiff <= tolerancePct,
    maxDiff: `${maxDiff.toFixed(3)}%`,
    diffs,
  };
}
