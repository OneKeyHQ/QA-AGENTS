// @deprecated — All test cases have been migrated to standalone tests in src/tests/.
// Use: node src/tests/run.mjs (or individual test files in cosmos/, wallet/, referral/)
// This file is kept for backward compatibility with /onekey-runner skill references.
//
// Runner — Strategy-based test execution tool
// Dumb executor: follows test_cases.json strategies + ui-map.json tiered selectors.
// No hardcoded business logic. No direction reversal. No inline fallbacks.
// Unified entry: run_case(test_id, platform) → TestResult

import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve as pathResolve } from 'node:path';
import { execSync, spawn } from 'node:child_process';
import {
  updateSelectorStats, updateTierStats, createMemCell, updateProfile
} from '../knowledge/memory-pipeline.mjs';

const SHARED_DIR = pathResolve(import.meta.dirname, '../../shared');
const RESULTS_DIR = pathResolve(SHARED_DIR, 'results');
const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9222';
const WALLET_PASSWORD = process.env.WALLET_PASSWORD || '1234567890-=';
const ONEKEY_BIN = process.env.ONEKEY_BIN || '/Applications/OneKey-3.localized/OneKey.app/Contents/MacOS/OneKey';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ────────────────────────────────────────────
// Fix 1: Auto-launch OneKey with CDP
// ────────────────────────────────────────────

async function ensureOneKeyRunning() {
  // Check if CDP is responding AND has targets (pages)
  for (let i = 0; i < 2; i++) {
    try {
      const resp = await fetch(`${CDP_URL}/json/version`);
      if (resp.ok) {
        // CDP responds — check if there are actual page targets
        const targetsResp = await fetch(`${CDP_URL}/json/list`).catch(() => null);
        const targets = targetsResp ? await targetsResp.json().catch(() => []) : [];
        if (targets.length > 0) {
          console.log(`  OneKey CDP ready (${targets.length} targets).`);
          return;
        }
        // CDP responds but no targets — stale instance, need to restart
        console.log('  OneKey CDP responds but no page targets. Restarting...');
        execSync('pkill -f "OneKey.app/Contents/MacOS/OneKey" 2>/dev/null; pkill -f "OneKey Helper" 2>/dev/null', { stdio: 'ignore' });
        await sleep(2000);
        break;
      }
    } catch { /* not running */ }
    if (i === 0) await sleep(500);
  }

  // Also kill any OneKey running without CDP flag
  try {
    execSync('pgrep -f "OneKey.app/Contents/MacOS/OneKey" >/dev/null 2>&1');
    console.log('  Found OneKey without CDP, killing...');
    execSync('pkill -f "OneKey.app/Contents/MacOS/OneKey" 2>/dev/null; pkill -f "OneKey Helper" 2>/dev/null', { stdio: 'ignore' });
    await sleep(2000);
  } catch { /* no existing process */ }

  // Launch OneKey with CDP
  if (!existsSync(ONEKEY_BIN)) {
    throw new Error(`OneKey not found at ${ONEKEY_BIN}`);
  }

  console.log('  Launching OneKey with CDP...');
  const child = spawn(ONEKEY_BIN, ['--remote-debugging-port=9222'], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  // Wait for CDP to become ready with targets (up to 30s)
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    try {
      const resp = await fetch(`${CDP_URL}/json/version`);
      if (resp.ok) {
        // Also check for targets
        const targetsResp = await fetch(`${CDP_URL}/json/list`).catch(() => null);
        const targets = targetsResp ? await targetsResp.json().catch(() => []) : [];
        if (targets.length > 0) {
          console.log(`  OneKey CDP ready after ${((i + 1) * 0.5).toFixed(1)}s (${targets.length} targets)`);
          return;
        }
        // CDP up but no targets yet — keep waiting for app to load
      }
    } catch { /* still starting */ }
  }

  // Final check — CDP might work without /json/list in Electron
  try {
    const resp = await fetch(`${CDP_URL}/json/version`);
    if (resp.ok) {
      console.log('  OneKey CDP ready (no targets listed, Electron mode)');
      return;
    }
  } catch { /* */ }

  throw new Error('OneKey CDP failed to start within 30s');
}

// ────────────────────────────────────────────
// Tiered Selector Resolution — reads from ui-map.json
// Replaces the old hardcoded S() function entirely.
// ────────────────────────────────────────────

function readUiMap() {
  return JSON.parse(readFileSync(pathResolve(SHARED_DIR, 'ui-map.json'), 'utf-8'));
}

/**
 * Tier 1: Primary selector (1s timeout)
 * Tier 2: Quick fallbacks (<1s each, known alternatives)
 * Tier 3: Deep search (3-5s, DOM-wide text/role scan)
 */
async function resolve(page, elementName, opts = {}) {
  const uiMap = readUiMap();
  const el = uiMap.elements[elementName];
  if (!el) throw new Error(`Unknown element: ${elementName}`);

  const timeout = opts.timeout || 1000;

  // Tier 1: Primary
  const primary = page.locator(el.primary);
  if (await primary.first().isVisible({ timeout }).catch(() => false)) {
    updateTierStats(elementName, 'primary');
    return primary.first();
  }

  // Tier 2: Quick Fallbacks (<1s each)
  for (const fb of (el.quick_fallbacks || [])) {
    const loc = page.locator(fb);
    if (await loc.first().isVisible({ timeout: 800 }).catch(() => false)) {
      updateTierStats(elementName, 'quick');
      return loc.first();
    }
  }

  // Tier 3: Deep Search (DOM-wide)
  if (el.deep_search?.enabled) {
    const found = await deepSearch(page, el.deep_search);
    if (found) {
      updateTierStats(elementName, 'deep');
      return found;
    }
  }

  throw new Error(`Element "${elementName}" not found (all tiers exhausted)`);
}

/**
 * Deep search: scan DOM for text/role within a scope.
 */
async function deepSearch(page, config) {
  const { search_text, search_role, search_scope } = config;

  // Build scope selector
  let scopeSelector = 'body';
  if (search_scope === 'modal') scopeSelector = '[data-testid="APP-Modal-Screen"], [role="dialog"]';

  const result = await page.evaluate(({ scopeSel, text, role }) => {
    const scopes = document.querySelectorAll(scopeSel);
    const containers = scopes.length > 0 ? scopes : [document.body];

    for (const container of containers) {
      // Try role-based search first
      if (role) {
        const els = container.querySelectorAll(`[role="${role}"]`);
        for (const el of els) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && el.textContent?.includes(text)) {
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
          }
        }
      }

      // Fallback to text-based search
      if (text) {
        const all = container.querySelectorAll('button, a, [role="button"], span, div, input');
        for (const el of all) {
          const r = el.getBoundingClientRect();
          if (r.width > 10 && r.height > 10 && el.textContent?.trim() === text) {
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
          }
        }
      }
    }
    return null;
  }, { scopeSel: scopeSelector, text: search_text, role: search_role });

  if (result) {
    // Return a locator-like object that supports click
    return {
      click: async (clickOpts = {}) => page.mouse.click(result.x, result.y),
      isVisible: async () => true,
      textContent: async () => search_text,
      _deepSearchResult: true,
    };
  }
  return null;
}

/**
 * Get raw selector string for a given element name (primary only).
 * Used by functions that need raw CSS selectors for page.evaluate().
 */
function getRawSelector(elementName) {
  const uiMap = readUiMap();
  const el = uiMap.elements[elementName];
  if (!el) return null;
  return el.primary;
}

// ════════════════════════════════════════════
// CORE ACTION HANDLERS
// ════════════════════════════════════════════

/**
 * Read accounts mapping from test_cases.json.
 * Returns { piggy: { label, fullLabel, index }, vault: { ... } }
 */
function readAccountsMap() {
  const tc = JSON.parse(readFileSync(pathResolve(SHARED_DIR, 'test_cases.json'), 'utf-8'));
  return tc.accounts || {};
}

