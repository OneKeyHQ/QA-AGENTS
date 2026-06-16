// Desktop TF Nightly - Portfolio all networks and create address
// Test IDs: NIGHTLY-PORTFOLIO-001
// Source checklist:
// docs/qa/testcases/cases/utility/2026-06-04_通用-Desktop-TF-Nightly主流程巡检.md
//
// Coverage mapping:
// - Section 7 "投资组合切换到所有网络" -> select all networks and assert all-networks state.
// - Section 7 "创建地址" -> compare account state before/after and assert new account selected.
// - Section 7 "新建地址后的多链地址校验" -> assert BTC/EVM/Solana/Tron default address set.
// - Section 7 "新建地址后的多 tab 展示" and "更多菜单" -> assert tab/menu UI remains usable.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR, WALLET_PASSWORD,
  closeAllModals, dismissOverlays, goToWalletHome, unlockWalletIfNeeded,
  ensurePrimarySoftwareWallet,
} from '../../helpers/index.mjs';
import { createStepTracker, safeStep } from '../../helpers/components.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'nightly-portfolio-all-networks-create-address');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const TEST_ID = 'NIGHTLY-PORTFOLIO-001';
const ADDRESS_INVALID_RE = /(?:^|[\s:：])(--|loading|加载中|创建失败|地址创建失败|未创建地址|加载失败|Unable to create address|Cannot create address)(?:$|\s)/i;
const ANY_ADDRESS_RE = /(?:0x[a-fA-F0-9]{8,}(?:(?:\.{3}|…)[a-fA-F0-9]{4,})?|[13bc][A-Za-z0-9]{6,}(?:\.{3}|…)[A-Za-z0-9]{4,}|T[A-Za-z0-9]{6,}(?:\.{3}|…)[A-Za-z0-9]{4,}|[1-9A-HJ-NP-Za-km-z]{8,}(?:\.{3}|…)[1-9A-HJ-NP-Za-km-z]{4,})/;

const REQUIRED_ADDRESS_SPECS = [
  { key: 'btcLegacy', label: 'Bitcoin Legacy', labelRe: /Bitcoin\s+Legacy/i, addressRe: ANY_ADDRESS_RE },
  { key: 'evm', label: 'Ethereum/EVM BIP44', labelRe: /(?:Ethereum|EVM)/i, addressRe: /0x[a-fA-F0-9]{4,}(?:(?:\.{3}|…)[a-fA-F0-9]{4,}|[a-fA-F0-9]{4,})/ },
  { key: 'solana', label: 'Solana BIP44', labelRe: /Solana/i, addressRe: ANY_ADDRESS_RE },
  { key: 'tron', label: 'Tron', labelRe: /Tron/i, addressRe: /T[A-Za-z0-9]{6,}(?:(?:\.{3}|…)[A-Za-z0-9]{4,}|[A-Za-z0-9]{4,})/ },
  { key: 'ton', label: 'TON', labelRe: /\bTON\b/i, addressRe: ANY_ADDRESS_RE },
  { key: 'xrp', label: 'XRP Ledger', labelRe: /XRP\s+Ledger/i, addressRe: /r[A-Za-z0-9]{6,}(?:(?:\.{3}|…)[A-Za-z0-9]{4,}|[A-Za-z0-9]{4,})/ },
];
const MAX_ADDRESS_CREATE_ATTEMPTS = 140;

export const displayName = 'Nightly 投资组合创建地址';
export const categoryTitle = '通用巡检';

let _preReport = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

async function waitForVisibleTestId(page, testid, timeout = 10000) {
  const locator = page.locator(`[data-testid="${testid}"]:visible`).first();
  await locator.waitFor({ state: 'visible', timeout });
  return locator;
}

async function clickVisibleTestId(page, testid, delay = 600) {
  const locator = await waitForVisibleTestId(page, testid);
  await locator.click();
  await sleep(delay);
}

async function clickHomeTestIdWithOverlayFallback(page, testid, delay = 600) {
  await dismissBlockingOvelayPopover(page);
  try {
    await clickVisibleTestId(page, testid, delay);
  } catch (error) {
    if (!/intercepts pointer events|Timeout/i.test(error.message || '')) throw error;
    const clicked = await page.evaluate((id) => {
      const target = document.querySelector(`[data-testid="${id}"]`);
      if (!target) return false;
      target.click();
      return true;
    }, testid);
    assert(clicked, `${testid} not found for JS click fallback`);
    await sleep(delay);
  }
}

async function waitUntil(label, fn, { timeout = 15000, interval = 500 } = {}) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeout) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(interval);
  }
  throw new Error(`${label} timed out${lastError ? `: ${lastError.message}` : ''}`);
}

async function readVisibleText(page) {
  return normalizeText(await page.evaluate(() => document.body?.innerText || ''));
}

async function assertNoGlobalErrors(page) {
  const text = await readVisibleText(page);
  const errors = ['创建失败', '地址创建失败', '未创建地址', '加载失败', 'Cannot create address', 'Unable to create address'];
  const matched = errors.filter(item => text.includes(item));
  assert(matched.length === 0, `global error shown: ${matched.join(', ')}`);
}

async function dismissBlockingOvelayPopover(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(150);
  for (let i = 0; i < 3; i++) {
    const box = await page.evaluate(() => {
      const overlay = document.querySelector('[data-testid="ovelay-popover"]');
      const r = overlay?.getBoundingClientRect?.();
      if (!r || r.width <= 0 || r.height <= 0) return null;
      overlay.click();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }).catch(() => null);
    if (!box) return;
    await page.mouse.click(box.x + Math.min(24, box.width - 1), box.y + Math.min(24, box.height - 1)).catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(300);
  }
}

