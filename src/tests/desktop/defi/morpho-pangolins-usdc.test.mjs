// DeFi Morpho Pangolins USDC stake/redeem regression flow (Desktop)
// Generated from recording: shared/results/recording/steps.json (2026-06-11)
// Scope:
// - Detail page, APY/info/content exploration.
// - Input 100 USDC for dynamic APY/yield validation only.
// - Submit 0.01 USDC subscribe and 0.001 USDC redeem when the app/account allows it.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
  handlePasswordPromptIfPresent,
  clickSidebarTab,
} from '../../helpers/index.mjs';
import { createStepTracker, safeStep } from '../../helpers/components.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'defi-morpho-pangolins-usdc');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

export const displayName = 'Morpho Pangolins USDC';
export const categoryTitle = 'DeFi';

const PROBE_AMOUNT = '100';
const SUBSCRIBE_AMOUNT = '0.01';
const REDEEM_AMOUNT = '0.001';
const TEST_CASE_FILTER = process.argv[2] || '';

const sStep = (page, t, name, fn) => safeStep(page, t, name, fn, SCREENSHOT_DIR);

async function mustStep(page, t, name, fn) {
  const ok = await sStep(page, t, name, fn);
  if (!ok) throw new Error(`Critical step failed: ${name}`);
  return true;
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

async function clickVisibleTestid(page, testid, opts = {}) {
  const { containsText = '', timeoutMs = 10000 } = opts;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pos = await page.evaluate(({ testid, containsText }) => {
      for (const el of document.querySelectorAll(`[data-testid="${testid}"]`)) {
        const text = el.textContent || '';
        if (containsText && !text.includes(containsText)) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.x >= 0) {
          return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: text.trim().slice(0, 80) };
        }
      }
      return null;
    }, { testid, containsText });
    if (pos) {
      await page.mouse.click(pos.x, pos.y);
      await sleep(700);
      return pos.text || testid;
    }
    await sleep(300);
  }
  throw new Error(`Visible testid not found: ${testid}`);
}

async function clickText(page, text, opts = {}) {
  const { exact = true, timeoutMs = 8000, maxY = null, minY = 0 } = opts;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pos = await page.evaluate(({ text, exact, maxY, minY }) => {
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
    }, { text, exact, maxY, minY });
    if (pos) {
      await page.mouse.click(pos.x, pos.y);
      await sleep(700);
      return pos.text;
    }
    await sleep(300);
  }
  throw new Error(`Cannot click text: ${text}`);
}

async function closeSubPages(page) {
  await dismissOverlays(page).catch(() => {});
  for (let i = 0; i < 5; i++) {
    const pos = await page.evaluate(() => {
      for (const sel of ['[data-testid="nav-header-close"]', '[data-testid="nav-header-back"]']) {
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && r.x >= 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
      }
      return null;
    });
    if (!pos) break;
    await page.mouse.click(pos.x, pos.y);
    await sleep(700);
  }
  for (let i = 0; i < 3; i++) {
    const onDefiSubPage = await page.evaluate(() => /\/defi\/EarnProtocol/.test(location.href));
    if (!onDefiSubPage) break;
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(async () => {
      await page.mouse.click(101, 26);
    });
    await sleep(1000);
  }
}

async function waitForDefiReady(page, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ready = await page.evaluate(() => {
      const text = document.body?.textContent || '';
      if (text.includes('所有资产') || text.includes('持仓') || text.includes('质押')) return true;
      return !!document.querySelector('[data-testid="earn-portfolio-overview"]');
    });
    if (ready) return;
    await sleep(500);
  }
  throw new Error('DeFi page did not become ready');
}

async function openDefiAssetList(page) {
  await closeSubPages(page);
  await clickSidebarTab(page, 'DeFi');
  await waitForDefiReady(page);
  await clickText(page, '所有资产', { exact: true, timeoutMs: 6000, maxY: 580 }).catch(() => {});
  await sleep(1000);
}

async function scrollToTop(page) {
  await page.evaluate((helperJS) => {
    eval(helperJS);
    const container = _findScrollContainer(document.body);
    if (container) container.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }, findScrollContainerJS());
  await sleep(600);
}

