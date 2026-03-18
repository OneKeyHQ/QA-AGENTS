// Theme Switch Test — Verifies theme switching (light/dark/system) in preferences
// Based on runner SETTINGS-001 test case
// Flow: current → light → system → dark → system (restore)

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, clickTestId, RESULTS_DIR,
} from '../../helpers/index.mjs';

export const testCases = [
  { id: 'SETTINGS-001', name: '设置-主题切换' },
];

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'theme-switch');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Theme labels (Traditional Chinese UI) ──────────────────

const THEME_LABELS = {
  system: '自動',
  light: '淺色',
  dark: '深色',
};

// ── Navigation helpers ──────────────────────────────────────

async function openPreferences(page) {
  // Click sidebar settings gear icon
  const sidebar = page.locator('[data-testid="Desktop-AppSideBar-Content-Container"]');
  await sidebar.last().click();
  await sleep(800);

  // Click settings menu item in popover
  const popover = page.locator('[data-testid="TMPopover-ScrollView"]');
  await popover.waitFor({ state: 'visible', timeout: 5000 });
  const settingsItem = popover.locator('svg').last();
  await settingsItem.click();
  await sleep(800);

  // Click Preferences tab
  await clickTestId(page, 'tab-modal-no-active-item-SettingsSolid', { delay: 500 });
}

async function openThemeDropdown(page) {
  // Click the "主題" dropdown to open it
  const clicked = await page.evaluate(() => {
    const spans = document.querySelectorAll('span');
    for (const sp of spans) {
      if (sp.textContent === '主題' && sp.getBoundingClientRect().width > 0) {
        const row = sp.closest('[role="button"]') || sp.parentElement?.parentElement;
        if (row) { row.click(); return true; }
      }
    }
    // Fallback: click any dropdown that shows current theme text
    const triggers = document.querySelectorAll('[data-testid="APP-Modal-Screen"] [role="button"]');
    for (const t of triggers) {
      const text = t.textContent;
      if (text?.includes('自動') || text?.includes('淺色') || text?.includes('深色')) {
        t.click();
        return true;
      }
    }
    return false;
  });

  if (!clicked) {
    // Final fallback: click by label text
    for (const label of Object.values(THEME_LABELS)) {
      const loc = page.locator(`[data-testid="APP-Modal-Screen"] >> text="${label}"`).first();
      const vis = await loc.isVisible({ timeout: 500 }).catch(() => false);
      if (vis) { await loc.click(); break; }
    }
  }
  await sleep(800);
}

async function selectTheme(page, theme) {
  await openThemeDropdown(page);

  // Click the target theme option via data-testid
  const testid = `select-item-${theme}`;
  await clickTestId(page, testid, { delay: 1500 });
  console.log(`    Selected theme: ${theme}`);
}

async function closeSettings(page) {
  const closeBtn = page.locator('[data-testid="nav-header-close"]');
  const vis = await closeBtn.isVisible({ timeout: 2000 }).catch(() => false);
  if (vis) {
    await closeBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }
  await sleep(1000);
}

// ── Assertion ───────────────────────────────────────────────

