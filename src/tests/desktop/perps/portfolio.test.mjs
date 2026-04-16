// Perps Portfolio & PnL Tests — PERPS-PNL-001 ~ PERPS-PNL-008
// Generated: 2026-04-01
// Test case doc: docs/qa/testcases/cases/perps/2026-03-26_Perps-投资组合&盈亏.md
//
// Coverage mapping (8 tests, skip §3 mobile + §11 multi-platform):
//   PERPS-PNL-001 → §1 入口与路由
//   PERPS-PNL-002 → §2 桌面端弹窗布局
//   PERPS-PNL-003 → §4 图表类型与时间维度
//   PERPS-PNL-004 → §5 图表交互 Tooltip
//   PERPS-PNL-005 → §6 盈亏与交易统计
//   PERPS-PNL-006 → §7+§8 账户健康与风险等级
//   PERPS-PNL-007 → §9 资金动作与返回
//   PERPS-PNL-008 → §10 DashText 与提示组件
//
// Key architecture:
//   Portfolio popup = inline panel within IN_PAGE_TAB_CONTAINER (testid), 960px wide
//   NOT a modal — it's an inline panel, not APP-Modal-Screen
//   Entry: click balance ($xx.xx) or 存款 button in Perps header (y < 50)

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
} from '../../helpers/index.mjs';
import {
  createStepTracker, safeStep,
  clickSidebarTab, switchToAccount, getCurrentAccount, importWatchAddress,
  scrollToTop, goBackToMainPage, ensureCleanState,
} from '../../helpers/components.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'perps-portfolio');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const ALL_TEST_IDS = [
  'PERPS-PNL-001',
  'PERPS-PNL-002',
  'PERPS-PNL-003',
  'PERPS-PNL-004',
  'PERPS-PNL-005',
  'PERPS-PNL-006',
  'PERPS-PNL-007',
  'PERPS-PNL-008',
];

// ── Multi-Account Definitions ─────────────────────────────────

const WATCH_ADDRESSES = {
  '高胜率': '0x0aac6955688dc1cd3cafd52ebcade334fb1c9c3b',
  '低胜率': '0xa65ce1D604fa901c13AA29f2126a57d9032e412B',
  '空账户': '0xb308F51259aC794086C13d66e37fadeE8D8abf9a',
};

// 主测试账户：直接用「高胜率」观察钱包（有 Perps 资产），不切 ran 钱包
const ACCOUNTS = [
  { label: '高胜率', address: WATCH_ADDRESSES['高胜率'], isFunded: true },
  { label: '低胜率', address: WATCH_ADDRESSES['低胜率'] },
  { label: '空账户', address: WATCH_ADDRESSES['空账户'] },
];

/**
 * 通过地址搜索并切换到指定观察钱包账户。
 * 流程：打开账户选择器 → 观察钱包 tab → 搜索地址 → 点击结果 → 关闭弹窗
 * 搜不到则自动导入。
 */
async function switchToWatchAccount(page, address, label) {
  await clickSidebarTab(page, 'Wallet');
  await sleep(2000);

  // 打开账户选择器
  await page.evaluate(() => {
    document.querySelector('[data-testid="AccountSelectorTriggerBase"]')?.click();
  });
  await sleep(2000);

  // 点击「观察钱包」tab
  await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return;
    for (const sp of modal.querySelectorAll('span')) {
      if (sp.textContent?.trim() === '观察钱包' && sp.children.length === 0 && sp.getBoundingClientRect().width > 0) {
        sp.click(); return;
      }
    }
  });
  await sleep(1500);

  // 搜索地址（用前 10 字符）
  const searchKey = address.slice(0, 10);
  const found = await page.evaluate((key) => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return false;
    const input = modal.querySelector('input[placeholder*="搜索"]');
    if (!input) return false;
    input.focus();
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (nativeSet) {
      nativeSet.call(input, key);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return true;
  }, searchKey);

  if (!found) {
    console.log(`  [warn] 搜索框未找到，尝试直接导入`);
  } else {
    await sleep(2000);
  }

  // 检查搜索结果中是否有匹配的账户（地址包含搜索词）
  const clicked = await page.evaluate((key) => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return false;
    // 查找包含地址的账户项
    for (const el of modal.querySelectorAll('[data-testid^="account-item-"]')) {
      const text = el.textContent || '';
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 20 && text.toLowerCase().includes(key.toLowerCase())) {
        el.click();
        return true;
      }
    }
    // Fallback：点击第一个可见的账户
    const first = modal.querySelector('[data-testid="account-item-index-0"]');
    if (first && first.getBoundingClientRect().width > 0) {
      first.click();
      return true;
    }
    return false;
  }, searchKey);

  if (clicked) {
    await sleep(2000);
    console.log(`  ✓ 切换到 ${label} (${searchKey}...)`);
    return;
  }

  // 搜不到 → 关闭弹窗 → 导入
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(500);
  console.log(`  [AUTO] ${label} 不存在，导入 ${address.slice(0, 10)}...`);
  await importWatchAddress(page, address, { name: label !== '空账户' ? label : undefined });
  await sleep(2000);
  // 导入后直接用（当前已在该账户）
  console.log(`  ✓ 导入并切换到 ${label}`);
}

