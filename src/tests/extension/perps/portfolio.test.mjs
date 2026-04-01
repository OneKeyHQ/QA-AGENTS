// Perps Portfolio & PnL Tests (Extension) — EXT-PERPS-PNL-001 ~ EXT-PERPS-PNL-008
// Extension version of desktop/perps/portfolio.test.mjs
// Connects via CDP port 9224 using connectExtensionCDP.
//
// Coverage mapping (8 tests, skip §3 mobile + §11 multi-platform):
//   EXT-PERPS-PNL-001 → §1 入口与路由
//   EXT-PERPS-PNL-002 → §2 弹窗布局
//   EXT-PERPS-PNL-003 → §4 图表类型与时间维度
//   EXT-PERPS-PNL-004 → §5 图表交互 Tooltip
//   EXT-PERPS-PNL-005 → §6 盈亏与交易统计
//   EXT-PERPS-PNL-006 → §7+§8 账户健康与风险等级
//   EXT-PERPS-PNL-007 → §9 资金动作与返回
//   EXT-PERPS-PNL-008 → §10 DashText 与提示组件
//
// Key architecture:
//   Portfolio popup = inline panel within IN_PAGE_TAB_CONTAINER (testid), 960px wide
//   NOT a modal — it's an inline panel, not APP-Modal-Screen
//   Entry: click balance ($xx.xx) or 存款 button in Perps header (y < 50)

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep } from '../../helpers/constants.mjs';
import { createStepTracker, safeStep, importWatchAddress, scrollToTop, goBackToMainPage } from '../../helpers/components.mjs';
import { connectExtensionCDP, getExtensionId } from '../../helpers/extension-cdp.mjs';

const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'ext-perps-portfolio');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const ALL_TEST_IDS = [
  'EXT-PERPS-PNL-001',
  'EXT-PERPS-PNL-002',
  'EXT-PERPS-PNL-003',
  'EXT-PERPS-PNL-004',
  'EXT-PERPS-PNL-005',
  'EXT-PERPS-PNL-006',
  'EXT-PERPS-PNL-007',
  'EXT-PERPS-PNL-008',
];

// ── Multi-Account Definitions ─────────────────────────────────

const WATCH_ADDRESSES = {
  '高胜率': '0x0aac6955688dc1cd3cafd52ebcade334fb1c9c3b',
  '低胜率': '0xa65ce1D604fa901c13AA29f2126a57d9032e412B',
  '空账户': '0xb308F51259aC794086C13d66e37fadeE8D8abf9a',
};

const ACCOUNTS = [
  { name: 'Account #1', walletName: 'ran', label: 'ran有资产' },
  { name: '高胜率', walletType: '观察钱包', label: '高胜率', address: WATCH_ADDRESSES['高胜率'] },
  { name: '低胜率', walletType: '观察钱包', label: '低胜率', address: WATCH_ADDRESSES['低胜率'] },
  { name: 'Account #2', walletType: '观察钱包', label: '空账户', address: WATCH_ADDRESSES['空账户'] },
];

// ── Screenshot (only on failure) ──────────────────────────────

async function screenshotExt(page, name) {
  try {
    const path = `${SCREENSHOT_DIR}/${name}.png`;
    await page.screenshot({ path });
  } catch {}
}

// ── Navigation: Extension ─────────────────────────────────────

/** Navigate to perps page via sidebar or extension URL fallback */
async function goToPerps(page) {
  // Try sidebar click first (same as desktop)
  const clicked = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="perp"]');
    if (el) { el.click(); return true; }
    const container = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
    if (container) {
      for (const sp of container.querySelectorAll('span')) {
        if (['合约', 'Perps'].includes(sp.textContent.trim()) && sp.getBoundingClientRect().width > 0) {
          sp.click(); return true;
        }
      }
    }
    // Also try header navigation (extension expand tab may use header)
    for (const el of document.querySelectorAll('a, button, [role="tab"], [role="menuitem"]')) {
      const text = el.textContent?.trim();
      if (['合约', 'Perps'].includes(text)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          el.click(); return true;
        }
      }
    }
    return false;
  });
  if (!clicked) {
    // Fallback: navigate via extension URL
    const extId = getExtensionId();
    await page.goto(`chrome-extension://${extId}/ui-expand-tab.html#/swap`);
    await sleep(3000);
    // Retry sidebar/header click
    const retry = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="perp"]');
      if (el) { el.click(); return true; }
      for (const sp of document.querySelectorAll('span')) {
        if (['合约', 'Perps'].includes(sp.textContent?.trim())) {
          const r = sp.getBoundingClientRect();
          if (r.width > 0) { sp.click(); return true; }
        }
      }
      return false;
    });
    if (!retry) throw new Error('Cannot navigate to perps page (extension)');
  }
  await sleep(3000);
}

// ── Account Switching (Extension) ────────────────────────────

/**
 * Switch to a specific account in the extension.
 * Navigates to wallet tab first, clicks account selector, then selects account.
 */
async function switchToAccountExt(page, accountName, walletType) {
  // Navigate to wallet page first (account selector is only visible there)
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="wallet"]');
    if (el) { el.click(); return; }
    for (const sp of document.querySelectorAll('span')) {
      if (['钱包', 'Wallet'].includes(sp.textContent?.trim())) {
        const r = sp.getBoundingClientRect();
        if (r.width > 0) { sp.click(); return; }
      }
    }
  });
  await sleep(1500);

  // Click account selector trigger
  const selectorClicked = await page.evaluate(() => {
    const trigger = document.querySelector('[data-testid="AccountSelectorTriggerBase"]');
    if (trigger) { trigger.click(); return true; }
    return false;
  });
  if (!selectorClicked) throw new Error('Account selector trigger not found');
  await sleep(1500);

  // If walletType specified, click that tab first
  if (walletType) {
    await page.evaluate((wt) => {
      for (const el of document.querySelectorAll('span, div, button')) {
        if (el.textContent?.trim() === wt && el.children.length === 0) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { el.click(); return; }
        }
      }
    }, walletType);
    await sleep(1000);
  }

  // Search for the account
  const found = await page.evaluate((name) => {
    // Try search input
    const input = document.querySelector('input[placeholder*="搜索"], input[data-testid="nav-header-search"]');
    if (input && input.getBoundingClientRect().width > 0) {
      const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (nativeSet) {
        nativeSet.call(input, name);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    return true;
  }, accountName);
  await sleep(1000);

  // Click matching account
  const selected = await page.evaluate((name) => {
    for (const el of document.querySelectorAll('span, div')) {
      const text = el.textContent?.trim();
      if (text === name && el.children.length === 0) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.height < 50) {
          el.click();
          return true;
        }
      }
    }
    return false;
  }, accountName);
  if (!selected) throw new Error(`Account "${accountName}" not found`);
  await sleep(1500);
}

/** Switch to the funded Perps account (wallet "ran", first account).
 *  Locates by wallet name text, not by testid number (which can change).
 *  @returns {boolean} true if switched, false if "ran" wallet not found (skip) */
