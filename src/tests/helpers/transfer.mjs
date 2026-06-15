// Transfer helpers — send form, recipient, amount, memo, preview, full flow
// Extracted from src/runner/index.mjs — uses direct testid selectors

import { sleep, screenshot, RESULTS_DIR } from './index.mjs';
import { getConfiguredAccount } from './accounts.mjs';
import { resolve } from 'node:path';

const SEND_FORM_SEL = '[data-testid="send-recipient-amount-form"]';

// ── Precondition Helpers (K-038: smart state detection) ────

/**
 * Detect if currently in portfolio mode (no single-network selector visible).
 */
export async function isPortfolioMode(page) {
  const networkBtn = page.locator('[data-testid="account-network-trigger-button-text"]');
  return !(await networkBtn.isVisible({ timeout: 2000 }).catch(() => false));
}

/**
 * Switch from portfolio to single-network mode if needed.
 * No-op if already in single-network mode.
 */
export async function ensureSingleNetworkMode(page) {
  if (!(await isPortfolioMode(page))) return;

  // Portfolio mode: click the chain icon area to trigger mode switch
  const toggled = await page.evaluate(() => {
    const svgs = document.querySelectorAll('svg');
    for (const svg of svgs) {
      const r = svg.getBoundingClientRect();
      if (r.width > 0 && r.y > 60 && r.y < 120 && r.x > 240 && r.x < 320) {
        (svg.closest('[role="button"]') || svg.parentElement)?.click();
        return true;
      }
    }
    return false;
  });
  if (!toggled) return;
  await sleep(2000);

  // Select "网络" from the modal to confirm single-network mode
  await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return;
    for (const sp of modal.querySelectorAll('span')) {
      if (sp.textContent?.trim() === '网络' && sp.getBoundingClientRect().width > 0) {
        sp.click();
        return;
      }
    }
  });
  await sleep(2000);
}

/**
 * Check if current account has visible fiat balance > 0.
 * Retries a few times to allow balance to load after account/network switch.
 * Returns true if balance detected > 0, or if detection fails (assume has balance).
 */
export async function hasBalance(page) {
  // Wait briefly for balance to load after account switch
  await sleep(2000);
  const balanceText = await page.evaluate(() => {
    for (const sp of document.querySelectorAll('span')) {
      const r = sp.getBoundingClientRect();
      const t = sp.textContent?.trim() || '';
      if (r.y > 50 && r.y < 180 && r.x < 300 && (t.startsWith('¥') || t.startsWith('$'))) {
        return t;
      }
    }
    return null;
  });
  if (!balanceText) return true; // Can't detect, assume has balance
  const num = parseFloat(balanceText.replace(/[¥$,]/g, ''));
  return !isNaN(num) && num > 0;
}

// ── Post-Transfer Verification Helpers ─────────────────────

/**
 * Verify fiat/crypto toggle on the amount input page.
 * Clicks the toggle arrow, asserts fiat is displayed (¥ or $), then toggles back.
 * @returns {string} The fiat amount displayed (e.g., "¥0.04")
 */
export async function verifyFiatToggle(page) {
  // Click toggle to show fiat
  const toggled = await page.evaluate(() => {
    const modals = document.querySelectorAll('[data-testid="APP-Modal-Screen"]');
    const modal = modals[modals.length - 1];
    const container = modal || document;
    const amountInput =
      container.querySelector('[data-testid="send-amount-input"]') ||
      container.querySelector('input[placeholder="0"]');
    const inputRect = amountInput?.getBoundingClientRect();
    const buttons = container.querySelectorAll('[role="button"], button');
    for (const btn of buttons) {
      const r = btn.getBoundingClientRect();
      const text = btn.textContent?.trim() || '';
      if (r.width <= 0 || r.height <= 0) continue;
      if (inputRect) {
        const alignedWithInput = Math.abs((r.x + r.width / 2) - (inputRect.x + inputRect.width / 2)) < 180;
        const belowInput = r.y > inputRect.y && r.y < inputRect.y + 180;
        if (alignedWithInput && belowInput && (text || btn.querySelector('svg'))) {
          btn.click();
          return true;
        }
      }
      if (r.y > 200 && r.y < 520 && r.x > 260 && r.x < 900 && (text.includes('$') || text.includes('¥'))) {
        btn.click();
        return true;
      }
    }
    return false;
  });
  if (!toggled) throw new Error('法币切换按钮未找到');
  await sleep(1500);

  // Read fiat display
  const fiatAmount = await page.evaluate(() => {
    const modals = document.querySelectorAll('[data-testid="APP-Modal-Screen"]');
    const modal = modals[modals.length - 1];
    const container = modal || document;
    for (const sp of container.querySelectorAll('span')) {
      const t = sp.textContent?.trim() || '';
      const r = sp.getBoundingClientRect();
      if (r.y > 150 && r.y < 350 && (t.startsWith('¥') || t.startsWith('$')) && t.length > 3) {
        return t;
      }
    }
    return null;
  });
  if (!fiatAmount) throw new Error('法币金额未显示');

  // Toggle back to crypto
  await page.evaluate(() => {
    const modals = document.querySelectorAll('[data-testid="APP-Modal-Screen"]');
    const modal = modals[modals.length - 1];
    const container = modal || document;
    const amountInput =
      container.querySelector('[data-testid="send-amount-input"]') ||
      container.querySelector('input[placeholder="0"]');
    const inputRect = amountInput?.getBoundingClientRect();
    const buttons = container.querySelectorAll('[role="button"], button');
    for (const btn of buttons) {
      const r = btn.getBoundingClientRect();
      const text = btn.textContent?.trim() || '';
      if (r.width <= 0 || r.height <= 0) continue;
      if (inputRect) {
        const alignedWithInput = Math.abs((r.x + r.width / 2) - (inputRect.x + inputRect.width / 2)) < 180;
        const belowInput = r.y > inputRect.y && r.y < inputRect.y + 180;
        if (alignedWithInput && belowInput && (text || btn.querySelector('svg'))) {
          btn.click();
          return;
        }
      }
      if (r.y > 200 && r.y < 520 && r.x > 260 && r.x < 900 && (text.includes('$') || text.includes('¥'))) {
        btn.click();
        return;
      }
    }
  });
  await sleep(1000);

  return fiatAmount;
}

