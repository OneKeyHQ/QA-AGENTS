// Swap 0x Polygon Tests (Extension) — EXT-SWAP-0X-POLYGON-001 ~ 003
// Thin wrapper: test logic lives in src/tests/shared/swap/0x-polygon.mjs
// Connects via CDP port 9224 using connectExtensionCDP.
//
// NOTE:
// - Extension URL: chrome-extension://<id>/ui-expand-tab.html#/swap
// - Extension can complete sign flow because it controls the wallet, but the
//   sign popup may open a separate window. We default to `previewOnly: false`
//   but allow override via EXT_SWAP_PREVIEW_ONLY=1.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep } from '../../helpers/constants.mjs';
import { connectExtensionCDP, getExtensionId } from '../../helpers/extension-cdp.mjs';
import { createSwap0xPolygonTests } from '../../shared/swap/0x-polygon.mjs';

const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'ext-swap-0x-polygon');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function screenshotExt(page, name) {
  try { await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` }); } catch {}
}

// ── Platform-specific Navigation ─────────────────────────────

async function switchToPolygonInExt(page) {
  const alreadyPolygon = await page.evaluate(() =>
    (document.body?.textContent || '').includes('Polygon'));
  if (alreadyPolygon) return;
  const opened = await page.evaluate(() => {
    const candidates = [];
    for (const el of document.querySelectorAll('span,div,button,svg')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.y > 120) continue;
      const t = (el.textContent || '').trim();
      if (/^(Polygon|Ethereum|Arbitrum|Optimism|Base|BSC|Avalanche)$/.test(t)) {
        candidates.push({ el, y: r.y, x: r.x });
      }
    }
    candidates.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    if (candidates[0]) { candidates[0].el.click(); return true; }
    return false;
  });
  if (!opened) return;
  await sleep(1200);
  // Search Polygon in chain selector if exposed
  const chainSearchSel = '[data-testid="nav-header-search-chain-selector"]';
  const hasSearch = await page.locator(chainSearchSel).isVisible({ timeout: 1500 }).catch(() => false);
  if (hasSearch) {
    const input = page.locator(chainSearchSel).first();
    await input.click().catch(() => {});
    await input.fill('polygon').catch(() => {});
    await sleep(800);
    const poly = page.locator('[data-testid="evm--137"]').first();
    await poly.click({ timeout: 8000 }).catch(() => {});
    await sleep(2000);
  } else {
    // Fallback: click "Polygon" entry directly
    await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return;
      for (const sp of modal.querySelectorAll('span,div,button')) {
        if ((sp.textContent || '').trim() === 'Polygon'
          && sp.getBoundingClientRect().width > 0) { sp.click(); return; }
      }
    });
    await sleep(1500);
  }
}

/** Extension goToSwap: navigate to in-extension /swap, then switch to Polygon. */
async function goToSwap(page) {
  // Try sidebar Swap entry first
  const clicked = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="swap"]')
      || document.querySelector('[data-testid="tab-swap"]');
    if (el) { el.click(); return true; }
    const container = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
    if (container) {
      for (const sp of container.querySelectorAll('span')) {
        if (['兑换', 'Swap'].includes(sp.textContent.trim())
          && sp.getBoundingClientRect().width > 0) {
          sp.click(); return true;
        }
      }
    }
    return false;
  });
  if (!clicked) {
    const extId = getExtensionId();
    await page.goto(`chrome-extension://${extId}/ui-expand-tab.html#/swap`);
    await sleep(3000);
  }
  await sleep(2000);

  // Wait for swap container
  for (let i = 0; i < 20; i++) {
    const ready = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="swap-content-container"]');
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (ready) break;
    await sleep(500);
  }

  try { await switchToPolygonInExt(page); } catch {}
}

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = '0x-Polygon';
export const categoryTitle = '兑换';

const previewOnly = process.env.EXT_SWAP_PREVIEW_ONLY === '1';

const { testCases, setup } = createSwap0xPolygonTests({
  prefix: 'EXT-SWAP-0X-POLYGON',
  namePrefix: 'Ext-',
  goToSwap,
  previewOnly,
  screenshotDir: SCREENSHOT_DIR,
});

export { testCases, setup };

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('EXT-SWAP-0X-POLYGON-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { browser, page } = await connectExtensionCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Swap 0x Polygon Tests (Extension) — ${casesToRun.length} case(s)`);
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

  const summary = { timestamp: new Date().toISOString(), total: results.length, passed, failed, results };
  writeFileSync(resolve(RESULTS_DIR, 'ext-swap-0x-polygon-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
