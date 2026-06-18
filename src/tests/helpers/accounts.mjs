// Account helpers — role-based account switching from runtime config

import { sleep } from './constants.mjs';
import { loadAccounts } from './runtime-config.mjs';

/**
 * Account role aliases used by legacy test code.
 * Actual wallet/account names are loaded from shared/runtime-config.json.
 */
export const ACCOUNTS = {
  piggy: {
    role: 'primary',
  },
  vault: {
    role: 'secondary',
  },
};

const LEGACY_ACCOUNT_FALLBACKS = {
  primary: {
    walletName: process.env.ONEKEY_PRIMARY_WALLET || process.env.NIGHTLY_SOFTWARE_WALLET || 'ran',
    accountName: process.env.ONEKEY_PRIMARY_ACCOUNT || process.env.NIGHTLY_SOFTWARE_ACCOUNT || 'piggy🐷',
    labels: [
      process.env.ONEKEY_PRIMARY_ACCOUNT || process.env.NIGHTLY_SOFTWARE_ACCOUNT || 'piggy🐷',
      'piggy',
      'Account #1',
    ],
  },
  secondary: {
    walletName: process.env.ONEKEY_SECONDARY_WALLET || process.env.NIGHTLY_SOFTWARE_WALLET || 'ran',
    accountName: process.env.ONEKEY_SECONDARY_ACCOUNT || 'vault😂',
    labels: [
      process.env.ONEKEY_SECONDARY_ACCOUNT || 'vault😂',
      'vault',
      'Account #2',
    ],
  },
};

export function getConfiguredAccount(accountName) {
  const roleMeta = ACCOUNTS[accountName];
  if (!roleMeta) throw new Error(`Unknown account role: ${accountName}`);
  const accounts = loadAccounts();
  const configured = accounts[roleMeta.role];
  const fallback = LEGACY_ACCOUNT_FALLBACKS[roleMeta.role];
  const walletName = configured.walletName || fallback.walletName;
  const label = configured.accountName || fallback.accountName;
  const usesRuntimeConfig = Boolean(configured.walletName && configured.accountName);
  return {
    role: roleMeta.role,
    walletName,
    accountName: label,
    label,
    labels: usesRuntimeConfig
      ? [label]
      : Array.from(new Set([label, ...(fallback.labels || [])].filter(Boolean))),
    fullLabel: `${walletName} / ${label}`,
    source: usesRuntimeConfig ? 'runtime-config' : 'legacy-fallback',
  };
}

async function clickVisibleAccountSelector(page) {
  const clicked = await page.evaluate(() => {
    const selectors = Array.from(document.querySelectorAll('[data-testid="AccountSelectorTriggerBase"]'));
    for (const el of selectors) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight) {
        el.click();
        return el.textContent || '';
      }
    }
    return null;
  });
  if (clicked === null) throw new Error('Account selector is not visible');
  await sleep(1200);
  return clicked;
}

async function selectWalletInAccountSelector(page, walletName) {
  if (!walletName) return;
  const target = await page.evaluate((targetWalletName) => {
    const visible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0 &&
        r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
    };
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const modal = Array.from(document.querySelectorAll('[data-testid="APP-Modal-Screen"]')).filter(visible).at(-1);
    const container = modal || document.body;
    for (const row of container.querySelectorAll('[data-testid^="wallet-"]')) {
      if (!visible(row) || normalize(row.textContent) !== targetWalletName) continue;
      const r = row.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), text: normalize(row.textContent), method: 'wallet-row' };
    }
    for (const el of container.querySelectorAll('span, div')) {
      if (normalize(el.textContent) !== targetWalletName || !visible(el)) continue;
      const row = el.closest('[role="button"]') || el.parentElement || el;
      const r = row.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), text: normalize(el.textContent), method: 'text' };
    }
    return null;
  }, walletName);
  if (!target) throw new Error(`Wallet ${walletName} not found in account selector`);
  await page.mouse.click(target.x, target.y);
  await sleep(1200);
}

async function clickAccountInSelectedWallet(page, account) {
  const target = await page.evaluate(({ labels }) => {
    const visible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0 &&
        r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
    };
    const modal = Array.from(document.querySelectorAll('[data-testid="APP-Modal-Screen"]')).filter(visible).at(-1);
    const container = modal || document.body;
    for (const label of labels) {
      for (const row of container.querySelectorAll('[data-testid^="account-item-index-"]')) {
        if (!visible(row) || !(row.textContent || '').includes(label)) continue;
        const r = row.getBoundingClientRect();
        return {
          method: 'account-row',
          label,
          x: Math.round(r.x + r.width / 2),
          y: Math.round(r.y + r.height / 2),
        };
      }
      for (const el of container.querySelectorAll('span, div')) {
        if (el.textContent?.trim() !== label || !visible(el)) continue;
        let node = el;
        let target = el;
        for (let i = 0; i < 6 && node && node !== container; i += 1) {
          const r = node.getBoundingClientRect();
          const text = node.textContent || '';
          if (text.includes(label) && r.width >= 240 && r.height >= 40 && r.height <= 90) {
            target = node;
          }
          node = node.parentElement;
        }
        const r = target.getBoundingClientRect();
        return {
          method: 'label',
          label,
          x: Math.round(r.x + r.width / 2),
          y: Math.round(r.y + r.height / 2),
        };
      }
    }
    return null;
  }, { labels: account.labels || [account.label] });
  if (!target) throw new Error(`Account ${account.label} not found in selected wallet`);
  await page.mouse.click(target.x, target.y);
  await sleep(2000);
  return target;
}

async function getVisibleCurrentAccountText(page) {
  return page.evaluate(() => {
    for (const el of document.querySelectorAll('[data-testid="AccountSelectorTriggerBase"]')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight) return el.textContent || '';
    }
    return '';
  });
}

/**
 * Switch to a named account (piggy or vault).
 * Clicks wallet selector -> selects configured wallet -> selects account -> verifies.
 */
export async function switchAccount(page, accountName) {
  const account = getConfiguredAccount(accountName);
  const labels = account.labels || [account.label];

  let clicked;
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await clickVisibleAccountSelector(page);
      await selectWalletInAccountSelector(page, account.walletName);
      clicked = await clickAccountInSelectedWallet(page, account);
      break;
    } catch (error) {
      lastError = error;
      await page.keyboard.press('Escape').catch(() => {});
      await sleep(800);
    }
  }
  if (!clicked) throw lastError || new Error(`Failed to click account ${accountName}`);
  console.log(`    Clicked ${clicked.label} for ${accountName}/${account.role} in wallet ${account.walletName}`);

  // Verify
  const newAccount = await getVisibleCurrentAccountText(page);
  if (!labels.some((label) => newAccount?.includes(label))) {
    throw new Error(`Failed to switch to account ${accountName}, got: ${newAccount}`);
  }
}

/**
 * Ensure flows that require address derivation/signing start from the configured
 * primary HD/software wallet account, not a watch-only account.
 */
export async function ensurePrimarySoftwareWallet(page) {
  const account = getConfiguredAccount('piggy');
  await switchAccount(page, 'piggy');
  return account.fullLabel;
}