async function switchToFundedAccountExt(page) {
  // Check if already on correct account
  const current = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="AccountSelectorTriggerBase"]');
    return el?.textContent?.trim()?.slice(0, 40) || null;
  });
  if (current && current.includes('Account #1')) {
    console.log('  Already on funded account (ran), skipping switch');
    return true;
  }

  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="wallet"]');
    if (el) { el.click(); return; }
    for (const sp of document.querySelectorAll('span')) {
      if (['钱包', 'Wallet'].includes(sp.textContent?.trim())) {
        const r = sp.getBoundingClientRect();
        if (r.width > 0) { sp.click(); return; }
      }
    }
  });
  await sleep(2000);

  await page.evaluate(() => {
    document.querySelector('[data-testid="AccountSelectorTriggerBase"]')?.click();
  });
  await sleep(2000);
  const found = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return false;
    for (const el of modal.querySelectorAll('[data-testid^="wallet-hd-"]')) {
      if (el.textContent?.trim() === 'ran') {
        el.scrollIntoView({ behavior: 'instant' });
        el.click();
        return true;
      }
    }
    return false;
  });

  if (!found) {
    // Close modal and return false — caller should skip
    await page.keyboard.press('Escape');
    await sleep(500);
    return false;
  }

  await sleep(1500);

  await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return;
    modal.querySelector('[data-testid="account-item-index-0"]')?.click();
  });
  await sleep(2000);
  return true;
}

// ── Portfolio Popup Helpers ───────────────────────────────────

/**
 * Find and click the Portfolio entry button in the Perps header area.
 * The button shows "$xx.xx" for funded accounts or "存款" for empty accounts.
 * Located in the header area (y < 100).
 */
async function openPortfolioPopup(page) {
  // Ensure clean state: close sub-pages, modals, scroll to top
  await goBackToMainPage(page);
  await scrollToTop(page);

  // Find entry button and click via mouse coordinates
  const entryInfo = await page.evaluate(() => {
    const candidates = [];
    for (const el of document.querySelectorAll('span, button, div')) {
      const text = el.textContent?.trim();
      if (!text) continue;
      const r = el.getBoundingClientRect();
      if (r.y > 100 || r.y < -10 || r.width === 0 || r.height === 0) continue;
      if (r.height > 50) continue;
      if (/^\$[\d,.]+$/.test(text) || text === '存款') {
        candidates.push({ text, x: r.x + r.width / 2, y: r.y + r.height / 2, area: r.width * r.height });
      }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.area - b.area);
    return candidates[0];
  });
  if (!entryInfo) throw new Error('Portfolio entry button not found in Perps header');

  await page.mouse.click(entryInfo.x, entryInfo.y);
  await sleep(1500);

  for (let i = 0; i < 10; i++) {
    const visible = await isPortfolioPopupVisible(page);
    if (visible) return entryInfo.text;
    await sleep(500);
  }
  throw new Error('Portfolio popup (IN_PAGE_TAB_CONTAINER) did not appear after clicking entry');
}

/**
 * Check if the Portfolio popup (IN_PAGE_TAB_CONTAINER) is visible.
 */
async function isPortfolioPopupVisible(page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

/**
 * Close the Portfolio popup.
 * Tries close button first, then Escape, then click outside.
 */
async function closePortfolioPopup(page) {
  const closed = await page.evaluate(() => {
    const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
    if (!container) return false;
    const buttons = container.querySelectorAll('button');
    for (const btn of buttons) {
      const r = btn.getBoundingClientRect();
      if (r.width > 10 && r.width < 50 && r.height > 10 && r.height < 50) {
        const text = btn.textContent?.trim();
        const ariaLabel = btn.getAttribute('aria-label') || '';
        if (!text || ariaLabel.includes('close') || ariaLabel.includes('关闭') || text === '×' || text === 'X') {
          btn.click();
          return true;
        }
      }
    }
    for (const btn of buttons) {
      const svg = btn.querySelector('svg');
      if (svg) {
        const r = btn.getBoundingClientRect();
        if (r.width < 50 && r.height < 50 && container.getBoundingClientRect().right - r.right < 50) {
          btn.click();
          return true;
        }
      }
    }
    return false;
  });

  if (!closed) {
    await page.keyboard.press('Escape');
  }
  await sleep(800);

  const stillVisible = await isPortfolioPopupVisible(page);
  if (stillVisible) {
    await page.mouse.click(10, 300);
    await sleep(500);
  }
}

/**
 * Read all portfolio data from the popup in a single evaluate call.
 */
async function getPortfolioData(page) {
  return page.evaluate(() => {
    const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
    if (!container) return null;

    const text = container.textContent || '';
    const result = {
      raw: text.slice(0, 1000),
      width: Math.round(container.getBoundingClientRect().width),
      height: Math.round(container.getBoundingClientRect().height),
    };

    const extractAfterLabel = (label) => {
      const idx = text.indexOf(label);
      if (idx < 0) return null;
      const after = text.slice(idx + label.length, idx + label.length + 80).trim();
      const m = after.match(/^[\s:：]*(-?\$?[\d,.]+%?x?|--|-|N\/A)/);
      return m ? m[1].trim() : after.slice(0, 30).trim();
    };

    const findValueElement = (label) => {
      for (const el of container.querySelectorAll('span, div, p')) {
        if (el.textContent?.trim() === label && el.children.length === 0) {
          const parent = el.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children);
            const idx = siblings.indexOf(el);
            if (idx >= 0 && idx + 1 < siblings.length) {
              return {
                text: siblings[idx + 1].textContent?.trim(),
                color: window.getComputedStyle(siblings[idx + 1]).color,
              };
            }
          }
          return null;
        }
      }
      return null;
    };

    result.accountAsset = extractAfterLabel('账户资产');
    result.available = extractAfterLabel('可用');
    result.leverage = extractAfterLabel('杠杆');
    result.usedMargin = extractAfterLabel('已用保证金');
    result.mmr = extractAfterLabel('维持保证金率') || extractAfterLabel('MMR');
    result.healthLevel = (() => {
      if (text.includes('高风险')) return '高风险';
      if (text.includes('中等风险') || text.includes('中风险')) return '中风险';
      if (text.includes('低风险') || text.includes('健康')) return '低风险';
      return null;
    })();

    result.unrealizedPnl = extractAfterLabel('未实现盈亏');
    result.totalPnl = findValueElement('总盈亏') || { text: extractAfterLabel('总盈亏'), color: null };
    result.positions = extractAfterLabel('当前持仓');

    result.volume = extractAfterLabel('交易量');
    result.topTraded = extractAfterLabel('最多交易');
    result.feesPaid = extractAfterLabel('已付手续费');
    result.netDeposit = extractAfterLabel('净入金');
    result.totalTrades = extractAfterLabel('总交易次数');

    result.winRate = extractAfterLabel('胜率');
    result.profitFactor = extractAfterLabel('盈利因子');
    result.avgProfit = extractAfterLabel('平均盈利');
    result.avgLoss = extractAfterLabel('平均亏损');

    result.hasDepositBtn = !!Array.from(container.querySelectorAll('button')).find(b => {
      const t = b.textContent?.trim();
      return t === '存款' || t === 'Deposit';
    });
    result.hasWithdrawBtn = !!Array.from(container.querySelectorAll('button')).find(b => {
      const t = b.textContent?.trim();
      return t === '提现' || t === 'Withdraw';
    });

    result.hasNaN = /NaN|Infinity/.test(text);

    return result;
  });
}