async function scrollToText(page, text, opts = {}) {
  const { exact = true, maxScrolls = 18, scrollStep = 420 } = opts;
  for (let i = 0; i <= maxScrolls; i++) {
    const found = await page.evaluate(({ text, exact, helperJS, step }) => {
      eval(helperJS);
      let domHit = null;
      for (const el of document.querySelectorAll('span, div, button, h1, h2, h3, p')) {
        const t = (el.textContent || '').trim();
        const matched = exact ? t === text : t.includes(text);
        if (!matched || el.children.length !== 0) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.x >= 0 && r.y > 70 && r.y < window.innerHeight - 40) return true;
        if (r.width > 0 && r.x >= 0) domHit = el;
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
    await sleep(400);
  }
  throw new Error(`Text not visible after scroll: ${text}`);
}

async function scrollAndClickRowText(page, text, opts = {}) {
  const {
    exact = true,
    maxScrolls = 24,
    scrollStep = 420,
    parentMinWidth = 360,
    rowMinHeight = 28,
    rowMaxHeight = 160,
    minY = 70,
    maxY = null,
    alsoIncludes = [],
  } = opts;

  for (let i = 0; i <= maxScrolls; i++) {
    const result = await page.evaluate(({ text, exact, helperJS, step, parentMinWidth, rowMinHeight, rowMaxHeight, minY, maxY, alsoIncludes }) => {
      eval(helperJS);
      const candidates = [];
      const domCandidates = [];
      const viewportMaxY = maxY == null ? window.innerHeight - 40 : maxY;
      for (const el of document.querySelectorAll('span, div')) {
        const t = (el.textContent || '').trim();
        const matched = exact ? t === text : t.includes(text);
        if (!matched || el.children.length !== 0) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.x < 0) continue;
        if (r.y > minY && r.y < viewportMaxY) candidates.push(el);
        else domCandidates.push(el);
      }

      for (const textEl of candidates) {
        let p = textEl;
        for (let d = 0; d < 12 && p; d++) {
          const r = p.getBoundingClientRect();
          const rowText = (p.textContent || '').replace(/\s+/g, ' ').trim();
          const hasAll = alsoIncludes.every((s) => rowText.includes(s));
          const cs = window.getComputedStyle(p);
          const clickable = p.onclick || cs.cursor === 'pointer' || p.getAttribute('role') === 'button' || r.width >= parentMinWidth;
          if (hasAll && clickable && r.width >= parentMinWidth && r.height >= rowMinHeight && r.height <= rowMaxHeight && r.x >= 0) {
            return { inView: true, x: r.x + r.width / 2, y: r.y + r.height / 2, text: rowText.slice(0, 120) };
          }
          p = p.parentElement;
        }
      }

      const anchor = domCandidates[0] || candidates[0] || document.querySelector('[data-testid="earn-portfolio-overview"]') || document.body;
      const container = _findScrollContainer(anchor);
      if (domCandidates[0]) {
        domCandidates[0].scrollIntoView({ block: 'center', behavior: 'instant' });
        return { needRescan: true };
      }
      if (container) {
        container.scrollBy(0, step);
        return { scrolled: true };
      }
      window.scrollBy(0, step);
      return { scrolled: true };
    }, { text, exact, helperJS: findScrollContainerJS(), step: scrollStep, parentMinWidth, rowMinHeight, rowMaxHeight, minY, maxY, alsoIncludes });

    if (result?.inView) {
      await page.mouse.click(result.x, result.y);
      await sleep(1200);
      return result.text || text;
    }
    await sleep(400);
  }
  throw new Error(`Row text not found: ${text}`);
}

async function fillAmount(page, amount) {
  const selectors = [
    '[data-testid="amount-input-input-element-input"]',
    '[data-testid="staking-stake-amount-input"]',
    '[data-testid="earn-amount-input"]',
    'input[placeholder="0"]',
  ];
  let input = null;
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if (await loc.isVisible({ timeout: 800 }).catch(() => false)) {
      input = loc;
      break;
    }
  }
  if (!input) throw new Error('Amount input not visible');
  await input.click({ clickCount: 3, force: true });
  await sleep(150);
  await page.keyboard.press('Backspace');
  await sleep(150);
  await input.pressSequentially(amount, { delay: 40 });
  await sleep(1200);
}

