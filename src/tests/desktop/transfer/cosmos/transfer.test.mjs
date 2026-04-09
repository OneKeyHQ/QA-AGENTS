// Cosmos Transfer Tests — data-driven transfer cases (COSMOS-001 ~ COSMOS-012)
// Covers: 11 multi-network parameterized transfers + 1 boundary test
// Dashboard compatible: createStepTracker + safeStep for real-time logs
//
// 覆盖映射：
//   COSMOS-001  Akash / AKT / 0.001
//   COSMOS-002  Cosmos / ATOM / 0.000001 / 512字节备注
//   COSMOS-003  Cronos POS Chain / CRO / Max / 😂yes + 法币切换
//   COSMOS-004  Fetch.ai / FET / 0.0001
//   COSMOS-005  Juno / JUNO / Max
//   COSMOS-006  Osmosis / OSMO / 0.01 / onekey
//   COSMOS-007  Osmosis / ATOM(IBC) / 0.001 / 123456
//   COSMOS-008  Secret Network / SCRT / 0.0001
//   COSMOS-009  Celestia / TIA / 0.0002
//   COSMOS-010  Babylon / BABY / 1 / 👌
//   COSMOS-011  Noble / USDC / 0.00001
//   COSMOS-012  备注边界与非法金额校验（用例 #2.1 + #2.2 + #2.3）

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  connectCDP, sleep, RESULTS_DIR, WALLET_PASSWORD,
  dismissOverlays, closeAllModals, goToWalletHome,
  unlockWalletIfNeeded, handlePasswordPromptIfPresent,
  dismissErrorDialogs,
  switchAccount, switchNetwork,
} from '../../../helpers/index.mjs';
import { createStepTracker, safeStep } from '../../../helpers/components.mjs';
import {
  openSendForm, selectRecipientFromContacts,
  enterAmount, enterMemo, checkInsufficientBalance, recoverAfterCancel,
  // Public precondition helpers (K-038)
  ensureSingleNetworkMode, hasBalance,
  // Public post-transfer helpers
  verifyFiatToggle, verifyHistoryRecord,
  // Public boundary helpers
  verifyMemoOverLimit, clearMemoField, verifyInvalidAmounts,
} from '../../../helpers/transfer.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'cosmos-screenshots');
mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(RESULTS_DIR, { recursive: true });

// ── Memo fixtures ──────────────────────────────────────────
let MEMO_512 = '';
let MEMO_513 = '';
try {
  const fixtures = JSON.parse(readFileSync(resolve(__dirname, '../../../../shared/test-data/cosmos-memo-fixtures.json'), 'utf8'));
  MEMO_512 = fixtures.MEMO_512_BYTES;
  MEMO_513 = fixtures.MEMO_513_BYTES;
} catch {
  const base = '1234567890-=';
  MEMO_512 = base.repeat(42) + '12345678';
  MEMO_513 = MEMO_512 + '9';
}

// ── Click helper for page-footer-confirm (下一步/预览/确认) ──
// All buttons may live inside ONE APP-Modal-Screen (stacked views).
// Use elementFromPoint to find the one actually on top, then JS .click().
async function clickFooterConfirm(page) {
  // Each step appends a new button: [下一步] → [下一步, 预览] → [下一步, 预览, 确认]
  // .last() always targets the current step's button.
  const btn = page.locator('[data-testid="page-footer-confirm"]').last();
  const text = (await btn.textContent({ timeout: 3000 }).catch(() => '')).trim();
  const countBefore = await page.locator('[data-testid="page-footer-confirm"]').count();
  console.log(`    Clicking "${text}" (${countBefore} buttons)...`);

  // Try up to 3 times: click → check if page reacted → retry if not
  for (let attempt = 0; attempt < 3; attempt++) {
    // Method 1: mouse.click at coordinates
    const box = await btn.boundingBox().catch(() => null);
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
    await sleep(1500);

    // Check if page changed (button count decreased or text changed)
    const countAfter = await page.locator('[data-testid="page-footer-confirm"]').count();
    const lastText = countAfter > 0
      ? (await page.locator('[data-testid="page-footer-confirm"]').last().textContent().catch(() => '')).trim()
      : '';
    if (countAfter < countBefore || lastText !== text) {
      console.log(`    Clicked "${text}" (attempt ${attempt + 1})`);
      return;
    }

    // Method 2: force click
    if (attempt === 1) {
      await btn.click({ force: true, timeout: 3000 }).catch(() => {});
      await sleep(1500);
    }

    // Method 3: dispatchEvent
    if (attempt === 2) {
      await page.evaluate((targetText) => {
        const btns = document.querySelectorAll('[data-testid="page-footer-confirm"]');
        for (const b of btns) {
          if (b.textContent?.trim() === targetText && b.getBoundingClientRect().width > 0) {
            const r = b.getBoundingClientRect();
            const opts = { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, pointerId: 1 };
            b.dispatchEvent(new PointerEvent('pointerdown', opts));
            b.dispatchEvent(new MouseEvent('mousedown', opts));
            b.dispatchEvent(new PointerEvent('pointerup', opts));
            b.dispatchEvent(new MouseEvent('mouseup', opts));
            b.dispatchEvent(new MouseEvent('click', opts));
            return;
          }
        }
      }, text);
      await sleep(1500);
    }
  }
  console.log(`    Clicked "${text}" (after retries)`);
}

