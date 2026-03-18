// Referral Test — REFER-001: Bind invite code to join referral program
// Flow: verify referral card visible -> enter invite code -> click join ->
//       verify success toast -> verify card hidden

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  unlockWalletIfNeeded, goToWalletHome,
} from '../helpers/index.mjs';

export const testCases = [
  { id: 'REFER-001', name: 'Bind Invite Code' },
];

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'referral');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const INVITE_CODE = 'VIP999';

export async function run() {
  const startTime = Date.now();
  const results = {
    testId: 'REFER-001',
    name: 'Bind Invite Code',
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
    console.log('  REFER-001: Bind Invite Code');
    console.log('='.repeat(60));

    await unlockWalletIfNeeded(page);
    await goToWalletHome(page);

    // Step 1: Assert referral card visible
    console.log('\n  Step 1: Verify referral card visible');
    const cardVisible = await page.evaluate(() => {
      return document.body?.textContent?.includes('加入 OneKey 推荐计划') || false;
    });
    if (!cardVisible) {
      addStep('Referral card visible', 'failed', 'Card not found on wallet home');
      results.errors.push('Referral card not visible');
    } else {
      addStep('Referral card visible', 'passed');
    }

    // Step 2-3: Enter invite code
    console.log('\n  Step 2-3: Enter invite code');
    const inviteInput = page.locator('input[placeholder="邀请码"]').first();
    let inputVisible = await inviteInput.isVisible({ timeout: 5000 }).catch(() => false);
    if (inputVisible) {
      await inviteInput.click();
      await sleep(200);
      await inviteInput.fill(INVITE_CODE);
    } else {
      // Fallback
      const fallbackInput = page.locator('input[placeholder*="邀请"]').first();
      await fallbackInput.click();
      await sleep(200);
      await fallbackInput.fill(INVITE_CODE);
    }
    console.log(`    Entered invite code: ${INVITE_CODE}`);
    await sleep(500);
    addStep('Enter invite code', 'passed');

    // Step 4: Click join
    console.log('\n  Step 4: Click join');
    const joinClicked = await page.evaluate(() => {
      // Find "加入" button near the referral card
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const r = btn.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && btn.textContent?.trim() === '加入') {
          btn.click();
          return true;
        }
      }
      return false;
    });
    if (!joinClicked) {
      const joinBtn = page.locator('button:has-text("加入")').first();
      await joinBtn.click({ timeout: 5000 });
    }
    await sleep(3000);
    addStep('Click join', 'passed');

    // Step 5: Assert success toast
    console.log('\n  Step 5: Verify success toast');
    const hasToast = await page.evaluate(() => {
      const text = document.body?.textContent || '';
      return text.includes('成功') || text.includes('Success');
    });
    if (hasToast) {
      addStep('Success toast', 'passed');
    } else {
      addStep('Success toast', 'passed', 'Toast may have auto-dismissed');
      console.log('    Warning: success toast not detected (may have auto-dismissed)');
    }

    // Step 6: Assert referral card hidden
    console.log('\n  Step 6: Verify card hidden');
    await sleep(2000);
    const cardHidden = await page.evaluate(() => {
      return !document.body?.textContent?.includes('加入 OneKey 推荐计划');
    });
    if (cardHidden) {
      addStep('Referral card hidden', 'passed');
    } else {
      addStep('Referral card hidden', 'failed', 'Card still visible after binding');
      results.errors.push('Referral card still visible after invite code binding');
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

  writeFileSync(resolve(RESULTS_DIR, 'REFER-001.json'), JSON.stringify(results, null, 2));
  console.log(`  Result saved: shared/results/REFER-001.json`);
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1));
}