async function clearAmount(page) {
  const input = page.locator('[data-testid="amount-input-input-element-input"], input[placeholder="0"]').first();
  if (!(await input.isVisible({ timeout: 1000 }).catch(() => false))) return;
  await input.click({ clickCount: 3, force: true });
  await page.keyboard.press('Backspace');
  await sleep(400);
}

async function getInputValue(page) {
  return page.evaluate(() => {
    const input = document.querySelector('[data-testid="amount-input-input-element-input"]')
      || document.querySelector('input[placeholder="0"]');
    return input?.value ?? null;
  });
}

async function clickAssetTableRow(page, symbol) {
  const pos = await page.evaluate((symbol) => {
    for (const el of document.querySelectorAll('span, div')) {
      const text = (el.textContent || '').trim();
      const r = el.getBoundingClientRect();
      if (text !== symbol || el.children.length !== 0 || r.width <= 0 || r.height <= 0 || r.x < 0 || r.y < 650) continue;
      let p = el;
      for (let d = 0; d < 10 && p; d++) {
        const pr = p.getBoundingClientRect();
        const rowText = (p.textContent || '').replace(/\s+/g, ' ').trim();
        if (rowText.includes(symbol) && pr.width > 900 && pr.height >= 40 && pr.height <= 80 && pr.x >= 0) {
          return { x: pr.x + pr.width - 28, y: pr.y + pr.height / 2, rowText: rowText.slice(0, 120) };
        }
        p = p.parentElement;
      }
    }
    return null;
  }, symbol);
  if (!pos) throw new Error(`Asset table row not found: ${symbol}`);
  await page.mouse.click(pos.x, pos.y);
  await sleep(1800);
  return pos.rowText;
}

async function assertPageHasMorpho(page) {
  const text = await page.evaluate(() => document.body?.textContent || '');
  const required = ['Morpho', 'Pangolins', 'USDC', '认购'];
  const missing = required.filter((s) => !text.includes(s));
  if (missing.length) throw new Error(`Missing Morpho detail content: ${missing.join(', ')}`);
  if (!/APY|APR|预估年收益/.test(text)) throw new Error('Missing APY/APR or estimated annual yield content');
}

async function openMorphoDetail(page) {
  await openDefiAssetList(page);
  await scrollToTop(page);
  await clickAssetTableRow(page, 'USDC');
  const onUsdcProtocols = await page.evaluate(() => /symbol=USDC/i.test(location.href) || /DeFi\s*>\s*USDC|USDC\s+协议/.test(document.body?.textContent || ''));
  if (!onUsdcProtocols) {
    const url = await page.evaluate(() => location.href);
    throw new Error(`Expected USDC protocol list, got ${url}`);
  }
  await scrollAndClickRowText(page, 'Pangolins', {
    exact: false,
    maxScrolls: 18,
    scrollStep: 380,
    parentMinWidth: 260,
    alsoIncludes: ['Morpho'],
  });
  await sleep(2500);
  await assertPageHasMorpho(page);
}

async function openApyPopover(page) {
  await scrollToTop(page);
  const clickedByTestid = await clickVisibleTestid(page, 'staking-claim-with-kyc-action-icon-btn', { timeoutMs: 1200 })
    .then(() => true)
    .catch(() => false);
  if (!clickedByTestid) {
    const pos = await page.evaluate(() => {
      for (const el of document.querySelectorAll('span, div')) {
        const text = (el.textContent || '').trim();
        const r = el.getBoundingClientRect();
        if (!/^[\d.]+%\s*(APR|APY)$/i.test(text) || r.width <= 0 || r.height <= 0 || r.x < 0 || r.y > 260) continue;
        const parent = el.parentElement;
        if (!parent) continue;
        const svgs = [...parent.querySelectorAll('svg')].map((svg) => {
          const sr = svg.getBoundingClientRect();
          return { x: sr.x + sr.width / 2, y: sr.y + sr.height / 2, w: sr.width, h: sr.height, dx: sr.x - r.x };
        }).filter((svg) => svg.w > 0 && svg.h > 0 && svg.dx > 0 && svg.dx < 100);
        if (svgs[0]) return svgs[0];
      }
      return null;
    });
    if (!pos) throw new Error('APY/APR info icon not found');
    await page.mouse.click(pos.x, pos.y);
  }
  await sleep(700);
  const visible = await page.evaluate(() => {
    const overlay = document.querySelector('[data-testid="ovelay-popover"]');
    const r = overlay?.getBoundingClientRect();
    return !!(overlay && r && r.width > 0 && r.height > 0);
  });
  if (!visible) throw new Error('APY/info popover did not open');
}