function normalizeHistoryExpectations(expected) {
  if (typeof expected === 'string') {
    return {
      token: expected,
      requiredFields: ['token', 'type', 'hash', 'status'],
    };
  }
  const normalized = expected || {};
  return {
    ...normalized,
    requiredFields: normalized.requiredFields || ['token', 'type', 'hash', 'status'],
    optionalFields: normalized.optionalFields || [],
  };
}

function compactAddressVariants(address) {
  if (!address) return [];
  const value = String(address);
  const variants = [value];
  if (value.length >= 12) {
    variants.push(`${value.slice(0, 6)}...${value.slice(-4)}`);
    variants.push(`${value.slice(0, 8)}...${value.slice(-6)}`);
    variants.push(`${value.slice(0, 10)}...${value.slice(-8)}`);
  }
  return variants;
}

function historyTextIncludesAddress(text, address) {
  if (!address) return false;
  const lowerText = text.toLowerCase();
  return compactAddressVariants(address).some((variant) => lowerText.includes(variant.toLowerCase()));
}

function extractHistoryFields(text, expected) {
  const fields = [];
  if (expected.token && text.includes(expected.token)) fields.push('token');
  if (expected.network && text.includes(expected.network)) fields.push('network');
  if (expected.amount && expected.amount !== 'Max' && text.includes(String(expected.amount))) fields.push('amount');
  if (text.includes('发送') || text.includes('發送') || text.includes('Send')) fields.push('type');
  if (text.includes('哈希') || text.includes('Hash') || text.includes('hash') || text.includes('交易ID') || text.includes('交易 ID') || text.includes('Transaction ID')) fields.push('hash');
  if (text.includes('费用') || text.includes('費用') || text.includes('Fee') || text.includes('网络费') || text.includes('網絡費')) fields.push('fee');
  if (
    text.includes('处理中') ||
    text.includes('待处理') ||
    text.includes('處理中') ||
    text.includes('待處理') ||
    text.includes('已确认') ||
    text.includes('已確認') ||
    text.includes('成功') ||
    text.includes('已发送') ||
    text.includes('已發送') ||
    text.includes('Pending') ||
    text.includes('Confirmed') ||
    text.includes('Success') ||
    text.includes('Submitted')
  ) fields.push('status');
  if (
    historyTextIncludesAddress(text, expected.recipientAddress) ||
    (expected.recipientLabel && text.includes(expected.recipientLabel))
  ) fields.push('recipient');
  if (expected.memo && text.includes(expected.memo)) fields.push('memo');
  return fields;
}

export function isTransferInsufficientText(text = '') {
  const value = String(text || '');
  return (
    value.includes('余额不足') ||
    value.includes('餘額不足') ||
    value.includes('资金不足') ||
    value.includes('資金不足') ||
    value.includes('可用余额不足') ||
    value.includes('可用餘額不足') ||
    value.includes('不足以支付网络费用') ||
    value.includes('不足以支付網絡費用') ||
    value.includes('无法发送 0') ||
    value.includes('無法發送 0') ||
    value.includes('不能发送 0') ||
    value.includes('不能發送 0') ||
    value.includes('0 金额') ||
    value.includes('0 金額') ||
    /insufficient\s+(balance|funds|fee)/i.test(value) ||
    /not enough\s+(balance|funds|fee)/i.test(value)
  );
}

/**
 * Open history record list, click latest transaction, verify fields, then close.
 * @param {string | {
 *   token?: string,
 *   network?: string,
 *   amount?: string,
 *   recipientAddress?: string,
 *   recipientLabel?: string,
 *   memo?: string,
 *   requiredFields?: string[],
 *   optionalFields?: string[],
 * }} expected
 * @returns {{ fields: string[], optionalMissing: string[], text: string }} Matched verification fields
 */
