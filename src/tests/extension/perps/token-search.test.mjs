// Token Search Tests (Extension) — EXT-PERPS-SEARCH-001 ~ EXT-PERPS-SEARCH-003
// Thin wrapper: test logic lives in src/tests/shared/perps/token-search.mjs
// Connects via CDP port 9224 using connectExtensionCDP.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep } from '../../helpers/constants.mjs';
import { connectExtensionCDP, getExtensionId } from '../../helpers/extension-cdp.mjs';
import { createPerpsTokenSearchTests } from '../../shared/perps/token-search.mjs';

const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'ext-perps-search');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function screenshotExt(page, dir, name) {
  try {
    const path = `${dir}/${name}.png`;
    await page.screenshot({ path });
  } catch {}
}

// ── Platform-specific Navigation ─────────────────────────────

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
  await sleep(1500);
}

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = '代币搜索';

const { testCases, setup, ensurePopoverOpen, dismissPopover, getPreReport } =
  createPerpsTokenSearchTests({
    prefix: 'EXT-PERPS-SEARCH',
    namePrefix: 'Ext-',
    goToPerps,
    screenshot: screenshotExt,
    screenshotDir: SCREENSHOT_DIR,
    tabLayout: 'flat',
  });

export { testCases, setup };

// ── Main (CLI) ──────────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('EXT-PERPS-SEARCH-'));
  const casesToRun = filter
    ? testCases.filter(c => c.id === filter)
    : testCases;

  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { browser, page } = await connectExtensionCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Token Search Tests (Extension) — ${casesToRun.length} case(s)`);
  console.log('='.repeat(60));

  await setup(page);

  const preReport = getPreReport();
  if (!preReport?.canRun) {
    console.log('\n  Preconditions not met, aborting.');
    return { status: 'failed', error: 'preconditions_failed' };
  }

  const results = [];
  for (const test of casesToRun) {
    const startTime = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${test.id}] ${test.name}`);
    console.log('─'.repeat(60));

    if (preReport.shouldSkip(test.id)) {
      const r = { testId: test.id, status: 'skipped', duration: 0,
        reason: 'precondition warned', timestamp: new Date().toISOString() };
      console.log(`>> ${test.id}: SKIPPED (precondition)`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
      continue;
    }

    await ensurePopoverOpen(page);

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
        await screenshotExt(page, SCREENSHOT_DIR, `${test.id}-error`);
      }
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }
  }

  await dismissPopover(page);

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${skipped} skipped, ${results.length} total`);
  console.log('='.repeat(60));

  const summary = { timestamp: new Date().toISOString(), total: results.length, passed, failed, skipped, results };
  writeFileSync(resolve(RESULTS_DIR, 'ext-perps-search-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, skipped, total: results.length };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