async function closeApyPopover(page) {
  await clickVisibleTestid(page, 'ovelay-popover', { timeoutMs: 3000 }).catch(async () => {
    await page.keyboard.press('Escape');
    await sleep(400);
  });
}

async function readMorphoMetrics(page) {
  return page.evaluate(() => {
    const visibleLeaves = [];
    for (const el of document.querySelectorAll('span, div')) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0 || r.x < 0 || r.y < 0 || r.y > window.innerHeight) continue;
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 140) continue;
      visibleLeaves.push({ text, x: r.x, y: r.y, w: r.width, h: r.height, children: el.children.length });
    }

    const rateCandidates = visibleLeaves
      .filter((v) => v.children === 0 && v.x >= 100 && v.x < 900 && v.y < 300)
      .map((v) => ({ ...v, match: v.text.match(/^([\d.]+)\s*%\s*(?:APR|APY)$/i) }))
      .filter((v) => v.match);
    const rate = rateCandidates[0] ? Number(rateCandidates[0].match[1]) : null;

    const yieldCandidates = visibleLeaves
      .filter((v) => v.children === 0 && v.x >= 760)
      .map((v) => ({ ...v, match: v.text.match(/^([\d.]+)\s*USDC\s*(?:\(\s*(?:≈?\s*)?\$?([\d.,<> ]+)\s*\))?/i) }))
      .filter((v) => v.match);
    const yieldHit = yieldCandidates[0] || null;

    const compact = (document.body?.innerText || document.body?.textContent || '').replace(/\s+/g, ' ');
    return {
      bodySample: compact.slice(0, 1200),
      ratePct: rate,
      estimatedToken: yieldHit ? Number(yieldHit.match[1]) : null,
      estimatedUsdText: yieldHit ? yieldHit.match[2] || null : null,
      hasMorpho: compact.includes('Morpho'),
      hasPangolins: compact.includes('Pangolins'),
      hasUsdc: compact.includes('USDC'),
      debug: { rateCandidates, yieldCandidates: yieldCandidates.slice(0, 5) },
    };
  });
}

function parseUsdText(text) {
  if (!text) return null;
  const cleaned = text.replace(/[,$\s]/g, '');
  const m = cleaned.match(/<?([\d.]+)/);
  if (!m) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value)) return null;
  return cleaned.startsWith('<') ? value / 2 : value;
}

function assertMorphoYieldFormula(metrics, amount = Number(PROBE_AMOUNT)) {
  if (!metrics.hasMorpho || !metrics.hasPangolins || !metrics.hasUsdc) {
    throw new Error('Morpho Pangolins USDC content not visible');
  }
  if (!(metrics.ratePct > 0)) {
    throw new Error(`Cannot read APY/APR for Morpho Pangolins: ${metrics.ratePct}`);
  }
  if (!(metrics.estimatedToken >= 0)) {
    throw new Error(`Cannot read estimated annual yield: ${metrics.estimatedToken}`);
  }
  const expectedToken = amount * metrics.ratePct / 100;
  const tokenDiff = Math.abs(metrics.estimatedToken - expectedToken);
  const tokenTolerance = Math.max(0.002, expectedToken * 0.04);
  if (tokenDiff > tokenTolerance) {
    throw new Error(`USDC yield mismatch: amount ${amount} * ${metrics.ratePct}% = ${expectedToken}, actual ${metrics.estimatedToken}, diff ${tokenDiff}`);
  }

  const usd = parseUsdText(metrics.estimatedUsdText);
  if (usd !== null) {
    const usdDiff = Math.abs(usd - metrics.estimatedToken);
    const usdTolerance = Math.max(0.05, metrics.estimatedToken * 0.08);
    if (usdDiff > usdTolerance) {
      throw new Error(`USDC yield USD mismatch: token ${metrics.estimatedToken} USDC, displayed $${usd}, diff ${usdDiff}`);
    }
  }
  return `${amount} * ${metrics.ratePct}% = ${expectedToken.toFixed(8)} ~= ${metrics.estimatedToken} USDC${usd === null ? '' : ` ($${usd})`}`;
}

