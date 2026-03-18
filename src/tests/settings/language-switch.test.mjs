// Language Switch Test — Verifies language change across multiple app pages
// Generated from recording: 2026-02-28
// Flow: (any language) → 简体中文 → 日本語 → English → Português(Brasil) → 简体中文
// Step 1 uses testid-only navigation (language-agnostic)

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, clickTestId,
  waitForReload, WALLET_PASSWORD, RESULTS_DIR,
} from '../helpers/index.mjs';

export const testCases = [
  { id: 'LANG-SWITCH-001', name: 'Language Switch Verification' },
];

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'language-switch');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Language Switch Flow ──────────────────────────────────

// Open Preferences using ONLY testid selectors (works regardless of current language)
async function openPreferencesByTestId(page) {
  const sidebar = page.locator('[data-testid="Desktop-AppSideBar-Content-Container"]');
  await sidebar.last().click();
  await sleep(800);

  const popover = page.locator('[data-testid="TMPopover-ScrollView"]');
  await popover.waitFor({ state: 'visible', timeout: 5000 });
  const settingsItem = popover.locator('svg').last();
  await settingsItem.click();
  await sleep(800);

  await clickTestId(page, 'tab-modal-no-active-item-SettingsSolid', { delay: 500 });
}

// Open Preferences using known text labels (after we've set a known language)
async function openPreferencesByText(page, settingsText) {
  const sidebar = page.locator('[data-testid="Desktop-AppSideBar-Content-Container"]');
  await sidebar.last().click();
  await sleep(800);

  const popover = page.locator('[data-testid="TMPopover-ScrollView"]');
  await popover.waitFor({ state: 'visible', timeout: 5000 });
  await popover.locator(`text="${settingsText}"`).click();
  await sleep(800);

  await clickTestId(page, 'tab-modal-no-active-item-SettingsSolid', { delay: 500 });
}

async function selectLanguageAndConfirm(page, langCode) {
  const langTrigger = page.locator('[data-testid="APP-Modal-Screen"]').first();
  await langTrigger.click();
  await sleep(500);

  await clickTestId(page, `select-item-${langCode}`, { delay: 500 });

  await waitForReload(page, async () => {
    const pwInput = page.locator('[data-testid="password-input"]');
    await pwInput.waitFor({ state: 'visible', timeout: 10000 });
    await pwInput.fill(WALLET_PASSWORD);
    await sleep(300);
    await clickTestId(page, 'verifying-password', { delay: 300 });
  });
}

// ── Assertions ───────────────────────────────────────────

const LANGUAGES = {
  'zh-CN': {
    name: '简体中文',
    settingsMenu: '设置',
    preferences: '偏好设置',
    sidebarTexts: ['市场', '交易'],
  },
  'ja-JP': {
    name: '日本語',
    settingsMenu: '設定',
    preferences: '環境設定',
    sidebarTexts: ['マーケット', 'スワップ'],
  },
  'en': {
    name: 'English',
    settingsMenu: 'Settings',
    preferences: 'Preferences',
    sidebarTexts: ['Market', 'Swap'],
  },
  'pt-BR': {
    name: 'Português(Brasil)',
    settingsMenu: 'Configurações',
    preferences: 'Preferências',
    sidebarTexts: ['Mercado', 'Swap'],
  },
};

async function assertLanguage(page, langCode, stepName) {
  const lang = LANGUAGES[langCode];
  const errors = [];

  console.log(`\n  ── Asserting: ${lang.name} (${langCode}) ──`);

  // 1. Check sidebar texts
  for (const text of lang.sidebarTexts) {
    const found = await page.locator(`[data-testid="Desktop-AppSideBar-Content-Container"] >> text="${text}"`).count();
    if (found > 0) {
      console.log(`    ✓ Sidebar: "${text}"`);
    } else {
      console.log(`    ✗ Sidebar: "${text}" NOT found`);
      errors.push(`Sidebar "${text}" not found`);
    }
  }

  // 2. Open settings and verify labels
  const sidebar = page.locator('[data-testid="Desktop-AppSideBar-Content-Container"]');
  await sidebar.last().click();
  await sleep(800);

  const popover = page.locator('[data-testid="TMPopover-ScrollView"]');
  await popover.waitFor({ state: 'visible', timeout: 5000 });

  const settingsFound = await popover.locator(`text="${lang.settingsMenu}"`).count();
  if (settingsFound > 0) {
    console.log(`    ✓ Settings menu: "${lang.settingsMenu}"`);
  } else {
    console.log(`    ✗ Settings menu: expected "${lang.settingsMenu}"`);
    errors.push(`Settings menu "${lang.settingsMenu}" not found`);
  }

  // Close popover
  await page.keyboard.press('Escape');
  await sleep(300);

  // 3. Open preferences and check tab + dropdown
  await openPreferencesByText(page, lang.settingsMenu);

  const prefsTab = page.locator('[data-testid="tab-modal-no-active-item-SettingsSolid"]');
  const prefsText = await prefsTab.textContent().catch(() => '');
  if (prefsText.includes(lang.preferences)) {
    console.log(`    ✓ Preferences tab: "${lang.preferences}"`);
  } else {
    console.log(`    ✗ Preferences tab: expected "${lang.preferences}", got "${prefsText}"`);
    errors.push(`Preferences tab: expected "${lang.preferences}", got "${prefsText}"`);
  }

  const langDropdown = page.locator('[data-testid="APP-Modal-Screen"]').first();
  const dropdownText = await langDropdown.textContent().catch(() => '');
  if (dropdownText.includes(lang.name)) {
    console.log(`    ✓ Language dropdown: "${lang.name}"`);
  } else {
    console.log(`    ✗ Language dropdown: expected "${lang.name}", got "${dropdownText}"`);
    errors.push(`Language dropdown: expected "${lang.name}", got "${dropdownText}"`);
  }

  // Close settings modal
  await page.keyboard.press('Escape');
  await sleep(300);
  await page.keyboard.press('Escape');
  await sleep(300);

  return errors;
}