async function assertTheme(page, expectedTheme, stepName) {
  const expectedLabel = THEME_LABELS[expectedTheme];

  const result = await page.evaluate(({ label }) => {
    const allText = document.body?.textContent || '';
    const labelFound = allText.includes(label);

    // Check sidebar text color as theme indicator
    const sidebar = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
    let sidebarTextColor = '';
    if (sidebar) {
      const spans = sidebar.querySelectorAll('span');
      for (const sp of spans) {
        if (sp.getBoundingClientRect().width > 0 && sp.textContent?.trim()) {
          sidebarTextColor = getComputedStyle(sp).color;
          break;
        }
      }
    }
    const parseBg = (bg) => {
      const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!m) return -1;
      const alpha = m[4] !== undefined ? parseFloat(m[4]) : 1;
      if (alpha < 0.1) return -1;
      return (parseInt(m[1]) + parseInt(m[2]) + parseInt(m[3])) / 3;
    };
    const sidebarTextBrightness = parseBg(sidebarTextColor);

    return { labelFound, label, sidebarTextBrightness };
  }, { label: expectedLabel });

  // Visual check via sidebar text color
  let visualMatch = true;
  let visualDetail = '';
  if (expectedTheme === 'dark') {
    visualMatch = result.sidebarTextBrightness >= 0 && result.sidebarTextBrightness > 200;
    visualDetail = `text brightness ${result.sidebarTextBrightness >= 0 ? result.sidebarTextBrightness.toFixed(0) : 'N/A'} (expect > 200)`;
  } else if (expectedTheme === 'light') {
    visualMatch = result.sidebarTextBrightness >= 0 && result.sidebarTextBrightness < 50;
    visualDetail = `text brightness ${result.sidebarTextBrightness >= 0 ? result.sidebarTextBrightness.toFixed(0) : 'N/A'} (expect < 50)`;
  } else {
    visualDetail = 'system (visual check skipped)';
  }

  const passed = result.labelFound && visualMatch;
  console.log(`    Label "${result.label}": ${result.labelFound ? '✓' : '✗'}`);
  console.log(`    Visual: ${visualMatch ? '✓' : '✗'} ${visualDetail}`);

  return { passed, labelFound: result.labelFound, visualMatch, sidebarTextBrightness: result.sidebarTextBrightness };
}

// ── Main Test ────────────────────────────────────────────

export async function run() {
  const startTime = Date.now();
  const results = {
    testId: 'SETTINGS-001',
    name: 'Theme Switch Verification',
    status: 'passed',
    steps: [],
    errors: [],
    assertionResults: [],
    startTime: new Date().toISOString(),
  };

  function addStep(name, status, detail = '') {
    results.steps.push({ name, status, detail, time: new Date().toISOString() });
    const icon = status === 'passed' ? '✓' : '✗';
    console.log(`\n  ${icon} ${name}${detail ? ': ' + detail : ''}`);
  }

  const sequence = [
    { theme: 'light', label: '→ light' },
    { theme: 'system', label: 'light → system' },
    { theme: 'dark', label: 'system → dark' },
    { theme: 'system', label: 'dark → system (restore)' },
  ];

  try {
    const { page } = await connectCDP();

    console.log('\n══════════════════════════════════════════');
    console.log('  Theme Switch Test');
    console.log('  Flow: current → light → system → dark → system');
    console.log('══════════════════════════════════════════');

    // Open preferences first
    console.log('\n  Opening Preferences...');
    await openPreferences(page);
    addStep('Open Preferences', 'passed');

    // Run through theme sequence
    for (let i = 0; i < sequence.length; i++) {
      const { theme, label } = sequence[i];
      const stepName = `step${i + 1}`;

      console.log(`\n  Step ${i + 1}: ${label}`);
      await selectTheme(page, theme);

      const assertion = await assertTheme(page, theme, stepName);
      results.assertionResults.push({
        step: i + 1,
        action: 'assert_theme',
        theme,
        ...assertion,
      });

      if (assertion.passed) {
        addStep(label, 'passed');
      } else {
        const detail = [];
        if (!assertion.labelFound) detail.push(`label "${THEME_LABELS[theme]}" not found`);
        if (!assertion.visualMatch) detail.push('visual mismatch');
        addStep(label, 'failed', detail.join('; '));
        results.errors.push(`${label}: ${detail.join('; ')}`);
      }
    }

    // Close settings
    await closeSettings(page);
    addStep('Close Settings', 'passed');

    // Summary
    const passedAssertions = results.assertionResults.filter(a => a.passed);
    results.status = results.errors.length === 0 ? 'passed' : 'failed';
    results.duration = Date.now() - startTime;
    results.endTime = new Date().toISOString();
    results.assertionSummary = `${passedAssertions.length}/${results.assertionResults.length} theme assertions passed`;

    console.log('\n══════════════════════════════════════════');
    console.log(`  Result: ${results.status.toUpperCase()}`);
    console.log(`  Assertions: ${results.assertionSummary}`);
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

  writeFileSync(`${RESULTS_DIR}/SETTINGS-001.json`, JSON.stringify(results, null, 2));
  console.log(`  Result saved: shared/results/SETTINGS-001.json`);
  return results;
}

// Allow standalone execution
if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1));
}
