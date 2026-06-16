// DeFi Lista USDT 质押 + 赎回测试 (Desktop)
// Test IDs: DEFI-LISTA-001 ~ DEFI-LISTA-006
// 用例文档：docs/qa/testcases/cases/defi/2026-05-13_DeFi-Lista-USDT-质押赎回.md
// 录制 session：2026-05-13

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
  handlePasswordPromptIfPresent,
  clickSidebarTab,
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

// 测试金额：实际质押用 0.001（钱包余额范围内）；APY 公式验证用 100（方便算）
const STAKE_AMOUNT = '0.001';
const REDEEM_AMOUNT = '0.001';
const APY_PROBE_AMOUNT = '100'; // 仅用于 APY 计算验证，不会真正提交

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

/**
 * 读取认购页面的认购价值 USD（输入框紧下方的 $XX.XX）
 *
 * 注意：页面全局有 N 个 $XX.XX 文本（其他资产价格、TVL 等），必须**限定在输入框附近**避免误读。
 * 策略：找 amount-input 输入框 → 在其下方 dy in [10, 80]、|dx| < 200 范围内找 $XX.XX。
 */
async function readSubscriptionValueUsd(page) {
  return page.evaluate(() => {
    const input = document.querySelector('[data-testid="amount-input-input-element-input"]')
              || document.querySelector('input[placeholder="0"]');
    if (!input) return null;
    const ir = input.getBoundingClientRect();
    if (ir.width === 0) return null;

    const candidates = [];
    for (const el of document.querySelectorAll('span, div, p')) {
      const text = el.textContent?.trim();
      if (!text || el.children.length !== 0) continue;
      // 支持两种显示：精确 "$XX.XX" 和小额 "<$0.01" / "< $0.01" / "≈$0.01"
      const exact = text.match(/^\$([\d.,]+)$/);
      const lessThan = text.match(/^[<≈]\s*\$([\d.,]+)$/);
      const m = exact || lessThan;
      if (!m) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.height > 40) continue;
      const dx = r.x - ir.x;
      const dy = r.y - ir.y;
      // 输入框紧邻区域：dy ∈ [-5, 80]（同行或下方）, |dx| <= input.width + 200
      if (dy >= -5 && dy <= 80 && Math.abs(dx) <= ir.width + 200) {
        const value = parseFloat(m[1].replace(/,/g, ''));
        candidates.push({ value, dy, dx, lessThan: !!lessThan, text });
      }
    }
    if (candidates.length === 0) return null;
    // 优先：value > 0 的精确数字（排除 $0.00 占位 / 还没渲染完的状态）
    const positive = candidates.filter(c => c.value > 0 && !c.lessThan);
    if (positive.length) {
      // 取 dy 最小（最贴近 input 下方）
      positive.sort((a, b) => Math.abs(a.dy) - Math.abs(b.dy));
      return positive[0].value;
    }
    // 次选：「<$X.XX」表示极小额，返回 value/2 作为代表性数值（保持 > 0 让公式校验有意义）
    const less = candidates.filter(c => c.lessThan && c.value > 0);
    if (less.length) {
      less.sort((a, b) => Math.abs(a.dy) - Math.abs(b.dy));
      return less[0].value / 2;
    }
    // 兜底：返回 null 触发上层 fail（避免吞掉真正的读取错误）
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
/**
 * 关闭「交易损耗」提示 modal（点其内的「确认」按钮继续）。
 *
 * 触发场景：认购小额（如 0.001 USDT）时，OneKey 弹「交易损耗：按当前预估收益率计算，
 * 大约需要 N 年才能弥补损失」二次确认 modal。用户视角是「点确认继续」，所以
 * 自动化也点确认。
 *
 * 该 modal 没有 nav-header-close，必须按文本定位「确认」按钮（modal 内的 span/button）。
 */
async function dismissTradeLossModal(page) {
  let dismissed = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await page.evaluate(() => {
      const modals = [...document.querySelectorAll('[data-testid="APP-Modal-Screen"]')];
      // 找含「交易损耗」/「弥补损失」文本的 modal
      const lossModal = modals.find(m => /交易损耗|弥补损失/.test(m.textContent || ''));
      if (!lossModal) return { found: false };
      // 在该 modal 内找「确认」按钮（不是 page-footer-confirm —— 这个 modal 用 inline button）
      for (const el of lossModal.querySelectorAll('span, div, button')) {
        if ((el.textContent || '').trim() !== '确认' || el.children.length !== 0) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        return { found: true, x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
      return { found: true, x: null, y: null };
    });
    if (!result.found) break;
    if (result.x == null) {
      console.log('  [dismissTradeLossModal] modal 存在但「确认」按钮未找到');
      break;
    }
    console.log(`  [dismissTradeLossModal] clicking 确认 at (${Math.round(result.x)}, ${Math.round(result.y)})`);
    await page.mouse.click(result.x, result.y);
    dismissed++;
    await sleep(1000);
  }
  return dismissed;
}

async function goToListaUsdtDetail(page) {
  // 0a. 先清掉可能存在的「交易损耗」modal（拦住后续幂等检查 & nav）
  await dismissTradeLossModal(page);

  // 0b. 幂等检查：如果已经在 Lista USDT 详情页（URL 含 EarnProtocolDetails + provider=lista + USDT）且无遗留 modal，直接返回
  const alreadyThere = await page.evaluate(() => {
    const url = location.href;
    const onListaDetail = url.includes('EarnProtocolDetails') && url.includes('provider=lista') && /symbol=USDT/i.test(url);
    if (!onListaDetail) return false;
    // 检查没有遗留 modal
    const modalCount = document.querySelectorAll('[data-testid="APP-Modal-Screen"]').length;
    return modalCount === 0;
  });
  if (alreadyThere) {
    console.log('  [goToListaUsdtDetail] already on Lista USDT detail page, skipping nav');
    return;
  }

  // 1. 关掉可能开着的子页面（nav-header-close / nav-header-back）— 用 page.mouse.click 而不是 el.click()（K-115）
  for (let i = 0; i < 4; i++) {
    const pos = await page.evaluate(() => {
      for (const sel of ['[data-testid="nav-header-close"]', '[data-testid="nav-header-back"]']) {
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
      }
      return null;
    });
    if (!pos) break;
    await page.mouse.click(pos.x, pos.y);
    await sleep(600);
  }

  // 2. 点侧栏 DeFi 入口 [data-testid="earn"]
  await clickSidebarTab(page, 'DeFi');

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

/**
 * 幂等导航：确保在 DeFi 模块 → 「持仓」tab（赎回用例的入口）。
 *
 * 流程：
 *   1. 若已在 DeFi 主页且无遗留 modal → 只切「持仓」tab
 *   2. 否则：关子页面 modal → 点侧栏 earn → 等就绪 → 切「持仓」tab
 */
async function goToDefiPortfolioTab(page) {
  // 先清「交易损耗」modal（认购流程可能留下，挡住后续 nav）
  await dismissTradeLossModal(page);

  const onDefi = await page.evaluate(() => {
    const hasPortfolioOverview = !!document.querySelector('[data-testid="earn-portfolio-overview"]');
    // 排除：在 Lista/Pendle 等协议详情页 或 ManagePosition 页 — 这些页面也可能渲染 portfolio-overview，但不在主页
    const url = location.href;
    const onSubPage = url.includes('EarnProtocolDetails') || url.includes('ManagePosition');
    const modalCount = document.querySelectorAll('[data-testid="APP-Modal-Screen"]').length;
    return hasPortfolioOverview && !onSubPage && modalCount === 0;
  });

  if (!onDefi) {
    // 关掉可能开着的子页面
    for (let i = 0; i < 4; i++) {
      const pos = await page.evaluate(() => {
        for (const sel of ['[data-testid="nav-header-close"]', '[data-testid="nav-header-back"]']) {
          for (const el of document.querySelectorAll(sel)) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
          }
        }
        return null;
      });
      if (!pos) break;
      await page.mouse.click(pos.x, pos.y);
      await sleep(600);
    }
    await clickSidebarTab(page, 'DeFi');
    await waitForDefiPageReady(page, 15000);
  } else {
    console.log('  [goToDefiPortfolioTab] already on DeFi home, just switching tab');
  }

  await clickDefiTopTab(page, '持仓');
  await sleep(1500);
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

  // 前置：确保在 Lista USDT 详情页（独立运行场景下也能跑通）
  await sStep(page, t, 'Step 0: 前置 — 确保在 Lista USDT 详情页', async () => {
    await goToListaUsdtDetail(page);
    return 'on Lista detail';
  });

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

  // 前置：确保在 Lista USDT 详情页
  await sStep(page, t, 'Step 0: 前置 — 确保在 Lista USDT 详情页', async () => {
    await goToListaUsdtDetail(page);
    return 'on Lista detail';
  });

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

  // ─── 简化版 APY 验证（输入 100 测算，不实际提交）───
  // 公式：预估年收益 USD 总和 ≈ 输入金额的 USD 价值 × APY%
  // 例：APY 1.83%，输入 100 USDT(≈$99.99)，预估年收益 = $0.47 (USDT) + $1.36 (LISTA) = $1.83 ≈ 99.99 × 1.83%

  await sStep(page, t, `输入测试金额 ${APY_PROBE_AMOUNT}（仅为验证 APY 公式，会触发"余额不足"提示）`, async () => {
    await fillAmount(page, APY_PROBE_AMOUNT);
    return `input=${APY_PROBE_AMOUNT}`;
  });

  let probeApyPct = null;
  await sStep(page, t, '读取详情页顶部综合 APY 值', async () => {
    probeApyPct = await readApyPercent(page);
    if (probeApyPct === null || probeApyPct <= 0) throw new Error(`无法读取 APY，得到 ${probeApyPct}`);
    return `APY = ${probeApyPct}%`;
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
  await sStep(page, t, '读取预估年收益（USDT + LISTA 双代币 + USD 部分）', async () => {
    yieldResult = await readEstimatedYield(page);
    if (!yieldResult.usdt) throw new Error('未读到 USDT 部分年收益');
    if (!yieldResult.lista) throw new Error('未读到 LISTA 部分年收益');
    return `USDT=${yieldResult.usdt.tokenAmt} ($${yieldResult.usdt.usdAmt}), LISTA=${yieldResult.lista.tokenAmt} ($${yieldResult.lista.usdAmt})`;
  });

  await sStep(page, t, '✅ 核心公式验证：预估年收益总和(USD) ≈ APY% × 认购价值(USD)', async () => {
    const sumUsd = yieldResult.usdt.usdAmt + yieldResult.lista.usdAmt;
    const expectedSumUsd = inputValueUsd * probeApyPct / 100;
    const diff = Math.abs(sumUsd - expectedSumUsd);
    // 允许 ±$0.05 绝对误差 或 ±5% 相对误差（处理 APY 实时波动 + 显示四舍五入）
    const tolerance = Math.max(0.05, expectedSumUsd * 0.05);
    if (diff > tolerance) {
      throw new Error(`APY 公式不符：APY ${probeApyPct}% × $${inputValueUsd} = $${expectedSumUsd.toFixed(4)}，实际 sum = $${sumUsd.toFixed(4)} (diff $${diff.toFixed(4)} > tol $${tolerance.toFixed(4)})`);
    }
    return `${probeApyPct}% × $${inputValueUsd} = $${expectedSumUsd.toFixed(2)} ≈ $${sumUsd.toFixed(2)} (USDT $${yieldResult.usdt.usdAmt} + LISTA $${yieldResult.lista.usdAmt}) ✓`;
  });

  // ─── 验证完成 → 清空输入框 → 输入真实质押金额 0.001 ─────────────
  await sStep(page, t, `清空输入框 → 输入真实质押金额 ${STAKE_AMOUNT}（为 DEFI-LISTA-004 准备）`, async () => {
    await fillAmount(page, STAKE_AMOUNT);
    const v = await page.evaluate(() => {
      const inp = document.querySelector('[data-testid="amount-input-input-element-input"]') || document.querySelector('input[placeholder="0"]');
      return inp ? inp.value : null;
    });
    if (v !== STAKE_AMOUNT) throw new Error(`重新输入失败，预期 "${STAKE_AMOUNT}" 实际 "${v}"`);
    return `cleared and refilled with ${STAKE_AMOUNT}`;
  });

  return t.result();
}

/**
 * DEFI-LISTA-004: 完整质押流程
 *
 * 流程拆解：
 *   1. 详情页底部点「授权」（page-footer-confirm）→ 弹出授权签名弹窗 APP-Modal-Screen
 *   2. 等弹窗出现 → 点**弹窗内**的「确认」按钮（不能再用主页面的 page-footer-confirm 会撞名）
 *   3. 等授权交易广播完成（弹窗关闭 + 主页面回到详情页，「授权」按钮变成「认购」）
 *   4. 点主页面「认购」 → 弹出认购签名弹窗
 *   5. 等弹窗 → 点弹窗内「确认」
 *   6. 等认购交易完成
 */

/**
 * 点击**顶层** APP-Modal-Screen 弹窗的「确认」按钮，并验证 modal 真的关闭了。
 *
 * 修复历史：
 * - K-137: 取顶层 modal (last in querySelectorAll)
 * - K-138: BUTTON 被 backdrop 遮挡 → 用 BUTTON.click() 绕过 hit-test
 * - K-140: 按钮可能 `disabled=true`（等链上预检），必须先等 enable 才能点
 * - K-141: 「textContent 变化」不能判定成功（React 重渲染会假阳性）；
 *          必须严格用 **modal count 真减少**（top modal 关掉 → count-1）
 */
async function clickModalConfirm(page, timeoutMs = 30000) {
  const start = Date.now();
  let lastDiag = { phase: 'init' };

  // ── 阶段 0: 先关「交易损耗」warning modal（小额认购会弹），让顶层 modal 变成真正的签名 modal
  await dismissTradeLossModal(page);

  // ── 阶段 1: 等顶层 modal 内有「可点击」（disabled=false）的 page-footer-confirm
  while (Date.now() - start < timeoutMs) {
    const info = await page.evaluate(() => {
      const modals = [...document.querySelectorAll('[data-testid="APP-Modal-Screen"]')];
      const top = modals[modals.length - 1];
      if (!top) return { phase: 'no-modal', modalCount: 0 };
      const btns = [...top.querySelectorAll('[data-testid="page-footer-confirm"]')];
      btns.sort((a, b) => b.getBoundingClientRect().y - a.getBoundingClientRect().y);
      const btn = btns[0];
      if (!btn) return { phase: 'no-btn', modalCount: modals.length };
      const r = btn.getBoundingClientRect();
      const cs = window.getComputedStyle(btn);
      return {
        phase: 'found',
        modalCount: modals.length,
        disabled: btn.disabled || btn.getAttribute('aria-disabled') === 'true',
        opacity: parseFloat(cs.opacity),
        pos: { x: r.x + r.width / 2, y: r.y + r.height / 2 },
        text: btn.textContent.trim(),
      };
    });

    lastDiag = info;

    if (info.phase === 'no-modal') {
      // K-147：HD 软件钱包不弹独立签名 modal，授权/认购按钮点完后 modal 直接关闭
      //         "进入时已无 modal" = 已自动签名广播 = success
      //         （硬件钱包会保留 modal 等用户在设备上确认，不会触发这个分支）
      console.log('  [clickModalConfirm] 进入时已无 modal（HD 钱包直接广播，跳过签名 modal）');
      return { clicked: true, beforeCount: 0, afterCount: 0, clickAttempts: 0, finalState: { modalCount: 0 }, autoSubmitted: true };
    }
    if (info.phase === 'found' && !info.disabled && info.opacity > 0.5) {
      // 按钮可点了 → 跳出阶段 1
      break;
    }
    // 按钮还 disabled / 没找到 → 等
    await sleep(500);
  }

  if (lastDiag.phase !== 'found' || lastDiag.disabled || lastDiag.opacity <= 0.5) {
    throw new Error(`clickModalConfirm: ${timeoutMs}ms 后按钮仍 disabled 或不可见。最后状态: ${JSON.stringify(lastDiag)}`);
  }

  const beforeCount = lastDiag.modalCount;
  const clickPos = lastDiag.pos;

  // ── 诊断 dump：在点击前打印完整 modal 堆叠 / 所有 confirm 按钮 / 中心点元素栈 / backdrop
  //    用于定位「按钮可见可点但 click 不广播」问题（K-144 误诊后保留）
  try {
    const diag = await page.evaluate(() => {
      const out = { modals: [], confirmButtons: [], backdrops: [] };
      const modals = [...document.querySelectorAll('[data-testid="APP-Modal-Screen"]')];
      modals.forEach((m, i) => {
        const r = m.getBoundingClientRect();
        const cs = getComputedStyle(m);
        let p = m.parentElement, parentZ = null, parentTag = null;
        while (p && p.tagName !== 'BODY') {
          const ps = getComputedStyle(p);
          if (ps.zIndex !== 'auto' && ps.zIndex !== '') {
            parentZ = ps.zIndex;
            parentTag = p.tagName + (p.getAttribute('data-testid') ? `[${p.getAttribute('data-testid')}]` : '');
            break;
          }
          p = p.parentElement;
        }
        out.modals.push({
          i, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
          z: cs.zIndex, parentZ, parentTag,
        });
      });
      const bds = document.querySelectorAll('[class*="backdrop" i], [data-testid*="backdrop" i]');
      bds.forEach((b) => {
        const r = b.getBoundingClientRect();
        if (r.width === 0) return;
        const cs = getComputedStyle(b);
        out.backdrops.push({
          tag: b.tagName, testid: b.getAttribute('data-testid'),
          z: cs.zIndex, pe: cs.pointerEvents,
          x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
        });
      });
      const btns = [...document.querySelectorAll('[data-testid="page-footer-confirm"]')];
      btns.forEach((b, i) => {
        const r = b.getBoundingClientRect();
        const cs = getComputedStyle(b);
        const cx = Math.round(r.x + r.width / 2);
        const cy = Math.round(r.y + r.height / 2);
        const stack = document.elementsFromPoint(cx, cy).slice(0, 5).map(e => ({
          tag: e.tagName, testid: e.getAttribute?.('data-testid'),
          cls: (e.className?.toString?.() || '').slice(0, 35),
        }));
        // 在 modals 中的位置（顶层=last）
        let inModal = -1;
        modals.forEach((m, mi) => { if (m.contains(b)) inModal = mi; });
        // 扫 BUTTON 及祖先的 __reactProps，看哪些层有 onClick / onPress / onResponderRelease
        const reactHandlers = [];
        let cur = b;
        while (cur && cur.tagName !== 'BODY') {
          const propsKey = Object.keys(cur).find(k => k.startsWith('__reactProps'));
          if (propsKey) {
            const p = cur[propsKey] || {};
            const found = [];
            for (const h of ['onClick', 'onPress', 'onPressIn', 'onPressOut', 'onResponderRelease']) {
              if (typeof p[h] === 'function') found.push(h);
            }
            if (found.length) {
              reactHandlers.push(`${cur.tagName}${cur.getAttribute?.('data-testid') ? `[${cur.getAttribute('data-testid')}]` : ''}:${found.join('+')}`);
            }
          }
          cur = cur.parentElement;
          if (reactHandlers.length >= 4) break;
        }
        out.confirmButtons.push({
          i, inModal, text: (b.textContent || '').trim().slice(0, 20),
          x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
          cx, cy, disabled: b.disabled, opacity: cs.opacity, pe: cs.pointerEvents, z: cs.zIndex,
          stack, reactHandlers,
        });
      });
      return out;
    });
    console.log(`  [diag] modals=${diag.modals.length} confirmBtns=${diag.confirmButtons.length} backdrops=${diag.backdrops.length}`);
    diag.modals.forEach(m => console.log(`    [modal#${m.i}] (${m.x},${m.y}) ${m.w}x${m.h} z=${m.z} parentZ=${m.parentZ} parent=${m.parentTag}`));
    diag.backdrops.forEach(b => console.log(`    [bd] ${b.testid || b.tag} z=${b.z} pe=${b.pe} (${b.x},${b.y}) ${b.w}x${b.h}`));
    diag.confirmButtons.forEach(b => {
      console.log(`    [btn#${b.i}] inModal=${b.inModal} text="${b.text}" pos=(${b.x},${b.y}) ${b.w}x${b.h} center=(${b.cx},${b.cy}) disabled=${b.disabled} op=${b.opacity} pe=${b.pe} z=${b.z}`);
      console.log(`        stack: ${b.stack.map(s => `${s.tag}${s.testid ? `[${s.testid}]` : ''}`).join(' → ')}`);
      console.log(`        reactHandlers: ${b.reactHandlers?.join(' | ') || '(none found)'}`);
    });
  } catch (e) {
    console.log(`  [diag] dump failed: ${e.message}`);
  }

  // ── 阶段 2: 点击 — 必须 retry 直到 button **真的响应**（变 disabled 或 modal 关闭或密码弹窗）
  // K-143：BUTTON.click() 第一次常不生效（RN Web Pressable 需要 React event hook 准备），必须 retry 直到状态变化
  let clickAttempts = 0;
  const tryClick = async () => {
    clickAttempts++;
    // 优先 BUTTON.click() 绕过 backdrop
    const r1 = await page.evaluate(() => {
      const modals = [...document.querySelectorAll('[data-testid="APP-Modal-Screen"]')];
      const btns = [...modals.at(-1).querySelectorAll('[data-testid="page-footer-confirm"]')];
      btns.sort((a, b) => b.getBoundingClientRect().y - a.getBoundingClientRect().y);
      const btn = btns[0];
      if (!btn) return { ok: false, reason: 'no-btn' };
      if (btn.disabled) return { ok: false, reason: 'disabled' };
      const r = btn.getBoundingClientRect();
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      // RN Pressable 需要先 focus + 完整 pointer 序列（含坐标 + isPrimary）
      btn.focus();
      const pe = (type) => new PointerEvent(type, {
        bubbles: true, cancelable: true, view: window,
        pointerType: 'mouse', isPrimary: true,
        button: 0, buttons: type === 'pointerdown' ? 1 : 0,
        clientX: cx, clientY: cy,
      });
      const me = (type) => new MouseEvent(type, {
        bubbles: true, cancelable: true, view: window,
        button: 0, buttons: type === 'mousedown' ? 1 : 0,
        clientX: cx, clientY: cy,
      });
      btn.dispatchEvent(pe('pointerdown'));
      btn.dispatchEvent(me('mousedown'));
      btn.dispatchEvent(pe('pointerup'));
      btn.dispatchEvent(me('mouseup'));
      btn.dispatchEvent(me('click'));
      btn.click();

      // K-145：RN Web Pressable 的 onPress 通常绑在外层 DIV 的 __reactProps 上
      //         直接 DOM click 不触发；逐层向上找 reactProps.onClick/onPress/onResponderRelease 并调用
      const reactInvoked = [];
      let cur = btn;
      while (cur && cur.tagName !== 'BODY') {
        const propsKey = Object.keys(cur).find(k => k.startsWith('__reactProps'));
        if (propsKey) {
          const props = cur[propsKey];
          const fakeEv = {
            type: 'click', target: btn, currentTarget: cur,
            clientX: cx, clientY: cy,
            preventDefault() {}, stopPropagation() {},
            nativeEvent: { type: 'click', target: btn },
          };
          for (const handler of ['onClick', 'onPress', 'onResponderRelease']) {
            if (typeof props?.[handler] === 'function') {
              try {
                props[handler](fakeEv);
                reactInvoked.push(`${cur.tagName}${cur.getAttribute?.('data-testid') ? `[${cur.getAttribute('data-testid')}]` : ''}.${handler}`);
              } catch (e) {
                reactInvoked.push(`${cur.tagName}.${handler}!ERR:${e.message.slice(0, 50)}`);
              }
            }
          }
        }
        cur = cur.parentElement;
        if (reactInvoked.length > 0) break; // 调到第一个就停，避免重复触发
      }
      return { ok: true, reactInvoked };
    });
    if (r1?.reactInvoked?.length) {
      console.log(`  [click-react] invoked: ${r1.reactInvoked.join(', ')}`);
    }
    // page.mouse.click 兜底（含 hover 预热，触发 RN Web hover 状态）
    await page.mouse.move(clickPos.x - 5, clickPos.y - 5);
    await sleep(50);
    await page.mouse.move(clickPos.x, clickPos.y);
    await sleep(50);
    await page.mouse.click(clickPos.x, clickPos.y);
    return r1;
  };

  // 连续点 + 检测响应（最多 5 次 × 1.5s = 7.5s 等首次响应）
  const initial = lastDiag; // 之前阶段 1 拿到的 enable 状态
  let firstResponse = false;
  for (let i = 0; i < 5; i++) {
    await tryClick();
    await sleep(1500);
    const cur = await page.evaluate(() => {
      const modals = [...document.querySelectorAll('[data-testid="APP-Modal-Screen"]')];
      const top = modals[modals.length - 1];
      if (!top) return { modalCount: 0 };
      const btn = [...top.querySelectorAll('[data-testid="page-footer-confirm"]')].at(-1);
      const pwd = document.querySelector('[data-testid="password-input"]');
      return {
        modalCount: modals.length,
        btnDisabled: btn?.disabled ?? null,
        pwdVisible: pwd && pwd.getBoundingClientRect().width > 0,
      };
    });
    // 任何状态变化都视为「click 已触发响应」：modal 减少 / button 变 disabled / 密码弹窗出现
    if (cur.modalCount !== beforeCount || cur.btnDisabled === true || cur.pwdVisible) {
      console.log(`  [click-response] attempt=${clickAttempts} modal=${cur.modalCount} disabled=${cur.btnDisabled} pwd=${cur.pwdVisible}`);
      firstResponse = true;
      break;
    }
  }
  if (!firstResponse) {
    console.log(`  [warn] ${clickAttempts} 次 click 后未检测到任何响应，继续验证阶段`);
  }

  // 检测密码弹窗（K-139/K-142：OneKey 密码 input 是裸 input，不在 modal 容器内 → handlePasswordPrompt 的容器判定会误漏）
  // 用「password-input 可见」直接判定，更稳
  try {
    const pwdVisible = await page.evaluate(() => {
      const inp = document.querySelector('[data-testid="password-input"]');
      if (!inp) return false;
      const r = inp.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (pwdVisible) {
      const { getWalletPassword } = await import('../../helpers/runtime-config.mjs');
      const pwd = getWalletPassword();
      console.log(`  [password] 密码 modal 出现，自动填入 (length=${pwd.length})`);
      await page.locator('[data-testid="password-input"]').first().fill(pwd);
      await sleep(500);
      // 点提交按钮 verifying-password
      await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="verifying-password"]');
        if (btn && typeof btn.click === 'function') btn.click();
      });
      await sleep(2500); // 等密码验证 + 真正广播
      console.log(`  [password] 密码已提交`);
    }
  } catch (e) {
    console.log(`  [password] 处理异常: ${e.message}`);
  }

  // ── 阶段 3: 等 modal count 真减少（顶层 modal 关闭）
  //    硬件钱包场景：button 一直 disabled 等硬件确认（不可绕过），脚本只能轮询等
  //    软件钱包场景：button 短暂 disabled → modal 关闭
  const verifyStart = Date.now();
  let lastBtnState = null;
  while (Date.now() - verifyStart < timeoutMs - (Date.now() - start)) {
    const cur = await page.evaluate(() => {
      const modals = [...document.querySelectorAll('[data-testid="APP-Modal-Screen"]')];
      const top = modals[modals.length - 1];
      const btn = top ? [...top.querySelectorAll('[data-testid="page-footer-confirm"]')].at(-1) : null;
      const pwd = document.querySelector('[data-testid="password-input"]');
      return {
        modalCount: modals.length,
        btnDisabled: btn?.disabled ?? null,
        pwdVisible: pwd && pwd.getBoundingClientRect().width > 0,
      };
    });
    lastBtnState = cur;

    // 成功：modal count 减少
    if (cur.modalCount < beforeCount) {
      return { clicked: true, beforeCount, afterCount: cur.modalCount, clickAttempts, finalState: cur };
    }

    // 密码 modal 出现 → 自动填密码
    if (cur.pwdVisible) {
      try {
        const { getWalletPassword } = await import('../../helpers/runtime-config.mjs');
        const pwd = getWalletPassword();
        console.log(`  [password] 密码 modal 出现，自动填入 (length=${pwd.length})`);
        await page.locator('[data-testid="password-input"]').first().fill(pwd);
        await sleep(500);
        await page.evaluate(() => document.querySelector('[data-testid="verifying-password"]')?.click());
        await sleep(2500);
      } catch (e) {
        console.log(`  [password] 处理异常: ${e.message}`);
      }
      continue; // 跳过下面的 retry click，下一轮 loop 重新检查
    }

    // button 还 enable 且没密码 modal → 再点一次（之前 click 可能没生效）
    if (cur.btnDisabled === false && cur.modalCount === beforeCount) {
      console.log(`  [retry-click] button still enabled (count=${cur.modalCount}), click again...`);
      await tryClick().catch(() => {});
    }
    // button disabled → 等硬件钱包确认 / 链上广播（不能再点，等就好）

    await sleep(1000);
  }

  throw new Error(`clickModalConfirm: 点击后 modal count 始终为 ${beforeCount}（未减少）。点击次数=${clickAttempts}，最后状态=${JSON.stringify(lastBtnState)}。如果是硬件钱包，请确认硬件设备上已物理按确认；如果一直不响应，检查链上 gas/nonce/钱包余额`);
}

/** 等待 APP-Modal-Screen 弹窗消失（交易提交完成） */
async function waitForModalClose(page, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const closed = await page.evaluate(() => !document.querySelector('[data-testid="APP-Modal-Screen"]'));
    if (closed) return true;
    await sleep(400);
  }
  return false;
}

/** 等 footer-confirm 按钮的文本变成期望值（用来判断「授权」→「认购」状态切换） */
async function waitForFooterText(page, expected, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const text = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="page-footer-confirm"]');
      return btn?.textContent?.trim() || null;
    });
    if (text && text.includes(expected)) return text;
    await sleep(500);
  }
  return null;
}