async function isWalletHomeReady(page) {
  return page.evaluate(() => {
    const visible = (selector) => {
      const el = document.querySelector(selector);
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0;
    };
    return visible('[data-testid="home-page"]') &&
      visible('[data-testid="AccountSelectorTriggerBase"]') &&
      visible('[data-testid="home-tab-portfolio"]') &&
      visible('[data-testid="account-selector-copy-address-btn"]');
  });
}

async function ensureWalletHome(page) {
  await closeAllModals(page).catch(() => {});
  await dismissOverlays(page).catch(() => {});
  if (await isWalletHomeReady(page)) return;

  await goToWalletHome(page).catch(async () => {
    await page.evaluate(() => {
      const home = document.querySelector('[data-testid="home"]');
      if (home) home.click();
    });
    await sleep(1800);
  });
  assert(await isWalletHomeReady(page), 'wallet home page not ready after navigation');
  await waitForVisibleTestId(page, 'AccountSelectorTriggerBase', 10000);
}

async function readSelectedAccountName(page) {
  return normalizeText(await page.locator('[data-testid="AccountSelectorTriggerBase"]').first().innerText({ timeout: 5000 }));
}

async function openAccountSelector(page) {
  await dismissOverlays(page).catch(() => {});
  await clickHomeTestIdWithOverlayFallback(page, 'AccountSelectorTriggerBase', 900);
  await waitForVisibleTestId(page, 'account-add-account', 10000);
}

async function closeTopModalByMouse(page) {
  for (let i = 0; i < 4; i++) {
    const modalBox = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      const rect = modal?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return null;
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    if (!modalBox) return;
    await page.mouse.click(modalBox.x + modalBox.width + 24, modalBox.y + 24).catch(() => {});
    await sleep(500);
  }
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(500);
}

