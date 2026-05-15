// DeFi Lista USDT 质押 + 赎回测试 (Desktop)
// Test IDs: DEFI-LISTA-001 ~ DEFI-LISTA-006
// 用例文档：docs/qa/testcases/cases/defi/2026-05-13_DeFi-Lista-USDT-质押赎回.md
// 录制 session：2026-05-13

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
} from '../../helpers/index.mjs';
import { createStepTracker, safeStep } from '../../helpers/components.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'defi-lista-usdt');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// Dashboard 显示
export const displayName = 'Lista USDT 质押赎回';
export const categoryTitle = 'DeFi';

// 模块级缓存
let _ctx = {
  /** 进入 Lista USDT 详情页前记录的 USDT 余额 */
  initialUsdtBalance: null,
  /** 质押前余额 */
  beforeStakeBalance: null,
  /** 赎回前余额 */
  beforeRedeemBalance: null,
  /** APY 弹窗中读到的拆分 */
  apyBreakdown: null,
};

// 测试金额
const STAKE_AMOUNT = '100';
const REDEEM_AMOUNT = '100';

// ── DOM 工具 ───────────────────────────────────────────────

const sStep = (page, t, name, fn) => safeStep(page, t, name, fn, SCREENSHOT_DIR);

/** 点击指定文本的可见元素 */
async function clickText(page, text, opts = {}) {
  const { tag = 'span,div,button', scrollIntoView = true } = opts;
  const clicked = await page.evaluate(({ text, tag, scrollIntoView }) => {
    for (const el of document.querySelectorAll(tag)) {
      if (el.textContent?.trim() === text && el.children.length === 0) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          if (scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'instant' });
          el.click();
          return true;
        }
      }
    }
    return false;
  }, { text, tag, scrollIntoView });
  if (!clicked) throw new Error(`Cannot click text "${text}"`);
  await sleep(800);
}

/** 在所有 testid 元素中找包含某文本的可见元素并点击 */
async function clickByTestid(page, testid) {
  const clicked = await page.evaluate((testid) => {
    const el = document.querySelector(`[data-testid="${testid}"]`);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    el.click();
    return true;
  }, testid);
  if (!clicked) throw new Error(`Cannot click testid="${testid}"`);
  await sleep(800);
}

/** 关 popover 遮罩 */
async function dismissOverlayPopover(page) {
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="ovelay-popover"]');
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 0) el.click();
    }
  });
  await sleep(500);
}

/** 用 pressSequentially 输入金额到当前可见的认购/赎回输入框（优先 staking-* testid，fallback placeholder） */
async function fillAmount(page, amount, kind = 'stake') {
  // kind: 'stake' | 'withdraw'，决定优先用哪个 testid
  const testidOrder = kind === 'withdraw'
    ? ['staking-withdraw-amount-input', 'staking-claim-amount-input', 'earn-amount-input', 'staking-stake-amount-input']
    : ['staking-stake-amount-input', 'earn-amount-input'];

  let inputLocator = null;
  for (const tid of testidOrder) {
    const cnt = await page.locator(`[data-testid="${tid}"]`).count();
    if (cnt > 0) {
      inputLocator = page.locator(`[data-testid="${tid}"]`).first();
      break;
    }
  }
  // fallback: placeholder="0" 的可见 input
  if (!inputLocator) {
    inputLocator = page.locator('input[placeholder="0"]').first();
  }

  // 先 focus + 清空
  await inputLocator.click({ clickCount: 3 }).catch(() => {});
  await sleep(200);
  await page.keyboard.press('Backspace').catch(() => {});
  await sleep(200);
  await inputLocator.pressSequentially(amount, { delay: 50 });
  await sleep(1000);
}

/** 读取「预估年收益」两行（USDT 部分 + LISTA 部分），返回 { usdt: { tokenAmt, usdAmt }, lista: { tokenAmt, usdAmt } } */
async function readEstimatedYield(page) {
  return page.evaluate(() => {
    const result = { usdt: null, lista: null };
    // 找包含「预估年收益」label 的容器
    let container = null;
    for (const el of document.querySelectorAll('span, div')) {
      if (el.textContent?.trim() === '预估年收益' && el.children.length === 0) {
        container = el.closest('div')?.parentElement;
        if (container) break;
      }
    }
    if (!container) return result;
    // 在容器中找形如 `0.0XXX USDT ($0.XX)` 与 `XX.XXXX LISTA ($X.XX)` 的文本
    const re = /([\d.]+)\s*(USDT|LISTA)\s*\(\$([\d.]+)\)/g;
    const text = container.textContent || '';
    let m;
    while ((m = re.exec(text)) !== null) {
      const [, amtStr, symbol, usdStr] = m;
      const entry = { tokenAmt: parseFloat(amtStr), usdAmt: parseFloat(usdStr) };
      if (symbol === 'USDT') result.usdt = entry;
      else if (symbol === 'LISTA') result.lista = entry;
    }
    // 另兼容 `0.0₅2849 USDT` 这种带下标的格式（subscript = 后面有 N 个 0）
    if (!result.usdt || !result.lista) {
      const reSub = /0\.0(\d)([\d.]+)\s*(USDT|LISTA)\s*\(\$([\d.]+)\)/g;
      while ((m = reSub.exec(text)) !== null) {
        const [, zeros, digits, symbol, usdStr] = m;
        const tokenAmt = parseFloat(`0.${'0'.repeat(parseInt(zeros))}${digits.replace('.', '')}`);
        const entry = { tokenAmt, usdAmt: parseFloat(usdStr) };
        if (symbol === 'USDT' && !result.usdt) result.usdt = entry;
        else if (symbol === 'LISTA' && !result.lista) result.lista = entry;
      }
    }
    return result;
  });
}