async function testDefiLista004(page) {
  const t = createStepTracker('DEFI-LISTA-004');

  // 前置：确保在 Lista USDT 详情页 + 已输入金额（独立运行场景）
  await sStep(page, t, 'Step 0: 前置 — 在 Lista 详情页 + 输入金额', async () => {
    await goToListaUsdtDetail(page);
    // 检查 input 是否已有金额（DEFI-LISTA-003 已填则跳过），否则填 STAKE_AMOUNT
    const inputValue = await page.evaluate(() => {
      const inp = document.querySelector('[data-testid="amount-input-input-element-input"]')
              || document.querySelector('input[placeholder="0"]');
      return inp ? inp.value : null;
    });
    if (inputValue === STAKE_AMOUNT) {
      return `input already = "${STAKE_AMOUNT}", skip fill`;
    }
    await fillAmount(page, STAKE_AMOUNT);
    return `filled ${STAKE_AMOUNT}`;
  });

  await sStep(page, t, 'Step 1: 点详情页底部「授权」按钮', async () => {
    await clickByTestid(page, 'page-footer-confirm');
    await sleep(1500);
    return 'authorize button clicked';
  });

  await sStep(page, t, 'Step 2: 等签名弹窗 → 点弹窗内「确认」（授权交易）', async () => {
    const result = await clickModalConfirm(page, 8000);
    return `modal confirm clicked, modal count ${result.beforeCount}→${result.afterCount}`;
  });

  await sStep(page, t, 'Step 3: 等授权交易完成（弹窗关闭 + footer 按钮变「认购」）', async () => {
    await waitForModalClose(page, 15000);
    const newText = await waitForFooterText(page, '认购', 30000);
    if (!newText) throw new Error('授权完成后底部按钮没变成「认购」');
    return `footer now shows "${newText}"`;
  });

  await sStep(page, t, 'Step 4: 点底部「认购」按钮', async () => {
    await clickByTestid(page, 'page-footer-confirm');
    await sleep(1500);
    return 'subscribe button clicked';
  });

  await sStep(page, t, 'Step 5: 等认购签名弹窗 → 点弹窗内「确认」', async () => {
    const result = await clickModalConfirm(page, 8000);
    return `modal confirm clicked, modal count ${result.beforeCount}→${result.afterCount}`;
  });

  await sStep(page, t, 'Step 6: 等认购交易提交（弹窗关闭，无失败提示）', async () => {
    await waitForModalClose(page, 15000);
    const hasError = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return /失败|Failed|Error/.test(text) && !/失败原因|可能失败|失败次数/.test(text);
    });
    if (hasError) throw new Error('页面显示交易失败');
    return 'subscribed';
  });

  return t.result();
}