async function collectAccountSelectorState(page) {
  return page.evaluate(async () => {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const isVisible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0;
    };
    const addButton = document.querySelector('[data-testid="account-add-account"]');
    const scrollables = Array.from(document.querySelectorAll('div')).filter((el) => {
      const r = el.getBoundingClientRect();
      return isVisible(el) && el.scrollHeight > el.clientHeight + 80 && r.height > 180 && r.width > 250;
    });
    const root = scrollables.find(el => el.contains(addButton)) || scrollables.at(-1) || document.scrollingElement;
    const accountNames = new Set();
    const snapshots = [];
    const collect = () => {
      const text = normalize(document.body.innerText);
      snapshots.push(text.slice(0, 800));
      for (const match of text.matchAll(/\bAccount\s+#(\d+)\b/g)) {
        accountNames.add(`Account #${match[1]}`);
      }
    };
    const maxScroll = Math.max(0, (root?.scrollHeight || 0) - (root?.clientHeight || 0));
    const positions = maxScroll > 0
      ? [0, Math.round(maxScroll * 0.25), Math.round(maxScroll * 0.5), Math.round(maxScroll * 0.75), maxScroll]
      : [0];
    for (const top of positions) {
      if (root) root.scrollTop = top;
      await sleep(250);
      collect();
    }
    if (root) root.scrollTop = 0;
    const numbers = Array.from(accountNames)
      .map(name => Number(name.match(/#(\d+)/)?.[1] || 0))
      .filter(Boolean)
      .sort((a, b) => a - b);
    return {
      accountNames: Array.from(accountNames).sort(),
      accountNumbers: numbers,
      maxAccountNumber: numbers.length ? Math.max(...numbers) : null,
      snapshotCount: snapshots.length,
      sawAddButton: !!addButton,
    };
  });
}

async function selectAllNetworks(page) {
  const networkTrigger = page.locator('[data-testid="account-network-trigger-button"]').first();
  const hasNetworkTrigger = await networkTrigger.isVisible({ timeout: 2500 }).catch(() => false);
  if (hasNetworkTrigger) {
    await clickVisibleTestId(page, 'account-network-trigger-button', 1000);
  } else {
    const candidates = await page.evaluate(() => {
      const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const isVisible = (el) => {
        const r = el?.getBoundingClientRect?.();
        return !!r && r.width > 0 && r.height > 0;
      };
      const account = document.querySelector('[data-testid="AccountSelectorTriggerBase"]');
      const copy = document.querySelector('[data-testid="account-selector-copy-address-btn"]');
      const accountRect = account?.getBoundingClientRect?.();
      const copyRect = copy?.getBoundingClientRect?.();
      const candidates = Array.from(document.querySelectorAll('span, div, button, [role="button"]'))
        .filter(isVisible)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { el, r, text: normalize(el.innerText || el.textContent) };
        })
        .filter(({ r, text }) => {
          if (!/^\+\d+$/.test(text)) return false;
          if (accountRect && r.x <= accountRect.x + accountRect.width) return false;
          if (copyRect && r.x >= copyRect.x - 8) return false;
          return r.y >= 40 && r.y <= 120 && r.width <= 120 && r.height <= 40;
        })
        .sort((a, b) => a.r.x - b.r.x || b.r.width - a.r.width)
        .map(({ r, text }) => ({
          text,
          x: Math.round(r.x + r.width / 2),
          y: Math.round(r.y + r.height / 2),
          width: Math.round(r.width),
          height: Math.round(r.height),
        }));
      return candidates;
    });
    assert(candidates.length > 0, 'portfolio +N network trigger not found');
    let opened = false;
    for (const candidate of candidates.slice(0, 4)) {
      await page.mouse.click(candidate.x, candidate.y);
      await sleep(900);
      opened = await page.locator('[data-testid="APP-Modal-Screen"]:visible').first()
        .isVisible({ timeout: 500 })
        .catch(() => false);
      if (opened) break;
    }
    assert(opened, `portfolio +N network trigger did not open selector; tried ${candidates.map(item => `${item.text}@${item.x},${item.y}`).join(' | ')}`);
  }

  const toggleAlreadyVisible = await page.locator('[data-testid="chain-selector-all-networks-toggle-all-btn"]:visible').first()
    .isVisible({ timeout: 800 })
    .catch(() => false);
  if (!toggleAlreadyVisible) {
    const portfolioTab = await page.evaluate(() => {
      const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const isVisible = (el) => {
        const r = el?.getBoundingClientRect?.();
        return !!r && r.width > 0 && r.height > 0;
      };
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      const candidates = Array.from(modal?.querySelectorAll('span, div, button, [role="button"]') || [])
        .filter(isVisible)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { text: normalize(el.innerText || el.textContent), r };
        })
        .filter(({ text, r }) => text === '投资组合' && r.y >= 50 && r.y <= 120 && r.width <= 120 && r.height <= 40)
        .sort((a, b) => b.r.width - a.r.width)[0];
      if (!candidates) return null;
      return {
        x: Math.round(candidates.r.x + candidates.r.width / 2),
        y: Math.round(candidates.r.y + candidates.r.height / 2),
        text: candidates.text,
      };
    });
    assert(portfolioTab, 'network selector portfolio tab not found');
    await page.mouse.click(portfolioTab.x, portfolioTab.y);
    await sleep(800);
  }

  await waitForVisibleTestId(page, 'chain-selector-all-networks-toggle-all-btn', 10000);

  const readToggleText = async () => normalizeText(await page.locator('[data-testid="chain-selector-all-networks-toggle-all-btn"]:visible').first().innerText());
  const initial = await readToggleText();
  if (!/取消全选/.test(initial)) {
    assert(/全选/.test(initial), `unexpected all networks toggle text: "${initial}"`);
    await clickVisibleTestId(page, 'chain-selector-all-networks-toggle-all-btn', 600);
  }
  const finalToggle = await readToggleText();
  assert(/取消全选/.test(finalToggle), `all networks not selected, toggle="${finalToggle}"`);

  await clickVisibleTestId(page, 'page-footer-confirm', 1200);
  await waitUntil('network modal close', async () => !(await page.locator('[data-testid="APP-Modal-Screen"]:visible').first().isVisible({ timeout: 500 }).catch(() => false)));

  const networkText = await page.locator('[data-testid="account-network-trigger-button"]:visible').first().innerText({ timeout: 5000 }).catch(() => '');
  const bodyText = await readVisibleText(page);
  const portfolioState = await page.evaluate(() => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const isVisible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0;
    };
    const account = document.querySelector('[data-testid="AccountSelectorTriggerBase"]');
    const copy = document.querySelector('[data-testid="account-selector-copy-address-btn"]');
    const accountRect = account?.getBoundingClientRect?.();
    const copyRect = copy?.getBoundingClientRect?.();
    const plus = Array.from(document.querySelectorAll('span, div'))
      .filter(isVisible)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { text: normalize(el.innerText || el.textContent), r };
      })
      .find(({ text, r }) => {
        if (!/^\+\d+$/.test(text)) return false;
        if (accountRect && r.x <= accountRect.x + accountRect.width) return false;
        if (copyRect && r.x >= copyRect.x - 8) return false;
        return r.y >= 40 && r.y <= 120;
      });
    return {
      hasSingleNetworkTrigger: isVisible(document.querySelector('[data-testid="account-network-trigger-button"]')),
      plusText: plus?.text || '',
      hasDefiTab: isVisible(document.querySelector('[data-testid="home-tab-defi"]')),
      hasNftTab: isVisible(document.querySelector('[data-testid="home-tab-nft"]')),
      hasHistoryTab: isVisible(document.querySelector('[data-testid="home-tab-history"]')),
    };
  });
  const hasAllNetworksText = /投资组合|All Networks|全部网络/i.test(`${networkText} ${bodyText}`);
  const hasPortfolioStructure =
    !portfolioState.hasSingleNetworkTrigger &&
    /^\+\d+$/.test(portfolioState.plusText) &&
    portfolioState.hasDefiTab &&
    portfolioState.hasNftTab &&
    portfolioState.hasHistoryTab;
  assert(
    hasAllNetworksText || hasPortfolioStructure,
    `home is not in all-networks portfolio mode: network="${normalizeText(networkText)}"; state=${JSON.stringify(portfolioState)}`,
  );
  await assertNoGlobalErrors(page);
  return `toggle=${finalToggle}; network=${normalizeText(networkText) || portfolioState.plusText || 'portfolio text visible'}`;
}

async function fillPasswordAndVerify(page) {
  const input = page.locator('[data-testid="password-input"], input[placeholder*="密码"], input[type="password"]').first();
  await input.waitFor({ state: 'visible', timeout: 10000 });
  await input.click();
  await page.evaluate(() => {
    const inputEl = document.querySelector('[data-testid="password-input"], input[placeholder*="密码"], input[type="password"]');
    if (inputEl) {
      inputEl.focus();
      inputEl.select?.();
    }
  });
  await page.keyboard.press('Backspace');
  await input.pressSequentially(WALLET_PASSWORD, { delay: 35 });
  await clickVisibleTestId(page, 'verifying-password', 1000);
}

