// Market Chart Tests (Desktop) — MARKET-CHART-001 ~ MARKET-CHART-008
// Thin wrapper: test logic lives in src/tests/shared/market/chart.mjs
// Connects via CDP port 9222 (OneKey Electron app).

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
} from '../../helpers/index.mjs';
import { clickSidebarTab, ensureOnListPage } from '../../helpers/components.mjs';
import { createDesktopMarketChartTests } from '../../shared/market/chart.mjs';
import { MARKET_PUBLIC_TOKEN_MAIN_TAB } from '../../shared/market/market-tabs.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'market-chart');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Platform-specific Navigation ─────────────────────────────

async function clickMainTab(page, tab) {
  const ok = await page.evaluate((name) => {
    for (const sp of document.querySelectorAll('span')) {
      if ((sp.textContent || '').trim() !== name) continue;
      const r = sp.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.y > 135 && r.y < 210) {
        sp.click();
        return true;
      }
    }
    return false;
  }, tab);
  if (!ok) throw new Error(`Cannot click main tab: ${tab}`);
  await sleep(1500);
}

async function isMarketTokenListVisible(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= 0 && r.x < window.innerWidth && r.y < window.innerHeight;
    };
    return Array.from(document.querySelectorAll('[data-testid="list-column-name"]'))
      .some((el) => {
        const text = (el.textContent || '').trim();
        const r = el.getBoundingClientRect();
        return visible(el) && text && text !== '名称' && text !== '#' && r.y > 220;
      });
  });
}

async function assertNoLockLayer(page) {
  const lockState = await page.evaluate(() => {
    const text = document.elementFromPoint(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight / 2))?.textContent || '';
    const bodyText = document.body?.innerText || '';
    return {
      topText: text.replace(/\s+/g, ' ').trim().slice(0, 80),
      hasPasswordInput: !!document.querySelector('[data-testid="password-input"], input[type="password"]'),
      bodyHasWelcome: /欢迎回来|Welcome back/i.test(bodyText),
    };
  });
  if (lockState.hasPasswordInput || lockState.bodyHasWelcome) {
    throw new Error(`Wallet lock layer is still covering Market: ${JSON.stringify(lockState)}`);
  }
}

/** Enter Market → 热门 tab, return count of visible token rows. */
async function openMarketSpotList(page) {
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
  await clickSidebarTab(page, 'Market');
  await sleep(2000);
  await clickMainTab(page, MARKET_PUBLIC_TOKEN_MAIN_TAB);
  await sleep(1500);
  await assertNoLockLayer(page);
  const viewH = await page.evaluate(() => window.innerHeight);
  const count = await page.evaluate((vh) => {
    let n = 0;
    for (const el of document.querySelectorAll('[data-testid="list-column-name"]')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 30 && r.x >= 0 && r.x < window.innerWidth && r.y > 220 && r.y < vh) n++;
    }
    return n;
  }, viewH);
  return { count };
}

/** Click the first visible token row, wait for detail page. */
async function clickFirstToken(page) {
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
  if (!await isMarketTokenListVisible(page)) {
    await openMarketSpotList(page);
  }
  await assertNoLockLayer(page);
  const pos = await page.evaluate(() => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const isVisible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= 0 && r.x < window.innerWidth && r.y < window.innerHeight;
    };
    for (const el of document.querySelectorAll('[data-testid="list-column-name"]')) {
      const text = normalize(el.textContent || el.innerText);
      if (text === '名称' || text === '#') continue;
      const r = el.getBoundingClientRect();
      if (!isVisible(el) || r.x < 100 || r.x > 500 || r.width <= 0 || r.y < 250) continue;
      let row = el.parentElement;
      while (row && row.parentElement) {
        const rr = row.getBoundingClientRect();
        const rowText = normalize(row.innerText || row.textContent);
        if (rr.width > 500 && rr.height >= 40 && rr.height <= 80 && rowText.includes(text)) break;
        row = row.parentElement;
      }
      const rr = row?.getBoundingClientRect?.();
      const clickX = rr && rr.width > 0 ? rr.x + Math.min(340, rr.width / 2) : r.x + r.width / 2;
      const clickY = rr && rr.height > 0 ? rr.y + rr.height / 2 : r.y + r.height / 2;
      return { x: clickX, y: clickY, text: text.slice(0, 30) };
    }
    return null;
  });
  if (!pos) throw new Error('No visible token name cell');
  await page.mouse.click(pos.x, pos.y);
  const opened = await page.waitForFunction(() => {
    const visible = (selector) => {
      const el = document.querySelector(selector);
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0;
    };
    return visible('[data-testid="nav-header-back"]') || visible('[data-testid="market-detail-page"]');
  }, { timeout: 8000 }).then(() => true).catch(() => false);
  if (!opened) {
    const topHit = await page.evaluate(({ x, y }) => {
      const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const el = document.elementFromPoint(x, y);
      return {
        tag: el?.tagName || '',
        testid: el?.getAttribute?.('data-testid') || '',
        text: normalize(el?.textContent || '').slice(0, 120),
        body: normalize(document.body?.innerText || '').slice(0, 300),
      };
    }, pos);
    throw new Error(`Detail page did not open after clicking ${pos.text}; hit=${JSON.stringify(topHit)}`);
  }
  await sleep(3000);
  return { text: pos.text };
}

/**
 * Ensure we're on a token detail page with TV chart.
 * If already on detail page (nav-header-back visible + webview present), skip navigation.
 * Otherwise: Market → 热门 → click first token.
 */
async function navigateToTokenDetail(page) {
  const alreadyOnDetail = await page.evaluate(() => {
    const back = document.querySelector('[data-testid="nav-header-back"]');
    const wv = document.querySelector('webview');
    return !!(back && back.getBoundingClientRect().width > 0 && wv);
  });
  if (alreadyOnDetail) return;

  await openMarketSpotList(page);
  await clickFirstToken(page);
}

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = '图表';

const { testCases } = createDesktopMarketChartTests({
  prefix: 'MARKET-CHART',
  namePrefix: '',
  openMarketSpotList,
  clickFirstToken,
  navigateToTokenDetail,
  screenshotDir: SCREENSHOT_DIR,
});

export { testCases };

export async function setup(page) {
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
  // If app is on a token detail page, go back to Market list first
  await ensureOnListPage(page);
}

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('MARKET-CHART-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { page } = await connectCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Market Chart Tests (Desktop) — ${casesToRun.length} case(s)`);
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
  writeFileSync(resolve(RESULTS_DIR, 'market-chart-desktop-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
