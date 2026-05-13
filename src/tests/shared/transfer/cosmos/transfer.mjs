// Cosmos Transfer — shared test logic (Desktop / Extension; Web not supported)
//
// Wrapper files at:
//   src/tests/desktop/transfer/cosmos/transfer.test.mjs
//   src/tests/extension/transfer/cosmos/transfer.test.mjs
//   src/tests/web/transfer/cosmos/transfer.test.mjs   (SKIP — no transfer in Web)
//
// 12 cases: 11 multi-network parameterized transfers + 1 boundary test.
//
// Wrapper injects:
//   - goToWallet(page)   → navigate to wallet home (sidebar)
//   - openTransfer?(page, network, token)  → optional pre-flight (default uses openSendForm)

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sleep } from '../../../helpers/constants.mjs';
import {
  closeAllModals, dismissOverlays,
  handlePasswordPromptIfPresent, dismissErrorDialogs,
  switchAccount, switchNetwork,
} from '../../../helpers/index.mjs';
import { createStepTracker, safeStep } from '../../../helpers/components.mjs';
import {
  openSendForm, selectRecipientFromContacts,
  enterAmount, enterMemo, checkInsufficientBalance, recoverAfterCancel,
  ensureSingleNetworkMode, hasBalance,
  verifyFiatToggle, verifyHistoryRecord,
} from '../../../helpers/transfer.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Memo fixtures ──────────────────────────────────────────
function loadMemoFixtures() {
  let MEMO_512 = '';
  let MEMO_513 = '';
  try {
    // shared/test-data path is two levels up from src/tests/shared/transfer/cosmos
    const p = resolve(__dirname, '../../../../../shared/test-data/cosmos-memo-fixtures.json');
    const fixtures = JSON.parse(readFileSync(p, 'utf8'));
    MEMO_512 = fixtures.MEMO_512_BYTES;
    MEMO_513 = fixtures.MEMO_513_BYTES;
  } catch {
    const base = '1234567890-=';
    MEMO_512 = base.repeat(42) + '12345678';
    MEMO_513 = MEMO_512 + '9';
  }
  return { MEMO_512, MEMO_513 };
}

/**
 * Build the 12 Cosmos transfer test cases for one platform.
 *
 * @param {object} opts
 * @param {string} opts.prefix - Test ID prefix, e.g. 'COSMOS' | 'WEB-COSMOS' | 'EXT-COSMOS'
 * @param {string} [opts.namePrefix] - Display name prefix, e.g. '' | 'Web-' | 'Ext-'
 * @param {string} opts.password - Wallet password.
 * @param {(page: import('playwright-core').Page) => Promise<void>} opts.goToWallet
 *   Navigate to wallet home page.
 * @param {(page: import('playwright-core').Page, network: string, token: string) => Promise<void>} [opts.openTransfer]
 *   Optional override for opening the transfer/send form. Defaults to using
 *   `switchNetwork` + `openSendForm` from helpers/transfer.mjs.
 * @param {string} [opts.screenshotDir] - Per-platform screenshot dir for safeStep.
 * @param {Array<{label: string, sender: string, recipient: string}>} [opts.accountStrategies]
 *   Sender/recipient pairs to try. Defaults to piggy ↔ vault.
 * @returns {{ testCases: Array, setup: (page) => Promise<void> }}
 */