async function clickFooterButtonByText(page, textRe, timeout = 30000) {
  const button = await waitUntil(`footer button ${textRe}`, async () => findVisibleFooterButtonByText(page, textRe), { timeout, interval: 700 });
  await page.mouse.click(button.x, button.y);
  await sleep(1200);
}

async function findVisibleFooterButtonByText(page, textRe) {
  const handles = await page.locator('[data-testid="page-footer-confirm"]:visible').elementHandles();
  for (const handle of handles) {
    const data = await handle.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        text: el.textContent || '',
        visible: r.width > 0 && r.height > 0,
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
      };
    });
    if (data.visible && textRe.test(normalizeText(data.text))) {
      return {
        text: normalizeText(data.text),
        x: Math.round(data.x),
        y: Math.round(data.y),
      };
    }
  }
  return null;
}

async function openPortfolioNetworkSelectorForCreateAddress(page) {
  const alreadyOpen = await page.locator('[data-testid="APP-Modal-Screen"]:visible').first()
    .isVisible({ timeout: 500 })
    .catch(() => false);
  const portfolioVisible = await page.locator('[data-testid="chain-selector-all-networks-toggle-all-btn"]:visible').first()
    .isVisible({ timeout: 500 })
    .catch(() => false);
  if (alreadyOpen && portfolioVisible) return;

  if (!alreadyOpen) {
    const singleNetworkTrigger = await page.locator('[data-testid="account-network-trigger-button"]:visible').first()
      .isVisible({ timeout: 1500 })
      .catch(() => false);
    if (singleNetworkTrigger) {
      await clickVisibleTestId(page, 'account-network-trigger-button', 900);
    } else {
      const candidates = await page.evaluate(() => {
        const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
        const isVisible = (el) => {
          const r = el?.getBoundingClientRect?.();
          return !!r && r.width > 0 && r.height > 0;
        };
        const account = document.querySelector('[data-testid="AccountSelectorTriggerBase"]');
        const copy = document.querySelector('[data-testid="account-selector-copy-address-btn"]');
        const accountRect = account?.getBoundingClientRect?.();
        const copyRect = copy?.getBoundingClientRect?.();
        return Array.from(document.querySelectorAll('span, div, button, [role="button"]'))
          .filter(isVisible)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { text: normalize(el.innerText || el.textContent), r };
          })
          .filter(({ text, r }) => {
            if (!/^\+\d+$/.test(text)) return false;
            if (accountRect && r.x <= accountRect.x + accountRect.width) return false;
            if (copyRect && r.x >= copyRect.x - 8) return false;
            return r.y >= 40 && r.y <= 120 && r.width <= 120 && r.height <= 40;
          })
          .sort((a, b) => a.r.x - b.r.x || b.r.width - a.r.width)
          .map(({ text, r }) => ({
            text,
            x: Math.round(r.x + r.width / 2),
            y: Math.round(r.y + r.height / 2),
          }));
      });
      assert(candidates.length > 0, 'portfolio +N network trigger not found for create-address apply');
      let opened = false;
      for (const candidate of candidates.slice(0, 4)) {
        await page.mouse.click(candidate.x, candidate.y);
        await sleep(900);
        opened = await page.locator('[data-testid="APP-Modal-Screen"]:visible').first()
          .isVisible({ timeout: 500 })
          .catch(() => false);
        if (opened) break;
      }
      assert(opened, `portfolio +N network trigger did not open selector for create-address apply; tried ${candidates.map(item => `${item.text}@${item.x},${item.y}`).join(' | ')}`);
    }
  }

  const toggleVisible = await page.locator('[data-testid="chain-selector-all-networks-toggle-all-btn"]:visible').first()
    .isVisible({ timeout: 800 })
    .catch(() => false);
  if (!toggleVisible) {
    const portfolioTab = await page.evaluate(() => {
      const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const isVisible = (el) => {
        const r = el?.getBoundingClientRect?.();
        return !!r && r.width > 0 && r.height > 0;
      };
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      const target = Array.from(modal?.querySelectorAll('span, div, button, [role="button"]') || [])
        .filter(isVisible)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { text: normalize(el.innerText || el.textContent), r };
        })
        .filter(({ text, r }) => text === '投资组合' && r.y >= 50 && r.y <= 120 && r.width <= 120 && r.height <= 40)
        .sort((a, b) => b.r.width - a.r.width)[0];
      if (!target) return null;
      return { x: Math.round(target.r.x + target.r.width / 2), y: Math.round(target.r.y + target.r.height / 2) };
    });
    assert(portfolioTab, 'network selector portfolio tab not found for create-address apply');
    await page.mouse.click(portfolioTab.x, portfolioTab.y);
    await sleep(900);
  }

  await waitForVisibleTestId(page, 'chain-selector-all-networks-toggle-all-btn', 10000);
}

