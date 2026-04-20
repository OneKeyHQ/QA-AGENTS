// Swap 0x Polygon Replay — SWAP-0X-POLYGON-001 ~ 003
// Generated from confirmed recording: Polygon only (Native→Token, Token→Native, Token→Token)
//
// Coverage mapping (from docs):
// - docs/qa/testcases/cases/swap/2026-03-30_Swap-0x渠道同链支持网络测试.md
//   - Polygon: 覆盖主币→代币、代币→主币、代币→代币（同链）
//
// Replay notes:
// - CDP Electron + React input: use locator.pressSequentially(), avoid keyboard.type()
// - Modal actions must be scoped to [data-testid="APP-Modal-Screen"]
// - Screenshots only on failure

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded, goToWalletHome,
  createStepTracker, safeStep,
  closeAllModals,
  clickSidebarTab,
} from '../../helpers/index.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'swap-0x-polygon');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const ALL_TEST_IDS = [
  'SWAP-0X-POLYGON-001',
  'SWAP-0X-POLYGON-002',
  'SWAP-0X-POLYGON-003',
];

let _preReport = null;

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
  // Wallet home quick action: 「兑换」
  // Prefer row-level "POL" → "兑换" (matches screenshot + reduces ambiguity).
  const clicked = await page.evaluate(() => {
    const isVisible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };

    // 1) Prefer: find a row containing "POL" (Polygon native) and click its nearby "兑换"
    const rows = Array.from(document.querySelectorAll('div'));
    for (const row of rows) {
      if (!isVisible(row)) continue;
      const txt = (row.textContent || '').replace(/\s+/g, ' ');
      if (!txt.includes('POL')) continue;
      // Look for a visible "兑换" inside this row first
      for (const el of row.querySelectorAll('span,button,div')) {
        if (!isVisible(el)) continue;
        if ((el.textContent || '').trim() === '兑换') { el.click(); return 'row:POL'; }
      }
    }

    // 2) Fallback: Wallet header area "兑换" (top portion)
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

  // Wait swap container actually visible (Playwright locator may resolve to hidden pre-mounted node)
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

async function setupPolygonSwap(page) {
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
  // Go to wallet home; some builds label the tab as 「钱包」 instead of 「首页」
  try {
    await goToWalletHome(page);
  } catch {
    await closeAllModals(page);
    await clickSidebarTab(page, 'Wallet');
    await sleep(2000);
  }

  // Switch network using the wallet home network selector flow (matches recording step 939+940)
  const alreadyPolygon = await page.evaluate(() => (document.body?.textContent || '').includes('Polygon'));
  if (!alreadyPolygon) {
    const opened = await page.evaluate(() => {
      // Click a top-bar element that contains current network label (near account/network area)
      const candidates = [];
      for (const el of document.querySelectorAll('span,div,button,svg')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.y > 120) continue;
        const t = (el.textContent || '').trim();
        if (t.includes('Polygon') || t.includes('Ethereum') || t.includes('Arbitrum') || t.includes('Optimism') || t.includes('Base') || t.includes('BSC') || t.includes('Avalanche')) {
          candidates.push({ el, y: r.y, x: r.x });
        }
      }
      candidates.sort((a, b) => (a.y - b.y) || (a.x - b.x));
      if (candidates[0]) { candidates[0].el.click(); return true; }
      return false;
    });
    if (opened) await sleep(1200);
  }

  // Ensure we are in the chain selector modal and pick Polygon (evm--137)
  // 1) If a tab "网络" exists, click it.
  await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return;
    for (const sp of modal.querySelectorAll('span')) {
      if ((sp.textContent || '').trim() === '网络' && sp.getBoundingClientRect().width > 0) { sp.click(); return; }
    }
  }).catch(() => {});
  await sleep(600);

  // 2) Search and click Polygon
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

  await openSwapFromWalletHome(page);
}

async function ensureSwapReady(page) {
  const ok = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="swap-content-container"]');
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  if (ok) return true;
  await setupPolygonSwap(page);
  return true;
}