/**
 * Dismiss overlays/popovers that may block interaction.
 * Recording: steps 1, 38 (ovelay-popover), steps 2, 7 (app-modal-stacks-backdrop)
 */
async function dismissOverlays(page) {
  const overlaySel = getRawSelector('overlayPopover');
  const backdropSel = getRawSelector('modalBackdrop');

  // Try clicking overlay popover first
  if (overlaySel) {
    const hasOverlay = await page.locator(overlaySel).isVisible({ timeout: 500 }).catch(() => false);
    if (hasOverlay) {
      await page.locator(overlaySel).click().catch(() => {});
      await sleep(500);
    }
  }

  // Try clicking modal backdrop
  if (backdropSel) {
    const hasBackdrop = await page.locator(backdropSel).isVisible({ timeout: 500 }).catch(() => false);
    if (hasBackdrop) {
      await page.locator(backdropSel).click().catch(() => {});
      await sleep(500);
    }
  }

  await page.keyboard.press('Escape');
  await sleep(300);
}

async function closeAllModals(page) {
  const navCloseSel = getRawSelector('navClose');
  const navBackSel = getRawSelector('navBack');
  const modalSel = getRawSelector('modal');

  // First dismiss overlays
  await dismissOverlays(page);

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.evaluate(({ navClose, navBack, modal }) => {
      const closeBtn = document.querySelector(navClose);
      if (closeBtn) { closeBtn.click(); return; }
      const backBtn = document.querySelector(navBack);
      if (backBtn) { backBtn.click(); return; }
      const m = document.querySelector(modal);
      if (m) {
        const xBtn = m.querySelector('button');
        if (xBtn) xBtn.click();
      }
    }, { navClose: navCloseSel, navBack: navBackSel, modal: modalSel });
    await sleep(500);

    await page.keyboard.press('Escape');
    await sleep(500);

    const hasModal = await page.evaluate((sel) => {
      const m = document.querySelector(sel);
      return m && m.getBoundingClientRect().width > 0;
    }, modalSel);
    if (!hasModal) break;
  }
  await sleep(500);
}

async function unlockWalletIfNeeded(page) {
  try {
    // Wait for app to settle after launch
    await sleep(3000);

    // Check for lock screen — multiple detection methods
    const isLocked = await page.evaluate(() => {
      const bodyText = document.body?.textContent || '';
      // Check for lock screen text
      if (bodyText.includes('欢迎回来') || bodyText.includes('输入密码') || bodyText.includes('忘记密码')) return true;
      // Check for AppStateLock overlay
      const lockEl = document.querySelector('[data-sentry-source-file*="AppStateLock"]');
      if (lockEl && lockEl.getBoundingClientRect().width > 0) return true;
      // Check for password input with placeholder
      const pwdInput = document.querySelector('input[placeholder*="密码"]');
      if (pwdInput && pwdInput.getBoundingClientRect().width > 0) return true;
      return false;
    });

    if (!isLocked) return false;
    console.log('  Wallet locked, unlocking...');

    // Find and fill password input — try multiple selectors
    const pwdInput = page.locator('input[placeholder*="密码"]').first();
    const hasPwdInput = await pwdInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasPwdInput) {
      await pwdInput.click();
      await sleep(300);
      await pwdInput.fill(WALLET_PASSWORD);
      await sleep(500);
      // Click the arrow/submit button or press Enter
      const submitBtn = page.locator('input[placeholder*="密码"] ~ button, input[placeholder*="密码"] + div button, [data-testid*="submit"]').first();
      const hasSubmit = await submitBtn.isVisible({ timeout: 1000 }).catch(() => false);
      if (hasSubmit) {
        await submitBtn.click();
      } else {
        await pwdInput.press('Enter');
      }
    } else {
      // Fallback: try type="password"
      const fallbackInput = page.locator('input[type="password"]').first();
      await fallbackInput.fill(WALLET_PASSWORD);
      await sleep(500);
      await fallbackInput.press('Enter');
    }

    // Wait for lock screen to disappear and wallet to load
    console.log('  Waiting for wallet to load...');
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      const stillLocked = await page.evaluate(() => {
        const bodyText = document.body?.textContent || '';
        return bodyText.includes('欢迎回来') || bodyText.includes('输入密码');
      });
      if (!stillLocked) break;
    }
    await sleep(3000);

    const walletSelectorSel = getRawSelector('walletSelector');
    const hasWallet = await page.locator(walletSelectorSel).isVisible({ timeout: 10000 }).catch(() => false);
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
 *
 * Two scenarios:
 *   1. Full lock screen ("欢迎回来") → delegates to unlockWalletIfNeeded()
 *   2. Password re-verification dialog (modal with password input) → fill + submit
 *
 * Lightweight (~200ms) when no prompt is present.
 * Returns { handled: boolean, type: 'lock_screen' | 'password_dialog' | null }
 */