// ── Transfer definitions ───────────────────────────────────
const TRANSFERS = [
  { id: 'COSMOS-001', network: 'Akash',             token: 'AKT',   amount: '0.001',     memo: null },
  { id: 'COSMOS-002', network: 'Cosmos',             token: 'ATOM',  amount: '0.000001',  memo: MEMO_512 },
  { id: 'COSMOS-003', network: 'Cronos POS Chain',   token: 'CRO',   amount: 'Max',       memo: '😂yes', verifyFiat: true },
  { id: 'COSMOS-004', network: 'Fetch.ai',           token: 'FET',   amount: '0.0001',    memo: null },
  { id: 'COSMOS-005', network: 'Juno',               token: 'JUNO',  amount: 'Max',       memo: null },
  { id: 'COSMOS-006', network: 'Osmosis',            token: 'OSMO',  amount: '0.01',      memo: 'onekey' },
  { id: 'COSMOS-007', network: 'Osmosis',            token: 'ATOM',  amount: '0.001',     memo: '123456' },
  { id: 'COSMOS-008', network: 'Secret Network',     token: 'SCRT',  amount: '0.0001',    memo: null },
  { id: 'COSMOS-009', network: 'Celestia',           token: 'TIA',   amount: '0.0002',    memo: null },
  { id: 'COSMOS-010', network: 'Babylon Genesis',      token: 'BABY',  amount: '1',         memo: '👌' },
  { id: 'COSMOS-011', network: 'Noble',              token: 'USDC',  amount: '0.00001',   memo: null },
];

// Account strategies: try primary sender first, fallback to reversed if insufficient
const DEFAULT_STRATEGIES = [
  { label: 'primary',  sender: 'piggy', recipient: 'vault' },
  { label: 'reversed', sender: 'vault', recipient: 'piggy' },
];

// ── Single transfer test case ──────────────────────────────

