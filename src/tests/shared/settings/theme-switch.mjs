// Settings Theme Switch — shared test logic (Desktop / Web / Extension)
//
// Wrapper files at:
//   src/tests/desktop/settings/theme-switch.test.mjs
//   src/tests/web/settings/theme-switch.test.mjs
//   src/tests/extension/settings/theme-switch.test.mjs
// inject platform-specific CDP connect + openSettings (preferences/theme entry),
// then call createThemeSwitchTests() to get the same case prefixed for the platform.
//
// Flow: current → dark → system → light → system (restore)
// Language-agnostic: uses position/testid/body-class, never text matching.

import { sleep } from '../../helpers/constants.mjs';
import { clickTestId } from '../../helpers/index.mjs';
import { createStepTracker, safeStep, assertListRendered } from '../../helpers/components.mjs';

/**
 * Build the Theme Switch test case for one platform.
 *
 * @param {object} opts
 * @param {string} opts.prefix - Test ID prefix, e.g. 'SETTINGS' | 'WEB-SETTINGS' | 'EXT-SETTINGS'
 * @param {string} [opts.namePrefix] - Display name prefix, e.g. '' | 'Web-' | 'Ext-'
 * @param {(page: import('playwright-core').Page) => Promise<void>} opts.openSettings
 *   Open the Preferences screen (where the Theme row lives).
 * @param {(page: import('playwright-core').Page) => Promise<void>} [opts.openThemeRow]
 *   Click the Theme row in Preferences. Defaults to clicking the 3rd select-item-
 *   row (index=2), which works for Desktop preferences. Web / Extension wrappers
 *   may override.
 * @param {string} [opts.screenshotDir] - Directory for failure screenshots.
 * @returns {{ testCases: Array, setup: (page) => Promise<void> }}
 */
export function createThemeSwitchTests({
  prefix,
  namePrefix = '',
  openSettings,
  openThemeRow,
  screenshotDir,
}) {
  const SCREENSHOT_DIR = screenshotDir;

  /** Default: click the 3rd select-item- row inside the visible APP-Modal-Screen. */
  async function defaultOpenThemeRow(page) {
    const clicked = await page.evaluate(() => {
      const modals = document.querySelectorAll('[data-testid="APP-Modal-Screen"]');
      for (const m of modals) {
        const r = m.getBoundingClientRect();
        if (r.width <= 0) continue;
        const items = m.querySelectorAll('[data-testid="select-item-"]');
        if (items.length > 2) { items[2].click(); return true; }
      }
      return false;
    });
    if (!clicked) throw new Error('Theme row (index=2) not found in preferences modal');
    await sleep(800);
  }

  const _openThemeRow = openThemeRow || defaultOpenThemeRow;

  async function selectTheme(page, themeKey) {
    await _openThemeRow(page);
    await sleep(1000);
    await clickTestId(page, `select-item-${themeKey}`, { delay: 1500 });
  }

  function assertThemeClass(page, themeKey) {
    return page.evaluate((key) => {
      const cls = document.body.className || '';
      if (key === 'dark') return { ok: cls.includes('t_dark'), cls };
      if (key === 'light') return { ok: cls.includes('t_light'), cls };
      // system: any valid theme class is fine
      return { ok: cls.includes('t_dark') || cls.includes('t_light'), cls };
    }, themeKey);
  }

  async function testThemeSwitch(page) {
    const t = createStepTracker(`${prefix}-001`);

    await safeStep(page, t, '打开偏好设置', async () => {
      await openSettings(page);
      return 'preferences opened';
    }, SCREENSHOT_DIR);

    // Verify theme dropdown renders correctly (first switch only)
    await safeStep(page, t, '主题下拉列表渲染验证', async () => {
      await _openThemeRow(page);
      await sleep(1000);
      // Expect 3 theme options: system, light, dark
      const dr = await assertListRendered(page, {
        testidPrefix: 'select-item-',
        excludeTestids: ['select-item-'],
        minCount: 3,
      });
      // Close dropdown without selecting (press Escape)
      await page.keyboard.press('Escape');
      await sleep(500);
      if (dr.errors.length > 0) throw new Error(dr.errors.join('; '));
      return `${dr.count} options, no overlap`;
    }, SCREENSHOT_DIR);

    const sequence = [
      { key: 'dark', label: '切换到深色' },
      { key: 'system', label: '切换到自动' },
      { key: 'light', label: '切换到浅色' },
      { key: 'system', label: '恢复为自动' },
    ];

    for (const { key, label } of sequence) {
      await safeStep(page, t, label, async () => {
        await selectTheme(page, key);
        const r = await assertThemeClass(page, key);
        if (!r.ok) throw new Error(`body class "${r.cls}" does not match theme "${key}"`);
        return `theme=${key}, class=${r.cls}`;
      }, SCREENSHOT_DIR);
    }

    await safeStep(page, t, '关闭偏好设置', async () => {
      const closeBtn = page.locator('[data-testid="nav-header-close"]');
      const vis = await closeBtn.isVisible({ timeout: 2000 }).catch(() => false);
      if (vis) await closeBtn.click();
      else await page.keyboard.press('Escape');
      await sleep(500);
      return 'closed';
    }, SCREENSHOT_DIR);

    return t.result();
  }

  const testCases = [
    { id: `${prefix}-001`, name: `${namePrefix}设置-主题切换`, fn: testThemeSwitch },
  ];

  async function setup(page) {
    // Theme test opens preferences inside the case; setup is a no-op placeholder.
    await sleep(0);
  }

  return { testCases, setup };
}
