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

    // Step 1: Go to wallet + open account selector
    await _ss(page, t, '打开账户选择器', async () => {
      await goToWallet(page);
      await sleep(1000);
      if (openWalletCreation) {
        await openWalletCreation(page);
      } else {
        await defaultOpenWalletCreation(page);
      }
      return 'opened';
    });

    // Step 2: Click "add wallet"
    await _ss(page, t, '点击 + 新增钱包', async () => {
      const btn = page.locator('[data-testid="add-wallet"]').first();
      await btn.waitFor({ state: 'visible', timeout: 8000 });
      await btn.click();
      await sleep(2000);
      return 'add-wallet clicked';
    });

    // Step 3: Choose "创建助记词钱包"
    await _ss(page, t, '选择助记词钱包类型', async () => {
      const typeClicked = await page.evaluate(() => {
        const text = '创建助记词钱包';
        const spans = document.querySelectorAll('span');
        for (const sp of spans) {
          const r = sp.getBoundingClientRect();
          if (r.width > 0 && sp.textContent?.trim() === text) {
            let card = sp.parentElement;
            for (let i = 0; i < 8 && card; i++) {
              const cr = card.getBoundingClientRect();
              if (cr.width > 200 && cr.height > 80 && card.tagName === 'DIV') {
                card.click();
                return 'card';
              }
              card = card.parentElement;
            }
            sp.parentElement?.click();
            return 'parent';
          }
        }
        return null;
      });
      if (!typeClicked) throw new Error('Wallet type "创建助记词钱包" not found');
      await sleep(3000);
      return `via ${typeClicked}`;
    });

    // Step 4: Wait for wallet creation to settle
    await _ss(page, t, '等待钱包创建完成', async () => {
      let created = false;
      for (let i = 0; i < 30; i++) {
        await sleep(1000);
        const state = await page.evaluate(() => {
          const text = document.body?.textContent || '';
          const onboardingGone = !text.includes('添加钱包') || !text.includes('连接硬件钱包');
          const walletHome = text.includes('备份您的钱包') || text.includes('Account #');
          return { onboardingGone, walletHome };
        });
        if (state.onboardingGone && state.walletHome) {
          created = true;
          break;
        }
      }
      if (!created) {
        const stillOnboarding = await page.evaluate(() => {
          const t = document.body?.textContent || '';
          return t.includes('添加钱包') && t.includes('连接硬件钱包');
        });
        if (stillOnboarding) throw new Error('Wallet creation did not complete after 30s');
      }
      await sleep(2000);
      return created ? 'created' : 'timeout-but-onboarding-gone';
    });

    // Step 5: Select KeyTag backup (may need "..." button first)
    await _ss(page, t, '选择 OneKey KeyTag 备份方式', async () => {
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
      if (!keyTagClicked) throw new Error('OneKey KeyTag backup option not found');
      await sleep(2000);
      return 'KeyTag selected';
    });

    // Step 6-7: Enter password
    await _ss(page, t, '输入密码', async () => {
      const pwdInput = page.locator('[data-testid="password-input"]').first();
      await pwdInput.click({ timeout: 5000 });
      await sleep(200);
      await pwdInput.fill(password);
      await sleep(500);
      return 'entered';
    });

    // Step 8: Submit password
    await _ss(page, t, '提交密码', async () => {
      const submitBtn = page.locator('[data-testid="verifying-password"]').first();
      const hasSubmit = await submitBtn.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasSubmit) {
        await submitBtn.click();
      } else {
        await page.keyboard.press('Enter');
      }
      await sleep(3000);
      return hasSubmit ? 'submit-button' : 'enter-key';
    });

    // Step 9: Verify mnemonic modal visible
    await _ss(page, t, '查看助记词备份弹窗', async () => {
      const mnemonicModal = page.locator('[data-testid="APP-Modal-Screen"]').first();
      const hasModal = await mnemonicModal.isVisible({ timeout: 10000 }).catch(() => false);
      if (!hasModal) throw new Error('Mnemonic backup modal not found');
      return 'modal visible';
    });

    // Step 10: Confirm backup ("我已备份" + page-footer-confirm)
    await _ss(page, t, '确认备份提示', async () => {
      // Check/click "我已备份" checkbox if present
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
      // Wait for button enabled
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
    });

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
      name: `${namePrefix}钱包-创建助记词钱包(KeyTag备份)`,
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
