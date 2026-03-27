// Global component functions — shared across all test files
// Each function calls registry.resolve() internally
// Imports from constants.mjs (NOT index.mjs) to avoid circular dependency
import { registry } from './ui-registry.mjs';
import { sleep, WALLET_PASSWORD } from './constants.mjs';

// ── Step Tracker (moved from market-search.mjs + market-chart.mjs) ──

export function createStepTracker(testId) {
  const steps = [];
  const errors = [];
  return {
    testId, steps, errors,
    add(name, status, detail = '') {
      steps.push({ name, status, detail, time: new Date().toISOString() });
      const icon = status === 'passed' ? 'OK' : status === 'skipped' ? 'SKIP' : 'FAIL';
      console.log(`  [${icon}] ${name}${detail ? ` — ${detail}` : ''}`);
      if (status === 'failed') errors.push(`${name}: ${detail}`);
    },
    /** Mark a step as skipped with reason. */
    skip(name, reason) {
      this.add(name, 'skipped', reason);
    },
    result() {
      const passed = steps.filter(s => s.status === 'passed').length;
      const failed = steps.filter(s => s.status === 'failed').length;
      const skipped = steps.filter(s => s.status === 'skipped').length;
      return {
        status: errors.length === 0 ? 'passed' : 'failed',
        steps, errors,
        summary: { passed, failed, skipped, total: steps.length },
      };
    },
  };
}

/**
 * Safe step wrapper — catches errors, logs result, takes screenshot on failure.
 * @param screenshotFnOrDir — accepts either:
 *   - a function (page, name) => void  (market-search.mjs style)
 *   - a directory string (market-chart.mjs style — auto-screenshots to that dir)
 */
export async function safeStep(page, t, name, fn, screenshotFnOrDir) {
  try {
    const detail = await fn();
    t.add(name, 'passed', detail || '');
    return true;
  } catch (e) {
    t.add(name, 'failed', e.message || String(e));
    const failName = `${t.testId || 'unknown'}-${name.replace(/\s+/g, '-').slice(0, 40)}-fail`;
    if (typeof screenshotFnOrDir === 'function') {
      await screenshotFnOrDir(page, failName);
    } else if (typeof screenshotFnOrDir === 'string') {
      // Directory string — use inline screenshot
      try {
        const { mkdirSync } = await import('node:fs');
        mkdirSync(screenshotFnOrDir, { recursive: true });
        await page.screenshot({ path: `${screenshotFnOrDir}/${failName}.png` });
      } catch {}
    }
    return false;
  }
}

// ── Modal Management ────────────────────────────────────────

export async function isModalVisible(page) {
  return page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return false;
    const r = modal.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

export async function waitForModal(page, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await isModalVisible(page)) return true;
    await sleep(200);
  }
  throw new Error('Modal did not appear within timeout');
}

export async function closeModal(page) {
  // Try nav-header-close first
  const closeLocator = await registry.resolveOrNull(page, 'navClose', { context: 'modal' });
  if (closeLocator) {
    try {
      await closeLocator.click();
      await sleep(500);
      return;
    } catch {}
  }
  // Fallback: Escape
  await page.keyboard.press('Escape');
  await sleep(500);
}

export async function closeAllModals(page) {
  await dismissOverlays(page);
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!(await isModalVisible(page))) break;
    await closeModal(page);
  }
  await sleep(300);
}

export async function dismissOverlays(page) {
  // Overlay popover (note: app has typo 'ovelay')
  const overlay = await registry.resolveOrNull(page, 'overlayPopover', { context: 'page', timeout: 500 });
  if (overlay) {
    try { await overlay.click(); await sleep(300); } catch {}
  }
  // Modal backdrop
  const backdrop = await registry.resolveOrNull(page, 'modalBackdrop', { context: 'page', timeout: 500 });
  if (backdrop) {
    try { await backdrop.click(); await sleep(300); } catch {}
  }
  await page.keyboard.press('Escape');
  await sleep(200);
}

export async function dismissBackdrop(page) {
  const backdrop = await registry.resolveOrNull(page, 'modalBackdrop', { context: 'page', timeout: 500 });
  if (backdrop) {
    try { await backdrop.click(); await sleep(300); } catch {}
  }
}

