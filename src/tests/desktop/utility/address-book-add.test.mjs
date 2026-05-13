// Address Book — Add Address Tests (Desktop) — ADDR-ADD-001 ~ ADDR-ADD-004
// Thin wrapper: test logic lives in src/tests/shared/utility/address-book-add.mjs
// Connects via CDP port 9222 (OneKey Electron app).

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
} from '../../helpers/index.mjs';
import { createAddressBookAddTests } from '../../shared/utility/address-book-add.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'address-book-add');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Platform-specific Navigation ─────────────────────────────

/** Desktop: navigate to address book via sidebar avatar/menu → popover → "地址簿" */
async function openAddressBook(page) {
  const menuPos = await page.evaluate(() => {
    const sidebar = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
    if (!sidebar) return null;
    const r = sidebar.getBoundingClientRect();
    let lastY = 0;
    for (const el of sidebar.querySelectorAll('div, svg')) {
      const er = el.getBoundingClientRect();
      if (er.width > 0 && er.y > lastY) lastY = er.y;
    }
    return { x: r.x + r.width / 2, y: lastY + 12 };
  });
  if (!menuPos) throw new Error('Cannot find sidebar');

  await page.mouse.click(menuPos.x, menuPos.y);
  await sleep(1000);

  let found = false;
  for (let i = 0; i < 5; i++) {
    found = await page.evaluate(() => {
      const popovers = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      for (const pop of popovers) {
        const r = pop.getBoundingClientRect();
        if (r.width === 0) continue;
        for (const span of pop.querySelectorAll('span')) {
          if (span.textContent?.trim() === '地址簿') {
            span.click();
            return true;
          }
        }
      }
      return false;
    });
    if (found) break;
    await sleep(500);
  }

  if (!found) {
    await page.evaluate(() => {
      const sidebar = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
      if (!sidebar) return;
      const svgs = sidebar.querySelectorAll('svg');
      const last = Array.from(svgs).pop();
      if (last) last.click();
    });
    await sleep(1000);

    found = await page.evaluate(() => {
      const popovers = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      for (const pop of popovers) {
        const r = pop.getBoundingClientRect();
        if (r.width === 0) continue;
        for (const span of pop.querySelectorAll('span')) {
          if (span.textContent?.trim() === '地址簿') {
            span.click();
            return true;
          }
        }
      }
      return false;
    });
  }

  if (!found) throw new Error('Cannot find "地址簿" in popover');
  await sleep(1500);
}

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = '地址簿添加';

const { testCases } = createAddressBookAddTests({
  prefix: 'ADDR-ADD',
  namePrefix: '',
  openAddressBook,
  screenshotDir: SCREENSHOT_DIR,
});

export { testCases };

export async function setup(page) {
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
}

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('ADDR-ADD-'));
  const casesToRun = filter
    ? testCases.filter(c => c.id === filter)
    : testCases;

  let { page } = await connectCDP();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Address Book — Add Address Tests — ${casesToRun.length} case(s)`);
  console.log('='.repeat(60));

  const results = [];
  await setup(page);

  for (const test of casesToRun) {
    const startTime = Date.now();
    console.log(`\n${'─'.repeat(60)}\n[${test.id}] ${test.name}`);

    try {
      if (page?.isClosed?.()) {
        ({ page } = await connectCDP());
        await setup(page);
      }
      const result = await test.fn(page);
      const duration = Date.now() - startTime;
      const r = {
        testId: test.id,
        status: result.status,
        duration, steps: result.steps, errors: result.errors,
        timestamp: new Date().toISOString(),
      };
      console.log(`>> ${test.id}: ${r.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s)`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`>> ${test.id}: FATAL — ${error.message}`);
      const r = {
        testId: test.id, status: 'failed', duration,
        error: error.message, timestamp: new Date().toISOString(),
      };
      if (page && !page?.isClosed?.()) {
        await screenshot(page, SCREENSHOT_DIR, `${test.id}-error`);
      }
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));

  const summary = {
    timestamp: new Date().toISOString(),
    total: results.length, passed, failed, results,
  };
  writeFileSync(resolve(RESULTS_DIR, 'address-book-add-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
