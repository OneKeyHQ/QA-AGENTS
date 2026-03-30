// Theme Switch Test — Verifies theme switching (light/dark/system) in preferences
// Flow: current → dark → system → light → system (restore original)
// Language-agnostic: uses position/testid/body-class, never text matching

import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep, clickTestId, RESULTS_DIR } from '../../helpers/index.mjs';
import { createStepTracker, safeStep } from '../../helpers/components.mjs';
import { openPreferences, clickPrefsRow } from './nav-helpers.mjs';
import { assertListRendered } from '../../helpers/components.mjs';

export const testCases = [
  { id: 'SETTINGS-001', name: '设置-主题切换', fn: testThemeSwitch },
];

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'theme-switch');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Theme selection ─────────────────────────────────────────

async function selectTheme(page, themeKey) {
  // Click theme row (3rd select-item- in preferences, index=2)
  await clickPrefsRow(page, 2);
  await sleep(1000);
  // Click the target theme option via testid (language-agnostic)
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

// ── Main Test ──────────────────────────────────────────────

async function testThemeSwitch(page) {
  const t = createStepTracker('SETTINGS-001');

  await safeStep(page, t, '打开偏好设置', async () => {
    await openPreferences(page);
    return 'preferences opened';
  }, SCREENSHOT_DIR);

  // Verify theme dropdown renders correctly (first switch only)
  await safeStep(page, t, '主题下拉列表渲染验证', async () => {
    await clickPrefsRow(page, 2);
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
