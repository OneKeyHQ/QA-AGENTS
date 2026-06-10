// Lightning Network Transfer Tests (Desktop) — LIGHTNING-001 ~ LIGHTNING-007
// Pay-request cases submit real Lightning payments; invalid cases stop before payment.

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  clickSidebarTab,
  closeAllModals,
  connectCDP,
  dismissErrorDialogs,
  ensureSingleNetworkMode,
  handlePasswordPromptIfPresent,
  RESULTS_DIR,
  screenshot,
  sleep,
  switchAccount,
  switchNetwork,
  unlockWalletIfNeeded,
} from '../../../helpers/index.mjs';
import { createStepTracker, safeStep } from '../../../helpers/components.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'lightning-transfer-screenshots');
mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(RESULTS_DIR, { recursive: true });

export const displayName = 'Lightning Network 转账';

const LN_ADDRESS = 'shortmen02@walletofsatoshi.com';
const LNURL = 'lnurl1dp68gurn8ghj7ampd3kx2ar0veekzar0wd5xjtnrdakj7tnhv4kxctttdehhwm30d3h82unvwqhhx6r0wf6x6etwxqeq3p2554';
const DEFAULT_INVOICE_AMOUNT = '1';
const DEFAULT_INVOICE_COMMENT = 'OneKey Invoice';

async function clearBlockingOverlays(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.evaluate(() => {
    for (const selector of [
      '[data-testid="ovelay-popover"]',
      '[data-testid="overlay-popover"]',
      '[data-testid="app-modal-stacks-backdrop"]',
    ]) {
      for (const el of document.querySelectorAll(selector)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) el.click();
      }
    }
  }).catch(() => {});
  await sleep(300);
}

async function goToWallet(page) {
  await clickSidebarTab(page, 'Wallet');
  await sleep(1500);
}

async function clickFooterConfirm(page) {
  const text = await page.waitForFunction(() => {
    const visible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0;
    };
    const btns = Array.from(document.querySelectorAll('[data-testid="page-footer-confirm"], [data-testid="lightning-lnurl-pay-confirm-btn"]'));
    const btn = btns.filter(visible).at(-1);
    return btn ? btn.textContent?.trim() || 'confirm' : false;
  }, { timeout: 5000 }).then((handle) => handle.jsonValue()).catch(() => '');
  const clicked = await page.evaluate(() => {
    const visible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0;
    };
    const btns = Array.from(document.querySelectorAll('[data-testid="page-footer-confirm"], [data-testid="lightning-lnurl-pay-confirm-btn"]'));
    const btn = btns.filter(visible).at(-1);
    if (!btn) return false;
    btn.click();
    return true;
  });
  if (!clicked) throw new Error('确认按钮未找到');
  await sleep(1500);
  return text || 'confirm';
}

async function getVisibleText(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0;
    };
    const modal = Array.from(document.querySelectorAll('[data-testid="APP-Modal-Screen"]')).filter(visible).at(-1);
    const container = modal || document.body;
    return container.textContent?.substring(0, 8000) || '';
  });
}

async function isFooterConfirmDisabled(page) {
  return page.evaluate(() => {
    const btns = document.querySelectorAll('[data-testid="page-footer-confirm"], [data-testid="lightning-lnurl-pay-confirm-btn"]');
    const btn = btns[btns.length - 1];
    if (!btn) return true;
    const style = window.getComputedStyle(btn);
    return (
      btn.disabled ||
      btn.getAttribute('aria-disabled') === 'true' ||
      style.pointerEvents === 'none' ||
      Number(style.opacity) < 0.65
    );
  });
}

async function openLightningSendForm(page, accountName = 'piggy') {
  await clearBlockingOverlays(page);
  await goToWallet(page);
  await clearBlockingOverlays(page);
  await ensureSingleNetworkMode(page);
  await switchNetwork(page, 'Lightning');
  await clearBlockingOverlays(page);

  await switchAccount(page, accountName);
  await sleep(1200);

  const clicked = await page.evaluate(() => {
    const header = document.querySelector('[data-testid="Wallet-Tab-Header"]') || document.body;
    for (const sp of header.querySelectorAll('span')) {
      if (sp.textContent?.trim() === '发送' && sp.getBoundingClientRect().width > 0) {
        sp.click();
        return true;
      }
    }
    return false;
  });
  if (!clicked) throw new Error('Lightning 发送入口未找到');
  await sleep(1500);
  await page.locator('[data-testid="send-recipient-amount-form"]').waitFor({ state: 'visible', timeout: 10000 });
}