/** 读取认购页面的认购价值 USD（如 $99.97） */
async function readSubscriptionValueUsd(page) {
  return page.evaluate(() => {
    // 在认购卡片下方寻找 `$XX.XX` 格式的小字
    for (const el of document.querySelectorAll('span, div')) {
      const text = el.textContent?.trim();
      if (!text || el.children.length !== 0) continue;
      const m = text.match(/^\$([\d.]+)$/);
      if (m) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.width < 150 && r.height > 0 && r.height < 30) {
          return parseFloat(m[1]);
        }
      }
    }
    return null;
  });
}

/** 读取顶部 APY 数值（如 1.79） */
async function readApyPercent(page) {
  return page.evaluate(() => {
    for (const el of document.querySelectorAll('span, div, h1, h2, h3')) {
      const text = el.textContent?.trim();
      if (!text || el.children.length !== 0) continue;
      const m = text.match(/^([\d.]+)%\s*APY$/);
      if (m) return parseFloat(m[1]);
    }
    return null;
  });
}

/** 从 APY 弹窗读取细分：原生 APY / LISTA / 业绩费 / 综合 */
async function readApyBreakdown(page) {
  return page.evaluate(() => {
    const result = { native: null, lista: null, performanceFee: null };
    // 弹窗内容定位：找包含「原生 APY」label 的 span，沿 DOM 向上找到 row 容器，取 row 文本里的百分比
    const findValueByLabel = (labelText) => {
      for (const el of document.querySelectorAll('span, div')) {
        const t = el.textContent?.trim();
        if (t !== labelText || el.children.length !== 0) continue;
        // 向上查 3 层找包含 + / -% 数值的容器
        let p = el.parentElement;
        for (let depth = 0; depth < 5 && p; depth++) {
          const rowText = p.textContent || '';
          // 在 row 内查找 +X.XX% 或 -X.XX% 模式（不在 label 文本里出现）
          const m = rowText.match(/([+-])\s*([\d.]+)\s*%/);
          if (m) {
            const sign = m[1] === '-' ? -1 : 1;
            return sign * parseFloat(m[2]);
          }
          p = p.parentElement;
        }
      }
      return null;
    };
    result.native = findValueByLabel('原生 APY');
    result.lista = findValueByLabel('LISTA');
    result.performanceFee = findValueByLabel('业绩费');
    return result;
  });
}

/** 在历史列表中是否能找到 Lista 条目（按文本匹配 "Lista" + 金额） */
async function findListaHistoryEntry(page, expectedAmount) {
  return page.evaluate((amt) => {
    const containers = document.querySelectorAll('[data-testid^="select-item-"], [role="listitem"]');
    for (const el of containers) {
      const text = el.textContent || '';
      if (text.includes('Lista') && text.includes(amt)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return true;
      }
    }
    // Fallback: 检查所有可见 row
    for (const el of document.querySelectorAll('div, li')) {
      const t = el.textContent?.trim() || '';
      if (t.startsWith('Lista') && t.includes(amt)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height < 200) return true;
      }
    }
    return false;
  }, expectedAmount);
}

/** 滚动到包含某文本的元素 */
async function scrollToText(page, text) {
  await page.evaluate((text) => {
    for (const el of document.querySelectorAll('span, div, h1, h2, h3, p, button')) {
      if (el.textContent?.trim() === text && el.children.length === 0) {
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        return;
      }
    }
  }, text);
  await sleep(500);
}

/** 等待 DeFi 主页加载完毕（任一就绪标识出现即可） */
async function waitForDefiPageReady(page, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ready = await page.evaluate(() => {
      const sels = [
        '[data-testid="earn-portfolio-overview"]',
        '[data-testid="earn-faq-section"]',
        '[data-testid="earn-portfolio-item-Lista"]',
        '[data-testid="earn-icon-btn"]',
      ];
      for (const sel of sels) {
        const el = document.querySelector(sel);
        if (el && el.getBoundingClientRect().width > 0) return sel;
      }
      // 兜底：找「所有资产/持仓/常见问题」三个 tab 文本之一
      for (const el of document.querySelectorAll('span, div')) {
        const t = (el.textContent || '').trim();
        if (['所有资产', '持仓', '常见问题'].includes(t) && el.children.length === 0) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.y < 400) return `tab:"${t}"`;
        }
      }
      return null;
    });
    if (ready) {
      console.log(`  [defi-ready] ${ready} (waited ${Date.now() - start}ms)`);
      return;
    }
    await sleep(500);
  }
  console.log(`  [warn] DeFi 主页就绪标识超时（${timeoutMs}ms），继续执行`);
}