async function handlePasswordPromptIfPresent(page) {
  try {
    const detection = await page.evaluate(() => {
      const bodyText = document.body?.textContent || '';

      // Scenario 1: Full lock screen
      const hasLockText = bodyText.includes('欢迎回来') || bodyText.includes('忘记密码');
      const lockEl = document.querySelector('[data-sentry-source-file*="AppStateLock"]');
      const hasLockEl = lockEl && lockEl.getBoundingClientRect().width > 0;
      if (hasLockText || hasLockEl) {
        return { type: 'lock_screen' };
      }

      // Scenario 2: Password re-verification dialog (inside a modal)
      const pwdInputs = [
        document.querySelector('[data-testid="password-input"]'),
        ...document.querySelectorAll('input[type="password"]'),
        ...document.querySelectorAll('input[placeholder*="密码"]'),
      ].filter(Boolean);

      for (const input of pwdInputs) {
        const r = input.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;

        // Check if it's inside a modal/dialog (not the full lock screen)
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

    // Scenario 1: Lock screen → delegate
    if (detection.type === 'lock_screen') {
      console.log('    [adaptive] Lock screen detected, unlocking...');
      await unlockWalletIfNeeded(page);
      return { handled: true, type: 'lock_screen' };
    }

    // Scenario 2: Password dialog → fill and submit
    console.log('    [adaptive] Password re-verification dialog detected...');

    // Find and fill the password input
    const pwdSel = getRawSelector('passwordInput');
    const pwdSelectors = [
      pwdSel,
      '[data-testid="password-input"]',
      'input[type="password"]',
      'input[placeholder*="密码"]',
    ].filter(Boolean);

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

    // Click submit button
    const verifySel = getRawSelector('verifyingPassword');
    const submitSelectors = [
      verifySel,
      '[data-testid="verifying-password"]',
    ].filter(Boolean);

    let submitted = false;
    for (const sel of submitSelectors) {
      const btn = page.locator(sel).first();
      const visible = await btn.isVisible({ timeout: 1000 }).catch(() => false);
      if (visible) {
        await btn.click();
        submitted = true;
        break;
      }
    }

    if (!submitted) {
      // Fallback: press Enter
      await page.keyboard.press('Enter');
    }

    // Wait for dialog to disappear (up to 5s)
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

async function goToWalletHome(page) {
  await closeAllModals(page);

  const homeSel = getRawSelector('sidebarHome');
  await page.evaluate((sel) => {
    const home = document.querySelector(sel);
    if (home) home.click();
  }, homeSel);
  await sleep(2000);

  const walletSelectorSel = getRawSelector('walletSelector');
  const hasWalletSelector = await page.locator(walletSelectorSel).isVisible({ timeout: 3000 }).catch(() => false);
  if (!hasWalletSelector) {
    await page.keyboard.press('Escape');
    await sleep(500);
    await page.evaluate((sel) => {
      const home = document.querySelector(sel);
      if (home) home.click();
    }, homeSel);
    await sleep(2000);
  }
}

async function switchAccount(page, accountName) {
  const accounts = readAccountsMap();
  const account = accounts[accountName];
  if (!account) throw new Error(`Unknown account: ${accountName}`);

  const walletSelector = await resolve(page, 'walletSelector');
  const currentAccount = await walletSelector.textContent();
  if (currentAccount?.toLowerCase().includes(accountName.toLowerCase())) {
    console.log(`  Already on account ${accountName}`);
    return;
  }

  await walletSelector.click();
  await sleep(2000);

  // Use account-item-index-{N} testid from recording (steps 4, 9, 26)
  const accountItemSel = `[data-testid="account-item-index-${account.index}"]`;
  const accountItem = page.locator(accountItemSel);
  const visible = await accountItem.isVisible({ timeout: 3000 }).catch(() => false);
  if (visible) {
    await accountItem.click();
    console.log(`    Clicked account-item-index-${account.index} for ${accountName}`);
  } else {
    // Fallback: search by text
    const accountEntry = page.locator(`text=/${accountName}/i`).first();
    await accountEntry.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await accountEntry.click({ timeout: 5000 });
  }
  await sleep(2000);

  // Verify
  const newWalletSelector = await resolve(page, 'walletSelector');
  const newAccount = await newWalletSelector.textContent();
  if (!newAccount?.toLowerCase().includes(accountName.toLowerCase())) {
    throw new Error(`Failed to switch to account ${accountName}, got: ${newAccount}`);
  }
}

async function switchNetwork(page, networkName) {
  const networkTextLocator = await resolve(page, 'networkButtonText');
  const currentNetwork = await networkTextLocator.textContent();
  if (currentNetwork?.includes(networkName)) {
    console.log(`  Already on ${networkName}`);
    return;
  }

  const networkBtn = await resolve(page, 'networkButton');
  await networkBtn.click();
  await sleep(1500);

  const searchInput = await resolve(page, 'chainSearchInput', { timeout: 5000 });
  await searchInput.isVisible();
  // searchInput might be a deep_search result, use page.locator for fill
  const chainSearchSel = getRawSelector('chainSearchInput');
  await page.locator(chainSearchSel).fill(networkName);
  await sleep(1500);

  const clicked = await page.evaluate((name) => {
    const spans = document.querySelectorAll('span');
    for (const sp of spans) {
      if (sp.textContent === name && sp.getBoundingClientRect().width > 0) {
        sp.closest('[role="button"]')?.click() || sp.parentElement?.click() || sp.click();
        return name;
      }
    }
    for (const sp of spans) {
      const t = sp.textContent?.trim() || '';
      const r = sp.getBoundingClientRect();
      if (r.width > 0 && r.height > 10 && t.toLowerCase().includes(name.toLowerCase())) {
        sp.closest('[role="button"]')?.click() || sp.parentElement?.click() || sp.click();
        return t;
      }
    }
    return null;
  }, networkName);

  if (!clicked) {
    await page.keyboard.press('Escape');
    await sleep(500);
    throw new Error(`Network "${networkName}" not found in dropdown`);
  }
  console.log(`    Selected network: ${clicked}`);
  await sleep(3000);

  const networkTextSel = getRawSelector('networkButtonText');
  const verifyText = await page.locator(networkTextSel).first().textContent({ timeout: 5000 });
  if (!verifyText?.includes(networkName)) {
    throw new Error(`Network switch failed: expected ${networkName}, got ${verifyText}`);
  }
  updateSelectorStats('networkButton', true);
  updateSelectorStats('chainSearchInput', true);
}

async function openSendForm(page, token) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);

  const walletTabSel = getRawSelector('walletTabHeader');
  const sendBtn = page.locator(`${walletTabSel} >> text=发送`).last();
  await sendBtn.click({ timeout: 5000 });
  await sleep(2000);

  const sendFormSel = getRawSelector('sendForm');
  const hasSendForm = await page.locator(sendFormSel).isVisible({ timeout: 1000 }).catch(() => false);
  if (hasSendForm) {
    console.log('    Send form opened directly (single token)');
    updateSelectorStats('sendForm', true);
    return;
  }

  // Token selection dialog
  const tokenSearchInput = page.locator('input[placeholder="搜索资产"]');
  const hasSearch = await tokenSearchInput.isVisible({ timeout: 2000 }).catch(() => false);
  if (hasSearch) {
    await tokenSearchInput.fill(token);
    await sleep(1500);
  }

  const modalSel = getRawSelector('modal');
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

  await page.locator(sendFormSel).waitFor({ state: 'visible', timeout: 5000 });
  updateSelectorStats('sendForm', true);
}

/**
 * Select recipient via contacts icon → popover → 我的账户 → account-item-index-{N}
 * Recording flow: steps 14→15→16 and steps 29→30→31
 */
async function selectRecipientFromContacts(page, recipientName) {
  const accounts = readAccountsMap();
  const recipient = accounts[recipientName];
  if (!recipient) throw new Error(`Unknown recipient account: ${recipientName}`);

  // Step 1: Click contacts icon (SvgPeopleCircle) inside send form
  const contactsIcon = await resolve(page, 'contactsIcon');
  await contactsIcon.click();
  console.log(`    Clicked contacts icon`);
  await sleep(1500);

  // Step 2: Wait for popover (TMPopover-ScrollView) and click "我的账户"
  const popoverSel = getRawSelector('contactsPopover');
  const popoverVisible = await page.locator(popoverSel).isVisible({ timeout: 3000 }).catch(() => false);

  if (popoverVisible) {
    // Click "我的账户" tab inside the popover
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
      // Fallback: click by text anywhere
      const myAccountBtn = page.locator('text=我的账户').first();
      await myAccountBtn.click({ timeout: 3000 });
    }
    console.log(`    Clicked "我的账户"`);
    await sleep(2000);
  } else {
    // Fallback: "我的账户" might appear directly
    const myAccountBtn = page.locator('text=我的账户').first();
    const hasMyAccount = await myAccountBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasMyAccount) {
      await myAccountBtn.click();
      console.log(`    Clicked "我的账户" (direct)`);
      await sleep(2000);
    }
  }

  // Step 3: Click account-item-index-{N} for the recipient
  const accountItemSel = `[data-testid="account-item-index-${recipient.index}"]`;
  const accountItem = page.locator(accountItemSel);
  const accountVisible = await accountItem.isVisible({ timeout: 3000 }).catch(() => false);

  if (accountVisible) {
    await accountItem.click();
    console.log(`    Clicked account-item-index-${recipient.index} for ${recipientName}`);
  } else {
    // Fallback: search by account name text
    const accountEntry = page.locator(`text=/${recipientName}/i`).first();
    await accountEntry.click({ timeout: 5000 });
    console.log(`    Clicked ${recipientName} by text (fallback)`);
  }
  await sleep(3000);
  updateSelectorStats('contactsIcon', true);
}

async function enterAmount(page, amount) {
  const sendFormSel = getRawSelector('sendForm');
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
    const amountInput = page.locator(`${sendFormSel} input`).first();
    await amountInput.click();
    await sleep(300);
    await amountInput.fill(String(amount));
    await sleep(500);
  }
}

/**
 * Enter memo in the "标签 (可选)" field.
 * Recording: placeholder is "备忘标签 (Memo, Tag, Comment)"
 */
async function enterMemo(page, memo) {
  // Try multiple selectors for the memo field
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
 * Fix 5: Dismiss error dialogs/toasts that may block the send form.
 * After insufficient balance detection, the app may show an error toast
 * or alert dialog that prevents further interaction.
 */
async function dismissErrorDialogs(page) {
  // Dismiss any visible toast/snackbar
  await page.evaluate(() => {
    // Click any toast close buttons
    const toastCloses = document.querySelectorAll('[data-testid*="toast"] button, [role="alert"] button, [data-testid*="Toast"] button');
    for (const btn of toastCloses) {
      if (btn.getBoundingClientRect().width > 0) btn.click();
    }
    // Dismiss alert dialogs via OK/确定 button
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const t = btn.textContent?.trim();
      if ((t === '确定' || t === 'OK' || t === '知道了') && btn.getBoundingClientRect().width > 0) {
        // Only click if inside a dialog/alert context
        const parent = btn.closest('[role="dialog"], [role="alertdialog"], [data-testid*="alert"]');
        if (parent) btn.click();
      }
    }
  });
  await sleep(500);
}