async function fillLightningRecipient(page, recipient) {
  const selectors = [
    '[data-testid="send-recipient-input"] textarea',
    '[data-testid="send-recipient-input"] input',
    'textarea[placeholder*="Lightning"]',
    'textarea[placeholder*="闪电"]',
    'textarea[placeholder*="发票"]',
    'textarea',
  ];
  for (const selector of selectors) {
    const loc = page.locator(selector).first();
    if (!(await loc.isVisible({ timeout: 1000 }).catch(() => false))) continue;
    const filled = await loc.evaluate((el, value) => {
      const proto = el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      setter?.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: value.at(-1) || '' }));
      return el.value;
    }, recipient).catch(() => null);
    if (filled !== recipient) {
      await loc.click({ force: true, timeout: 2000 }).catch(() => {});
      await loc.fill(recipient, { force: true, timeout: 2000 }).catch(async () => {
        await loc.pressSequentially(recipient, { delay: 10 });
      });
    }
    await sleep(2500);
    return;
  }
  throw new Error('Lightning 收款信息输入框未找到');
}

async function openLightningReceiveInvoiceForm(page, accountName = 'vault') {
  await clearBlockingOverlays(page);
  await goToWallet(page);
  await clearBlockingOverlays(page);
  await ensureSingleNetworkMode(page);
  await switchNetwork(page, 'Lightning');
  await clearBlockingOverlays(page);
  await switchAccount(page, accountName);
  await sleep(1200);

  const clicked = await page.evaluate(() => {
    const header = document.querySelector('[data-testid="Wallet-Tab-Header"]') || document.body;
    for (const sp of header.querySelectorAll('span')) {
      if (sp.textContent?.trim() === '接收' && sp.getBoundingClientRect().width > 0) {
        sp.click();
        return true;
      }
    }
    return false;
  });
  if (!clicked) throw new Error('Lightning 接收入口未找到');

  const receiveFromWallet = page.locator('[data-testid="receive-from-wallet-option"]').first();
  if (await receiveFromWallet.isVisible({ timeout: 5000 }).catch(() => false)) {
    await receiveFromWallet.click({ timeout: 5000 });
  } else {
    const optionClicked = await page.evaluate(() => {
      for (const el of document.querySelectorAll('[data-testid="APP-Modal-Screen"] span, [data-testid="APP-Modal-Screen"] div')) {
        const text = el.textContent?.trim();
        const rect = el.getBoundingClientRect();
        if (text === '接收转账' && rect.width > 0 && rect.height > 0) {
          el.click();
          return true;
        }
      }
      return false;
    });
    if (!optionClicked) throw new Error('Lightning 接收转账入口未找到');
  }

  await page.locator('[data-testid="receive-create-invoice-page"]').waitFor({ state: 'visible', timeout: 10000 });
}

async function generateLightningInvoice(page, {
  amount,
  comment = DEFAULT_INVOICE_COMMENT,
  accountName = 'vault',
  testId = 'LIGHTNING',
}) {
  await openLightningReceiveInvoiceForm(page, accountName);

  if (amount) {
    const amountInput = page.locator('[data-testid="receive-create-invoice-amount-input"] input, [data-testid="receive-create-invoice-amount-input"]').first();
    await amountInput.click({ timeout: 5000 });
    await amountInput.fill(String(amount));
  }

  if (comment) {
    const descInput = page.locator('[data-testid="receive-create-invoice-description-input"] textarea, [data-testid="receive-create-invoice-description-input"]').first();
    const visible = await descInput.isVisible({ timeout: 3000 }).catch(() => false);
    if (visible) {
      await descInput.click();
      await descInput.fill(comment);
    }
  }

  await clickFooterConfirm(page);
  const invoiceText = page.locator('[data-testid="receive-invoice-text"]').first();
  await invoiceText.waitFor({ state: 'visible', timeout: 20000 });
  const invoice = ((await invoiceText.textContent({ timeout: 5000 })) || '').replace(/\s+/g, '').trim();
  if (!/^ln(bc|tb|bcrt)/i.test(invoice)) {
    throw new Error(`生成的 BOLT11 发票格式异常: ${invoice.slice(0, 80)}`);
  }
  await screenshot(page, SCREENSHOT_DIR, `${testId}-generated-invoice`);
  await closeAllModals(page).catch(() => {});
  await sleep(800);
  return invoice;
}