/**
 * 点击 DeFi 页面顶部 tab：「所有资产」/「持仓」/「常见问题」。
 * 这些 tab 文本是 span 且没有 data-testid，需要按文本+y 范围定位。带 retry。
 */
async function clickDefiTopTab(page, tabText) {
  let pos = null;
  // 最多 10 次重试（每次 500ms），覆盖 SwipeView 切换中、首次进 DeFi 慢加载等情况
  for (let i = 0; i < 10; i++) {
    pos = await page.evaluate((text) => {
      let best = null;
      for (const el of document.querySelectorAll('span, div')) {
        if (el.textContent?.trim() !== text || el.children.length !== 0) continue;
        const r = el.getBoundingClientRect();
        // DeFi 顶部 tab 大约在 y=240，宽度 < 200
        if (r.width > 0 && r.width < 200 && r.y > 150 && r.y < 350 && r.x >= 0) {
          if (!best || r.y < best.y) {
            best = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
          }
        }
      }
      return best;
    }, tabText);
    if (pos) break;
    await sleep(500);
  }
  if (!pos) throw new Error(`DeFi 顶部 tab "${tabText}" 未找到（10 次重试 × 500ms）`);
  await page.mouse.click(pos.x, pos.y);
  await sleep(1200);
}

/** 用 mouse.click 安全点击元素（兼容 SVG / Pointer events 拦截） */
async function safeClickTestid(page, testid, opts = {}) {
  const { containsText } = opts;
  const pos = await page.evaluate(({ testid, containsText }) => {
    const elements = document.querySelectorAll(`[data-testid="${testid}"]`);
    for (const el of elements) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (containsText) {
        const t = el.textContent || '';
        if (!t.includes(containsText)) continue;
      }
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  }, { testid, containsText });
  if (!pos) throw new Error(`testid="${testid}"${containsText ? ` containing "${containsText}"` : ''} not found or invisible`);
  await page.mouse.click(pos.x, pos.y);
  await sleep(800);
}

/**
 * 找到包含目标 anchor 元素的实际滚动容器（祖先链上首个 overflow-y: auto/scroll 且 scrollHeight > clientHeight 的）。
 * OneKey (React Native Web) 主滚动容器不是 window，是嵌套的 <div overflow:auto>，所以必须用容器滚不能用 window。
 */
