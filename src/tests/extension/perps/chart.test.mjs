// Perps TV Chart Tests (Extension) — EXT-PERPS-CHART-001 ~ EXT-PERPS-CHART-008
// Thin wrapper: test logic lives in src/tests/shared/perps/chart.mjs
// Connects via CDP port 9224 using connectExtensionCDP.
//
// TV chart access on Extension: TradingView lives in a normal iframe (same as
// Web). We locate the frame via page.frames() and use frame.evaluate() — no
// Electron <webview> indirection needed.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep } from '../../helpers/constants.mjs';
import { connectExtensionCDP, getExtensionId } from '../../helpers/extension-cdp.mjs';
import { createChartTests } from '../../shared/perps/chart.mjs';

const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'ext-perps-chart');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Platform-specific TV access (iframe via page.frames()) ───────

/**
 * Find the TradingView iframe (by URL substring) and run JS inside it.
 * Extension: same as Web — TV chart is a normal iframe, not a <webview>.
 */
async function tvEval(page, jsCode) {
  const matches = (frame) => {
    const url = (frame.url() || '').toLowerCase();
    return url.includes('tradingview') || url.includes('tv-embed') || url.startsWith('blob:');
  };

  for (let i = 0; i < 10; i++) {
    const candidates = page.frames().filter(matches);
    if (candidates.length > 0) {
      const frame = candidates[0];
      try {
        return await frame.evaluate((code) => {
          const doc = document;
          // eslint-disable-next-line no-new-func
          return new Function('doc', `${code}`)(doc);
        }, jsCode);
      } catch (e) {
        if (i === 9) throw e;
      }
    }
    await sleep(500);
  }
  throw new Error('TV iframe not found (no frame URL matches tradingview/tv-embed/blob:)');
}

async function screenshotExt(page, name) {
  try {
    const path = `${SCREENSHOT_DIR}/${name}.png`;
    await page.screenshot({ path });
  } catch {}
}

// ── Platform-specific Navigation ─────────────────────────────────

/** Navigate to perps page via sidebar or extension URL fallback */
async function goToPerps(page) {
  const clicked = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="perp"]');
    if (el) { el.click(); return true; }
    const container = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
    if (container) {
      for (const sp of container.querySelectorAll('span')) {
        if (['合约', 'Perps'].includes(sp.textContent.trim()) && sp.getBoundingClientRect().width > 0) {
          sp.click(); return true;
        }
      }
    }
    for (const el of document.querySelectorAll('a, button, [role="tab"], [role="menuitem"]')) {
      const text = el.textContent?.trim();
      if (['合约', 'Perps'].includes(text)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          el.click(); return true;
        }
      }
    }
    return false;
  });
  if (!clicked) {
    const extId = getExtensionId();
    await page.goto(`chrome-extension://${extId}/ui-expand-tab.html#/swap`);
    await sleep(3000);
    const retry = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="perp"]');
      if (el) { el.click(); return true; }
      for (const sp of document.querySelectorAll('span')) {
        if (['合约', 'Perps'].includes(sp.textContent?.trim())) {
          const r = sp.getBoundingClientRect();
          if (r.width > 0) { sp.click(); return true; }
        }
      }
      return false;
    });
    if (!retry) throw new Error('Cannot navigate to perps page (extension)');
  }
  await sleep(3000);
}

// ── Test Cases (from shared module) ──────────────────────────────

export const displayName = '图表';

const { testCases, setup, ALL_TEST_IDS } = createChartTests({
  prefix: 'EXT-PERPS',
  namePrefix: 'Ext-',
  goToPerps,
  tvEval,
  screenshotDir: SCREENSHOT_DIR,
  canSwitchAccount: false,
});

export { testCases, setup, ALL_TEST_IDS };

// ── Main (CLI Runner) ────────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('EXT-PERPS-CHART-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { browser, page } = await connectExtensionCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Perps TV Chart Tests (Extension) — ${casesToRun.length} case(s)`);
  console.log('='.repeat(60));

  await setup(page);

  const results = [];
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

      const result = await test.fn(page);
      const duration = Date.now() - startTime;
      const r = {
        testId: test.id, status: result.status, duration,
        steps: result.steps, errors: result.errors,
        timestamp: new Date().toISOString(),
      };
      console.log(`>> ${test.id}: ${r.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s)`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    } catch (error) {
      const duration = Date.now() - startTime;
      const r = {
        testId: test.id, status: 'failed', duration,
        error: error.message, timestamp: new Date().toISOString(),
      };
      console.error(`>> ${test.id}: FAILED (${(duration / 1000).toFixed(1)}s) — ${error.message}`);
      if (page && !page?.isClosed?.()) {
        await screenshotExt(page, `${test.id}-error`);
      }
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }

    await sleep(1000);
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));
  results.forEach(r => {
    const icon = r.status === 'passed' ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] ${r.testId} (${(r.duration / 1000).toFixed(1)}s)${r.error ? ' — ' + r.error : ''}`);
  });

  const summary = { timestamp: new Date().toISOString(), total: results.length, passed, failed, results };
  writeFileSync(resolve(RESULTS_DIR, 'ext-perps-chart-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
