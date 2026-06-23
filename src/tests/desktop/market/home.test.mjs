// Market Home Tests (Desktop) — MARKET-HOME-001 ~ MARKET-HOME-006
// Thin wrapper: test logic lives in src/tests/shared/market/home.mjs
// Connects via CDP port 9222 (OneKey Electron app).

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
} from '../../helpers/index.mjs';
import { MarketPage } from '../../helpers/pages/index.mjs';
import { openSearchModal } from '../../helpers/components.mjs';
import { createMarketHomeTests } from '../../shared/market/home.mjs';
import { marketLabelAliases, marketTabLabels } from '../../shared/market/market-tabs.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'market-home');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Platform-specific Navigation ─────────────────────────────

const _marketPageCache = { page: null, mp: null };
function getMarketPage(page) {
  if (_marketPageCache.page !== page) {
    _marketPageCache.mp = new MarketPage(page);
    _marketPageCache.page = page;
  }
  return _marketPageCache.mp;
}

async function goToMarket(page) {
  await getMarketPage(page).navigate();
}

const triggerSearch = (page) => openSearchModal(page);

/** Click a main tab — Desktop layout: main tabs are at y~155-180. */
async function clickMainTab(page, tab) {
  const labels = marketTabLabels(tab);
  const ok = await page.evaluate((names) => {
    for (const sp of document.querySelectorAll('span')) {
      if (!names.includes((sp.textContent || '').trim())) continue;
      const r = sp.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.y > 135 && r.y < 210) {
        sp.click();
        return true;
      }
    }
    return false;
  }, labels);
  if (!ok) throw new Error(`Cannot click main tab: ${tab}`);
  await sleep(1500);
}

/** Click a filter chip — Desktop layout: chips can sit beside or below main tabs. */
async function clickFilterChip(page, label) {
  const labels = marketLabelAliases(label);
  const ok = await page.evaluate((names) => {
    const nodes = document.querySelectorAll('span, div, button');
    for (const el of nodes) {
      const text = (el.textContent || '').trim();
      if (!names.includes(text)) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.y > 155 && r.y < 290) {
        el.scrollIntoView({ inline: 'center', block: 'nearest' });
        el.click();
        return true;
      }
    }
    return false;
  }, labels);
  if (!ok) throw new Error(`Cannot click filter chip: ${label}`);
  await sleep(1200);
}

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = '首页';

const { testCases, setup: sharedSetup } = createMarketHomeTests({
  prefix: 'MARKET-HOME',
  namePrefix: '',
  goToMarket,
  triggerSearch,
  clickMainTab,
  clickFilterChip,
  screenshotOnFail: (p, n) => screenshot(p, SCREENSHOT_DIR, n),
});

export { testCases };

export async function setup(page) {
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
  await sharedSetup(page);
}

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find((a) => a.startsWith('MARKET-HOME-'));
  const casesToRun = filter ? testCases.filter((c) => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  const { page } = await connectCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Market Home Tests (Desktop) — ${casesToRun.length} case(s)`);
  console.log('='.repeat(60));

  await setup(page);

  const results = [];

  for (const tc of casesToRun) {
    const start = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${tc.id}] ${tc.name}`);
    console.log('─'.repeat(60));

    try {
      const ret = await tc.fn(page);
      const duration = Date.now() - start;
      const r = {
        testId: tc.id,
        status: ret.status,
        duration,
        steps: ret.steps,
        errors: ret.errors,
        timestamp: new Date().toISOString(),
      };
      console.log(`>> ${tc.id}: ${r.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s)`);
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    } catch (err) {
      const duration = Date.now() - start;
      const r = {
        testId: tc.id,
        status: 'failed',
        duration,
        error: err.message,
        timestamp: new Date().toISOString(),
      };
      console.error(`>> ${tc.id}: FAILED (${(duration / 1000).toFixed(1)}s) — ${err.message}`);
      await screenshot(page, SCREENSHOT_DIR, `${tc.id}-error`);
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }

    try { await dismissOverlays(page); } catch {}
    await sleep(600);
  }

  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const summary = {
    timestamp: new Date().toISOString(),
    total: results.length,
    passed,
    failed,
    results,
  };

  writeFileSync(resolve(RESULTS_DIR, 'market-home-summary.json'), JSON.stringify(summary, null, 2));

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().catch((e) => { console.error(e); process.exit(1); });
}
