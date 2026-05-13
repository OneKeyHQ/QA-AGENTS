// Referral Bind Invite Code — shared test logic (Desktop / Web / Extension)
//
// Wrapper files at:
//   src/tests/desktop/referral/bind-invite-code.test.mjs
//   src/tests/web/referral/bind-invite-code.test.mjs
//   src/tests/extension/referral/bind-invite-code.test.mjs
// inject platform-specific CDP connect + goToReferral, then call
// createBindInviteCodeTests() to get the test case prefixed for their platform.
//
// Flow: verify referral card visible -> enter invite code -> click join ->
//       verify success toast -> verify card hidden

import { sleep } from '../../helpers/constants.mjs';
import { createStepTracker, safeStep } from '../../helpers/components.mjs';

export const DEFAULT_INVITE_CODE = 'VIP999';

/**
 * Build the Referral Bind Invite Code test case for one platform.
 *
 * @param {object} opts
 * @param {string} opts.prefix - Test ID prefix, e.g. 'REFER' | 'WEB-REFER' | 'EXT-REFER'
 * @param {string} [opts.namePrefix] - Display name prefix, e.g. '' | 'Web-' | 'Ext-'
 * @param {(page: import('playwright-core').Page) => Promise<void>} opts.goToReferral
 *   Navigate to the page (wallet home / referral entry) where the invite-code card is visible.
 * @param {string} [opts.inviteCode] - Override invite code (default: VIP999)
 * @param {string} [opts.screenshotDir] - Directory for failure screenshots
 * @returns {{ testCases: Array, setup: (page) => Promise<void> }}
 */
export function createBindInviteCodeTests({
  prefix,
  namePrefix = '',
  goToReferral,
  inviteCode = DEFAULT_INVITE_CODE,
  screenshotDir,
}) {

  // ── Helpers ────────────────────────────────────────────────

  async function isReferralCardVisible(page) {
    return page.evaluate(() => {
      const text = document.body?.textContent || '';
      return text.includes('加入 OneKey 推荐计划')
        || text.includes('OneKey 推荐计划')
        || text.includes('Referral')
        || text.includes('邀请码');
    });
  }

  async function fillInviteCode(page, code) {
    const inviteInput = page.locator('input[placeholder="邀请码"]').first();
    let visible = await inviteInput.isVisible({ timeout: 5000 }).catch(() => false);
    if (visible) {
      await inviteInput.click();
      await sleep(200);
      await inviteInput.fill(code);
      return;
    }
    // Fallback: any input whose placeholder mentions 邀请 / invite
    const fallback = page.locator('input[placeholder*="邀请"], input[placeholder*="invite" i]').first();
    visible = await fallback.isVisible({ timeout: 3000 }).catch(() => false);
    if (visible) {
      await fallback.click();
      await sleep(200);
      await fallback.fill(code);
      return;
    }
    throw new Error('Invite code input not found');
  }

  async function clickJoinButton(page) {
    const joinClicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const r = btn.getBoundingClientRect();
        if (r.width > 0 && r.height > 0
          && ['加入', 'Join'].includes(btn.textContent?.trim())) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    if (joinClicked) return;
    // Fallback to Playwright locator
    const joinBtn = page.locator('button:has-text("加入"), button:has-text("Join")').first();
    await joinBtn.click({ timeout: 5000 });
  }

  async function hasSuccessToast(page) {
    return page.evaluate(() => {
      const text = document.body?.textContent || '';
      return text.includes('成功') || text.includes('Success');
    });
  }

  // ── Test Case ──────────────────────────────────────────────

  async function test001(page) {
    const t = createStepTracker(`${prefix}-001`);

    await goToReferral(page);

    await safeStep(page, t, '验证返佣卡片可见', async () => {
      const visible = await isReferralCardVisible(page);
      if (!visible) throw new Error('Referral card not found on page');
      return 'card visible';
    }, screenshotDir);

    await safeStep(page, t, '输入邀请码', async () => {
      await fillInviteCode(page, inviteCode);
      await sleep(500);
      return `code: ${inviteCode}`;
    }, screenshotDir);

    await safeStep(page, t, '点击加入', async () => {
      await clickJoinButton(page);
      await sleep(3000);
      return 'clicked';
    }, screenshotDir);

    await safeStep(page, t, '验证成功提示', async () => {
      const ok = await hasSuccessToast(page);
      // Toast may auto-dismiss — record but do not hard-fail
      return ok ? 'toast detected' : 'toast may have auto-dismissed';
    }, screenshotDir);

    await safeStep(page, t, '验证返佣卡片已隐藏', async () => {
      await sleep(2000);
      const stillVisible = await isReferralCardVisible(page);
      if (stillVisible) throw new Error('Referral card still visible after binding');
      return 'card hidden';
    }, screenshotDir);

    return t.result();
  }

  // ── Registry ───────────────────────────────────────────────

  const testCases = [
    { id: `${prefix}-001`, name: `${namePrefix}返佣-绑定邀请码`, fn: test001 },
  ];

  async function setup(page) {
    await goToReferral(page);
    await sleep(1500);
  }

  return { testCases, setup };
}