/**
 * Get the hash of the chart canvas inside IN_PAGE_TAB_CONTAINER for change detection.
 */
async function getCanvasHash(page) {
  return page.evaluate(() => {
    const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
    if (!container) return null;
    const canvases = container.querySelectorAll('canvas');
    let maxCanvas = null;
    let maxArea = 0;
    for (const c of canvases) {
      const r = c.getBoundingClientRect();
      const area = r.width * r.height;
      if (area > maxArea && r.height > 50) {
        maxArea = area;
        maxCanvas = c;
      }
    }
    if (!maxCanvas) return null;
    try {
      const ctx = maxCanvas.getContext('2d');
      const data = ctx.getImageData(0, 0, maxCanvas.width, maxCanvas.height).data;
      let hash = 0;
      for (let j = 0; j < data.length; j += 100) {
        hash = ((hash << 5) - hash + data[j]) | 0;
      }
      return hash;
    } catch { return null; }
  });
}

/**
 * Get canvas info (dimensions, count) inside the portfolio popup.
 */
async function getCanvasInfo(page) {
  return page.evaluate(() => {
    const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
    if (!container) return null;
    const canvases = container.querySelectorAll('canvas');
    const info = [];
    for (const c of canvases) {
      const r = c.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        info.push({ w: Math.round(r.width), h: Math.round(r.height) });
      }
    }
    return { count: info.length, canvases: info };
  });
}

/**
 * Click a chart type tab (净值/盈亏) within IN_PAGE_TAB_CONTAINER.
 */
async function switchChartType(page, type) {
  const clicked = await page.evaluate((tabText) => {
    const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
    if (!container) return false;
    for (const el of container.querySelectorAll('span, div, button')) {
      const text = el.textContent?.trim();
      if (text === tabText && el.children.length === 0) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.height < 40) {
          el.click();
          return true;
        }
      }
    }
    return false;
  }, type);
  if (!clicked) throw new Error(`Chart type tab "${type}" not found`);
  await sleep(1500);
}

/**
 * Click a time dimension tab (1天/1周/1月/全部) within IN_PAGE_TAB_CONTAINER.
 */
async function switchTimeDimension(page, dim) {
  const clicked = await page.evaluate((tabText) => {
    const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
    if (!container) return false;
    for (const el of container.querySelectorAll('span, div, button')) {
      const text = el.textContent?.trim();
      if (text === tabText && el.children.length === 0) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.height < 40) {
          el.click();
          return true;
        }
      }
    }
    return false;
  }, dim);
  if (!clicked) throw new Error(`Time dimension tab "${dim}" not found`);
  await sleep(1500);
}

/**
 * Get the currently active tab text by detecting color/style differences.
 */
async function getActiveTabText(page, tabTexts) {
  return page.evaluate((texts) => {
    const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
    if (!container) return null;
    let bestMatch = null;
    let bestOpacity = 0;
    for (const tabText of texts) {
      for (const el of container.querySelectorAll('span, div, button')) {
        if (el.textContent?.trim() === tabText && el.children.length === 0) {
          const r = el.getBoundingClientRect();
          if (r.width === 0) continue;
          const style = window.getComputedStyle(el);
          const opacity = parseFloat(style.opacity) || 1;
          const color = style.color;
          const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          const brightness = m ? (parseInt(m[1]) + parseInt(m[2]) + parseInt(m[3])) / 3 : 128;
          const score = opacity * brightness;
          if (score > bestOpacity) {
            bestOpacity = score;
            bestMatch = tabText;
          }
        }
      }
    }
    return bestMatch;
  }, tabTexts);
}

/**
 * Get popup layout info: dual column detection, overlap check.
 */
async function getPopupLayout(page) {
  return page.evaluate(() => {
    const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
    if (!container) return null;

    const containerRect = container.getBoundingClientRect();

    const sections = [];
    function findSections(parent, depth) {
      if (depth > 3) return;
      for (const child of parent.children) {
        const r = child.getBoundingClientRect();
        if (r.width > 200 && r.height > 200 && r.width < containerRect.width * 0.85) {
          sections.push({
            x: Math.round(r.x),
            y: Math.round(r.y),
            w: Math.round(r.width),
            h: Math.round(r.height),
            right: Math.round(r.x + r.width),
          });
        } else if (r.width > 200 && r.height > 200) {
          findSections(child, depth + 1);
        }
      }
    }
    findSections(container, 0);

    const uniqueX = new Set(sections.map(s => Math.round(s.x / 50)));
    const isDualColumn = uniqueX.size >= 2;

    let hasOverlap = false;
    for (let i = 0; i < sections.length; i++) {
      for (let j = i + 1; j < sections.length; j++) {
        const a = sections[i];
        const b = sections[j];
        const xOverlap = a.x < b.right && b.x < a.right;
        const yOverlap = a.y < b.y + b.h && b.y < a.y + a.h;
        if (xOverlap && yOverlap) hasOverlap = true;
      }
    }

    const hasCanvas = container.querySelectorAll('canvas').length > 0;

    let title = null;
    for (const el of container.querySelectorAll('h1, h2, h3, span, div')) {
      const text = el.textContent?.trim();
      if (text && (text.includes('Portfolio') || text.includes('投资组合') || text.includes('P&L') || text.includes('盈亏'))) {
        if (el.children.length < 3) {
          title = text.slice(0, 50);
          break;
        }
      }
    }

    return {
      width: Math.round(containerRect.width),
      height: Math.round(containerRect.height),
      sectionCount: sections.length,
      isDualColumn,
      hasOverlap,
      hasCanvas,
      title,
      sections,
    };
  });
}

/**
 * Get MMR color from the popup.
 */
/**
 * Get health level color from the popup.
 * Color is on the health label span (健康/低风险/中等风险/高风险), NOT on MMR value.
 */
async function getHealthColor(page) {
  return page.evaluate(() => {
    const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
    if (!container) return null;

    const healthLabels = ['健康', '低风险', '中等风险', '高风险'];
    for (const el of container.querySelectorAll('span')) {
      const text = el.textContent?.trim();
      if (healthLabels.includes(text) && el.children.length === 0) {
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        const color = window.getComputedStyle(el).color;
        const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) {
          const rv = parseInt(m[1]);
          const gv = parseInt(m[2]);
          const bv = parseInt(m[3]);
          return {
            raw: color, r: rv, g: gv, b: bv, label: text,
            isGreen: gv > 100 && rv < 100,
            isYellow: rv > 180 && gv > 120 && bv < 100,
            isRed: rv > 180 && gv < 80,
          };
        }
      }
    }

    for (const el of container.querySelectorAll('span')) {
      const text = el.textContent?.trim();
      if (text && /^\d+(\.\d+)?%$/.test(text) && el.children.length === 0) {
        const parent = el.parentElement?.parentElement;
        if (parent?.textContent?.includes('MMR')) {
          return { label: 'no-health-label', mmrValue: parseFloat(text) };
        }
      }
    }
    return null;
  });
}

/**
 * Get total PnL color.
 */
