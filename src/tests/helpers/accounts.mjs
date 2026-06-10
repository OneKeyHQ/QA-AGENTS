// Account helpers — role-based account switching from runtime config

import { sleep } from './constants.mjs';
import { requireAccounts } from './runtime-config.mjs';

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

export function getConfiguredAccount(accountName) {
  const roleMeta = ACCOUNTS[accountName];
  if (!roleMeta) throw new Error(`Unknown account role: ${accountName}`);
  const accounts = requireAccounts();
  const configured = accounts[roleMeta.role];
  return {
    role: roleMeta.role,
    walletName: configured.walletName,
    accountName: configured.accountName,
    label: configured.accountName,
    labels: [configured.accountName],
    fullLabel: `${configured.walletName} / ${configured.accountName}`,
  };
}

async function clickVisibleAccountSelector(page) {
  const clicked = await page.evaluate(() => {
    const selectors = Array.from(document.querySelectorAll('[data-testid="AccountSelectorTriggerBase"]'));
    for (const el of selectors) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
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
  const selected = await page.evaluate((targetWalletName) => {
    const visible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0;
    };
    const modal = Array.from(document.querySelectorAll('[data-testid="APP-Modal-Screen"]')).filter(visible).at(-1);
    const container = modal || document.body;
    for (const el of container.querySelectorAll('span, div')) {
      if (el.textContent?.trim() !== targetWalletName || !visible(el)) continue;
      const row = el.closest('[role="button"]') || el.parentElement;
      (row || el).click();
      return true;
    }
    return false;
  }, walletName);
  if (!selected) throw new Error(`Wallet ${walletName} not found in account selector`);
  await sleep(1200);
}

async function clickAccountInSelectedWallet(page, account) {
  const clicked = await page.evaluate(({ labels }) => {
    const visible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0;
    };
    const modal = Array.from(document.querySelectorAll('[data-testid="APP-Modal-Screen"]')).filter(visible).at(-1);
    const container = modal || document.body;
    for (const label of labels) {
      for (const el of container.querySelectorAll('span, div')) {
        if (el.textContent?.trim() !== label || !visible(el)) continue;
        const row = el.closest('[role="button"]') || el.parentElement?.parentElement || el.parentElement;
        (row || el).click();
        return { method: 'label', label };
      }
    }
    return null;
  }, { labels: account.labels || [account.label] });
  if (!clicked) throw new Error(`Account ${account.label} not found in selected wallet`);
  await sleep(2000);
  return clicked;
}

async function getVisibleCurrentAccountText(page) {
  return page.evaluate(() => {
    for (const el of document.querySelectorAll('[data-testid="AccountSelectorTriggerBase"]')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el.textContent || '';
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

  await clickVisibleAccountSelector(page);
  await selectWalletInAccountSelector(page, account.walletName);
  const clicked = await clickAccountInSelectedWallet(page, account);
  console.log(`    Clicked ${clicked.label} for ${accountName}/${account.role} in wallet ${account.walletName}`);

  // Verify
  const newAccount = await getVisibleCurrentAccountText(page);
  if (!labels.some((label) => newAccount?.includes(label))) {
    throw new Error(`Failed to switch to account ${accountName}, got: ${newAccount}`);
  }
}