async function applyMissingAddressesFromNetworkSelector(page) {
  await closeAllModals(page).catch(() => {});
  await ensureWalletHome(page);
  await openPortfolioNetworkSelectorForCreateAddress(page);

  const toggleText = normalizeText(await page.locator('[data-testid="chain-selector-all-networks-toggle-all-btn"]:visible').first().innerText());
  if (!/取消全选/.test(toggleText)) {
    await clickVisibleTestId(page, 'chain-selector-all-networks-toggle-all-btn', 600);
    const afterToggle = normalizeText(await page.locator('[data-testid="chain-selector-all-networks-toggle-all-btn"]:visible').first().innerText());
    assert(/取消全选/.test(afterToggle), `all networks not selected before create-address apply, toggle="${afterToggle}"`);
  }

  const modalText = normalizeText(await page.locator('[data-testid="APP-Modal-Screen"]:visible').first().innerText({ timeout: 3000 }).catch(() => ''));
  const missingCount = Number(modalText.match(/当前账户在\s*(\d+)\s*个网络中缺少地址/)?.[1] || 0);
  const clickedApply = await clickFooterButtonByTextIfPresent(page, /创建地址\s*&\s*应用|Create Address/i, 5000);
  if (!clickedApply) {
    await clickFooterButtonByTextIfPresent(page, /完成|Done/i, 5000);
    await waitUntil('network modal close after no missing addresses', async () => !(await page.locator('[data-testid="APP-Modal-Screen"]:visible').first().isVisible({ timeout: 500 }).catch(() => false)), { timeout: 10000, interval: 500 }).catch(() => {});
    return `no missing network-address apply button; missingText=${missingCount || 'none'}`;
  }

  if (await isPasswordPromptVisible(page)) {
    await fillPasswordAndVerify(page);
  }
  await clickFooterButtonByTextIfPresent(page, /创建地址\s*&\s*应用|Create Address/i, 8000);
  await clickFooterButtonByTextIfPresent(page, /完成|Done/i, 15000);
  await waitUntil('network create-address apply modal close', async () => !(await page.locator('[data-testid="APP-Modal-Screen"]:visible').first().isVisible({ timeout: 500 }).catch(() => false)), { timeout: 30000, interval: 700 }).catch(async () => {
    await closeTopModalByMouse(page);
  });
  await assertNoGlobalErrors(page);
  return `network selector create-address apply clicked; missingBefore=${missingCount || 'unknown'}`;
}

async function clickFooterButtonByTextIfPresent(page, textRe, timeout = 3000) {
  const button = await waitUntil(`optional footer button ${textRe}`, async () => findVisibleFooterButtonByText(page, textRe), {
    timeout,
    interval: 500,
  }).catch(() => null);
  if (!button) return false;
  await page.mouse.click(button.x, button.y);
  await sleep(1000);
  return true;
}

async function isPasswordPromptVisible(page) {
  return page.locator('[data-testid="password-input"], input[placeholder*="密码"], input[type="password"]').first()
    .isVisible({ timeout: 300 })
    .catch(() => false);
}

async function readNewSelectedAccount(page, beforeState) {
  const name = await readSelectedAccountName(page).catch(() => '');
  const match = name.match(/\bAccount\s+#(\d+)\b/);
  if (!match) return null;
  const number = Number(match[1]);
  if (beforeState.maxAccountNumber == null || number > beforeState.maxAccountNumber || name !== beforeState.selectedName) {
    return { name, number };
  }
  return null;
}

async function waitForNewAccountOrApplyButton(page, beforeState) {
  return waitUntil('new account selected or create-address apply button', async () => {
    const newAccount = await readNewSelectedAccount(page, beforeState);
    if (newAccount) return { type: 'created', account: newAccount };
    const applyButton = await findVisibleFooterButtonByText(page, /创建地址\s*&\s*应用|Create Address/i);
    if (applyButton) return { type: 'needsApply', button: applyButton };
    return null;
  }, { timeout: 45000, interval: 700 });
}

async function waitForCreateAddressGate(page, beforeState) {
  return waitUntil('new account, password prompt, or create-address apply button', async () => {
    const newAccount = await readNewSelectedAccount(page, beforeState);
    if (newAccount) return { type: 'created', account: newAccount };

    const passwordVisible = await page.locator('[data-testid="password-input"], input[placeholder*="密码"], input[type="password"]').first()
      .isVisible({ timeout: 300 })
      .catch(() => false);
    if (passwordVisible) return { type: 'needsPassword' };

    const applyButton = await findVisibleFooterButtonByText(page, /创建地址\s*&\s*应用|Create Address/i);
    if (applyButton) return { type: 'needsApply', button: applyButton };

    return null;
  }, { timeout: 45000, interval: 700 });
}

async function createAddressAndAssertSelected(page, beforeState) {
  await clickVisibleTestId(page, 'account-add-account', 1000);
  let firstResult = await waitForCreateAddressGate(page, beforeState);
  if (firstResult.type === 'needsPassword') {
    await fillPasswordAndVerify(page);
    firstResult = await waitForNewAccountOrApplyButton(page, beforeState);
  }
  if (firstResult.type === 'needsApply') {
    await page.mouse.click(firstResult.button.x, firstResult.button.y);
    await sleep(1200);
  }
  await clickFooterButtonByTextIfPresent(page, /完成|Done/i, 8000);

  const afterName = firstResult.type === 'created'
    ? firstResult.account
    : await waitUntil('new account selected', async () => readNewSelectedAccount(page, beforeState), { timeout: 30000, interval: 800 });

  await openAccountSelector(page);
  const afterSelectorState = await collectAccountSelectorState(page);
  const existsInSelector = afterSelectorState.accountNumbers.includes(afterName.number);
  await closeTopModalByMouse(page);
  assert(existsInSelector, `${afterName.name} not found in account selector after creation`);
  await assertNoGlobalErrors(page);

  return {
    selectedName: afterName.name,
    selectedNumber: afterName.number,
    beforeMax: beforeState.maxAccountNumber,
    afterMax: afterSelectorState.maxAccountNumber,
  };
}

async function collectAddressModalEvidence(page) {
  return page.evaluate(async () => {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const isVisible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0;
    };
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return { text: '', rows: [], copyTargetCount: 0, snapshots: [] };
    const scrollables = Array.from(modal.querySelectorAll('div')).filter((el) => {
      const r = el.getBoundingClientRect();
      return isVisible(el) && el.scrollHeight > el.clientHeight + 50 && r.height > 120 && r.width > 240;
    });
    const root = scrollables.at(-1) || modal;
    const snapshots = [];
    const rowTexts = new Set();
    const createAddressRows = new Set();
    const collect = () => {
      const modalText = normalize(modal.innerText);
      snapshots.push(modalText);
      for (const el of modal.querySelectorAll('div, button, [role="button"]')) {
        if (!isVisible(el)) continue;
        const text = normalize(el.innerText || el.textContent);
        if (text.length < 8 || text.length > 260) continue;
        if (/(Bitcoin|Ethereum|EVM|Solana|Tron|SegWit|Taproot)/i.test(text)) rowTexts.add(text);
        if (text.includes('创建地址')) createAddressRows.add(text);
      }
    };
    const maxScroll = Math.max(0, (root.scrollHeight || 0) - (root.clientHeight || 0));
    const positions = maxScroll > 0
      ? [0, Math.round(maxScroll * 0.2), Math.round(maxScroll * 0.4), Math.round(maxScroll * 0.6), Math.round(maxScroll * 0.8), maxScroll]
      : [0];
    for (const top of positions) {
      root.scrollTop = top;
      await sleep(300);
      collect();
    }
    root.scrollTop = 0;
    const copyTargetCount = Array.from(modal.querySelectorAll('button, [role="button"], svg')).filter(isVisible).length;
    return {
      text: normalize(snapshots.join(' ')),
      rows: Array.from(rowTexts),
      createAddressRows: Array.from(createAddressRows),
      copyTargetCount,
      snapshots,
    };
  });
}