// ── Search ──────────────────────────────────────────────────

export async function openSearchModal(page) {
  await page.bringToFront().catch(() => {});
  if (await isModalVisible(page)) {
    // Check if it's already the search modal
    const hasSearchInput = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      return !!modal?.querySelector('input[data-testid="nav-header-search"]');
    });
    if (hasSearchInput) return;
  }

  // Click the header search trigger (NOT the one inside a modal)
  // registry.resolve returns either a Locator or ClickablePoint — both have .click()
  const trigger = await registry.resolve(page, 'searchInput', { context: 'page' });
  await trigger.click();
  await sleep(800);

  // Verify modal opened; retry once
  if (!(await isModalVisible(page))) {
    const trigger2 = await registry.resolve(page, 'searchInput', { context: 'page' });
    await trigger2.click();
    await sleep(1000);
  }
}

export async function getSearchInput(page) {
  return registry.resolve(page, 'searchInput', { context: 'modal' });
}

export async function typeSearch(page, value) {
  await openSearchModal(page);
  const input = await getSearchInput(page);
  await input.click();
  await sleep(200);

  // Clear existing content
  await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    const inp = modal?.querySelector('input');
    if (inp) { inp.focus(); inp.select(); }
  });
  await page.keyboard.press('Backspace');
  await sleep(200);

  if (value) {
    try {
      await input.pressSequentially(value, { delay: 40 });
    } catch {
      await input.type(value, { delay: 40 });
    }
  }
  await sleep(1500);
}

export async function clearSearch(page) {
  // Use registry for clear button
  const clearBtn = await registry.resolveOrNull(page, 'searchClearButton', { context: 'modal', timeout: 800 });
  if (clearBtn) {
    try { await clearBtn.click(); await sleep(500); return; } catch {}
  }
  // Fallback: select + backspace inside modal
  await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    const input = modal?.querySelector('input');
    if (input) { input.focus(); input.select(); }
  });
  await page.keyboard.press('Backspace');
  await sleep(500);
}

export async function closeSearch(page) {
  const closeBtn = await registry.resolveOrNull(page, 'navClose', { context: 'modal', timeout: 1200 });
  if (closeBtn) {
    try { await closeBtn.click(); await sleep(800); return; } catch {}
  }
  await page.keyboard.press('Escape');
  await sleep(800);
}

// ── Popover Helper ──────────────────────────────────────────
// IMPORTANT (K-024): Page has 8+ TMPopover-ScrollView instances, most hidden.
// ALWAYS use this helper instead of querySelector (which returns the first hidden one).

/**
 * JS snippet to find the visible TMPopover-ScrollView inside page.evaluate.
 * Usage: const pop = eval(FIND_VISIBLE_POPOVER_JS); if (!pop) ...
 * Returns the DOM element or null.
 */
export const FIND_VISIBLE_POPOVER_JS = `
  (() => {
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    for (const p of pops) { if (p.getBoundingClientRect().width > 0) return p; }
    return null;
  })()
`;

/**
 * Check if any TMPopover-ScrollView is visible.
 */
export async function isPopoverVisible(page) {
  return page.evaluate(() => {
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    for (const p of pops) { if (p.getBoundingClientRect().width > 0) return true; }
    return false;
  });
}

/**
 * Close visible popover by clicking the overlay backdrop.
 */
export async function dismissPopover(page) {
  await page.evaluate(() => {
    const overlay = document.querySelector('[data-testid="ovelay-popover"]');
    if (overlay) overlay.click();
  });
  await sleep(500);
}

/**
 * Open a button that uses React onPress (needs full PointerEvent sequence).
 * Works for buttons where el.click() or Playwright locator.click() may not trigger React handlers.
 * @param {import('playwright-core').Page} page
 * @param {string} selector — CSS selector for the button
 */
