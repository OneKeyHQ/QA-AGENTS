// Swap 0x Polygon Tests (Desktop) — SWAP-0X-POLYGON-001 ~ 003
// Thin wrapper: test logic lives in src/tests/shared/swap/0x-polygon.mjs
// Connects via CDP port 9222 (OneKey Electron app).
//
// Desktop-specific: switches to Polygon via wallet home network selector, then opens
// Swap from wallet home "兑换" entry point.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded, goToWalletHome,
  closeAllModals,
  clickSidebarTab,
} from '../../helpers/index.mjs';
import { createSwap0xPolygonTests } from '../../shared/swap/0x-polygon.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'swap-0x-polygon');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Platform-specific Helpers ────────────────────────────────

async function ensureOnListPage(page) {
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="nav-header-back"]');
    if (btn && btn.getBoundingClientRect().width > 0) { btn.click(); return true; }
    return false;
  });
  if (clicked) await sleep(1500);
  return clicked;
}

async function openSwapFromWalletHome(page) {
  await closeAllModals(page);
  await ensureOnListPage(page);
  const clicked = await page.evaluate(() => {
    const isVisible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };

    // 1) Prefer row containing "POL" (Polygon native) → its "兑换"
    const rows = Array.from(document.querySelectorAll('div'));
    for (const row of rows) {
      if (!isVisible(row)) continue;
      const txt = (row.textContent || '').replace(/\s+/g, ' ');
      if (!txt.includes('POL')) continue;
      for (const el of row.querySelectorAll('span,button,div')) {
        if (!isVisible(el)) continue;
        if ((el.textContent || '').trim() === '兑换') { el.click(); return 'row:POL'; }
      }
    }

    // 2) Fallback: Wallet header area "兑换"
    const header = document.querySelector('[data-testid="Wallet-Tab-Header"]');
    if (header && isVisible(header)) {
      const candidates = [];
      for (const el of header.querySelectorAll('span,button,div')) {
        const t = (el.textContent || '').trim();
        if (t !== '兑换') continue;
        if (!isVisible(el)) continue;
        const r = el.getBoundingClientRect();
        candidates.push({ el, y: r.y, x: r.x });
      }
      candidates.sort((a, b) => (a.y - b.y) || (a.x - b.x));
      if (candidates[0]) { candidates[0].el.click(); return 'header'; }
    }

    // 3) Last resort: any visible "兑换"
    for (const el of document.querySelectorAll('span,button,div')) {
      if ((el.textContent || '').trim() !== '兑换') continue;
      if (isVisible(el)) { el.click(); return 'any'; }
    }
    return null;
  });

  if (!clicked) throw new Error('Cannot find wallet home "兑换" button');

  for (let i = 0; i < 30; i++) {
    const ok = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="swap-content-container"]');
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (ok) { await sleep(800); return; }
    await sleep(500);
  }
  throw new Error('Swap container did not become visible after clicking 兑换');
}

/** Switch network to Polygon via wallet home network selector. */
async function switchToPolygon(page) {
  const alreadyPolygon = await page.evaluate(() =>
    (document.body?.textContent || '').includes('Polygon'));
  if (!alreadyPolygon) {
    const opened = await page.evaluate(() => {
      const candidates = [];
      for (const el of document.querySelectorAll('span,div,button,svg')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.y > 120) continue;
        const t = (el.textContent || '').trim();
        if (t.includes('Polygon') || t.includes('Ethereum') || t.includes('Arbitrum')
          || t.includes('Optimism') || t.includes('Base') || t.includes('BSC')
          || t.includes('Avalanche')) {
          candidates.push({ el, y: r.y, x: r.x });
        }
      }
      candidates.sort((a, b) => (a.y - b.y) || (a.x - b.x));
      if (candidates[0]) { candidates[0].el.click(); return true; }
      return false;
    });
    if (opened) await sleep(1200);
  }

  // Click 网络 tab if present
  await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return;
    for (const sp of modal.querySelectorAll('span')) {
      if ((sp.textContent || '').trim() === '网络'
        && sp.getBoundingClientRect().width > 0) { sp.click(); return; }
    }
  }).catch(() => {});
  await sleep(600);

  // Search "polygon" and click evm--137
  const chainSearchSel = '[data-testid="nav-header-search-chain-selector"]';
  const hasSearch = await page.locator(chainSearchSel).isVisible({ timeout: 1500 }).catch(() => false);
  if (hasSearch) {
    const input = page.locator(chainSearchSel).first();
    await input.click().catch(() => {});
    await input.fill('polygon').catch(() => {});
    await sleep(800);
    const poly = page.locator('[data-testid="evm--137"]').first();
    await poly.click({ timeout: 8000 });
    await sleep(2000);
  }
}

/** Desktop goToSwap: wallet home → switch to Polygon → click 兑换. */
async function goToSwap(page) {
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
  try {
    await goToWalletHome(page);
  } catch {
    await closeAllModals(page);
    await clickSidebarTab(page, 'Wallet');
    await sleep(2000);
  }
  await switchToPolygon(page);
  await openSwapFromWalletHome(page);
}

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = '0x-Polygon';
export const categoryTitle = '兑换';

const { testCases, setup } = createSwap0xPolygonTests({
  prefix: 'SWAP-0X-POLYGON',
  namePrefix: '',
  goToSwap,
  screenshotDir: SCREENSHOT_DIR,
});

export { testCases, setup };

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  const { page } = await connectCDP();
  const onlyIds = process.argv.slice(2).filter(a => a.startsWith('SWAP-0X-POLYGON-'));

  console.log('\n' + '='.repeat(60));
  console.log('  Swap 0x Polygon Tests (Desktop)');
  console.log('='.repeat(60));

  await setup(page);

  for (const tc of testCases) {
    if (onlyIds.length && !onlyIds.includes(tc.id)) continue;
    console.log(`\n RUN ${tc.id} ${tc.name}`);
    const start = Date.now();
    try {
      const rep = await tc.fn(page);
      const dur = Date.now() - start;
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify({
        testId: tc.id,
        status: rep.status === 'passed' ? 'pass' : 'fail',
        duration: dur,
        timestamp: new Date().toISOString(),
        error: rep.errors?.[0] || null,
        screenshot: null,
        steps: rep.steps || [],
      }, null, 2));
      console.log(` ${rep.status === 'passed' ? 'PASS' : 'FAIL'} ${tc.id} ${(dur / 1000).toFixed(1)}s`);
    } catch (err) {
      const dur = Date.now() - start;
      console.log(` FAIL ${tc.id} ${(dur / 1000).toFixed(1)}s ${err.message}`);
      const shot = await screenshot(page, SCREENSHOT_DIR, `${tc.id}-fail`);
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify({
        testId: tc.id,
        status: 'fail',
        duration: dur,
        timestamp: new Date().toISOString(),
        error: err.message || String(err),
        screenshot: shot,
      }, null, 2));
    }
  }
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) run().catch(e => { console.error(e); process.exit(1); });
