// Navigation helpers — now delegates to components.mjs
// Export names preserved for backward compatibility
import {
  dismissOverlays as _dismissOverlays,
  closeAllModals as _closeAllModals,
  unlockIfNeeded,
  handlePasswordPrompt,
  clickSidebarTab,
} from './components.mjs';
import { sleep } from './constants.mjs';

export async function dismissOverlays(page) {
  return _dismissOverlays(page);
}

export async function closeAllModals(page) {
  return _closeAllModals(page);
}

export async function unlockWalletIfNeeded(page) {
  return unlockIfNeeded(page);
}

export async function handlePasswordPromptIfPresent(page) {
  return handlePasswordPrompt(page);
}

export async function goToWalletHome(page) {
  await _closeAllModals(page);
  await clickSidebarTab(page, 'Home');
  await sleep(2000);
  const hasWalletSelector = await page.locator('[data-testid="AccountSelectorTriggerBase"]').isVisible({ timeout: 3000 }).catch(() => false);
  if (!hasWalletSelector) {
    await page.keyboard.press('Escape');
    await sleep(500);
    await clickSidebarTab(page, 'Home');
    await sleep(2000);
  }
}