export async function clickWithPointerEvents(page, selector) {
  await page.evaluate((sel) => {
    const btn = document.querySelector(sel);
    if (!btn) throw new Error(`Button not found: ${sel}`);
    const r = btn.getBoundingClientRect();
    const x = r.x + r.width / 2, y = r.y + r.height / 2;
    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0 };
    btn.dispatchEvent(new PointerEvent('pointerover', opts));
    btn.dispatchEvent(new PointerEvent('pointerenter', { ...opts, bubbles: false }));
    btn.dispatchEvent(new PointerEvent('pointerdown', opts));
    btn.dispatchEvent(new MouseEvent('mousedown', opts));
    btn.dispatchEvent(new PointerEvent('pointerup', opts));
    btn.dispatchEvent(new MouseEvent('mouseup', opts));
    btn.dispatchEvent(new MouseEvent('click', opts));
  }, selector);
  await sleep(800);
}

// ── Sidebar Navigation ──────────────────────────────────────

const SIDEBAR_TAB_MAP = {
  'Market': 'sidebarMarket', '市场': 'sidebarMarket', 'マーケット': 'sidebarMarket', 'Mercado': 'sidebarMarket',
  'Perps': 'sidebarPerps', '合约': 'sidebarPerps',
  'Wallet': 'sidebarWallet', '钱包': 'sidebarWallet',
  'Home': 'sidebarHome', '首页': 'sidebarHome',
  'Swap': 'sidebarSwap', '交易': 'sidebarSwap',
  'DeFi': 'sidebarDeFi',
  'Discover': 'sidebarDiscover', '推荐': 'sidebarDiscover',
  'Browser': 'sidebarBrowser', '浏览器': 'sidebarBrowser',
  'Device': 'sidebarDevice', '设备': 'sidebarDevice',
  'Menu': 'sidebarMenu', '菜单': 'sidebarMenu',
};

/**
 * If on a sub/detail page (nav-header-back visible), click back to return
 * to the module list page. No-op if already on a top-level page.
 * Use in setup() before the first test case starts.
 */
export async function ensureOnListPage(page) {
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="nav-header-back"]');
    if (btn && btn.getBoundingClientRect().width > 0) { btn.click(); return true; }
    return false;
  });
  if (clicked) await sleep(1500);
  return clicked;
}

export async function clickSidebarTab(page, name) {
  // Try registry-based resolution first
  const elementName = SIDEBAR_TAB_MAP[name];
  if (elementName) {
    try {
      const locator = await registry.resolve(page, elementName, { context: 'page', timeout: 3000 });
      // Both Locator and ClickablePoint have .click()
      await locator.click();
      await sleep(2000);
      return;
    } catch {}
  }

  // Fallback: text-based sidebar search
  const labels = [name, ...Object.keys(SIDEBAR_TAB_MAP).filter(k => SIDEBAR_TAB_MAP[k] === elementName)];
  const clicked = await page.evaluate((labelsArr) => {
    const sidebar = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
    if (!sidebar) return false;
    for (const sp of sidebar.querySelectorAll('span')) {
      const txt = sp.textContent?.trim();
      if (!txt) continue;
      for (const label of labelsArr) {
        if (txt === label || txt.includes(label)) {
          const r = sp.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { sp.click(); return true; }
        }
      }
    }
    return false;
  }, labels);

  if (!clicked) throw new Error(`Cannot find sidebar tab: ${name}`);
  await sleep(2000);
}

// ── Password / Unlock ───────────────────────────────────────