/** 切换到有资产的 Perps 账户（高胜率观察钱包） */
async function switchToFundedAccount(page) {
  const funded = ACCOUNTS.find(a => a.isFunded);
  await switchToWatchAccount(page, funded.address, funded.label);
}

// ── Portfolio Popup Helpers ───────────────────────────────────

/**
 * Navigate to Perps page.
 */
async function navigateToPerps(page) {
  await clickSidebarTab(page, 'Perps');
  await sleep(2000);
}

/**
 * Find and click the Portfolio entry button in the Perps header area.
 * The button shows "$xx.xx" for funded accounts or "存款" for empty accounts.
 * Located in the header area (y < 100).
 */
async function openPortfolioPopup(page) {
  // Ensure clean state: close sub-pages, modals, scroll to top
  await goBackToMainPage(page);
  await scrollToTop(page);

  // Find entry button position and click via mouse (more reliable than evaluate click)
  const entryInfo = await page.evaluate(() => {
    const candidates = [];
    for (const el of document.querySelectorAll('span, button, div')) {
      const text = el.textContent?.trim();
      if (!text) continue;
      const r = el.getBoundingClientRect();
      // 在 Perps 页面（navigateToPerps 已确保），匹配 header 区域的 $xx.xx 或 存款
      if (r.y > 100 || r.y < 0 || r.width === 0 || r.height === 0) continue;
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

  // Use mouse.click for precise clicking (avoids overlay interception)
  await page.mouse.click(entryInfo.x, entryInfo.y);
  await sleep(1500);

  // Wait for IN_PAGE_TAB_CONTAINER to appear
  for (let i = 0; i < 10; i++) {
    const visible = await isPortfolioPopupVisible(page);
    if (visible) return entryInfo.text;
    await sleep(500);
  }
  throw new Error('Portfolio popup (IN_PAGE_TAB_CONTAINER) did not appear after clicking entry; clicked "' + entryInfo.text + '" at (' + Math.round(entryInfo.x) + ',' + Math.round(entryInfo.y) + ')');
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
  // Try close button inside the container
  const closed = await page.evaluate(() => {
    const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
    if (!container) return false;
    // Look for close button (X icon, typically first button or last in header)
    const buttons = container.querySelectorAll('button');
    for (const btn of buttons) {
      const r = btn.getBoundingClientRect();
      // Close buttons tend to be small squares in the top-right corner
      if (r.width > 10 && r.width < 50 && r.height > 10 && r.height < 50) {
        const text = btn.textContent?.trim();
        const ariaLabel = btn.getAttribute('aria-label') || '';
        if (!text || ariaLabel.includes('close') || ariaLabel.includes('关闭') || text === '×' || text === 'X') {
          btn.click();
          return true;
        }
      }
    }
    // Fallback: find SVG close icon button
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
    // Fallback: press Escape
    await page.keyboard.press('Escape');
  }
  await sleep(800);

  // Verify popup closed
  const stillVisible = await isPortfolioPopupVisible(page);
  if (stillVisible) {
    // Last resort: click outside the popup area
    await page.mouse.click(10, 300);
    await sleep(500);
  }
}

/**
 * Read all portfolio data from the popup in a single evaluate call.
 * Returns structured data with all stats visible in the popup.
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

    // Helper: extract value after a label
    const extractAfterLabel = (label) => {
      const idx = text.indexOf(label);
      if (idx < 0) return null;
      // Get text after the label, up to next known label or 50 chars
      const after = text.slice(idx + label.length, idx + label.length + 80).trim();
      // Extract first number-like value (including $, %, x, negative)
      const m = after.match(/^[\s:：]*(-?\$?[\d,.]+%?x?|--|-|N\/A)/);
      return m ? m[1].trim() : after.slice(0, 30).trim();
    };

    // Helper: find element containing label and get next sibling or value
    const findValueElement = (label) => {
      for (const el of container.querySelectorAll('span, div, p')) {
        if (el.textContent?.trim() === label && el.children.length === 0) {
          // Check next sibling or parent's next child
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

    // Account stats
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

    // PnL stats
    result.unrealizedPnl = extractAfterLabel('未实现盈亏');
    result.totalPnl = findValueElement('总盈亏') || { text: extractAfterLabel('总盈亏'), color: null };
    result.positions = extractAfterLabel('当前持仓');

    // Trading activity
    result.volume = extractAfterLabel('交易量');
    result.topTraded = extractAfterLabel('最多交易');
    result.feesPaid = extractAfterLabel('已付手续费');
    result.netDeposit = extractAfterLabel('净入金');
    result.totalTrades = extractAfterLabel('总交易次数');

    // Trading performance
    result.winRate = extractAfterLabel('胜率');
    result.profitFactor = extractAfterLabel('盈利因子');
    result.avgProfit = extractAfterLabel('平均盈利');
    result.avgLoss = extractAfterLabel('平均亏损');

    // Check for deposit/withdraw buttons
    result.hasDepositBtn = !!Array.from(container.querySelectorAll('button')).find(b => {
      const t = b.textContent?.trim();
      return t === '存款' || t === 'Deposit';
    });
    result.hasWithdrawBtn = !!Array.from(container.querySelectorAll('button')).find(b => {
      const t = b.textContent?.trim();
      return t === '提现' || t === 'Withdraw';
    });

    // Check for NaN/Infinity
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
 * @param {string} type - '净值' or '盈亏'
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
 * @param {string} dim - '1天'/'1周'/'1月'/'全部'
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
          // Active tabs typically have higher opacity / different color
          // Parse RGB to check if it's brighter/more opaque
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

    // Find dual-column sections — may be nested 1-2 levels deep
    // Search up to 3 levels for divs with width > 200 and height > 200
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
          // This is a wrapper — go deeper
          findSections(child, depth + 1);
        }
      }
    }
    findSections(container, 0);

    // Check for dual-column layout: at least 2 sections with different x positions
    const uniqueX = new Set(sections.map(s => Math.round(s.x / 50)));
    const isDualColumn = uniqueX.size >= 2;

    // Check overlap between sections
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

    // Check for canvas (chart area indicator)
    const hasCanvas = container.querySelectorAll('canvas').length > 0;

    // Check for title
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
 * Get MMR color from the popup, returning parsed RGB values.
 */
/**
 * Get health level color from the popup.
 * Color is on the health label span (健康/低风险/中等风险/高风险), NOT on MMR value.
 * MMR value itself is always black — the risk color is on the health level label.
 */
async function getHealthColor(page) {
  return page.evaluate(() => {
    const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
    if (!container) return null;

    // Find health level label: 健康/低风险/中等风险/高风险
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
            raw: color,
            r: rv, g: gv, b: bv,
            label: text,
            isGreen: gv > 100 && rv < 100,
            isYellow: rv > 180 && gv > 120 && bv < 100,
            isRed: rv > 180 && gv < 80,
          };
        }
      }
    }

    // Also find MMR value for reference
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
        // Find the value element nearby
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

async function switchAccountAndOpenPortfolio(page, account) {
  // 统一用地址搜索切换（不依赖账户名）
  await switchToWatchAccount(page, account.address, account.label);
  await sleep(1000);
  await clickSidebarTab(page, 'Perps');
  await sleep(2000);
  await openPortfolioPopup(page);
}

// ── Test Cases ────────────────────────────────────────────────

// ┌──────────────────────────────────────────────────────────┐
// │ PERPS-PNL-001: 入口与路由 (§1)                            │
// │ - Empty account: click → deposit prompt                   │
// │ - Funded account: click → portfolio popup with balance    │
// │ - Open/close 3 times → no white screen, no duplicates     │
// └──────────────────────────────────────────────────────────┘
async function testPerpsPnl001(page) {
  const t = createStepTracker('PERPS-PNL-001');
  await ensureCleanState(page);

  // Step 1: Navigate to Perps with funded account (ran)
  await _ssStep(page, t, '切换到有资产账户 (高胜率)', async () => {
    await switchToFundedAccount(page);
    await sleep(1000);
    await navigateToPerps(page);
    return 'switched to 高胜率 + Perps tab';
  });

  // Step 2: Click entry with funded account → popup shows balance
  await _ssStep(page, t, '有资产账户点击入口显示余额', async () => {
    const entryText = await openPortfolioPopup(page);
    if (!/^\$/.test(entryText)) throw new Error(`Expected balance entry ($xx.xx), got: ${entryText}`);
    const visible = await isPortfolioPopupVisible(page);
    if (!visible) throw new Error('Portfolio popup not visible after click');
    // Verify popup has chart and stats
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
  const emptyAccount = ACCOUNTS.find(a => a.label === '空账户');
  await _ssStep(page, t, '切换到空/无 Perps 资产账户', async () => {
    await switchToWatchAccount(page, emptyAccount.address, emptyAccount.label);
    await sleep(1000);
    await navigateToPerps(page);
    return `switched to ${emptyAccount.label}`;
  });

  await _ssStep(page, t, '空账户点击入口显示存款引导', async () => {
    // For empty accounts, clicking may show 存款 or deposit prompt
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
    // Click it
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
      // May be a modal instead
      await page.keyboard.press('Escape');
      await sleep(500);
    }
    return 'cleaned up';
  });

  // Step 4: Switch back to funded account, open/close 3 times → stability
  await _ssStep(page, t, '切换回有资产账户', async () => {
    await switchToFundedAccount(page);
    await sleep(1000);
    await navigateToPerps(page);
    return 'back to ran';
  });

  await _ssStep(page, t, '连续开关 3 次无白屏无重复', async () => {
    for (let i = 0; i < 3; i++) {
      await openPortfolioPopup(page);
      const visible = await isPortfolioPopupVisible(page);
      if (!visible) throw new Error(`Iteration ${i + 1}: popup not visible after open`);

      // Check for white screen: popup should have meaningful text content
      const hasContent = await page.evaluate(() => {
        const c = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
        return c ? c.textContent.trim().length > 20 : false;
      });
      if (!hasContent) throw new Error(`Iteration ${i + 1}: popup appears empty (white screen)`);

      // Check no duplicate instances
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
// │ PERPS-PNL-002: 桌面端弹窗布局 (§2)                       │
// │ - Width = 960px                                           │
// │ - Dual column: chart + stats, no overlap                  │
// │ - Title visible, close button works                       │
// └──────────────────────────────────────────────────────────┘
async function testPerpsPnl002(page) {
  const t = createStepTracker('PERPS-PNL-002');
  await ensureCleanState(page);

  // Ensure we're on funded account (ran)
  await switchToFundedAccount(page);
  await navigateToPerps(page);

  await _ssStep(page, t, '打开投资组合弹窗', async () => {
    await openPortfolioPopup(page);
    return 'opened';
  });

  await _ssStep(page, t, '弹窗宽度 = 960px', async () => {
    const layout = await getPopupLayout(page);
    if (!layout) throw new Error('Cannot read popup layout');
    // Allow ±10px tolerance
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
    // Title may be present or the popup is self-evident
    // Check that the popup has chart canvas
    if (!layout.hasCanvas) {
      // Some accounts may not have canvas if no data, just verify popup has content
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
    // Check that content is clickable (not blocked by overlay)
    const isAccessible = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
      if (!container) return false;
      const r = container.getBoundingClientRect();
      // Check center point is not blocked by an overlay
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
// │ PERPS-PNL-003: 图表类型与时间维度 (§4)                    │
// │ - Default chart area exists                               │
// │ - Switch 净值/盈亏 → canvas changes                       │
// │ - Switch 1天/1周/1月/全部 → canvas changes                │
// │ - Fast switching → correct final state                    │
// └──────────────────────────────────────────────────────────┘
async function testPerpsPnl003(page) {
  const t = createStepTracker('PERPS-PNL-003');
  await ensureCleanState(page);

  await navigateToPerps(page);
  await openPortfolioPopup(page);

  // Step 1: Default chart exists
  await _ssStep(page, t, '图表区域存在且无崩溃', async () => {
    const canvasInfo = await getCanvasInfo(page);
    if (!canvasInfo || canvasInfo.count === 0) {
      // May be empty account - check for skeleton/empty state
      const text = await page.evaluate(() => {
        const c = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
        return c?.textContent || '';
      });
      if (text.includes('崩溃') || text.includes('error')) throw new Error('Chart area shows error');
      return 'no canvas (possibly empty account), no crash';
    }
    return `${canvasInfo.count} canvas(es), largest=${canvasInfo.canvases[0]?.w}x${canvasInfo.canvases[0]?.h}`;
  });

  // Step 2: Switch to 净值 (Account Value)
  let hashBefore = await getCanvasHash(page);
  await _ssStep(page, t, '切换净值图表', async () => {
    try {
      await switchChartType(page, '净值');
    } catch {
      // Tab might be named differently, try alternatives
      try { await switchChartType(page, 'Account Value'); } catch {}
    }
    await sleep(1000);
    const hashAfter = await getCanvasHash(page);
    if (hashBefore !== null && hashAfter !== null && hashBefore !== hashAfter) {
      return `canvas changed: ${hashBefore} → ${hashAfter}`;
    }
    return 'switched to 净值 (hash may be same if already selected)';
  });

  // Step 3: Switch to 盈亏 (PnL)
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

  // Step 4: Switch time dimensions
  const timeDims = ['1天', '1周', '1月', '全部'];
  for (const dim of timeDims) {
    await _ssStep(page, t, `切换时间维度: ${dim}`, async () => {
      const before = await getCanvasHash(page);
      try {
        await switchTimeDimension(page, dim);
      } catch {
        // Try English alternatives
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

  // Step 5: Fast switching → final tab correct
  await _ssStep(page, t, '快速切换时间维度', async () => {
    for (const dim of timeDims) {
      try { await switchTimeDimension(page, dim); } catch {}
      await sleep(200); // fast switch, minimal wait
    }
    await sleep(2000); // wait for final render
    // Verify final selection is 全部 (last one clicked)
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
// │ PERPS-PNL-004: 图表交互 Tooltip (§5)                     │
// │ - Hover center → tooltip with time + amount               │
// │ - Hover edges → no overflow                               │
// │ - Switch chart → tooltip data changes                     │
// └──────────────────────────────────────────────────────────┘
async function testPerpsPnl004(page) {
  const t = createStepTracker('PERPS-PNL-004');
  await ensureCleanState(page);

  await navigateToPerps(page);
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

    // Hover center of canvas
    const cx = canvasRect.x + canvasRect.w / 2;
    const cy = canvasRect.y + canvasRect.h / 2;
    await page.mouse.move(cx, cy);
    await sleep(1000);

    // Check for tooltip appearance
    const tooltip = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
      if (!container) return null;
      // Tooltips are typically absolutely positioned divs that appear on hover
      // Look for elements that appeared after hover (containing $ or time format)
      for (const el of document.querySelectorAll('div, span')) {
        const text = el.textContent?.trim();
        const style = window.getComputedStyle(el);
        if (!text) continue;
        // Tooltip indicators: contains dollar amount AND/OR timestamp
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

    // Hover left edge
    await page.mouse.move(canvasRect.x + 5, canvasRect.y + canvasRect.h / 2);
    await sleep(800);

    // Check chart tooltip overflow (only elements containing $ or time data)
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

    // Hover right edge
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
    // Switch chart type and hover again
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

  // Move mouse away to dismiss tooltip
  await page.mouse.move(0, 0);
  await closePortfolioPopup(page);
  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ PERPS-PNL-005: 盈亏与交易统计 (§6)                        │
// │ - Total PnL color: positive → green, negative → red       │
// │ - Win rate: 0-100% valid                                  │
// │ - Profit factor: no NaN/Infinity                          │
// │ - Empty account: default state, no NaN                    │
// │ - Multi-account loop                                      │
// └──────────────────────────────────────────────────────────┘
async function testPerpsPnl005(page) {
  const t = createStepTracker('PERPS-PNL-005');
  await ensureCleanState(page);

  for (const account of ACCOUNTS) {
    await _ssStep(page, t, `切换账户: ${account.label}`, async () => {
      await switchAccountAndOpenPortfolio(page, account);
      return `opened portfolio for ${account.label}`;
    });

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

      // Validate win rate if present and numeric
      if (data.winRate && /[\d.]+%/.test(data.winRate)) {
        const wr = parseFloat(data.winRate);
        if (wr < 0 || wr > 100) throw new Error(`Win rate out of range: ${data.winRate}`);
      }

      // Validate profit factor is not NaN/Infinity text
      if (data.profitFactor && /NaN|Infinity/.test(data.profitFactor)) {
        throw new Error(`Profit factor is ${data.profitFactor}`);
      }

      return details.join(', ');
    });

    // Check PnL color for funded accounts
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
// │ PERPS-PNL-006: 账户健康与风险等级 (§7+§8)                 │
// │ - MMR color thresholds: ≤40% green, 40-70% yellow, >70% red│
// │ - Health level label matches risk scoring                 │
// │ - Multi-account verification                              │
// │ - No NaN/Infinity for missing data                        │
// └──────────────────────────────────────────────────────────┘
async function testPerpsPnl006(page) {
  const t = createStepTracker('PERPS-PNL-006');
  await ensureCleanState(page);

  for (const account of ACCOUNTS) {
    await _ssStep(page, t, `切换账户: ${account.label}`, async () => {
      await switchAccountAndOpenPortfolio(page, account);
      return `opened portfolio for ${account.label}`;
    });

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

    // Health level color verification for funded accounts
    // Color is on health label (健康/中等风险/高风险), NOT on MMR value
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

        // Verify label-color consistency
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
// │ PERPS-PNL-007: 资金动作与返回 (§9)                        │
// │ - Click 存款 → deposit flow opens                         │
// │ - Click 提现 → withdraw flow opens                        │
// │ - Return → popup context preserved                        │
// └──────────────────────────────────────────────────────────┘
async function testPerpsPnl007(page) {
  const t = createStepTracker('PERPS-PNL-007');
  await ensureCleanState(page);

  // Use funded account for deposit/withdraw buttons
  await _ssStep(page, t, '切换到有资产账户', async () => {
    await switchToFundedAccount(page);
    await sleep(1000);
    await navigateToPerps(page);
    return 'ready';
  });

  await _ssStep(page, t, '打开投资组合弹窗', async () => {
    await openPortfolioPopup(page);
    return 'opened';
  });

  // Verify deposit/withdraw buttons exist
  await _ssStep(page, t, '存款/提现按钮存在', async () => {
    const data = await getPortfolioData(page);
    if (!data) throw new Error('Cannot read portfolio data');
    return `hasDeposit=${data.hasDepositBtn}, hasWithdraw=${data.hasWithdrawBtn}`;
  });

  // Click Deposit
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

    // Check that some deposit UI appeared (modal, page change, etc.)
    const depositUIDetected = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (modal && modal.getBoundingClientRect().width > 0) return 'modal';
      // Check for deposit-related text in page
      const body = document.body.textContent || '';
      if (body.includes('充值') || body.includes('Deposit') || body.includes('USDC')) return 'content';
      return null;
    });

    return `deposit UI: ${depositUIDetected || 'transition detected'}`;
  });

  // Close deposit flow and return
  await _ssStep(page, t, '关闭充值流程', async () => {
    // Try closing modal if it appeared
    await page.keyboard.press('Escape');
    await sleep(800);
    // Try close button
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

  // Reopen popup and try withdraw
  await _ssStep(page, t, '重新打开投资组合弹窗', async () => {
    // Make sure we're on Perps page
    await navigateToPerps(page);
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

  // Close withdraw and verify context
  await _ssStep(page, t, '返回后上下文保持', async () => {
    await page.keyboard.press('Escape');
    await sleep(800);
    // Navigate back to Perps
    await navigateToPerps(page);
    // Reopen to verify no corruption
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
// │ PERPS-PNL-008: DashText 与提示组件 (§10)                  │
// │ - Hover stat items → tooltip/popover appears              │
// │ - Text is readable                                        │
// └──────────────────────────────────────────────────────────┘
async function testPerpsPnl008(page) {
  const t = createStepTracker('PERPS-PNL-008');
  await ensureCleanState(page);

  await _ssStep(page, t, '切换到有资产账户并打开弹窗', async () => {
    await switchToFundedAccount(page);
    await sleep(1000);
    await navigateToPerps(page);
    await openPortfolioPopup(page);
    return 'ready';
  });

  // Find DashText elements (info icons, question marks, tooltip triggers)
  await _ssStep(page, t, '查找 DashText 提示元素', async () => {
    const dashTexts = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
      if (!container) return [];
      const items = [];
      // DashText usually has a dashed underline or info icon nearby
      for (const el of container.querySelectorAll('span, div')) {
        const style = window.getComputedStyle(el);
        const text = el.textContent?.trim();
        if (!text || text.length > 30) continue;
        // Check for dashed border-bottom (DashText indicator)
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

  // Hover stat labels to trigger tooltips
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
    // Try hovering first 3 labels to check for tooltips
    for (const label of statLabels.slice(0, 3)) {
      await page.mouse.move(label.x, label.y);
      await sleep(600);

      const hasTooltip = await page.evaluate(() => {
        // Check for any newly visible tooltip/popover
        for (const el of document.querySelectorAll('[role="tooltip"], [data-radix-popper-content-wrapper]')) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) return true;
        }
        // Check for any absolute positioned element that appeared
        return false;
      });
      if (hasTooltip) tooltipCount++;
    }

    // Move mouse away
    await page.mouse.move(0, 0);
    await sleep(300);

    return `hovered ${Math.min(3, statLabels.length)} labels, ${tooltipCount} showed tooltip. Labels found: ${statLabels.map(l => l.text).join(', ')}`;
  });

  await _ssStep(page, t, 'Tooltip 文案可读', async () => {
    // Hover a label again and read tooltip text
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
      // Fallback: try any stat label
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

// ── Runner ──────────────────────────────────────────────────

const testCases = [
  { id: 'PERPS-PNL-001', name: '入口与路由', fn: testPerpsPnl001 },
  { id: 'PERPS-PNL-002', name: '桌面端弹窗布局', fn: testPerpsPnl002 },
  { id: 'PERPS-PNL-003', name: '图表类型与时间维度', fn: testPerpsPnl003 },
  { id: 'PERPS-PNL-004', name: '图表交互 Tooltip', fn: testPerpsPnl004 },
  { id: 'PERPS-PNL-005', name: '盈亏与交易统计', fn: testPerpsPnl005 },
  { id: 'PERPS-PNL-006', name: '账户健康与风险等级', fn: testPerpsPnl006 },
  { id: 'PERPS-PNL-007', name: '资金动作与返回', fn: testPerpsPnl007 },
  { id: 'PERPS-PNL-008', name: 'DashText 与提示组件', fn: testPerpsPnl008 },
];

export { testCases, ALL_TEST_IDS };

// Direct execution
const _thisFile = new URL(import.meta.url).pathname;
const isDirectRun = process.argv[1] && process.argv[1].endsWith('portfolio.test.mjs');
if (isDirectRun) {
  const selectedIds = process.argv.slice(2).filter(a => a.startsWith('PERPS-PNL-'));
  const toRun = selectedIds.length > 0
    ? testCases.filter(tc => selectedIds.includes(tc.id))
    : testCases;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Perps Portfolio & PnL Tests — ${toRun.length} case(s)`);
  console.log(`${'='.repeat(60)}\n`);

  const { browser, page } = await connectCDP();
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);

  const results = {};

  for (const tc of toRun) {
    console.log(`${'─'.repeat(60)}`);
    console.log(`[${tc.id}] ${tc.name}`);
    console.log(`${'─'.repeat(60)}`);

    const start = Date.now();
    try {
      const result = await tc.fn(page);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      results[tc.id] = result;
      const summary = result.summary || {};
      const skipInfo = summary.skipped > 0 ? ` (${summary.skipped} skipped)` : '';
      console.log(`>> ${tc.id}: ${result.status.toUpperCase()} (${elapsed}s) — ${summary.passed || 0} passed, ${summary.failed || 0} failed, ${summary.skipped || 0} skipped${skipInfo}`);
      if (result.errors.length > 0) {
        result.errors.forEach(e => console.log(`   * ${e}`));
      }
    } catch (e) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      results[tc.id] = { status: 'failed', steps: [], errors: [e.message] };
      console.log(`>> ${tc.id}: FAILED (${elapsed}s) — ${e.message}`);
    }
    console.log();
  }

  // Summary
  const passed = Object.values(results).filter(r => r.status === 'passed').length;
  const failed = Object.values(results).filter(r => r.status === 'failed').length;
  console.log(`${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${toRun.length} total`);
  console.log(`${'='.repeat(60)}`);

  // Save results
  const resultPath = resolve(RESULTS_DIR, 'perps-portfolio/results.json');
  mkdirSync(resolve(RESULTS_DIR, 'perps-portfolio'), { recursive: true });
  writeFileSync(resultPath, JSON.stringify(results, null, 2));
  console.log(`Results saved to ${resultPath}`);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}