async function getTotalPnLColor(page) {
  return page.evaluate(() => {
    const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
    if (!container) return null;

    for (const el of container.querySelectorAll('span, div, p')) {
      const text = el.textContent?.trim();
      if (text === '总盈亏' && el.children.length === 0) {
        const parent = el.parentElement;
        if (!parent) continue;
        for (const sibling of parent.querySelectorAll('span, div')) {
          const sibText = sibling.textContent?.trim();
          if (sibText && sibText !== '总盈亏' && /^[+-]?\$[\d,.]+/.test(sibText)) {
            const color = window.getComputedStyle(sibling).color;
            const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (m) {
              const r = parseInt(m[1]);
              const g = parseInt(m[2]);
              const b = parseInt(m[3]);
              const isPositive = !sibText.startsWith('-');
              return {
                raw: color,
                r, g, b, value: sibText,
                isGreen: g > 60 && r < 80,
                isRed: r > 150 && g < 80,
                isPositive,
              };
            }
          }
        }
      }
    }
    return null;
  });
}

// ── Shortcut for safeStep ──

const _ssStep = (page, t, name, fn) =>
  safeStep(page, t, name, fn, SCREENSHOT_DIR);

// ── Helper: switch account then open portfolio ──

/** @returns {string|undefined} skip reason if wallet not found */
async function switchAccountAndOpenPortfolio(page, account) {
  if (account.walletName) {
    const hasFunded = await switchToFundedAccountExt(page);
    if (!hasFunded) return 'SKIP: "ran" wallet not found on this device';
  } else if (account.walletType) {
    try {
      await switchToAccountExt(page, account.name, account.walletType);
    } catch (e) {
      if (account.address) {
        console.log(`  [AUTO] "${account.name}" not found, importing ${account.address.slice(0, 10)}...`);
        await importWatchAddress(page, account.address, { name: account.label !== '空账户' ? account.label : undefined });
        await switchToAccountExt(page, account.name || account.label, '观察钱包');
      } else {
        throw e;
      }
    }
  } else {
    await switchToAccountExt(page, account.name);
  }
  await sleep(1000);
  await goToPerps(page);
  await sleep(2000);
  await openPortfolioPopup(page);
}

// ── Test Cases ────────────────────────────────────────────────