async function waitForAddressModal(page, timeout = 15000) {
  await waitUntil('address modal visible', async () => {
    const text = await page.locator('[data-testid="APP-Modal-Screen"]').first().innerText({ timeout: 500 }).catch(() => '');
    return /账户地址|Address/i.test(text);
  }, { timeout, interval: 500 });
}

async function findNextCreateAddressTarget(page) {
  return page.evaluate(async () => {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const isVisible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0;
    };
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return null;
    const scrollables = Array.from(modal.querySelectorAll('div')).filter((el) => {
      const r = el.getBoundingClientRect();
      return isVisible(el) && el.scrollHeight > el.clientHeight + 50 && r.height > 120 && r.width > 240;
    });
    const root = scrollables
      .sort((a, b) => ((b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight)))[0] || modal;
    const step = Math.max(160, Math.floor((root.clientHeight || 400) * 0.72));

    const getTarget = () => {
      const candidates = [];
      const modalRect = modal.getBoundingClientRect();
      for (const el of modal.querySelectorAll('span, button, [role="button"], div')) {
        if (!isVisible(el)) continue;
        const text = normalize(el.innerText || el.textContent);
        if (text !== '创建地址') continue;
        const r = el.getBoundingClientRect();
        const centerY = r.y + r.height / 2;
        if (centerY < modalRect.y + 50 || centerY > modalRect.y + modalRect.height - 10) continue;

        let row = el;
        let parent = el.parentElement;
        while (parent && parent !== modal) {
          const pr = parent.getBoundingClientRect();
          const parentText = normalize(parent.innerText || parent.textContent);
          if (
            parentText.includes('创建地址') &&
            parentText !== '创建地址' &&
            pr.height >= 36 &&
            pr.height <= 78 &&
            pr.width >= 300
          ) {
            row = parent;
          }
          parent = parent.parentElement;
        }

        const rowRect = row.getBoundingClientRect();
        const clickRect = el.getBoundingClientRect();
        const exact = text === '创建地址';
        const area = rowRect.width * rowRect.height;
        candidates.push({
          el,
          row,
          exact,
          area,
          text: normalize(row.innerText || row.textContent),
          x: clickRect.x + clickRect.width / 2,
          y: clickRect.y + clickRect.height / 2,
        });
      }
      candidates.sort((a, b) => Number(b.exact) - Number(a.exact) || a.area - b.area || a.y - b.y);
      return candidates[0] || null;
    };

    root.scrollTop = 0;
    await sleep(220);
    let maxScroll = Math.max(0, (root.scrollHeight || 0) - (root.clientHeight || 0));
    for (let top = 0; top <= maxScroll + 2; top += step) {
      root.scrollTop = top;
      await sleep(180);
      const target = getTarget();
      if (target) {
        return {
          text: target.text.slice(0, 180),
          x: Math.round(target.x),
          y: Math.round(target.y),
          scrollTop: root.scrollTop,
        };
      }
      maxScroll = Math.max(maxScroll, Math.max(0, (root.scrollHeight || 0) - (root.clientHeight || 0)));
    }

    maxScroll = Math.max(0, (root.scrollHeight || 0) - (root.clientHeight || 0));
    root.scrollTop = maxScroll;
    await sleep(180);
    const target = getTarget();
    if (!target) return null;
    return {
      text: target.text.slice(0, 180),
      x: Math.round(target.x),
      y: Math.round(target.y),
      scrollTop: root.scrollTop,
    };
  });
}

async function clickCreateAddressTarget(page, target) {
  await page.mouse.click(target.x, target.y);
  await sleep(900);
}

