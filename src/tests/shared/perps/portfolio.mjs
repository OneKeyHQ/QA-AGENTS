import { runPreconditions } from "../../helpers/preconditions.mjs";
import {
  assertHealthFields,
  assertHealthColor,
  assertPnlColor,
  assertPortfolioStats,
  markRestoreFailure,
} from "./runtime.mjs";
import {
  hoverPortfolioChart,
  activePortfolioChartType,
  hoverPortfolioStatistic,
} from "./portfolio-assertions.mjs";
import { unlockWalletIfNeeded } from "../../helpers/navigation.mjs";
import { locator, closePairs } from "../../helpers/perps-ui.mjs";
import { switchNetwork } from "../../helpers/network.mjs";
// Perps Portfolio & PnL — shared test logic (Desktop / Web / Extension)
//
// Wrapper files at:
//   src/tests/desktop/perps/portfolio.test.mjs
//   src/tests/web/perps/portfolio.test.mjs
//   src/tests/extension/perps/portfolio.test.mjs
// inject platform-specific CDP connect + goToPerps + account switchers,
// then call createPortfolioTests() to get shared cases, including menu/history controls.
//
// Coverage mapping (legacy 001–011 plus 012–013; mobile/multi-platform require separate execution):
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
//   Portfolio uses an IN_PAGE_TAB_CONTAINER role=dialog outer layer.
//   Measure its inner Content (960px on desktop), not the full-width outer layer.
//   Entry: click balance ($xx.xx) or 存款 button in Perps header (y < 50)

import { sleep } from "../../helpers/constants.mjs";
import {
  createStepTracker,
  safeStep,
  scrollToTop,
  goBackToMainPage,
  ensureCleanState,
  clickSidebarTab,
} from "../../helpers/components.mjs";

// Default watch addresses used by the 多账户 loop test cases.
export const WATCH_ADDRESSES = {
  高胜率: "0x0aac6955688dc1cd3cafd52ebcade334fb1c9c3b",
  低胜率: "0xa65ce1D604fa901c13AA29f2126a57d9032e412B",
  空账户: "0xb308F51259aC794086C13d66e37fadeE8D8abf9a",
};