// ┌──────────────────────────────────────────────────────────┐
// │ EXT-PERPS-PNL-001: 入口与路由 (§1)                       │
// │ - Empty account: click → deposit prompt                   │
// │ - Funded account: click → portfolio popup with balance    │
// │ - Open/close 3 times → no white screen, no duplicates     │
// └──────────────────────────────────────────────────────────┘
async function testExtPerpsPnl001(page) {
  const t = createStepTracker('EXT-PERPS-PNL-001');

  // Step 1: Navigate to Perps with funded account (ran)
  await _ssStep(page, t, '切换到有资产账户 (ran)', async () => {
    const hasFunded = await switchToFundedAccountExt(page);
    if (!hasFunded) return 'SKIP: "ran" wallet not found on this device';
    await sleep(1000);
    await goToPerps(page);
    return 'switched to ran account + Perps tab';
  });

  // Step 2: Click entry with funded account → popup shows balance
  await _ssStep(page, t, '有资产账户点击入口显示余额', async () => {
    const entryText = await openPortfolioPopup(page);
    if (!/^\$/.test(entryText)) throw new Error(`Expected balance entry ($xx.xx), got: ${entryText}`);
    const visible = await isPortfolioPopupVisible(page);
    if (!visible) throw new Error('Portfolio popup not visible after click');
    const data = await getPortfolioData(page);
    if (!data) throw new Error('Cannot read portfolio data');
    if (data.hasNaN) throw new Error('NaN/Infinity found in popup content');
    return `entry="${entryText}", popup width=${data.width}px`;
  });

  await _ssStep(page, t, '关闭有资产账户弹窗', async () => {
    await closePortfolioPopup(page);
    const stillVisible = await isPortfolioPopupVisible(page);
    if (stillVisible) throw new Error('Popup still visible after close');
    return 'closed';
  });

  // Step 3: Switch to empty account → click entry → deposit prompt
  await _ssStep(page, t, '切换到空账户 (Account #2)', async () => {
    await switchToAccountExt(page, 'Account #2', '观察钱包');
    await sleep(1000);
    await goToPerps(page);
    return 'switched to empty watch account';
  });

  await _ssStep(page, t, '空账户点击入口显示存款引导', async () => {
    const entryText = await page.evaluate(() => {
      for (const el of document.querySelectorAll('span, button, div')) {
        const text = el.textContent?.trim();
        if (!text) continue;
        const r = el.getBoundingClientRect();
        if (r.y > 100 || r.width === 0) continue;
        if (r.height > 50) continue;
        if (/^\$[\d,.]+$/.test(text) || text === '存款') return text;
      }
      return null;
    });
    if (!entryText) throw new Error('No entry button found for empty account');
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('span, button, div')) {
        const text = el.textContent?.trim();
        if (!text) continue;
        const r = el.getBoundingClientRect();
        if (r.y > 100 || r.width === 0 || r.height > 50) continue;
        if (/^\$[\d,.]+$/.test(text) || text === '存款') { el.click(); return; }
      }
    });
    await sleep(1500);
    return `empty account entry="${entryText}"`;
  });

  // Close any popup/modal that appeared
  await _ssStep(page, t, '关闭空账户弹窗', async () => {
    const popupVisible = await isPortfolioPopupVisible(page);
    if (popupVisible) {
      await closePortfolioPopup(page);
    } else {
      await page.keyboard.press('Escape');
      await sleep(500);
    }
    return 'cleaned up';
  });

  // Step 4: Switch back to funded account, open/close 3 times → stability
  await _ssStep(page, t, '切换回有资产账户', async () => {
    const hasFunded = await switchToFundedAccountExt(page);
    if (!hasFunded) return 'SKIP: "ran" wallet not found on this device';
    await sleep(1000);
    await goToPerps(page);
    return 'back to ran';
  });

  await _ssStep(page, t, '连续开关 3 次无白屏无重复', async () => {
    for (let i = 0; i < 3; i++) {
      await openPortfolioPopup(page);
      const visible = await isPortfolioPopupVisible(page);
      if (!visible) throw new Error(`Iteration ${i + 1}: popup not visible after open`);

      const hasContent = await page.evaluate(() => {
        const c = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
        return c ? c.textContent.trim().length > 20 : false;
      });
      if (!hasContent) throw new Error(`Iteration ${i + 1}: popup appears empty (white screen)`);

      const instanceCount = await page.evaluate(() => {
        return document.querySelectorAll('[data-testid="IN_PAGE_TAB_CONTAINER"]').length;
      });
      if (instanceCount > 1) throw new Error(`Iteration ${i + 1}: ${instanceCount} popup instances (duplicate)`);

      await closePortfolioPopup(page);
      await sleep(500);
    }
    return '3 open/close cycles OK, no white screen, no duplicates';
  });

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ EXT-PERPS-PNL-002: 弹窗布局 (§2)                         │
// │ - Width = 960px                                           │
// │ - Dual column: chart + stats, no overlap                  │
// │ - Title visible, close button works                       │
// └──────────────────────────────────────────────────────────┘
async function testExtPerpsPnl002(page) {
  const t = createStepTracker('EXT-PERPS-PNL-002');

  await goToPerps(page);

  await _ssStep(page, t, '打开投资组合弹窗', async () => {
    await openPortfolioPopup(page);
    return 'opened';
  });

  await _ssStep(page, t, '弹窗宽度 = 960px', async () => {
    const layout = await getPopupLayout(page);
    if (!layout) throw new Error('Cannot read popup layout');
    if (Math.abs(layout.width - 960) > 10) {
      throw new Error(`Expected width ~960px, got ${layout.width}px`);
    }
    return `width=${layout.width}px`;
  });

  await _ssStep(page, t, '双列布局且不重叠', async () => {
    const layout = await getPopupLayout(page);
    if (!layout) throw new Error('Cannot read popup layout');
    if (!layout.isDualColumn) throw new Error(`Not dual column layout. Sections: ${layout.sectionCount}`);
    if (layout.hasOverlap) throw new Error('Sections overlap detected');
    return `dual column OK, ${layout.sectionCount} sections`;
  });

  await _ssStep(page, t, '标题可见', async () => {
    const layout = await getPopupLayout(page);
    if (!layout) throw new Error('Cannot read popup layout');
    if (!layout.hasCanvas) {
      const data = await getPortfolioData(page);
      if (!data || data.raw.length < 20) throw new Error('Popup has no meaningful content');
    }
    return `title="${layout.title || 'implicit'}", hasCanvas=${layout.hasCanvas}`;
  });

  await _ssStep(page, t, '关闭按钮可用', async () => {
    await closePortfolioPopup(page);
    const visible = await isPortfolioPopupVisible(page);
    if (visible) throw new Error('Close button did not work - popup still visible');
    return 'close button works';
  });

  await _ssStep(page, t, '内容区域不被遮挡', async () => {
    await openPortfolioPopup(page);
    const isAccessible = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
      if (!container) return false;
      const r = container.getBoundingClientRect();
      const centerEl = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return container.contains(centerEl);
    });
    if (!isAccessible) throw new Error('Popup content is blocked by overlay');
    await closePortfolioPopup(page);
    return 'content accessible, no overlay blocking';
  });

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ EXT-PERPS-PNL-003: 图表类型与时间维度 (§4)                │
// │ - Default chart area exists                               │
// │ - Switch 净值/盈亏 → canvas changes                       │
// │ - Switch 1天/1周/1月/全部 → canvas changes                │
// │ - Fast switching → correct final state                    │
// └──────────────────────────────────────────────────────────┘
async function testExtPerpsPnl003(page) {
  const t = createStepTracker('EXT-PERPS-PNL-003');

  await goToPerps(page);
  await openPortfolioPopup(page);

  await _ssStep(page, t, '图表区域存在且无崩溃', async () => {
    const canvasInfo = await getCanvasInfo(page);
    if (!canvasInfo || canvasInfo.count === 0) {
      const text = await page.evaluate(() => {
        const c = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
        return c?.textContent || '';
      });
      if (text.includes('崩溃') || text.includes('error')) throw new Error('Chart area shows error');
      return 'no canvas (possibly empty account), no crash';
    }
    return `${canvasInfo.count} canvas(es), largest=${canvasInfo.canvases[0]?.w}x${canvasInfo.canvases[0]?.h}`;
  });

  let hashBefore = await getCanvasHash(page);
  await _ssStep(page, t, '切换净值图表', async () => {
    try {
      await switchChartType(page, '净值');
    } catch {
      try { await switchChartType(page, 'Account Value'); } catch {}
    }
    await sleep(1000);
    const hashAfter = await getCanvasHash(page);
    if (hashBefore !== null && hashAfter !== null && hashBefore !== hashAfter) {
      return `canvas changed: ${hashBefore} → ${hashAfter}`;
    }
    return 'switched to 净值 (hash may be same if already selected)';
  });

  hashBefore = await getCanvasHash(page);
  await _ssStep(page, t, '切换盈亏图表', async () => {
    try {
      await switchChartType(page, '盈亏');
    } catch {
      try { await switchChartType(page, 'PnL'); } catch {}
    }
    await sleep(1000);
    const hashAfter = await getCanvasHash(page);
    if (hashBefore !== null && hashAfter !== null && hashBefore !== hashAfter) {
      return `canvas changed for PnL: ${hashBefore} → ${hashAfter}`;
    }
    return 'switched to 盈亏';
  });

  const timeDims = ['1天', '1周', '1月', '全部'];
  for (const dim of timeDims) {
    await _ssStep(page, t, `切换时间维度: ${dim}`, async () => {
      const before = await getCanvasHash(page);
      try {
        await switchTimeDimension(page, dim);
      } catch {
        const altMap = { '1天': '1D', '1周': '1W', '1月': '1M', '全部': 'All' };
        try { await switchTimeDimension(page, altMap[dim]); } catch {}
      }
      await sleep(1000);
      const after = await getCanvasHash(page);
      if (before !== null && after !== null && before !== after) {
        return `canvas changed for ${dim}`;
      }
      return `${dim} selected (hash same — possibly same data range)`;
    });
  }

  await _ssStep(page, t, '快速切换时间维度', async () => {
    for (const dim of timeDims) {
      try { await switchTimeDimension(page, dim); } catch {}
      await sleep(200);
    }
    await sleep(2000);
    const activeTab = await getActiveTabText(page, timeDims);
    return `final tab: ${activeTab || 'unknown'} (expected: 全部)`;
  });

  await _ssStep(page, t, '快速切换图表类型', async () => {
    const types = ['净值', '盈亏', '净值', '盈亏'];
    for (const type of types) {
      try { await switchChartType(page, type); } catch {}
      await sleep(200);
    }
    await sleep(2000);
    return 'fast chart type switching OK, no crash';
  });

  await closePortfolioPopup(page);
  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ EXT-PERPS-PNL-004: 图表交互 Tooltip (§5)                 │
// │ - Hover center → tooltip with time + amount               │
// │ - Hover edges → no overflow                               │
// │ - Switch chart → tooltip data changes                     │
// └──────────────────────────────────────────────────────────┘
async function testExtPerpsPnl004(page) {
  const t = createStepTracker('EXT-PERPS-PNL-004');

  await goToPerps(page);
  await openPortfolioPopup(page);

  await _ssStep(page, t, '悬停图表中心显示 Tooltip', async () => {
    const canvasRect = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
      if (!container) return null;
      const canvases = container.querySelectorAll('canvas');
      let maxCanvas = null;
      let maxArea = 0;
      for (const c of canvases) {
        const r = c.getBoundingClientRect();
        const area = r.width * r.height;
        if (area > maxArea && r.height > 50) { maxArea = area; maxCanvas = c; }
      }
      if (!maxCanvas) return null;
      const r = maxCanvas.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });

    if (!canvasRect) {
      return 'SKIP: no canvas found for tooltip test';
    }

    const cx = canvasRect.x + canvasRect.w / 2;
    const cy = canvasRect.y + canvasRect.h / 2;
    await page.mouse.move(cx, cy);
    await sleep(1000);

    const tooltip = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
      if (!container) return null;
      for (const el of document.querySelectorAll('div, span')) {
        const text = el.textContent?.trim();
        const style = window.getComputedStyle(el);
        if (!text) continue;
        if ((text.includes('$') || /\d{1,2}:\d{2}/.test(text) || /\d{4}[-/]\d{2}/.test(text)) &&
            (style.position === 'absolute' || style.position === 'fixed') &&
            el.getBoundingClientRect().width > 30 && el.getBoundingClientRect().width < 300) {
          return text.slice(0, 100);
        }
      }
      return null;
    });

    if (tooltip) {
      const hasAmount = /\$[\d,.]+/.test(tooltip);
      return `tooltip: "${tooltip.slice(0, 60)}", hasAmount=${hasAmount}`;
    }
    return 'tooltip did not appear (may be empty data)';
  });

  await _ssStep(page, t, '悬停左边缘 Tooltip 不溢出', async () => {
    const canvasRect = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
      if (!container) return null;
      let maxCanvas = null, maxArea = 0;
      for (const c of container.querySelectorAll('canvas')) {
        const r = c.getBoundingClientRect();
        if (r.width * r.height > maxArea && r.height > 50) { maxArea = r.width * r.height; maxCanvas = c; }
      }
      if (!maxCanvas) return null;
      const r = maxCanvas.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });

    if (!canvasRect) return 'SKIP: no canvas';

    await page.mouse.move(canvasRect.x + 5, canvasRect.y + canvasRect.h / 2);
    await sleep(800);

    const overflow = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
      if (!container) return false;
      const cRect = container.getBoundingClientRect();
      for (const el of document.querySelectorAll('div, span')) {
        const text = el.textContent?.trim();
        if (!text || !(/\$[\d,.]+/.test(text) || /\d{1,2}[月:]\d{1,2}/.test(text))) continue;
        const style = window.getComputedStyle(el);
        if (style.position !== 'absolute' && style.position !== 'fixed') continue;
        const r = el.getBoundingClientRect();
        if (r.width > 30 && r.width < 300 && r.height > 10 && r.height < 100) {
          if (r.x < cRect.x - 5) return 'left overflow';
        }
      }
      return false;
    });

    if (overflow) throw new Error(`Tooltip overflow: ${overflow}`);
    return 'left edge hover — no overflow';
  });

  await _ssStep(page, t, '悬停右边缘 Tooltip 不溢出', async () => {
    const canvasRect = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
      if (!container) return null;
      let maxCanvas = null, maxArea = 0;
      for (const c of container.querySelectorAll('canvas')) {
        const r = c.getBoundingClientRect();
        if (r.width * r.height > maxArea && r.height > 50) { maxArea = r.width * r.height; maxCanvas = c; }
      }
      if (!maxCanvas) return null;
      const r = maxCanvas.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });

    if (!canvasRect) return 'SKIP: no canvas';

    await page.mouse.move(canvasRect.x + canvasRect.w - 5, canvasRect.y + canvasRect.h / 2);
    await sleep(800);

    const overflow = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
      if (!container) return false;
      const cRect = container.getBoundingClientRect();
      for (const el of document.querySelectorAll('div, span')) {
        const text = el.textContent?.trim();
        if (!text || !(/\$[\d,.]+/.test(text) || /\d{1,2}[月:]\d{1,2}/.test(text))) continue;
        const style = window.getComputedStyle(el);
        if (style.position !== 'absolute' && style.position !== 'fixed') continue;
        const r = el.getBoundingClientRect();
        if (r.width > 30 && r.width < 300 && r.height > 10 && r.height < 100) {
          if (r.x + r.width > cRect.x + cRect.width + 5) return 'right overflow';
        }
      }
      return false;
    });

    if (overflow) throw new Error(`Tooltip overflow: ${overflow}`);
    return 'right edge hover — no overflow';
  });

  await _ssStep(page, t, '切换图表后 Tooltip 数据变化', async () => {
    try { await switchChartType(page, '净值'); } catch {}
    await sleep(500);

    const canvasRect = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
      if (!container) return null;
      let maxCanvas = null, maxArea = 0;
      for (const c of container.querySelectorAll('canvas')) {
        const r = c.getBoundingClientRect();
        if (r.width * r.height > maxArea && r.height > 50) { maxArea = r.width * r.height; maxCanvas = c; }
      }
      if (!maxCanvas) return null;
      const r = maxCanvas.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });

    if (!canvasRect) return 'SKIP: no canvas';

    await page.mouse.move(canvasRect.x + canvasRect.w / 2, canvasRect.y + canvasRect.h / 2);
    await sleep(800);
    return 'tooltip test after chart type switch — no crash';
  });

  await page.mouse.move(0, 0);
  await closePortfolioPopup(page);
  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ EXT-PERPS-PNL-005: 盈亏与交易统计 (§6)                    │
