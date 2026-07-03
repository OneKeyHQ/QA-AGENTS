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
import { MARKET_PUBLIC_TOKEN_MAIN_TAB, marketTabLabels } from '../../shared/market/market-tabs.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'market-chart');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Platform-specific Navigation ─────────────────────────────

async function clickMainTab(page, tab) {
  const labels = marketTabLabels(tab);
  let target = null;
  for (let i = 0; i < 8; i++) {
    target = await page.evaluate((names) => {
      const visibleRect = (el) => {
        const r = el?.getBoundingClientRect?.();
        if (!r || r.width <= 0 || r.height <= 0) return null;
        if (r.x < 70 || r.y < 80 || r.y > 260) return null;
        return r;
      };
      const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const candidates = [];

      for (const el of document.querySelectorAll('span, button, [role="tab"], [role="button"], div')) {
        const text = normalize(el.textContent);
        if (!names.includes(text)) continue;
        const r = visibleRect(el);
        if (!r) continue;

        let clickable = el.closest('button,[role="tab"],[role="button"]');
        if (!clickable) {
          let node = el.parentElement;
          while (node && node !== document.body) {
            const nr = visibleRect(node);
            const nodeText = normalize(node.textContent);
            if (nr && nodeText === text && nr.width >= r.width && nr.height >= r.height) {
              clickable = node;
            }
            if (nr && nr.height >= 32 && nr.height <= 70 && nr.width >= r.width && nodeText === text) break;
            node = node.parentElement;
          }
        }

        const cr = visibleRect(clickable || el) || r;
        candidates.push({
          x: cr.x + cr.width / 2,
          y: cr.y + cr.height / 2,
          text,
          score: Math.abs(cr.y - 175) + Math.abs(cr.x - 180) / 10,
        });
      }

      candidates.sort((a, b) => a.score - b.score);
      return candidates[0] || null;
    }, labels);
    if (target) break;
    await sleep(500);
  }
  if (!target) throw new Error(`Cannot click main tab: ${tab}`);
  await page.mouse.click(target.x, target.y);
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

async function isMarketForeground(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= 0 && r.x < window.innerWidth && r.y < window.innerHeight;
    };
    const bodyText = document.body?.innerText || '';
    const marketSidebar = document.querySelector('[data-testid="market"]');
    const hasMarketList = Array.from(document.querySelectorAll('[data-testid="list-column-name"]'))
      .some((el) => visible(el) && el.getBoundingClientRect().y > 180);
    const hasMarketTabs = /自选|自選|热门|熱門|股票|合约|合約|现货|現貨/.test(bodyText);
    const marketActive = !!document.querySelector('[data-testid="tab-modal-active-item-TradingViewCandlesSolid"]');
    return !!(marketActive && (hasMarketList || hasMarketTabs));
  });
}

async function ensureMarketForeground(page) {
  for (let i = 0; i < 3; i++) {
    await clickSidebarTab(page, 'Market').catch(() => {});
    await sleep(1000);
    if (await isMarketForeground(page)) return;

    const point = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="market"]');
      const r = el?.getBoundingClientRect?.();
      if (!r || r.width <= 0 || r.height <= 0) return null;
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (point) {
      await page.mouse.click(point.x, point.y);
      await sleep(2000);
    }
    if (await isMarketForeground(page)) return;
  }
  throw new Error('Market page did not become foreground after sidebar click');
}

/** Enter Market → 热门 tab, return count of visible token rows. */
async function openMarketSpotList(page) {
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
  await ensureMarketForeground(page);
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
  await ensureMarketForeground(page);
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
  const target = await page.evaluate(() => {
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
      const clickX = Math.min(r.left + Math.max(24, Math.min(r.width / 2, 120)), window.innerWidth - 8);
      const clickY = r.top + r.height / 2;
      const hit = document.elementFromPoint(clickX, clickY);
      return {
        x: clickX,
        y: clickY,
        text: text.slice(0, 30),
        hitTestId: hit?.getAttribute?.('data-testid') || '',
        hitText: normalize(hit?.textContent || '').slice(0, 80),
      };
    }
    return null;
  });
  if (!target) throw new Error('No visible token name cell');

  const detailOpened = async () => page.evaluate(() => {
    const visible = (selector) => {
      const el = document.querySelector(selector);
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0;
    };
    return visible('[data-testid="nav-header-back"]')
      || visible('[data-testid="market-detail-page"]')
      || visible('webview');
  });

  await page.mouse.click(target.x, target.y);
  let opened = await page.waitForFunction(() => {
    const visible = (selector) => {
      const el = document.querySelector(selector);
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0;
    };
    return visible('[data-testid="nav-header-back"]')
      || visible('[data-testid="market-detail-page"]')
      || visible('webview');
  }, { timeout: 8000 }).then(() => true).catch(() => false);

  if (!opened) {
    opened = await page.evaluate((needle) => {
      const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      for (const el of document.querySelectorAll('[data-testid="list-column-name"]')) {
        const text = normalize(el.textContent || el.innerText);
        const r = el.getBoundingClientRect();
        if (!text.includes(needle) || r.width <= 0 || r.height <= 0 || r.y < 250) continue;
        el.click();
        return true;
      }
      return false;
    }, target.text);
    if (opened) {
      await sleep(2500);
      opened = await detailOpened();
    }
  }

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
    }, target);
    throw new Error(`Detail page did not open after clicking ${target.text}; clickHit=${target.hitTestId || target.hitText}; finalHit=${JSON.stringify(topHit)}`);
  }
  await sleep(3000);
  return { text: target.text };
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
