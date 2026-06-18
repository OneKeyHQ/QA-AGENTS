// Wallet — Create Mnemonic shared test logic (Desktop / Extension; Web not supported)
//
// Wrapper files at:
//   src/tests/desktop/wallet/create-mnemonic.test.mjs
//   src/tests/extension/wallet/create-mnemonic.test.mjs
//   src/tests/web/wallet/create-mnemonic.test.mjs       (SKIP — no wallet in Web)
// inject platform-specific `goToWallet` + `openWalletCreation` (optional)
// then call createCreateMnemonicTests() to get the WALLET-001 case prefixed.
//
// Flow: open account selector -> add wallet -> select mnemonic type ->
//       wait for creation -> select backup (KeyTag) -> enter password ->
//       view mnemonic -> confirm backup -> verify wallet created

import { sleep } from '../../helpers/constants.mjs';
import { createStepTracker, safeStep } from '../../helpers/components.mjs';

/**
 * Build the 1 Create-Mnemonic test case for one platform.
 *
 * @param {object} opts
 * @param {string} opts.prefix - Test ID prefix, e.g. 'WALLET' | 'WEB-WALLET' | 'EXT-WALLET'
 * @param {string} [opts.namePrefix] - Display name prefix, e.g. '' | 'Web-' | 'Ext-'
 * @param {string} opts.password - Wallet password to use during creation.
 * @param {(page: import('playwright-core').Page) => Promise<void>} opts.goToWallet
 *   Navigate to wallet home (sidebar tab or URL).
 * @param {(page: import('playwright-core').Page) => Promise<void>} [opts.openWalletCreation]
 *   Optional hook: open the account selector / "+ add wallet" picker.
 *   Default behavior clicks `[data-testid="AccountSelectorTriggerBase"]`.
 * @param {string} [opts.screenshotDir] - Per-platform screenshot dir for safeStep.
 * @returns {{ testCases: Array, setup: (page) => Promise<void> }}
 */