async function focusAndClearAmountInput(page) {
  // Avoid Meta+a (Electron shortcuts). Use select() + Backspace.
  const input = page.locator('input[placeholder="0.0"]:visible').first();
  await input.waitFor({ state: 'visible', timeout: 8000 });
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('input[placeholder="0.0"]'));
    const el = els.find((x) => x.getBoundingClientRect().width > 0 && x.getBoundingClientRect().height > 0);
    if (el) { el.focus(); el.select?.(); }
  });
  await page.keyboard.press('Backspace').catch(() => {});
  await sleep(200);
  return input;
}

async function setAmount(page, value) {
  const input = await focusAndClearAmountInput(page);
  await input.pressSequentially(String(value), { delay: 40 });
  await sleep(600);
}

async function clickTokenSelector(page, which /* 0=from, 1=to */) {
  const ok = await page.evaluate((idx) => {
    const root = document.querySelector('[data-testid="swap-content-container"]');
    if (!root) return false;
    const candidates = [];
    for (const sp of root.querySelectorAll('span')) {
      const t = sp.textContent?.trim() || '';
      if (!t) continue;
      if (!/^[A-Z0-9]{2,6}$/.test(t)) continue;
      const r = sp.getBoundingClientRect();
      if (r.width < 20 || r.height < 18) continue;
      // Exclude % quick buttons (25%,50%...) and generic short UI labels.
      if (t.endsWith('%')) continue;
      if (t === 'Dex' || t === 'Gas') continue;
      candidates.push({ t, x: r.x, y: r.y, w: r.width, h: r.height });
    }
    if (candidates.length < 2) return false;
    candidates.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const target = candidates[idx];
    if (!target) return false;
    for (const sp of root.querySelectorAll('span')) {
      if ((sp.textContent?.trim() || '') !== target.t) continue;
      const r = sp.getBoundingClientRect();
      if (Math.abs(r.x - target.x) < 2 && Math.abs(r.y - target.y) < 2) {
        sp.click();
        return true;
      }
    }
    return false;
  }, which);
  if (!ok) throw new Error(`Cannot open token selector (index=${which})`);
  await sleep(1200);
}

async function selectTokenInModal(page, symbol) {
  // 1) Try click directly if token is already visible
  const direct = await page.evaluate((sym) => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return false;
    const isVisible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    for (const sp of modal.querySelectorAll('span')) {
      if ((sp.textContent || '').trim() !== sym) continue;
      if (isVisible(sp)) { sp.click(); return true; }
    }
    return false;
  }, symbol);
  if (direct) { await sleep(1200); return; }

  // 2) Use modal search input if present (any visible input in modal)
  const modalAnyInput = page.locator('[data-testid="APP-Modal-Screen"] input:visible').first();
  const hasInput = await modalAnyInput.isVisible({ timeout: 1500 }).catch(() => false);
  if (hasInput) {
    await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      const inputs = Array.from(modal?.querySelectorAll('input') || []);
      const input = inputs.find((x) => x.getBoundingClientRect().width > 0 && x.getBoundingClientRect().height > 0);
      if (input) { input.focus(); input.select?.(); }
    });
    await page.keyboard.press('Backspace').catch(() => {});
    await sleep(100);
    await modalAnyInput.pressSequentially(symbol, { delay: 40 });
    await sleep(800);
  }

  // 3) Retry click after search/scroll (up to 6 viewports)
  for (let attempt = 0; attempt < 6; attempt++) {
    const clicked = await page.evaluate((sym) => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return false;
      const isVisible = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      for (const sp of modal.querySelectorAll('span')) {
        const t = (sp.textContent || '').trim();
        if (t === sym || t.includes(sym)) {
          if (isVisible(sp)) { sp.click(); return true; }
        }
      }
      for (const el of modal.querySelectorAll('div,button')) {
        const t = (el.textContent || '').trim();
        if (!t) continue;
        if (t === sym || t.includes(sym)) {
          if (isVisible(el)) { el.click(); return true; }
        }
      }
      return false;
    }, symbol);
    if (clicked) { await sleep(1200); return; }
    // Scroll modal down to reveal more tokens
    await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (modal) modal.scrollBy(0, 420);
    });
    await sleep(350);
  }

  throw new Error(`Token "${symbol}" not found in modal`);
}