// ── Main Test ────────────────────────────────────────────

export async function run() {
  const startTime = Date.now();
  const results = {
    testId: 'LANG-SWITCH-001',
    name: 'Language Switch Verification',
    status: 'passed',
    steps: [],
    errors: [],
    startTime: new Date().toISOString(),
  };

  function addStep(name, status, detail = '') {
    results.steps.push({ name, status, detail, time: new Date().toISOString() });
    const icon = status === 'passed' ? '✓' : '✗';
    console.log(`\n  ${icon} ${name}${detail ? ': ' + detail : ''}`);
  }

  try {
    const { page } = await connectCDP();

    console.log('\n══════════════════════════════════════════');
    console.log('  Language Switch Test');
    console.log('  Flow: ? → 简体中文 → 日本語 → English → Português → 简体中文');
    console.log('══════════════════════════════════════════');

    // ── Step 1: (Unknown language) → 简体中文 ──
    console.log('\n  Step 1: (any) → 简体中文');
    await openPreferencesByTestId(page);
    await selectLanguageAndConfirm(page, 'zh-CN');
    const zh1Errors = await assertLanguage(page, 'zh-CN', 'step1');
    if (zh1Errors.length === 0) {
      addStep('→ 简体中文 (initial)', 'passed');
    } else {
      addStep('→ 简体中文 (initial)', 'failed', zh1Errors.join('; '));
      results.errors.push(...zh1Errors);
    }

    // ── Step 2: 简体中文 → 日本語 ──
    console.log('\n  Step 2: 简体中文 → 日本語');
    await openPreferencesByText(page, '设置');
    await selectLanguageAndConfirm(page, 'ja-JP');
    const jaErrors = await assertLanguage(page, 'ja-JP', 'step2');
    if (jaErrors.length === 0) {
      addStep('简体中文 → 日本語', 'passed');
    } else {
      addStep('简体中文 → 日本語', 'failed', jaErrors.join('; '));
      results.errors.push(...jaErrors);
    }

    // ── Step 3: 日本語 → English ──
    console.log('\n  Step 3: 日本語 → English');
    await openPreferencesByText(page, '設定');
    await selectLanguageAndConfirm(page, 'en');
    const enErrors = await assertLanguage(page, 'en', 'step3');
    if (enErrors.length === 0) {
      addStep('日本語 → English', 'passed');
    } else {
      addStep('日本語 → English', 'failed', enErrors.join('; '));
      results.errors.push(...enErrors);
    }

    // ── Step 4: English → Português(Brasil) ──
    console.log('\n  Step 4: English → Português(Brasil)');
    await openPreferencesByText(page, 'Settings');
    await selectLanguageAndConfirm(page, 'pt-BR');
    const ptErrors = await assertLanguage(page, 'pt-BR', 'step4');
    if (ptErrors.length === 0) {
      addStep('English → Português(Brasil)', 'passed');
    } else {
      addStep('English → Português(Brasil)', 'failed', ptErrors.join('; '));
      results.errors.push(...ptErrors);
    }

    // ── Step 5: Português → 简体中文 (restore) ──
    console.log('\n  Step 5: Português(Brasil) → 简体中文 (restore)');
    await openPreferencesByText(page, 'Configurações');
    await selectLanguageAndConfirm(page, 'zh-CN');
    const zh2Errors = await assertLanguage(page, 'zh-CN', 'step5');
    if (zh2Errors.length === 0) {
      addStep('Português(Brasil) → 简体中文 (restore)', 'passed');
    } else {
      addStep('Português(Brasil) → 简体中文 (restore)', 'failed', zh2Errors.join('; '));
      results.errors.push(...zh2Errors);
    }

    // ── Summary ──
    results.status = results.errors.length === 0 ? 'passed' : 'failed';
    results.duration = Date.now() - startTime;
    results.endTime = new Date().toISOString();

    console.log('\n══════════════════════════════════════════');
    console.log(`  Result: ${results.status.toUpperCase()}`);
    console.log(`  Steps: ${results.steps.filter(s => s.status === 'passed').length}/${results.steps.length} passed`);
    console.log(`  Duration: ${(results.duration / 1000).toFixed(1)}s`);
    if (results.errors.length > 0) {
      console.log('  Errors:');
      results.errors.forEach(e => console.log(`    - ${e}`));
    }
    console.log('══════════════════════════════════════════\n');

  } catch (err) {
    results.status = 'error';
    results.errors.push(err.message);
    results.duration = Date.now() - startTime;
    results.endTime = new Date().toISOString();
    console.error(`\n  ✗ Test error: ${err.message}\n`);
  }

  writeFileSync(`${RESULTS_DIR}/LANG-SWITCH-001.json`, JSON.stringify(results, null, 2));
  console.log(`  Result saved: shared/results/LANG-SWITCH-001.json`);
  return results;
}

// Allow standalone execution
if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1));
}