export async function unlockIfNeeded(page) {
  // Re-use existing logic from navigation.mjs but via registry
  try {
    await sleep(3000);
    const isLocked = await page.evaluate(() => {
      const bodyText = document.body?.textContent || '';
      if (bodyText.includes('欢迎回来') || bodyText.includes('输入密码') || bodyText.includes('忘记密码')) return true;
      const lockEl = document.querySelector('[data-sentry-source-file*="AppStateLock"]');
      if (lockEl && lockEl.getBoundingClientRect().width > 0) return true;
      const pwdInput = document.querySelector('input[placeholder*="密码"]');
      if (pwdInput && pwdInput.getBoundingClientRect().width > 0) return true;
      return false;
    });
    if (!isLocked) return false;
    console.log('  Wallet locked, unlocking...');

    const pwdInput = await registry.resolveOrNull(page, 'passwordInput', { context: 'page', timeout: 5000 });
    if (pwdInput) {
      await pwdInput.click();
      await sleep(300);
      await pwdInput.fill(WALLET_PASSWORD);
      await sleep(500);
      const submitBtn = await registry.resolveOrNull(page, 'verifyingPassword', { context: 'page', timeout: 1000 });
      if (submitBtn) {
        await submitBtn.click();
      } else {
        await page.keyboard.press('Enter');
      }
    } else {
      // Last resort fallback
      const fallback = page.locator('input[type="password"]').first();
      await fallback.fill(WALLET_PASSWORD);
      await sleep(500);
      await fallback.press('Enter');
    }

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

    const hasWallet = await page.locator('[data-testid="AccountSelectorTriggerBase"]').isVisible({ timeout: 10000 }).catch(() => false);
    console.log(hasWallet ? '  Unlocked successfully.' : '  Unlock: wallet selector not visible, but lock screen cleared.');
    return true;
  } catch (e) {
    console.log(`  Unlock error: ${e.message}`);
    return false;
  }
}

export async function handlePasswordPrompt(page) {
  // Lightweight check for password dialog inside a modal
  const detection = await page.evaluate(() => {
    const bodyText = document.body?.textContent || '';
    const hasLockText = bodyText.includes('欢迎回来') || bodyText.includes('忘记密码');
    const lockEl = document.querySelector('[data-sentry-source-file*="AppStateLock"]');
    if (hasLockText || (lockEl && lockEl.getBoundingClientRect().width > 0)) return { type: 'lock_screen' };

    const pwdInputs = [
      document.querySelector('[data-testid="password-input"]'),
      ...document.querySelectorAll('input[type="password"]'),
      ...document.querySelectorAll('input[placeholder*="密码"]'),
    ].filter(Boolean);
    for (const input of pwdInputs) {
      const r = input.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const inModal = input.closest('[data-testid="APP-Modal-Screen"], [role="dialog"]');
      if (inModal) return { type: 'password_dialog' };
    }
    return { type: null };
  });

  if (!detection.type) return { handled: false, type: null };
  if (detection.type === 'lock_screen') {
    await unlockIfNeeded(page);
    return { handled: true, type: 'lock_screen' };
  }

  // Password dialog
  console.log('    [adaptive] Password re-verification dialog detected...');
  const pwdInput = await registry.resolveOrNull(page, 'passwordInput', { context: 'modal', timeout: 1000 });
  if (pwdInput) {
    await pwdInput.click();
    await sleep(200);
    await pwdInput.fill(WALLET_PASSWORD);
    await sleep(300);
    const submitBtn = await registry.resolveOrNull(page, 'verifyingPassword', { context: 'modal', timeout: 1000 });
    if (submitBtn) { await submitBtn.click(); } else { await page.keyboard.press('Enter'); }

    for (let i = 0; i < 10; i++) {
      await sleep(500);
      const stillVisible = await page.evaluate(() => {
        const inputs = [
          document.querySelector('[data-testid="password-input"]'),
          ...document.querySelectorAll('input[type="password"]'),
        ].filter(Boolean);
        return inputs.some(input => {
          const r = input.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && input.closest('[data-testid="APP-Modal-Screen"]');
        });
      });
      if (!stillVisible) break;
    }
    console.log('    [adaptive] Password dialog handled');
    return { handled: true, type: 'password_dialog' };
  }

  return { handled: false, type: null };
}

export async function enterPassword(page) {
  const pwdInput = await registry.resolve(page, 'passwordInput', { context: 'modal' });
  await pwdInput.click();
  await sleep(200);
  await pwdInput.fill(WALLET_PASSWORD);
  await sleep(300);
  const submitBtn = await registry.resolveOrNull(page, 'verifyingPassword', { context: 'modal', timeout: 1000 });
  if (submitBtn) { await submitBtn.click(); } else { await page.keyboard.press('Enter'); }
  await sleep(1000);
}

// ── Network Selector ────────────────────────────────────────

export async function openNetworkSelector(page) {
  const btn = await registry.resolve(page, 'networkButton', { context: 'page' });
  await btn.click();
  await sleep(1000);
}

