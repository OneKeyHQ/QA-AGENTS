// Currency Switch Test (Extension) — EXT-SETTINGS-002
// Thin wrapper: test logic lives in src/tests/shared/settings/currency-switch.mjs
// Connects via connectExtensionCDP.
//
// Note: Extension may expose preferences through the expanded tab; if not found,
// the test will fail with a clear error.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep } from '../../helpers/constants.mjs';
import { connectExtensionCDP, getExtensionId } from '../../helpers/extension-cdp.mjs';
import { createCurrencySwitchTests } from '../../shared/settings/currency-switch.mjs';

const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'ext-currency-switch');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function screenshotExt(page, name) {
  try { await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` }); } catch {}
}

// ── Platform-specific Navigation ─────────────────────────────

async function openSettings(page) {
  let clicked = await page.evaluate(() => {
    const sidebar = document.querySelector('[data-testid="Desktop-AppSideBar-Container"]');
    if (!sidebar) return false;
    const svgs = [...sidebar.querySelectorAll('svg[role="img"]')];
    const last = svgs[svgs.length - 1];
    if (!last) return false;
    last.click(); return true;
  });

  if (!clicked) {
    clicked = await page.evaluate(() => {
      const el = document.querySelector(
        '[data-testid*="setting" i], [data-testid*="preference" i], [data-testid*="avatar" i]'
      );
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) { el.click(); return true; }
      return false;
    });
  }

  if (!clicked) {
    const extId = getExtensionId();
    await page.goto(`chrome-extension://${extId}/ui-expand-tab.html#/`);
    await sleep(2500);
    clicked = await page.evaluate(() => {
      const sidebar = document.querySelector('[data-testid="Desktop-AppSideBar-Container"]');
      if (!sidebar) return false;
      const svgs = [...sidebar.querySelectorAll('svg[role="img"]')];
      const last = svgs[svgs.length - 1];
      if (!last) return false;
      last.click(); return true;
    });
  }

  if (!clicked) throw new Error('Settings entry not found (extension)');
  await sleep(1500);

  const labels = ['偏好设置', '偏好設置', 'Preferences', 'Settings', '设置', '設置', 'Préférences', 'Einstellungen', '環境設定'];
  const clickedItem = await page.evaluate((labs) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent?.trim();
      if (t && labs.includes(t)) {
        const el = node.parentElement;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { el.click(); return true; }
      }
    }
    return false;
  }, labels);
  if (clickedItem) await sleep(1500);
}

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = '切换法币';

const { testCases, setup } = createCurrencySwitchTests({
  prefix: 'EXT-SETTINGS',
  namePrefix: 'Ext-',
  openSettings,
  screenshotDir: SCREENSHOT_DIR,
});

export { testCases, setup };

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('EXT-SETTINGS-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) { console.error(`No tests matching "${filter}"`); return { status: 'error' }; }

  let { browser, page } = await connectExtensionCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Currency Switch Test (Extension) — ${casesToRun.length} case(s)`);
  console.log('='.repeat(60));

  await setup(page);
  const results = [];
  for (const test of casesToRun) {
    const startTime = Date.now();
    console.log(`\n[${test.id}] ${test.name}`);
    try {
      if (page?.isClosed?.()) { ({ browser, page } = await connectExtensionCDP()); await setup(page); }
      const result = await test.fn(page);
      const duration = Date.now() - startTime;
      const r = { testId: test.id, status: result.status, duration, steps: result.steps, errors: result.errors, timestamp: new Date().toISOString() };
      console.log(`>> ${test.id}: ${r.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s)`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    } catch (error) {
      const duration = Date.now() - startTime;
      const r = { testId: test.id, status: 'failed', duration, error: error.message, timestamp: new Date().toISOString() };
      console.error(`>> ${test.id}: FAILED (${(duration / 1000).toFixed(1)}s) — ${error.message}`);
      if (page && !page?.isClosed?.()) await screenshotExt(page, `${test.id}-error`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }
    await sleep(800);
  }
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;
  console.log(`\nSUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