async function handleCreateAddressResult(page) {
  if (await isPasswordPromptVisible(page)) {
    await fillPasswordAndVerify(page);
  }
  await clickFooterButtonByTextIfPresent(page, /创建地址\s*&\s*应用|Create Address/i, 8000);
  await clickFooterButtonByTextIfPresent(page, /完成|Done/i, 8000);
  await waitForAddressModal(page, 20000);
  await sleep(700);
}

async function createAllMissingAddressesFromAddressModal(page) {
  const created = [];
  const repeatByTarget = new Map();
  for (let attempt = 1; attempt <= MAX_ADDRESS_CREATE_ATTEMPTS; attempt++) {
    const target = await findNextCreateAddressTarget(page);
    if (!target) return created;
    const repeatCount = (repeatByTarget.get(target.text) || 0) + 1;
    repeatByTarget.set(target.text, repeatCount);
    if (repeatCount > 3) {
      throw new Error(`address create target did not progress after 3 attempts: ${target.text}`);
    }
    console.log(`  [INFO] auto-create address ${attempt}: ${target.text}`);
    created.push(target.text);
    await clickCreateAddressTarget(page, target);
    await handleCreateAddressResult(page);
  }
  const evidence = await collectAddressModalEvidence(page);
  throw new Error(
    `too many address create attempts (${MAX_ADDRESS_CREATE_ATTEMPTS}); remaining 创建地址 rows: ${
      evidence.createAddressRows.slice(0, 20).join(' | ') || 'unknown'
    }`,
  );
}

function findAddressNearLabel(text, spec) {
  const match = spec.labelRe.exec(text);
  if (!match) return { ok: false, reason: 'label missing' };
  const slice = text.slice(match.index, match.index + 220);
  if (ADDRESS_INVALID_RE.test(slice)) return { ok: false, reason: `invalid placeholder near ${spec.label}` };
  if (!spec.addressRe.test(slice)) return { ok: false, reason: `address missing near ${spec.label}` };
  return { ok: true, sample: slice.slice(0, 120) };
}

async function openAndAssertAddressList(page) {
  await closeAllModals(page).catch(() => {});
  await clickHomeTestIdWithOverlayFallback(page, 'account-selector-copy-address-btn', 1200);
  await waitForAddressModal(page, 10000);

  let remediation = 'none';
  let evidence = await collectAddressModalEvidence(page);
  let createAddressRows = evidence.createAddressRows
    .map(item => item.replace(/\s+/g, ' ').slice(0, 120))
    .slice(0, 20);
  if (createAddressRows.length > 0) {
    await closeTopModalByMouse(page);
    remediation = await applyMissingAddressesFromNetworkSelector(page);
    await clickHomeTestIdWithOverlayFallback(page, 'account-selector-copy-address-btn', 1200);
    await waitForAddressModal(page, 10000);
    evidence = await collectAddressModalEvidence(page);
    createAddressRows = evidence.createAddressRows
      .map(item => item.replace(/\s+/g, ' ').slice(0, 120))
      .slice(0, 20);
  }

  assert(evidence.text.length > 50, 'address modal is blank');
  assert(!ADDRESS_INVALID_RE.test(evidence.text), 'address modal contains invalid placeholder or global address error');

  const missing = [];
  const samples = [];
  for (const spec of REQUIRED_ADDRESS_SPECS) {
    const result = findAddressNearLabel(evidence.text, spec);
    if (!result.ok) missing.push(`${spec.label}: ${result.reason}`);
    else samples.push(`${spec.label}`);
  }
  assert(
    createAddressRows.length === 0,
    `address list still has uncreated rows after network selector create-address apply: ${createAddressRows.join(' | ')}`,
  );
  assert(
    missing.length === 0,
    `missing required default addresses: ${missing.join('; ')}; remediation=${remediation}`,
  );
  assert(evidence.copyTargetCount >= 4, `copy targets too few: ${evidence.copyTargetCount}`);
  assert(evidence.snapshots.every(item => normalizeText(item).length > 20), 'blank gap found while scrolling address modal');

  await closeTopModalByMouse(page);
  return `${samples.length}/${REQUIRED_ADDRESS_SPECS.length} required address groups; remediation=${remediation}; copyTargets=${evidence.copyTargetCount}`;
}