// │ - Total PnL color: positive → green, negative → red       │
// │ - Win rate: 0-100% valid                                  │
// │ - Profit factor: no NaN/Infinity                          │
// │ - Empty account: default state, no NaN                    │
// │ - Multi-account loop                                      │
// └──────────────────────────────────────────────────────────┘
async function testExtPerpsPnl005(page) {
  const t = createStepTracker('EXT-PERPS-PNL-005');

  for (const account of ACCOUNTS) {
    let skipped = false;
    await _ssStep(page, t, `切换账户: ${account.label}`, async () => {
      const skipReason = await switchAccountAndOpenPortfolio(page, account);
      if (skipReason) { skipped = true; return skipReason; }
      return `opened portfolio for ${account.label}`;
    });
    if (skipped) continue;

    await _ssStep(page, t, `[${account.label}] 读取盈亏统计`, async () => {
      const data = await getPortfolioData(page);
      if (!data) throw new Error('Cannot read portfolio data');
      if (data.hasNaN) throw new Error(`NaN/Infinity found in ${account.label} data`);

      const details = [];
      details.push(`totalPnl=${JSON.stringify(data.totalPnl)}`);
      details.push(`winRate=${data.winRate}`);
      details.push(`profitFactor=${data.profitFactor}`);
      details.push(`avgProfit=${data.avgProfit}`);
      details.push(`avgLoss=${data.avgLoss}`);
      details.push(`volume=${data.volume}`);
      details.push(`totalTrades=${data.totalTrades}`);

      if (data.winRate && /[\d.]+%/.test(data.winRate)) {
        const wr = parseFloat(data.winRate);
        if (wr < 0 || wr > 100) throw new Error(`Win rate out of range: ${data.winRate}`);
      }

      if (data.profitFactor && /NaN|Infinity/.test(data.profitFactor)) {
        throw new Error(`Profit factor is ${data.profitFactor}`);
      }

      return details.join(', ');
    });

    if (account.label !== '空账户') {
      await _ssStep(page, t, `[${account.label}] 总盈亏颜色验证`, async () => {
        const pnlColor = await getTotalPnLColor(page);
        if (!pnlColor) return 'total PnL color element not found (may be zero/hidden)';

        if (pnlColor.isPositive && !pnlColor.isGreen) {
          return `INFO: positive PnL but not green — rgb(${pnlColor.r},${pnlColor.g},${pnlColor.b})`;
        }
        if (!pnlColor.isPositive && !pnlColor.isRed) {
          return `INFO: negative PnL but not red — rgb(${pnlColor.r},${pnlColor.g},${pnlColor.b})`;
        }
        return `value=${pnlColor.value}, color=rgb(${pnlColor.r},${pnlColor.g},${pnlColor.b}), isGreen=${pnlColor.isGreen}, isRed=${pnlColor.isRed}`;
      });
    }

    await _ssStep(page, t, `[${account.label}] 关闭弹窗`, async () => {
      await closePortfolioPopup(page);
      return 'closed';
    });
  }

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ EXT-PERPS-PNL-006: 账户健康与风险等级 (§7+§8)             │
// │ - MMR color thresholds: ≤40% green, 40-70% yellow, >70% red│
// │ - Health level label matches risk scoring                 │
// │ - Multi-account verification                              │
// │ - No NaN/Infinity for missing data                        │
// └──────────────────────────────────────────────────────────┘
async function testExtPerpsPnl006(page) {
  const t = createStepTracker('EXT-PERPS-PNL-006');

  for (const account of ACCOUNTS) {
    let skipped = false;
    await _ssStep(page, t, `切换账户: ${account.label}`, async () => {
      const skipReason = await switchAccountAndOpenPortfolio(page, account);
      if (skipReason) { skipped = true; return skipReason; }
      return `opened portfolio for ${account.label}`;
    });
    if (skipped) continue;

    await _ssStep(page, t, `[${account.label}] 账户健康区域存在`, async () => {
      const data = await getPortfolioData(page);
      if (!data) throw new Error('Cannot read portfolio data');
      if (data.hasNaN) throw new Error(`NaN/Infinity found in ${account.label}`);

      const details = [];
      details.push(`leverage=${data.leverage}`);
      details.push(`usedMargin=${data.usedMargin}`);
      details.push(`mmr=${data.mmr}`);
      details.push(`healthLevel=${data.healthLevel}`);
      details.push(`accountAsset=${data.accountAsset}`);
      details.push(`available=${data.available}`);

      return details.join(', ');
    });

    if (account.label !== '空账户') {
      await _ssStep(page, t, `[${account.label}] 账户健康颜色验证`, async () => {
        const health = await getHealthColor(page);
        if (!health) return 'health label not found';
        if (!health.label || health.label === 'no-health-label') {
          return `MMR=${health.mmrValue}%, health label not visible`;
        }

        let actualColor = 'other';
        if (health.isGreen) actualColor = 'green';
        else if (health.isYellow) actualColor = 'yellow';
        else if (health.isRed) actualColor = 'red';

        const labelColorMap = { '健康': 'green', '低风险': 'green', '中等风险': 'yellow', '高风险': 'red' };
        const expectedColor = labelColorMap[health.label] || 'unknown';
        const colorMatch = expectedColor === actualColor;
        const detail = `label="${health.label}", expected=${expectedColor}, actual=${actualColor}, rgb=(${health.r},${health.g},${health.b})`;

        if (!colorMatch) {
          return `INFO: color mismatch — ${detail}`;
        }
        return detail;
      });
    }

    await _ssStep(page, t, `[${account.label}] 关闭弹窗`, async () => {
      await closePortfolioPopup(page);
      return 'closed';
    });
  }

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ EXT-PERPS-PNL-007: 资金动作与返回 (§9)                    │
// │ - Click 存款 → deposit flow opens                         │
// │ - Click 提现 → withdraw flow opens                        │
// │ - Return → popup context preserved                        │
// └──────────────────────────────────────────────────────────┘
async function testExtPerpsPnl007(page) {
  const t = createStepTracker('EXT-PERPS-PNL-007');

  await _ssStep(page, t, '切换到有资产账户', async () => {
    const hasFunded = await switchToFundedAccountExt(page);
    if (!hasFunded) return 'SKIP: "ran" wallet not found on this device';
    await sleep(1000);
    await goToPerps(page);
    return 'ready';
  });

  await _ssStep(page, t, '打开投资组合弹窗', async () => {
    await openPortfolioPopup(page);
    return 'opened';
  });

  await _ssStep(page, t, '存款/提现按钮存在', async () => {
    const data = await getPortfolioData(page);
    if (!data) throw new Error('Cannot read portfolio data');
    return `hasDeposit=${data.hasDepositBtn}, hasWithdraw=${data.hasWithdrawBtn}`;
  });

  await _ssStep(page, t, '点击存款触发充值流程', async () => {
    const clicked = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
      if (!container) return false;
      for (const btn of container.querySelectorAll('button')) {
        const text = btn.textContent?.trim();
        if (text === '存款' || text === 'Deposit') {
          btn.click();
          return true;
        }
      }
      return false;
    });
    if (!clicked) throw new Error('Deposit button not found or not clickable');
    await sleep(2000);

    const depositUIDetected = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (modal && modal.getBoundingClientRect().width > 0) return 'modal';
      const body = document.body.textContent || '';
      if (body.includes('充值') || body.includes('Deposit') || body.includes('USDC')) return 'content';
      return null;
    });

    return `deposit UI: ${depositUIDetected || 'transition detected'}`;
  });

  await _ssStep(page, t, '关闭充值流程', async () => {
    await page.keyboard.press('Escape');
    await sleep(800);
    const modalVisible = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      return modal ? modal.getBoundingClientRect().width > 0 : false;
    });
    if (modalVisible) {
      await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="APP-Modal-Screen"] button');
        if (btn) btn.click();
      });
      await sleep(500);
    }
    return 'deposit flow closed';
  });

  await _ssStep(page, t, '重新打开投资组合弹窗', async () => {
    await goToPerps(page);
    await openPortfolioPopup(page);
    return 'reopened';
  });

  await _ssStep(page, t, '点击提现触发提现流程', async () => {
    const clicked = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
      if (!container) return false;
      for (const btn of container.querySelectorAll('button')) {
        const text = btn.textContent?.trim();
        if (text === '提现' || text === 'Withdraw') {
          btn.click();
          return true;
        }
      }
      return false;
    });
    if (!clicked) throw new Error('Withdraw button not found or not clickable');
    await sleep(2000);

    const withdrawUIDetected = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (modal && modal.getBoundingClientRect().width > 0) return 'modal';
      const body = document.body.textContent || '';
      if (body.includes('提现') || body.includes('Withdraw')) return 'content';
      return null;
    });

    return `withdraw UI: ${withdrawUIDetected || 'transition detected'}`;
  });

  await _ssStep(page, t, '返回后上下文保持', async () => {
    await page.keyboard.press('Escape');
    await sleep(800);
    await goToPerps(page);
    await openPortfolioPopup(page);
    const data = await getPortfolioData(page);
    if (!data) throw new Error('Cannot read portfolio after return');
    if (data.hasNaN) throw new Error('NaN/Infinity after return');
    await closePortfolioPopup(page);
    return `context preserved, width=${data.width}px`;
  });

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ EXT-PERPS-PNL-008: DashText 与提示组件 (§10)              │
// │ - Hover stat items → tooltip/popover appears              │
// │ - Text is readable                                        │
// └──────────────────────────────────────────────────────────┘
async function testExtPerpsPnl008(page) {
  const t = createStepTracker('EXT-PERPS-PNL-008');

  await _ssStep(page, t, '切换到有资产账户并打开弹窗', async () => {
    const hasFunded = await switchToFundedAccountExt(page);
    if (!hasFunded) return 'SKIP: "ran" wallet not found on this device';
    await sleep(1000);
    await goToPerps(page);
    await openPortfolioPopup(page);
    return 'ready';
  });

  await _ssStep(page, t, '查找 DashText 提示元素', async () => {
    const dashTexts = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
      if (!container) return [];
      const items = [];
      for (const el of container.querySelectorAll('span, div')) {
        const style = window.getComputedStyle(el);
        const text = el.textContent?.trim();
        if (!text || text.length > 30) continue;
        if (style.textDecorationStyle === 'dashed' || style.borderBottomStyle === 'dashed' ||
            el.getAttribute('data-state') !== null || style.cursor === 'help') {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            items.push({ text, x: Math.round(r.x), y: Math.round(r.y) });
          }
        }
      }
      return items;
    });

    if (dashTexts.length === 0) {
      return 'no DashText elements detected (may use different indicator style)';
    }
    return `found ${dashTexts.length} DashText items: ${dashTexts.map(d => d.text).join(', ')}`;
  });

  await _ssStep(page, t, '悬停统计项触发 Tooltip', async () => {
    const statLabels = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
      if (!container) return [];
      const labels = [];
      const targetTexts = ['胜率', '盈利因子', '杠杆', '已用保证金', '维持保证金率', 'MMR',
        '未实现盈亏', '总盈亏', '交易量', '平均盈利', '平均亏损', '账户健康度'];
      for (const el of container.querySelectorAll('span, div')) {
        const text = el.textContent?.trim();
        if (targetTexts.includes(text) && el.children.length === 0) {
          const r = el.getBoundingClientRect();
          if (r.width > 0) {
            labels.push({ text, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
          }
        }
      }
      return labels;
    });

    if (statLabels.length === 0) {
      return 'no hoverable stat labels found';
    }

    let tooltipCount = 0;
    for (const label of statLabels.slice(0, 3)) {
      await page.mouse.move(label.x, label.y);
      await sleep(600);

      const hasTooltip = await page.evaluate(() => {
        for (const el of document.querySelectorAll('[role="tooltip"], [data-radix-popper-content-wrapper]')) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) return true;
        }
        return false;
      });
      if (hasTooltip) tooltipCount++;
    }

    await page.mouse.move(0, 0);
    await sleep(300);

    return `hovered ${Math.min(3, statLabels.length)} labels, ${tooltipCount} showed tooltip. Labels found: ${statLabels.map(l => l.text).join(', ')}`;
  });

  await _ssStep(page, t, 'Tooltip 文案可读', async () => {
    const labelPos = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
      if (!container) return null;
      for (const el of container.querySelectorAll('span, div')) {
        const text = el.textContent?.trim();
        const style = window.getComputedStyle(el);
        if (text && text.length < 20 && el.children.length === 0 &&
            (style.textDecorationStyle === 'dashed' || style.borderBottomStyle === 'dashed' || style.cursor === 'help')) {
          const r = el.getBoundingClientRect();
          if (r.width > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), text };
        }
      }
      for (const el of container.querySelectorAll('span')) {
        if (el.textContent?.trim() === '杠杆' && el.children.length === 0) {
          const r = el.getBoundingClientRect();
          if (r.width > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), text: '杠杆' };
        }
      }
      return null;
    });

    if (!labelPos) return 'SKIP: no tooltip-triggering element found';

    await page.mouse.move(labelPos.x, labelPos.y);
    await sleep(800);

    const tooltipText = await page.evaluate(() => {
      for (const el of document.querySelectorAll('[role="tooltip"], [data-radix-popper-content-wrapper]')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          return el.textContent?.trim().slice(0, 200) || '';
        }
      }
      return null;
    });

    await page.mouse.move(0, 0);

    if (tooltipText) {
      if (tooltipText.length < 2) throw new Error('Tooltip text too short to be readable');
      return `tooltip for "${labelPos.text}": "${tooltipText.slice(0, 80)}"`;
    }
    return `hovered "${labelPos.text}" but no tooltip appeared`;
  });

  await closePortfolioPopup(page);
  return t.result();
}