function findScrollContainerJS() {
  return `
    function _findScrollContainer(anchor) {
      // 从 anchor 往上找祖先：overflow-y in (auto/scroll/overlay) 且 scrollHeight > clientHeight
      let el = anchor;
      while (el && el !== document.body) {
        const cs = window.getComputedStyle(el);
        const oy = cs.overflowY;
        if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight + 5) {
          return el;
        }
        el = el.parentElement;
      }
      // 兜底：全页扫一个最大的可滚动 div
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

/**
 * 滚动找到「文本完全等于 text 的元素」，并点击其最近的可点击祖先（onClick / cursor:pointer / role=button / 宽度大的 row 容器）。
 * 用于 DeFi 资产列表这种**没有 testid 的列表行**（USDT/Lista 渠道行等）。
 *
 * 配套 K-111 更新：DeFi 「所有资产」列表里的代币行没有 data-testid，必须靠文本+祖先 onClick 定位。
 *
 * @param {object} opts
 * @param {string} opts.text - 要匹配的文本
 * @param {number} [opts.rowMinHeight=30] - 可点击祖先 row 的最小高度（过滤掉过小元素）
 * @param {number} [opts.rowMaxHeight=80] - 可点击祖先 row 的最大高度（**默认 80，排除"热门"卡片那种 130~ 的高卡片**）
 * @param {number} [opts.parentMinWidth=800] - 可点击祖先 row 的最小宽度（确保是 list-row 级别）
 */
async function scrollAndClickRowByText(page, opts) {
  const { text, maxScrolls = 20, scrollStep = 350, parentMinWidth = 800, rowMinHeight = 30, rowMaxHeight = 80 } = opts;

  for (let i = 0; i <= maxScrolls; i++) {
    const result = await page.evaluate(({ text, helperJS, step, parentMinWidth, rowMinHeight, rowMaxHeight }) => {
      eval(helperJS);

      // 找所有视口内 (x>=0, y in [80, innerHeight-50]) 的文本元素候选
      const candidates = [];
      const domCandidates = [];
      for (const el of document.querySelectorAll('span, div')) {
        if (el.textContent?.trim() !== text || el.children.length !== 0) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.x < 0) continue;
        if (r.y > 80 && r.y < window.innerHeight - 50) candidates.push(el);
        else domCandidates.push(el);
      }

      // 在候选里找一个：其可点击祖先 row 的 height 在 [rowMinHeight, rowMaxHeight] 范围内
      for (const textEl of candidates) {
        let p = textEl;
        for (let d = 0; d < 10 && p; d++) {
          const cs = window.getComputedStyle(p);
          const r = p.getBoundingClientRect();
          const hasClickIntent = p.onclick || cs.cursor === 'pointer' || p.getAttribute('role') === 'button';
          if ((hasClickIntent || r.width >= parentMinWidth)
              && r.height >= rowMinHeight && r.height <= rowMaxHeight
              && r.width >= parentMinWidth) {
            return { inView: true, x: r.x + r.width / 2, y: r.y + r.height / 2,
                     debug: { rowH: Math.round(r.height), rowW: Math.round(r.width) } };
          }
          p = p.parentElement;
        }
      }

      // 视口里没找到合适的 row，DOM 里有的话滚到那
      const domTextEl = domCandidates[0];
      const anchor = domTextEl || document.querySelector('[data-testid="earn-portfolio-overview"]') || document.querySelector('[data-testid="earn-faq-section"]');
      const container = _findScrollContainer(anchor);
      if (domTextEl) {
        domTextEl.scrollIntoView({ block: 'center', behavior: 'instant' });
        return { needRescan: true };
      }
      if (container) {
        container.scrollBy(0, step);
        return { scrolled: true };
      }
      window.scrollBy(0, step);
      return { scrolled: true };
    }, { text, helperJS: findScrollContainerJS(), step: scrollStep, parentMinWidth, rowMinHeight, rowMaxHeight });

    if (result?.inView) {
      await page.mouse.click(result.x, result.y);
      await sleep(800);
      return;
    }
    await sleep(500);
  }
  throw new Error(`scrollAndClickRowByText: text="${text}" not found in viewport after ${maxScrolls} scrolls`);
}

/**
 * 滚动列表直到匹配「testid 前缀 + 后缀」的元素出现在视口里，然后点击。
 * 比如 testidPrefix='home-token-item-' + testidSuffix='-USDT' 可匹配各链下的 USDT 卡片。
 */
async function scrollAndClickByTestidPrefix(page, opts) {
  const { testidPrefix, testidSuffix = '', maxScrolls = 20, scrollStep = 400 } = opts;

  for (let i = 0; i <= maxScrolls; i++) {
    const result = await page.evaluate(({ testidPrefix, testidSuffix, helperJS, step }) => {
      eval(helperJS);
      const allEls = document.querySelectorAll(`[data-testid^="${testidPrefix}"]`);
      let visibleHit = null;
      let domHit = null;
      for (const el of allEls) {
        const tid = el.getAttribute('data-testid') || '';
        if (testidSuffix && !tid.endsWith(testidSuffix)) continue;
        const r = el.getBoundingClientRect();
        // 既要在视口 y 范围内，也要 x 在屏幕里（>= 0）—— DeFi panel 切换会把非 active panel 推到 x<0
        if (r.width > 0 && r.height > 0 && r.x >= 0 && r.y > 80 && r.y < window.innerHeight - 50) {
          visibleHit = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
          break;
        }
        if (r.x >= 0 && (r.width > 0 || el.offsetParent)) {
          domHit = el;
        }
      }
      if (visibleHit) return { inView: true, ...visibleHit };

      const anchor = domHit || allEls[0] || document.querySelector('[data-testid="earn-portfolio-overview"]') || document.querySelector('[data-testid="earn-faq-section"]');
      const container = _findScrollContainer(anchor);
      if (domHit) {
        domHit.scrollIntoView({ block: 'center', behavior: 'instant' });
        return { needRescan: true };
      }
      if (container) {
        container.scrollBy(0, step);
        return { scrolled: true };
      }
      window.scrollBy(0, step);
      return { scrolled: true };
    }, { testidPrefix, testidSuffix, helperJS: findScrollContainerJS(), step: scrollStep });

    if (result?.inView) {
      await page.mouse.click(result.x, result.y);
      await sleep(800);
      return;
    }
    await sleep(500);
  }
  throw new Error(`scrollAndClickByTestidPrefix: prefix="${testidPrefix}" suffix="${testidSuffix}" not found after ${maxScrolls} scrolls`);
}

/**
 * 滚动列表直到匹配 (testid + 包含某文本) 的元素出现在视口里，然后点击。
 * OneKey 用的是嵌套 overflow:auto 容器（不是 window），自动检测并滚动正确的容器。
 */
async function scrollAndClickTestidByText(page, opts) {
  const { testid, containsText, maxScrolls = 20, scrollStep = 400 } = opts;

  // 先找一个 anchor（任意一个该 testid 的元素，或页面主内容区）来推断滚动容器
  for (let i = 0; i <= maxScrolls; i++) {
    const result = await page.evaluate(({ testid, containsText, helperJS, step }) => {
      eval(helperJS);
      const elements = document.querySelectorAll(`[data-testid="${testid}"]`);
      let visibleHit = null;
      let domHit = null;
      for (const el of elements) {
        const t = el.textContent || '';
        if (containsText && !t.includes(containsText)) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.y > 80 && r.y < window.innerHeight - 50) {
          visibleHit = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
          break;
        }
        if (r.width > 0 || (r.width === 0 && el.offsetParent)) {
          domHit = el;
        }
      }
      if (visibleHit) return { inView: true, ...visibleHit };

      // 找滚动容器
      const anchor = domHit || elements[0] || document.querySelector('[data-testid="earn-portfolio-overview"]') || document.querySelector('[data-testid="earn-faq-section"]') || document.body.querySelector('div');
      const container = _findScrollContainer(anchor);

      if (domHit) {
        domHit.scrollIntoView({ block: 'center', behavior: 'instant' });
        return { needRescan: true, scrollContainer: container ? container.getAttribute('data-testid') || container.tagName : 'none' };
      }
      if (container) {
        container.scrollBy(0, step);
        return { scrolled: true, scrollContainer: container.getAttribute('data-testid') || container.tagName };
      }
      // 兜底滚 window（基本无效但留着）
      window.scrollBy(0, step);
      return { scrolled: true, scrollContainer: 'window' };
    }, { testid, containsText, helperJS: findScrollContainerJS(), step: scrollStep });

    if (result?.inView) {
      await page.mouse.click(result.x, result.y);
      await sleep(800);
      return;
    }

    await sleep(500);
  }

  throw new Error(`scrollAndClickTestidByText: testid="${testid}" containing "${containsText}" not found after ${maxScrolls} scrolls`);
}

/** 进入 Lista USDT 详情页（从任意位置） */
async function goToListaUsdtDetail(page) {
  // 1. 关掉可能开着的子页面（nav-header-close / nav-header-back）
  for (let i = 0; i < 3; i++) {
    const closed = await page.evaluate(() => {
      for (const sel of ['[data-testid="nav-header-close"]', '[data-testid="nav-header-back"]']) {
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { el.click(); return true; }
        }
      }
      return false;
    });
    if (!closed) break;
    await sleep(600);
  }

  // 2. 点侧栏 DeFi 入口 [data-testid="earn"]
  await safeClickTestid(page, 'earn');

  // 2.5. 等待 DeFi 主页就绪（路由跳转 + RN 渲染 + token 列表 fetch 都需要时间）
  await waitForDefiPageReady(page, 15000);

  // 2.6. DeFi 默认进入「持仓」tab，必须切到「所有资产」才能看到代币列表
  //      三个顶部 tab（所有资产/持仓/常见问题）是 SwipeView 横向 panel，非 active 的 panel 被偏移到 x<0
  await clickDefiTopTab(page, '所有资产');
  await sleep(1500);

  // 3. 「所有资产」tab 下 USDT 行**没有 testid**（CDP 实探证实），必须用文本+祖先 onClick 定位
  //    现象：USDT 文本 span 没 testid，但祖先 depth=3 的 DIV (1062x48) 有 onClick
  await scrollAndClickRowByText(page, { text: 'USDT', maxScrolls: 20, scrollStep: 350 });
  await sleep(2500);

  // 4. 在 USDT 详情页（多渠道列表），点 Lista 渠道（同样没 testid，用 row by text）
  await scrollAndClickRowByText(page, { text: 'Lista', maxScrolls: 10, scrollStep: 350 });
  await sleep(2500);

  // 5. 等待详情页加载（多种就绪标识，任一出现即可）
  for (let i = 0; i < 12; i++) {
    const ready = await page.evaluate(() => {
      const candidates = [
        '[data-testid="staking-protocol-details-page"]',
        '[data-testid="staking-stake-amount-input"]',
        '[data-testid="staking-stake-confirm-btn"]',
        '[data-testid="earn-faq-section"]',
        '[data-testid="earn-risk-notice-dialog"]',
      ];
      for (const sel of candidates) {
        const el = document.querySelector(sel);
        if (el && el.getBoundingClientRect().width > 0) return sel;
      }
      return null;
    });
    if (ready) {
      console.log(`  [ready] detail page anchor found: ${ready}`);
      return;
    }
    await sleep(800);
  }
  console.log('  [warn] 未在 10 秒内检测到详情页就绪标识，继续执行（可能页面结构变更）');
}

// ── 测试用例 ───────────────────────────────────────────────

/**
 * DEFI-LISTA-001: 入口与导航 + APY 数据展示
 */
async function testDefiLista001(page) {
  const t = createStepTracker('DEFI-LISTA-001');

  await sStep(page, t, '导航到 Lista USDT 详情页', async () => {
    await goToListaUsdtDetail(page);
    return 'arrived';
  });

  await sStep(page, t, '验证综合 APY 显示', async () => {
    const apy = await readApyPercent(page);
    if (apy === null || !(apy > 0 && apy < 200)) throw new Error(`无法读取合理的 APY 值: ${apy}`);
    return `APY = ${apy}%`;
  });

  await sStep(page, t, '点击 APY 数值旁的 icon 展开收益组成弹窗', async () => {
    // svg/icon next to APY text — 用 page.mouse.click，因为 SVG 元素没有 HTMLElement.click()
    const pos = await page.evaluate(() => {
      for (const el of document.querySelectorAll('span, div, h1, h2, h3')) {
        const text = el.textContent?.trim();
        if (text && /^[\d.]+%\s*APY$/.test(text) && el.children.length === 0) {
          const parent = el.parentElement;
          if (parent) {
            for (const svg of parent.querySelectorAll('svg')) {
              const r = svg.getBoundingClientRect();
              if (r.width > 0 && r.width < 40 && r.height > 0 && r.height < 40) {
                return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
              }
            }
          }
        }
      }
      return null;
    });
    if (!pos) throw new Error('找不到 APY icon');
    await page.mouse.click(pos.x, pos.y);
    await sleep(1500);
    return `icon clicked at (${Math.round(pos.x)}, ${Math.round(pos.y)})`;
  });

  await sStep(page, t, '验证 APY 拆分（原生 + LISTA + 业绩费）', async () => {
    const bd = await readApyBreakdown(page);
    if (bd.native === null) throw new Error('未读到「原生 APY」');
    if (bd.lista === null) throw new Error('未读到 LISTA 奖励 APY');
    if (bd.performanceFee === null) throw new Error('未读到业绩费');
    // 业绩费必须为负
    if (bd.performanceFee > 0) throw new Error(`业绩费应该为负，实际 ${bd.performanceFee}`);
    _ctx.apyBreakdown = bd;
    const computed = bd.native + bd.lista + bd.performanceFee;
    return `native=${bd.native}%, LISTA=${bd.lista}%, perfFee=${bd.performanceFee}%, computed sum=${computed.toFixed(2)}%`;
  });

  await sStep(page, t, '关闭 APY 弹窗', async () => {
    await dismissOverlayPopover(page);
    return 'dismissed';
  });

  return t.result();
}

/**
 * DEFI-LISTA-002: 详情页内容（介绍 + 常见问题）
 */
async function testDefiLista002(page) {
  const t = createStepTracker('DEFI-LISTA-002');

  await sStep(page, t, '滚动到「常见问题」', async () => {
    await scrollToText(page, '常见问题');
    return 'scrolled';
  });

  const expectedFaqs = [
    'Lista USDT 在 OneKey 上是如何运作的？',
    '什么是 Lista？',
    '收益如何计算？',
    '什么是业绩费？',
    '条款和免责声明',
  ];

  await sStep(page, t, '验证常见问题 5 条目存在', async () => {
    const present = await page.evaluate((faqs) => {
      const text = document.body.textContent || '';
      return faqs.filter(q => text.includes(q));
    }, expectedFaqs);
    const missing = expectedFaqs.filter(q => !present.includes(q));
    if (missing.length > 0) throw new Error(`缺少常见问题：${missing.join(' / ')}`);
    return `5/5 present`;
  });

  await sStep(page, t, '展开/收起「收益如何计算？」', async () => {
    await clickText(page, '收益如何计算？');
    await sleep(800);
    await clickText(page, '收益如何计算？'); // 再点一次收起
    return 'toggle ok';
  });

  return t.result();
}

/**
 * DEFI-LISTA-003: 输入认购金额 + 预估年收益断言（核心公式验证）
 */
async function testDefiLista003(page) {
  const t = createStepTracker('DEFI-LISTA-003');

  // 滚回顶部认购卡片
  await sStep(page, t, '滚动到认购输入区', async () => {
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('span, div')) {
        if (el.textContent?.trim() === '认购' && el.children.length === 0) {
          el.scrollIntoView({ block: 'center', behavior: 'instant' });
          return;
        }
      }
    });
    await sleep(500);
    return 'scrolled';
  });

  await sStep(page, t, `输入认购金额 ${STAKE_AMOUNT}`, async () => {
    await fillAmount(page, STAKE_AMOUNT);
    return `input=${STAKE_AMOUNT}`;
  });

  let inputValueUsd = null;
  await sStep(page, t, '读取认购价值（USD）', async () => {
    inputValueUsd = await readSubscriptionValueUsd(page);
    if (inputValueUsd === null || inputValueUsd <= 0) {
      throw new Error(`无法读取认购 USD 价值，得到 ${inputValueUsd}`);
    }
    return `认购价值 ≈ $${inputValueUsd}`;
  });

  let yieldResult = null;
  await sStep(page, t, '读取预估年收益（USDT + LISTA 双代币）', async () => {
    yieldResult = await readEstimatedYield(page);
    if (!yieldResult.usdt) throw new Error('未读到 USDT 部分年收益');
    if (!yieldResult.lista) throw new Error('未读到 LISTA 部分年收益');
    return `USDT=${yieldResult.usdt.tokenAmt} ($${yieldResult.usdt.usdAmt}), LISTA=${yieldResult.lista.tokenAmt} ($${yieldResult.lista.usdAmt})`;
  });

  await sStep(page, t, '验证 USDT 年收益公式：(原生 − 业绩费) × 认购价值', async () => {
    const bd = _ctx.apyBreakdown;
    if (!bd) throw new Error('APY 拆分未读取（依赖 001）');
    // bd.native 和 bd.performanceFee 已是百分比数值（如 0.32, -0.03）
    // 业绩费已带负号，因此 (原生 + 业绩费) 等同 (原生 − |业绩费|)
    const effectiveUsdtApyPct = bd.native + bd.performanceFee;
    const expectedUsdAmt = inputValueUsd * effectiveUsdtApyPct / 100;
    const actualUsdAmt = yieldResult.usdt.usdAmt;
    const diff = Math.abs(actualUsdAmt - expectedUsdAmt);
    // 允许误差 ±$0.01 + 5% relative（处理 < $0.01 的极小值显示）
    const tolerance = Math.max(0.01, expectedUsdAmt * 0.05);
    if (diff > tolerance) {
      throw new Error(`USDT 年收益公式不符：预期 $${expectedUsdAmt.toFixed(6)}，实际 $${actualUsdAmt}, diff $${diff.toFixed(6)} > tol $${tolerance.toFixed(6)}`);
    }
    return `(${bd.native}% + ${bd.performanceFee}%) × $${inputValueUsd} = $${expectedUsdAmt.toFixed(6)} ≈ $${actualUsdAmt} ✓`;
  });

  await sStep(page, t, '验证 LISTA 年收益公式：LISTA APY × 认购价值（不扣业绩费）', async () => {
    const bd = _ctx.apyBreakdown;
    if (!bd) throw new Error('APY 拆分未读取');
    const expectedUsdAmt = inputValueUsd * bd.lista / 100;
    const actualUsdAmt = yieldResult.lista.usdAmt;
    const diff = Math.abs(actualUsdAmt - expectedUsdAmt);
    const tolerance = Math.max(0.01, expectedUsdAmt * 0.05);
    if (diff > tolerance) {
      throw new Error(`LISTA 年收益公式不符：预期 $${expectedUsdAmt.toFixed(6)}，实际 $${actualUsdAmt}, diff $${diff.toFixed(6)} > tol $${tolerance.toFixed(6)}`);
    }
    return `${bd.lista}% × $${inputValueUsd} = $${expectedUsdAmt.toFixed(6)} ≈ $${actualUsdAmt} ✓`;
  });

  return t.result();
}

/**
 * DEFI-LISTA-004: 完整质押流程（授权 → 确认 ×2）
 */
async function testDefiLista004(page) {
  const t = createStepTracker('DEFI-LISTA-004');

  // 按优先级尝试点击：staking-stake-confirm-btn → earn-stake-button → page-footer-confirm
  const tryConfirmClick = async () => {
    for (const tid of ['staking-stake-confirm-btn', 'earn-stake-button', 'page-footer-confirm']) {
      try { await clickByTestid(page, tid); return tid; } catch {}
    }
    throw new Error('no confirm button found');
  };

  await sStep(page, t, '点击「授权」按钮', async () => {
    const used = await tryConfirmClick();
    await sleep(2000);
    return `clicked via testid=${used}`;
  });

  await sStep(page, t, '签名弹窗 → 点击「确认」（授权交易）', async () => {
    let used = null;
    for (let i = 0; i < 12; i++) {
      try { used = await tryConfirmClick(); break; } catch {}
      await sleep(500);
    }
    if (!used) throw new Error('未找到授权交易的确认按钮');
    await sleep(3000);
    return `clicked via testid=${used}`;
  });

  await sStep(page, t, '认购交易 → 点击「确认」（提交认购）', async () => {
    let used = null;
    for (let i = 0; i < 20; i++) {
      try { used = await tryConfirmClick(); break; } catch {}
      await sleep(500);
    }
    if (!used) throw new Error('未找到认购交易的确认按钮');
    await sleep(3000);
    return `clicked via testid=${used}`;
  });

  await sStep(page, t, '验证：交易立即提交成功（无错误提示）', async () => {
    // 检查页面没有错误 toast
    const hasError = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return /失败|Failed|Error/.test(text) && !/失败原因|可能失败/.test(text);
    });
    if (hasError) throw new Error('页面显示交易失败');
    return 'no failure toast';
  });

  return t.result();
}

/**
 * DEFI-LISTA-005: 历史记录验证（轮询最多 60 秒）
 */
async function testDefiLista005(page) {
  const t = createStepTracker('DEFI-LISTA-005');

  await sStep(page, t, '点击「历史记录」入口', async () => {
    await clickText(page, '历史记录');
    await sleep(1500);
    return 'opened';
  });

  await sStep(page, t, `轮询最多 60 秒等待 Lista ${STAKE_AMOUNT} USDT 认购记录出现`, async () => {
    const start = Date.now();
    let found = false;
    while (Date.now() - start < 60_000) {
      found = await findListaHistoryEntry(page, STAKE_AMOUNT);
      if (found) break;
      await sleep(2000);
    }
    if (!found) throw new Error(`60 秒内未在历史列表找到 Lista ${STAKE_AMOUNT} 条目`);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    return `found after ${elapsed}s`;
  });

  await sStep(page, t, '关闭历史记录返回详情', async () => {
    // 点 nav-header-back 或 nav-header-close
    await page.evaluate(() => {
      for (const sel of ['[data-testid="nav-header-back"]', '[data-testid="nav-header-close"]']) {
        const el = document.querySelector(sel);
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.width > 0) { el.click(); return; }
        }
      }
    });
    await sleep(1500);
    return 'closed';
  });

  return t.result();
}

/**
 * DEFI-LISTA-006: 持仓列表 + 赎回流程
 */
async function testDefiLista006(page) {
  const t = createStepTracker('DEFI-LISTA-006');

  await sStep(page, t, '关闭详情回到持仓首页', async () => {
    await page.evaluate(() => {
      for (const sel of ['[data-testid="nav-header-close"]', '[data-testid="nav-header-back"]']) {
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect();
          if (r.width > 0) { el.click(); return; }
        }
      }
    });
    await sleep(2000);
    return 'navigated home';
  });

  await sStep(page, t, '滚动找到 Lista 持仓', async () => {
    await page.evaluate(() => {
      // 滚动整个页面看看能否找到 Lista
      const scroll = (steps = 0) => {
        if (steps > 10) return;
        const found = Array.from(document.querySelectorAll('span, div')).some(el =>
          el.textContent?.trim() === 'Lista' && el.children.length === 0
        );
        if (found) return;
        window.scrollBy(0, 300);
        setTimeout(() => scroll(steps + 1), 200);
      };
      scroll();
    });
    await sleep(3000);
    return 'scrolled';
  });

  await sStep(page, t, '点击 Lista 持仓的「管理」按钮', async () => {
    // 找 "管理" 按钮的 click target
    await clickText(page, '管理');
    await sleep(1500);
    return 'manage opened';
  });

  await sStep(page, t, '切换到「赎回」tab', async () => {
    // testid=APP-Modal-Screen 内的「赎回」span
    const clicked = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return false;
      for (const sp of modal.querySelectorAll('span')) {
        if (sp.textContent?.trim() === '赎回' && sp.children.length === 0) {
          const r = sp.getBoundingClientRect();
          if (r.width > 0) { sp.click(); return true; }
        }
      }
      return false;
    });
    if (!clicked) throw new Error('找不到赎回 tab');
    await sleep(1500);
    return 'switched';
  });

  await sStep(page, t, `输入赎回金额 ${REDEEM_AMOUNT}`, async () => {
    await fillAmount(page, REDEEM_AMOUNT, 'withdraw');
    return `input=${REDEEM_AMOUNT}`;
  });

  // 赎回按钮优先 staking-withdraw-confirm-btn → earn-unstake-button → page-footer-confirm
  const tryRedeemClick = async () => {
    for (const tid of ['staking-withdraw-confirm-btn', 'earn-unstake-button', 'redemption-redeem-confirm-btn', 'page-footer-confirm']) {
      try { await clickByTestid(page, tid); return tid; } catch {}
    }
    throw new Error('no redeem button found');
  };

  await sStep(page, t, '点击「赎回」按钮', async () => {
    const used = await tryRedeemClick();
    await sleep(2000);
    return `clicked via testid=${used}`;
  });

  await sStep(page, t, '签名 / 确认赎回交易', async () => {
    let used = null;
    for (let i = 0; i < 20; i++) {
      try { used = await tryRedeemClick(); break; } catch {}
      await sleep(500);
    }
    if (!used) throw new Error('未找到赎回确认按钮');
    await sleep(3000);
    return `clicked via testid=${used}`;
  });

  await sStep(page, t, '验证赎回交易立即提交成功（无失败提示）', async () => {
    const hasError = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return /失败|Failed|Error/.test(text) && !/失败原因|可能失败/.test(text);
    });
    if (hasError) throw new Error('页面显示赎回失败');
    return 'no failure toast';
  });

  return t.result();
}

// ── Registry ──────────────────────────────────────────────

export const testCases = [
  { id: 'DEFI-LISTA-001', name: 'DeFi-Lista-入口与APY数据展示', fn: testDefiLista001 },
  { id: 'DEFI-LISTA-002', name: 'DeFi-Lista-详情页常见问题验证', fn: testDefiLista002 },
  { id: 'DEFI-LISTA-003', name: 'DeFi-Lista-认购金额输入与年收益公式验证', fn: testDefiLista003 },
  { id: 'DEFI-LISTA-004', name: 'DeFi-Lista-质押授权与认购流程', fn: testDefiLista004 },
  { id: 'DEFI-LISTA-005', name: 'DeFi-Lista-历史记录验证', fn: testDefiLista005 },
  { id: 'DEFI-LISTA-006', name: 'DeFi-Lista-持仓查找与赎回流程', fn: testDefiLista006 },
];

export async function setup(page) {
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
}

// ── CLI Entry ─────────────────────────────────────────────

export async function run() {
  const { page } = await connectCDP();

  console.log('\n' + '='.repeat(60));
  console.log('  DeFi Lista USDT 质押 + 赎回测试');
  console.log('='.repeat(60));

  await setup(page);

  const results = [];
  for (const tc of testCases) {
    const start = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${tc.id}] ${tc.name}`);
    console.log('─'.repeat(60));
    try {
      const result = await tc.fn(page);
      const duration = Date.now() - start;
      const r = {
        testId: tc.id, status: result.status, duration,
        steps: result.steps, errors: result.errors,
        timestamp: new Date().toISOString(),
      };
      console.log(`>> ${tc.id}: ${r.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s)`);
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    } catch (err) {
      const duration = Date.now() - start;
      const r = {
        testId: tc.id, status: 'failed', duration,
        error: err.message, timestamp: new Date().toISOString(),
      };
      console.error(`>> ${tc.id}: FAILED (${(duration / 1000).toFixed(1)}s) — ${err.message}`);
      await screenshot(page, SCREENSHOT_DIR, `${tc.id}-error`);
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }
    try { await dismissOverlays(page); } catch {}
    await sleep(1000);
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
