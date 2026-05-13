// Market Chart Tests (Extension) — EXT-MARKET-CHART-001 ~ EXT-MARKET-CHART-003
// Thin wrapper: test logic lives in src/tests/shared/market/chart.mjs
// Connects via CDP using connectExtensionCDP (Chrome with extension loaded).

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep } from '../../helpers/constants.mjs';
import { screenshot } from '../../helpers/market-chart.mjs';
import { connectExtensionCDP, getExtensionId } from '../../helpers/extension-cdp.mjs';
import { createWebMarketChartTests } from '../../shared/market/chart.mjs';

const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'ext-market-chart');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Platform-specific Navigation ─────────────────────────────

async function goToMarket(page) {
  const extId = getExtensionId();
  const url = page.url();

  // If already on a market-like view inside the extension, skip
  if (url.includes('/market') && url.includes(extId)) return;

  // Try sidebar navigation first
  const navigated = await page.evaluate(() => {
    const candidates = document.querySelectorAll('a, button, [role="tab"], [role="menuitem"]');
    for (const el of candidates) {
      const txt = (el.textContent || '').trim();
      const href = el.getAttribute('href') || '';
      if (txt === '市场' || txt === 'Market' || href.includes('/market')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          el.click();
          return true;
        }
      }
    }
    return false;
  });

  if (navigated) {
    await sleep(3000);
    return;
  }

  // Fallback: direct URL navigation within extension
  await page.goto(`chrome-extension://${extId}/ui-expand-tab.html#/market`);
  await sleep(3000);
}

/**
 * Navigate to token detail page in the extension.
 * Uses data-testid="list-column-name" cells to find and click the token row.
 */
async function navigateToTokenDetail(page, tokenSymbol) {
  await goToMarket(page);
  await sleep(2000);

  const clicked = await page.evaluate((sym) => {
    const cells = document.querySelectorAll('[data-testid="list-column-name"]');
    for (const cell of cells) {
      const r = cell.getBoundingClientRect();
      if (r.width === 0 || r.height < 30 || r.y < 60) continue;
      const text = cell.textContent || '';
      const re = new RegExp(`(^|\\s)${sym}(\\s|$|[^A-Za-z0-9])`);
      if (re.test(text)) {
        cell.click();
        return true;
      }
    }
    return false;
  }, tokenSymbol);

  if (!clicked) throw new Error(`Token ${tokenSymbol} not found in Market list`);
  await sleep(3000);
}

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = '图表';

const { testCases } = createWebMarketChartTests({
  prefix: 'EXT-MARKET-CHART',
  namePrefix: 'Ext-',
  navigateToTokenDetail,
  screenshotDir: SCREENSHOT_DIR,
});

export { testCases };

export async function setup(page) {
  await goToMarket(page);
}

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('EXT-MARKET-CHART-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { browser, page } = await connectExtensionCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Market Chart Tests (Extension) — ${casesToRun.length} case(s)`);
  console.log('='.repeat(60));

  const results = [];
  await setup(page);

  for (const test of casesToRun) {
    const startTime = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${test.id}] ${test.name}`);
    console.log('─'.repeat(60));

    try {
      if (page?.isClosed?.()) {
        console.log('  Page was closed, reconnecting CDP...');
        ({ browser, page } = await connectExtensionCDP());
        await setup(page);
      }
      // Reset state between tests
      await page.keyboard.press('Escape').catch(() => {});
      await sleep(300);
      await goToMarket(page);

      const result = await test.fn(page);
      const duration = Date.now() - startTime;
      const r = {
        testId: test.id,
        status: result.status,
        duration,
        steps: result.steps,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      };
      console.log(`>> ${test.id}: ${r.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s)`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    } catch (error) {
      const duration = Date.now() - startTime;
      const r = {
        testId: test.id,
        status: 'failed',
        duration,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
      console.error(`>> ${test.id}: FAILED (${(duration / 1000).toFixed(1)}s) — ${error.message}`);
      if (page && !page?.isClosed?.()) {
        await screenshot(page, SCREENSHOT_DIR, `${test.id}-error`);
      }
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }

    await sleep(800);
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));

  const summary = { timestamp: new Date().toISOString(), total: results.length, passed, failed, results };
  writeFileSync(resolve(RESULTS_DIR, 'ext-market-chart-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
