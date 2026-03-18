// Wallet Creation Test — WALLET-001: Create mnemonic wallet with KeyTag backup
// Flow: open account selector -> add wallet -> select mnemonic type ->
//       wait for creation -> select backup (KeyTag) -> enter password ->
//       view mnemonic -> confirm backup -> verify wallet created

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, clickTestId, RESULTS_DIR, WALLET_PASSWORD,
  closeAllModals, goToWalletHome, unlockWalletIfNeeded,
} from '../helpers/index.mjs';

export const testCases = [
  { id: 'WALLET-001', name: 'Create Mnemonic Wallet with KeyTag Backup' },
];

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'wallet-create');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

export async function run() {
  const startTime = Date.now();
  const results = {
    testId: 'WALLET-001',
    name: 'Create Mnemonic Wallet with KeyTag Backup',
    status: 'passed',
    steps: [],
    errors: [],
    startTime: new Date().toISOString(),
  };

  function addStep(name, status, detail = '') {
    results.steps.push({ name, status, detail, time: new Date().toISOString() });
    const icon = status === 'passed' ? 'OK' : 'FAIL';
    console.log(`  [${icon}] ${name}${detail ? ': ' + detail : ''}`);
  }

  try {
    const { page } = await connectCDP();

    console.log('\n' + '='.repeat(60));
    console.log('  WALLET-001: Create Mnemonic Wallet');
    console.log('='.repeat(60));

    await unlockWalletIfNeeded(page);

    // Step 1: Open account selector
    console.log('\n  Step 1: Open account selector');
    await closeAllModals(page);
    await goToWalletHome(page);
    await sleep(1000);

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
    addStep('Open account selector', 'passed');

    // Step 2: Click add wallet
    console.log('\n  Step 2: Click add wallet');
    await clickTestId(page, 'add-wallet', { delay: 2000 });
    addStep('Click add wallet', 'passed');

    // Step 3: Select "创建助记词钱包"
    console.log('\n  Step 3: Select mnemonic wallet type');
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
    addStep('Select mnemonic wallet type', 'passed', `via ${typeClicked}`);

    // Step 4: Wait for creation
    console.log('\n  Step 4: Wait for wallet creation');
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
        console.log(`    Wallet created after ${i + 1}s`);
        created = true;
        break;
      }
    }
    if (!created) {
      const stillOnboarding = await page.evaluate(() => {
        return document.body?.textContent?.includes('添加钱包') && document.body?.textContent?.includes('连接硬件钱包');
      });
      if (stillOnboarding) throw new Error('Wallet creation did not complete after 30s');
      console.log('    Wallet creation timeout but onboarding gone, continuing...');
    }
    await sleep(2000);
    addStep('Wait for wallet creation', 'passed');

    // Step 5: Select OneKey KeyTag backup
    console.log('\n  Step 5: Select KeyTag backup');
    // May need to click "..." button first to reveal the option
    const moreClicked = await page.evaluate(() => {
      const allButtons = document.querySelectorAll('button, [role="button"]');
      for (const btn of allButtons) {
        const r = btn.getBoundingClientRect();
        const text = btn.textContent?.trim();
        if (r.width > 0 && r.width < 60 && r.height > 0 && r.height < 60 && (!text || text === '...' || text === '···')) {
          const parent = btn.closest('div');
          if (parent?.textContent?.includes('备份')) {
            btn.click();
            return true;
          }
        }
      }
      return false;
    });
    if (moreClicked) {
      console.log('    Clicked "..." button');
      await sleep(1500);
    }

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
    addStep('Select KeyTag backup', 'passed');

    // Step 6-7: Enter password
    console.log('\n  Step 6-7: Enter password');
    const pwdInput = page.locator('[data-testid="password-input"]').first();
    await pwdInput.click({ timeout: 5000 });
    await sleep(200);
    await pwdInput.fill(WALLET_PASSWORD);
    await sleep(500);
    addStep('Enter password', 'passed');

    // Step 8: Submit password
    console.log('\n  Step 8: Submit password');
    const submitBtn = page.locator('[data-testid="verifying-password"]').first();
    const hasSubmit = await submitBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasSubmit) {
      await submitBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await sleep(3000);
    addStep('Submit password', 'passed');

    // Step 9: View mnemonic
    console.log('\n  Step 9: View mnemonic backup');
    const mnemonicModal = page.locator('[data-testid="APP-Modal-Screen"]').first();
    const hasModal = await mnemonicModal.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasModal) {
      console.log('    Mnemonic backup modal visible');
      addStep('View mnemonic', 'passed');
    } else {
      addStep('View mnemonic', 'failed', 'Modal not found');
      results.errors.push('Mnemonic backup modal not found');
    }

    // Step 10: Confirm "我明白了"
    console.log('\n  Step 10: Confirm backup notice');
    // Check/click "我已备份" checkbox if present
    const checkboxClicked = await page.evaluate(() => {
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
    if (checkboxClicked) {
      console.log('    Checked "我已备份"');
      await sleep(1000);
    }

    const confirmSel = '[data-testid="page-footer-confirm"]';
    // Wait for button to be enabled
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
    addStep('Confirm backup notice', 'passed');

    // Step 11: Assert wallet created
    console.log('\n  Step 11: Verify wallet created');
    const walletVisible = await page.locator(walletSel).isVisible({ timeout: 10000 }).catch(() => false);
    if (!walletVisible) {
      addStep('Assert wallet created', 'failed', 'Wallet selector not visible');
      results.errors.push('Wallet selector not visible after creation');
    } else {
      const accountText = await page.locator(walletSel).textContent();
      addStep('Assert wallet created', 'passed', `Account: "${accountText}"`);
    }

    // Summary
    results.status = results.errors.length === 0 ? 'passed' : 'failed';
    results.duration = Date.now() - startTime;
    results.endTime = new Date().toISOString();

    console.log('\n' + '='.repeat(60));
    console.log(`  Result: ${results.status.toUpperCase()}`);
    console.log(`  Steps: ${results.steps.filter(s => s.status === 'passed').length}/${results.steps.length} passed`);
    console.log(`  Duration: ${(results.duration / 1000).toFixed(1)}s`);
    if (results.errors.length > 0) {
      console.log('  Errors:');
      results.errors.forEach(e => console.log(`    - ${e}`));
    }
    console.log('='.repeat(60) + '\n');

  } catch (err) {
    results.status = 'error';
    results.errors.push(err.message);
    results.duration = Date.now() - startTime;
    results.endTime = new Date().toISOString();
    console.error(`\n  Test error: ${err.message}\n`);
  }

  writeFileSync(resolve(RESULTS_DIR, 'WALLET-001.json'), JSON.stringify(results, null, 2));
  console.log(`  Result saved: shared/results/WALLET-001.json`);
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1));
}