async function clickPrimaryFooter(page, expectedTextRegex = /继续|确认|赎回|认购|授权/) {
  const clicked = await page.evaluate((source) => {
    const re = new RegExp(source);
    const candidates = [
      ...document.querySelectorAll('[data-testid="page-footer-confirm"]'),
      ...document.querySelectorAll('[data-testid="dialog-confirm-btn"]'),
      ...document.querySelectorAll('button'),
    ];
    for (const el of candidates) {
      const r = el.getBoundingClientRect();
      const text = (el.textContent || '').trim();
      const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true';
      if (r.width > 0 && r.height > 0 && r.x >= 0 && !disabled && (!text || re.test(text))) {
        el.click();
        return { text, testid: el.getAttribute('data-testid') || '' };
      }
    }
    return null;
  }, expectedTextRegex.source);
  if (!clicked) throw new Error(`No enabled footer/dialog button matching ${expectedTextRegex}`);
  await sleep(1400);
  return clicked.text || clicked.testid;
}

async function clickAnyConfirmIfPresent(page, timeoutMs = 10000) {
  const start = Date.now();
  let clickedCount = 0;
  while (Date.now() - start < timeoutMs) {
    await handlePasswordPromptIfPresent(page).catch(() => {});
    const clicked = await page.evaluate(() => {
      const selectors = [
        '[data-testid="dialog-confirm-btn"]',
        '[data-testid="page-footer-confirm"]',
        'button',
      ];
      for (const sel of selectors) {
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect();
          const text = (el.textContent || '').trim();
          const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true';
          if (r.width <= 0 || r.height <= 0 || r.x < 0 || disabled) continue;
          if (/^(确认|继续|赎回|认购|授权|Submit|Confirm)$/i.test(text)) {
            el.click();
            return { text, testid: el.getAttribute('data-testid') || '' };
          }
        }
      }
      return null;
    });
    if (!clicked) {
      await sleep(500);
      continue;
    }
    clickedCount++;
    await sleep(1600);
    if (clickedCount >= 3) break;
  }
  await handlePasswordPromptIfPresent(page).catch(() => {});
  return clickedCount;
}

async function waitForSubmitFeedback(page, timeoutMs = 30000) {
  const start = Date.now();
  let lastText = '';
  while (Date.now() - start < timeoutMs) {
    const state = await page.evaluate(() => {
      const text = document.body?.textContent || '';
      const toast = document.querySelector('[data-testid="onekey-toast-messages"]')?.textContent || '';
      return { text, toast, url: location.href };
    });
    lastText = [state.toast, state.text].join(' ');
    if (/交易已提交|待处理|成功|Submitted|Pending|Success/i.test(lastText)) {
      return lastText.match(/交易已提交|待处理|成功|Submitted|Pending|Success/i)?.[0] || 'feedback';
    }
    if (state.url.includes('/defi') && /Morpho|Pangolins/.test(lastText) && /待处理|认购|赎回|可领取|已激活|赎回中/.test(lastText)) {
      return lastText.match(/待处理|认购|赎回|可领取|已激活|赎回中/)?.[0] || 'portfolio state';
    }
    if (/余额不足|Insufficient|失败|Failed/i.test(lastText)) {
      throw new Error(`Submit feedback indicates failure: ${lastText.slice(0, 180)}`);
    }
    await handlePasswordPromptIfPresent(page).catch(() => {});
    await sleep(800);
  }
  throw new Error(`No submit feedback after ${timeoutMs}ms. Last text: ${lastText.slice(0, 180)}`);
}