export function createCreateMnemonicTests({
  prefix,
  namePrefix = '',
  password,
  goToWallet,
  openWalletCreation,
  screenshotDir,
}) {
  if (!goToWallet) throw new Error('createCreateMnemonicTests: goToWallet is required');
  if (!password) throw new Error('createCreateMnemonicTests: password is required');

  const _ss = (page, t, name, fn) => safeStep(page, t, name, fn, screenshotDir);

  async function clickVisibleTextByMouse(page, labels, {
    minWidth = 40,
    minHeight = 24,
    maxWidth = 560,
    maxHeight = 240,
    preferExact = false,
  } = {}) {
    const target = await page.evaluate(({ labels, minWidth, minHeight, maxWidth, maxHeight, preferExact }) => {
      const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const isVisible = (el) => {
        const r = el?.getBoundingClientRect?.();
        return !!r && r.width > 0 && r.height > 0 &&
          r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
      };
      const clickableAncestor = (el, label) => {
        let node = el;
        const choices = [];
        for (let i = 0; i < 9 && node; i += 1) {
          const r = node.getBoundingClientRect?.();
          const text = normalize(node.innerText || node.textContent);
          if (
            r &&
            r.width >= minWidth &&
            r.height >= minHeight &&
            r.width <= maxWidth &&
            r.height <= maxHeight &&
            text.includes(label) &&
            (node.tagName === 'BUTTON' || node.getAttribute?.('role') === 'button' || r.height >= 36 || (preferExact && text === label))
          ) {
            choices.push({
              text,
              exact: text === label,
              area: r.width * r.height,
              x: r.x + r.width / 2,
              y: r.y + r.height / 2,
              width: r.width,
              height: r.height,
            });
          }
          node = node.parentElement;
        }
        if (preferExact) {
          choices.sort((a, b) => Number(b.exact) - Number(a.exact) || a.area - b.area);
        } else {
          choices.sort((a, b) => Number(a.height < 48) - Number(b.height < 48) || a.area - b.area);
        }
        return choices[0] || null;
      };

      const candidates = Array.from(document.querySelectorAll('span, div, button, [role="button"]'))
        .filter(isVisible)
        .map((el) => ({ el, text: normalize(el.innerText || el.textContent) }))
        .filter(({ text }) => labels.includes(text));

      for (const label of labels) {
        const item = candidates.find(candidate => candidate.text === label);
        if (!item) continue;
        const target = clickableAncestor(item.el, label);
        if (target) return { label, ...target };
      }
      return null;
    }, { labels, minWidth, minHeight, maxWidth, maxHeight, preferExact });

    if (!target) throw new Error(`visible text target not found: ${labels.join(' / ')}`);
    await page.mouse.click(Math.round(target.x), Math.round(target.y));
    await sleep(1200);
    return target;
  }

  async function clickVisibleTestIdByMouse(page, testid, delay = 1200) {
    const target = await page.evaluate((testid) => {
      const isVisible = (el) => {
        const r = el?.getBoundingClientRect?.();
        return !!r && r.width > 0 && r.height > 0 &&
          r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
      };
      const el = Array.from(document.querySelectorAll(`[data-testid="${testid}"]`)).find(isVisible);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, testid);
    if (!target) throw new Error(`visible testid target not found: ${testid}`);
    await page.mouse.click(Math.round(target.x), Math.round(target.y));
    await sleep(delay);
    return target;
  }

  // ── Default account-selector opener ───────────────────────
  async function defaultOpenWalletCreation(page) {
    const walletSel = '[data-testid="AccountSelectorTriggerBase"]';
    const clicked = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el && el.getBoundingClientRect().width > 0) {
        el.click();
        return true;
      }
      return false;
    }, walletSel);
    if (!clicked) {
      await page.locator(walletSel).click({ force: true, timeout: 5000 });
    }
    await sleep(2000);
  }

  // ── The test case ─────────────────────────────────────────

  async function testCreateMnemonic(page) {
    const t = createStepTracker(`${prefix}-001`);
    const walletSel = '[data-testid="AccountSelectorTriggerBase"]';
    let completedFromFinalizePage = false;

    // Step 1: Go to wallet + open account selector
    if (!await _ss(page, t, '打开账户选择器', async () => {
      await goToWallet(page);
      await sleep(1000);
      if (openWalletCreation) {
        await openWalletCreation(page);
      } else {
        await defaultOpenWalletCreation(page);
      }
      return 'opened';
    })) return t.result();

    // Step 2: Click "add wallet"
    if (!await _ss(page, t, '点击 + 新增钱包', async () => {
      const btn = page.locator('[data-testid="add-wallet"]').first();
      await btn.waitFor({ state: 'visible', timeout: 8000 });
      await btn.click();
      await sleep(2000);
      return 'add-wallet clicked';
    })) return t.result();

    // Step 3: Choose current "create wallet" entry.
    if (!await _ss(page, t, '选择创建新钱包入口', async () => {
      const clicked = await clickVisibleTextByMouse(page, [
        '创建新钱包',
        'Create New Wallet',
        'Create Wallet',
      ], { minWidth: 120, minHeight: 40, maxWidth: 420, maxHeight: 200 });
      await sleep(2500);
      return `via ${clicked.label}@${Math.round(clicked.x)},${Math.round(clicked.y)}`;
    })) return t.result();

    // Step 4: Wait for the wallet creation method page.
    if (!await _ss(page, t, '等待创建方式页面', async () => {
      let reached = null;
      for (let i = 0; i < 20; i++) {
        await sleep(1000);
        const state = await page.evaluate(() => {
          const isVisible = (el) => {
            const r = el?.getBoundingClientRect?.();
            return !!r && r.width > 0 && r.height > 0 &&
              r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
          };
          const visibleText = Array.from(document.querySelectorAll('button, [role="button"], span, div'))
            .filter(isVisible)
            .map(el => el.innerText || el.textContent || '')
            .join(' ');
          const text = visibleText || document.body?.innerText || '';
          return {
            methodPage: isVisible(document.querySelector('[data-testid="onboarding-create-new-wallet-seed-phrase-btn"]')) ||
              /创建助记词钱包|Create Mnemonic Wallet|使用 Google 继续|Continue with Google|使用 Apple 继续|Continue with Apple/i.test(text),
            backupPage: /备份您的钱包|OneKey KeyTag|Backup your wallet/i.test(text),
            finalizePage: /钱包已准备就绪|wallet is ready|进入钱包|Enter Wallet/i.test(text),
            walletHome: /Account #/.test(text) &&
              isVisible(document.querySelector('[data-testid="AccountSelectorTriggerBase"]')) &&
              !isVisible(document.querySelector('[data-testid="APP-OnBoarding-Screen"]')),
            stillGetStarted: /创建新钱包/.test(text) && /添加已有钱包/.test(text) && /连接硬件钱包/.test(text) && !/创建助记词钱包/.test(text),
            sample: text.replace(/\s+/g, ' ').trim().slice(0, 220),
          };
        });
        if (state.methodPage || state.backupPage || state.finalizePage || state.walletHome) {
          reached = state;
          break;
        }
        if (state.stillGetStarted && i >= 4) throw new Error(`still on get-started page after clicking create wallet: ${state.sample}`);
      }
      if (!reached) throw new Error('create wallet method page did not appear');
      return reached.walletHome ? 'wallet-home' : reached.finalizePage ? 'finalize-page' : reached.backupPage ? 'backup-page' : 'method-page';
    })) return t.result();

    // Step 5: Select mnemonic wallet on the method page.
    if (!await _ss(page, t, '选择助记词钱包方式', async () => {
      const state = await page.evaluate(() => {
        const isVisible = (el) => {
          const r = el?.getBoundingClientRect?.();
          return !!r && r.width > 0 && r.height > 0 &&
            r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
        };
        const text = Array.from(document.querySelectorAll('button, [role="button"], span, div'))
          .filter(isVisible)
          .map(el => el.innerText || el.textContent || '')
          .join(' ');
        return {
          hasSeedPhraseButton: isVisible(document.querySelector('[data-testid="onboarding-create-new-wallet-seed-phrase-btn"]')),
          alreadyPastMethod: /备份您的钱包|OneKey KeyTag|Backup your wallet|钱包已准备就绪|进入钱包|Enter Wallet/i.test(text),
          sample: text.replace(/\s+/g, ' ').trim().slice(0, 260),
        };
      });
      if (!state.hasSeedPhraseButton) {
        if (state.alreadyPastMethod) return 'already past method page';
        throw new Error(`seed phrase wallet button not visible: ${state.sample}`);
      }
      await clickVisibleTestIdByMouse(page, 'onboarding-create-new-wallet-seed-phrase-btn', 2500);
      await sleep(2500);
      const text = await page.evaluate(() => {
        const isVisible = (el) => {
          const r = el?.getBoundingClientRect?.();
          return !!r && r.width > 0 && r.height > 0 &&
            r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
        };
        return Array.from(document.querySelectorAll('button, [role="button"], span, div'))
          .filter(isVisible)
          .map(el => el.innerText || el.textContent || '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 360);
      });
      if (/正在登录|complete verification in browser/i.test(text)) {
        throw new Error(`mnemonic wallet click triggered social login instead of mnemonic flow: ${text}`);
      }
      if (!/备份您的钱包|OneKey KeyTag|Backup your wallet|钱包已准备就绪|进入钱包|Enter Wallet|密码|Password|跳过|稍后/i.test(text)) {
        throw new Error(`mnemonic wallet click did not reach backup/password page: ${text}`);
      }
      return 'via onboarding-create-new-wallet-seed-phrase-btn';
    })) return t.result();

    // Step 6: Current TF can complete directly; older builds may still show backup options.
    if (!await _ss(page, t, '处理备份方式或完成页', async () => {
      const currentState = await page.evaluate(() => {
        const isVisible = (el) => {
          const r = el?.getBoundingClientRect?.();
          return !!r && r.width > 0 && r.height > 0 &&
            r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
        };
        const text = Array.from(document.querySelectorAll('button, [role="button"], span, div'))
          .filter(isVisible)
          .map(el => el.innerText || el.textContent || '')
          .join(' ');
        return {
          finalizeReady: /钱包已准备就绪|Your wallet is ready/i.test(text),
          enterWallet: /进入钱包|Enter Wallet/i.test(text),
          hasKeyTag: /OneKey KeyTag/i.test(text),
          sample: text.replace(/\s+/g, ' ').trim().slice(0, 260),
        };
      });

      if (currentState.finalizeReady && currentState.enterWallet) {
        const clicked = await clickVisibleTextByMouse(page, [
          '进入钱包 →',
          '进入钱包',
          'Enter Wallet',
        ], { minWidth: 60, minHeight: 20, maxWidth: 280, maxHeight: 80, preferExact: true });
        await sleep(2500);
        completedFromFinalizePage = true;
        return `finalize page entered via ${clicked.label}`;
      }

      const moreClicked = await page.evaluate(() => {
        const allButtons = document.querySelectorAll('button, [role="button"]');
        for (const btn of allButtons) {
          const r = btn.getBoundingClientRect();
          const text = btn.textContent?.trim();
          if (r.width > 0 && r.width < 60 && r.height > 0 && r.height < 60
              && (!text || text === '...' || text === '···')) {
            const parent = btn.closest('div');
            if (parent?.textContent?.includes('备份')) {
              btn.click();
              return true;
            }
          }
        }
        return false;
      });
      if (moreClicked) await sleep(1500);

      const keyTagClicked = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button, [role="button"]');
        for (const btn of buttons) {
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && btn.textContent?.includes('OneKey KeyTag')) {
            btn.click();
            return true;
          }
        }
        const els = document.querySelectorAll('span, div');
        for (const el of els) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && el.textContent?.includes('OneKey KeyTag')) {
            el.click();
            return true;
          }
        }
        return false;
      });
      if (!keyTagClicked) {
        throw new Error(`neither finalize page nor OneKey KeyTag backup option found: ${currentState.sample}`);
      }
      await sleep(2000);
      return 'KeyTag selected';
    })) return t.result();

    if (!completedFromFinalizePage) {
      // Step 7: Enter password on older backup flow.
      if (!await _ss(page, t, '输入密码', async () => {
        const pwdInput = page.locator('[data-testid="password-input"]').first();
        await pwdInput.click({ timeout: 5000 });
        await sleep(200);
        await pwdInput.fill(password);
        await sleep(500);
        return 'entered';
      })) return t.result();

      // Step 8: Submit password.
      if (!await _ss(page, t, '提交密码', async () => {
        const submitBtn = page.locator('[data-testid="verifying-password"]').first();
        const hasSubmit = await submitBtn.isVisible({ timeout: 3000 }).catch(() => false);
        if (hasSubmit) {
          await submitBtn.click();
        } else {
          await page.keyboard.press('Enter');
        }
        await sleep(3000);
        return hasSubmit ? 'submit-button' : 'enter-key';
      })) return t.result();

      // Step 9: Verify mnemonic modal visible.
      if (!await _ss(page, t, '查看助记词备份弹窗', async () => {
        const mnemonicModal = page.locator('[data-testid="APP-Modal-Screen"]').first();
        const hasModal = await mnemonicModal.isVisible({ timeout: 10000 }).catch(() => false);
        if (!hasModal) throw new Error('Mnemonic backup modal not found');
        return 'modal visible';
      })) return t.result();

      // Step 10: Confirm backup ("我已备份" + page-footer-confirm).
      if (!await _ss(page, t, '确认备份提示', async () => {
        await page.evaluate(() => {
          const checkboxes = document.querySelectorAll('input[type="checkbox"], [role="checkbox"]');
          for (const cb of checkboxes) {
            const r = cb.getBoundingClientRect();
            if (r.width > 0 && !cb.checked) {
              cb.click();
              return true;
            }
          }
          const spans = document.querySelectorAll('span, div, label');
          for (const sp of spans) {
            const r = sp.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && sp.textContent?.trim() === '我已备份') {
              sp.click();
              return true;
            }
          }
          return false;
        });
        await sleep(1000);

        const confirmSel = '[data-testid="page-footer-confirm"]';
        for (let i = 0; i < 10; i++) {
          const enabled = await page.evaluate((sel) => {
            const btn = document.querySelector(sel);
            return btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true';
          }, confirmSel);
          if (enabled) break;
          await sleep(500);
        }
        const confirmed = await page.evaluate((sel) => {
          const btn = document.querySelector(sel);
          if (btn) { btn.click(); return true; }
          return false;
        }, confirmSel);
        if (!confirmed) {
          await page.locator(confirmSel).click({ force: true, timeout: 5000 });
        }
        await sleep(2000);
        return 'confirmed';
      })) return t.result();
    }

    // Step 11: Assert wallet created
    await _ss(page, t, '验证钱包创建成功', async () => {
      const walletVisible = await page.locator(walletSel).isVisible({ timeout: 10000 }).catch(() => false);
      if (!walletVisible) throw new Error('Wallet selector not visible after creation');
      const accountText = await page.locator(walletSel).textContent();
      return `account: "${accountText}"`;
    });

    return t.result();
  }

  // ── Registry ──────────────────────────────────────────────

  const testCases = [
    {
      id: `${prefix}-001`,
      name: `${namePrefix}钱包-创建助记词钱包`,
      fn: testCreateMnemonic,
    },
  ];

  async function setup(page) {
    // Navigation happens inside the test (each step uses goToWallet).
    // Caller may inject `unlockWalletIfNeeded` before calling setup if needed.
    return undefined;
  }

  return { testCases, setup };
}
