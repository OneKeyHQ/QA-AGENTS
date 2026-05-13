// Market Favorite Tests (Extension) — EXT-MARKET-FAV-001 ~ EXT-MARKET-FAV-007
// Thin wrapper: test logic lives in src/tests/shared/market/favorite.mjs
// Connects via CDP using connectExtensionCDP.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep } from '../../helpers/constants.mjs';
import { connectExtensionCDP, getExtensionId } from '../../helpers/extension-cdp.mjs';
import { createMarketFavoriteTests } from '../../shared/market/favorite.mjs';

const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'ext-market-favorite');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function screenshotExt(page, name) {
  try { await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` }); } catch {}
}

// ── Platform-specific Navigation ─────────────────────────────

async function goToMarket(page) {
  const extId = getExtensionId();
  const url = page.url();
  if (url.includes('/market') && url.includes(extId)) return;

  const navigated = await page.evaluate(() => {
    const candidates = document.querySelectorAll('a, button, [role="tab"], [role="menuitem"]');
    for (const el of candidates) {
      const txt = (el.textContent || '').trim();
      const href = el.getAttribute('href') || '';
      if (txt === '市场' || txt === 'Market' || href.includes('/market')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { el.click(); return true; }
      }
    }
    return false;
  });

  if (navigated) { await sleep(3000); return; }

  await page.goto(`chrome-extension://${extId}/ui-expand-tab.html#/market`);
  await sleep(3000);
}

async function goToWallet(page) {
  const extId = getExtensionId();

  const clicked = await page.evaluate(() => {
    const walletBtn = document.querySelector('[data-testid="tab-modal-no-active-item-Wallet4Outline"]')
      || document.querySelector('[data-testid="tab-modal-active-item-Wallet4Outline"]');
    if (walletBtn) {
      const r = walletBtn.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) { walletBtn.click(); return true; }
    }
    const sidebar = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
    if (sidebar) {
      for (const sp of sidebar.querySelectorAll('span')) {
        const txt = sp.textContent?.trim();
        if (['Wallet', '钱包'].includes(txt)) {
          const r = sp.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { sp.click(); return true; }
        }
      }
    }
    for (const a of document.querySelectorAll('a, button, [role="tab"], [role="menuitem"]')) {
      const txt = (a.textContent || '').trim();
      const href = a.getAttribute('href') || '';
      if (txt === '钱包' || txt === 'Wallet' || href.includes('/main/tab/Home') || href.includes('/wallet')) {
        const r = a.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { a.click(); return true; }
      }
    }
    return false;
  });

  if (!clicked) {
    await page.goto(`chrome-extension://${extId}/ui-expand-tab.html#/main/tab/Home`);
  }
  await sleep(2500);
}

async function triggerSearch(page) {
  const pos = await page.evaluate(() => {
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
    throw new Error('Search trigger not found');
  });
  await page.mouse.click(pos.x, pos.y);
}

async function clickMainTab(page, name) {
  const clicked = await page.evaluate((tabName) => {
    for (const el of document.querySelectorAll('span')) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() !== tabName) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.y > 50 && r.y < 220) {
        el.click();
        return true;
      }
    }
    return false;
  }, name);
  if (!clicked) throw new Error(`Cannot click tab "${name}"`);
  await sleep(1500);
}

async function clickSubTab(page, name) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const clicked = await page.evaluate((tabName) => {
      const matches = [];
      for (const el of document.querySelectorAll('span')) {
        if (el.children.length > 0) continue;
        if (el.textContent?.trim() !== tabName) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.y > 120 && r.y < 360) {
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

async function clickNetworkFilter(page, network) {
  const clicked = await page.evaluate((net) => {
    for (const el of document.querySelectorAll('span')) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() !== net) continue;
      el.scrollIntoView({ inline: 'center', block: 'nearest' });
      el.click();
      return true;
    }
    for (const el of document.querySelectorAll('button, div, [role="option"]')) {
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
  prefix: 'EXT-MARKET-FAV',
  namePrefix: 'Ext-',
  goToMarket,
  goToWallet,
  triggerSearch,
  clickMainTab,
  clickSubTab,
  clickNetworkFilter,
});

export { testCases };

export async function setup(page) {
  await sharedSetup(page);
}

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('EXT-MARKET-FAV-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { browser, page } = await connectExtensionCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Market Favorite Tests (Extension) — ${casesToRun.length} case(s)`);
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
  writeFileSync(resolve(RESULTS_DIR, 'ext-market-favorite-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
