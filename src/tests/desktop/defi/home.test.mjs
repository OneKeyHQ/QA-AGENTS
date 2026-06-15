// DeFi home and detail-entry smoke/regression flow (Desktop)
// Read-only coverage: home page rendering, tabs/filters, asset entry pages, and provider detail entry pages.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded, clickSidebarTab,
} from '../../helpers/index.mjs';
import { createStepTracker, safeStep } from '../../helpers/components.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'defi-home');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

export const displayName = 'DeFi 首页与入口巡检';
export const categoryTitle = 'DeFi';

const TEST_CASE_FILTER = process.argv[2] || '';

const sStep = (page, t, name, fn) => safeStep(page, t, name, fn, SCREENSHOT_DIR);

async function mustStep(page, t, name, fn) {
  const ok = await sStep(page, t, name, fn);
  if (!ok) throw new Error(`Critical step failed: ${name}`);
  return true;
}

async function isTrayTarget(page) {
  return page.evaluate(() => ({
    url: location.href,
    width: window.innerWidth,
    height: window.innerHeight,
  })).then((state) => state.url.includes('render=tray') || state.width < 700 || state.height < 600);
}

async function restartOneKey() {
  const { execSync } = await import('node:child_process');
  execSync('pkill -f "OneKey" 2>/dev/null || true');
  await sleep(2500);
}

async function connectCDPWithRetry() {
  let lastError = null;
  for (let i = 0; i < 3; i++) {
    try {
      return await connectCDP();
    } catch (err) {
      lastError = err;
      console.log(`  OneKey CDP connect failed, retrying (${i + 1}/3): ${err.message}`);
      await restartOneKey();
    }
  }
  throw lastError || new Error('Unable to connect to OneKey CDP');
}