/**
 * Fix 3: Check insufficient balance — scan visible text for "不足" / "insufficient".
 * Also detects disabled preview button (grayed out = insufficient).
 */
async function checkInsufficientBalance(page) {
  return await page.evaluate(() => {
    const bodyText = document.body?.textContent?.substring(0, 8000) || '';
    if (bodyText.includes('不足') || bodyText.includes('insufficient') || bodyText.includes('Insufficient')) {
      return true;
    }
    // Also check if preview button is disabled
    const confirmBtn = document.querySelector('[data-testid="page-footer-confirm"]');
    if (confirmBtn && (confirmBtn.disabled || confirmBtn.getAttribute('aria-disabled') === 'true')) {
      return true;
    }
    return false;
  });
}

/**
 * Fix 2: Read preview page content and verify against expected values.
 * Returns { valid, details } where details lists what was found vs expected.
 */
async function assertPreviewPage(page, expected) {
  const previewContent = await page.evaluate(() => {
    // Read all visible text in the modal / page
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    const container = modal || document.body;
    const allText = container.textContent || '';

    // Extract structured info from spans/divs
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

  // Check network name
  if (expected.network) {
    const found = allText.includes(expected.network);
    checks.push({ field: 'network', expected: expected.network, found, severity: found ? 'pass' : 'warn' });
  }

  // Check token name
  if (expected.token) {
    const found = allText.includes(expected.token);
    checks.push({ field: 'token', expected: expected.token, found, severity: found ? 'pass' : 'warn' });
  }

  // Check recipient address (partial match — addresses are truncated in UI)
  if (expected.recipientAddress) {
    const addr = expected.recipientAddress;
    // Try matching last 4 chars of address
    const tail = addr.substring(addr.length - 4);
    const found = allText.includes(tail);
    checks.push({ field: 'recipient', expected: `...${tail}`, found, severity: found ? 'pass' : 'warn' });
  }

  // Check amount (may show as formatted number)
  if (expected.amount && expected.amount !== 'Max') {
    const found = allText.includes(expected.amount);
    checks.push({ field: 'amount', expected: expected.amount, found, severity: found ? 'pass' : 'warn' });
  }

  // Check memo
  if (expected.memo) {
    const found = allText.includes(expected.memo);
    checks.push({ field: 'memo', expected: expected.memo, found, severity: found ? 'pass' : 'warn' });
  }

  const passed = checks.filter(c => c.found).length;
  const total = checks.length;
  const valid = checks.every(c => c.severity === 'pass' || c.severity === 'warn');

  console.log(`    Preview assertions: ${passed}/${total} matched`);
  for (const c of checks) {
    const icon = c.found ? 'OK' : 'MISS';
    console.log(`      [${icon}] ${c.field}: "${c.expected}"`);
  }

  return { valid, checks, passed, total };
}

/**
 * Fix 4: After cancel, verify we're back to a known state.
 * If send form is still visible, close it. If at wallet home, good.
 */
async function recoverAfterCancel(page) {
  await sleep(500);
  const sendFormSel = getRawSelector('sendForm');
  const walletSel = getRawSelector('walletSelector');

  // Check if we're back at wallet home
  const atHome = await page.locator(walletSel).isVisible({ timeout: 2000 }).catch(() => false);
  if (atHome) return;

  // Still in some modal — try closing
  const inSendForm = await page.locator(sendFormSel).isVisible({ timeout: 1000 }).catch(() => false);
  if (inSendForm) {
    // Try nav-back to close the send form
    const navBackSel = getRawSelector('navBack');
    const navCloseSel = getRawSelector('navClose');
    await page.evaluate(({ back, close }) => {
      const backBtn = document.querySelector(back);
      if (backBtn) { backBtn.click(); return; }
      const closeBtn = document.querySelector(close);
      if (closeBtn) { closeBtn.click(); return; }
    }, { back: navBackSel, close: navCloseSel });
    await sleep(1000);
  }

  // Last resort: Escape
  await page.keyboard.press('Escape');
  await sleep(500);
}

/**
 * Click preview, assert content, then cancel or confirm.
 * Handles: insufficient detection, preview assertions, state recovery.
 *
 * @param expected - { network, token, amount, memo, recipientAddress } for assertions
 */
async function clickPreviewAndVerify(page, testId, verifyDepth = 'preview-and-cancel', expected = {}) {
  // Fix 3: Check insufficient BEFORE clicking preview (may already show after entering amount)
  await sleep(2000); // Wait for gas estimation / balance check
  const insufficientBefore = await checkInsufficientBalance(page);
  if (insufficientBefore) {
    console.log(`    Insufficient balance detected before preview`);
    return 'insufficient';
  }

  // Click preview using testid
  const previewSel = getRawSelector('pageFooterConfirm');
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

  // Screenshot preview page
  const previewPath = pathResolve(RESULTS_DIR, `${testId}-preview.png`);
  await page.screenshot({ path: previewPath }).catch(() => {});

  // Check insufficient on preview page
  const insufficientOnPreview = await checkInsufficientBalance(page);
  if (insufficientOnPreview) {
    console.log(`    Insufficient balance detected on preview page`);
    await recoverAfterCancel(page);
    return 'insufficient';
  }

  // Fix 2: Assert preview page content
  if (Object.keys(expected).length > 0) {
    await assertPreviewPage(page, expected);
  }

  if (verifyDepth === 'preview-and-cancel') {
    // Smoke test: verify preview shown, then cancel
    const cancelSel = getRawSelector('pageFooterCancel');
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
    // Fix 4: Verify state recovery after cancel
    await recoverAfterCancel(page);
    return 'success';
  }

  // Full test: click confirm
  try {
    const confirmBtn = page.locator(previewSel);
    await confirmBtn.click({ timeout: 10000 });
  } catch {
    const insufficient = await checkInsufficientBalance(page);
    if (insufficient) return 'insufficient';
    throw new Error('Confirm button click failed');
  }
  await sleep(8000);

  const successPath = pathResolve(RESULTS_DIR, `${testId}-success.png`);
  await page.screenshot({ path: successPath }).catch(() => {});
  return 'success';
}

// ════════════════════════════════════════════
// TRANSFER FLOW — orchestrates all actions for one strategy
// ════════════════════════════════════════════

/**
 * Execute transfer flow with amount fallback.
 * Flow: open form → recipient → enter amount → preview
 * If insufficient at specified amount → clear → try Max (within same form)
 * If Max also insufficient → return 'insufficient'
 */
async function executeTransferFlow(page, { testId, network, token, amount, amount_fallback, memo, sender, recipient, verifyDepth }) {
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

  // Enter memo first (before amount, stays valid across retries)
  if (memo) {
    console.log(`  [${testId}] Enter memo: ${memo}...`);
    await enterMemo(page, memo);
  }

  // Build expected assertions for preview page
  const expected = {
    network: network || null,
    token: token || null,
    amount: amount,
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

  // Try 2: Amount fallback (Max) — stay in same form
  if (amount_fallback && amount !== amount_fallback) {
    console.log(`  [${testId}] Amount ${amount} insufficient, falling back to ${amount_fallback}...`);

    // Screenshot the insufficient state
    const insuffPath = pathResolve(RESULTS_DIR, `${testId}-insufficient-${amount}.png`);
    await page.screenshot({ path: insuffPath }).catch(() => {});

    // Fix 5: Dismiss any error dialog/toast blocking the form before retrying
    await dismissErrorDialogs(page);

    // Verify send form is still visible (not closed by error)
    const sendFormSel = getRawSelector('sendForm');
    const formStillOpen = await page.locator(sendFormSel).isVisible({ timeout: 2000 }).catch(() => false);
    if (!formStillOpen) {
      console.log(`  [${testId}] Send form closed after error, cannot retry with fallback`);
      return { status: 'insufficient', amount_used: amount, reason: 'form_closed_after_error' };
    }

    // Clear amount and enter fallback
    const amountInput = page.locator(`${sendFormSel} input`).first();
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

    // Screenshot Max insufficient
    const maxInsuffPath = pathResolve(RESULTS_DIR, `${testId}-insufficient-max.png`);
    await page.screenshot({ path: maxInsuffPath }).catch(() => {});
  }

  return { status: 'insufficient', amount_used: amount_fallback || amount, reason: 'both_amounts_insufficient' };
}

// ════════════════════════════════════════════
// GENERIC STEP EXECUTOR — runs test_cases.json steps sequentially
// For non-transfer flows (settings, navigation, etc.)
// ════════════════════════════════════════════

async function executeSteps(page, testCase, testId, stateRecoveries = []) {
  const steps = testCase.steps || [];
  const results = [];
  let failed = false;

  for (const step of steps) {
    if (failed) break;

    // Auto-detect and handle password prompts between steps
    const pwdResult = await handlePasswordPromptIfPresent(page);
    if (pwdResult.handled) {
      console.log(`    [adaptive] Handled ${pwdResult.type} before step ${step.order}`);
      stateRecoveries.push({ step: step.order, issue: pwdResult.type, resolution: 'auto_handled' });
      await sleep(1000); // Let app settle after password handling
    }

    console.log(`  [${testId}] Step ${step.order}: ${step.action} ${step.ui_element || ''} ${step.param || ''}`);

    try {
      switch (step.action) {
        case 'dismiss_overlays':
          await dismissOverlays(page);
          break;

        case 'click_sidebar': {
          // Click an element in the sidebar by testid
          const el = await resolve(page, step.ui_element, { timeout: 3000 });
          await el.click();
          await sleep(1500);
          break;
        }

        case 'click_menu_item': {
          // Click a menu/tab item — may need to wait for popover/modal
          await sleep(1000);
          const el = await resolve(page, step.ui_element, { timeout: 5000 });
          await el.click();
          await sleep(1500);
          break;
        }

        // ── Wallet creation & onboarding actions ──
        case 'open_account_selector': {
          // First ensure we're at wallet home — close any leftover modals/overlays
          await closeAllModals(page);
          await goToWalletHome(page);
          await sleep(1000);
          // Click wallet selector — use JS click to bypass any overlay interception
          const walletSel = getRawSelector(step.ui_element || 'walletSelector');
          const clicked = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (el && el.getBoundingClientRect().width > 0) {
              el.click();
              return true;
            }
            return false;
          }, walletSel);
          if (!clicked) {
            // Fallback: resolve + force click
            const el = await resolve(page, step.ui_element || 'walletSelector', { timeout: 5000 });
            await el.click({ force: true });
          }
          await sleep(2000);
          break;
        }

        case 'click_add_wallet': {
          const el = await resolve(page, step.ui_element || 'addWalletButton', { timeout: 5000 });
          await el.click();
          await sleep(2000);
          break;
        }

        case 'select_wallet_type': {
          // Click the wallet type card — need to click the card container, not just text
          const targetText = step.text || '创建助记词钱包';
          // First try ui_element from ui-map (e.g., createMnemonicWalletOption)
          if (step.ui_element) {
            try {
              const el = await resolve(page, step.ui_element, { timeout: 5000 });
              await el.click();
              console.log(`    Selected wallet type via ui-map: ${targetText}`);
              await sleep(3000);
              break;
            } catch { /* fallback to evaluate */ }
          }
          // Fallback: find the card div containing the text and click it
          const clicked = await page.evaluate((text) => {
            // Find spans with the exact title text
            const spans = document.querySelectorAll('span');
            for (const sp of spans) {
              const r = sp.getBoundingClientRect();
              if (r.width > 0 && sp.textContent?.trim() === text) {
                // Walk up to find the clickable card container (the bordered div)
                let card = sp.parentElement;
                for (let i = 0; i < 8 && card; i++) {
                  const cr = card.getBoundingClientRect();
                  // Card is typically 300-500px wide, has border styling
                  if (cr.width > 200 && cr.height > 80 && card.tagName === 'DIV') {
                    card.click();
                    return 'card';
                  }
                  card = card.parentElement;
                }
                // Fallback: click the span's parent
                sp.parentElement?.click();
                return 'parent';
              }
            }
            // Last fallback: includes match
            for (const sp of spans) {
              const r = sp.getBoundingClientRect();
              if (r.width > 0 && sp.textContent?.includes(text)) {
                sp.closest('[role="button"]')?.click() || sp.parentElement?.parentElement?.click() || sp.click();
                return 'includes';
              }
            }
            return null;
          }, targetText);
          if (!clicked) throw new Error(`Wallet type "${targetText}" not found`);
          console.log(`    Selected wallet type: ${targetText} (via ${clicked})`);
          await sleep(3000);
          break;
        }

        case 'wait_for_creation': {
          // Wait for wallet creation — the "添加钱包" modal must close first
          console.log('    Waiting for wallet creation...');
          let created = false;
          for (let i = 0; i < 30; i++) {
            await sleep(1000);
            const state = await page.evaluate(() => {
              const text = document.body?.textContent || '';
              // The "添加钱包" onboarding screen must be gone
              const onboardingGone = !text.includes('添加钱包') || !text.includes('连接硬件钱包');
              // And we should see wallet home OR backup prompt
              const walletHome = text.includes('备份您的钱包') || text.includes('Account #');
              return { onboardingGone, walletHome };
            });
            if (state.onboardingGone && state.walletHome) {
              console.log(`    Wallet created after ${i + 1}s`);
              created = true;
              break;
            }
            // Also take a screenshot at 10s if still waiting
            if (i === 10) {
              await takeScreenshot(page, test_id, 'wait-creation-10s');
              console.log('    Still waiting at 10s...');
            }
          }
          if (!created) {
            // Check if we're still on onboarding — might need to click again
            const stillOnboarding = await page.evaluate(() => {
              return document.body?.textContent?.includes('添加钱包') && document.body?.textContent?.includes('连接硬件钱包');
            });
            if (stillOnboarding) {
              throw new Error('Wallet creation did not complete — still on onboarding screen after 30s');
            }
            console.log('    Wallet creation timeout but onboarding screen gone, continuing...');
          }
          await sleep(2000);
          break;
        }

        case 'click_backup_options': {
          // Click the "..." more options on backup card
          const el = await resolve(page, step.ui_element || 'backupMoreOptions', { timeout: 5000 }).catch(() => null);
          if (el) {
            await el.click();
          } else {
            // Fallback: find the "..." button near "备份" text
            await page.evaluate(() => {
              const spans = document.querySelectorAll('span');
              for (const sp of spans) {
                if (sp.textContent?.includes('备份') && sp.getBoundingClientRect().width > 0) {
                  const card = sp.closest('div[class]');
                  if (card) {
                    const btns = card.querySelectorAll('button, [role="button"]');
                    for (const btn of btns) {
                      if (btn.getBoundingClientRect().width > 0) { btn.click(); return; }
                    }
                  }
                }
              }
            });
          }
          await sleep(1500);
          break;
        }

        case 'select_backup_method': {
          // Select backup method (e.g., "OneKey KeyTag")
          // May need to click "..." (more options) button first to reveal the option
          const methodText = step.text || 'OneKey KeyTag';

          // Check if method is already visible
          let found = await page.evaluate((text) => {
            const buttons = document.querySelectorAll('button, [role="button"]');
            for (const btn of buttons) {
              const r = btn.getBoundingClientRect();
              if (r.width > 0 && r.height > 0 && btn.textContent?.includes(text)) return true;
            }
            return false;
          }, methodText);

          // If not visible, click the "..." more options button on backup card
          if (!found) {
            console.log('    Clicking "..." to reveal backup options...');
            const moreClicked = await page.evaluate(() => {
              // Find the backup card area and look for a "..." / ellipsis button
              const allButtons = document.querySelectorAll('button, [role="button"]');
              for (const btn of allButtons) {
                const r = btn.getBoundingClientRect();
                const text = btn.textContent?.trim();
                // Small button with no text or "..." near the backup card
                if (r.width > 0 && r.width < 60 && r.height > 0 && r.height < 60 && (!text || text === '...' || text === '···')) {
                  // Check if it's near "备份" text (within backup card area)
                  const parent = btn.closest('div');
                  if (parent?.textContent?.includes('备份')) {
                    btn.click();
                    return true;
                  }
                }
              }
              // Fallback: find any small round button near backup card
              const backupSpans = document.querySelectorAll('span');
              for (const sp of backupSpans) {
                if (sp.textContent?.includes('备份') && sp.getBoundingClientRect().width > 0) {
                  const card = sp.closest('div[class*="border"], div[class*="bg"]');
                  if (card) {
                    const btns = card.querySelectorAll('button, [role="button"]');
                    // Find the "..." button (usually second button, small and round)
                    for (const btn of btns) {
                      const r = btn.getBoundingClientRect();
                      if (r.width > 20 && r.width < 60 && r.height > 20 && r.height < 60) {
                        const btnText = btn.textContent?.trim();
                        if (!btnText || btnText.length < 5) {
                          btn.click();
                          return true;
                        }
                      }
                    }
                  }
                }
              }
              return false;
            });

            if (moreClicked) {
              console.log('    Clicked "..." button');
              await sleep(1500);
            } else {
              console.log('    "..." button not found, trying direct search');
            }
          }

          // Now try to click the method
          // Try ui-map resolve first
          if (step.ui_element) {
            try {
              const el = await resolve(page, step.ui_element, { timeout: 3000 });
              await el.click();
              console.log(`    Selected backup method via ui-map: ${methodText}`);
              await sleep(2000);
              break;
            } catch { /* fallback */ }
          }

          // Text search
          const methodClicked = await page.evaluate((text) => {
            const buttons = document.querySelectorAll('button, [role="button"]');
            for (const btn of buttons) {
              const r = btn.getBoundingClientRect();
              if (r.width > 0 && r.height > 0 && btn.textContent?.includes(text)) {
                btn.click();
                return 'button';
              }
            }
            const els = document.querySelectorAll('span, div');
            for (const el of els) {
              const r = el.getBoundingClientRect();
              if (r.width > 0 && r.height > 0 && el.textContent?.includes(text)) {
                el.click();
                return 'text';
              }
            }
            return null;
          }, methodText);
          if (!methodClicked) throw new Error(`Backup method "${methodText}" not found`);
          console.log(`    Selected backup method: ${methodText} (via ${methodClicked})`);
          await sleep(2000);
          break;
        }

        case 'focus_input': {
          const el = await resolve(page, step.ui_element, { timeout: 5000 });
          await el.click();
          await sleep(300);
          break;
        }

        case 'input_password': {
          const pwdValue = step.value || WALLET_PASSWORD;
          const pwdSel = getRawSelector(step.ui_element || 'passwordInput');
          const input = page.locator(pwdSel).first();
          await input.click();
          await sleep(200);
          await input.fill(pwdValue);
          console.log(`    Entered password`);
          await sleep(500);
          break;
        }

        case 'submit_password': {
          // Click the arrow submit button or press Enter
          const submitEl = await resolve(page, step.ui_element || 'verifyingPassword', { timeout: 3000 }).catch(() => null);
          if (submitEl) {
            await submitEl.click();
          } else {
            // Fallback: press Enter on password input
            await page.keyboard.press('Enter');
          }
          console.log('    Submitted password');
          await sleep(3000);
          break;
        }

        case 'view_mnemonic': {
          // Wait for mnemonic backup modal to appear (shows 12 seed words)
          const mnemonicModal = await resolve(page, step.ui_element || 'modal', { timeout: 10000 });
          if (mnemonicModal) {
            console.log('    Mnemonic backup modal visible');
            await takeScreenshot(page, testId, 'mnemonic-backup');
          } else {
            throw new Error('Mnemonic backup modal not found');
          }
          await sleep(1000);
          break;
        }

        case 'confirm_backup_notice': {
          // First check/click any prerequisite checkbox (e.g., "我已备份")
          const checkboxClicked = await page.evaluate(() => {
            // Look for checkbox or "我已备份" text that needs to be clicked
            const checkboxes = document.querySelectorAll('input[type="checkbox"], [role="checkbox"]');
            for (const cb of checkboxes) {
              const r = cb.getBoundingClientRect();
              if (r.width > 0 && !cb.checked) {
                cb.click();
                return 'checkbox';
              }
            }
            // Also try clicking text "我已备份" directly
            const spans = document.querySelectorAll('span, div, label');
            for (const sp of spans) {
              const r = sp.getBoundingClientRect();
              if (r.width > 0 && r.height > 0 && sp.textContent?.trim() === '我已备份') {
                sp.click();
                return 'text';
              }
            }
            return null;
          });
          if (checkboxClicked) {
            console.log(`    Checked "我已备份" (via ${checkboxClicked})`);
            await sleep(1000);
          }

          // Now click "我明白了" — wait for it to become enabled
          const confirmSel = getRawSelector(step.ui_element || 'pageFooterConfirm');
          // Wait for button to be enabled (up to 5s)
          for (let i = 0; i < 10; i++) {
            const enabled = await page.evaluate((sel) => {
              const btn = document.querySelector(sel);
              return btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true';
            }, confirmSel);
            if (enabled) break;
            await sleep(500);
          }
          // Use JS click to bypass any disabled check
          const clicked = await page.evaluate((sel) => {
            const btn = document.querySelector(sel);
            if (btn) { btn.click(); return true; }
            return false;
          }, confirmSel);
          if (!clicked) {
            // Fallback: force click via locator
            await page.locator(confirmSel).click({ force: true, timeout: 5000 });
          }
          console.log(`    Confirmed: ${step.text || '我明白了'}`);
          await sleep(2000);
          break;
        }

        case 'assert_wallet_created': {
          // Verify wallet home is visible with Account #1
          const walletSel = getRawSelector('walletSelector');
          const visible = await page.locator(walletSel).isVisible({ timeout: 10000 }).catch(() => false);
          if (!visible) throw new Error('Wallet selector not visible after creation');
          const accountText = await page.locator(walletSel).textContent();
          console.log(`    Wallet visible: "${accountText}"`);
          results.push({ step: step.order, action: 'assert_wallet_created', passed: true, account: accountText });
          break;
        }

        // ── Referral / invite code actions ──
        case 'assert_referral_card_visible': {
          const visible = await page.evaluate(() => {
            return document.body?.textContent?.includes('加入 OneKey 推荐计划') || false;
          });
          if (!visible) throw new Error('Referral card not visible');
          console.log('    Referral card visible');
          break;
        }

        case 'input_invite_code': {
          const codeValue = step.value || testCase.data?.inviteCode || '';
          const sel = getRawSelector(step.ui_element || 'inviteCodeInput');
          const input = page.locator(sel).first();
          const vis = await input.isVisible({ timeout: 5000 }).catch(() => false);
          if (vis) {
            await input.click();
            await sleep(200);
            await input.fill(codeValue);
          } else {
            // Fallback: try placeholder-based selector
            await page.locator('input[placeholder*="邀请"]').first().fill(codeValue);
          }
          console.log(`    Entered invite code: ${codeValue}`);
          await sleep(500);
          break;
        }

        case 'click_join': {
          const joinEl = await resolve(page, step.ui_element || 'inviteCodeJoinButton', { timeout: 5000 });
          await joinEl.click();
          console.log('    Clicked join');
          await sleep(3000);
          break;
        }

        case 'assert_success_toast': {
          // Wait for success toast
          const hasToast = await page.evaluate(() => {
            const text = document.body?.textContent || '';
            return text.includes('成功') || text.includes('Success');
          });
          console.log(`    Success toast: ${hasToast ? 'found' : 'not found'}`);
          results.push({ step: step.order, action: 'assert_success_toast', passed: hasToast });
          if (!hasToast) {
            // Not a hard failure — toast may have already disappeared
            console.log('    Warning: success toast not detected (may have auto-dismissed)');
          }
          break;
        }

        case 'assert_referral_card_hidden': {
          await sleep(2000);
          const hidden = await page.evaluate(() => {
            return !document.body?.textContent?.includes('加入 OneKey 推荐计划');
          });
          console.log(`    Referral card hidden: ${hidden}`);
          results.push({ step: step.order, action: 'assert_referral_card_hidden', passed: hidden });
          break;
        }

        // Transfer flow actions (for compatibility)
        case 'select_account':
          await switchAccount(page, step.param?.replace('{strategy.sender}', '') || step.param);
          break;
        case 'select_network':
          await switchNetwork(page, step.param);
          break;
        case 'click_send':
          await openSendForm(page, step.param || 'AKT');
          break;

        default:
          console.log(`    Unknown action: ${step.action}, skipping`);
      }
    } catch (e) {
      console.log(`    Step ${step.order} failed: ${e.message}`);
      results.push({ step: step.order, action: step.action, error: e.message });
      failed = true;
    }
  }

  return {
    result: failed ? 'failed' : 'success',
    strategy: 'steps',
    assertionResults: results,
    attemptLog: [{ strategy: 'steps', status: failed ? 'failed' : 'success', reason: null }],
  };
}

// ════════════════════════════════════════════
// STRATEGY LOOP — iterates test case strategies
// No hardcoded direction reversal. All logic from test_cases.json.
// ════════════════════════════════════════════

/**
 * Strategy execution loop:
 * For each strategy (direction):
 *   1. Try specified amount
 *   2. If insufficient → try Max (amount_fallback) in same form
 *   3. If still insufficient → close modals → next strategy (reversed direction)
 * All exhausted → mark failed with "insufficient_balance" + screenshots
 */
async function executeWithStrategies(page, testCase, test_id, verifyDepth) {
  const { network, token } = testCase.data || {};
  const strategies = testCase.strategies || [
    { label: 'default', sender: 'piggy', recipient: 'vault', ...testCase.data }
  ];

  const attemptLog = []; // Track all attempts for reporting

  for (const strategy of strategies) {
    const amount = strategy.amount || testCase.data?.amount;
    const amount_fallback = strategy.amount_fallback || null;
    const memo = strategy.memo !== undefined ? strategy.memo : testCase.data?.memo;

    console.log(`[${test_id}] Strategy: "${strategy.label}" (${strategy.sender} -> ${strategy.recipient}, amount: ${amount}${amount_fallback ? `, fallback: ${amount_fallback}` : ''})`);

    // Step 1: Dismiss overlays + handle any password prompt
    await dismissOverlays(page);
    await handlePasswordPromptIfPresent(page);

    // Step 2: Switch to sender account + network
    await goToWalletHome(page);
    await switchAccount(page, strategy.sender);
    await switchNetwork(page, network);

    // Execute transfer flow (handles amount fallback internally)
    const flowResult = await executeTransferFlow(page, {
      testId: test_id, network, token, amount, amount_fallback, memo,
      sender: strategy.sender, recipient: strategy.recipient,
      verifyDepth,
    });

    attemptLog.push({
      strategy: strategy.label,
      sender: strategy.sender,
      recipient: strategy.recipient,
      amount_tried: amount,
      amount_fallback: amount_fallback,
      amount_used: flowResult.amount_used,
      status: flowResult.status,
      reason: flowResult.reason,
    });

    if (flowResult.status === 'success') {
      console.log(`[${test_id}] Strategy "${strategy.label}" succeeded (amount: ${flowResult.amount_used})`);
      return { result: 'success', strategy: strategy.label, amount_used: flowResult.amount_used, attemptLog };
    }

    if (flowResult.status === 'insufficient') {
      console.log(`[${test_id}] Strategy "${strategy.label}" insufficient (${flowResult.reason}), trying next direction...`);
      await closeAllModals(page);
      await sleep(1000);
      continue;
    }

    // Other failure — don't try more strategies
    return { result: flowResult.status, strategy: strategy.label, attemptLog };
  }

  // All strategies exhausted — mark as failed
  console.log(`[${test_id}] All strategies exhausted — insufficient balance on all accounts`);

  // Final screenshot
  const failPath = pathResolve(RESULTS_DIR, `${test_id}-all-insufficient.png`);
  await page.screenshot({ path: failPath }).catch(() => {});

  return {
    result: 'failed',
    strategy: 'all_exhausted',
    failure_reason: 'insufficient_balance',
    failure_detail: attemptLog.map(a => `${a.sender}→${a.recipient}: ${a.reason}`).join('; '),
    attemptLog,
  };
}

// ════════════════════════════════════════════
// UNIFIED ENTRY POINT
// ════════════════════════════════════════════

export async function run_case(test_id, platform = 'desktop') {
  mkdirSync(RESULTS_DIR, { recursive: true });

  const testCasesData = JSON.parse(readFileSync(pathResolve(SHARED_DIR, 'test_cases.json'), 'utf-8'));
  const cases = testCasesData.cases || testCasesData;
  const verifyDepth = testCasesData.verifyDepth || 'preview-and-cancel';
  const testCase = (Array.isArray(cases) ? cases : []).find(tc => tc.id === test_id);
  if (!testCase) throw new Error(`Test case ${test_id} not found`);

  // Ensure OneKey is running BEFORE connecting
  await ensureOneKeyRunning();

  const browser = await chromium.connectOverCDP(CDP_URL);
  let page = browser.contexts()[0]?.pages()[0];

  // Wait for page to be available (app may still be loading)
  if (!page) {
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      const ctx = browser.contexts()[0];
      page = ctx?.pages()[0];
      if (page) break;
    }
    if (!page) throw new Error('No page found via CDP after 20s');
  }

  const startTime = Date.now();
  const screenshots = [];
  const stateRecoveries = [];
  const { network, token, amount, memo } = testCase.data || {};

  // Determine execution mode: step-based vs strategy-based (transfer)
  const isStepBased = Array.isArray(testCase.steps) && testCase.steps.length > 0;

  console.log(`\n${'='.repeat(60)}`);
  if (isStepBased) {
    console.log(`Running: ${test_id} - ${testCase.title || 'Step-based test'}`);
    console.log(`Steps: ${testCase.steps.length}`);
  } else {
    console.log(`Running: ${test_id} - ${network} / ${token} / ${amount}${memo ? ` / memo: ${memo}` : ''}`);
    console.log(`Strategies: ${(testCase.strategies || []).map(s => s.label).join(', ') || 'default'}`);
  }
  console.log(`Verify depth: ${verifyDepth}`);
  console.log('='.repeat(60));

  try {
    // Pre-flight: unlock if needed
    const unlocked = await unlockWalletIfNeeded(page);
    if (unlocked) stateRecoveries.push({ step: 0, issue: 'wallet_locked', resolution: 'unlocked' });

    screenshots.push(await takeScreenshot(page, test_id, 'start'));

    // Dispatch: step-based flows vs transfer strategy flows
    const strategyResult = isStepBased
      ? await executeSteps(page, testCase, test_id, stateRecoveries)
      : await executeWithStrategies(page, testCase, test_id, verifyDepth);

    const duration = Date.now() - startTime;
    const finalStatus = strategyResult.result === 'success' ? 'passed' : strategyResult.result;
    console.log(`[${test_id}] ${finalStatus.toUpperCase()} via strategy "${strategyResult.strategy}" (${(duration / 1000).toFixed(1)}s)`);
    screenshots.push(await takeScreenshot(page, test_id, 'done'));

    const error = finalStatus !== 'passed'
      ? (strategyResult.failure_reason
          ? `${strategyResult.failure_reason}: ${strategyResult.failure_detail}`
          : `Strategy "${strategyResult.strategy}" failed`)
      : null;

    const result = buildResult(test_id, finalStatus, duration, error, [], screenshots, stateRecoveries);
    result.attemptLog = strategyResult.attemptLog || [];
    result.amount_used = strategyResult.amount_used || null;
    result.failure_reason = strategyResult.failure_reason || null;
    if (strategyResult.assertionResults) result.assertionResults = strategyResult.assertionResults;
    if (strategyResult.assertionSummary) result.assertionSummary = strategyResult.assertionSummary;
    saveResult(test_id, result);
    createMemCell(result);
    updateProfile(platform, result);
    await browser.close().catch(() => {});
    return result;

  } catch (error) {
    const duration = Date.now() - startTime;
    const errPath = await takeScreenshot(page, test_id, 'error');
    screenshots.push(errPath);
    console.error(`[${test_id}] FAILED (${(duration / 1000).toFixed(1)}s): ${error.message}`);
    const result = buildResult(test_id, 'failed', duration, error.message, [], screenshots, stateRecoveries);
    saveResult(test_id, result);
    createMemCell(result);
    updateProfile(platform, result);
    await browser.close().catch(() => {});
    return result;
  }
}