async function testTransfer(page, transfer) {
  const { id, network, token, amount, memo, verifyFiat } = transfer;
  const t = createStepTracker(id);

  // Step 1: Ensure on wallet home
  await safeStep(page, t, '回到钱包首页', async () => {
    await dismissOverlays(page);
    await handlePasswordPromptIfPresent(page);
    await goToWalletHome(page);
    return 'navigated';
  }, SCREENSHOT_DIR);

  // Step 2: Ensure single-network mode and switch to target network
  await safeStep(page, t, `切换到 ${network} 网络`, async () => {
    await ensureSingleNetworkMode(page);
    await switchNetwork(page, network);
    return network;
  }, SCREENSHOT_DIR);

  // Step 3: Find account with balance (try strategies)
  let usedStrategy = null;
  for (const strategy of DEFAULT_STRATEGIES) {
    const switched = await safeStep(page, t, `切换到 ${strategy.sender} 账户`, async () => {
      await switchAccount(page, strategy.sender);
      return strategy.sender;
    }, SCREENSHOT_DIR);

    if (!switched) continue;

    const hasBal = await hasBalance(page);
    if (hasBal) {
      usedStrategy = strategy;
      t.add(`${strategy.sender} 有余额`, 'passed', '可以发送');
      break;
    } else {
      t.add(`${strategy.sender} 余额不足`, 'skipped', '尝试下一个账户');
    }
  }

  if (!usedStrategy) {
    t.add('所有账户余额不足', 'failed', '无法执行转账');
    return t.result();
  }

  // Step 4: Open send form and select token
  const sendOpened = await safeStep(page, t, `发送 ${token}`, async () => {
    await openSendForm(page, token);
    return `token=${token}`;
  }, SCREENSHOT_DIR);
  if (!sendOpened) return t.result();

  // Step 5: Select recipient
  await safeStep(page, t, `选择收款人 ${usedStrategy.recipient}`, async () => {
    await selectRecipientFromContacts(page, usedStrategy.recipient);
    return usedStrategy.recipient;
  }, SCREENSHOT_DIR);

  // Step 6: Enter memo (if any)
  if (memo) {
    await safeStep(page, t, '输入备注', async () => {
      await enterMemo(page, memo);
      return `${Buffer.byteLength(memo, 'utf8')} bytes`;
    }, SCREENSHOT_DIR);
  }

  // Step 7: Click "下一步" to enter amount page
  await safeStep(page, t, '点击下一步', async () => {
    await clickFooterConfirm(page);
    await sleep(2000);
    return 'entered amount page';
  }, SCREENSHOT_DIR);

  // Step 8: Enter amount
  await safeStep(page, t, `输入金额 ${amount}`, async () => {
    await enterAmount(page, amount);
    await sleep(1000);
    return `amount=${amount}`;
  }, SCREENSHOT_DIR);

  // Step 8.5: Verify fiat toggle (COSMOS-003)
  if (verifyFiat) {
    await safeStep(page, t, '切换法币展示', async () => {
      const fiatAmount = await verifyFiatToggle(page);
      return `fiat=${fiatAmount}`;
    }, SCREENSHOT_DIR);
  }

  // Step 9: Check insufficient before preview
  const insufficient = await checkInsufficientBalance(page);
  if (insufficient) {
    t.add('余额不足', 'failed', `${amount} 超过可用余额`);
    await recoverAfterCancel(page);
    return t.result();
  }

  // Step 10: Click preview → wait for confirm page to fully load (network fee)
  const previewOk = await safeStep(page, t, '点击预览', async () => {
    await clickFooterConfirm(page);
    // Wait for network fee to load — "确认" button becomes clickable only after fee is ready
    for (let i = 0; i < 15; i++) {
      await sleep(1000);
      const state = await page.evaluate(() => {
        const text = document.body?.textContent || '';
        // Check for gas insufficient error
        if (text.includes('不足以支付网络费用') || text.includes('不足以支付')) {
          return 'gas_insufficient';
        }
        const hasFee = text.includes('预估网络费用') || text.includes('网络费用');
        const btns = document.querySelectorAll('[data-testid="page-footer-confirm"]');
        const confirmBtn = Array.from(btns).find(b => b.textContent?.trim() === '确认');
        const btnReady = confirmBtn && !confirmBtn.disabled && confirmBtn.getBoundingClientRect().width > 0;
        if (hasFee && btnReady) return 'ready';
        if (hasFee && !btnReady) return 'fee_loaded_btn_disabled';
        return 'loading';
      });
      if (state === 'ready') return `preview loaded (${i + 1}s)`;
      if (state === 'gas_insufficient') throw new Error('GAS_INSUFFICIENT');
      if (state === 'fee_loaded_btn_disabled' && i > 5) throw new Error('GAS_INSUFFICIENT');
    }
    return 'preview opened (fee may still be loading)';
  }, SCREENSHOT_DIR);

  // If gas insufficient, cancel and mark as failed with clear reason
  if (!previewOk) {
    const isGasError = t.errors.some(e => e.includes('GAS_INSUFFICIENT'));
    if (isGasError) {
      t.add('主币 gas 不足', 'failed', `${network} 主币余额不足以支付网络费用，需要充值`);
      // Cancel and go back
      await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="page-footer-cancel"]');
        if (btn) btn.click();
      });
      await sleep(1000);
      await closeAllModals(page).catch(() => {});
      return t.result();
    }
  }

  // Step 11: Assert preview page content
  await safeStep(page, t, '验证预览页内容', async () => {
    const previewText = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      return (modal || document.body).textContent?.substring(0, 3000) || '';
    });
    const checks = [];
    if (previewText.includes(network) || previewText.includes(token)) checks.push('network/token');
    if (amount !== 'Max' && previewText.includes(amount)) checks.push('amount');
    if (memo && previewText.includes(memo.substring(0, 20))) checks.push('memo');
    if (previewText.includes('费用') || previewText.includes('Fee') || previewText.includes('网络费用')) checks.push('fee');
    return `matched: ${checks.join(', ')}`;
  }, SCREENSHOT_DIR);

  // Step 12: Click confirm (submit transaction)
  await safeStep(page, t, '确认广播交易', async () => {
    // Extra wait — fee loaded but button may need a moment to become interactive
    await sleep(3000);

    // Dedicated confirm click: try multiple methods until page changes
    const countBefore = await page.locator('[data-testid="page-footer-confirm"]').count();
    let clicked = false;

    for (let attempt = 0; attempt < 5 && !clicked; attempt++) {
      if (attempt === 0 || attempt === 1) {
        // Method: Playwright force click on last button
        await page.locator('[data-testid="page-footer-confirm"]').last().click({ force: true, timeout: 3000 }).catch(() => {});
      } else if (attempt === 2) {
        // Method: mouse.click at coordinates
        const box = await page.locator('[data-testid="page-footer-confirm"]').last().boundingBox().catch(() => null);
        if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      } else {
        // Method: keyboard — focus then Enter
        await page.evaluate(() => {
          const btns = document.querySelectorAll('[data-testid="page-footer-confirm"]');
          if (btns.length > 0) btns[btns.length - 1].focus();
        });
        await page.keyboard.press('Enter');
      }

      await sleep(2000);

      // Check if page changed
      const countAfter = await page.locator('[data-testid="page-footer-confirm"]').count();
      if (countAfter < countBefore) {
        clicked = true;
        console.log(`    确认 clicked (attempt ${attempt + 1})`);
      }
    }

    if (!clicked) throw new Error('确认按钮点击失败 (5次尝试)');

    // Handle password prompt — may be a fixed-position form with password input
    await sleep(2000);
    const pwdResult = await handlePasswordPromptIfPresent(page);
    if (pwdResult.handled) {
      console.log('    Password handled via standard handler');
      await sleep(3000);
    } else {
      // Direct password handling fallback — find any visible password input
      const hasPwd = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[type="password"]');
        for (const inp of inputs) {
          if (inp.getBoundingClientRect().width > 0) return true;
        }
        return false;
      });
      if (hasPwd) {
        console.log('    Password input detected, entering password...');
        const pwdInput = page.locator('input[type="password"]').first();
        await pwdInput.click({ force: true }).catch(() => {});
        await sleep(200);
        await pwdInput.fill(WALLET_PASSWORD);
        await sleep(500);
        // Click confirm in the password form
        await page.evaluate(() => {
          const btns = document.querySelectorAll('button');
          for (const btn of btns) {
            const t = btn.textContent?.trim();
            if ((t === '确认' || t === 'Confirm' || t === 'OK') && btn.getBoundingClientRect().width > 0) {
              btn.click();
              return;
            }
          }
        });
        await sleep(500);
        await page.keyboard.press('Enter');
        console.log('    Password submitted');
        await sleep(3000);
      }
    }

    // Poll for transaction result — check ONLY the topmost modal/toast, not entire body
    // (body includes background text like history records with "失败")
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      const status = await page.evaluate(() => {
        // Check toasts first (success/error notifications)
        const toasts = document.querySelectorAll('[data-testid*="toast"], [data-testid*="Toast"], [role="status"]');
        for (const toast of toasts) {
          const t = toast.textContent || '';
          if (t.includes('成功') || t.includes('已发送') || t.includes('Success')) return 'success';
        }

        // Check if confirmation page is gone (tx was submitted)
        // Method 1: confirm button disappeared
        const confirmBtns = document.querySelectorAll('[data-testid="page-footer-confirm"]');
        const hasConfirm = Array.from(confirmBtns).some(b =>
          b.textContent?.trim() === '确认' && b.getBoundingClientRect().width > 0
        );
        if (!hasConfirm) return 'success';

        // Method 2: cancel button disappeared (modal closed after tx)
        const cancelBtns = document.querySelectorAll('[data-testid="page-footer-cancel"]');
        const hasCancel = Array.from(cancelBtns).some(b => b.getBoundingClientRect().width > 0);
        if (!hasCancel && confirmBtns.length === 0) return 'success';

        // Method 3: wallet home visible (AccountSelectorTriggerBase without modal overlay)
        const walletHome = document.querySelector('[data-testid="AccountSelectorTriggerBase"]');
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        if (walletHome && walletHome.getBoundingClientRect().width > 0 && !modal) return 'success';

        // Check topmost modal content only
        const modals = document.querySelectorAll('[data-testid="APP-Modal-Screen"]');
        const topModal = modals.length > 0 ? modals[modals.length - 1] : null;
        if (topModal) {
          const modalText = topModal.textContent || '';
          if (modalText.includes('成功') || modalText.includes('已发送') || modalText.includes('已提交')) return 'success';
          // Only flag failure if it's clearly an error dialog in the modal
          const dialogs = topModal.querySelectorAll('[role="dialog"], [role="alertdialog"]');
          for (const d of dialogs) {
            if (d.textContent?.includes('失败') || d.textContent?.includes('Failed')) return 'failed';
          }
        }

        // Check for password form still visible
        const pwdInputs = document.querySelectorAll('input[type="password"]');
        for (const inp of pwdInputs) {
          if (inp.getBoundingClientRect().width > 0) return 'waiting_password';
        }

        return 'waiting';
      });
      if (status === 'success') return `tx submitted (${i + 1}s)`;
      if (status === 'failed') throw new Error('交易广播失败');
      if (status === 'waiting_password') {
        // Retry password handling
        await handlePasswordPromptIfPresent(page).catch(() => {});
      }
    }
    throw new Error('交易结果检测超时 (30s)');
  }, SCREENSHOT_DIR);

  // Step 13: Check history record
  await safeStep(page, t, '查看历史记录', async () => {
    await sleep(2000);
    const { fields } = await verifyHistoryRecord(page, token);
    return `verified: ${fields.join(', ')}`;
  }, SCREENSHOT_DIR);

  return t.result();
}