async function waitForLightningAmountPage(page, timeout = 20000) {
  const started = Date.now();
  let lastText = '';
  while (Date.now() - started < timeout) {
    const ready = await page.locator('[data-testid="lightning-send-amount-input"], [data-testid="send-amount-input"]').first().isVisible({ timeout: 500 }).catch(() => false);
    if (ready) return { waitedMs: Date.now() - started };
    lastText = await getVisibleText(page);
    if (/无效|invalid|expired|已支付|paid/i.test(lastText)) {
      throw new Error(`收款信息解析失败: ${lastText.substring(0, 240)}`);
    }
    await sleep(500);
  }
  throw new Error(`Lightning 金额页未出现: ${lastText.substring(0, 240)}`);
}

async function waitForLightningPayStep(page, timeout = 20000) {
  const started = Date.now();
  let lastText = '';
  while (Date.now() - started < timeout) {
    const hasAmountInput = await page.locator('[data-testid="lightning-send-amount-input"], [data-testid="send-amount-input"]').first().isVisible({ timeout: 300 }).catch(() => false);
    if (hasAmountInput) return { step: 'amount', waitedMs: Date.now() - started };

    const confirmReady = await page.evaluate(() => {
      const visible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const text = document.body?.textContent || '';
      const hasConfirm = Array.from(document.querySelectorAll('[data-testid="page-footer-confirm"], [data-testid="lightning-lnurl-pay-confirm-btn"]'))
        .some(visible);
      const hasPreviewText = text.includes('网络') && (text.includes('资产') || text.includes('金额') || text.includes('sats'));
      return hasConfirm && hasPreviewText;
    });
    if (confirmReady) return { step: 'confirm', waitedMs: Date.now() - started };

    lastText = await getVisibleText(page);
    if (/无效|invalid|expired|已支付|paid/i.test(lastText)) {
      throw new Error(`收款信息解析失败: ${lastText.substring(0, 240)}`);
    }
    await sleep(500);
  }
  throw new Error(`Lightning 支付步骤未出现: ${lastText.substring(0, 240)}`);
}

async function enterLightningAmount(page, amount) {
  const input = page.locator('[data-testid="lightning-send-amount-input"], [data-testid="send-amount-input"]').first();
  await input.waitFor({ state: 'visible', timeout: 10000 });
  await input.click();
  await input.fill(String(amount));
  await sleep(1000);
}

async function enterLightningComment(page, comment) {
  const input = page.locator('[data-testid="lightning-send-comment-input"]').first();
  if (!(await input.isVisible({ timeout: 1500 }).catch(() => false))) return 'comment field not visible';
  await input.click();
  await input.fill(comment);
  await sleep(500);
  return `comment=${comment}`;
}

async function assertTextGroups(page, groups) {
  const text = await getVisibleText(page);
  const missing = groups.filter((group) => !group.some((needle) => text.includes(needle)));
  if (missing.length) throw new Error(`缺少预期文案: ${missing.map((g) => g.join('/')).join(', ')}`);
  return `matched ${groups.length}/${groups.length}`;
}

async function assertLightningPreviewReachable(page) {
  if (await isFooterConfirmDisabled(page)) {
    const text = await getVisibleText(page);
    if (text.includes('不足')) return `余额不足，停在金额页: ${text.substring(0, 180)}`;
    throw new Error(`确认发送按钮不可提交: ${text.substring(0, 240)}`);
  }
  await screenshot(page, SCREENSHOT_DIR, 'lightning-preview-ready');
  return 'amount page ready; final payment confirm not clicked';
}