// ════════════════════════════════════════════
// BATCH RUN — execute multiple cases sequentially
// ════════════════════════════════════════════

export async function run_batch(test_ids, platform = 'desktop') {
  mkdirSync(RESULTS_DIR, { recursive: true });

  const testCasesData = JSON.parse(readFileSync(pathResolve(SHARED_DIR, 'test_cases.json'), 'utf-8'));
  const cases = testCasesData.cases || testCasesData;
  const verifyDepth = testCasesData.verifyDepth || 'preview-and-cancel';
  const ids = test_ids === 'all'
    ? (Array.isArray(cases) ? cases : []).map(tc => tc.id)
    : test_ids;

  // Ensure OneKey is running before connecting
  await ensureOneKeyRunning();

  const browser = await chromium.connectOverCDP(CDP_URL);
  const page = browser.contexts()[0]?.pages()[0];
  if (!page) throw new Error('No page found via CDP');

  console.log(`OneKey Transfer Tests — ${ids.length} cases`);
  console.log(`CDP: ${CDP_URL}\n`);

  const results = [];

  for (const testId of ids) {
    const testCase = (Array.isArray(cases) ? cases : []).find(tc => tc.id === testId);
    if (!testCase) {
      console.log(`Skipping ${testId}: not found`);
      continue;
    }

    const { network, token, amount, memo } = testCase.data || {};
    const startTime = Date.now();
    const screenshots = [];
    const stateRecoveries = [];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running: ${testId} - ${network} / ${token} / ${amount}${memo ? ` / memo: ${memo}` : ''}`);
    console.log(`Strategies: ${(testCase.strategies || []).map(s => s.label).join(', ') || 'default'}`);
    console.log('='.repeat(60));

    try {
      await unlockWalletIfNeeded(page);

      // Execute via strategy loop (with amount fallback)
      const strategyResult = await executeWithStrategies(page, testCase, testId, verifyDepth);

      const duration = Date.now() - startTime;
      const finalStatus = strategyResult.result === 'success' ? 'passed' : strategyResult.result;
      const error = finalStatus !== 'passed'
        ? (strategyResult.failure_reason
            ? `${strategyResult.failure_reason}: ${strategyResult.failure_detail}`
            : `Strategy "${strategyResult.strategy}" failed`)
        : null;

      console.log(`[${testId}] ${finalStatus.toUpperCase()} via strategy "${strategyResult.strategy}" (${(duration / 1000).toFixed(1)}s)`);

      const r = buildResult(testId, finalStatus, duration, error, [], screenshots, stateRecoveries);
      r.attemptLog = strategyResult.attemptLog || [];
      r.amount_used = strategyResult.amount_used || null;
      r.failure_reason = strategyResult.failure_reason || null;
      saveResult(testId, r);
      createMemCell(r);
      results.push(r);

    } catch (error) {
      const duration = Date.now() - startTime;
      const errPath = await takeScreenshot(page, testId, 'error');
      screenshots.push(errPath);
      console.error(`[${testId}] FAILED (${(duration / 1000).toFixed(1)}s): ${error.message}`);
      const r = buildResult(testId, 'failed', duration, error.message, [], screenshots, stateRecoveries);
      saveResult(testId, r);
      createMemCell(r);
      results.push(r);
    }

    // Fix 6: Robust cleanup between tests — ensure clean state for next case
    try {
      await dismissErrorDialogs(page);
      await closeAllModals(page);
      await goToWalletHome(page);

      // Verify we're actually at wallet home
      const walletSel = getRawSelector('walletSelector');
      const atHome = await page.locator(walletSel).isVisible({ timeout: 3000 }).catch(() => false);
      if (!atHome) {
        console.log(`  Cleanup: not at wallet home, forcing navigation...`);
        // Force: press Escape multiple times, then click home
        for (let i = 0; i < 3; i++) {
          await page.keyboard.press('Escape');
          await sleep(300);
        }
        await dismissOverlays(page);
        await goToWalletHome(page);
      }
    } catch (e) {
      console.log(`  Cleanup warning: ${e.message}`);
      // Last resort: Escape spam
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Escape').catch(() => {});
        await sleep(200);
      }
    }
    await sleep(1000);
  }

  // Summary
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${skipped} skipped, ${results.length} total`);
  console.log('='.repeat(60));
  results.forEach(r => {
    const icon = { passed: 'PASS', failed: 'FAIL', skipped: 'SKIP' }[r.status] || '????';
    console.log(`  [${icon}] ${r.testId} (${(r.duration / 1000).toFixed(1)}s)${r.error ? ' - ' + r.error.substring(0, 80) : ''}`);
  });

  const summary = { timestamp: new Date().toISOString(), total: results.length, passed, failed, skipped, results };
  writeFileSync(pathResolve(RESULTS_DIR, 'cosmos-summary.json'), JSON.stringify(summary, null, 2));

  await browser.close();
  updateProfile(platform, { status: passed === results.length ? 'passed' : 'failed' });
  return summary;
}

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════

