// Transfer helpers — send form, recipient, amount, memo, preview, full flow
// Extracted from src/runner/index.mjs — uses direct testid selectors

import { sleep, screenshot, RESULTS_DIR } from './index.mjs';
import { ACCOUNTS } from './accounts.mjs';
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
  const TOGGLE_SELECTOR = (container) => {
    const paths = container.querySelectorAll('path, svg');
    for (const p of paths) {
      const r = p.getBoundingClientRect();
      if (r.width > 8 && r.width < 30 && r.height > 8 && r.height < 30 &&
          r.y > 200 && r.y < 450 && r.x > 350 && r.x < 700) {
        return p;
      }
    }
    return null;
  };

  // Click toggle to show fiat
  const toggled = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    const container = modal || document;
    const paths = container.querySelectorAll('path, svg');
    for (const p of paths) {
      const r = p.getBoundingClientRect();
      if (r.width > 8 && r.width < 30 && r.height > 8 && r.height < 30 &&
          r.y > 200 && r.y < 450 && r.x > 350 && r.x < 700) {
        (p.closest('[role="button"]') || p.parentElement)?.click() || p.click();
        return true;
      }
    }
    return false;
  });
  if (!toggled) throw new Error('法币切换按钮未找到');
  await sleep(1500);

  // Read fiat display
  const fiatAmount = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
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
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    const container = modal || document;
    const paths = container.querySelectorAll('path, svg');
    for (const p of paths) {
      const r = p.getBoundingClientRect();
      if (r.width > 8 && r.width < 30 && r.height > 8 && r.height < 30 &&
          r.y > 200 && r.y < 450 && r.x > 350 && r.x < 700) {
        (p.closest('[role="button"]') || p.parentElement)?.click() || p.click();
        return;
      }
    }
  });
  await sleep(1000);

  return fiatAmount;
}

/**
 * Open history record list, click latest transaction, verify fields, then close.
 * @param {string} token — expected token symbol (e.g., 'ATOM', 'CRO')
 * @returns {{ fields: string[] }} Matched verification fields
 */
export async function verifyHistoryRecord(page, token) {
  // Click "历史记录"
  const historyClicked = await page.evaluate(() => {
    for (const sp of document.querySelectorAll('span')) {
      if (sp.textContent?.trim() === '历史记录' && sp.getBoundingClientRect().width > 0) {
        sp.click();
        return true;
      }
    }
    return false;
  });
  if (!historyClicked) throw new Error('历史记录按钮未找到');
  await sleep(2000);

  // Verify latest record exists and click it
  const latestTx = page.locator('[data-testid="tx-action-common-list-view"]').first();
  const txVisible = await latestTx.isVisible({ timeout: 5000 }).catch(() => false);
  if (!txVisible) throw new Error('历史记录中未找到交易');
  await latestTx.click();
  await sleep(2000);

  // Read detail content
  const detailText = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    return (modal || document.body).textContent?.substring(0, 3000) || '';
  });

  const fields = [];
  if (detailText.includes(token)) fields.push('token');
  if (detailText.includes('发送') || detailText.includes('Send')) fields.push('type');
  if (detailText.includes('哈希') || detailText.includes('Hash') || detailText.includes('hash')) fields.push('hash');
  if (detailText.includes('费用') || detailText.includes('Fee')) fields.push('fee');
  if (detailText.includes('处理中') || detailText.includes('已确认') || detailText.includes('Pending') || detailText.includes('Confirmed')) fields.push('status');

  // Close detail
  const closeBtn = page.locator('[data-testid="nav-header-close"]');
  await closeBtn.click({ timeout: 3000 }).catch(() => page.keyboard.press('Escape'));
  await sleep(1000);

  return { fields };
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
  const amountInput = page.locator('input[placeholder="0"]').first();
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
  const hasZeroError = zeroText.includes('无法发送 0') || zeroText.includes('0 金额') || zeroText.includes('cannot send 0');
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
  if (!btnText.includes('资金不足') && !btnText.includes('Insufficient') && !btnText.includes('不足')) {
    throw new Error(`按钮文案不是"资金不足": "${btnText}"`);
  }
  results.overBalance = `按钮="${btnText}"`;

  return results;
}

/**
 * Open send form for a given token.
 * Clicks "发送" in wallet tab header, then selects token if a picker appears.
 */
export async function openSendForm(page, token) {
  // Quick dismiss any residual backdrops
  await page.evaluate(() => {
    document.querySelectorAll('[data-testid="app-modal-stacks-backdrop"]').forEach(el => el.click());
  }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(300);

  // Click 发送
  await page.evaluate(() => {
    const header = document.querySelector('[data-testid="Wallet-Tab-Header"]');
    if (!header) return;
    for (const sp of header.querySelectorAll('span')) {
      if (sp.textContent?.trim() === '发送' && sp.getBoundingClientRect().width > 0) {
        sp.click();
        return;
      }
    }
  });
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
    if (modal.textContent?.includes('没有资产')) return 'no_assets';
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
    let searchInput = page.locator('[data-testid="APP-Modal-Screen"] input[placeholder*="搜索"]').first();
    let hasSearch = await searchInput.isVisible({ timeout: 1000 }).catch(() => false);
    if (!hasSearch) {
      searchInput = page.locator('input[placeholder="搜索资产"]').first();
      hasSearch = await searchInput.isVisible({ timeout: 1000 }).catch(() => false);
    }
    if (hasSearch) {
      await searchInput.click();
      await sleep(200);
      await searchInput.pressSequentially(token, { delay: 50 });
      await sleep(1500);
      await page.evaluate((tk) => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        if (!modal) return;
        for (const sp of modal.querySelectorAll('span')) {
          if (sp.textContent?.trim() === tk && sp.getBoundingClientRect().width > 0) {
            const row = sp.closest('[role="button"]') || sp.parentElement?.parentElement;
            (row || sp).click();
            return;
          }
        }
      }, token);
    }
  }
  console.log(`    Selected token ${token} (${clicked || 'search'})`);
  await sleep(1500);

  await page.locator(SEND_FORM_SEL).waitFor({ state: 'visible', timeout: 8000 });
}