async function ensureDesktopMainPage(browser, page) {
  if (!(await isTrayTarget(page).catch(() => false))) return { browser, page };

  console.log('  Connected to OneKey tray target, restarting main window...');
  await browser.close().catch(() => {});
  await restartOneKey();

  let lastError = null;
  for (let i = 0; i < 3; i++) {
    await sleep(1500);
    try {
      const next = await connectCDPWithRetry();
      if (await isTrayTarget(next.page).catch(() => false)) {
        lastError = new Error('Connected to OneKey tray target instead of desktop main window');
        await next.browser.close().catch(() => {});
        continue;
      }
      return next;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Unable to connect to OneKey desktop main window');
}

function findScrollContainerJS() {
  return `
    function _findScrollContainer(anchor) {
      let el = anchor;
      while (el && el !== document.body) {
        const cs = window.getComputedStyle(el);
        const oy = cs.overflowY;
        if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight + 5) return el;
        el = el.parentElement;
      }
      let best = null, bestArea = 0;
      for (const cand of document.querySelectorAll('div')) {
        const cs = window.getComputedStyle(cand);
        const oy = cs.overflowY;
        if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && cand.scrollHeight > cand.clientHeight + 5) {
          const r = cand.getBoundingClientRect();
          const area = r.width * r.height;
          if (area > bestArea) { bestArea = area; best = cand; }
        }
      }
      return best;
    }
  `;
}

async function closeDefiSubPages(page) {
  await dismissOverlays(page).catch(() => {});
  for (let i = 0; i < 5; i++) {
    const onSubPage = await page.evaluate(() => /\/defi\/EarnProtocol/.test(location.href) || /\/defi\/ManagePosition/.test(location.href));
    if (!onSubPage) break;
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(async () => {
      const pos = await page.evaluate(() => {
        for (const sel of ['[data-testid="nav-header-back"]', '[data-testid="nav-header-close"]']) {
          const el = document.querySelector(sel);
          const r = el?.getBoundingClientRect();
          if (r && r.width > 0 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
        return null;
      });
      if (pos) await page.mouse.click(pos.x, pos.y);
      else await page.mouse.click(101, 26);
    });
    await sleep(1000);
  }
}

async function waitForDefiHome(page, timeoutMs = 15000) {
  const start = Date.now();
  let last = '';
  while (Date.now() - start < timeoutMs) {
    const state = await page.evaluate(() => {
      const text = document.body?.textContent || '';
      return {
        url: location.href,
        text,
        hasOverview: !!document.querySelector('[data-testid="earn-portfolio-overview"]'),
      };
    });
    last = `${state.url} ${state.text.slice(0, 200)}`;
    if (state.url.includes('/defi') && (state.hasOverview || (state.text.includes('所有资产') && state.text.includes('常见问题')))) return;
    await sleep(500);
  }
  throw new Error(`DeFi home did not become ready: ${last}`);
}

async function openDefiHome(page) {
  await closeDefiSubPages(page);
  await clickSidebarTab(page, 'DeFi');
  await waitForDefiHome(page);
  await scrollToTop(page);
}

async function scrollToTop(page) {
  await page.evaluate((helperJS) => {
    eval(helperJS);
    const container = _findScrollContainer(document.body);
    if (container) container.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }, findScrollContainerJS());
  await sleep(500);
}

async function clickText(page, text, opts = {}) {
  const { exact = true, timeoutMs = 8000, minY = 0, maxY = null } = opts;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pos = await page.evaluate(({ text, exact, minY, maxY }) => {
      for (const el of document.querySelectorAll('span, div, button')) {
        const t = (el.textContent || '').trim();
        const matched = exact ? t === text : t.includes(text);
        if (!matched || el.children.length !== 0) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= minY && (maxY == null || r.y <= maxY)) {
          return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: t.slice(0, 80) };
        }
      }
      return null;
    }, { text, exact, minY, maxY });
    if (pos) {
      await page.mouse.click(pos.x, pos.y);
      await sleep(700);
      return pos.text;
    }
    await sleep(300);
  }
  throw new Error(`Cannot click text: ${text}`);
}

async function scrollToText(page, text, opts = {}) {
  const { exact = true, maxScrolls = 16, scrollStep = 420 } = opts;
  for (let i = 0; i <= maxScrolls; i++) {
    const found = await page.evaluate(({ text, exact, helperJS, step }) => {
      eval(helperJS);
      let domHit = null;
      for (const el of document.querySelectorAll('span, div, button, h1, h2, h3, p')) {
        const t = (el.textContent || '').trim();
        const matched = exact ? t === text : t.includes(text);
        const r = el.getBoundingClientRect();
        if (matched && el.children.length === 0 && r.width > 0 && r.height > 0 && r.x >= 0 && r.y > 60 && r.y < window.innerHeight - 40) return true;
        if (matched && r.width > 0 && r.x >= 0) domHit = el;
      }
      if (domHit) {
        domHit.scrollIntoView({ block: 'center', behavior: 'instant' });
        return false;
      }
      const container = _findScrollContainer(document.body);
      if (container) container.scrollBy(0, step);
      else window.scrollBy(0, step);
      return false;
    }, { text, exact, helperJS: findScrollContainerJS(), step: scrollStep });
    if (found) return true;
    await sleep(350);
  }
  throw new Error(`Text not visible after scroll: ${text}`);
}

async function assertNotBlank(page, context, required = []) {
  const state = await page.evaluate(() => {
    const text = (document.body?.innerText || document.body?.textContent || '').replace(/\s+/g, ' ').trim();
    const visibleTextNodes = [...document.querySelectorAll('span, div, button, input')].filter((el) => {
      const r = el.getBoundingClientRect();
      const text = (el.textContent || el.getAttribute('placeholder') || '').trim();
      return r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= 0 && r.y <= window.innerHeight && text;
    }).length;
    return { text, visibleTextNodes, url: location.href };
  });
  if (state.visibleTextNodes < 10 || state.text.length < 80) {
    throw new Error(`${context} looks blank: visibleTextNodes=${state.visibleTextNodes}, textLength=${state.text.length}, url=${state.url}`);
  }
  const missing = required.filter((s) => !state.text.includes(s));
  if (missing.length) throw new Error(`${context} missing content: ${missing.join(', ')}`);
  return `${context}: textLength=${state.text.length}, nodes=${state.visibleTextNodes}`;
}

async function clickHomeTopTab(page, tabText) {
  await scrollToTop(page);
  await clickText(page, tabText, { exact: true, timeoutMs: 6000, maxY: 360 });
  await sleep(900);
}

async function clickAssetCategory(page, text) {
  await scrollToText(page, '所有资产', { exact: true, maxScrolls: 8 });
  await clickText(page, text, { exact: true, timeoutMs: 6000, minY: 260, maxY: 640 });
  await sleep(800);
}

async function collectAssetCategories(page) {
  await scrollToText(page, '所有资产', { exact: true, maxScrolls: 8 });
  await sleep(500);
  const categories = await page.evaluate(() => {
    const excluded = new Set([
      '所有资产', '持仓', '常见问题', '资产', '网络', 'APR/APY', '总流动性',
      '所有网络', '搜索资产',
      '现货', 'DeFi', 'NFT', '历史记录', '代币', 'DeFi 代币', '最近活动',
    ]);
    let filterRow = null;
    for (const el of document.querySelectorAll('span, div, button')) {
      const text = (el.textContent || '').trim();
      const r = el.getBoundingClientRect();
      if (text === '所有网络' && el.children.length === 0 && r.width > 0 && r.height > 0 && r.x > 500 && r.y > 250) {
        filterRow = { x: r.x, y: r.y + r.height / 2 };
        break;
      }
    }
    const out = [];
    if (!filterRow) return out;
    for (const el of document.querySelectorAll('span, div, button')) {
      const text = (el.textContent || '').trim();
      const r = el.getBoundingClientRect();
      const cy = r.y + r.height / 2;
      const looksLikeCategory = text
        && !excluded.has(text)
        && el.children.length === 0
        && r.width >= 20
        && r.width <= 160
        && r.height >= 16
        && r.height <= 56
        && r.x >= 80
        && r.x < filterRow.x - 20
        && Math.abs(cy - filterRow.y) <= 50
        && !/^\d/.test(text)
        && !/[%$]/.test(text);
      if (looksLikeCategory && !out.includes(text)) out.push(text);
    }
    return out;
  });
  if (categories.length) return categories;
  return ['简单赚币', '固定收益', '质押'];
}

async function clickNetworkFilter(page) {
  const pos = await page.evaluate(() => {
    for (const el of document.querySelectorAll('span, div, button')) {
      const text = (el.textContent || '').trim();
      const r = el.getBoundingClientRect();
      if (text === '所有网络' && r.width > 0 && r.height > 0 && r.x >= 0 && r.y > 360) {
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
    }
    return null;
  });
  if (!pos) throw new Error('Network filter "所有网络" not found');
  await page.mouse.click(pos.x, pos.y);
  await sleep(800);
  const visible = await page.evaluate(() => {
    const text = document.body?.textContent || '';
    return /(Ethereum|Base|BNB|Solana|Bitcoin|网络)/i.test(text);
  });
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(400);
  if (!visible) throw new Error('Network filter content did not open');
  return 'network filter opened';
}

const ASSET_SYMBOL_RE = /^[A-Za-z][A-Za-z0-9]{1,15}$/;

async function clickAssetSearch(page, query = 'USDC') {
  const input = page.locator('input[placeholder*="搜索资产"]').first();
  if (await input.isVisible({ timeout: 1200 }).catch(() => false)) {
    await input.click({ force: true });
    await input.fill(query);
  } else {
    const pos = await page.evaluate(() => {
      for (const el of document.querySelectorAll('span, div, button')) {
        const text = (el.textContent || '').trim();
        const r = el.getBoundingClientRect();
        if (text === '搜索资产' && r.width > 0 && r.height > 0 && r.x > 900 && r.y > 360) {
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
      }
      return null;
    });
    if (!pos) return 'asset search input not visible, skipped';
    await page.mouse.click(pos.x, pos.y);
    await sleep(300);
    await page.keyboard.type(query, { delay: 40 });
  }
  await sleep(800);
  const ok = await page.evaluate((query) => {
    const text = document.body?.textContent || '';
    return text.toLowerCase().includes(query.toLowerCase()) && /(APY|APR|Earn points|\d+(?:\.\d+)?\s*%)/.test(text);
  }, query);
  await page.keyboard.press('Meta+A').catch(() => {});
  await page.keyboard.press('Backspace').catch(() => {});
  await sleep(500);
  if (!ok) throw new Error(`Search ${query} did not show expected content`);
  return `search ${query} ok`;
}

async function collectVisibleAssetSymbols(page) {
  await scrollToText(page, '资产', { exact: true, maxScrolls: 10 });
  return page.evaluate(() => {
    const out = [];
    for (const row of document.querySelectorAll('div')) {
      const rowText = (row.textContent || '').replace(/\s+/g, ' ').trim();
      const rr = row.getBoundingClientRect();
      if (rr.width < 900 || rr.height < 36 || rr.height > 90 || rr.x < 100 || rr.y < 420 || rr.y > window.innerHeight - 20) continue;
      if (!/%|APY|APR|持有即赚取|奖励/.test(rowText)) continue;
      for (const el of row.querySelectorAll('span, div')) {
        const text = (el.textContent || '').trim();
        const r = el.getBoundingClientRect();
        if (!/^[A-Za-z][A-Za-z0-9]{1,15}$/.test(text) || el.children.length !== 0) continue;
        if (r.width > 0 && r.height > 0 && r.x >= 100 && r.y >= rr.y && r.y <= rr.y + rr.height) {
          if (!out.includes(text)) out.push(text);
          break;
        }
      }
    }
    if (out.length) return out.slice(0, 8);
    for (const el of document.querySelectorAll('span, div')) {
      const text = (el.textContent || '').trim();
      const r = el.getBoundingClientRect();
      if (!/^[A-Za-z][A-Za-z0-9]{1,15}$/.test(text) || el.children.length !== 0) continue;
      if (r.width > 0 && r.height > 0 && r.x >= 100 && r.y > 420 && r.y < window.innerHeight - 20) {
        if (!out.includes(text)) out.push(text);
      }
    }
    return out.slice(0, 8);
  });
}

async function collectVisibleAssetRows(page) {
  return page.evaluate((symbolReSource) => {
    const symbolRe = new RegExp(symbolReSource);
    const rows = [];
    const seen = new Set();
    const excluded = new Set(['APY', 'APR', 'TVL', 'USD', 'SimpleEarn', 'FixedRate', 'Staking']);
    for (const row of document.querySelectorAll('div')) {
      const rr = row.getBoundingClientRect();
      const rowText = (row.textContent || '').replace(/\s+/g, ' ').trim();
      const looksLikeAssetRow = rr.width > 900
        && rr.height >= 46
        && rr.height <= 110
        && rr.x >= 0
        && rr.y >= 300
        && rr.y <= window.innerHeight - 12
        && !/^(资产|网络|总流动性|APR\/APY)/.test(rowText)
        && !/\bAPY\b|\bAPR\b/.test(rowText)
        && /(奖励|持有即赚取|Earn points|\d+(?:\.\d+)?\s*%|\$\s*[\d.]+[KMB]?)/.test(rowText);
      if (!looksLikeAssetRow) continue;

      const symbolCandidates = [];
      for (const el of row.querySelectorAll('span, div')) {
        const text = (el.textContent || '').trim();
        const r = el.getBoundingClientRect();
        if (
          symbolRe.test(text)
          && !excluded.has(text)
          && el.children.length === 0
          && r.width > 0
          && r.height > 0
          && r.x >= 60
          && r.x <= 360
          && r.y >= rr.y
          && r.y <= rr.y + rr.height
        ) {
          symbolCandidates.push({ symbol: text, x: r.x });
        }
      }
      const symbol = symbolCandidates.sort((a, b) => a.x - b.x)[0]?.symbol;
      if (!symbol || seen.has(symbol)) continue;
      seen.add(symbol);
      rows.push({ symbol, rowText: rowText.slice(0, 180), y: rr.y });
    }
    return rows;
  }, ASSET_SYMBOL_RE.source);
}

async function collectCategoryAssetSymbols(page, category) {
  await clickAssetCategory(page, category);
  await page.evaluate((helperJS) => {
    eval(helperJS);
    const container = _findScrollContainer(document.body);
    if (container) container.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }, findScrollContainerJS());
  await scrollToText(page, '资产', { exact: true, maxScrolls: 8 });
  await sleep(800);

  const symbols = [];
  const seen = new Set();
  let stillCount = 0;
  let lastScrollTop = -1;

  for (let i = 0; i < 18; i++) {
    const rows = await collectVisibleAssetRows(page);
    for (const row of rows) {
      if (!seen.has(row.symbol)) {
        seen.add(row.symbol);
        symbols.push(row.symbol);
      }
    }
    const scrollState = await page.evaluate((helperJS) => {
      eval(helperJS);
      const container = _findScrollContainer(document.body);
      const target = container || document.scrollingElement || document.documentElement;
      const before = target.scrollTop;
      target.scrollBy(0, Math.max(280, Math.floor(window.innerHeight * 0.65)));
      return {
        before,
        after: target.scrollTop,
        max: target.scrollHeight - target.clientHeight,
      };
    }, findScrollContainerJS());
    await sleep(450);
    if (scrollState.after === lastScrollTop || scrollState.after === scrollState.before || scrollState.after >= scrollState.max - 2) {
      stillCount += 1;
    } else {
      stillCount = 0;
    }
    lastScrollTop = scrollState.after;
    if (stillCount >= 2) break;
  }

  if (symbols.length === 0) throw new Error(`No assets collected for ${category}`);
  return symbols;
}

async function clickAssetTableRow(page, symbol, opts = {}) {
  const { target = 'arrow' } = opts;
  await scrollToText(page, '资产', { exact: true, maxScrolls: 8 });
  for (let attempt = 0; attempt < 14; attempt++) {
    const pos = await page.evaluate(({ symbol, target }) => {
      const candidates = [];
      for (const el of document.querySelectorAll('span, div')) {
        const text = (el.textContent || '').trim();
        const r = el.getBoundingClientRect();
        if (text !== symbol || el.children.length !== 0 || r.width <= 0 || r.height <= 0 || r.x < 0 || r.y < 280 || r.y > window.innerHeight - 20) continue;
        candidates.push(el);
      }
      for (const el of candidates) {
        let p = el;
        for (let d = 0; d < 10 && p; d++) {
          const pr = p.getBoundingClientRect();
          const rowText = (p.textContent || '').replace(/\s+/g, ' ').trim();
          if (rowText.includes(symbol) && /%|持有即赚取|奖励|Earn points|\$\s*[\d.]+[KMB]?/.test(rowText) && !/\bAPY\b|\bAPR\b/.test(rowText) && pr.width > 900 && pr.height >= 36 && pr.height <= 110 && pr.x >= 0) {
            const er = el.getBoundingClientRect();
            return {
              x: target === 'symbol' ? er.x + er.width / 2 : pr.x + pr.width - 28,
              y: target === 'symbol' ? er.y + er.height / 2 : pr.y + pr.height / 2,
              rowText: rowText.slice(0, 160),
            };
          }
          p = p.parentElement;
        }
      }
      return null;
    }, { symbol, target });
    if (pos) {
      await page.mouse.click(pos.x, pos.y);
      await sleep(1800);
      return pos.rowText;
    }
    await page.evaluate((helperJS) => {
      eval(helperJS);
      const container = _findScrollContainer(document.body);
      if (container) container.scrollBy(0, 360);
      else window.scrollBy(0, 360);
    }, findScrollContainerJS());
    await sleep(350);
  }
  throw new Error(`Asset table row not found: ${symbol}`);
}

async function assertAssetProtocolList(page, symbol) {
  const text = await page.evaluate(() => document.body?.textContent || '');
  if (!text.includes(symbol)) throw new Error(`${symbol} protocol list missing symbol`);
  if (!/协议|网络|APR\/APY|APY|APR/.test(text)) throw new Error(`${symbol} protocol list missing headers/rates`);
  if (!/\d+(?:\.\d+)?\s*%|Earn points/.test(text)) throw new Error(`${symbol} protocol list missing APY/APR value`);
  return `${symbol} protocol list visible`;
}

async function assertAssetEntryPage(page, symbol) {
  const start = Date.now();
  let state = null;
  while (Date.now() - start < 8000) {
    state = await page.evaluate(() => ({
      url: location.href,
      text: (document.body?.innerText || document.body?.textContent || '').replace(/\s+/g, ' ').trim(),
    }));
    if (state.url.includes('/defi/EarnProtocols') || state.url.includes('/defi/EarnProtocolDetails') || state.url.includes('/ManagePosition')) break;
    await sleep(400);
  }
  if (!state?.url?.includes('/defi/EarnProtocol') && !state?.url?.includes('/ManagePosition')) {
    throw new Error(`${symbol} did not enter DeFi asset/protocol page: ${state?.url || ''}`);
  }
  if (state.text.length < 80) throw new Error(`${symbol} entry page looks blank: ${state.url}`);
  if (!state.text.toLowerCase().includes(symbol.toLowerCase())) {
    throw new Error(`${symbol} entry page missing symbol: ${state.url}`);
  }
  if (state.url.includes('/defi/EarnProtocols')) {
    if (!/协议|网络|APR\/APY|APY|APR/.test(state.text)) {
      throw new Error(`${symbol} protocol list missing headers: ${state.url}`);
    }
    if (!/\d+(?:\.\d+)?\s*%|Earn points/.test(state.text)) {
      throw new Error(`${symbol} protocol list missing rate/points: ${state.url}`);
    }
    return `${symbol} protocol list visible`;
  }
  if (state.url.includes('/ManagePosition')) {
    if (!/(认购|赎回|金额|余额|预览|网络|APY|APR)/.test(state.text)) {
      throw new Error(`${symbol} manage position page missing key content: ${state.url}`);
    }
    return `${symbol} manage position page visible`;
  }
  if (!/(APY|APR|Earn points|认购|赎回|历史记录|网络|简介|收益)/.test(state.text)) {
    throw new Error(`${symbol} protocol detail missing key content: ${state.url}`);
  }
  return `${symbol} direct protocol detail visible`;
}

async function clickFirstProviderRow(page, opts = {}) {
  const { avoidNative = false } = opts;
  const pos = await page.evaluate((avoidNative) => {
    const rows = [];
    for (const el of document.querySelectorAll('span, div')) {
      const text = (el.textContent || '').trim();
      const r = el.getBoundingClientRect();
      if (el.children.length !== 0 || r.width <= 0 || r.height <= 0 || r.x < 0 || r.y < 180) continue;
      if (!text || /^(协议|网络|TVL|APR\/APY)$/.test(text)) continue;
      let p = el;
      for (let d = 0; d < 10 && p; d++) {
        const pr = p.getBoundingClientRect();
        const rowText = (p.textContent || '').replace(/\s+/g, ' ').trim();
        const isProtocolRow = pr.width > 900
          && pr.height >= 42
          && pr.height <= 80
          && pr.x >= 100
          && pr.y >= 220
          && pr.y <= 620
          && /\$\s*[\d.]+[KMB]?/.test(rowText)
          && /\d+(?:\.\d+)?\s*%/.test(rowText)
          && !/\bAPY\b|\bAPR\b/.test(rowText);
        if (isProtocolRow) {
          if (avoidNative && /^Native\b/.test(rowText)) break;
          rows.push({ x: pr.x + pr.width - 28, y: pr.y + pr.height / 2, rowText: rowText.slice(0, 160) });
          break;
        }
        p = p.parentElement;
      }
    }
    return rows[0] || null;
  }, avoidNative);
  if (!pos) throw new Error('Provider row not found');
  await page.mouse.click(pos.x, pos.y);
  await sleep(2500);
  return pos.rowText;
}

async function assertProviderDetail(page, context) {
  const state = await page.evaluate(() => {
    const visibleText = [];
    for (const el of document.querySelectorAll('span, div, button, input')) {
      const r = el.getBoundingClientRect();
      const text = (el.textContent || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim();
      if (r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= 0 && r.y <= window.innerHeight && text) {
        visibleText.push(text);
      }
    }
    return { url: location.href, text: visibleText.join(' ') };
  });
  if (!state.url.includes('/defi/EarnProtocolDetails')) {
    throw new Error(`${context} did not enter provider detail page: ${state.url}`);
  }
  const text = state.text;
  const requiredPatterns = [/APY|APR/, /认购|赎回|历史记录/, /网络|TVL|简介|收益/];
  const missing = requiredPatterns.filter((re) => !re.test(text)).map((re) => re.source);
  if (missing.length) throw new Error(`${context} provider detail missing: ${missing.join(', ')}`);
  if (!/\d+(?:\.\d+)?\s*%/.test(text)) throw new Error(`${context} provider detail missing rate`);
  return `${context} provider detail visible`;
}

async function goBackToDefiHome(page) {
  for (let i = 0; i < 4; i++) {
    const url = await page.evaluate(() => location.href);
    if (url.endsWith('/defi') || url.includes('/defi?')) break;
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {});
    await sleep(1000);
  }
  await openDefiHome(page);
}

async function testHomeRender(page) {
  const t = createStepTracker('DEFI-HOME-001');

  await mustStep(page, t, '进入 DeFi 首页并检查非白屏', async () => {
    await openDefiHome(page);
    return assertNotBlank(page, 'DeFi home', ['赚币', '借币', '所有资产', '持仓', '常见问题']);
  });

  await sStep(page, t, '检查首页概览和热门数据', async () => {
    const text = await page.evaluate(() => document.body?.textContent || '');
    const required = ['总认购价值', '预计 24 小时收益', '热门', 'USDT', 'WETH', 'USDC', 'SOL'];
    const missing = required.filter((s) => !text.includes(s));
    if (missing.length) throw new Error(`Missing home content: ${missing.join(', ')}`);
    if (!/\d+(?:\.\d+)?\s*%\s*-\s*\d+(?:\.\d+)?\s*%\s*APY|\d+(?:\.\d+)?\s*%\s*APY/.test(text)) {
      throw new Error('Missing hot APY data');
    }
    return 'overview/hot cards visible';
  });

  await sStep(page, t, '检查资产列表表头和数据', async () => {
    await scrollToText(page, '所有资产');
    const symbols = await collectVisibleAssetSymbols(page);
    if (symbols.length < 3) throw new Error(`Too few visible assets: ${symbols.join(', ')}`);
    const text = await page.evaluate(() => document.body?.textContent || '');
    for (const required of ['资产', '网络', 'APR/APY']) {
      if (!text.includes(required)) throw new Error(`Missing list header: ${required}`);
    }
    return `visible assets: ${symbols.join(', ')}`;
  });

  return t.result();
}

async function testHomeControls(page) {
  const t = createStepTracker('DEFI-HOME-002');

  await mustStep(page, t, '进入 DeFi 首页', async () => {
    await openDefiHome(page);
    return 'home ready';
  });

  for (const tab of ['所有资产', '持仓', '常见问题', '所有资产']) {
    await sStep(page, t, `切换顶部 tab: ${tab}`, async () => {
      await clickHomeTopTab(page, tab);
      return assertNotBlank(page, `tab ${tab}`, [tab]);
    });
  }

  const categories = await collectAssetCategories(page);
  for (const category of categories) {
    await sStep(page, t, `切换资产分类: ${category}`, async () => {
      await clickAssetCategory(page, category);
      const text = await page.evaluate(() => document.body?.textContent || '');
      if (!text.includes(category)) throw new Error(`Category did not render: ${category}`);
      return `${category} visible`;
    });
  }

  await sStep(page, t, '打开网络筛选', async () => {
    await clickAssetCategory(page, categories[0]);
    return clickNetworkFilter(page);
  });

  const searches = [];
  for (const category of categories.slice(0, 3)) {
    await openDefiHome(page);
    try {
      const symbols = await collectCategoryAssetSymbols(page, category);
      if (symbols[0]) searches.push({ category, query: symbols[0] });
    } catch {
      // Category contents are data-driven. Search coverage only needs one valid visible asset.
    }
  }
  if (searches.length === 0) {
    await openDefiHome(page);
    const symbols = await collectVisibleAssetSymbols(page);
    if (symbols[0]) searches.push({ category: '当前列表', query: symbols[0] });
  }
  if (searches.length === 0) throw new Error('No searchable DeFi asset found');
  for (const item of searches) {
    await sStep(page, t, `搜索资产 ${item.query} (${item.category})`, async () => {
      await clickAssetCategory(page, item.category);
      return clickAssetSearch(page, item.query);
    });
  }

  return t.result();
}

async function testAssetEntryPages(page) {
  const t = createStepTracker('DEFI-HOME-003');

  let categories = [];
  await mustStep(page, t, '进入 DeFi 首页', async () => {
    await openDefiHome(page);
    categories = await collectAssetCategories(page);
    await clickAssetCategory(page, categories[0]);
    return 'home asset list ready';
  });

  const samples = [];
  for (const category of categories.slice(0, 3)) {
    await openDefiHome(page);
    const symbols = await collectCategoryAssetSymbols(page, category);
    for (const symbol of symbols.slice(0, 2)) {
      samples.push({ category, symbol });
    }
  }

  for (const sample of samples.slice(0, 6)) {
    await sStep(page, t, `进入 ${sample.category} / ${sample.symbol} 入口页并检查数据`, async () => {
      await openDefiHome(page);
      await clickAssetCategory(page, sample.category);
      await clickAssetTableRow(page, sample.symbol);
      const result = await assertAssetEntryPage(page, sample.symbol);
      await goBackToDefiHome(page);
      return result;
    });
  }

  return t.result();
}

async function testAllCategoryAssetEntryPages(page) {
  const t = createStepTracker('DEFI-HOME-005');

  await mustStep(page, t, '进入 DeFi 首页', async () => {
    await openDefiHome(page);
    return 'home ready';
  });

  const categoryNames = await collectAssetCategories(page);
  for (const [index, categoryName] of categoryNames.entries()) {
    const clickLimit = index === 0 ? 7 : 8;
    let symbols = [];
    await mustStep(page, t, `收集 ${categoryName} 资产列表`, async () => {
      await openDefiHome(page);
      symbols = await collectCategoryAssetSymbols(page, categoryName);
      return `${categoryName}: ${symbols.join(', ')}`;
    });

    const symbolsToClick = symbols.slice(0, clickLimit);
    for (const symbol of symbolsToClick) {
      await sStep(page, t, `${categoryName} 资产入口: ${symbol}`, async () => {
        await openDefiHome(page);
        await clickAssetCategory(page, categoryName);
        await clickAssetTableRow(page, symbol, { target: 'symbol' });
        const result = await assertAssetEntryPage(page, symbol);
        await goBackToDefiHome(page);
        return result;
      });
    }
  }

  return t.result();
}

async function testProviderDetailEntries(page) {
  const t = createStepTracker('DEFI-HOME-004');

  const flows = [
    { symbol: 'USDT', category: '简单赚币', avoidNative: false },
    { symbol: 'USDC', category: '简单赚币', avoidNative: true },
    { symbol: 'SOL', category: '质押', avoidNative: false },
  ];

  for (const flow of flows) {
    await mustStep(page, t, `进入 ${flow.symbol} 第一个协议详情页并检查非白屏`, async () => {
      await openDefiHome(page);
      await clickAssetCategory(page, flow.category);
      await clickAssetTableRow(page, flow.symbol);
      await assertAssetProtocolList(page, flow.symbol);
      const provider = await clickFirstProviderRow(page, { avoidNative: flow.avoidNative });
      const result = await assertProviderDetail(page, `${flow.symbol} ${provider}`);
      await goBackToDefiHome(page);
      return result;
    });
  }

  return t.result();
}

export const testCases = [
  { id: 'DEFI-HOME-001', name: 'DeFi 首页非白屏与关键数据展示', fn: testHomeRender },
  { id: 'DEFI-HOME-002', name: 'DeFi 首页 tab/分类/筛选/搜索交互', fn: testHomeControls },
  { id: 'DEFI-HOME-003', name: 'DeFi 资产入口协议列表页巡检', fn: testAssetEntryPages },
  { id: 'DEFI-HOME-004', name: 'DeFi 协议详情入口巡检', fn: testProviderDetailEntries },
  { id: 'DEFI-HOME-005', name: 'DeFi 三类资产全量入口巡检', fn: testAllCategoryAssetEntryPages },
];

export async function setup(page) {
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
}

export async function run() {
  let { browser, page } = await connectCDPWithRetry();
  ({ browser, page } = await ensureDesktopMainPage(browser, page));

  console.log('\n' + '='.repeat(60));
  console.log('  DeFi Home Desktop Test');
  console.log('='.repeat(60));

  await setup(page);

  const selectedCases = TEST_CASE_FILTER
    ? testCases.filter((tc) => tc.id === TEST_CASE_FILTER || tc.id.includes(TEST_CASE_FILTER))
    : testCases;
  if (selectedCases.length === 0) throw new Error(`No matching test case: ${TEST_CASE_FILTER}`);

  const results = [];
  for (const tc of selectedCases) {
    const start = Date.now();
    console.log(`\n${'-'.repeat(60)}`);
    console.log(`[${tc.id}] ${tc.name}`);
    console.log('-'.repeat(60));
    try {
      const result = await tc.fn(page);
      const duration = Date.now() - start;
      const r = {
        testId: tc.id,
        status: result.status,
        duration,
        steps: result.steps,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      };
      console.log(`>> ${tc.id}: ${r.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s)`);
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    } catch (err) {
      const duration = Date.now() - start;
      const screenshotPath = await screenshot(page, SCREENSHOT_DIR, `${tc.id}-error`);
      const r = {
        testId: tc.id,
        status: 'failed',
        duration,
        error: err.message,
        screenshot: screenshotPath,
        timestamp: new Date().toISOString(),
      };
      console.error(`>> ${tc.id}: FAILED (${(duration / 1000).toFixed(1)}s) - ${err.message}`);
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }
    try { await dismissOverlays(page); } catch {}
    await sleep(1000);
  }

  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.filter((r) => r.status !== 'passed').length;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length, results };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run()
    .then((result) => process.exit(result.status === 'passed' ? 0 : 1))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
