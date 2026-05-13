// Settings Language Switch — shared test logic (Desktop / Web / Extension)
//
// Wrapper files at:
//   src/tests/desktop/settings/language-switch.test.mjs
//   src/tests/web/settings/language-switch.test.mjs
//   src/tests/extension/settings/language-switch.test.mjs
// inject platform-specific CDP connect + openSettings (preferences/language entry),
// then call createLanguageSwitchTests() to get the same case prefixed for the platform.
//
// Flow: → 简体中文 → 日本語 → English → Português(Brasil) → 简体中文 (restore)
// Navigation is language-agnostic (position/testid based); only assertions check localized text.

import { sleep } from '../../helpers/constants.mjs';
import { clickTestId, WALLET_PASSWORD } from '../../helpers/index.mjs';
import { createStepTracker, safeStep, assertListRendered } from '../../helpers/components.mjs';

const LANGUAGES = {
  'zh-CN': { name: '简体中文', sidebarTexts: ['市场', '交易'] },
  'ja-JP': { name: '日本語', sidebarTexts: ['マーケット', 'スワップ'] },
  'en':    { name: 'English', sidebarTexts: ['Market', 'Swap'] },
  'pt-BR': { name: 'Português(Brasil)', sidebarTexts: ['Mercado', 'Swap'] },
};

/**
 * Build the Language Switch test case for one platform.
 *
 * @param {object} opts
 * @param {string} opts.prefix - Test ID prefix, e.g. 'LANG-SWITCH' | 'WEB-LANG-SWITCH' | 'EXT-LANG-SWITCH'
 * @param {string} [opts.namePrefix] - Display name prefix.
 * @param {(page) => Promise<void>} opts.openSettings - Open Preferences screen.
 * @param {(page) => Promise<void>} [opts.openLanguageRow]
 *   Click the Language row in Preferences. Defaults to clicking the 1st select-item-
 *   row (index=0), which works for Desktop preferences.
 * @param {string} [opts.sidebarScope] - CSS selector for the sidebar used in language
 *   assertions. Defaults to OneKey Desktop sidebar testid.
 * @param {string} [opts.screenshotDir]
 * @returns {{ testCases: Array, setup: (page) => Promise<void> }}
 */
export function createLanguageSwitchTests({
  prefix,
  namePrefix = '',
  openSettings,
  openLanguageRow,
  sidebarScope = '[data-testid="Desktop-AppSideBar-Content-Container"]',
  screenshotDir,
}) {
  const SCREENSHOT_DIR = screenshotDir;

  async function defaultOpenLanguageRow(page) {
    const clicked = await page.evaluate(() => {
      const modals = document.querySelectorAll('[data-testid="APP-Modal-Screen"]');
      for (const m of modals) {
        const r = m.getBoundingClientRect();
        if (r.width <= 0) continue;
        const items = m.querySelectorAll('[data-testid="select-item-"]');
        if (items.length > 0) { items[0].click(); return true; }
      }
      return false;
    });
    if (!clicked) throw new Error('Language row (index=0) not found in preferences modal');
    await sleep(500);
  }

  const _openLanguageRow = openLanguageRow || defaultOpenLanguageRow;

  async function selectLanguageAndConfirm(page, langCode, assertRender = false) {
    await _openLanguageRow(page);

    if (assertRender) {
      const dr = await assertListRendered(page, {
        testidPrefix: 'select-item-',
        excludeTestids: ['select-item-'],
        minCount: 10,
      });
      if (dr.errors.length > 0) throw new Error(`Dropdown render: ${dr.errors.join('; ')}`);
    }

    await clickTestId(page, `select-item-${langCode}`, { delay: 500 });

    // Wait for password verification dialog (language change requires it)
    const pwInput = page.locator('[data-testid="password-input"]');
    try {
      await pwInput.waitFor({ state: 'visible', timeout: 10000 });
      await pwInput.fill(WALLET_PASSWORD);
      await sleep(300);
      await clickTestId(page, 'verifying-password', { delay: 300 });
      await sleep(5000); // wait for reload
    } catch {
      // Some switches may not require password (e.g. same language)
      await sleep(2000);
    }
  }

  async function assertLanguage(page, langCode) {
    const lang = LANGUAGES[langCode];
    const errors = [];
    for (const text of lang.sidebarTexts) {
      const count = await page.locator(`${sidebarScope} >> text="${text}"`).count();
      if (count === 0) errors.push(`Sidebar "${text}" not found`);
    }
    return errors;
  }

  async function testLanguageSwitch(page) {
    const t = createStepTracker(`${prefix}-001`);

    const steps = [
      { code: 'zh-CN', label: '切换到简体中文 (初始)' },
      { code: 'ja-JP', label: '简体中文 → 日本語' },
      { code: 'en',    label: '日本語 → English' },
      { code: 'pt-BR', label: 'English → Português(Brasil)' },
      { code: 'zh-CN', label: 'Português → 简体中文 (恢复)' },
    ];

    for (const { code, label } of steps) {
      await safeStep(page, t, label, async () => {
        await openSettings(page);
        await selectLanguageAndConfirm(page, code, true);
        const errors = await assertLanguage(page, code);
        if (errors.length > 0) throw new Error(errors.join('; '));
        return `${LANGUAGES[code].name} verified, dropdown OK`;
      }, SCREENSHOT_DIR);
    }

    return t.result();
  }

  const testCases = [
    { id: `${prefix}-001`, name: `${namePrefix}设置-语言切换`, fn: testLanguageSwitch },
  ];

  async function setup(page) {
    await sleep(0);
  }

  return { testCases, setup };
}