async function setPair(page, fromSymbol, toSymbol) {
  await clickTokenSelector(page, 0);
  await selectTokenInModal(page, fromSymbol);
  await clickTokenSelector(page, 1);
  await selectTokenInModal(page, toSymbol);
}

async function openProviderModal(page) {
  // Recording used the provider entry inside swap-content-container (e.g. "OKX Dex").
  const ok = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="swap-content-container"]');
    if (!root) return false;
    for (const sp of root.querySelectorAll('span')) {
      const t = sp.textContent?.trim() || '';
      const r = sp.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (t.includes('Dex') || t.includes('DEX') || t.includes('聚合')) { sp.click(); return true; }
    }
    return false;
  });
  if (!ok) {
    // Fallback: click the container image/icon (as seen in recording)
    const icon = page.locator('[data-testid="swap-content-container"] img').first();
    await icon.click({ timeout: 3000 });
  }
  await sleep(1200);
}

async function selectProvider0x(page) {
  await openProviderModal(page);
  const clicked = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return false;
    // Prefer exact label, then fall back to any option containing "0x"
    for (const sp of modal.querySelectorAll('span,div,button')) {
      const t = sp.textContent?.trim() || '';
      if (t === '0x') {
        const r = sp.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { sp.click(); return true; }
      }
    }
    for (const el of modal.querySelectorAll('span,div,button')) {
      const t = el.textContent?.trim() || '';
      if (!t.includes('0x')) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) { el.click(); return true; }
    }
    return false;
  });
  if (!clicked) throw new Error('Provider "0x" not found in provider modal');
  await sleep(1200);
}

async function clickModalText(page, text) {
  const clicked = await page.evaluate((txt) => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return false;
    for (const sp of modal.querySelectorAll('span,button,div')) {
      const t = sp.textContent?.trim() || '';
      if (t === txt) {
        const r = sp.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { sp.click(); return true; }
      }
    }
    return false;
  }, text);
  if (!clicked) throw new Error(`Modal action "${text}" not found`);
  await sleep(1500);
}

async function previewAndConfirm(page) {
  // Preview -> Confirm -> Done
  await clickModalText(page, '预览');
  await clickModalText(page, '确认');
  await clickModalText(page, '完成');
}

async function assertProvider0xVisible(page) {
  const ok = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="swap-content-container"]');
    if (!root) return false;
    return (root.textContent || '').includes('0x');
  });
  if (!ok) throw new Error('0x not visible in swap content');
}

// ── Test Cases ───────────────────────────────────────────────

async function testSwap0xPolygon001(page) {
  const t = createStepTracker('SWAP-0X-POLYGON-001');
  const shot = (p, name) => screenshot(p, SCREENSHOT_DIR, name);

  if (!await safeStep(page, t, '进入 Swap（钱包首页→兑换）', async () => {
    await ensureSwapReady(page);
  }, shot)) return t.result();

  if (!await safeStep(page, t, '设置交易对：POL → USDC', async () => {
    await setPair(page, 'POL', 'USDC');
  }, shot)) return t.result();

  if (!await safeStep(page, t, '输入金额：1', async () => {
    await setAmount(page, '1');
  }, shot)) return t.result();

  if (!await safeStep(page, t, '选择渠道：0x', async () => {
    await selectProvider0x(page);
    await assertProvider0xVisible(page);
  }, shot)) return t.result();

  if (!await safeStep(page, t, '预览→确认→完成', async () => {
    await previewAndConfirm(page);
  }, shot)) return t.result();

  return t.result();
}