/**
 * DEFI-LISTA-005: 历史记录验证（轮询最多 60 秒）
 */
async function testDefiLista005(page) {
  const t = createStepTracker('DEFI-LISTA-005');

  // 前置：确保在 Lista USDT 详情页（独立运行场景下也能跑通）
  await sStep(page, t, 'Step 0: 前置 — 确保在 Lista USDT 详情页', async () => {
    await goToListaUsdtDetail(page);
    return 'on Lista detail';
  });

  await sStep(page, t, '点击 Lista 详情页右上角的「历史记录」入口（不是 Wallet 历史）', async () => {
    // K-126 实探：真实 testid 是 `staking-has-content-btn`，但页面上有 2 个实例
    //   - x=1177 y=127  ⭐ Lista 详情页右上角
    //   - x=891  y=136  另一处
    // 必须选 x > viewport.width/2 的那个（更靠右），且文本 == '历史记录'
    // 加 10 次 retry × 500ms 容错（DEFI-LISTA-004 完成后页面可能还在 modal 关闭过渡中）
    let pos = null;
    let lastDiag = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const result = await page.evaluate(() => {
        const diag = { testidCount: 0, textCount: 0 };
        // 优先：staking-has-content-btn + text='历史记录' + x 在右半屏
        for (const el of document.querySelectorAll('[data-testid="staking-has-content-btn"]')) {
          diag.testidCount++;
          if ((el.textContent || '').trim() !== '历史记录') continue;
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && r.x > window.innerWidth / 2) {
            return { x: r.x + r.width / 2, y: r.y + r.height / 2, src: 'testid', diag };
          }
        }
        // Fallback: 文本「历史记录」 + 右上角
        for (const el of document.querySelectorAll('span, div, button')) {
          if (el.textContent?.trim() !== '历史记录' || el.children.length !== 0) continue;
          diag.textCount++;
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && r.y > 80 && r.y < 350 && r.x > window.innerWidth / 2) {
            return { x: r.x + r.width / 2, y: r.y + r.height / 2, src: 'text-position', diag };
          }
        }
        return { diag };
      });
      lastDiag = result.diag;
      if (result.x !== undefined) { pos = result; break; }
      await sleep(500);
    }
    if (!pos) throw new Error(`找不到 Lista 详情页右上角「历史记录」按钮（10 retries × 500ms。诊断：testid 实例数=${lastDiag?.testidCount}, 文本「历史记录」叶子数=${lastDiag?.textCount}）`);
    await page.mouse.click(pos.x, pos.y);
    await sleep(1500);
    return `clicked at (${Math.round(pos.x)}, ${Math.round(pos.y)}) via ${pos.src}`;
  });

  await sStep(page, t, `轮询最多 120 秒等待 Lista ${STAKE_AMOUNT} USDT 认购记录出现`, async () => {
    // 用户实测：链上确认通常需要约 1 分钟，原 60s 是边界值容易踩到 → 改 120s 给 RPC 节点同步留余地
    const start = Date.now();
    let found = false;
    while (Date.now() - start < 120_000) {
      found = await findListaHistoryEntry(page, STAKE_AMOUNT);
      if (found) break;
      await sleep(2000);
    }
    if (!found) throw new Error(`120 秒内未在历史列表找到 Lista ${STAKE_AMOUNT} 条目`);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    return `found after ${elapsed}s`;
  });

  await sStep(page, t, '关闭历史记录弹窗（回到 Lista 详情页）', async () => {
    // K-115: nav-header-back/close 是 SVG button，el.click() 不可靠，必须 page.mouse.click(x, y)
    // K-131: 加 retry 直到 modal 真的关闭（最多 6 次 × 800ms）
    let closed = false;
    for (let attempt = 0; attempt < 6; attempt++) {
      // 检查当前是否还有 modal
      const modalCount = await page.evaluate(() =>
        document.querySelectorAll('[data-testid="APP-Modal-Screen"]').length
      );
      if (modalCount === 0) { closed = true; break; }

      // 找最顶层 modal 的关闭按钮（nav-header-back 优先，nav-header-close 备选）
      const pos = await page.evaluate(() => {
        const modals = [...document.querySelectorAll('[data-testid="APP-Modal-Screen"]')];
        const topModal = modals[modals.length - 1]; // 最顶层
        if (!topModal) return null;
        for (const sel of ['[data-testid="nav-header-back"]', '[data-testid="nav-header-close"]', '[data-testid="page-close-trigger"]']) {
          const el = topModal.querySelector(sel) || document.querySelector(sel);
          if (el) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              return { x: r.x + r.width / 2, y: r.y + r.height / 2, sel };
            }
          }
        }
        // Fallback: 按键 Escape
        return null;
      });

      if (pos) {
        await page.mouse.click(pos.x, pos.y);
      } else {
        // 兜底：Escape
        await page.keyboard.press('Escape').catch(() => {});
      }
      await sleep(800);
    }
    if (!closed) throw new Error('历史记录 modal 未关闭（6 次尝试后仍有未关闭的 modal）');
    return 'history modal closed';
  });

  return t.result();
}

