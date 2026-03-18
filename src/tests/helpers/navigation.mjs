// Navigation helpers — overlay dismissal, modal closing, wallet unlock, home navigation
// Extracted from src/runner/index.mjs — uses direct testid selectors (no ui-map indirection)

import { sleep, WALLET_PASSWORD } from './index.mjs';

/**
 * Dismiss overlays/popovers that may block interaction.
 */
export async function dismissOverlays(page) {
  // Try clicking overlay popover (note: app has typo 'ovelay' in testid)
  const overlaySel = '[data-testid="ovelay-popover"]';
  const hasOverlay = await page.locator(overlaySel).isVisible({ timeout: 500 }).catch(() => false);
  if (hasOverlay) {
    await page.locator(overlaySel).click().catch(() => {});
    await sleep(500);
  }

  // Try clicking modal backdrop
  const backdropSel = '[data-testid="app-modal-stacks-backdrop"]';
  const hasBackdrop = await page.locator(backdropSel).isVisible({ timeout: 500 }).catch(() => false);
  if (hasBackdrop) {
    await page.locator(backdropSel).click().catch(() => {});
    await sleep(500);
  }

  await page.keyboard.press('Escape');
  await sleep(300);
}

/**
 * Close all open modals — nav-close, nav-back, Escape.
 */
export async function closeAllModals(page) {
  await dismissOverlays(page);

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.evaluate(() => {
      const closeBtn = document.querySelector('[data-testid="nav-header-close"]');
      if (closeBtn) { closeBtn.click(); return; }
      const backBtn = document.querySelector('[data-testid="nav-header-back"]');
      if (backBtn) { backBtn.click(); return; }
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (modal) {
        const xBtn = modal.querySelector('button');
        if (xBtn) xBtn.click();
      }
    });
    await sleep(500);

    await page.keyboard.press('Escape');
    await sleep(500);

    const hasModal = await page.evaluate(() => {
      const m = document.querySelector('[data-testid="APP-Modal-Screen"]');
      return m && m.getBoundingClientRect().width > 0;
    });
    if (!hasModal) break;
  }
  await sleep(500);
}

/**
 * Check if wallet is locked and unlock if needed.
 * @returns {Promise<boolean>} true if unlock was performed
 */
export async function unlockWalletIfNeeded(page) {
  try {
    await sleep(3000);

    const isLocked = await page.evaluate(() => {
      const bodyText = document.body?.textContent || '';
      if (bodyText.includes('\u6b22\u8fce\u56de\u6765') || bodyText.includes('\u8f93\u5165\u5bc6\u7801') || bodyText.includes('\u5fd8\u8bb0\u5bc6\u7801')) return true;
      const lockEl = document.querySelector('[data-sentry-source-file*="AppStateLock"]');
      if (lockEl && lockEl.getBoundingClientRect().width > 0) return true;
      const pwdInput = document.querySelector('input[placeholder*="\u5bc6\u7801"]');
      if (pwdInput && pwdInput.getBoundingClientRect().width > 0) return true;
      return false;
    });

    if (!isLocked) return false;
    console.log('  Wallet locked, unlocking...');

    const pwdInput = page.locator('input[placeholder*="\u5bc6\u7801"]').first();
    const hasPwdInput = await pwdInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasPwdInput) {
      await pwdInput.click();
      await sleep(300);
      await pwdInput.fill(WALLET_PASSWORD);
      await sleep(500);
      const submitBtn = page.locator('input[placeholder*="\u5bc6\u7801"] ~ button, input[placeholder*="\u5bc6\u7801"] + div button, [data-testid*="submit"]').first();
      const hasSubmit = await submitBtn.isVisible({ timeout: 1000 }).catch(() => false);
      if (hasSubmit) {
        await submitBtn.click();
      } else {
        await pwdInput.press('Enter');
      }
    } else {
      const fallbackInput = page.locator('input[type="password"]').first();
      await fallbackInput.fill(WALLET_PASSWORD);
      await sleep(500);
      await fallbackInput.press('Enter');
    }

    console.log('  Waiting for wallet to load...');
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      const stillLocked = await page.evaluate(() => {
        const bodyText = document.body?.textContent || '';
        return bodyText.includes('\u6b22\u8fce\u56de\u6765') || bodyText.includes('\u8f93\u5165\u5bc6\u7801');
      });
      if (!stillLocked) break;
    }
    await sleep(3000);

    const hasWallet = await page.locator('[data-testid="AccountSelectorTriggerBase"]').isVisible({ timeout: 10000 }).catch(() => false);
    if (hasWallet) {
      console.log('  Unlocked successfully.');
    } else {
      console.log('  Unlock: wallet selector not visible, but lock screen cleared.');
    }
    return true;
  } catch (e) {
    console.log(`  Unlock error: ${e.message}`);
    return false;
  }
}