/**
 * Select recipient on the send form.
 * New UI flow: send form has tabs (最近 / 账户 / 地址簿) inline.
 * Click "账户" tab → click recipient account by label or testid.
 */
export async function selectRecipientFromContacts(page, recipientName) {
  const recipient = ACCOUNTS[recipientName];
  if (!recipient) throw new Error(`Unknown recipient account: ${recipientName}`);

  // Click "账户" tab on the send form
  const tabClicked = await page.evaluate(() => {
    const form = document.querySelector('[data-testid="send-recipient-amount-form"]') || document.body;
    for (const sp of form.querySelectorAll('span')) {
      if (sp.textContent?.trim() === '账户' && sp.getBoundingClientRect().width > 0) {
        sp.click();
        return true;
      }
    }
    return false;
  });

  if (!tabClicked) {
    // Fallback: try clicking "账户" anywhere visible
    await page.locator('text=账户').first().click({ timeout: 5000 });
  }
  console.log(`    Clicked "账户" tab`);
  await sleep(2000);

  // Click recipient account — try by testid pattern first (recipient-item-<address>)
  const recipientClicked = await page.evaluate((label) => {
    // Find recipient item containing the account label text
    const items = document.querySelectorAll('[data-testid^="recipient-item-"]');
    for (const item of items) {
      const r = item.getBoundingClientRect();
      if (r.width > 0 && item.textContent?.includes(label)) {
        item.click();
        return item.getAttribute('data-testid');
      }
    }
    // Fallback: find span with label text and click its parent row
    for (const sp of document.querySelectorAll('span')) {
      const r = sp.getBoundingClientRect();
      if (r.width > 0 && sp.textContent?.trim() === label) {
        const row = sp.closest('[data-testid^="recipient-item-"]') ||
                    sp.closest('[role="button"]') ||
                    sp.parentElement?.parentElement;
        if (row) { row.click(); return 'fallback-label'; }
      }
    }
    return null;
  }, recipient.label);

  if (recipientClicked) {
    console.log(`    Selected recipient ${recipient.label} (${recipientClicked})`);
  } else {
    throw new Error(`Recipient "${recipient.label}" not found in 账户 tab`);
  }
  await sleep(3000);
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
    let amountInput = page.locator('[data-testid="APP-Modal-Screen"] input[placeholder="0"]').first();
    let visible = await amountInput.isVisible({ timeout: 1000 }).catch(() => false);

    if (!visible) {
      amountInput = page.locator(`${SEND_FORM_SEL} input`).first();
      visible = await amountInput.isVisible({ timeout: 1000 }).catch(() => false);
    }

    if (!visible) {
      amountInput = page.locator('input[placeholder="0"]').first();
      visible = await amountInput.isVisible({ timeout: 2000 }).catch(() => false);
    }

    if (!visible) throw new Error('Amount input not found');

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
    if (bodyText.includes('不足') || bodyText.includes('insufficient') || bodyText.includes('Insufficient')) {
      return true;
    }
    const confirmBtn = document.querySelector('[data-testid="page-footer-confirm"]');
    if (confirmBtn && (confirmBtn.disabled || confirmBtn.getAttribute('aria-disabled') === 'true')) {
      return true;
    }
    return false;
  });
}

/**
 * Assert preview page content against expected values.
 */
export async function assertPreviewPage(page, expected) {
  const previewContent = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
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
    const tail = addr.substring(addr.length - 4);
    const found = allText.includes(tail);
    checks.push({ field: 'recipient', expected: `...${tail}`, found, severity: found ? 'pass' : 'warn' });
  }
  if (expected.amount && expected.amount !== 'Max') {
    const found = allText.includes(expected.amount);
    checks.push({ field: 'amount', expected: expected.amount, found, severity: found ? 'pass' : 'warn' });
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
      if (bodyText.includes('成功') || bodyText.includes('已发送') ||
          bodyText.includes('交易已提交') || bodyText.includes('Transaction sent') ||
          bodyText.includes('Successfully') || bodyText.includes('submitted')) {
        return 'success';
      }

      // Check for success toast
      const toasts = document.querySelectorAll('[data-testid*="toast"], [data-testid*="Toast"], [role="status"]');
      for (const toast of toasts) {
        const t = toast.textContent || '';
        if (t.includes('成功') || t.includes('已发送') || t.includes('Success')) {
          return 'success';
        }
      }

      // Failure indicators
      if (bodyText.includes('失败') || bodyText.includes('错误') ||
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
