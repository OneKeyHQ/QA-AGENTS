// Universal Search Tests (Extension) — EXT-SEARCH-UTIL-001 ~ EXT-SEARCH-UTIL-007
// Thin wrapper: test logic lives in src/tests/shared/utility/universal-search.mjs
// Extension version: full tabs (全部/账户/市场/合约/代币/我的资产/dApps/设置).
// Connects via CDP port 9224 (Chrome with extension loaded).

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep } from '../../helpers/constants.mjs';
import { connectExtensionCDP, getExtensionId } from '../../helpers/extension-cdp.mjs';
import { createUniversalSearchTests } from '../../shared/utility/universal-search.mjs';

const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'ext-universal-search');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function screenshotExt(page, name) {
  try {
    const path = `${SCREENSHOT_DIR}/${name}.png`;
    await page.screenshot({ path });
  } catch {}
}

// ── Platform-specific: Extension ─────────────────────────────

/**
 * Extension search trigger: try nav-header-search input first (like desktop),
 * fallback to magnifying-glass SVG icon button (like web).
 */
async function openSearchTrigger(page) {
  const pos = await page.evaluate(() => {
    // Strategy 1: data-testid header search input (same as desktop)
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    const inputs = Array.from(document.querySelectorAll('input[data-testid="nav-header-search"]'));
    const input = inputs.find(el => {
      if (modal && modal.contains(el)) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (input) {
      const r = input.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    }

    // Strategy 2: SVG magnifying glass icon (same as web)
    const svgs = document.querySelectorAll('svg');
    for (const svg of svgs) {
      const paths = svg.querySelectorAll('path');
      for (const p of paths) {
        const d = p.getAttribute('d') || '';
        if (d.startsWith('M11 3a8') || d.startsWith('M11 3')) {
          const btn = svg.closest('button') || svg.closest('[role="button"]') || svg.parentElement;
          if (btn) {
            const r = btn.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
            }
          }
          const r = svg.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
          }
        }
      }
    }

    throw new Error('Search trigger (header input or SVG icon) not found');
  });
  await page.mouse.click(pos.x, pos.y);
}

/**
 * Reset to wallet home page — close modals, click sidebar wallet icon,
 * fallback to extension expand tab URL.
 */
async function resetToHome(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(300);
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(300);

  // Try clicking sidebar wallet icon
  const clicked = await page.evaluate(() => {
    const walletIcon = document.querySelector('[data-testid="tab-modal-no-active-item-Wallet4Outline"]')
      || document.querySelector('[data-testid="tab-modal-active-item-Wallet4Solid"]');
    if (walletIcon) {
      const r = walletIcon.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) { walletIcon.click(); return true; }
    }
    const candidates = document.querySelectorAll('a, button, [role="tab"], span, div');
    for (const el of candidates) {
      const txt = (el.textContent || '').trim();
      if (['钱包', 'Wallet'].includes(txt)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.height < 60) {
          el.click();
          return true;
        }
      }
    }
    return false;
  });

  if (!clicked) {
    const extId = getExtensionId();
    await page.goto(`chrome-extension://${extId}/ui-expand-tab.html`);
  }
  await sleep(1500);
}

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = '通用搜索';

const { testCases, setup } = createUniversalSearchTests({
  prefix: 'EXT-SEARCH-UTIL',
  namePrefix: 'Ext-',
  triggerFn: openSearchTrigger,
  resetToHome,
});

export { testCases, setup };

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('EXT-SEARCH-UTIL-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { browser, page } = await connectExtensionCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Universal Search Tests (Extension) — ${casesToRun.length} case(s)`);
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
      }
      await page.keyboard.press('Escape').catch(() => {});
      await sleep(300);
      await resetToHome(page);

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
        await screenshotExt(page, `${test.id}-error`);
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
  writeFileSync(resolve(RESULTS_DIR, 'ext-universal-search-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