export async function verifyHistoryRecord(page, expected) {
  const expectations = normalizeHistoryExpectations(expected);
  // Click "历史记录" / "歷史記錄"
  const historyClicked = await page.evaluate(() => {
    const historyLabels = new Set(['历史记录', '歷史記錄', 'History']);
    for (const sp of document.querySelectorAll('span')) {
      if (historyLabels.has(sp.textContent?.trim()) && sp.getBoundingClientRect().width > 0) {
        sp.click();
        return true;
      }
    }
    return false;
  });
  if (!historyClicked) throw new Error('历史记录按钮未找到');
  await sleep(2000);

  // Verify latest record exists and click it
  await page.waitForFunction(() => {
    const visible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0;
    };
    return Array.from(document.querySelectorAll('[data-testid="tx-action-common-list-view"]')).some(visible);
  }, { timeout: 15000 });

  let listText = '';
  let lastRows = [];
  let clickedTx = false;
  const started = Date.now();
  while (Date.now() - started < 15000 && !clickedTx) {
    const match = await page.evaluate((expected) => {
      const visible = (el) => {
        const r = el?.getBoundingClientRect?.();
        return !!r && r.width > 0 && r.height > 0;
      };
      const amountMatches = (text, amount) => {
        if (!amount || amount === 'Max') return true;
        if (text.includes(String(amount))) return true;
        const expectedNum = Number(amount);
        if (!Number.isFinite(expectedNum)) return false;
        const numbers = text.match(/\d+(?:\.\d+)?/g) || [];
        return numbers.some((value) => {
          const actualNum = Number(value);
          return Number.isFinite(actualNum) && Math.abs(actualNum - expectedNum) < 1e-12;
        });
      };
      const isSend = (text) => text.includes('发送') || text.includes('發送') || text.includes('Send');
      const rows = Array.from(document.querySelectorAll('[data-testid="tx-action-common-list-view"]'))
        .filter(visible)
        .map((row) => ({ row, text: row.textContent || '' }));
      const rowTexts = rows.map((row) => row.text).slice(0, 8);
      const matched = rows.find(({ text }) =>
        (!expected.token || text.includes(expected.token)) &&
        isSend(text) &&
        amountMatches(text, expected.amount)
      ) || rows.find(({ text }) =>
        (!expected.token || text.includes(expected.token)) &&
        isSend(text)
      );
      if (!matched) return { clicked: false, rows: rowTexts };
      matched.row.click();
      return { clicked: true, text: matched.text, rows: rowTexts };
    }, expectations);
    lastRows = match.rows || [];
    if (match.clicked) {
      listText = match.text || '';
      clickedTx = true;
      break;
    }
    await sleep(1000);
  }

  if (!clickedTx) {
    throw new Error(`历史记录中未找到匹配的发送交易: ${lastRows.join(' | ').substring(0, 240)}`);
  }
  await sleep(2000);

  // Read detail content
  const detailText = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    return (modal || document.body).textContent?.substring(0, 5000) || '';
  });
  const text = `${listText}\n${detailText}`;
  const fields = extractHistoryFields(text, expectations);
  const missing = expectations.requiredFields.filter((field) => !fields.includes(field));
  if (missing.length) {
    throw new Error(`历史记录字段缺失: ${missing.join(', ')}; text=${text.substring(0, 240)}`);
  }
  const optionalMissing = expectations.optionalFields.filter((field) => !fields.includes(field));

  // Close detail
  const closeBtn = page.locator('[data-testid="nav-header-close"]');
  await closeBtn.click({ timeout: 3000 }).catch(() => page.keyboard.press('Escape'));
  await sleep(1000);

  return { fields, optionalMissing, text };
}

/**
 * Verify memo input exceeds limit: check error prompt and button disabled state.
 * @returns {string} The error text found
 */
export async function verifyMemoOverLimit(page) {
  const pageText = await page.evaluate(() => document.body.textContent?.substring(0, 5000) || '');
  if (!pageText.includes('512')) throw new Error('未显示 512 字符限制提示');

  const btnDisabled = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="page-footer-confirm"]');
    if (!btn) return true;
    return btn.disabled || btn.getAttribute('aria-disabled') === 'true' ||
           btn.closest('[disabled]') !== null ||
           getComputedStyle(btn).opacity < 0.6 ||
           getComputedStyle(btn).pointerEvents === 'none';
  });
  if (!btnDisabled) throw new Error('下一步按钮未禁用');
  return '提示 512 限制 + 按钮置灰';
}

/**
 * Click the memo "清除" button and verify the field is emptied.
 */
export async function clearMemoField(page) {
  const cleared = await page.evaluate(() => {
    for (const sp of document.querySelectorAll('span')) {
      if (sp.textContent?.trim() === '清除' && sp.getBoundingClientRect().width > 0) {
        sp.click();
        return true;
      }
    }
    return false;
  });
  if (!cleared) throw new Error('清除按钮未找到');
  await sleep(1000);

  const memoValue = await page.evaluate(() => {
    const ta = document.querySelector('textarea[placeholder*="备忘"]') ||
               document.querySelector('input[placeholder*="备忘"]');
    return ta?.value || '';
  });
  if (memoValue.length > 0) throw new Error(`备注未清空: ${memoValue.length} chars`);
}

/**
 * Verify invalid amount handling: negative (can't type), zero (error), over-balance (button text).
 * Must be on the amount input page already.
 * @returns {{ negative: string, zero: string, overBalance: string }}
 */
export async function verifyInvalidAmounts(page) {
  const selectors = [
    '[data-testid="APP-Modal-Screen"] [data-testid="send-amount-input"] input',
    '[data-testid="APP-Modal-Screen"] [data-testid="send-amount-input"]',
    '[data-testid="send-amount-input"] input',
    '[data-testid="send-amount-input"]',
    '[data-testid="APP-Modal-Screen"] input[placeholder="0"]',
    'input[placeholder="0"]',
  ];
  let amountInput = null;
  for (const selector of selectors) {
    const candidate = page.locator(selector).first();
    const visible = await candidate.isVisible({ timeout: 800 }).catch(() => false);
    if (visible) {
      amountInput = candidate;
      break;
    }
  }
  if (!amountInput) throw new Error('金额输入框不可见');
  const results = {};

  // Negative: can't be typed
  await amountInput.click();
  await amountInput.fill('');
  await sleep(300);
  await amountInput.pressSequentially('-5', { delay: 50 });
  await sleep(500);
  const negVal = await amountInput.inputValue();
  if (negVal.includes('-')) throw new Error(`负号被输入了: ${negVal}`);
  results.negative = `输入 -5 → 实际="${negVal}"`;

  // Zero: shows error
  await amountInput.click();
  await amountInput.fill('0');
  await sleep(1000);
  const zeroText = await page.evaluate(() => document.body.textContent?.substring(0, 5000) || '');
  const hasZeroError = zeroText.includes('无法发送 0') || zeroText.includes('無法發送 0') || zeroText.includes('0 金额') || zeroText.includes('0 金額') || zeroText.includes('cannot send 0');
  if (!hasZeroError) throw new Error('未显示 0 金额错误提示');
  results.zero = '无法发送 0 金额';

  // Over balance: button shows "资金不足"
  await amountInput.click();
  await amountInput.fill('999999');
  await sleep(1500);
  const btnText = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="page-footer-confirm"]');
    return btn?.textContent?.trim() || '';
  });
  if (!btnText.includes('资金不足') && !btnText.includes('資金不足') && !btnText.includes('Insufficient') && !btnText.includes('不足')) {
    throw new Error(`按钮文案不是"资金不足": "${btnText}"`);
  }
  results.overBalance = `按钮="${btnText}"`;

  return results;
}

