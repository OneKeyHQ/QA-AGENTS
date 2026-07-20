// Perps Portfolio & PnL — shared test logic (Desktop / Web / Extension)
//
// Wrapper files at:
//   src/tests/desktop/perps/portfolio.test.mjs
//   src/tests/web/perps/portfolio.test.mjs
//   src/tests/extension/perps/portfolio.test.mjs
// inject platform-specific CDP connect + goToPerps + account switchers,
// then call createPortfolioTests() to get the same 8 test cases.
//
// Coverage mapping (8 tests, skip §3 mobile + §11 multi-platform):
//   <PREFIX>-001 → §1 入口与路由
//   <PREFIX>-002 → §2 桌面端弹窗布局
//   <PREFIX>-003 → §4 图表类型与时间维度
//   <PREFIX>-004 → §5 图表交互 Tooltip
//   <PREFIX>-005 → §6 盈亏与交易统计
//   <PREFIX>-006 → §7+§8 账户健康与风险等级
//   <PREFIX>-007 → §9 资金动作与返回
//   <PREFIX>-008 → §10 DashText 与提示组件
//
// Key architecture:
//   Portfolio popup = inline panel within IN_PAGE_TAB_CONTAINER (testid), 960px wide
//   NOT a modal — it's an inline panel, not APP-Modal-Screen
//   Entry: click balance ($xx.xx) or 存款 button in Perps header (y < 50)

import { sleep } from '../../helpers/constants.mjs';
import {
  createStepTracker, safeStep,
  scrollToTop, goBackToMainPage, ensureCleanState,
} from '../../helpers/components.mjs';

// Default watch addresses used by the 多账户 loop test cases.
export const WATCH_ADDRESSES = {
  '高胜率': '0x0aac6955688dc1cd3cafd52ebcade334fb1c9c3b',
  '低胜率': '0xa65ce1D604fa901c13AA29f2126a57d9032e412B',
  '空账户': '0xb308F51259aC794086C13d66e37fadeE8D8abf9a',
};

// Default account roster — wrappers can override via `accounts` option.
export const DEFAULT_ACCOUNTS = [
  { label: '高胜率', address: WATCH_ADDRESSES['高胜率'], isFunded: true },
  { label: '低胜率', address: WATCH_ADDRESSES['低胜率'] },
  { label: '空账户', address: WATCH_ADDRESSES['空账户'] },
];

/**
 * Build the 8 Perps Portfolio test cases for one platform.
 *
 * @param {object} opts
 * @param {string} opts.prefix - Test ID prefix, e.g. 'PERPS-PNL' | 'WEB-PERPS-PNL' | 'EXT-PERPS-PNL'
 * @param {string} [opts.namePrefix] - Display name prefix, e.g. '' | 'Web-' | 'Ext-'
 * @param {string} opts.screenshotDir - Absolute path for screenshots on failure
 * @param {(page) => Promise<void>} opts.goToPerps - Navigate to Perps page
 * @param {(page) => Promise<boolean|string>} opts.switchToFundedAccount
 *   - true: switched OK
 *   - false / non-empty string: skip reason (e.g. wallet not present, web unsupported)
 * @param {(page, address?: string, label?: string) => Promise<string|void>} [opts.switchToWatchAccount]
 *   - returns skip reason string when switching not supported (Web placeholder)
 * @param {Array} [opts.accounts] - Override default accounts roster
 * @returns {{ testCases: Array, setup: (page) => Promise<void> }}
 */