async function submitSubscribe(page, amount) {
  await scrollToTop(page);
  await fillAmount(page, amount);
  const actual = await getInputValue(page);
  if (actual !== amount) throw new Error(`Subscribe amount mismatch: expected ${amount}, got ${actual}`);
  await clickPrimaryFooter(page, /继续|认购|授权|确认/);
  await clickAnyConfirmIfPresent(page, 15000);
  await handlePasswordPromptIfPresent(page).catch(() => {});
  await clickAnyConfirmIfPresent(page, 15000);
  return waitForSubmitFeedback(page, 30000);
}

async function tryOpenHistory(page) {
  const clicked = await clickVisibleTestid(page, 'staking-has-content-btn', { containsText: '历史记录', timeoutMs: 5000 })
    .then(() => true)
    .catch(() => false);
  if (!clicked) {
    const state = await page.evaluate(() => {
      const text = document.body?.textContent || '';
      return /Morpho|Pangolins/.test(text) && /待处理|认购|赎回|可领取|已激活|赎回中/.test(text);
    });
    if (state) return 'portfolio morpho state visible';
    throw new Error('History button not visible and Morpho state not found');
  }
  await sleep(1800);
  const hasHistory = await page.evaluate(() => {
    const text = document.body?.textContent || '';
    return text.includes('历史记录') || text.includes('认购') || text.includes('赎回') || text.includes('待处理');
  });
  if (!hasHistory) throw new Error('History content not visible');
  return 'history visible';
}

async function tryPositionManage(page) {
  await closeSubPages(page);
  await clickText(page, '持仓', { exact: true, timeoutMs: 5000 }).catch(async () => {
    await openDefiAssetList(page);
    await clickText(page, '持仓', { exact: true, timeoutMs: 5000 });
  });
  await scrollAndClickRowText(page, 'Pangolins', {
    exact: false,
    maxScrolls: 14,
    scrollStep: 420,
    parentMinWidth: 300,
    alsoIncludes: ['Morpho'],
  }).catch(() => {});
  const managed = await page.evaluate(() => {
    const rowTexts = ['Pangolins', 'Morpho'];
    for (const el of document.querySelectorAll('[data-testid="earn-btn"], button, span, div')) {
      const r = el.getBoundingClientRect();
      const text = (el.textContent || '').trim();
      if (r.width <= 0 || r.height <= 0 || r.x < 0 || !text.includes('管理')) continue;
      let p = el;
      for (let d = 0; d < 8 && p; d++) {
        const rowText = p.textContent || '';
        if (rowTexts.every((s) => rowText.includes(s))) {
          el.click();
          return true;
        }
        p = p.parentElement;
      }
    }
    for (const el of document.querySelectorAll('[data-testid="earn-btn"], button')) {
      const r = el.getBoundingClientRect();
      const text = (el.textContent || '').trim();
      if (r.width > 0 && r.height > 0 && r.x >= 0 && text.includes('管理')) {
        el.click();
        return true;
      }
    }
    return false;
  });
  if (!managed) throw new Error('Manage button not found for Morpho Pangolins');
  await sleep(1600);
}

async function tryRedeemFromManage(page, amount) {
  await clickText(page, '赎回', { exact: true, timeoutMs: 6000 });
  await fillAmount(page, amount);
  const actual = await getInputValue(page);
  if (actual !== amount) throw new Error(`Redeem amount mismatch: expected ${amount}, got ${actual}`);
  await clickPrimaryFooter(page, /赎回|确认/);
  await clickAnyConfirmIfPresent(page, 15000);
  await handlePasswordPromptIfPresent(page).catch(() => {});
  await clickAnyConfirmIfPresent(page, 10000);
  return waitForSubmitFeedback(page, 30000);
}