/**
 * Open send form for a given token.
 * Clicks "发送"/"發送" in wallet tab header, then selects token if a picker appears.
 */
export async function openSendForm(page, token) {
  // Quick dismiss any residual backdrops
  await page.evaluate(() => {
    document.querySelectorAll('[data-testid="app-modal-stacks-backdrop"]').forEach(el => el.click());
  }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(300);

  // Click 发送 / 發送
  const sendClicked = await page.evaluate(() => {
    const sendLabels = new Set(['发送', '發送', 'Send']);
    const header = document.querySelector('[data-testid="Wallet-Tab-Header"]');
    const containers = [header, document].filter(Boolean);
    for (const container of containers) {
      for (const el of container.querySelectorAll('button, [role="button"], span')) {
        if (!sendLabels.has(el.textContent?.trim())) continue;
        if (el.getBoundingClientRect().width > 0) {
          (el.closest('button, [role="button"]') || el).click();
          return true;
        }
      }
    }
    return false;
  });
  if (!sendClicked) throw new Error('Send button not found');
  await sleep(1500);

  // Check if send form opened directly (single-token wallet)
  const hasSendForm = await page.locator(SEND_FORM_SEL).isVisible({ timeout: 500 }).catch(() => false);
  if (hasSendForm) {
    console.log('    Send form opened directly');
    return;
  }

  // Token picker modal — click token directly (no search needed for most cases)
  const clicked = await page.evaluate((tk) => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return null;
    if (modal.textContent?.includes('没有资产') || modal.textContent?.includes('沒有資產')) return 'no_assets';
    for (const sp of modal.querySelectorAll('span')) {
      if (sp.textContent?.trim() === tk && sp.getBoundingClientRect().width > 0) {
        const row = sp.closest('[role="button"]') || sp.parentElement?.parentElement;
        if (row && row.getBoundingClientRect().width > 0) { row.click(); return 'row'; }
        sp.click();
        return 'span';
      }
    }
    return null;
  }, token);

  if (clicked === 'no_assets') throw new Error(`No assets found for token ${token}`);

  // If token not found by exact match, use search
  if (!clicked) {
    console.log(`    Token ${token} not found directly, searching...`);
    // Try multiple search input placeholders
    let searchInput = page.locator('[data-testid="APP-Modal-Screen"] input[placeholder*="搜索"], [data-testid="APP-Modal-Screen"] input[placeholder*="搜尋"]').first();
    let hasSearch = await searchInput.isVisible({ timeout: 1000 }).catch(() => false);
    if (!hasSearch) {
      searchInput = page.locator('input[placeholder="搜索资产"], input[placeholder="搜尋資產"]').first();
      hasSearch = await searchInput.isVisible({ timeout: 1000 }).catch(() => false);
    }
    if (hasSearch) {
      await searchInput.click();
      await sleep(200);
      await searchInput.pressSequentially(token, { delay: 50 });
      await sleep(1500);
      const clickedBySearch = await page.evaluate((tk) => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        if (!modal) return false;
        for (const sp of modal.querySelectorAll('span')) {
          if (sp.textContent?.trim() === tk && sp.getBoundingClientRect().width > 0) {
            const row = sp.closest('[role="button"]') || sp.parentElement?.parentElement;
            (row || sp).click();
            return true;
          }
        }
        return false;
      }, token);
      if (!clickedBySearch) throw new Error(`Token ${token} not found after search`);
    } else {
      throw new Error(`Token picker search input not found for ${token}`);
    }
  }
  console.log(`    Selected token ${token} (${clicked || 'search'})`);
  await sleep(1500);

  await page.locator(SEND_FORM_SEL).waitFor({ state: 'visible', timeout: 8000 });
}

/**
 * Select recipient on the send form.
 * New UI flow: send form has tabs (最近 / 账户/帳戶 / 地址簿) inline.
 * Click "账户"/"帳戶" tab → click recipient account by label or testid.
 */