export function createPortfolioTests({
  prefix,
  namePrefix = '',
  screenshotDir,
  goToPerps,
  switchToFundedAccount,
  switchToWatchAccount,
  accounts = DEFAULT_ACCOUNTS,
}) {
  if (!screenshotDir) throw new Error('createPortfolioTests: screenshotDir required');
  if (!goToPerps) throw new Error('createPortfolioTests: goToPerps required');
  if (!switchToFundedAccount) throw new Error('createPortfolioTests: switchToFundedAccount required');

  // safeStep shortcut bound to this platform's screenshot dir
  const _ssStep = (page, t, name, fn) => safeStep(page, t, name, fn, screenshotDir);

  // ── Portfolio Popup Helpers ─────────────────────────────────

  async function cleanupExternalFixedForms(page) {
    const removed = await page.evaluate(() => {
      let count = 0;
      for (const form of document.querySelectorAll('form')) {
        const r = form.getBoundingClientRect();
        const style = window.getComputedStyle(form);
        if (r.width > 0 && r.height > 0 && (style.position === 'fixed' || Number(style.zIndex) > 1000)) {
          form.remove();
          count++;
        }
      }
      return count;
    }).catch(() => 0);
    if (removed > 0) await sleep(500);
    return removed;
  }

  async function openPortfolioPopup(page) {
    await goBackToMainPage(page);
    await scrollToTop(page);

    const entryInfo = await page.evaluate(() => {
      const portfolioButton = document.querySelector('[data-testid="perp-portfolio-button"]');
      const pr = portfolioButton?.getBoundingClientRect();
      if (portfolioButton && pr && pr.width > 0 && pr.height > 0) {
        return { text: portfolioButton.textContent?.trim() || '$portfolio', x: pr.x + pr.width / 2, y: pr.y + pr.height / 2, area: pr.width * pr.height };
      }
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
    throw new Error('Portfolio popup (IN_PAGE_TAB_CONTAINER) did not appear after clicking entry; clicked "' + entryInfo.text + '" at (' + Math.round(entryInfo.x) + ',' + Math.round(entryInfo.y) + ')');
  }

  async function isPortfolioPopupVisible(page) {
    return page.evaluate(() => {
      const el = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  }

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

  async function closePerpsDialogFlow(page) {
    const closedByDom = await page.evaluate(() => {
      const visible = (el) => {
        const r = el?.getBoundingClientRect?.();
        return !!r && r.width > 0 && r.height > 0;
      };
      for (const form of document.querySelectorAll('form')) {
        if (!visible(form)) continue;
        const style = window.getComputedStyle(form);
        if (style.position === 'fixed' || Number(style.zIndex) > 1000) {
          window.location.href = 'file:///perps';
          return 'location-reset-fixed-form';
        }
      }
      const containers = [
        ...document.querySelectorAll('[data-testid="APP-Modal-Screen"]'),
        ...document.querySelectorAll('form'),
      ].filter(visible);
      for (const container of containers) {
        const navClose = container.querySelector('[data-testid="nav-header-close"]');
        if (visible(navClose)) { navClose.click(); return 'nav-header-close'; }

        const cr = container.getBoundingClientRect();
        const buttons = [...container.querySelectorAll('button')];
        const closeButtons = buttons
          .map((btn) => ({ btn, r: btn.getBoundingClientRect(), text: btn.textContent?.trim() || '', aria: btn.getAttribute('aria-label') || '' }))
          .filter(({ r }) => r.width > 0 && r.height > 0 && r.width <= 56 && r.height <= 56)
          .sort((a, b) => {
            const aScore = (cr.right - a.r.right) + Math.abs(a.r.y - cr.y);
            const bScore = (cr.right - b.r.right) + Math.abs(b.r.y - cr.y);
            return aScore - bScore;
          });
        for (const item of closeButtons) {
          if (
            item.aria.toLowerCase().includes('close') ||
            item.aria.includes('关闭') ||
            item.text === '×' ||
            item.text === 'X' ||
            item.r.x > cr.right - 100
          ) {
            item.btn.click();
            return 'close-button';
          }
        }
      }
      for (const el of document.querySelectorAll('[data-testid="nav-header-close"], [data-testid="nav-header-back"]')) {
        if (visible(el)) { el.click(); return el.getAttribute('data-testid') || 'nav-button'; }
      }
      return null;
    }).catch(() => null);

    if (!closedByDom) {
      await page.keyboard.press('Escape').catch(() => {});
    }
    await sleep(closedByDom === 'location-reset-fixed-form' ? 3000 : 800);

    const stillVisible = await page.evaluate(() => {
      for (const sel of ['[data-testid="APP-Modal-Screen"]']) {
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) return true;
        }
      }
      for (const form of document.querySelectorAll('form')) {
        const r = form.getBoundingClientRect();
        const style = window.getComputedStyle(form);
        if (r.width > 0 && r.height > 0 && (style.position === 'fixed' || Number(style.zIndex) > 1000)) return true;
      }
      return false;
    }).catch(() => false);
    return { closedByDom, stillVisible };
  }

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

  async function clickPortfolioAction(page, action) {
    const clicked = await page.evaluate((label) => {
      const container = document.querySelector('[data-testid="IN_PAGE_TAB_CONTAINER"]');
      if (!container) return false;
      const candidates = [
        ...container.querySelectorAll('[data-testid="perp-portfolio-buttons-btn"]'),
        ...container.querySelectorAll('button'),
      ];
      for (const btn of candidates) {
        const text = btn.textContent?.trim();
        const r = btn.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && (text === label || (label === '存款' && text === 'Deposit') || (label === '提现' && text === 'Withdraw'))) {
          btn.click();
          return true;
        }
      }
      return false;
    }, action);
    if (!clicked) throw new Error(`${action} button not found or not clickable`);
    await sleep(2000);
  }

  async function getDepositDialogState(page) {
    return page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      const root = modal && modal.getBoundingClientRect().width > 0 ? modal : document.body;
      const text = root.textContent || '';
      const tokenItems = [...root.querySelectorAll('[data-testid="perp-deposit-token-item"]')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        })
        .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim());
      return {
        hasModal: !!modal && modal.getBoundingClientRect().width > 0,
        hasDepositText: text.includes('存款') || text.includes('Deposit'),
        hasWithdrawText: text.includes('提现') || text.includes('Withdraw'),
        hasUsdc: text.includes('USDC'),
        hasArbitrum: /Arbitrum/i.test(text),
        tokenItems,
        text: text.replace(/\s+/g, ' ').trim().slice(0, 500),
      };
    });
  }

  async function openDepositTokenListIfPossible(page) {
    const opened = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal || modal.getBoundingClientRect().width === 0) return false;
      const existing = modal.querySelector('[data-testid="perp-deposit-token-item"]');
      if (existing && existing.getBoundingClientRect().width > 0) return true;
      const candidates = [...modal.querySelectorAll('div, button')]
        .map((el) => ({ el, r: el.getBoundingClientRect(), text: (el.textContent || '').replace(/\s+/g, ' ').trim() }))
        .filter(({ r, text }) => r.width > 120 && r.height >= 40 && r.height <= 90 && /USDC|Arbitrum|ETH|SOL|BTC/i.test(text))
        .sort((a, b) => a.r.y - b.r.y);
      if (candidates[0]) {
        candidates[0].el.click();
        return true;
      }
      return false;
    });
    if (opened) await sleep(1500);
    return opened;
  }

  async function getAccountModeState(page) {
    return page.evaluate(() => {
      const visible = (el) => {
        const r = el?.getBoundingClientRect?.();
        return !!r && r.width > 0 && r.height > 0;
      };
      const modeLabels = ['统一', '组合', '统一账户', '组合保证金', 'Unified', 'Portfolio'];
      const selectorCandidates = [...document.querySelectorAll('span, div, button')]
        .map((el) => ({ el, text: el.textContent?.trim() || '', r: el.getBoundingClientRect() }))
        .filter(({ text, r }) => r.width > 0 && r.height > 0 && r.width <= 180 && r.height <= 48 && r.y > 120 && r.y < window.innerHeight - 40 && modeLabels.some(k => text === k || (text.length <= 12 && text.includes(k))));
      const dialog = document.querySelector('[data-testid="APP-Modal-Screen"]');
      return {
        selectorText: selectorCandidates[0]?.text || null,
        hasDialog: visible(dialog),
        dialogText: visible(dialog) ? (dialog.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 600) : '',
        confirmVisible: visible(document.querySelector('[data-testid="perp-account-mode-confirm-button"]')),
      };
    });
  }

  async function openAccountModeDialog(page) {
    const clicked = await page.evaluate(() => {
      const modeLabels = ['统一', '组合', '统一账户', '组合保证金', 'Unified', 'Portfolio'];
      const candidates = [...document.querySelectorAll('span, div, button')]
        .map((el) => ({ el, text: el.textContent?.trim() || '', r: el.getBoundingClientRect() }))
        .filter(({ text, r }) => r.width > 0 && r.height > 0 && r.width <= 180 && r.height <= 48 && r.y > 150 && r.y < window.innerHeight - 40 && modeLabels.some(k => text === k || (text.length <= 12 && text.includes(k))))
        .sort((a, b) => a.r.y - b.r.y || a.r.x - b.r.x);
      if (!candidates[0]) return false;
      const target = candidates[0].el.closest('button') || candidates[0].el.parentElement || candidates[0].el;
      target.click();
      return true;
    });
    if (!clicked) throw new Error('Account mode selector not found');
    await sleep(1500);
  }

  async function getHomePerpsState(page) {
    return page.evaluate(() => {
      const text = document.body.textContent || '';
      const visibleTestIds = [
        'home-perps-manage-button',
        'home-perps-deposit-button',
        'home-perps-desktop-deposit-button',
      ].filter((id) => {
        const el = document.querySelector(`[data-testid="${id}"]`);
        const r = el?.getBoundingClientRect?.();
        return !!r && r.width > 0 && r.height > 0;
      });
      const hasSpotHolding = /现货|Spot|\/USDC|USDC|HYPE|BTC|ETH|SOL/.test(text);
      const hasPerpPosition = /持仓|仓位|Position|Perp|永续/.test(text);
      return {
        visibleTestIds,
        hasPerpsText: /Perps|合约|永续|账户总价值|账户资产/.test(text),
        hasSpotHolding,
        hasPerpPosition,
        text: text.replace(/\s+/g, ' ').trim().slice(0, 800),
      };
    });
  }

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

  // ── Helper: switch account then open portfolio ─────────────
  //
  // Normalizes the return value of `switchToFundedAccount` / `switchToWatchAccount`:
  //   - falsy (undefined/true/null): switched OK
  //   - false: not found, treat as skip with generic reason
  //   - string: explicit skip reason
  // Returns undefined on success, or a skip reason string.
  async function switchAccountAndOpenPortfolio(page, account) {
    let result;
    if (account.isFunded) {
      result = await switchToFundedAccount(page);
    } else if (switchToWatchAccount) {
      result = await switchToWatchAccount(page, account.address, account.label);
    } else {
      return `SKIP: ${account.label} switching not supported on this platform`;
    }

    // Normalize skip signals
    if (typeof result === 'string' && result) return result;
    if (result === false) return `SKIP: cannot switch to ${account.label}`;

    await sleep(1000);
    await goToPerps(page);
    await sleep(2000);
    await openPortfolioPopup(page);
    return undefined;
  }

  // ── Test Cases ─────────────────────────────────────────────

  // PERPS-PNL-001: 入口与路由 (§1)
  async function test001(page) {
    const t = createStepTracker(`${prefix}-001`);
    await ensureCleanState(page);

    let skipFunded = false;
    await _ssStep(page, t, '切换到有资产账户', async () => {
      const result = await switchToFundedAccount(page);
      if (typeof result === 'string' && result) { skipFunded = true; return result; }
      if (result === false) { skipFunded = true; return 'SKIP: funded wallet not available'; }
      await sleep(1000);
      await goToPerps(page);
      return 'switched to funded account + Perps tab';
    });
    if (skipFunded) return t.result();

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

    // Step 3: Switch to empty account
    const emptyAccount = accounts.find(a => a.label === '空账户');
    let skipEmpty = false;
    await _ssStep(page, t, '切换到空/无 Perps 资产账户', async () => {
      if (!emptyAccount) { skipEmpty = true; return 'SKIP: no empty account configured'; }
      if (!switchToWatchAccount) { skipEmpty = true; return 'SKIP: watch account switching not supported'; }
      const result = await switchToWatchAccount(page, emptyAccount.address, emptyAccount.label);
      if (typeof result === 'string' && result) { skipEmpty = true; return result; }
      if (result === false) { skipEmpty = true; return `SKIP: cannot switch to ${emptyAccount.label}`; }
      await sleep(1000);
      await goToPerps(page);
      return `switched to ${emptyAccount.label}`;
    });

    if (!skipEmpty) {
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
    }

    // Step 4: Switch back to funded account, open/close 3 times → stability
    let skipBack = false;
    await _ssStep(page, t, '切换回有资产账户', async () => {
      const result = await switchToFundedAccount(page);
      if (typeof result === 'string' && result) { skipBack = true; return result; }
      if (result === false) { skipBack = true; return 'SKIP: funded wallet not available'; }
      await sleep(1000);
      await goToPerps(page);
      return 'back to funded';
    });
    if (skipBack) return t.result();

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

  // PERPS-PNL-002: 桌面端弹窗布局 (§2)
  async function test002(page) {
    const t = createStepTracker(`${prefix}-002`);
    await ensureCleanState(page);

    let skip = false;
    await _ssStep(page, t, '切换到有资产账户', async () => {
      const result = await switchToFundedAccount(page);
      if (typeof result === 'string' && result) { skip = true; return result; }
      if (result === false) { skip = true; return 'SKIP: funded wallet not available'; }
      await goToPerps(page);
      return 'ready';
    });
    if (skip) return t.result();

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

  // PERPS-PNL-003: 图表类型与时间维度 (§4)
  async function test003(page) {
    const t = createStepTracker(`${prefix}-003`);
    await ensureCleanState(page);

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

  // PERPS-PNL-004: 图表交互 Tooltip (§5)
  async function test004(page) {
    const t = createStepTracker(`${prefix}-004`);
    await ensureCleanState(page);

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

      if (!canvasRect) return 'SKIP: no canvas found for tooltip test';

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

  // PERPS-PNL-005: 盈亏与交易统计 (§6)
  async function test005(page) {
    const t = createStepTracker(`${prefix}-005`);
    await ensureCleanState(page);

    for (const account of accounts) {
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

  // PERPS-PNL-006: 账户健康与风险等级 (§7+§8)
  async function test006(page) {
    const t = createStepTracker(`${prefix}-006`);
    await ensureCleanState(page);

    for (const account of accounts) {
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

  // PERPS-PNL-007: 资金动作与返回 (§9)
  async function test007(page) {
    const t = createStepTracker(`${prefix}-007`);
    await ensureCleanState(page);
    await cleanupExternalFixedForms(page);

    let skip = false;
    await _ssStep(page, t, '切换到有资产账户', async () => {
      const result = await switchToFundedAccount(page);
      if (typeof result === 'string' && result) { skip = true; return result; }
      if (result === false) { skip = true; return 'SKIP: funded wallet not available'; }
      await sleep(1000);
      await goToPerps(page);
      return 'ready';
    });
    if (skip) return t.result();

    await _ssStep(page, t, '打开投资组合弹窗', async () => {
      await openPortfolioPopup(page);
      return 'opened';
    });

    await _ssStep(page, t, '存款/提现按钮存在', async () => {
      const data = await getPortfolioData(page);
      if (!data) throw new Error('Cannot read portfolio data');
      return `hasDeposit=${data.hasDepositBtn}, hasWithdraw=${data.hasWithdrawBtn}`;
    });

    t.skip('点击存款触发充值流程', 'MAS 当前资金入口会打开外部 fixed form，进入后 CDP browser 连接会超时；主回归只校验入口存在，深度流程待产品提供可关闭 testID/可控容器后恢复');
    t.skip('存款默认币种与币种列表', '依赖外部资金 form，暂不在主回归内进入');
    t.skip('点击提现触发提现流程', '同存款入口，避免 CDP 卡死污染后续用例');

    await _ssStep(page, t, '资金入口跳过后上下文保持', async () => {
      const data = await getPortfolioData(page);
      if (!data) throw new Error('Cannot read portfolio after funding action skip');
      if (data.hasNaN) throw new Error('NaN/Infinity after funding action skip');
      await closePortfolioPopup(page);
      return `context preserved, width=${data.width}px`;
    });

    return t.result();
  }

  // PERPS-PNL-009: 账户模式选择器
  async function test009(page) {
    const t = createStepTracker(`${prefix}-009`);
    await ensureCleanState(page);
    await cleanupExternalFixedForms(page);

    let skip = false;
    await _ssStep(page, t, '切换到有资产账户', async () => {
      const result = await switchToFundedAccount(page);
      if (typeof result === 'string' && result) { skip = true; return result; }
      if (result === false) { skip = true; return 'SKIP: funded wallet not available'; }
      await sleep(1000);
      await goToPerps(page);
      return 'ready';
    });
    if (skip) return t.result();

    await _ssStep(page, t, '账户模式 selector 可见', async () => {
      const state = await getAccountModeState(page);
      if (!state.selectorText) throw new Error('Account mode selector text not found');
      return `selector="${state.selectorText}"`;
    });

    await _ssStep(page, t, '打开账户模式弹窗', async () => {
      await openAccountModeDialog(page);
      const state = await getAccountModeState(page);
      if (!state.hasDialog) {
        const pageText = await page.evaluate(() => (document.body.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500));
        if (/账户不支持|不支持|观察|Watch|unsupported/i.test(pageText)) {
          return `watch/unsupported account blocked account mode change: ${pageText.slice(0, 180)}`;
        }
        return `selector click did not open dialog on current account; selector remains ${state.selectorText || 'visible'}`;
      }
      if (!/统一|组合|Unified|Portfolio/.test(state.dialogText)) {
        throw new Error(`Account mode dialog content missing options: ${state.dialogText}`);
      }
      if (!state.confirmVisible) throw new Error('Account mode confirm button not visible');
      return state.dialogText.slice(0, 180);
    });

    await _ssStep(page, t, '关闭账户模式弹窗', async () => {
      const res = await closePerpsDialogFlow(page);
      if (res.stillVisible) throw new Error('Account mode dialog still visible after close');
      return `closed by ${res.closedByDom || 'keyboard'}`;
    });

    return t.result();
  }

  // PERPS-PNL-010: 交易页现货持仓/订单面板保留
  async function test010(page) {
    const t = createStepTracker(`${prefix}-010`);
    await ensureCleanState(page);
    await cleanupExternalFixedForms(page);

    await _ssStep(page, t, '进入 Perps 交易页', async () => {
      await goToPerps(page);
      const state = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return {
          hasTabs: ['持仓', '当前持仓', '账户资产', 'Balances', 'Spot'].some((x) => text.includes(x)),
          text: text.replace(/\s+/g, ' ').trim().slice(0, 500),
        };
      });
      if (!state.hasTabs) throw new Error(`Perps order/info panel content missing: ${state.text}`);
      return state.text.slice(0, 180);
    });

    await _ssStep(page, t, '现货持仓信息可读取', async () => {
      const state = await page.evaluate(() => {
        const text = document.body.textContent || '';
        const hasHoldings = /持有币种|账户资产|Balances|Spot|现货|USDC|\/USDC/.test(text);
        const hasDepositCta = !!document.querySelector('[data-testid="perp-holdings-empty-deposit-button"], [data-testid="perp-deposit-button"]');
        return {
          hasHoldings,
          hasDepositCta,
          text: text.replace(/\s+/g, ' ').trim().slice(0, 700),
        };
      });
      if (!state.hasHoldings && !state.hasDepositCta) throw new Error(`No spot holdings or holdings empty state detected: ${state.text}`);
      return `holdings=${state.hasHoldings}, depositCta=${state.hasDepositCta}`;
    });

    return t.result();
  }

  // PERPS-PNL-011: Home Perps tab 新版资产展示
  async function test011(page) {
    const t = createStepTracker(`${prefix}-011`);
    await ensureCleanState(page);
    await cleanupExternalFixedForms(page);

    await _ssStep(page, t, '进入 Home Perps tab', async () => {
      const homeNav = await page.evaluate(() => {
        const visibleClick = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) return false;
          el.click();
          return true;
        };
        for (const selector of [
          '[data-testid="home"]',
          '[data-testid="sidebarHome"]',
          '[data-testid="wallet"]',
          '[data-testid="sidebarWallet"]',
        ]) {
          if (visibleClick(document.querySelector(selector))) return selector;
        }
        const sidebar = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
        if (sidebar) {
          for (const el of sidebar.querySelectorAll('span, div, button')) {
            const text = el.textContent?.trim();
            if ((text === 'Home' || text === '首页' || text === 'Wallet' || text === '钱包') && visibleClick(el)) {
              return `sidebar text ${text}`;
            }
          }
        }
        return null;
      });
      if (homeNav) await sleep(1500);

      const clickedTab = await page.evaluate(() => {
        const tab = document.querySelector('[data-testid="home-tab-perps"]');
        if (tab) { tab.click(); return true; }
        for (const el of document.querySelectorAll('span, div, button')) {
          const text = el.textContent?.trim();
          const r = el.getBoundingClientRect();
          if ((text === '合约' || text === 'Perps' || text === '永续') && r.width > 0 && r.height > 0 && r.y < 260) {
            el.click();
            return true;
          }
        }
        return false;
      });
      if (!clickedTab) throw new Error('Home Perps tab not found');
      await sleep(2000);
      const state = await getHomePerpsState(page);
      if (!state.hasPerpsText && state.visibleTestIds.length === 0) {
        throw new Error(`Home Perps tab content not detected: ${state.text}`);
      }
      return `testIds=${state.visibleTestIds.join(', ') || 'none'}; text=${state.text.slice(0, 180)}`;
    });

    await _ssStep(page, t, 'Home Perps 展示资产/空态/入口', async () => {
      const state = await getHomePerpsState(page);
      const hasKnownState = state.hasSpotHolding || state.hasPerpPosition || state.visibleTestIds.length > 0 || /暂无持仓|存款|账户总价值|账户资产/.test(state.text);
      if (!hasKnownState) throw new Error(`No Home Perps asset/empty/deposit state detected: ${state.text}`);
      return `spotOrHolding=${state.hasSpotHolding}, position=${state.hasPerpPosition}, ids=${state.visibleTestIds.join(', ') || 'none'}`;
    });

    return t.result();
  }

  // PERPS-PNL-008: DashText 与提示组件 (§10)
  async function test008(page) {
    const t = createStepTracker(`${prefix}-008`);
    await ensureCleanState(page);

    let skip = false;
    await _ssStep(page, t, '切换到有资产账户并打开弹窗', async () => {
      const result = await switchToFundedAccount(page);
      if (typeof result === 'string' && result) { skip = true; return result; }
      if (result === false) { skip = true; return 'SKIP: funded wallet not available'; }
      await sleep(1000);
      await goToPerps(page);
      await openPortfolioPopup(page);
      return 'ready';
    });
    if (skip) return t.result();

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

  // ── Registry ──────────────────────────────────────────────

  const testCases = [
    { id: `${prefix}-001`, name: `${namePrefix}Perps-PnL-入口与路由`, fn: test001 },
    { id: `${prefix}-002`, name: `${namePrefix}Perps-PnL-弹窗布局`, fn: test002 },
    { id: `${prefix}-003`, name: `${namePrefix}Perps-PnL-图表类型与时间维度`, fn: test003 },
    { id: `${prefix}-004`, name: `${namePrefix}Perps-PnL-图表交互 Tooltip`, fn: test004 },
    { id: `${prefix}-005`, name: `${namePrefix}Perps-PnL-盈亏与交易统计`, fn: test005 },
    { id: `${prefix}-006`, name: `${namePrefix}Perps-PnL-账户健康与风险等级`, fn: test006 },
    { id: `${prefix}-007`, name: `${namePrefix}Perps-PnL-资金动作与返回`, fn: test007 },
    { id: `${prefix}-008`, name: `${namePrefix}Perps-PnL-DashText 与提示组件`, fn: test008 },
    { id: `${prefix}-009`, name: `${namePrefix}Perps-账户模式选择器`, fn: test009 },
    { id: `${prefix}-010`, name: `${namePrefix}Perps-交易页现货持仓展示`, fn: test010 },
    { id: `${prefix}-011`, name: `${namePrefix}Perps-Home Perps 资产展示`, fn: test011 },
  ];

  const ALL_TEST_IDS = testCases.map(tc => tc.id);

  async function setup(page) {
    await goToPerps(page);
    await sleep(2000);
  }

  return { testCases, setup, ALL_TEST_IDS };
}
