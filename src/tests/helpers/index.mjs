// Shared test helpers — CDP connection, screenshots, click utilities
// Re-exports navigation, accounts, network, transfer helpers for convenience
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

import { CDP_URL, WALLET_PASSWORD, ONEKEY_BIN, RESULTS_DIR, sleep } from './constants.mjs';
export { CDP_URL, WALLET_PASSWORD, ONEKEY_BIN, RESULTS_DIR, sleep };

/**
 * Ensure OneKey is running with CDP enabled.
 * Checks existing connection first, launches app if needed.
 */
export async function ensureOneKeyRunning() {
  // Step 1: Check if CDP is already responding — if so, use it (never spawn a second instance)
  for (let i = 0; i < 2; i++) {
    try {
      const resp = await fetch(`${CDP_URL}/json/version`);
      if (resp.ok) { console.log('  OneKey CDP ready.'); return; }
    } catch {}
    if (i === 0) await sleep(500);
  }

  // Step 2: CDP not responding — kill any stale OneKey and launch fresh
  console.log('  CDP not responding, restarting OneKey...');
  try { const { execSync } = await import('child_process'); execSync('pkill -f "OneKey"', { stdio: 'ignore' }); } catch {}
  await sleep(2000);

  if (!existsSync(ONEKEY_BIN)) throw new Error(`OneKey not found at ${ONEKEY_BIN}`);
  console.log('  Launching OneKey with CDP...');
  const child = spawn(ONEKEY_BIN, ['--remote-debugging-port=9222'], { detached: true, stdio: 'ignore' });
  child.unref();

  for (let i = 0; i < 60; i++) {
    await sleep(500);
    try {
      const resp = await fetch(`${CDP_URL}/json/version`);
      if (resp.ok) { console.log(`  OneKey ready after ${((i+1)*0.5).toFixed(1)}s`); return; }
    } catch {}
  }
  throw new Error('OneKey failed to start within 30s');
}

/**
 * Connect to OneKey via CDP and return the first page.
 * @returns {{ browser: import('playwright-core').Browser, page: import('playwright-core').Page }}
 */
export async function connectCDP() {
  await ensureOneKeyRunning();
  const browser = await chromium.connectOverCDP(CDP_URL);
  const page = browser.contexts()[0]?.pages()[0];
  if (!page) throw new Error('No page found via CDP');
  return { browser, page };
}

/**
 * Take a screenshot and save to the specified directory.
 * @param {import('playwright-core').Page} page
 * @param {string} dir - Screenshot directory (will be created if missing)
 * @param {string} name - Screenshot filename (without extension)
 */
export async function screenshot(page, dir, name) {
  mkdirSync(dir, { recursive: true });
  const path = `${dir}/${name}.png`;
  await page.screenshot({ path }).catch(() => {});
  return path;
}

/**
 * Click an element by data-testid.
 * @param {import('playwright-core').Page} page
 * @param {string} testid
 * @param {{ timeout?: number, delay?: number }} opts
 */
export async function clickTestId(page, testid, opts = {}) {
  const timeout = opts.timeout || 10000;
  const el = page.locator(`[data-testid="${testid}"]`).first();
  await el.waitFor({ state: 'visible', timeout });
  await el.click();
  await sleep(opts.delay || 500);
}

/**
 * Execute an action and wait for the page to reload.
 * @param {import('playwright-core').Page} page
 * @param {() => Promise<void>} action
 */
export async function waitForReload(page, action) {
  const reloadPromise = page.waitForEvent('load', { timeout: 30000 });
  await action();
  await reloadPromise;
  await sleep(3000);
}

// Re-export domain helpers
// Note: navigation.mjs delegates to components.mjs — use named exports to avoid
// conflicting star exports (dismissOverlays, closeAllModals exist in both).
export {
  dismissOverlays, closeAllModals,
  unlockWalletIfNeeded, handlePasswordPromptIfPresent,
  goToWalletHome,
} from './navigation.mjs';
export * from './accounts.mjs';
export * from './network.mjs';
export * from './transfer.mjs';
export * from './preconditions.mjs';

// ── UIRegistry + Components + Pages ──────────────────────────
// Registry uses lazy init — no top-level await needed
export { registry } from './ui-registry.mjs';
// Re-export components.mjs but skip names already exported from navigation.mjs
export {
  createStepTracker, safeStep,
  isModalVisible, waitForModal, closeModal,
  // closeAllModals — already from navigation.mjs
  // dismissOverlays — already from navigation.mjs
  dismissBackdrop,
  openSearchModal, getSearchInput, typeSearch, clearSearch, closeSearch,
  clickSidebarTab,
  unlockIfNeeded, handlePasswordPrompt, enterPassword,
  openNetworkSelector, selectNetwork,
} from './components.mjs';
export { MarketPage, PerpsPage, WalletPage } from './pages/index.mjs';