export async function selectRecipientFromContacts(page, recipientName) {
  const recipient = getConfiguredAccount(recipientName);
  const labels = recipient.labels || [recipient.label];

  // Click "账户" tab on the send form
  const tabClicked = await page.evaluate(() => {
    const form = document.querySelector('[data-testid="send-recipient-amount-form"]') || document.body;
    const accountLabels = new Set(['账户', '帳戶', 'Account']);
    for (const sp of form.querySelectorAll('span')) {
      const r = sp.getBoundingClientRect();
      if (accountLabels.has(sp.textContent?.trim()) && r.width > 0 && r.height > 0) {
        const clickable = sp.closest('[role="button"], button') || sp;
        clickable.click();
        return true;
      }
    }
    return false;
  });

  if (!tabClicked) {
    const fallbackClicked = await page.evaluate(() => {
      const accountLabels = new Set(['账户', '帳戶', 'Account']);
      for (const sp of document.querySelectorAll('span')) {
        const r = sp.getBoundingClientRect();
        if (accountLabels.has(sp.textContent?.trim()) && r.width > 0 && r.height > 0) {
          const clickable = sp.closest('[role="button"], button') || sp;
          clickable.click();
          return true;
        }
      }
      return false;
    });
    if (!fallbackClicked) throw new Error('Account tab not found');
  }
  console.log(`    Clicked account tab`);
  await sleep(2000);

  // Click recipient account — try by testid pattern first (recipient-item-<address>)
  const recipientClicked = await page.evaluate((labelList) => {
    const getAddressFromTestId = (el) => {
      const testId = el?.getAttribute?.('data-testid') || '';
      return testId.startsWith('recipient-item-') ? testId.slice('recipient-item-'.length) : null;
    };
    // Find recipient item containing the account label text
    const items = document.querySelectorAll('[data-testid^="recipient-item-"]');
    for (const item of items) {
      const r = item.getBoundingClientRect();
      if (r.width > 0 && labelList.some((label) => item.textContent?.includes(label))) {
        item.click();
        return { testId: item.getAttribute('data-testid'), address: getAddressFromTestId(item) };
      }
    }
    // Fallback: find span with label text and click its parent row
    for (const sp of document.querySelectorAll('span')) {
      const r = sp.getBoundingClientRect();
      if (r.width > 0 && labelList.includes(sp.textContent?.trim())) {
        const row = sp.closest('[data-testid^="recipient-item-"]') ||
                    sp.closest('[role="button"]') ||
                    sp.parentElement?.parentElement;
        if (row) {
          row.click();
          return { testId: row.getAttribute?.('data-testid') || 'fallback-label', address: getAddressFromTestId(row) };
        }
      }
    }
    return null;
  }, labels);

  if (recipientClicked) {
    console.log(`    Selected recipient ${recipient.label} (${recipient.role}, ${recipientClicked.testId})`);
  } else {
    throw new Error(`Recipient "${recipient.label}" not found in 账户 tab`);
  }
  await sleep(3000);
  return {
    name: recipientName,
    label: recipient.label,
    address: recipientClicked.address,
    testId: recipientClicked.testId,
  };
}

/**
 * Enter transfer amount — numeric value or "Max".
 * Looks for input in modal first, then send form, then any visible input with placeholder "0".
 */
export async function enterAmount(page, amount) {
  if (amount === 'Max' || amount === 'max') {
    const maxPos = await page.evaluate(() => {
      // Search in modal first, then body
      const containers = [document.querySelector('[data-testid="APP-Modal-Screen"]'), document.body];
      for (const container of containers) {
        if (!container) continue;
        for (const sp of container.querySelectorAll('span')) {
          if (sp.textContent === '最大' && sp.getBoundingClientRect().width > 0) {
            const r = sp.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
          }
        }
      }
      return null;
    });
    if (maxPos) {
      await page.mouse.click(maxPos.x, maxPos.y);
      console.log(`    Clicked "最大" at (${Math.round(maxPos.x)}, ${Math.round(maxPos.y)})`);
    } else {
      await page.locator('text=最大').first().click({ timeout: 5000 });
    }
    await sleep(2000);
  } else {
    // Find the amount input — try multiple scopes
    const selectors = [
      '[data-testid="APP-Modal-Screen"] [data-testid="send-amount-input"]',
      '[data-testid="send-amount-input"]',
      '[data-testid="APP-Modal-Screen"] input[placeholder="0"]',
      `${SEND_FORM_SEL} input`,
      'input[placeholder="0"]',
    ];

    let amountInput = null;
    for (const selector of selectors) {
      const candidate = page.locator(selector).first();
      const visible = await candidate.isVisible({ timeout: 1000 }).catch(() => false);
      if (visible) {
        amountInput = candidate;
        break;
      }
    }

    if (!amountInput) throw new Error('Amount input not found');

    await amountInput.click();
    await sleep(300);
    await amountInput.fill(String(amount));
    console.log(`    Entered amount: ${amount}`);
    await sleep(500);
  }
}

/**
 * Enter memo in the memo/tag field.
 */
export async function enterMemo(page, memo) {
  const memoSelectors = [
    'textarea[placeholder*="备忘标签"]',
    'input[placeholder*="备忘标签"]',
    'textarea[placeholder*="Memo"]',
    'input[placeholder*="Memo"]',
    'textarea[placeholder*="备忘"]',
    'input[placeholder*="备忘"]',
    'textarea[placeholder*="備忘"]',
    'input[placeholder*="備忘"]',
  ];

  let memoInput = null;
  for (const sel of memoSelectors) {
    const loc = page.locator(sel).first();
    const visible = await loc.isVisible({ timeout: 1000 }).catch(() => false);
    if (visible) {
      memoInput = loc;
      break;
    }
  }

  if (!memoInput) {
    console.log('    Memo field not found, skipping');
    return;
  }
  await memoInput.click();
  await sleep(300);
  await memoInput.fill(memo);
  console.log(`    Entered memo: ${memo}`);
  await sleep(500);
}

/**
 * Check if "insufficient balance" is shown.
 */