async function assertHomeTabs(page) {
  const checks = [
    { testid: 'home-tab-defi', name: 'DeFi', re: /DeFi|投资组合|获取 Prime|资产|暂无|没有/ },
    { testid: 'home-tab-nft', name: 'NFT', re: /NFT|没有 NFT|未持有/ },
    { testid: 'home-tab-history', name: '历史记录', re: /历史记录|History|交易记录|暂无|没有|Account #/ },
    { testid: 'home-tab-portfolio', name: '现货', re: /现货|代币|资产|BTC|Ethereum|USDT|暂无/ },
  ];
  const details = [];
  for (const check of checks) {
    await clickVisibleTestId(page, check.testid, 900);
    const text = await readVisibleText(page);
    assert(text.length > 80, `${check.name} tab visible text too short`);
    assert(check.re.test(text), `${check.name} tab missing expected content`);
    assert(!/加载中|loading/i.test(text.slice(0, 500)) || text.length > 200, `${check.name} tab stuck in loading`);
    details.push(check.name);
  }
  await assertNoGlobalErrors(page);
  return details.join(', ');
}

async function assertMoreMenu(page) {
  await clickHomeTestIdWithOverlayFallback(page, 'home-more-button', 800);
  const menuText = await waitUntil('more menu text', async () => {
    const text = await page.locator('[data-testid="TMPopover-ScrollView"]:visible').first().innerText({ timeout: 500 }).catch(() => '');
    return text ? normalizeText(text) : null;
  }, { timeout: 8000, interval: 400 });
  const required = ['交易', '复制地址', '授权', '批量转账', '签名与验证消息'];
  const missing = required.filter(item => !menuText.includes(item));
  assert(missing.length === 0, `more menu missing: ${missing.join(', ')}`);
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(400);
  return menuText;
}

async function testNightlyPortfolioCreateAddress(page) {
  const t = createStepTracker(TEST_ID);
  const state = { before: null, after: null };

  if (!await safeStep(page, t, 'Step 0 前置: 回到钱包首页', async () => {
    await ensureWalletHome(page);
    const softwareAccount = await ensurePrimarySoftwareWallet(page);
    await ensureWalletHome(page);
    const selectedName = await readSelectedAccountName(page);
    assert(selectedName.length > 0, 'selected account name is empty');
    return `software=${softwareAccount}; selected=${selectedName}`;
  }, SCREENSHOT_DIR)) return t.result();

  if (!await safeStep(page, t, '切换投资组合为所有网络', async () => {
    return selectAllNetworks(page);
  }, SCREENSHOT_DIR)) return t.result();

  if (!await safeStep(page, t, '记录创建前账户列表状态', async () => {
    state.before = { selectedName: await readSelectedAccountName(page) };
    await openAccountSelector(page);
    const selectorState = await collectAccountSelectorState(page);
    Object.assign(state.before, selectorState);
    assert(selectorState.sawAddButton, 'account add button not visible');
    assert(selectorState.snapshotCount > 0, 'account selector did not produce snapshots');
    return `selected=${state.before.selectedName}; maxAccount=${selectorState.maxAccountNumber ?? 'n/a'}; visibleAccounts=${selectorState.accountNames.length}`;
  }, SCREENSHOT_DIR)) return t.result();

  if (!await safeStep(page, t, '创建地址并断言新账户被选中', async () => {
    state.after = await createAddressAndAssertSelected(page, state.before);
    return `beforeMax=${state.after.beforeMax ?? 'n/a'}; selected=${state.after.selectedName}; afterMax=${state.after.afterMax ?? 'n/a'}`;
  }, SCREENSHOT_DIR)) return t.result();

  if (!await safeStep(page, t, '通过网络选择器批量创建缺失地址', async () => {
    return applyMissingAddressesFromNetworkSelector(page);
  }, SCREENSHOT_DIR)) return t.result();

  if (!await safeStep(page, t, '校验默认多链地址完整创建', async () => {
    return openAndAssertAddressList(page);
  }, SCREENSHOT_DIR)) return t.result();

  if (!await safeStep(page, t, '校验新账户首页 tab 展示', async () => {
    return assertHomeTabs(page);
  }, SCREENSHOT_DIR)) return t.result();

  await safeStep(page, t, '校验更多菜单入口完整', async () => {
    return assertMoreMenu(page);
  }, SCREENSHOT_DIR);

  return t.result();
}

export const testCases = [
  {
    id: TEST_ID,
    name: 'Desktop TF Nightly: 投资组合全网络与创建地址',
    covers: [
      'Checklist #7 投资组合切换到所有网络',
      'Checklist #7 创建地址',
      'Checklist #7 新建地址后的多链地址校验',
      'Checklist #7 新建地址后的多 tab 展示',
      'Checklist #7 新建地址后的更多菜单',
    ],
    fn: testNightlyPortfolioCreateAddress,
  },
];

export async function setup(page) {
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
  _preReport = { ok: true };
  return _preReport;
}

export async function run() {
  const filter = process.argv.slice(2).find(arg => arg.startsWith('NIGHTLY-PORTFOLIO-'));
  const casesToRun = filter ? testCases.filter(test => test.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error', passed: 0, failed: 1, total: 0 };
  }

  let { page } = await connectCDP();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Desktop TF Nightly - Portfolio Create Address - ${casesToRun.length} case(s)`);
  console.log('='.repeat(60));

  await setup(page);

  const results = [];
  for (const test of casesToRun) {
    const startTime = Date.now();
    console.log(`\n${'-'.repeat(60)}\n[${test.id}] ${test.name}`);
    try {
      if (page?.isClosed?.()) {
        ({ page } = await connectCDP());
        await setup(page);
      }
      const result = await test.fn(page);
      const duration = Date.now() - startTime;
      const item = {
        testId: test.id,
        status: result.status,
        duration,
        steps: result.steps,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      };
      console.log(`>> ${test.id}: ${item.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s)`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(item, null, 2));
      results.push(item);
    } catch (error) {
      const duration = Date.now() - startTime;
      const item = {
        testId: test.id,
        status: 'failed',
        duration,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
      console.error(`>> ${test.id}: FATAL - ${error.message}`);
      if (page && !page?.isClosed?.()) await screenshot(page, SCREENSHOT_DIR, `${test.id}-error`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(item, null, 2));
      results.push(item);
    }
  }

  const passed = results.filter(item => item.status === 'passed').length;
  const failed = results.filter(item => item.status !== 'passed').length;
  const summary = {
    timestamp: new Date().toISOString(),
    total: results.length,
    passed,
    failed,
    results,
  };
  writeFileSync(resolve(RESULTS_DIR, 'nightly-portfolio-all-networks-create-address-summary.json'), JSON.stringify(summary, null, 2));

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run()
    .then(result => process.exit(result.status === 'passed' ? 0 : 1))
    .catch(error => {
      console.error('Fatal:', error);
      process.exit(2);
    });
}
