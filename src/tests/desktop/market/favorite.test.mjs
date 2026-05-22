// Market Favorite Tests (Desktop) — MARKET-FAV-001 ~ MARKET-FAV-007
// Thin wrapper: test logic lives in src/tests/shared/market/favorite.mjs
// Connects via CDP port 9222 (OneKey Electron app).

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded, goToWalletHome,
} from '../../helpers/index.mjs';
import { MarketPage } from '../../helpers/pages/index.mjs';
import { openSearchModal } from '../../helpers/components.mjs';
import { createMarketFavoriteTests } from '../../shared/market/favorite.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'market-favorite');
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

async function goToWallet(page) {
  try {
    await goToWalletHome(page);
    await sleep(1000);
    return;
  } catch {}

  const ok = await page.evaluate(() => {
    const sidebar = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
    if (!sidebar) return false;
    const labels = ['Home', '首页', 'Wallet', '钱包', 'ウォレット'];
    for (const sp of sidebar.querySelectorAll('span')) {
      const txt = sp.textContent?.trim();
      if (!labels.includes(txt || '')) continue;
      const r = sp.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        sp.click();
        return true;
      }
    }
    return false;
  });
  if (!ok) throw new Error('Cannot navigate to Wallet/Home via sidebar');
  await sleep(2500);
}

const triggerSearch = (page) => openSearchModal(page);

/** Click a main tab (自选/现货/合约) — Desktop layout: main tabs at y~130-195. */
async function clickMainTab(page, name) {
  const clicked = await page.evaluate((tabName) => {
    for (const el of document.querySelectorAll('span')) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() !== tabName) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.y > 130 && r.y < 195) {
        el.click();
        return true;
      }
    }
    return false;
  }, name);
  if (!clicked) throw new Error(`Cannot click tab "${name}"`);
  await sleep(1500);
}

/** Click a sub-tab (全部/现货/合约 under 自选) — Desktop layout: y~195-350. */
async function clickSubTab(page, name) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const clicked = await page.evaluate((tabName) => {
      const matches = [];
      for (const el of document.querySelectorAll('span')) {
        if (el.children.length > 0) continue;
        if (el.textContent?.trim() !== tabName) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.y > 195 && r.y < 350) {
          matches.push({ el, y: r.y });
        }
      }
      if (matches.length === 0) return false;
      matches.sort((a, b) => a.y - b.y);
      matches[0].el.click();
      return true;
    }, name);
    if (clicked) { await sleep(1500); return; }
    await sleep(500);
  }
  throw new Error(`Cannot click sub-tab "${name}"`);
}

/** Click a network filter chip. Desktop: chips at any y, supports horizontal scroll. */
async function clickNetworkFilter(page, network) {
  const clicked = await page.evaluate((net) => {
    const mp = document.querySelector('[data-testid="market-page"]');
    const scope = mp && mp.getBoundingClientRect().width > 40 ? mp : document;
    for (const el of scope.querySelectorAll('span')) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() !== net) continue;
      el.scrollIntoView({ inline: 'center', block: 'nearest' });
      el.click();
      return true;
    }
    for (const el of scope.querySelectorAll('button, div, [role="option"]')) {
      if (el.textContent?.trim() !== net || el.children.length > 2) continue;
      el.scrollIntoView({ inline: 'center', block: 'nearest' });
      el.click();
      return true;
    }
    return false;
  }, network);
  if (!clicked) throw new Error(`Cannot click network filter "${network}"`);
  await sleep(1500);
}

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = '收藏';

const { testCases, setup: sharedSetup } = createMarketFavoriteTests({
  prefix: 'MARKET-FAV',
  namePrefix: '',
  goToMarket,
  goToWallet,
  triggerSearch,
  clickMainTab,
  clickSubTab,
  clickNetworkFilter,
});

export { testCases };

export async function setup(page) {
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
  await sharedSetup(page);
}

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('MARKET-FAV-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { page } = await connectCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Market Favorite Tests — ${casesToRun.length} case(s)`);
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
        ({ page } = await connectCDP());
        await setup(page);
      }
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

    try { if (page && !page?.isClosed?.()) await dismissOverlays(page); } catch {}
    await sleep(800);
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));

  const summary = { timestamp: new Date().toISOString(), total: results.length, passed, failed, results };
  writeFileSync(resolve(RESULTS_DIR, 'market-favorite-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