async function testSwap0xPolygon002(page) {
  const t = createStepTracker('SWAP-0X-POLYGON-002');
  const shot = (p, name) => screenshot(p, SCREENSHOT_DIR, name);

  if (!await safeStep(page, t, '进入 Swap（钱包首页→兑换）', async () => {
    await ensureSwapReady(page);
  }, shot)) return t.result();

  if (!await safeStep(page, t, '设置交易对：USDC → POL', async () => {
    await setPair(page, 'USDC', 'POL');
  }, shot)) return t.result();

  if (!await safeStep(page, t, '输入金额：0.1', async () => {
    await setAmount(page, '0.1');
  }, shot)) return t.result();

  if (!await safeStep(page, t, '选择渠道：0x', async () => {
    await selectProvider0x(page);
    await assertProvider0xVisible(page);
  }, shot)) return t.result();

  if (!await safeStep(page, t, '预览→确认→完成', async () => {
    await previewAndConfirm(page);
  }, shot)) return t.result();

  return t.result();
}

async function testSwap0xPolygon003(page) {
  const t = createStepTracker('SWAP-0X-POLYGON-003');
  const shot = (p, name) => screenshot(p, SCREENSHOT_DIR, name);

  if (!await safeStep(page, t, '进入 Swap（钱包首页→兑换）', async () => {
    await ensureSwapReady(page);
  }, shot)) return t.result();

  if (!await safeStep(page, t, '设置交易对：USDC → USDT', async () => {
    await setPair(page, 'USDC', 'USDT');
  }, shot)) return t.result();

  if (!await safeStep(page, t, '点击最大', async () => {
    const ok = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="swap-content-container"]');
      if (!root) return false;
      for (const sp of root.querySelectorAll('span')) {
        if (sp.textContent?.trim() === '最大' && sp.getBoundingClientRect().width > 0) { sp.click(); return true; }
      }
      return false;
    });
    if (!ok) throw new Error('Max button not found');
    await sleep(600);
  }, shot)) return t.result();

  if (!await safeStep(page, t, '选择渠道：0x', async () => {
    await selectProvider0x(page);
    await assertProvider0xVisible(page);
  }, shot)) return t.result();

  if (!await safeStep(page, t, '预览→确认→完成', async () => {
    await previewAndConfirm(page);
  }, shot)) return t.result();

  return t.result();
}

export const testCases = [
  { id: 'SWAP-0X-POLYGON-001', name: 'Polygon 同链：POL→USDC（0x）', fn: testSwap0xPolygon001 },
  { id: 'SWAP-0X-POLYGON-002', name: 'Polygon 同链：USDC→POL（0x）', fn: testSwap0xPolygon002 },
  { id: 'SWAP-0X-POLYGON-003', name: 'Polygon 同链：USDC→USDT（0x）', fn: testSwap0xPolygon003 },
];

export async function setup(page) {
  _preReport = _preReport || { shouldSkip: () => false };
  await setupPolygonSwap(page);
  return _preReport;
}

export async function run() {
  const { browser, page } = await connectCDP();
  try {
    const onlyIds = process.argv.slice(2).filter(Boolean);
    await setup(page);
    for (const tc of testCases) {
      if (onlyIds.length && !onlyIds.includes(tc.id)) continue;
      if (_preReport?.shouldSkip?.(tc.id)) {
        console.log(` SKIP ${tc.id} ${tc.name}`);
        continue;
      }
      console.log(` RUN ${tc.id} ${tc.name}`);
      const start = Date.now();
      try {
        const rep = await tc.fn(page);
        if (rep?.status && rep.status !== 'passed') {
          throw new Error(rep.errors?.[0] || 'case failed');
        }
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
        console.log(` PASS ${tc.id} ${((dur) / 1000).toFixed(1)}s`);
      } catch (err) {
        const dur = Date.now() - start;
        console.log(` FAIL ${tc.id} ${((dur) / 1000).toFixed(1)}s ${err.message}`);
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
  } finally {
    // Don't close browser — it's the user's OneKey instance
    await sleep(200);
  }
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) run().catch(e => { console.error(e); process.exit(1); });