async function testDetail(page) {
  const t = createStepTracker('DEFI-MORPHO-PANGOLINS-USDC-001');

  await mustStep(page, t, '进入 Morpho Pangolins USDC 详情页', async () => {
    await openMorphoDetail(page);
    return 'Morpho Pangolins USDC detail';
  });

  await mustStep(page, t, '打开并关闭 APY 信息弹窗', async () => {
    await openApyPopover(page);
    await closeApyPopover(page);
    return 'popover ok';
  });

  await sStep(page, t, '验证 Morpho/Pangolins 资产内容', async () => {
    const text = await page.evaluate(() => document.body?.textContent || '');
    const required = ['Pangolins', 'Morpho', '资产'];
    const missing = required.filter((s) => !text.includes(s));
    if (missing.length) throw new Error(`Missing asset content: ${missing.join(', ')}`);
    return 'Morpho/Pangolins asset content visible';
  });

  for (const text of ['资产', 'Paul Frambot', 'Ribbit Capital', 'Certora']) {
    await sStep(page, t, `查看 ${text}`, async () => {
      await scrollToText(page, text, { exact: true, maxScrolls: 18 });
      await clickText(page, text, { exact: true, timeoutMs: 3000 }).catch(() => {});
      return `${text} visible`;
    });
  }

  await sStep(page, t, '打开并关闭自动风控说明', async () => {
    await scrollToText(page, '自动风控', { exact: true, maxScrolls: 18 });
    await clickText(page, '自动风控', { exact: true, timeoutMs: 5000 });
    await clickText(page, '明白了！', { exact: true, timeoutMs: 5000 });
    return 'risk dialog ok';
  });

  return t.result();
}

async function testYieldProbe(page) {
  const t = createStepTracker('DEFI-MORPHO-PANGOLINS-USDC-002');

  await mustStep(page, t, '进入 Morpho Pangolins USDC 详情页', async () => {
    await openMorphoDetail(page);
    return 'Morpho Pangolins USDC detail';
  });

  await mustStep(page, t, `输入 ${PROBE_AMOUNT} 并动态校验 APY/预估年收益`, async () => {
    await scrollToTop(page);
    await fillAmount(page, PROBE_AMOUNT);
    const metrics = await readMorphoMetrics(page);
    const result = assertMorphoYieldFormula(metrics);
    await clearAmount(page);
    return result;
  });

  return t.result();
}

async function testSubscribe(page) {
  const t = createStepTracker('DEFI-MORPHO-PANGOLINS-USDC-003');

  await mustStep(page, t, '进入 Morpho Pangolins USDC 详情页', async () => {
    await openMorphoDetail(page);
    return 'Morpho Pangolins USDC detail';
  });

  await mustStep(page, t, `提交认购 ${SUBSCRIBE_AMOUNT} USDC`, async () => {
    const feedback = await submitSubscribe(page, SUBSCRIBE_AMOUNT);
    return feedback;
  });

  await sStep(page, t, '打开历史记录或确认持仓状态', async () => {
    return tryOpenHistory(page);
  });

  return t.result();
}

async function testRedeem(page) {
  const t = createStepTracker('DEFI-MORPHO-PANGOLINS-USDC-004');

  await mustStep(page, t, '进入持仓管理', async () => {
    await tryPositionManage(page);
    return 'manage page';
  });

  await mustStep(page, t, `提交赎回 ${REDEEM_AMOUNT} USDC`, async () => {
    const feedback = await tryRedeemFromManage(page, REDEEM_AMOUNT);
    return feedback;
  });

  return t.result();
}

export const testCases = [
  { id: 'DEFI-MORPHO-PANGOLINS-USDC-001', name: 'Morpho Pangolins USDC 详情与 APY 信息', fn: testDetail },
  { id: 'DEFI-MORPHO-PANGOLINS-USDC-002', name: 'Morpho Pangolins USDC 输入 100 动态收益校验', fn: testYieldProbe },
  { id: 'DEFI-MORPHO-PANGOLINS-USDC-003', name: 'Morpho Pangolins USDC 授权认购 0.01', fn: testSubscribe },
  { id: 'DEFI-MORPHO-PANGOLINS-USDC-004', name: 'Morpho Pangolins USDC 持仓赎回 0.001', fn: testRedeem },
];

export async function setup(page) {
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
}

export async function run() {
  const { page } = await connectCDP();

  console.log('\n' + '='.repeat(60));
  console.log('  DeFi Morpho Pangolins USDC Desktop Test');
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
