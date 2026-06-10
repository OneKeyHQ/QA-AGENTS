// Network helpers — network switching
// Extracted from src/runner/index.mjs

import { sleep } from './constants.mjs';
import {
  clickChainSelectorResult,
  fillChainSelectorSearch,
  isChainSelectorSearchVisible,
  normalizeText,
} from './chain-selector.mjs';

const NETWORK_TRIGGER_SEL = '[data-testid="account-network-trigger-button"]';
const NETWORK_TEXT_SEL = '[data-testid="account-network-trigger-button-text"]';

async function getCurrentNetworkText(page) {
  return normalizeText(await page.locator(NETWORK_TEXT_SEL).first().textContent({ timeout: 5000 }).catch(() => ''));
}

async function isChainSelectorOpen(page) {
  return isChainSelectorSearchVisible(page);
}

async function openChainSelector(page) {
  if (await isChainSelectorOpen(page)) return;

  const trigger = page.locator(`${NETWORK_TRIGGER_SEL}:visible`).first();
  const clickErrors = [];

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await trigger.click({ timeout: 3000 });
    } catch (error) {
      clickErrors.push(error.message);
      // The desktop app can leave a full-screen ovelay-popover that intercepts
      // Playwright mouse clicks. Dispatching click on the trigger still invokes
      // the React onPress handler and opens the selector.
      const dispatched = await page.evaluate((selector) => {
        const visible = (el) => {
          const r = el?.getBoundingClientRect?.();
          return !!r && r.width > 0 && r.height > 0;
        };
        const target = Array.from(document.querySelectorAll(selector)).find(visible);
        target?.click();
        return Boolean(target);
      }, NETWORK_TRIGGER_SEL);
      if (!dispatched) clickErrors.push('network trigger not found for JS click fallback');
    }

    await sleep(900);
    if (await isChainSelectorOpen(page)) return;
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(300);
  }

  throw new Error(`Network selector did not open. Click errors: ${clickErrors.slice(-2).join(' | ')}`);
}

async function clickNetworkResult(page, networkName) {
  return clickChainSelectorResult(page, networkName, { timeout: 3000 })
    .catch((error) => ({ clicked: false, visibleText: error.message }));
}

/**
 * Switch to a named network.
 * Clicks network button -> searches -> selects -> verifies.
 */
export async function switchNetwork(page, networkName) {
  const currentNetwork = await getCurrentNetworkText(page);
  if (currentNetwork.includes(networkName)) {
    console.log(`  Already on ${networkName}`);
    return;
  }

  await openChainSelector(page);
  const searchResult = await fillChainSelectorSearch(page, networkName);
  await sleep(1500);

  const result = await clickNetworkResult(page, networkName);
  if (!result.clicked) {
    await page.keyboard.press('Escape');
    await sleep(500);
    throw new Error(`Network "${networkName}" not found in selector after search via ${searchResult.selector}. Visible text: ${result.visibleText}`);
  }
  console.log(`    Selected network: ${result.text || networkName}`);
  await sleep(3000);

  const verifyText = await getCurrentNetworkText(page);
  if (!verifyText.includes(networkName)) {
    throw new Error(`Network switch failed: expected ${networkName}, got ${verifyText}`);
  }
}