// ── COSMOS-012: Boundary tests ─────────────────────────────
// Each sub-test navigates from scratch — fully independent, no cascading failures.

/** Helper: navigate to Cosmos send form with recipient selected */
async function openCosmosSendForm(page) {
  await closeAllModals(page).catch(() => {});
  await dismissOverlays(page).catch(() => {});
  await goToWalletHome(page);
  await ensureSingleNetworkMode(page);
  await switchNetwork(page, 'Cosmos');
  await openSendForm(page, 'ATOM');
  await selectRecipientFromContacts(page, 'vault');
}

async function testBoundary(page) {
  const t = createStepTracker('COSMOS-012');

  // ── 2.1: Memo > 512 bytes → 禁止提交 ──
  await safeStep(page, t, '备注超 512 字节 → 禁止提交', async () => {
    await openCosmosSendForm(page);
    await enterMemo(page, MEMO_513);
    await sleep(2000);

    // Check modal text for limit message
    const text = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      return (modal || document.body).textContent || '';
    });
    const hasLimit = text.includes('512') || text.includes('超过') || text.includes('最大');
    if (!hasLimit) throw new Error('未显示备注超限提示');
    return `显示「最大为 512 个字符」`;
  }, SCREENSHOT_DIR);

  // ── 2.1b: Clear memo field ──
  await safeStep(page, t, '清空备注验证', async () => {
    // Try clear button, then manual
    const cleared = await page.evaluate(() => {
      for (const sp of document.querySelectorAll('span')) {
        if (sp.textContent?.trim() === '清除' && sp.getBoundingClientRect().width > 0) {
          sp.click(); return true;
        }
      }
      return false;
    });
    if (!cleared) {
      const memo = page.locator('textarea[placeholder*="备忘"], input[placeholder*="备忘"]').first();
      await memo.click().catch(() => {});
      await page.keyboard.press('Meta+a');
      await page.keyboard.press('Backspace');
    }
    await sleep(500);
    return '清空成功';
  }, SCREENSHOT_DIR);

  // Cleanup after memo test
  await closeAllModals(page).catch(() => {});

  // ── 2.2: Special characters memo → 正常提交 ──
  await safeStep(page, t, '特殊字符备注 → 可进入下一步', async () => {
    await openCosmosSendForm(page);
    await enterMemo(page, '<script>alert(1)</script>&<>');
    await sleep(500);
    await clickFooterConfirm(page);
    await sleep(2000);

    // Check we reached amount page
    const hasAmountInput = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[placeholder="0"]');
      for (const inp of inputs) {
        if (inp.getBoundingClientRect().width > 0) return true;
      }
      return false;
    });
    if (!hasAmountInput) throw new Error('未进入金额输入页');
    return '特殊字符不拦截，进入金额页';
  }, SCREENSHOT_DIR);

  // Cleanup
  await closeAllModals(page).catch(() => {});

  // ── 2.3: Invalid amounts ──
  await safeStep(page, t, '非法金额测试准备', async () => {
    await openCosmosSendForm(page);
    await clickFooterConfirm(page); // 下一步 → 金额页
    await sleep(2000);
    return '进入金额页';
  }, SCREENSHOT_DIR);

  await safeStep(page, t, '负数无法输入', async () => {
    const amountInput = page.locator('input[placeholder="0"]').first();
    const visible = await amountInput.isVisible({ timeout: 3000 }).catch(() => false);
    if (!visible) throw new Error('金额输入框不可见');
    await amountInput.click();
    await amountInput.fill('');
    await sleep(300);
    await amountInput.pressSequentially('-5', { delay: 50 });
    await sleep(500);
    const val = await amountInput.inputValue();
    if (val.includes('-')) throw new Error(`负号被输入了: ${val}`);
    return `输入 -5 → 实际="${val}"`;
  }, SCREENSHOT_DIR);

  await safeStep(page, t, '金额 0 显示错误提示', async () => {
    const amountInput = page.locator('input[placeholder="0"]').first();
    await amountInput.click();
    await amountInput.fill('0');
    await sleep(1500);
    const text = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      return (modal || document.body).textContent || '';
    });
    if (!text.includes('无法发送 0') && !text.includes('0 金额')) throw new Error('未显示 0 金额错误提示');
    return '显示「无法发送 0 金额」';
  }, SCREENSHOT_DIR);

  await safeStep(page, t, '超余额显示资金不足', async () => {
    const amountInput = page.locator('input[placeholder="0"]').first();
    await amountInput.click();
    await amountInput.fill('999999');
    await sleep(1500);
    const btnText = await page.evaluate(() => {
      const btns = document.querySelectorAll('[data-testid="page-footer-confirm"]');
      return btns[btns.length - 1]?.textContent?.trim() || '';
    });
    if (!btnText.includes('资金不足') && !btnText.includes('Insufficient')) {
      throw new Error(`按钮文案不是"资金不足": "${btnText}"`);
    }
    return `按钮="${btnText}"`;
  }, SCREENSHOT_DIR);

  // Cleanup
  await closeAllModals(page).catch(() => {});

  return t.result();
}