export function createCosmosTransferTests({
  prefix,
  namePrefix = '',
  password,
  goToWallet,
  openTransfer,
  screenshotDir,
  accountStrategies,
}) {
  if (!goToWallet) throw new Error('createCosmosTransferTests: goToWallet is required');
  if (!password) throw new Error('createCosmosTransferTests: password is required');

  const { MEMO_512, MEMO_513 } = loadMemoFixtures();

  const DEFAULT_STRATEGIES = accountStrategies || [
    { label: 'primary',  sender: 'piggy', recipient: 'vault' },
    { label: 'reversed', sender: 'vault', recipient: 'piggy' },
  ];

  const TRANSFERS = [
    { id: `${prefix}-001`, network: 'Akash',             token: 'AKT',   amount: '0.001',     memo: null },
    { id: `${prefix}-002`, network: 'Cosmos',            token: 'ATOM',  amount: '0.000001',  memo: MEMO_512 },
    { id: `${prefix}-003`, network: 'Cronos POS Chain',  token: 'CRO',   amount: 'Max',       memo: '😂yes', verifyFiat: true },
    { id: `${prefix}-004`, network: 'Fetch.ai',          token: 'FET',   amount: '0.0001',    memo: null },
    { id: `${prefix}-005`, network: 'Juno',              token: 'JUNO',  amount: 'Max',       memo: null },
    { id: `${prefix}-006`, network: 'Osmosis',           token: 'OSMO',  amount: '0.01',      memo: 'onekey' },
    { id: `${prefix}-007`, network: 'Osmosis',           token: 'ATOM',  amount: '0.001',     memo: '123456' },
    { id: `${prefix}-008`, network: 'Secret Network',    token: 'SCRT',  amount: '0.0001',    memo: null },
    { id: `${prefix}-009`, network: 'Celestia',          token: 'TIA',   amount: '0.0002',    memo: null },
    { id: `${prefix}-010`, network: 'Babylon Genesis',   token: 'BABY',  amount: '1',         memo: '👌' },
    { id: `${prefix}-011`, network: 'Noble',             token: 'USDC',  amount: '0.00001',   memo: null },
  ];

  // ── Footer-confirm click helper ─────────────────────────
  async function clickFooterConfirm(page) {
    const btn = page.locator('[data-testid="page-footer-confirm"]').last();
    const text = (await btn.textContent({ timeout: 3000 }).catch(() => '')).trim();
    const countBefore = await page.locator('[data-testid="page-footer-confirm"]').count();
    console.log(`    Clicking "${text}" (${countBefore} buttons)...`);

    for (let attempt = 0; attempt < 3; attempt++) {
      const box = await btn.boundingBox().catch(() => null);
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      }
      await sleep(1500);

      const countAfter = await page.locator('[data-testid="page-footer-confirm"]').count();
      const lastText = countAfter > 0
        ? (await page.locator('[data-testid="page-footer-confirm"]').last().textContent().catch(() => '')).trim()
        : '';
      if (countAfter < countBefore || lastText !== text) {
        console.log(`    Clicked "${text}" (attempt ${attempt + 1})`);
        return;
      }

      if (attempt === 1) {
        await btn.click({ force: true, timeout: 3000 }).catch(() => {});
        await sleep(1500);
      }
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

  // ── Single transfer test case ──────────────────────────
  async function testTransfer(page, transfer) {
    const { id, network, token, amount, memo, verifyFiat } = transfer;
    const t = createStepTracker(id);
    const _ss = (name, fn) => safeStep(page, t, name, fn, screenshotDir);

    await _ss('回到钱包首页', async () => {
      await dismissOverlays(page);
      await handlePasswordPromptIfPresent(page);
      await goToWallet(page);
      return 'navigated';
    });

    await _ss(`切换到 ${network} 网络`, async () => {
      await ensureSingleNetworkMode(page);
      await switchNetwork(page, network);
      return network;
    });

    let usedStrategy = null;
    for (const strategy of DEFAULT_STRATEGIES) {
      const switched = await _ss(`切换到 ${strategy.sender} 账户`, async () => {
        await switchAccount(page, strategy.sender);
        return strategy.sender;
      });
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

    const sendOpened = await _ss(`发送 ${token}`, async () => {
      if (openTransfer) {
        await openTransfer(page, network, token);
      } else {
        await openSendForm(page, token);
      }
      return `token=${token}`;
    });
    if (!sendOpened) return t.result();

    await _ss(`选择收款人 ${usedStrategy.recipient}`, async () => {
      await selectRecipientFromContacts(page, usedStrategy.recipient);
      return usedStrategy.recipient;
    });

    if (memo) {
      await _ss('输入备注', async () => {
        await enterMemo(page, memo);
        return `${Buffer.byteLength(memo, 'utf8')} bytes`;
      });
    }

    await _ss('点击下一步', async () => {
      await clickFooterConfirm(page);
      await sleep(2000);
      return 'entered amount page';
    });

    await _ss(`输入金额 ${amount}`, async () => {
      await enterAmount(page, amount);
      await sleep(1000);
      return `amount=${amount}`;
    });

    if (verifyFiat) {
      await _ss('切换法币展示', async () => {
        const fiatAmount = await verifyFiatToggle(page);
        return `fiat=${fiatAmount}`;
      });
    }

    const insufficient = await checkInsufficientBalance(page);
    if (insufficient) {
      t.add('余额不足', 'failed', `${amount} 超过可用余额`);
      await recoverAfterCancel(page);
      return t.result();
    }

    const previewOk = await _ss('点击预览', async () => {
      await clickFooterConfirm(page);
      for (let i = 0; i < 15; i++) {
        await sleep(1000);
        const state = await page.evaluate(() => {
          const text = document.body?.textContent || '';
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
    });

    if (!previewOk) {
      const isGasError = t.errors.some(e => e.includes('GAS_INSUFFICIENT'));
      if (isGasError) {
        t.add('主币 gas 不足', 'failed', `${network} 主币余额不足以支付网络费用，需要充值`);
        await page.evaluate(() => {
          const btn = document.querySelector('[data-testid="page-footer-cancel"]');
          if (btn) btn.click();
        });
        await sleep(1000);
        await closeAllModals(page).catch(() => {});
        return t.result();
      }
    }

    await _ss('验证预览页内容', async () => {
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
    });

    await _ss('确认广播交易', async () => {
      await sleep(3000);
      const countBefore = await page.locator('[data-testid="page-footer-confirm"]').count();
      let clicked = false;

      for (let attempt = 0; attempt < 5 && !clicked; attempt++) {
        if (attempt === 0 || attempt === 1) {
          await page.locator('[data-testid="page-footer-confirm"]').last().click({ force: true, timeout: 3000 }).catch(() => {});
        } else if (attempt === 2) {
          const box = await page.locator('[data-testid="page-footer-confirm"]').last().boundingBox().catch(() => null);
          if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        } else {
          await page.evaluate(() => {
            const btns = document.querySelectorAll('[data-testid="page-footer-confirm"]');
            if (btns.length > 0) btns[btns.length - 1].focus();
          });
          await page.keyboard.press('Enter');
        }

        await sleep(2000);

        const countAfter = await page.locator('[data-testid="page-footer-confirm"]').count();
        if (countAfter < countBefore) {
          clicked = true;
          console.log(`    确认 clicked (attempt ${attempt + 1})`);
        }
      }
      if (!clicked) throw new Error('确认按钮点击失败 (5次尝试)');

      await sleep(2000);
      const pwdResult = await handlePasswordPromptIfPresent(page);
      if (pwdResult.handled) {
        console.log('    Password handled via standard handler');
        await sleep(3000);
      } else {
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
          await pwdInput.fill(password);
          await sleep(500);
          await page.evaluate(() => {
            const btns = document.querySelectorAll('button');
            for (const btn of btns) {
              const tx = btn.textContent?.trim();
              if ((tx === '确认' || tx === 'Confirm' || tx === 'OK') && btn.getBoundingClientRect().width > 0) {
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

      for (let i = 0; i < 30; i++) {
        await sleep(1000);
        const status = await page.evaluate(() => {
          const toasts = document.querySelectorAll('[data-testid*="toast"], [data-testid*="Toast"], [role="status"]');
          for (const toast of toasts) {
            const tx = toast.textContent || '';
            if (tx.includes('成功') || tx.includes('已发送') || tx.includes('Success')) return 'success';
          }
          const confirmBtns = document.querySelectorAll('[data-testid="page-footer-confirm"]');
          const hasConfirm = Array.from(confirmBtns).some(b =>
            b.textContent?.trim() === '确认' && b.getBoundingClientRect().width > 0
          );
          if (!hasConfirm) return 'success';
          const cancelBtns = document.querySelectorAll('[data-testid="page-footer-cancel"]');
          const hasCancel = Array.from(cancelBtns).some(b => b.getBoundingClientRect().width > 0);
          if (!hasCancel && confirmBtns.length === 0) return 'success';
          const walletHome = document.querySelector('[data-testid="AccountSelectorTriggerBase"]');
          const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
          if (walletHome && walletHome.getBoundingClientRect().width > 0 && !modal) return 'success';
          const modals = document.querySelectorAll('[data-testid="APP-Modal-Screen"]');
          const topModal = modals.length > 0 ? modals[modals.length - 1] : null;
          if (topModal) {
            const modalText = topModal.textContent || '';
            if (modalText.includes('成功') || modalText.includes('已发送') || modalText.includes('已提交')) return 'success';
            const dialogs = topModal.querySelectorAll('[role="dialog"], [role="alertdialog"]');
            for (const d of dialogs) {
              if (d.textContent?.includes('失败') || d.textContent?.includes('Failed')) return 'failed';
            }
          }
          const pwdInputs = document.querySelectorAll('input[type="password"]');
          for (const inp of pwdInputs) {
            if (inp.getBoundingClientRect().width > 0) return 'waiting_password';
          }
          return 'waiting';
        });
        if (status === 'success') return `tx submitted (${i + 1}s)`;
        if (status === 'failed') throw new Error('交易广播失败');
        if (status === 'waiting_password') {
          await handlePasswordPromptIfPresent(page).catch(() => {});
        }
      }
      throw new Error('交易结果检测超时 (30s)');
    });

    await _ss('查看历史记录', async () => {
      await sleep(2000);
      const { fields } = await verifyHistoryRecord(page, token);
      return `verified: ${fields.join(', ')}`;
    });

    return t.result();
  }

  // ── Boundary tests ────────────────────────────────────
  async function openCosmosSendForm(page) {
    await closeAllModals(page).catch(() => {});
    await dismissOverlays(page).catch(() => {});
    await goToWallet(page);
    await ensureSingleNetworkMode(page);
    await switchNetwork(page, 'Cosmos');
    if (openTransfer) {
      await openTransfer(page, 'Cosmos', 'ATOM');
    } else {
      await openSendForm(page, 'ATOM');
    }
    await selectRecipientFromContacts(page, 'vault');
  }

  async function testBoundary(page) {
    const t = createStepTracker(`${prefix}-012`);
    const _ss = (name, fn) => safeStep(page, t, name, fn, screenshotDir);

    await _ss('备注超 512 字节 → 禁止提交', async () => {
      await openCosmosSendForm(page);
      await enterMemo(page, MEMO_513);
      await sleep(2000);

      const text = await page.evaluate(() => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        return (modal || document.body).textContent || '';
      });
      const hasLimit = text.includes('512') || text.includes('超过') || text.includes('最大');
      if (!hasLimit) throw new Error('未显示备注超限提示');
      return `显示「最大为 512 个字符」`;
    });

    await _ss('清空备注验证', async () => {
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
    });

    await closeAllModals(page).catch(() => {});

    await _ss('特殊字符备注 → 可进入下一步', async () => {
      await openCosmosSendForm(page);
      await enterMemo(page, '<script>alert(1)</script>&<>');
      await sleep(500);
      await clickFooterConfirm(page);
      await sleep(2000);

      const hasAmountInput = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[placeholder="0"]');
        for (const inp of inputs) {
          if (inp.getBoundingClientRect().width > 0) return true;
        }
        return false;
      });
      if (!hasAmountInput) throw new Error('未进入金额输入页');
      return '特殊字符不拦截，进入金额页';
    });

    await closeAllModals(page).catch(() => {});

    await _ss('非法金额测试准备', async () => {
      await openCosmosSendForm(page);
      await clickFooterConfirm(page);
      await sleep(2000);
      return '进入金额页';
    });

    await _ss('负数无法输入', async () => {
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
    });

    await _ss('金额 0 显示错误提示', async () => {
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
    });

    await _ss('超余额显示资金不足', async () => {
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
    });

    await closeAllModals(page).catch(() => {});

    return t.result();
  }

  // ── Registry ──────────────────────────────────────────
  const testCases = [
    ...TRANSFERS.map(tr => ({
      id: tr.id,
      name: `${namePrefix}转账 ${tr.network}/${tr.token}${tr.memo ? ' +备注' : ''}`,
      fn: async (page) => testTransfer(page, tr),
    })),
    {
      id: `${prefix}-012`,
      name: `${namePrefix}备注边界与非法金额校验（#2.1+#2.2+#2.3）`,
      fn: testBoundary,
    },
  ];

  async function setup(page) {
    // Caller unlocks wallet + runs preconditions before invoking setup.
    return undefined;
  }

  return { testCases, setup };
}