export async function checkInsufficientBalance(page) {
  return await page.evaluate(() => {
    const bodyText = document.body?.textContent?.substring(0, 8000) || '';
    const hasBlockingText =
      bodyText.includes('余额不足') ||
      bodyText.includes('餘額不足') ||
      bodyText.includes('资金不足') ||
      bodyText.includes('資金不足') ||
      bodyText.includes('可用余额不足') ||
      bodyText.includes('可用餘額不足') ||
      bodyText.includes('不足以支付网络费用') ||
      bodyText.includes('不足以支付網絡費用') ||
      bodyText.includes('无法发送 0') ||
      bodyText.includes('無法發送 0') ||
      bodyText.includes('不能发送 0') ||
      bodyText.includes('不能發送 0') ||
      bodyText.includes('0 金额') ||
      bodyText.includes('0 金額') ||
      /insufficient\s+(balance|funds|fee)/i.test(bodyText) ||
      /not enough\s+(balance|funds|fee)/i.test(bodyText);
    if (hasBlockingText) {
      return true;
    }
    const confirmBtn = document.querySelector('[data-testid="page-footer-confirm"]');
    if (confirmBtn && (confirmBtn.disabled || confirmBtn.getAttribute('aria-disabled') === 'true')) {
      return true;
    }
    return false;
  });
}

export async function getAmountPageAssetLoadingState(page, { token } = {}) {
  return page.evaluate(({ token }) => {
    const isVisible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0;
    };
    const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const modals = Array.from(document.querySelectorAll('[data-testid="APP-Modal-Screen"]')).filter(isVisible);
    const modal = modals.at(-1) || document.body;
    const amountInput =
      modal.querySelector('[data-testid="send-amount-input"]') ||
      modal.querySelector('[data-testid="amount-input-input-element-input"]') ||
      modal.querySelector('input[placeholder="0"]');
    const amountInputVisible = isVisible(amountInput);
    const modalRect = modal.getBoundingClientRect();
    const text = modal.textContent || '';
    const assetSummaryReady =
      /(可用|Available)[\s\S]{0,120}\d[\d.,]*\s*[A-Z0-9]{2,}/i.test(text) ||
      (text.includes('最大') && /\d[\d.,]*\s*[A-Z0-9]{2,}/i.test(text));
    const tokenBalanceReady = token
      ? new RegExp(`${escapeRegExp(token)}[\\s\\S]{0,80}\\d[\\d.,]*`, 'i').test(text)
      : false;

    const skeletons = Array.from(modal.querySelectorAll('div, span'))
      .filter(isVisible)
      .map((el) => {
        const r = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const visibleText = (el.innerText || el.textContent || '').trim();
        const bg = style.backgroundColor;
        const radius = parseFloat(style.borderRadius || '0') || 0;
        return {
          tag: el.tagName,
          text: visibleText,
          width: r.width,
          height: r.height,
          x: r.x,
          y: r.y,
          bg,
          radius,
          className: String(el.className || ''),
        };
      })
      .filter((item) => {
        if (item.text) return false;
        if (item.width < 18 || item.width > 360) return false;
        if (item.height < 4 || item.height > 90) return false;
        if (item.y < modalRect.y + 80) return false;
        if (!item.bg || item.bg === 'rgba(0, 0, 0, 0)' || item.bg === 'transparent') return false;
        return item.radius > 0 || /skeleton|loading/i.test(item.className);
      });

    const loadingText = /loading|加载中/i.test(text);
    return {
      amountInputVisible,
      assetSummaryReady,
      tokenBalanceReady,
      loading: !amountInputVisible || (!assetSummaryReady && !tokenBalanceReady && (skeletons.length > 0 || loadingText)),
      skeletonCount: skeletons.length,
      loadingText,
      text: text.substring(0, 500),
    };
  }, { token });
}

export async function waitForAmountPageAssetsReady(page, { timeout = 10000, token } = {}) {
  const started = Date.now();
  let lastState = null;
  while (Date.now() - started <= timeout) {
    lastState = await getAmountPageAssetLoadingState(page, { token });
    if (lastState.amountInputVisible && !lastState.loading) {
      return {
        ready: true,
        waitedMs: Date.now() - started,
        state: lastState,
      };
    }
    await sleep(500);
  }
  throw new Error(
    `金额页资产信息 ${Math.round(timeout / 1000)}s 内未加载完成: skeleton=${lastState?.skeletonCount ?? 'unknown'}, text=${(lastState?.text || '').substring(0, 160)}`,
  );
}

/**
 * Assert preview page content against expected values.
 */
export async function assertPreviewPage(page, expected) {
  const previewContent = await page.evaluate(() => {
    const modals = document.querySelectorAll('[data-testid="APP-Modal-Screen"]');
    const modal = modals[modals.length - 1];
    const container = modal || document.body;
    const allText = container.textContent || '';
    const spans = container.querySelectorAll('span, div, p');
    const texts = [];
    for (const sp of spans) {
      const r = sp.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        const t = sp.textContent?.trim();
        if (t && t.length < 200) texts.push(t);
      }
    }
    return { allText: allText.substring(0, 3000), visibleTexts: texts.slice(0, 100) };
  });

  const checks = [];
  const allText = previewContent.allText;
  const normalizedText = allText.replace(/\s+/g, ' ');
  const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const amountMatches = (amount) => {
    const escapedAmount = escapeRegex(amount);
    const pattern = new RegExp(`(^|[^\\d.])[-−]?\\s*${escapedAmount}([^\\d.]|$)`);
    if (pattern.test(normalizedText)) return true;
    const expectedNum = Number(amount);
    if (!Number.isFinite(expectedNum)) return false;
    const numbers = normalizedText.match(/\d+(?:\.\d+)?/g) || [];
    return numbers.some((value) => {
      const actualNum = Number(value);
      return Number.isFinite(actualNum) && Math.abs(actualNum - expectedNum) < 1e-12;
    });
  };

  if (expected.network) {
    const found = allText.includes(expected.network);
    checks.push({ field: 'network', expected: expected.network, found, severity: found ? 'pass' : 'warn' });
  }
  if (expected.token) {
    const found = allText.includes(expected.token);
    checks.push({ field: 'token', expected: expected.token, found, severity: found ? 'pass' : 'warn' });
  }
  if (expected.recipientAddress) {
    const addr = expected.recipientAddress;
    const prefix = addr.substring(0, Math.min(6, addr.length));
    const tail = addr.substring(addr.length - 4);
    const found = allText.includes(addr) || (allText.includes(prefix) && allText.includes(tail));
    checks.push({ field: 'recipient', expected: `${prefix}...${tail}`, found, severity: found ? 'pass' : 'error' });
  }
  if (expected.amount && expected.amount !== 'Max') {
    const found = amountMatches(expected.amount);
    checks.push({ field: 'amount', expected: expected.amount, found, severity: found ? 'pass' : 'error' });
  }
  if (expected.memo) {
    const found = allText.includes(expected.memo);
    checks.push({ field: 'memo', expected: expected.memo, found, severity: found ? 'pass' : 'warn' });
  }

  const passed = checks.filter(c => c.found).length;
  const total = checks.length;
  console.log(`    Preview assertions: ${passed}/${total} matched`);
  for (const c of checks) {
    const icon = c.found ? 'OK' : 'MISS';
    console.log(`      [${icon}] ${c.field}: "${c.expected}"`);
  }

  const blockingMissing = checks.filter((c) => !c.found && c.severity === 'error');
  if (blockingMissing.length) {
    throw new Error(`预览页字段校验失败: ${blockingMissing.map((c) => `${c.field}=${c.expected}`).join(', ')}`);
  }

  return { valid: checks.every(c => c.found), checks, passed, total };
}