export async function selectNetwork(page, name) {
  await openNetworkSelector(page);
  // Search for network by name inside the opened modal/popover
  const chainInput = await registry.resolveOrNull(page, 'chainSearchInput', { context: 'modal', timeout: 3000 });
  if (chainInput) {
    await chainInput.click();
    await sleep(200);
    await chainInput.pressSequentially(name, { delay: 40 });
    await sleep(1000);
  }
  // Click the first matching result
  const clicked = await page.evaluate((networkName) => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]') || document.body;
    for (const el of modal.querySelectorAll('span, div')) {
      if (el.textContent?.trim() === networkName && el.getBoundingClientRect().width > 0) {
        el.click();
        return true;
      }
    }
    return false;
  }, name);
  if (!clicked) throw new Error(`Network "${name}" not found`);
  await sleep(1000);
}

// ── Account Switcher ────────────────────────────────────────

/**
 * Switch to a different account/wallet.
 * Flow: navigate to Wallet → open account selector → (optional) click wallet type → search → click result.
 *
 * @param {import('playwright-core').Page} page
 * @param {string} accountName — account name to search for (e.g., "hl-99", "Account #1")
 * @param {string} [walletType] — wallet type tab to click first (e.g., "观察钱包", "产品").
 *   If omitted, searches across the currently selected wallet type.
 *   The account selector modal shows wallet types as tabs on the left.
 */
export async function switchToAccount(page, accountName, walletType) {
  // Step 1: Navigate to wallet page (account selector is visible there)
  await clickSidebarTab(page, 'Wallet');
  await sleep(2000);

  // Step 2: Open account selector
  await page.evaluate(() => {
    document.querySelector('[data-testid="AccountSelectorTriggerBase"]')?.click();
  });
  await sleep(2000);

  // Step 3: If walletType specified, click the corresponding tab
  if (walletType) {
    await page.evaluate((type) => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return;
      for (const sp of modal.querySelectorAll('span')) {
        if (sp.textContent?.trim() === type && sp.children.length === 0 && sp.getBoundingClientRect().width > 0) {
          sp.click();
          return;
        }
      }
    }, walletType);
    await sleep(1500);
  }

  // Step 4: Search for account name
  // Use nativeInputValueSetter for React compatibility
  await page.evaluate((name) => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) throw new Error('Account selector modal not found');
    const input = modal.querySelector('input[placeholder*="搜索"]');
    if (!input) throw new Error('Account search input not found');
    input.focus();
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (nativeSet) {
      nativeSet.call(input, name);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, accountName);
  await sleep(2000);

  // Step 5: Click the matching account
  const clicked = await page.evaluate((name) => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return null;
    // Exact match first
    for (const el of modal.querySelectorAll('span')) {
      const text = el.textContent?.trim();
      const r = el.getBoundingClientRect();
      if (text === name && r.width > 0 && r.height > 10 && r.height < 35 && el.children.length === 0) {
        el.click();
        return text;
      }
    }
    // Fuzzy match
    for (const el of modal.querySelectorAll('span, div')) {
      const text = el.textContent?.trim();
      const r = el.getBoundingClientRect();
      if (text && text.includes(name) && r.width > 0 && r.height > 10 && r.height < 50 && el.children.length < 3) {
        el.click();
        return text;
      }
    }
    return null;
  }, accountName);

  if (!clicked) throw new Error(`Account "${accountName}" not found in selector${walletType ? ` (type: ${walletType})` : ''}`);
  await sleep(3000);

  // Verify account switched
  const currentAccount = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="AccountSelectorTriggerBase"]');
    return el?.textContent?.trim()?.slice(0, 40) || null;
  });

  if (currentAccount && !currentAccount.includes(accountName)) {
    throw new Error(`Account switch failed: expected "${accountName}", got "${currentAccount}"`);
  }

  return currentAccount;
}

/**
 * Get current account name.
 */
export async function getCurrentAccount(page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="AccountSelectorTriggerBase"]');
    return el?.textContent?.trim()?.slice(0, 40) || null;
  });
}