async function verifyLightningHistoryRecord(page, { amount }) {
  await closeAllModals(page).catch(() => {});
  await goToWallet(page);

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

  await page.waitForFunction(() => {
    const visible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0;
    };
    return Array.from(document.querySelectorAll('[data-testid="tx-action-common-list-view"]')).some(visible);
  }, { timeout: 15000 });
  const listText = await page.evaluate(() => {
    const visible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0;
    };
    const latest = Array.from(document.querySelectorAll('[data-testid="tx-action-common-list-view"]')).find(visible);
    return latest?.textContent || '';
  });
  const clickedTx = await page.evaluate(() => {
    const visible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0;
    };
    const latest = Array.from(document.querySelectorAll('[data-testid="tx-action-common-list-view"]')).find(visible);
    if (!latest) return false;
    latest.click();
    return true;
  });
  if (!clickedTx) throw new Error('历史记录中未找到可见交易');
  await sleep(2000);

  const detailText = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    return (modal || document.body).textContent?.substring(0, 5000) || '';
  });
  const text = `${listText}\n${detailText}`;
  const fields = [];
  if (text.includes(String(amount)) && /sats/i.test(text)) fields.push('amount');
  if (text.includes('发送') || /Send/i.test(text)) fields.push('type');
  if (text.includes('Lightning') || text.includes('闪电')) fields.push('network');
  if (text.includes('成功') || text.includes('已确认') || /Success|Confirmed|Completed/i.test(text)) fields.push('status');

  await page.locator('[data-testid="nav-header-close"]').click({ timeout: 3000 }).catch(() => page.keyboard.press('Escape'));
  await sleep(1000);

  const required = ['amount', 'type', 'status'];
  const missing = required.filter((field) => !fields.includes(field));
  if (missing.length) {
    throw new Error(`Lightning 历史记录字段缺失: ${missing.join(', ')}; text=${text.substring(0, 240)}`);
  }
  return fields;
}

async function waitForLightningPaymentResult(page, timeout = 45000) {
  const started = Date.now();
  let confirmClicks = 0;
  while (Date.now() - started < timeout) {
    await sleep(1000);
    const state = await page.evaluate(() => {
      const visible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const text = document.body?.textContent || '';
      const passwordVisible = Array.from(document.querySelectorAll('[data-testid="password-input"], input[type="password"], input[placeholder*="密码"]'))
        .some(visible);
      if (passwordVisible) return { type: 'password' };
      const confirmBtns = Array.from(document.querySelectorAll('[data-testid="page-footer-confirm"], [data-testid="lightning-lnurl-pay-confirm-btn"]'));
      const confirmBtn = confirmBtns.filter(visible).at(-1);
      if (text.includes('余额不足') || /Insufficient/i.test(text)) return { type: 'insufficient', text: text.substring(0, 240) };
      if (text.includes('失败') || text.includes('支付失败') || /Failed|Error/i.test(text)) return { type: 'failed', text: text.substring(0, 240) };
      if (text.includes('成功') || text.includes('支付成功') || text.includes('已发送') || /Success|Submitted|Completed/i.test(text)) {
        return { type: 'success' };
      }
      if (confirmBtn) {
        const style = window.getComputedStyle(confirmBtn);
        const disabled =
          confirmBtn.disabled ||
          confirmBtn.getAttribute('aria-disabled') === 'true' ||
          style.pointerEvents === 'none' ||
          Number(style.opacity) < 0.65;
        return { type: disabled ? 'confirm_disabled' : 'confirm' };
      }
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      const walletHome = document.querySelector('[data-testid="AccountSelectorTriggerBase"]');
      const confirmVisible = !!confirmBtn;
      if (visible(walletHome) && !visible(modal) && !confirmVisible) return { type: 'wallet' };
      return { type: 'waiting' };
    });

    if (state.type === 'password') {
      await handlePasswordPromptIfPresent(page);
      continue;
    }
    if (state.type === 'confirm') {
      if (confirmClicks >= 3) throw new Error('Lightning 支付确认按钮重复出现，无法判断是否已提交');
      confirmClicks += 1;
      await clickFooterConfirm(page);
      await handlePasswordPromptIfPresent(page);
      continue;
    }
    if (state.type === 'insufficient') throw new Error(`余额不足: ${state.text}`);
    if (state.type === 'success' || state.type === 'wallet') {
      return `${state.type} after ${Math.round((Date.now() - started) / 1000)}s`;
    }
    if (state.type === 'failed') throw new Error(`Lightning 支付失败: ${state.text}`);
  }
  throw new Error(`Lightning 支付 ${Math.round(timeout / 1000)}s 内未完成`);
}