// Default account roster — wrappers can override via `accounts` option.
export const DEFAULT_ACCOUNTS = [
  { label: "高胜率", address: WATCH_ADDRESSES["高胜率"], isFunded: true },
  { label: "低胜率", address: WATCH_ADDRESSES["低胜率"] },
  { label: "空账户", address: WATCH_ADDRESSES["空账户"], isReadOnly: true },
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
  namePrefix = "",
  screenshotDir,
  goToPerps,
  switchToFundedAccount,
  switchToWatchAccount,
  accounts = DEFAULT_ACCOUNTS,
}) {
  if (!screenshotDir)
    throw new Error("createPortfolioTests: screenshotDir required");
  if (!goToPerps) throw new Error("createPortfolioTests: goToPerps required");
  if (!switchToFundedAccount)
    throw new Error("createPortfolioTests: switchToFundedAccount required");

  // safeStep shortcut bound to this platform's screenshot dir
  const _ssStep = (page, t, name, fn) =>
    safeStep(
      page,
      {
        ...t,
        add: (n, status, detail) => {
          if (status === "passed" && /^SKIP:/.test(detail)) t.skip(n, detail);
          else t.add(n, status, detail);
        },
      },
      name,
      fn,
      screenshotDir,
    );

  // ── Portfolio Popup Helpers ─────────────────────────────────

  async function cleanupExternalFixedForms(page) {
    await unlockWalletIfNeeded(page);
    for (
      let i = 0;
      i < 4 && (await page.locator('[role="dialog"]:visible').count());
      i++
    )
      await closePerpsDialogFlow(page);
  }

  async function openPortfolioPopup(page) {
    // Retained navigation stacks can contain offscreen back buttons with a
    // nonzero rect. Do not run the global back-button sweep from this entry.
    await goToPerps(page);
    await unlockWalletIfNeeded(page);
    await scrollToTop(page);
    const entry = locator(page, "perps.perp-portfolio-button");
    if ((await entry.count()) !== 1)
      throw Error("Expected one portfolio balance entry");
    const text = (await entry.innerText()).trim();
    await entry.click();
    await locator(page, "perps.portfolio.chart_type").waitFor({
      state: "visible",
      timeout: 15000,
    });
    if (!(await isPortfolioPopupVisible(page)))
      throw Error("Portfolio popup missing after balance click");
    const title = page
      .getByText("投资组合与盈亏", { exact: true })
      .filter({ visible: true });
    await title.waitFor({ state: "visible", timeout: 10000 });
    if ((await title.count()) !== 1)
      throw Error("Expected exactly one visible portfolio title");
    if (
      (await locator(page, "perps.portfolio.chart_type")
        .filter({ visible: true })
        .count()) !== 1
    )
      throw Error("Expected exactly one visible portfolio chart control");
    await page
      .getByText("总交易次数", { exact: true })
      .filter({ visible: true })
      .waitFor({ state: "visible", timeout: 10000 });
    return text;
  }

  async function isPortfolioPopupVisible(page) {
    return page.evaluate(() => {
      const el = document.querySelector(
        '[data-testid="IN_PAGE_TAB_CONTAINER"]',
      );
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  }

  async function closePortfolioPopup(page) {
    const closed = await page.evaluate(() => {
      const container = document.querySelector(
        '[data-testid="IN_PAGE_TAB_CONTAINER"]',
      );
      if (!container) return false;
      const buttons = container.querySelectorAll("button");
      for (const btn of buttons) {
        const r = btn.getBoundingClientRect();
        if (r.width > 10 && r.width < 50 && r.height > 10 && r.height < 50) {
          const text = btn.textContent?.trim();
          const ariaLabel = btn.getAttribute("aria-label") || "";
          if (
            !text ||
            ariaLabel.includes("close") ||
            ariaLabel.includes("关闭") ||
            text === "×" ||
            text === "X"
          ) {
            btn.click();
            return true;
          }
        }
      }
      for (const btn of buttons) {
        const svg = btn.querySelector("svg");
        if (svg) {
          const r = btn.getBoundingClientRect();
          if (
            r.width < 50 &&
            r.height < 50 &&
            container.getBoundingClientRect().right - r.right < 50
          ) {
            btn.click();
            return true;
          }
        }
      }
      return false;
    });

    if (!closed) {
      await page.keyboard.press("Escape");
    }
    await sleep(800);

    const stillVisible = await isPortfolioPopupVisible(page);
    if (stillVisible) {
      await page.mouse.click(10, 300);
      await sleep(500);
    }
  }

  async function closePerpsDialogFlow(page) {
    const dialogs = page.locator('[role="dialog"]:visible');
    if (!(await dialogs.count()))
      return { closedByDom: null, stillVisible: false };
    const top = dialogs.last(),
      handle = await top.elementHandle();
    const close = top
      .locator(
        '[data-testid="dialog-header-close"], [data-testid="nav-header-close"]',
      )
      .filter({ visible: true });
    if (await close.count()) await close.last().click();
    else await page.keyboard.press("Escape");
    await page.waitForFunction(
      (el) => !el.isConnected || el.getBoundingClientRect().width === 0,
      handle,
      { timeout: 5000 },
    );
    return { closedByDom: "top-dialog-close", stillVisible: false };
  }

  async function getPortfolioData(page) {
    return page.evaluate(() => {
      const container = document.querySelector(
        '[data-testid="IN_PAGE_TAB_CONTAINER"] [data-testid="IN_PAGE_TAB_CONTAINER"]',
      );
      if (!container) return null;

      const text = container.textContent || "";
      const result = {
        raw: text.slice(0, 1000),
        width: Math.round(container.getBoundingClientRect().width),
        height: Math.round(container.getBoundingClientRect().height),
      };

      const extractAfterLabel = (label) => {
        const idx = text.indexOf(label);
        if (idx < 0) return null;
        const after = text
          .slice(idx + label.length, idx + label.length + 80)
          .trim();
        const m = after.match(
          /^[\s:：]*([+-]?\$?[\d,.]+[KMBT]?%?x?|--|-|N\/A)/,
        );
        return m ? m[1].trim() : after.slice(0, 30).trim();
      };

      const findValueElement = (label) => {
        const el = [...container.querySelectorAll("span")].find(
          (e) => e.children.length === 0 && e.textContent?.trim() === label,
        );
        const parent = el?.parentElement?.parentElement;
        const value =
          parent &&
          [...parent.querySelectorAll("span")].find(
            (e) =>
              e.children.length === 0 &&
              /^[+-]?\$[\d,.]+(?:[KMBT])?$/.test(e.textContent?.trim()),
          );
        return value
          ? {
              text: value.textContent.trim(),
              color: window.getComputedStyle(value).color,
            }
          : null;
      };

      result.accountAsset = extractAfterLabel("账户资产");
      result.available = extractAfterLabel("可用");
      const gaugeValue = (label) => {
        const labelEl = [...container.querySelectorAll("span")].find(
          (e) => e.children.length === 0 && e.textContent?.trim() === label,
        );
        const gauge = labelEl?.closest(
          '[data-sentry-component="SemiCircleGauge"]',
        );
        return gauge
          ? ([...gauge.querySelectorAll("span")]
              .map((e) => e.textContent?.trim())
              .find((v) => /^[-+$\d]/.test(v)) ?? null)
          : null;
      };
      result.leverage = gaugeValue("杠杆");
      result.usedMargin = gaugeValue("已用保证金");
      result.mmr = gaugeValue("MMR");
      result.healthLevel = (() => {
        if (text.includes("高风险")) return "高风险";
        if (text.includes("中等风险") || text.includes("中风险"))
          return "中风险";
        if (text.includes("低风险") || text.includes("健康")) return "低风险";
        return null;
      })();

      result.unrealizedPnl = extractAfterLabel("未实现盈亏");
      result.totalPnl = findValueElement("总盈亏") || {
        text: extractAfterLabel("总盈亏"),
        color: null,
      };
      result.positions = extractAfterLabel("当前持仓");

      result.volume = extractAfterLabel("交易量");
      result.topTraded = extractAfterLabel("最多交易");
      result.feesPaid = extractAfterLabel("已付手续费");
      result.netDeposit = extractAfterLabel("净入金");
      result.totalTrades = extractAfterLabel("总交易次数");

      result.winRate = extractAfterLabel("胜率");
      result.profitFactor = extractAfterLabel("盈利因子");
      result.avgProfit = extractAfterLabel("平均盈利");
      result.avgLoss = extractAfterLabel("平均亏损");

      result.hasDepositBtn = !!Array.from(
        container.querySelectorAll("button"),
      ).find((b) => {
        const t = b.textContent?.trim();
        return t === "存款" || t === "Deposit";
      });
      result.hasWithdrawBtn = !!Array.from(
        container.querySelectorAll("button"),
      ).find((b) => {
        const t = b.textContent?.trim();
        return t === "提现" || t === "Withdraw";
      });

      result.hasNaN = /NaN|Infinity/.test(text);

      return result;
    });
  }

  async function clickPortfolioAction(page, action) {
    const clicked = await page.evaluate((label) => {
      const container = document.querySelector(
        '[data-testid="IN_PAGE_TAB_CONTAINER"]',
      );
      if (!container) return false;
      const candidates = [
        ...container.querySelectorAll(
          '[data-testid="perp-portfolio-buttons-btn"]',
        ),
        ...container.querySelectorAll("button"),
      ];
      for (const btn of candidates) {
        const text = btn.textContent?.trim();
        const r = btn.getBoundingClientRect();
        if (
          r.width > 0 &&
          r.height > 0 &&
          (text === label ||
            (label === "存款" && text === "Deposit") ||
            (label === "提现" && text === "Withdraw"))
        ) {
          btn.click();
          return true;
        }
      }
      return false;
    }, action);
    if (!clicked)
      throw new Error(`${action} button not found or not clickable`);
    await sleep(2000);
  }

  async function getDepositDialogState(page) {
    return page.evaluate(() => {
      const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(
        (e) => e.getBoundingClientRect().width > 0,
      );
      const modal = dialogs.at(-1),
        text = modal?.innerText ?? "";
      return {
        hasModal: !!modal && !text.startsWith("投资组合与盈亏"),
        hasUsdc: text.includes("USDC"),
        hasMethodChooser: /从 OneKey Wallet 转入|链上收款/.test(text),
        text: text.slice(0, 450),
      };
    });
  }

  async function openDepositTokenListIfPossible(page) {
    const opened = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal || modal.getBoundingClientRect().width === 0) return false;
      const existing = modal.querySelector(
        '[data-testid="perp-deposit-token-item"]',
      );
      if (existing && existing.getBoundingClientRect().width > 0) return true;
      const candidates = [...modal.querySelectorAll("div, button")]
        .map((el) => ({
          el,
          r: el.getBoundingClientRect(),
          text: (el.textContent || "").replace(/\s+/g, " ").trim(),
        }))
        .filter(
          ({ r, text }) =>
            r.width > 120 &&
            r.height >= 40 &&
            r.height <= 90 &&
            /USDC|Arbitrum|ETH|SOL|BTC/i.test(text),
        )
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
      const visible = (el) => !!el && el.getBoundingClientRect().width > 0;
      const selector = [...document.querySelectorAll("span")].find(
        (e) =>
          e.children.length === 0 &&
          visible(e) &&
          /^(统一|组合|默认|Unified|Portfolio)$/.test(e.textContent.trim()),
      );
      const dialog = [...document.querySelectorAll('[role="dialog"]')].find(
        (e) => visible(e) && /^(账户模式|Account Mode)/.test(e.innerText),
      );
      return {
        selectorText: selector?.textContent.trim(),
        hasDialog: !!dialog,
        dialogText: dialog?.innerText ?? "",
        confirmVisible: visible(
          dialog?.querySelector(
            '[data-testid="perp-account-mode-confirm-button"]',
          ),
        ),
        needsEnable: visible(
          dialog?.querySelector('[data-testid="perp-is-disabled-btn"]'),
        ),
      };
    });
  }
  async function openAccountModeDialog(page) {
    const selector = page
      .getByText(/^(统一|组合|默认|Unified|Portfolio)$/)
      .filter({ visible: true });
    if ((await selector.count()) !== 1)
      throw Error("Account mode selector missing or ambiguous");
    await selector.click();
    await page.waitForTimeout(500);
  }

  async function getHomePerpsState(page) {
    const keys = [
      "perps.home.manage",
      "perps.home.deposit",
      "perps.home.desktop_deposit",
    ];
    const controls = keys.map((key) => locator(page, key));
    await controls
      .reduce((all, control) => all.or(control))
      .first()
      .waitFor({ state: "visible", timeout: 15000 });
    const visibleTestIds = [];
    for (const control of controls) {
      for (let i = 0; i < (await control.count()); i++)
        visibleTestIds.push(await control.nth(i).getAttribute("data-testid"));
    }
    return { visibleTestIds };
  }

  async function getCanvasHash(page) {
    return page.evaluate(() => {
      const container = document.querySelector(
        '[data-testid="IN_PAGE_TAB_CONTAINER"]',
      );
      if (!container) return null;
      const canvases = container.querySelectorAll("canvas");
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
        const ctx = maxCanvas.getContext("2d");
        const data = ctx.getImageData(
          0,
          0,
          maxCanvas.width,
          maxCanvas.height,
        ).data;
        let hash = 0;
        for (let j = 0; j < data.length; j += 100) {
          hash = ((hash << 5) - hash + data[j]) | 0;
        }
        return hash;
      } catch {
        return null;
      }
    });
  }

  async function getCanvasInfo(page) {
    return page.evaluate(() => {
      const container = document.querySelector(
        '[data-testid="IN_PAGE_TAB_CONTAINER"]',
      );
      if (!container) return null;
      const canvases = container.querySelectorAll("canvas");
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
      const container = document.querySelector(
        '[data-testid="IN_PAGE_TAB_CONTAINER"]',
      );
      if (!container) return false;
      for (const el of container.querySelectorAll("span, div, button")) {
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
      const container = document.querySelector(
        '[data-testid="IN_PAGE_TAB_CONTAINER"]',
      );
      if (!container) return false;
      for (const el of container.querySelectorAll("span, div, button")) {
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
      const container = document.querySelector(
        '[data-testid="IN_PAGE_TAB_CONTAINER"]',
      );
      if (!container) return null;
      let bestMatch = null;
      let bestOpacity = 0;
      for (const tabText of texts) {
        for (const el of container.querySelectorAll("span, div, button")) {
          if (el.textContent?.trim() === tabText && el.children.length === 0) {
            const r = el.getBoundingClientRect();
            if (r.width === 0) continue;
            const style = window.getComputedStyle(el);
            const opacity = parseFloat(style.opacity) || 1;
            const color = style.color;
            const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            const brightness = m
              ? (parseInt(m[1]) + parseInt(m[2]) + parseInt(m[3])) / 3
              : 128;
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
      const container = document.querySelector(
        '[data-testid="IN_PAGE_TAB_CONTAINER"] [data-testid="IN_PAGE_TAB_CONTAINER"]',
      );
      if (!container) return null;

      const containerRect = container.getBoundingClientRect();

      const sections = [];
      function findSections(parent, depth) {
        if (depth > 12) return;
        for (const child of parent.children) {
          const r = child.getBoundingClientRect();
          if (
            r.width > 200 &&
            r.height > 200 &&
            r.width < containerRect.width * 0.85
          ) {
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

      const uniqueX = new Set(sections.map((s) => Math.round(s.x / 50)));
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

      const hasCanvas = container.querySelectorAll("canvas").length > 0;

      let title = null;
      for (const el of document.querySelectorAll('[role="dialog"] span')) {
        const text = el.textContent?.trim();
        if (
          text &&
          (text.includes("Portfolio") ||
            text.includes("投资组合") ||
            text.includes("P&L") ||
            text.includes("盈亏"))
        ) {
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
      const container = document.querySelector(
        '[data-testid="IN_PAGE_TAB_CONTAINER"]',
      );
      if (!container) return null;

      const healthLabels = ["健康", "低风险", "中等风险", "高风险"];
      for (const el of container.querySelectorAll("span")) {
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
              r: rv,
              g: gv,
              b: bv,
              label: text,
              isGreen: gv > 100 && rv < 100,
              isYellow: rv > 180 && gv > 120 && bv < 100,
              isRed: rv > 180 && gv < 80,
            };
          }
        }
      }

      for (const el of container.querySelectorAll("span")) {
        const text = el.textContent?.trim();
        if (text && /^\d+(\.\d+)?%$/.test(text) && el.children.length === 0) {
          const parent = el.parentElement?.parentElement;
          if (parent?.textContent?.includes("MMR")) {
            return { label: "no-health-label", mmrValue: parseFloat(text) };
          }
        }
      }
      return null;
    });
  }

  async function getTotalPnLColor(page) {
    return page.evaluate(() => {
      const container = document.querySelector(
        '[data-testid="IN_PAGE_TAB_CONTAINER"]',
      );
      if (!container) return null;

      for (const el of container.querySelectorAll("span, div, p")) {
        const text = el.textContent?.trim();
        if (text === "总盈亏" && el.children.length === 0) {
          const parent = el.parentElement?.parentElement;
          if (!parent) continue;
          for (const sibling of parent.querySelectorAll("span, div")) {
            const sibText = sibling.textContent?.trim();
            if (
              sibling.children.length === 0 &&
              sibText &&
              /^[+-]?\$[\d,.]+(?:[KMBT])?$/.test(sibText)
            ) {
              const color = window.getComputedStyle(sibling).color;
              const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
              if (m) {
                const r = parseInt(m[1]);
                const g = parseInt(m[2]);
                const b = parseInt(m[3]);
                const isPositive = !sibText.startsWith("-");
                return {
                  raw: color,
                  r,
                  g,
                  b,
                  value: sibText,
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
    if (typeof result === "string" && result) return result;
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
    await _ssStep(page, t, "切换到有资产账户", async () => {
      const result = await switchToFundedAccount(page);
      if (typeof result === "string" && result) {
        skipFunded = true;
        return result;
      }
      if (result === false) {
        skipFunded = true;
        return "SKIP: funded wallet not available";
      }
      await sleep(1000);
      await goToPerps(page);
      return "switched to funded account + Perps tab";
    });
    if (skipFunded) return t.result();

    await _ssStep(page, t, "有资产账户点击入口显示余额", async () => {
      const entryText = await openPortfolioPopup(page);
      if (!/^\$/.test(entryText))
        throw new Error(`Expected balance entry ($xx.xx), got: ${entryText}`);
      const visible = await isPortfolioPopupVisible(page);
      if (!visible) throw new Error("Portfolio popup not visible after click");
      const data = await getPortfolioData(page);
      if (!data) throw new Error("Cannot read portfolio data");
      if (data.hasNaN) throw new Error("NaN/Infinity found in popup content");
      return `entry="${entryText}", popup width=${data.width}px`;
    });

    await _ssStep(page, t, "关闭有资产账户弹窗", async () => {
      await closePortfolioPopup(page);
      const stillVisible = await isPortfolioPopupVisible(page);
      if (stillVisible) throw new Error("Popup still visible after close");
      return "closed";
    });

    // Step 3: Switch to empty account
    const emptyAccount = accounts.find((a) => a.label === "空账户");
    let skipEmpty = false;
    await _ssStep(page, t, "切换到空/无 Perps 资产账户", async () => {
      if (!emptyAccount) {
        skipEmpty = true;
        return "SKIP: no empty account configured";
      }
      if (!switchToWatchAccount) {
        skipEmpty = true;
        return "SKIP: watch account switching not supported";
      }
      const result = await switchToWatchAccount(
        page,
        emptyAccount.address,
        emptyAccount.label,
      );
      if (typeof result === "string" && result) {
        skipEmpty = true;
        return result;
      }
      if (result === false) {
        skipEmpty = true;
        return `SKIP: cannot switch to ${emptyAccount.label}`;
      }
      await sleep(1000);
      await goToPerps(page);
      return `switched to ${emptyAccount.label}`;
    });

    if (!skipEmpty) {
      await _ssStep(page, t, "空账户点击入口显示存款引导", async () => {
        await unlockWalletIfNeeded(page);
        const entry = locator(page, "perps.perp-portfolio-button");
        await entry.waitFor({ state: "visible", timeout: 10000 });
        if ((await entry.count()) !== 1)
          throw Error("Expected one current-account balance/deposit entry");
        const entryText = (await entry.innerText()).trim();
        // switchToWatchAccount creates a read-only account. Production explicitly
        // disables deposit for it, so a zero balance alone is not a usable
        // empty deposit account. Keep this prerequisite visible, not a pass.
        if (entryText !== "存款") {
          if (emptyAccount.isReadOnly === true)
            return "SKIP: 配置的空账户为已知只读观察账户，需可存款且余额为零的普通钱包账户；未把点击余额后的投资组合当充值引导";
          throw Error(
            `Expected empty spendable account Deposit entry, got ${entryText}`,
          );
        }
        await entry.click();
        await page.waitForFunction(
          () =>
            [...document.querySelectorAll('[role="dialog"]')].some(
              (e) => e.getBoundingClientRect().width > 0,
            ),
          undefined,
          { timeout: 10000 },
        );
        const state = await getDepositDialogState(page);
        if (!state.hasModal || (!state.hasMethodChooser && !state.hasUsdc))
          throw Error(
            `Empty-account deposit guidance missing: ${JSON.stringify(state)}`,
          );
        if (
          await locator(page, "perps.portfolio.chart_type")
            .filter({ visible: true })
            .count()
        )
          throw Error(
            "Empty deposit account incorrectly opened portfolio chart",
          );
        if (
          await page
            .getByText("投资组合与盈亏", { exact: true })
            .filter({ visible: true })
            .count()
        )
          throw Error(
            "Portfolio title shown instead of empty-account deposit guidance",
          );
        return `empty account entry="${entryText}"`;
      });

      await _ssStep(page, t, "关闭空账户弹窗", async () => {
        const popupVisible = await isPortfolioPopupVisible(page);
        if (popupVisible) {
          await closePortfolioPopup(page);
        } else {
          await page.keyboard.press("Escape");
          await sleep(500);
        }
        return "cleaned up";
      });
    }

    // Step 4: Switch back to funded account, open/close 3 times → stability
    let skipBack = false;
    await _ssStep(page, t, "切换回有资产账户", async () => {
      const result = await switchToFundedAccount(page);
      if (typeof result === "string" && result) {
        skipBack = true;
        return result;
      }
      if (result === false) {
        skipBack = true;
        return "SKIP: funded wallet not available";
      }
      await sleep(1000);
      await goToPerps(page);
      return "back to funded";
    });
    if (skipBack) return t.result();

    await _ssStep(page, t, "连续开关 3 次无白屏无重复", async () => {
      for (let i = 0; i < 3; i++) {
        await openPortfolioPopup(page);
        const visible = await isPortfolioPopupVisible(page);
        if (!visible)
          throw new Error(`Iteration ${i + 1}: popup not visible after open`);

        const hasContent = await page.evaluate(() => {
          const c = document.querySelector(
            '[data-testid="IN_PAGE_TAB_CONTAINER"]',
          );
          return c ? c.textContent.trim().length > 20 : false;
        });
        if (!hasContent)
          throw new Error(
            `Iteration ${i + 1}: popup appears empty (white screen)`,
          );

        const instanceCount = await page.evaluate(() => {
          return [
            ...document.querySelectorAll(
              '[role="dialog"][data-testid="IN_PAGE_TAB_CONTAINER"]',
            ),
          ].filter((e) => e.getBoundingClientRect().width > 0).length;
        });
        if (instanceCount !== 1)
          throw new Error(
            `Iteration ${i + 1}: expected exactly one popup, got ${instanceCount}`,
          );

        await closePortfolioPopup(page);
        await locator(page, "perps.portfolio.chart_type").waitFor({
          state: "hidden",
          timeout: 5000,
        });
        const remaining = await page
          .getByRole("dialog")
          .filter({ visible: true })
          .count();
        if (remaining !== 0)
          throw Error(
            `Iteration ${i + 1}: ${remaining} visible dialog(s) remain after close`,
          );
        if (
          await page
            .getByText("投资组合与盈亏", { exact: true })
            .filter({ visible: true })
            .count()
        )
          throw Error(
            `Iteration ${i + 1}: portfolio title remains after close`,
          );
      }
      return "3 open/close cycles OK: exact title/chart/statistics and one dialog each time, zero dialogs after close";
    });

    return t.result();
  }

  // PERPS-PNL-002: 桌面端弹窗布局 (§2)
  async function test002(page) {
    const t = createStepTracker(`${prefix}-002`);
    await ensureCleanState(page);

    let skip = false;
    await _ssStep(page, t, "切换到有资产账户", async () => {
      const result = await switchToFundedAccount(page);
      if (typeof result === "string" && result) {
        skip = true;
        return result;
      }
      if (result === false) {
        skip = true;
        return "SKIP: funded wallet not available";
      }
      await goToPerps(page);
      return "ready";
    });
    if (skip) return t.result();

    await _ssStep(page, t, "打开投资组合弹窗", async () => {
      await openPortfolioPopup(page);
      return "opened";
    });

    await _ssStep(page, t, "弹窗宽度 = 960px", async () => {
      const layout = await getPopupLayout(page);
      if (!layout) throw new Error("Cannot read popup layout");
      if (Math.abs(layout.width - 960) > 10) {
        throw new Error(`Expected width ~960px, got ${layout.width}px`);
      }
      return `width=${layout.width}px`;
    });

    await _ssStep(page, t, "双列布局且不重叠", async () => {
      const layout = await getPopupLayout(page);
      if (!layout) throw new Error("Cannot read popup layout");
      if (!layout.isDualColumn)
        throw new Error(
          `Not dual column layout. Sections: ${layout.sectionCount}`,
        );
      if (layout.hasOverlap) throw new Error("Sections overlap detected");
      return `dual column OK, ${layout.sectionCount} sections`;
    });

    await _ssStep(page, t, "标题可见", async () => {
      const layout = await getPopupLayout(page);
      if (!layout) throw new Error("Cannot read popup layout");
      if (!layout.hasCanvas) {
        const data = await getPortfolioData(page);
        if (!data || data.raw.length < 20)
          throw new Error("Popup has no meaningful content");
      }
      return `title="${layout.title || "implicit"}", hasCanvas=${layout.hasCanvas}`;
    });

    await _ssStep(page, t, "关闭按钮可用", async () => {
      await closePortfolioPopup(page);
      const visible = await isPortfolioPopupVisible(page);
      if (visible)
        throw new Error("Close button did not work - popup still visible");
      return "close button works";
    });

    await _ssStep(page, t, "内容区域不被遮挡", async () => {
      await openPortfolioPopup(page);
      const isAccessible = await page.evaluate(() => {
        const container = document.querySelector(
          '[data-testid="IN_PAGE_TAB_CONTAINER"]',
        );
        if (!container) return false;
        const r = container.getBoundingClientRect();
        const centerEl = document.elementFromPoint(
          r.x + r.width / 2,
          r.y + r.height / 2,
        );
        return container.contains(centerEl);
      });
      if (!isAccessible) throw new Error("Popup content is blocked by overlay");
      await closePortfolioPopup(page);
      return "content accessible, no overlay blocking";
    });

    return t.result();
  }

  // PERPS-PNL-003: 图表类型与时间维度 (§4)
  async function test003(page) {
    const t = createStepTracker(`${prefix}-003`);
    await ensureCleanState(page);
    await goToPerps(page);
    await openPortfolioPopup(page);
    await _ssStep(page, t, "图表与类型时间控件存在", async () => {
      const canvas = await getCanvasInfo(page);
      if (!canvas?.count) throw Error("Portfolio chart canvas missing");
      await locator(page, "perps.portfolio.chart_type").waitFor({
        state: "visible",
        timeout: 10000,
      });
      await locator(page, "perps.portfolio.time_period").waitFor({
        state: "visible",
        timeout: 10000,
      });
      return `${canvas.count} canvases; scoped controls visible`;
    });
    for (const [key, labels] of [
      ["perps.portfolio.chart_type", ["净值", "盈亏", "资金费"]],
      ["perps.portfolio.time_period", ["1天", "1周", "1月", "全部"]],
    ]) {
      for (const label of labels)
        await _ssStep(page, t, `切换${label}并验证选中态`, async () => {
          const control = locator(page, key);
          await control.getByText(label, { exact: true }).click();
          await page.waitForTimeout(500);
          const state = await control.evaluate((root, wanted) => {
            const leaves = [...root.querySelectorAll("span")].filter(
              (e) =>
                e.children.length === 0 && e.getBoundingClientRect().width > 0,
            );
            const chosen = leaves.find((e) => e.textContent.trim() === wanted);
            if (!chosen) return false;
            const color = getComputedStyle(chosen).color;
            return leaves
              .filter((e) => e !== chosen)
              .every((e) => getComputedStyle(e).color !== color);
          }, label);
          if (!state)
            throw Error(`${label} does not have distinct active text color`);
          if (!(await getCanvasInfo(page))?.count)
            throw Error("Chart disappeared after selection");
          return `已选中${label}，画布存在；不以实时图像 hash 代替选中态`;
        });
    }
    await closePortfolioPopup(page);
    return t.result();
  }

  // PERPS-PNL-004: 图表交互 Tooltip (§5)
  async function test004(page) {
    const t = createStepTracker(`${prefix}-004`);
    await ensureCleanState(page);
    let skipped = false,
      originalType,
      result;
    try {
      const ready = await _ssStep(
        page,
        t,
        "前置：有资产账户与投资组合图表",
        async () => {
          const state = await switchToFundedAccount(page);
          if (state === false || (typeof state === "string" && state)) {
            skipped = true;
            return "SKIP: " + (state || "funded wallet unavailable");
          }
          await goToPerps(page);
          await openPortfolioPopup(page);
          originalType = await activePortfolioChartType(page);
          await switchChartType(page, "净值");
          return "使用净值图表，切图失败不降级";
        },
      );
      if (!ready || skipped) {
        result = t.result();
        return result;
      }
      for (const [name, fraction] of [
        ["悬停图表中心显示 Tooltip", 0.5],
        ["悬停左边缘 Tooltip 不溢出", 0.01],
        ["悬停右边缘 Tooltip 不溢出", 0.99],
      ]) {
        await _ssStep(page, t, name, async () =>
          JSON.stringify(await hoverPortfolioChart(page, fraction, "净值")),
        );
      }
      await _ssStep(page, t, "切换图表后 Tooltip 数据语义变化", async () => {
        const before = await hoverPortfolioChart(page, 0.5, "净值");
        await switchChartType(page, "盈亏");
        const after = await hoverPortfolioChart(page, 0.5, [
          "全部",
          "合约",
          "现货",
        ]);
        if (before.label === after.label)
          throw Error("Tooltip still names the previous chart");
        return JSON.stringify({
          before,
          after,
          note: "两种曲线允许数值相同；必须显示对应图表语义和有效日期/金额",
        });
      });
      result = t.result();
      return result;
    } finally {
      try {
        await page.mouse.move(0, 0);
        if (originalType) await switchChartType(page, originalType);
        await closePortfolioPopup(page);
      } catch (error) {
        const failure = markRestoreFailure(result, error, "恢复投资组合图表");
        if (!result) throw failure;
      }
    }
  }

  // PERPS-PNL-005: 盈亏与交易统计 (§6)
  async function test005(page) {
    const t = createStepTracker(`${prefix}-005`);
    await ensureCleanState(page);

    for (const account of accounts) {
      let skipped = false;
      await _ssStep(page, t, `切换账户: ${account.label}`, async () => {
        const skipReason = await switchAccountAndOpenPortfolio(page, account);
        if (skipReason) {
          skipped = true;
          return skipReason;
        }
        await switchChartType(page, "净值");
        return `opened portfolio for ${account.label}`;
      });
      if (skipped) continue;

      await _ssStep(page, t, `[${account.label}] 读取盈亏统计`, async () => {
        const data = await getPortfolioData(page);
        if (!data) throw new Error("Cannot read portfolio data");
        assertPortfolioStats(data);

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
          if (wr < 0 || wr > 100)
            throw new Error(`Win rate out of range: ${data.winRate}`);
        }

        if (data.profitFactor && /NaN|Infinity/.test(data.profitFactor)) {
          throw new Error(`Profit factor is ${data.profitFactor}`);
        }

        return details.join(", ");
      });

      if (account.label !== "空账户") {
        await _ssStep(
          page,
          t,
          `[${account.label}] 总盈亏颜色验证`,
          async () => {
            const pnlColor = await getTotalPnLColor(page);
            return assertPnlColor(pnlColor);
          },
        );
      }

      await _ssStep(page, t, `[${account.label}] 关闭弹窗`, async () => {
        await closePortfolioPopup(page);
        return "closed";
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
        if (skipReason) {
          skipped = true;
          return skipReason;
        }
        return `opened portfolio for ${account.label}`;
      });
      if (skipped) continue;

      await _ssStep(
        page,
        t,
        `[${account.label}] 账户健康区域存在`,
        async () => {
          const data = await getPortfolioData(page);
          if (!data) throw new Error("Cannot read portfolio data");
          assertHealthFields(data);

          const details = [];
          details.push(`leverage=${data.leverage}`);
          details.push(`usedMargin=${data.usedMargin}`);
          details.push(`mmr=${data.mmr}`);
          details.push(`healthLevel=${data.healthLevel}`);
          details.push(`accountAsset=${data.accountAsset}`);
          details.push(`available=${data.available}`);

          return details.join(", ");
        },
      );

      if (account.label !== "空账户") {
        await _ssStep(
          page,
          t,
          `[${account.label}] 账户健康颜色验证`,
          async () => {
            const health = await getHealthColor(page);
            const data = await getPortfolioData(page);
            if (
              data?.leverage === "--" &&
              /^(?:--|0(?:\.0+)?%)$/.test(data?.mmr || "")
            ) {
              return "SKIP: 当前账户无持仓，健康等级不显示；字段存在性另有断言";
            }
            return assertHealthColor(health, data);
          },
        );
      }

      await _ssStep(page, t, `[${account.label}] 关闭弹窗`, async () => {
        await closePortfolioPopup(page);
        return "closed";
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
    await _ssStep(page, t, "切换到有资产账户", async () => {
      const result = await switchToFundedAccount(page);
      if (typeof result === "string" && result) {
        skip = true;
        return result;
      }
      if (result === false) {
        skip = true;
        return "SKIP: funded wallet not available";
      }
      await sleep(1000);
      await goToPerps(page);
      return "ready";
    });
    if (skip) return t.result();

    await _ssStep(page, t, "打开投资组合弹窗", async () => {
      await openPortfolioPopup(page);
      return "opened";
    });

    await _ssStep(page, t, "存款/提现按钮存在", async () => {
      const data = await getPortfolioData(page);
      if (!data) throw new Error("Cannot read portfolio data");
      if (!data.hasDepositBtn || !data.hasWithdrawBtn)
        throw Error("Deposit/withdraw buttons missing");
      return `hasDeposit=${data.hasDepositBtn}, hasWithdraw=${data.hasWithdrawBtn}`;
    });

    for (const action of ["存款", "提现"]) {
      await _ssStep(page, t, `${action}入口打开并可关闭`, async () => {
        await clickPortfolioAction(page, action);
        await unlockWalletIfNeeded(page);
        const state = await getDepositDialogState(page);
        if (!state.hasModal) throw Error(`${action} modal missing`);
        if (action === "存款" && !state.hasUsdc && !state.hasMethodChooser)
          throw Error("Deposit token/form or method chooser missing");
        await closePerpsDialogFlow(page);
        if (!(await isPortfolioPopupVisible(page)))
          await openPortfolioPopup(page);
        return `${action} modal opened and closed without submitting`;
      });
    }

    await _ssStep(page, t, "资金入口返回后上下文保持", async () => {
      const data = await getPortfolioData(page);
      if (!data) throw new Error("Cannot read portfolio after funding action");
      if (data.hasNaN) throw new Error("NaN/Infinity after funding action");
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
    await _ssStep(page, t, "切换到有资产账户", async () => {
      const result = await switchToFundedAccount(page);
      if (typeof result === "string" && result) {
        skip = true;
        return result;
      }
      if (result === false) {
        skip = true;
        return "SKIP: funded wallet not available";
      }
      await sleep(1000);
      await goToPerps(page);
      return "ready";
    });
    if (skip) return t.result();

    await _ssStep(page, t, "账户模式 selector 可见", async () => {
      const state = await getAccountModeState(page);
      if (!state.selectorText)
        throw new Error("Account mode selector text not found");
      return `selector="${state.selectorText}"`;
    });

    await _ssStep(page, t, "打开账户模式弹窗", async () => {
      await openAccountModeDialog(page);
      const state = await getAccountModeState(page);
      if (!state.hasDialog) {
        const pageText = await page.evaluate(() =>
          (document.body.innerText || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 500),
        );
        if (/账户不支持|不支持|观察|Watch|unsupported/i.test(pageText)) {
          return `SKIP: watch/unsupported account blocked account mode change: ${pageText.slice(0, 180)}`;
        }
        throw Error(
          `Account mode selector did not open dialog: ${state.selectorText}`,
        );
      }
      if (!/统一|组合|Unified|Portfolio/.test(state.dialogText)) {
        throw new Error(
          `Account mode dialog content missing options: ${state.dialogText}`,
        );
      }
      if (state.needsEnable && !state.confirmVisible)
        return "账户模式弹窗与选项可见；当前账户显示启用交易入口，已验证门禁，不提交启用或模式变更";
      if (!state.confirmVisible)
        throw new Error("Account mode confirm button not visible");
      return state.dialogText.slice(0, 180);
    });

    await _ssStep(page, t, "关闭账户模式弹窗", async () => {
      const res = await closePerpsDialogFlow(page);
      if (res.stillVisible)
        throw new Error("Account mode dialog still visible after close");
      return `closed by ${res.closedByDom || "keyboard"}`;
    });

    return t.result();
  }

  // PERPS-PNL-010: 交易页现货持仓/订单面板保留
  async function test010(page) {
    const t = createStepTracker(`${prefix}-010`);
    await ensureCleanState(page);
    await goToPerps(page);
    await _ssStep(page, t, "持有币种 Tab 与内容可见", async () => {
      const tab = locator(page, "perps.info.balances");
      await tab.click();
      await locator(page, "perps.holdings.hide_small").waitFor({
        state: "visible",
        timeout: 5000,
      });
      const panel = locator(page, "perps.info.tabs")
        .locator("..")
        .locator("..");
      await page.waitForTimeout(800);
      const text = await panel.innerText();
      if (!/USDC|资产|余额|暂无数据|No data|Deposit/.test(text))
        throw Error("Holdings data or explicit empty state missing");
      return text.slice(0, 180);
    });
    return t.result();
  }

  async function test011(page) {
    const t = createStepTracker(`${prefix}-011`);
    await ensureCleanState(page);
    await cleanupExternalFixedForms(page);
    let previousNetwork;
    try {
      const ready = await _ssStep(
        page,
        t,
        "前置：钱包首页切换 Ethereum 网络",
        async () => {
          await clickSidebarTab(page, "Wallet");
          await unlockWalletIfNeeded(page);
          const network = locator(page, "wallet.network.selector.text");
          await network.waitFor({ state: "visible", timeout: 10000 });
          previousNetwork = (await network.innerText()).trim();
          if (!previousNetwork)
            throw Error("Cannot record current single network for restoration");
          await switchNetwork(page, "Ethereum");
          await unlockWalletIfNeeded(page);
          await locator(page, "perps.home.tab").waitFor({
            state: "visible",
            timeout: 15000,
          });
          return `原网络=${previousNetwork}；Ethereum 已选中，首页合约 Tab 可见`;
        },
      );
      if (ready)
        await _ssStep(page, t, "钱包首页合约 Tab 与资产区域", async () => {
          await locator(page, "perps.home.tab").click();
          const state = await getHomePerpsState(page);
          return `visible controls: ${state.visibleTestIds.join(", ")}`;
        });
    } finally {
      if (previousNetwork)
        await _ssStep(page, t, "恢复钱包首页原网络", async () => {
          await clickSidebarTab(page, "Wallet");
          await unlockWalletIfNeeded(page);
          await switchNetwork(page, previousNetwork);
          return `已恢复 ${previousNetwork}`;
        });
    }
    return t.result();
  }

  // PERPS-PNL-008: DashText 与提示组件 (§10)
  async function test008(page) {
    const t = createStepTracker(`${prefix}-008`);
    await ensureCleanState(page);
    let skipped = false,
      originalType,
      result;
    try {
      const ready = await _ssStep(
        page,
        t,
        "切换到有资产账户并打开弹窗",
        async () => {
          const state = await switchToFundedAccount(page);
          if (state === false || (typeof state === "string" && state)) {
            skipped = true;
            return "SKIP: " + (state || "funded wallet unavailable");
          }
          await goToPerps(page);
          await openPortfolioPopup(page);
          originalType = await activePortfolioChartType(page);
          await switchChartType(page, "净值");
          return "ready";
        },
      );
      if (!ready || skipped) {
        result = t.result();
        return result;
      }
      await _ssStep(page, t, "悬停必需统计项逐个触发可读 Tooltip", async () => {
        const tooltips = [];
        for (const label of ["总盈亏", "胜率", "盈利因子"])
          tooltips.push(await hoverPortfolioStatistic(page, label));
        if (tooltips.length !== 3)
          throw Error("Required statistic Tooltip missing");
        return JSON.stringify(tooltips);
      });
      result = t.result();
      return result;
    } finally {
      try {
        await page.mouse.move(0, 0);
        if (originalType) await switchChartType(page, originalType);
        await closePortfolioPopup(page);
      } catch (error) {
        const failure = markRestoreFailure(
          result,
          error,
          "恢复投资组合提示测试状态",
        );
        if (!result) throw failure;
      }
    }
  }

  async function test012(page) {
    const t = createStepTracker(`${prefix}-012`);
    await cleanupExternalFixedForms(page);
    await goToPerps(page);
    await _ssStep(page, t, "菜单进入偏好设置与碎币开关只读检查", async () => {
      await closePairs(page);
      await locator(page, "perps.settings.button").click();
      if (await locator(page, "perps.menu.preferences").count())
        await locator(page, "perps.menu.preferences").click();
      const dust = locator(page, "perps.settings.dust");
      await dust.waitFor({ state: "visible", timeout: 10000 });
      const checked = await dust.getAttribute("aria-checked");
      if (!["true", "false"].includes(checked))
        throw Error(`Dust switch missing boolean state: ${checked}`);
      const disabled = await dust.getAttribute("aria-disabled");
      return `checked=${checked}, disabled=${disabled}; 未修改服务端设置；optOut 对账另列补测`;
    });
    await _ssStep(page, t, "返回菜单首页", async () => {
      if (await locator(page, "perps.menu.back").count()) {
        await locator(page, "perps.menu.back").click();
        await locator(page, "perps.menu.preferences").waitFor({
          state: "visible",
          timeout: 5000,
        });
      }
      await page.keyboard.press("Escape");
      return "偏好设置返回首页，保留原开关值";
    });
    return t.result();
  }

  async function test013(page) {
    const t = createStepTracker(`${prefix}-013`);
    await cleanupExternalFixedForms(page);
    await goToPerps(page);
    const trigger = locator(page, "perps.history.type_filter");
    await _ssStep(page, t, "历史成交类型筛选可交互", async () => {
      await locator(page, "perps.history.tab").click();
      for (const type of ["spot", "perp", "all"]) {
        await trigger.click();
        const option = locator(page, `perps.history.type_${type}`);
        const label = await option.innerText();
        await option.click();
        await page.waitForTimeout(200);
        if (
          type !== "all" &&
          !(await trigger.innerText()).includes(label.trim())
        )
          throw Error(`Type selection not applied: ${type}`);
      }
      return "现货、永续、全部控制可用；成交数据与筛选交集另需有样本账户对账";
    });
    return t.result();
  }

  // ── Registry ──────────────────────────────────────────────

  const testCases = [
    {
      id: `${prefix}-001`,
      name: `${namePrefix}Perps-PnL-入口与路由`,
      fn: test001,
    },
    {
      id: `${prefix}-002`,
      name: `${namePrefix}Perps-PnL-弹窗布局`,
      fn: test002,
    },
    {
      id: `${prefix}-003`,
      name: `${namePrefix}Perps-PnL-图表类型与时间维度`,
      fn: test003,
    },
    {
      id: `${prefix}-004`,
      name: `${namePrefix}Perps-PnL-图表交互 Tooltip`,
      fn: test004,
    },
    {
      id: `${prefix}-005`,
      name: `${namePrefix}Perps-PnL-盈亏与交易统计`,
      fn: test005,
    },
    {
      id: `${prefix}-006`,
      name: `${namePrefix}Perps-PnL-账户健康与风险等级`,
      fn: test006,
    },
    {
      id: `${prefix}-007`,
      name: `${namePrefix}Perps-PnL-资金动作与返回`,
      fn: test007,
    },
    {
      id: `${prefix}-008`,
      name: `${namePrefix}Perps-PnL-DashText 与提示组件`,
      fn: test008,
    },
    {
      id: `${prefix}-009`,
      name: `${namePrefix}Perps-账户模式选择器`,
      fn: test009,
    },
    {
      id: `${prefix}-010`,
      name: `${namePrefix}Perps-交易页现货持仓展示`,
      fn: test010,
    },
    {
      id: `${prefix}-011`,
      name: `${namePrefix}Perps-Home Perps 资产展示`,
      fn: test011,
    },
    {
      id: `${prefix}-012`,
      name: `${namePrefix}Perps-新版菜单与碎币设置只读检查`,
      fn: test012,
    },
    {
      id: `${prefix}-013`,
      name: `${namePrefix}Perps-历史成交类型筛选控件`,
      fn: test013,
    },
  ];

  const ALL_TEST_IDS = testCases.map((tc) => tc.id);

  for (const tc of testCases) {
    const run = tc.fn;
    tc.fn = async (page) => {
      page.setDefaultTimeout(15000);
      let result;
      try {
        result = await run(page);
        if (
          !result.summary.passed &&
          result.summary.skipped &&
          !result.summary.failed
        )
          result.status = "skipped";
        return result;
      } finally {
        try {
          await cleanupExternalFixedForms(page);
        } catch (error) {
          const failure = markRestoreFailure(
            result,
            error,
            "恢复投资组合外层弹窗",
          );
          if (!result) throw failure;
        }
      }
    };
  }

  let _preReport = null;
  async function setup(page) {
    await goToPerps(page);
    await sleep(2000);
    _preReport ??= await runPreconditions(
      page,
      testCases.map((tc) => tc.id),
    );
    if (!_preReport.canRun) throw new Error("Perps 前置检查未通过");
    return _preReport;
  }

  return { testCases, setup, ALL_TEST_IDS };
}
