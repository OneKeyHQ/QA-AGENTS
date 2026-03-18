// Account helpers — account configuration and switching
// Extracted from src/runner/index.mjs

import { sleep } from './index.mjs';

/**
 * Account definitions — matches test_cases.json accounts config.
 */
export const ACCOUNTS = {
  piggy: { label: 'piggy\ud83d\udc37', fullLabel: 'ran / piggy\ud83d\udc37', index: 0 },
  vault: { label: 'vault\ud83d\ude02', fullLabel: 'Pro - \u7136 / vault\ud83d\ude02', index: 1 },
};

/**
 * Switch to a named account (piggy or vault).
 * Clicks wallet selector -> selects account by index testid -> verifies.
 */
export async function switchAccount(page, accountName) {
  const account = ACCOUNTS[accountName];
  if (!account) throw new Error(`Unknown account: ${accountName}`);

  const walletSelector = page.locator('[data-testid="AccountSelectorTriggerBase"]').first();
  const currentAccount = await walletSelector.textContent();
  if (currentAccount?.toLowerCase().includes(accountName.toLowerCase())) {
    console.log(`  Already on account ${accountName}`);
    return;
  }

  await walletSelector.click();
  await sleep(2000);

  const accountItemSel = `[data-testid="account-item-index-${account.index}"]`;
  const accountItem = page.locator(accountItemSel);
  const visible = await accountItem.isVisible({ timeout: 3000 }).catch(() => false);
  if (visible) {
    await accountItem.click();
    console.log(`    Clicked account-item-index-${account.index} for ${accountName}`);
  } else {
    const accountEntry = page.locator(`text=/${accountName}/i`).first();
    await accountEntry.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await accountEntry.click({ timeout: 5000 });
  }
  await sleep(2000);

  // Verify
  const newWalletSelector = page.locator('[data-testid="AccountSelectorTriggerBase"]').first();
  const newAccount = await newWalletSelector.textContent();
  if (!newAccount?.toLowerCase().includes(accountName.toLowerCase())) {
    throw new Error(`Failed to switch to account ${accountName}, got: ${newAccount}`);
  }
}
