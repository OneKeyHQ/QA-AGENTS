// Network helpers — network switching
// Extracted from src/runner/index.mjs

import { sleep } from './index.mjs';

/**
 * Switch to a named network.
 * Clicks network button -> searches -> selects -> verifies.
 */
export async function switchNetwork(page, networkName) {
  const networkTextSel = '[data-testid="account-network-trigger-button-text"]';
  const currentNetwork = await page.locator(networkTextSel).first().textContent({ timeout: 5000 }).catch(() => '');
  if (currentNetwork?.includes(networkName)) {
    console.log(`  Already on ${networkName}`);
    return;
  }

  const networkBtn = page.locator('[data-testid="account-network-trigger-button"]').first();
  await networkBtn.click({ timeout: 5000 });
  await sleep(1500);

  const chainSearchSel = '[data-testid="nav-header-search-chain-selector-search-bar"]';
  const searchInput = page.locator(chainSearchSel).first();
  await searchInput.waitFor({ state: 'visible', timeout: 5000 });
  await searchInput.click();
  await searchInput.evaluate((el) => el.select());
  await searchInput.press('Backspace');
  await searchInput.pressSequentially(networkName, { delay: 50 });
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

  let verifyText = '';
  for (let i = 0; i < 20; i++) {
    verifyText = await page.locator(networkTextSel).first().textContent({ timeout: 1000 }).catch(() => '');
    if (verifyText?.includes(networkName)) return;
    await sleep(300);
  }
  throw new Error(`Network switch failed: expected ${networkName}, got ${verifyText}`);
}