async function submitLightningPayment(page, tc) {
  await screenshot(page, SCREENSHOT_DIR, `${tc.id}-before-payment-submit`);
  await clickFooterConfirm(page);
  await handlePasswordPromptIfPresent(page);
  const paymentResult = await waitForLightningPaymentResult(page);
  const historyFields = await verifyLightningHistoryRecord(page, { amount: tc.amount });
  return `${paymentResult}; history verified: ${historyFields.join(', ')}`;
}

async function closeCurrentFlow(page) {
  await closeAllModals(page).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(800);
}

const LIGHTNING_CASES = [
  {
    id: 'LIGHTNING-001',
    name: 'LN Address 中间值金额 + 描述输入',
    recipient: LN_ADDRESS,
    amount: '1000',
    comment: 'OneKey Invoice',
    kind: 'pay-request',
  },
  {
    id: 'LIGHTNING-002',
    name: 'LNURL 中间值金额解析',
    recipient: LNURL,
    amount: '1000',
    comment: 'OneKey Invoice',
    kind: 'pay-request',
  },
  {
    id: 'LIGHTNING-006',
    name: 'BOLT11 指定金额发票支付',
    amount: DEFAULT_INVOICE_AMOUNT,
    kind: 'invoice-pay-request',
    generatedInvoice: {
      amount: DEFAULT_INVOICE_AMOUNT,
      accountName: 'vault',
      comment: DEFAULT_INVOICE_COMMENT,
    },
  },
  {
    id: 'LIGHTNING-007',
    name: 'BOLT11 未指定金额发票支付',
    amount: DEFAULT_INVOICE_AMOUNT,
    comment: DEFAULT_INVOICE_COMMENT,
    kind: 'invoice-pay-request',
    generatedInvoice: {
      amount: '',
      accountName: 'vault',
      comment: DEFAULT_INVOICE_COMMENT,
    },
  },
  {
    id: 'LIGHTNING-003',
    name: 'LN Address 金额 0 拦截',
    recipient: LN_ADDRESS,
    amount: '0',
    kind: 'invalid-amount',
    expectedTextGroups: [['请输入金额', '金额', '0', 'required']],
  },
  {
    id: 'LIGHTNING-004',
    name: 'LN Address 超 1 BTC 金额拦截',
    recipient: LN_ADDRESS,
    amount: '100000001',
    kind: 'invalid-amount',
    expectedTextGroups: [['100000000', '1 BTC', '不得超过', 'between']],
  },
  {
    id: 'LIGHTNING-005',
    name: 'LN Address 格式错误拦截',
    recipient: 'user@invalid',
    kind: 'invalid-recipient',
    expectedTextGroups: [['无效', 'invalid', '地址']],
  },
];