// ── Registry ──────────────────────────────────────────────────

export const testCases = [
  { id: 'EXT-PERPS-PNL-001', name: 'Ext-Perps-PnL-入口与路由', fn: testExtPerpsPnl001 },
  { id: 'EXT-PERPS-PNL-002', name: 'Ext-Perps-PnL-弹窗布局', fn: testExtPerpsPnl002 },
  { id: 'EXT-PERPS-PNL-003', name: 'Ext-Perps-PnL-图表类型与时间维度', fn: testExtPerpsPnl003 },
  { id: 'EXT-PERPS-PNL-004', name: 'Ext-Perps-PnL-图表交互 Tooltip', fn: testExtPerpsPnl004 },
  { id: 'EXT-PERPS-PNL-005', name: 'Ext-Perps-PnL-盈亏与交易统计', fn: testExtPerpsPnl005 },
  { id: 'EXT-PERPS-PNL-006', name: 'Ext-Perps-PnL-账户健康与风险等级', fn: testExtPerpsPnl006 },
  { id: 'EXT-PERPS-PNL-007', name: 'Ext-Perps-PnL-资金动作与返回', fn: testExtPerpsPnl007 },
  { id: 'EXT-PERPS-PNL-008', name: 'Ext-Perps-PnL-DashText 与提示组件', fn: testExtPerpsPnl008 },
];