/**
 * DEFI-LISTA-006: 持仓列表 + 赎回流程
 *
 * 正确路径（来自用户反馈 2026-05-20 修正）：
 *   入口是 DeFi → 「持仓」tab（首页-我的持仓列表），不是 Lista USDT 详情页
 *   1. 进入 DeFi 主页 → 切「持仓」tab
 *   2. 在持仓列表找 Lista 仓位行
 *   3. 点该行的「管理」按钮 → 进入 Lista ManagePosition
 *   4. 切「赎回」tab → 输入金额 → 提交
 */
async function testDefiLista006(page) {
  const t = createStepTracker('DEFI-LISTA-006');

  // Step 0a: 前置 — 确保在 DeFi → 「持仓」tab（赎回入口）
  await sStep(page, t, 'Step 0a: 前置 — 进入 DeFi → 「持仓」tab', async () => {
    await goToDefiPortfolioTab(page);
    return 'on DeFi 持仓 tab';
  });

  // Step 0b: 前置清理 — 确保没有遗留 modal（防 DEFI-LISTA-005 关 modal 失败导致 006 找不到按钮）
  await sStep(page, t, 'Step 0b: 前置清理遗留 modal（防 005 没关干净）', async () => {
    let cleaned = 0;
    for (let i = 0; i < 6; i++) {
      const cnt = await page.evaluate(() => document.querySelectorAll('[data-testid="APP-Modal-Screen"]').length);
      if (cnt === 0) break;
      const pos = await page.evaluate(() => {
        const modals = [...document.querySelectorAll('[data-testid="APP-Modal-Screen"]')];
        const top = modals[modals.length - 1];
        for (const sel of ['nav-header-back', 'nav-header-close', 'page-close-trigger']) {
          const el = top.querySelector(`[data-testid="${sel}"]`) || document.querySelector(`[data-testid="${sel}"]`);
          if (el) {
            const r = el.getBoundingClientRect();
            if (r.width > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
          }
        }
        return null;
      });
      if (pos) {
        await page.mouse.click(pos.x, pos.y);
      } else {
        await page.keyboard.press('Escape').catch(() => {});
      }
      cleaned++;
      await sleep(800);
    }
    return `cleaned ${cleaned} modal(s)`;
  });

  // Step 1: 在 DeFi 我的持仓列表找 Lista 行 并点它**同行**的「管理」按钮
  //         注意：每行（Lista/Pendle/Morpho 等）都有自己的「管理」按钮，必须按 row y 范围匹配
  //         之前用 clickText('管理') 会撞到第一个，可能选到 Morpho/Pendle 的，导致跑错协议
  await sStep(page, t, 'Step 1: 找 Lista 持仓行 + 点该行的「管理」按钮（跳 Lista ManagePosition）', async () => {
    // 1. 先滚动到 earn-portfolio-item-Lista 进入视口
    let listaY = null;
    for (let i = 0; i < 15; i++) {
      listaY = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="earn-portfolio-item-Lista"]');
        if (!el) return null;
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        const r = el.getBoundingClientRect();
        return r.width > 0 ? Math.round(r.y + r.height / 2) : null;
      });
      if (listaY !== null) break;
      // 滚 portfolio 列表的滚动容器
      await page.evaluate(() => {
        for (const div of document.querySelectorAll('div')) {
          const cs = window.getComputedStyle(div);
          if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && div.scrollHeight > div.clientHeight + 5) {
            div.scrollBy(0, 350); return;
          }
        }
      });
      await sleep(400);
    }
    if (listaY === null) throw new Error('未找到 earn-portfolio-item-Lista（15 次滚动后）');

    // 2. 找该 row 下方（同卡片内）的「管理」按钮
    //    K-135 修正：portfolio 卡片结构是 row（协议名）+ 信息行（含「管理」），「管理」按钮**在 row 下方**
    //    所以 dy 必须 ≥ -20（不能在 row 上方，避免抓到上方相邻协议的「管理」），且 ≤ 150（卡片高度限制）
    //    在合法范围内取 dy 最小的（最贴近 row 下方）
    let targetPos = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      targetPos = await page.evaluate((listaCY) => {
        const items = [];
        for (const el of document.querySelectorAll('span, div, button')) {
          if ((el.textContent || '').trim() !== '管理' || el.children.length !== 0) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const dy = r.y + r.height / 2 - listaCY;
          // ⚠️ 关键：dy 不能 < -20，避免抓到上方协议（如 Pendle）的「管理」按钮
          if (dy >= -20 && dy <= 150 && r.x > 1000) {
            items.push({ x: r.x + r.width / 2, y: r.y + r.height / 2, dy });
          }
        }
        if (items.length === 0) return null;
        // 取 dy 最小（最贴近 row 下方）
        items.sort((a, b) => a.dy - b.dy);
        return items[0];
      }, listaY);
      if (targetPos) break;
      await sleep(500);
    }
    if (!targetPos) throw new Error(`未找到 Lista row（y=${listaY}）下方紧邻的「管理」按钮（dy 必须在 -20~150 范围内，6 次 retry）`);

    await page.mouse.click(targetPos.x, targetPos.y);
    await sleep(2500);

    // 3. 验证已跳到 Lista ManagePosition（URL 含 provider=lista）
    const urlOk = await page.evaluate(() => location.href.includes('ManagePosition') && location.href.includes('provider=lista'));
    if (!urlOk) {
      const url = await page.evaluate(() => location.href);
      throw new Error(`点击「管理」后未跳到 Lista ManagePosition 页（实际 URL: ${url.slice(0, 100)}）`);
    }

    return `clicked Lista 管理 at (${Math.round(targetPos.x)}, ${Math.round(targetPos.y)}), now on ManagePosition`;
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

  await sStep(page, t, '点击底部「赎回」按钮（弹出签名弹窗）', async () => {
    // 优先 staking-withdraw-confirm-btn，fallback page-footer-confirm
    let clicked = false;
    for (const tid of ['staking-withdraw-confirm-btn', 'redemption-redeem-confirm-btn', 'page-footer-confirm']) {
      try { await clickByTestid(page, tid); clicked = true; break; } catch {}
    }
    if (!clicked) throw new Error('找不到「赎回」按钮');
    await sleep(1500);
    return 'redeem button clicked';
  });

  await sStep(page, t, '等签名弹窗 → 点弹窗内「确认」（赎回交易）', async () => {
    const result = await clickModalConfirm(page, 8000);
    return `modal confirm clicked, modal count ${result.beforeCount}→${result.afterCount}`;
  });

  await sStep(page, t, '等赎回交易提交完成（弹窗关闭，无失败提示）', async () => {
    await waitForModalClose(page, 15000);
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