/**
 * Dismiss error dialogs/toasts that may block the send form.
 */
export async function dismissErrorDialogs(page) {
  await page.evaluate(() => {
    const toastCloses = document.querySelectorAll('[data-testid*="toast"] button, [role="alert"] button, [data-testid*="Toast"] button');
    for (const btn of toastCloses) {
      if (btn.getBoundingClientRect().width > 0) btn.click();
    }
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const t = btn.textContent?.trim();
      if ((t === '确定' || t === 'OK' || t === '知道了') && btn.getBoundingClientRect().width > 0) {
        const parent = btn.closest('[role="dialog"], [role="alertdialog"], [data-testid*="alert"]');
        if (parent) btn.click();
      }
    }
  });
  await sleep(500);
}

/**
 * After cancel, recover to a known state.
 */
export async function recoverAfterCancel(page) {
  await sleep(500);

  const atHome = await page.locator('[data-testid="AccountSelectorTriggerBase"]').isVisible({ timeout: 2000 }).catch(() => false);
  if (atHome) return;

  const inSendForm = await page.locator(SEND_FORM_SEL).isVisible({ timeout: 1000 }).catch(() => false);
  if (inSendForm) {
    await page.evaluate(() => {
      const backBtn = document.querySelector('[data-testid="nav-header-back"]');
      if (backBtn) { backBtn.click(); return; }
      const closeBtn = document.querySelector('[data-testid="nav-header-close"]');
      if (closeBtn) { closeBtn.click(); return; }
    });
    await sleep(1000);
  }

  await page.keyboard.press('Escape');
  await sleep(500);
}

/**
 * Click preview, assert content, then cancel.
 * Handles insufficient detection and state recovery.
 * @returns {'success' | 'insufficient'}
 */
