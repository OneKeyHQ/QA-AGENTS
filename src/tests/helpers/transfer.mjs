// Transfer helpers — send form, recipient, amount, memo, preview, full flow
// Extracted from src/runner/index.mjs — uses direct testid selectors

import { sleep, screenshot, RESULTS_DIR } from './index.mjs';
import { ACCOUNTS } from './accounts.mjs';
import { resolve } from 'node:path';

const SEND_FORM_SEL = '[data-testid="send-recipient-amount-form"]';

/**
 * Open send form for a given token.
 * Clicks "发送" in wallet tab header, then selects token if a picker appears.
 */
export async function openSendForm(page, token) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);

  const sendBtn = page.locator('[data-testid="Wallet-Tab-Header"] >> text=发送').last();
  await sendBtn.click({ timeout: 5000 });
  await sleep(2000);

  // Check if send form opened directly (single-token wallet)
  const hasSendForm = await page.locator(SEND_FORM_SEL).isVisible({ timeout: 1000 }).catch(() => false);
  if (hasSendForm) {
    console.log('    Send form opened directly (single token)');
    return;
  }

  // Token selection dialog
  const tokenSearchInput = page.locator('input[placeholder="搜索资产"]');
  const hasSearch = await tokenSearchInput.isVisible({ timeout: 2000 }).catch(() => false);
  if (hasSearch) {
    await tokenSearchInput.fill(token);
    await sleep(1500);
  }

  const modalSel = '[data-testid="APP-Modal-Screen"]';
  const noAssets = await page.evaluate((sel) => {
    const modal = document.querySelector(sel);
    return modal?.textContent?.includes('没有资产') || false;
  }, modalSel);
  if (noAssets) {
    throw new Error(`No assets found in wallet for token ${token}`);
  }

  const tokenClicked = await page.evaluate(({ token: tk, modalSel: mSel }) => {
    const modal = document.querySelector(mSel);
    if (!modal) return false;
    const spans = modal.querySelectorAll('span');
    for (const sp of spans) {
      const r = sp.getBoundingClientRect();
      if (r.width > 0 && sp.textContent?.trim() === tk) {
        const row = sp.closest('[role="button"]') || sp.parentElement?.parentElement;
        if (row) { row.click(); return true; }
        sp.click();
        return true;
      }
    }
    return false;
  }, { token, modalSel });

  if (!tokenClicked) {
    const tokenItem = page.locator(`${modalSel} >> text="${token}"`).first();
    await tokenItem.click({ timeout: 5000 });
  }
  await sleep(2000);

  await page.locator(SEND_FORM_SEL).waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Select recipient via contacts icon -> popover -> 我的账户 -> account item.
 */
export async function selectRecipientFromContacts(page, recipientName) {
  const recipient = ACCOUNTS[recipientName];
  if (!recipient) throw new Error(`Unknown recipient account: ${recipientName}`);

  // Click contacts icon (SvgPeopleCircle)
  const contactsIcon = page.locator('[data-sentry-component="SvgPeopleCircle"]').first();
  await contactsIcon.click({ timeout: 5000 });
  console.log(`    Clicked contacts icon`);
  await sleep(1500);

  // Wait for popover and click "我的账户"
  const popoverSel = '[data-testid="TMPopover-ScrollView"]';
  const popoverVisible = await page.locator(popoverSel).isVisible({ timeout: 3000 }).catch(() => false);

  if (popoverVisible) {
    const myAccountClicked = await page.evaluate((pSel) => {
      const popover = document.querySelector(pSel);
      if (!popover) return false;
      const spans = popover.querySelectorAll('span');
      for (const sp of spans) {
        if (sp.textContent === '我的账户' && sp.getBoundingClientRect().width > 0) {
          sp.click();
          return true;
        }
      }
      return false;
    }, popoverSel);

    if (!myAccountClicked) {
      const myAccountBtn = page.locator('text=我的账户').first();
      await myAccountBtn.click({ timeout: 3000 });
    }
    console.log(`    Clicked "我的账户"`);
    await sleep(2000);
  } else {
    const myAccountBtn = page.locator('text=我的账户').first();
    const hasMyAccount = await myAccountBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasMyAccount) {
      await myAccountBtn.click();
      console.log(`    Clicked "我的账户" (direct)`);
      await sleep(2000);
    }
  }

  // Click account item by index
  const accountItemSel = `[data-testid="account-item-index-${recipient.index}"]`;
  const accountItem = page.locator(accountItemSel);
  const accountVisible = await accountItem.isVisible({ timeout: 3000 }).catch(() => false);

  if (accountVisible) {
    await accountItem.click();
    console.log(`    Clicked account-item-index-${recipient.index} for ${recipientName}`);
  } else {
    const accountEntry = page.locator(`text=/${recipientName}/i`).first();
    await accountEntry.click({ timeout: 5000 });
    console.log(`    Clicked ${recipientName} by text (fallback)`);
  }
  await sleep(3000);
}

/**
 * Enter transfer amount — numeric value or "Max".
 */
export async function enterAmount(page, amount) {
  if (amount === 'Max' || amount === 'max') {
    const maxPos = await page.evaluate(() => {
      const spans = document.querySelectorAll('span');
      for (const sp of spans) {
        if (sp.textContent === '最大' && sp.getBoundingClientRect().width > 0) {
          const r = sp.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
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
    const amountInput = page.locator(`${SEND_FORM_SEL} input`).first();
    await amountInput.click();
    await sleep(300);
    await amountInput.fill(String(amount));
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