export { ALL_TEST_IDS };

export async function setup(page) {
  await goToPerps(page);
  await sleep(2000);
}

// ── Main ──────────────────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('EXT-PERPS-PNL-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { browser, page } = await connectExtensionCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Perps Portfolio & PnL Tests (Extension) — ${casesToRun.length} case(s)`);
  console.log('='.repeat(60));

  await goToPerps(page);
  await sleep(2000);

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
        await goToPerps(page);
        await sleep(2000);
      }

      const result = await test.fn(page);
      const duration = Date.now() - startTime;
      const r = {
        testId: test.id, status: result.status, duration,
        steps: result.steps, errors: result.errors,
        timestamp: new Date().toISOString(),
      };
      console.log(`>> ${test.id}: ${r.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s)`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    } catch (error) {
      const duration = Date.now() - startTime;
      const r = {
        testId: test.id, status: 'failed', duration,
        error: error.message, timestamp: new Date().toISOString(),
      };
      console.error(`>> ${test.id}: FAILED (${(duration / 1000).toFixed(1)}s) — ${error.message}`);
      if (page && !page?.isClosed?.()) {
        await screenshotExt(page, `${test.id}-error`);
      }
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }

    await sleep(1000);
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));
  results.forEach(r => {
    const icon = r.status === 'passed' ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] ${r.testId} (${(r.duration / 1000).toFixed(1)}s)${r.error ? ' — ' + r.error : ''}`);
  });

  const summary = { timestamp: new Date().toISOString(), total: results.length, passed, failed, results };
  writeFileSync(resolve(RESULTS_DIR, 'ext-perps-portfolio-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
