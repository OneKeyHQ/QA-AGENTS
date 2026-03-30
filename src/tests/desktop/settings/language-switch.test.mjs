// Language Switch Test — Verifies language change across multiple app pages
// Flow: (any language) → 简体中文 → 日本語 → English → Português(Brasil) → 简体中文
// Navigation is language-agnostic (position/testid based); only assertions check localized text

import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep, clickTestId, WALLET_PASSWORD, RESULTS_DIR } from '../../helpers/index.mjs';
import { createStepTracker, safeStep } from '../../helpers/components.mjs';
import { openPreferences, clickPrefsRow } from './nav-helpers.mjs';
import { assertListRendered } from '../../helpers/components.mjs';

export const testCases = [
  { id: 'LANG-SWITCH-001', name: '设置-语言切换', fn: testLanguageSwitch },
];

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'language-switch');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Language selection ───────────────────────────────────────

/**
 * Open language dropdown, assert it renders correctly, then select.
 * @param {boolean} assertRender - whether to run dropdown render assertions
 */
async function selectLanguageAndConfirm(page, langCode, assertRender = false) {
  // Click language row (1st select-item- in preferences, index=0)
  await clickPrefsRow(page, 0);
  await sleep(500);

  // Assert dropdown rendering if requested
  if (assertRender) {
    // Expect ≥10 language options (currently ~20)
    const dr = await assertListRendered(page, {
      testidPrefix: 'select-item-',
      excludeTestids: ['select-item-'],
      minCount: 10,
    });
    if (dr.errors.length > 0) throw new Error(`Dropdown render: ${dr.errors.join('; ')}`);
  }

  // Click the language option (testid is language-agnostic)
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

// ── Language assertions ──────────────────────────────────────

const LANGUAGES = {
  'zh-CN': { name: '简体中文', sidebarTexts: ['市场', '交易'] },
  'ja-JP': { name: '日本語', sidebarTexts: ['マーケット', 'スワップ'] },
  'en':    { name: 'English', sidebarTexts: ['Market', 'Swap'] },
  'pt-BR': { name: 'Português(Brasil)', sidebarTexts: ['Mercado', 'Swap'] },
};

async function assertLanguage(page, langCode) {
  const lang = LANGUAGES[langCode];
  const errors = [];
  for (const text of lang.sidebarTexts) {
    const count = await page.locator(
      `[data-testid="Desktop-AppSideBar-Content-Container"] >> text="${text}"`
    ).count();
    if (count === 0) errors.push(`Sidebar "${text}" not found`);
  }
  return errors;
}

// ── Main Test ────────────────────────────────────────────────

async function testLanguageSwitch(page) {
  const t = createStepTracker('LANG-SWITCH-001');

  const steps = [
    { code: 'zh-CN', label: '切换到简体中文 (初始)' },
    { code: 'ja-JP', label: '简体中文 → 日本語' },
    { code: 'en',    label: '日本語 → English' },
    { code: 'pt-BR', label: 'English → Português(Brasil)' },
    { code: 'zh-CN', label: 'Português → 简体中文 (恢复)' },
  ];

  for (const { code, label } of steps) {
    await safeStep(page, t, label, async () => {
      await openPreferences(page);
      // Every step: assert dropdown renders correctly (options visible, no overlap)
      await selectLanguageAndConfirm(page, code, true);
      const errors = await assertLanguage(page, code);
      if (errors.length > 0) throw new Error(errors.join('; '));
      return `${LANGUAGES[code].name} verified, dropdown OK`;
    }, SCREENSHOT_DIR);
  }

  return t.result();
}