/**
 * Adaptive password/unlock handler — detects and handles password prompts
 * that may appear at unpredictable points during test execution.
 * Lightweight (~200ms) when no prompt is present.
 */
export async function handlePasswordPromptIfPresent(page) {
  try {
    const detection = await page.evaluate(() => {
      const bodyText = document.body?.textContent || '';

      // Scenario 1: Full lock screen
      const hasLockText = bodyText.includes('\u6b22\u8fce\u56de\u6765') || bodyText.includes('\u5fd8\u8bb0\u5bc6\u7801');
      const lockEl = document.querySelector('[data-sentry-source-file*="AppStateLock"]');
      const hasLockEl = lockEl && lockEl.getBoundingClientRect().width > 0;
      if (hasLockText || hasLockEl) {
        return { type: 'lock_screen' };
      }

      // Scenario 2: Password re-verification dialog (inside a modal)
      const pwdInputs = [
        document.querySelector('[data-testid="password-input"]'),
        ...document.querySelectorAll('input[type="password"]'),
        ...document.querySelectorAll('input[placeholder*="\u5bc6\u7801"]'),
      ].filter(Boolean);

      for (const input of pwdInputs) {
        const r = input.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const inModal = input.closest('[data-testid="APP-Modal-Screen"], [role="dialog"], [data-testid*="modal"], [data-testid*="Modal"]');
        if (inModal) {
          return { type: 'password_dialog' };
        }
      }

      return { type: null };
    });

    if (!detection.type) {
      return { handled: false, type: null };
    }

    if (detection.type === 'lock_screen') {
      console.log('    [adaptive] Lock screen detected, unlocking...');
      await unlockWalletIfNeeded(page);
      return { handled: true, type: 'lock_screen' };
    }

    // Scenario 2: Password dialog
    console.log('    [adaptive] Password re-verification dialog detected...');

    const pwdSelectors = [
      '[data-testid="password-input"]',
      'input[type="password"]',
      'input[placeholder*="\u5bc6\u7801"]',
    ];

    let filled = false;
    for (const sel of pwdSelectors) {
      const input = page.locator(sel).first();
      const visible = await input.isVisible({ timeout: 1000 }).catch(() => false);
      if (visible) {
        await input.click();
        await sleep(200);
        await input.fill(WALLET_PASSWORD);
        filled = true;
        break;
      }
    }

    if (!filled) {
      console.log('    [adaptive] Password input not fillable, skipping');
      return { handled: false, type: null };
    }

    await sleep(300);

    const submitBtn = page.locator('[data-testid="verifying-password"]').first();
    const submitVisible = await submitBtn.isVisible({ timeout: 1000 }).catch(() => false);
    if (submitVisible) {
      await submitBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }

    // Wait for dialog to disappear
    for (let i = 0; i < 10; i++) {
      await sleep(500);
      const stillVisible = await page.evaluate(() => {
        const inputs = [
          document.querySelector('[data-testid="password-input"]'),
          ...document.querySelectorAll('input[type="password"]'),
        ].filter(Boolean);
        for (const input of inputs) {
          const r = input.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            const inModal = input.closest('[data-testid="APP-Modal-Screen"], [role="dialog"], [data-testid*="modal"], [data-testid*="Modal"]');
            if (inModal) return true;
          }
        }
        return false;
      });
      if (!stillVisible) break;
    }

    console.log('    [adaptive] Password dialog handled');
    return { handled: true, type: 'password_dialog' };

  } catch (e) {
    console.log(`    [adaptive] Password check error: ${e.message}`);
    return { handled: false, type: null };
  }
}

/**
 * Navigate to wallet home — close modals, click sidebar home, verify wallet selector.
 */
export async function goToWalletHome(page) {
  await closeAllModals(page);

  await page.evaluate(() => {
    const home = document.querySelector('[data-testid="home"]');
    if (home) home.click();
  });
  await sleep(2000);

  const hasWalletSelector = await page.locator('[data-testid="AccountSelectorTriggerBase"]').isVisible({ timeout: 3000 }).catch(() => false);
  if (!hasWalletSelector) {
    await page.keyboard.press('Escape');
    await sleep(500);
    await page.evaluate(() => {
      const home = document.querySelector('[data-testid="home"]');
      if (home) home.click();
    });
    await sleep(2000);
  }
}