async function runLightningCase(page, tc) {
  const t = createStepTracker(tc.id);
  const _ss = (name, fn) => safeStep(page, t, name, fn, SCREENSHOT_DIR);

  let recipient = tc.recipient;
  if (tc.generatedInvoice) {
    const invoiceGenerated = await _ss('生成 Lightning 发票', async () => {
      recipient = await generateLightningInvoice(page, {
        ...tc.generatedInvoice,
        testId: tc.id,
      });
      return `${tc.generatedInvoice.amount ? `${tc.generatedInvoice.amount} sats` : 'open amount'} invoice`;
    });
    if (!invoiceGenerated) return t.result();
  }

  if (!await _ss('打开 Lightning 发送页', async () => {
    await openLightningSendForm(page);
    return 'send form';
  })) return t.result();

  if (!await _ss('输入收款信息', async () => {
    await fillLightningRecipient(page, recipient);
    return recipient.slice(0, 32);
  })) return t.result();

  if (tc.kind === 'invalid-recipient') {
    await _ss('验证无效收款信息拦截', async () => {
      await sleep(1500);
      await assertTextGroups(page, tc.expectedTextGroups);
      if (!(await isFooterConfirmDisabled(page))) throw new Error('下一步按钮未置灰');
      await screenshot(page, SCREENSHOT_DIR, `${tc.id}-invalid-recipient`);
      return 'invalid recipient blocked';
    });
    await closeCurrentFlow(page);
    return t.result();
  }

  if (!await _ss('解析进入金额页', async () => {
    await clickFooterConfirm(page);
    const state = tc.kind === 'invoice-pay-request'
      ? await waitForLightningPayStep(page)
      : await waitForLightningAmountPage(page);
    tc._payStep = state.step || 'amount';
    return `${tc._payStep} loaded in ${state.waitedMs}ms`;
  })) return t.result();

  if (tc._payStep !== 'confirm') {
    if (!await _ss(`输入金额 ${tc.amount}`, async () => {
      await enterLightningAmount(page, tc.amount);
      if (tc.comment) return enterLightningComment(page, tc.comment);
      return String(tc.amount);
    })) return t.result();
  } else {
    t.add(`输入金额 ${tc.amount}`, 'skipped', '指定金额发票已锁定金额');
  }

  if (tc.kind === 'invalid-amount') {
    await _ss('验证金额拦截', async () => {
      await assertTextGroups(page, tc.expectedTextGroups);
      if (!(await isFooterConfirmDisabled(page))) throw new Error('确认发送按钮未置灰');
      await screenshot(page, SCREENSHOT_DIR, `${tc.id}-invalid-amount`);
      return 'invalid amount blocked';
    });
  } else {
    await _ss('确认发送前状态校验', async () => assertLightningPreviewReachable(page));
    await _ss('提交 Lightning 支付并校验历史', async () => submitLightningPayment(page, tc));
  }

  await closeCurrentFlow(page);
  return t.result();
}

export const testCases = LIGHTNING_CASES.map((tc) => ({
  id: tc.id,
  name: tc.name,
  fn: (page) => runLightningCase(page, tc),
}));

export async function setup() {
  return undefined;
}

export async function run() {
  const filter = process.argv.slice(2).find((arg) => arg.startsWith('LIGHTNING-'));
  const cases = filter ? testCases.filter((tc) => tc.id === filter) : testCases;

  if (cases.length === 0) {
    console.error(`No cases matching "${filter}"`);
    console.error('Available:', testCases.map((tc) => tc.id).join(', '));
    return { status: 'error', error: `No match: ${filter}` };
  }

  const { page } = await connectCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Lightning Network Transfer Tests — ${cases.length} case(s)`);
  console.log('='.repeat(60));

  await unlockWalletIfNeeded(page);
  await setup(page);

  const results = [];
  for (const tc of cases) {
    const startTime = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`▶ ${tc.id}: ${tc.name}`);
    console.log('─'.repeat(60));

    try {
      const result = await tc.fn(page);
      const duration = Date.now() - startTime;
      const row = {
        testId: tc.id,
        status: result.status,
        duration,
        steps: result.steps,
        summary: result.summary,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      };
      console.log(`\n◆ ${tc.id}: ${row.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s) — ${row.summary.passed}✓ ${row.summary.failed}✗ ${row.summary.skipped}⊘`);
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(row, null, 2));
      results.push(row);
    } catch (error) {
      const duration = Date.now() - startTime;
      const shot = await screenshot(page, SCREENSHOT_DIR, `${tc.id}-fatal`).catch(() => null);
      const row = {
        testId: tc.id,
        status: 'failed',
        duration,
        error: error.message,
        screenshot: shot,
        timestamp: new Date().toISOString(),
      };
      console.error(`\n◆ ${tc.id}: FAILED (${(duration / 1000).toFixed(1)}s): ${error.message}`);
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(row, null, 2));
      results.push(row);
    }

    await dismissErrorDialogs(page).catch(() => {});
    await closeCurrentFlow(page);
    await goToWallet(page).catch(() => {});
    await sleep(1000);
  }

  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.filter((r) => r.status !== 'passed').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));

  const summary = { timestamp: new Date().toISOString(), total: results.length, passed, failed, results };
  writeFileSync(resolve(RESULTS_DIR, 'lightning-transfer-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run()
    .then((result) => process.exit(result.status === 'passed' ? 0 : 1))
    .catch((error) => {
      console.error('Fatal:', error);
      process.exit(2);
    });
}