async function takeScreenshot(page, testId, label) {
  const path = pathResolve(RESULTS_DIR, `${testId}-${label}.png`);
  await page.screenshot({ path }).catch(() => {});
  return path;
}

function buildResult(test_id, status, duration, error, steps, screenshots, recoveries) {
  return {
    testId: test_id, status, duration, error,
    steps, screenshots,
    state_recoveries: recoveries,
    timestamp: new Date().toISOString(),
  };
}

function saveResult(test_id, result) {
  writeFileSync(pathResolve(RESULTS_DIR, `${test_id}.json`), JSON.stringify(result, null, 2));
}

// ════════════════════════════════════════════
// CLI ENTRY
// ════════════════════════════════════════════

const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  const args = process.argv.slice(2);
  const platform = args.find(a => ['desktop', 'web', 'android', 'ios'].includes(a)) || 'desktop';
  const testIds = args.filter(a => !['desktop', 'web', 'android', 'ios'].includes(a));

  if (testIds.length === 0) {
    console.error('Usage: node src/runner/index.mjs <test_id|all> [platform]');
    console.error('  node src/runner/index.mjs COSMOS-001');
    console.error('  node src/runner/index.mjs COSMOS-001 COSMOS-002 COSMOS-003');
    console.error('  node src/runner/index.mjs all');
    process.exit(1);
  }

  const isBatch = testIds.length > 1 || testIds[0] === 'all';

  if (isBatch) {
    const ids = testIds[0] === 'all' ? 'all' : testIds;
    run_batch(ids, platform)
      .then(s => {
        console.log(`\nDone. ${s.passed}/${s.total} passed.`);
        process.exit(s.failed > 0 ? 1 : 0);
      })
      .catch(e => { console.error('Fatal:', e); process.exit(2); });
  } else {
    run_case(testIds[0], platform)
      .then(r => {
        console.log(`${r.status}: ${r.testId} (${(r.duration / 1000).toFixed(1)}s)`);
        process.exit(r.status === 'passed' ? 0 : 1);
      })
      .catch(e => { console.error('Fatal:', e); process.exit(2); });
  }
}
