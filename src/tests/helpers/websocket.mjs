import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep } from './constants.mjs';

const WS_MONITOR_PATH = resolve(
  import.meta.dirname,
  '../../../docs/skills/scripts/inject/websocket-monitor.js',
);
const WS_MONITOR_SOURCE = readFileSync(WS_MONITOR_PATH, 'utf-8');

async function ensureMonitorOnCurrentPage(page) {
  const ready = await page.evaluate(() => typeof window.__wsMonitor?.getReport === 'function').catch(() => false);
  if (ready) return;
  await page.evaluate((source) => {
    // The monitor guards against duplicate injection via window.__wsMonitor.
    (0, eval)(source);
  }, WS_MONITOR_SOURCE);
}

export async function installWsMonitor(page) {
  await page.context().addInitScript({ content: WS_MONITOR_SOURCE });
  await ensureMonitorOnCurrentPage(page);
}

export async function clearWsMonitor(page) {
  await ensureMonitorOnCurrentPage(page);
  await page.evaluate(() => window.__wsMonitor.clear());
}

export async function getWsReport(page) {
  await ensureMonitorOnCurrentPage(page);
  return page.evaluate(() => window.__wsMonitor.getReport());
}

export async function getWsMessages(page, limit = 20) {
  await ensureMonitorOnCurrentPage(page);
  return page.evaluate((size) => window.__wsMonitor.getMessages(size), limit);
}

export async function waitForWsActivity(page, {
  timeout = 15000,
  interval = 500,
  minConnections = 1,
  minMessages = 1,
} = {}) {
  const start = Date.now();
  let lastReport = null;

  while (Date.now() - start < timeout) {
    lastReport = await getWsReport(page).catch(() => null);
    if (
      lastReport
      && lastReport.connections?.total >= minConnections
      && lastReport.messages?.total >= minMessages
    ) {
      return lastReport;
    }
    await sleep(interval);
  }

  throw new Error(`WS activity timeout: ${JSON.stringify(lastReport)}`);
}