export async function clickPreviewAndVerify(page, testId, verifyDepth = 'preview-and-cancel', expected = {}) {
  await sleep(2000);
  const insufficientBefore = await checkInsufficientBalance(page);
  if (insufficientBefore) {
    console.log(`    Insufficient balance detected before preview`);
    return 'insufficient';
  }

  const previewSel = '[data-testid="page-footer-confirm"]';
  const previewBtn = page.locator(previewSel);

  try {
    await previewBtn.click({ timeout: 8000 });
    console.log(`    Clicked preview (page-footer-confirm)`);
  } catch {
    try {
      await page.locator('text=预览').first().click({ timeout: 3000 });
      console.log(`    Clicked preview (text fallback)`);
    } catch {
      const insufficient = await checkInsufficientBalance(page);
      if (insufficient) return 'insufficient';
      throw new Error('Preview button click failed');
    }
  }
  await sleep(3000);

  const insufficientOnPreview = await checkInsufficientBalance(page);
  if (insufficientOnPreview) {
    console.log(`    Insufficient balance detected on preview page`);
    await recoverAfterCancel(page);
    return 'insufficient';
  }

  if (Object.keys(expected).length > 0) {
    await assertPreviewPage(page, expected);
  }

  if (verifyDepth === 'preview-and-cancel') {
    const cancelSel = '[data-testid="page-footer-cancel"]';
    try {
      await page.locator(cancelSel).click({ timeout: 5000 });
      console.log(`    Clicked cancel (page-footer-cancel)`);
    } catch {
      try {
        await page.locator('text=取消').first().click({ timeout: 3000 });
        console.log(`    Clicked cancel (text fallback)`);
      } catch {
        console.log(`    Cancel button not found, pressing Escape`);
        await page.keyboard.press('Escape');
      }
    }
    await recoverAfterCancel(page);
    return 'success';
  }

  // Full submit: click confirm on preview page
  console.log(`    Submitting transaction...`);
  try {
    const confirmBtn = page.locator(previewSel);
    await confirmBtn.click({ timeout: 10000 });
    console.log(`    Clicked confirm (submit)`);
  } catch {
    const insufficient = await checkInsufficientBalance(page);
    if (insufficient) return 'insufficient';
    throw new Error('Confirm button click failed');
  }
  await sleep(2000);

  // Handle password prompt if it appears after confirm
  const { handlePasswordPromptIfPresent } = await import('./navigation.mjs');
  const pwdResult = await handlePasswordPromptIfPresent(page);
  if (pwdResult.handled) {
    console.log(`    Password prompt handled after confirm`);
  }

  // Wait for transaction result — look for success toast or error
  let submitResult = 'unknown';
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const detection = await page.evaluate(() => {
      const bodyText = document.body?.textContent?.substring(0, 8000) || '';

      // Success indicators
      if (bodyText.includes('成功') || bodyText.includes('已发送') || bodyText.includes('已發送') ||
          bodyText.includes('交易已提交') || bodyText.includes('Transaction sent') ||
          bodyText.includes('Successfully') || bodyText.includes('submitted')) {
        return 'success';
      }

      // Check for success toast
      const toasts = document.querySelectorAll('[data-testid*="toast"], [data-testid*="Toast"], [role="status"]');
      for (const toast of toasts) {
        const t = toast.textContent || '';
        if (t.includes('成功') || t.includes('已发送') || t.includes('已發送') || t.includes('Success')) {
          return 'success';
        }
      }

      // Failure indicators
      if (bodyText.includes('失败') || bodyText.includes('失敗') || bodyText.includes('错误') || bodyText.includes('錯誤') ||
          bodyText.includes('Failed') || bodyText.includes('Error')) {
        // Check if it's a real error dialog, not just background text
        const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"], [data-testid*="alert"]');
        for (const d of dialogs) {
          const dt = d.textContent || '';
          if (dt.includes('失败') || dt.includes('Failed') || dt.includes('错误')) {
            return 'failed';
          }
        }
      }

      // Still on preview/confirm page — waiting
      const confirmBtn = document.querySelector('[data-testid="page-footer-confirm"]');
      if (confirmBtn && confirmBtn.getBoundingClientRect().width > 0) {
        return 'waiting';
      }

      return 'waiting';
    });

    if (detection === 'success') {
      submitResult = 'success';
      console.log(`    Transaction success detected (waited ${i + 1}s)`);
      break;
    }
    if (detection === 'failed') {
      submitResult = 'failed';
      console.log(`    Transaction failure detected (waited ${i + 1}s)`);
      break;
    }
  }

  if (submitResult === 'success') {
    // Dismiss success toast/dialog and recover to home
    await sleep(2000);
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(500);
    return 'success';
  }

  if (submitResult === 'failed') {
    await dismissErrorDialogs(page);
    await recoverAfterCancel(page);
    throw new Error('Transaction submission failed');
  }

  // Timeout — couldn't detect result after 30s
  console.log(`    Transaction result unclear after 30s, checking page state...`);
  const finalCheck = await page.evaluate(() => {
    const bodyText = document.body?.textContent?.substring(0, 5000) || '';
    return bodyText.substring(0, 500);
  });
  console.log(`    Page text: ${finalCheck.substring(0, 200)}`);
  await recoverAfterCancel(page);
  throw new Error('Transaction result detection timeout (30s)');
}

/**
 * Execute a complete transfer flow with amount fallback.
 * @returns {{ status: string, amount_used: string, reason: string|null }}
 */
export async function executeTransferFlow(page, { testId, network, token, amount, amount_fallback, memo, sender, recipient, verifyDepth = 'preview-and-cancel' }) {
  console.log(`  [${testId}] Open send form for ${token}...`);
  try {
    await openSendForm(page, token);
  } catch (e) {
    if (e.message.includes('No assets')) return { status: 'insufficient', amount_used: amount, reason: 'no_assets' };
    throw e;
  }

  console.log(`  [${testId}] Select recipient: ${recipient}...`);
  await selectRecipientFromContacts(page, recipient);
  await sleep(1000);

  if (memo) {
    console.log(`  [${testId}] Enter memo: ${memo}...`);
    await enterMemo(page, memo);
  }

  const expected = {
    network: network || null,
    token: token || null,
    amount,
    memo: memo || null,
  };

  // Try 1: Specified amount
  console.log(`  [${testId}] Enter amount: ${amount}...`);
  await enterAmount(page, amount);

  console.log(`  [${testId}] Preview (depth: ${verifyDepth})...`);
  const result1 = await clickPreviewAndVerify(page, testId, verifyDepth, expected);

  if (result1 !== 'insufficient') {
    return { status: result1, amount_used: amount, reason: null };
  }

  // Try 2: Amount fallback (Max)
  if (amount_fallback && amount !== amount_fallback) {
    console.log(`  [${testId}] Amount ${amount} insufficient, falling back to ${amount_fallback}...`);

    await screenshot(page, RESULTS_DIR, `${testId}-insufficient-${amount}`);
    await dismissErrorDialogs(page);

    const formStillOpen = await page.locator(SEND_FORM_SEL).isVisible({ timeout: 2000 }).catch(() => false);
    if (!formStillOpen) {
      console.log(`  [${testId}] Send form closed after error, cannot retry with fallback`);
      return { status: 'insufficient', amount_used: amount, reason: 'form_closed_after_error' };
    }

    const amountInput = page.locator(`${SEND_FORM_SEL} input`).first();
    const inputVisible = await amountInput.isVisible({ timeout: 2000 }).catch(() => false);
    if (inputVisible) {
      await amountInput.click();
      await amountInput.fill('');
      await sleep(300);
    }

    await enterAmount(page, amount_fallback);
    await sleep(1000);

    const result2 = await clickPreviewAndVerify(page, testId, verifyDepth, expected);
    if (result2 !== 'insufficient') {
      return { status: result2, amount_used: amount_fallback, reason: `fallback_from_${amount}` };
    }

    await screenshot(page, RESULTS_DIR, `${testId}-insufficient-max`);
  }

  return { status: 'insufficient', amount_used: amount_fallback || amount, reason: 'both_amounts_insufficient' };
}