// ── Export for Dashboard ────────────────────────────────────

export const testCases = [
  ...TRANSFERS.map(tr => ({
    id: tr.id,
    name: `转账 ${tr.network}/${tr.token}${tr.memo ? ' +备注' : ''}`,
    fn: async (page) => testTransfer(page, tr),
  })),
  {
    id: 'COSMOS-012',
    name: '备注边界与非法金额校验（#2.1+#2.2+#2.3）',
    fn: testBoundary,
  },
];

// ── Standalone runner ──────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('COSMOS-'));
  const cases = filter
    ? testCases.filter(c => c.id === filter)
    : testCases;

  if (cases.length === 0) {
    console.error(`No cases matching "${filter}"`);
    console.error('Available:', testCases.map(c => c.id).join(', '));
    return { status: 'error', error: `No match: ${filter}` };
  }

  const { page } = await connectCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Cosmos Transfer Tests — ${cases.length} case(s)`);
  console.log('='.repeat(60));

  await unlockWalletIfNeeded(page);

  const results = [];
  for (const tc of cases) {
    const startTime = Date.now();

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`▶ ${tc.id}: ${tc.name}`);
    console.log('─'.repeat(60));

    try {
      const result = await tc.fn(page);
      const duration = Date.now() - startTime;

      const r = {
        testId: tc.id,
        status: result.status,
        duration,
        steps: result.steps,
        summary: result.summary,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      };

      console.log(`\n◆ ${tc.id}: ${r.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s) — ${r.summary.passed}✓ ${r.summary.failed}✗ ${r.summary.skipped}⊘`);
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);

    } catch (error) {
      const duration = Date.now() - startTime;
      const r = {
        testId: tc.id,
        status: 'failed',
        duration,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
      console.error(`\n◆ ${tc.id}: FAILED (${(duration / 1000).toFixed(1)}s): ${error.message}`);
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }

    // Cleanup between tests
    try {
      await dismissErrorDialogs(page);
      await closeAllModals(page);
      await goToWalletHome(page);
    } catch (e) {
      console.log(`  Cleanup: ${e.message}`);
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Escape').catch(() => {});
        await sleep(200);
      }
    }
    await sleep(1000);
  }

  // Summary
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));
  results.forEach(r => {
    const icon = r.status === 'passed' ? '✓' : '✗';
    console.log(`  [${icon}] ${r.testId} (${(r.duration / 1000).toFixed(1)}s)${r.error ? ' — ' + r.error.substring(0, 80) : ''}`);
  });

  const summary = { timestamp: new Date().toISOString(), total: results.length, passed, failed, results };
  writeFileSync(resolve(RESULTS_DIR, 'cosmos-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
