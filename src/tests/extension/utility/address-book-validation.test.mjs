// Address Book — Validation Tests (Extension) — EXT-ADDR-VALID-001 ~ EXT-ADDR-VALID-004
// Thin wrapper: test logic lives in src/tests/shared/utility/address-book-validation.mjs
// Connects via CDP port 9224 (Chrome with extension loaded).

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep } from '../../helpers/constants.mjs';
import { connectExtensionCDP, getExtensionId } from '../../helpers/extension-cdp.mjs';
import { createAddressBookValidationTests } from '../../shared/utility/address-book-validation.mjs';

const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'ext-address-book-validation');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Platform-specific Navigation ─────────────────────────────

/**
 * Extension: navigate to address book via sidebar avatar/menu → popover → "地址簿".
 */
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

  if (menuPos) {
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
    if (found) {
      await sleep(1500);
      return;
    }
  }

  const settingsClicked = await page.evaluate(() => {
    for (const el of document.querySelectorAll('a, button, span, div')) {
      const txt = (el.textContent || '').trim();
      if (['设置', 'Settings'].includes(txt)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.height < 60) {
          el.click();
          return true;
        }
      }
    }
    return false;
  });
  if (settingsClicked) {
    await sleep(1000);
    const addrClicked = await page.evaluate(() => {
      for (const el of document.querySelectorAll('a, button, span, div')) {
        const txt = (el.textContent || '').trim();
        if (txt === '地址簿' || txt === 'Address Book') {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            el.click();
            return true;
          }
        }
      }
      return false;
    });
    if (addrClicked) {
      await sleep(1500);
      return;
    }
  }

  const extId = getExtensionId();
  await page.goto(`chrome-extension://${extId}/ui-expand-tab.html#/main/AddressBookModal/AddressBookList`).catch(() => {});
  await sleep(2000);

  const ok = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="address-book-add-icon"]');
    return el && el.getBoundingClientRect().width > 0;
  });
  if (!ok) {
    throw new Error('Cannot navigate to address book in extension');
  }
}

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = '地址簿校验';

const { testCases } = createAddressBookValidationTests({
  prefix: 'EXT-ADDR-VALID',
  namePrefix: 'Ext-',
  openAddressBook,
  screenshotDir: SCREENSHOT_DIR,
});

export { testCases };

export async function setup(/* page */) {
  // No-op; openAddressBook is called inside each test case.
}

// ── Main (CLI Runner) ────────────────────────────────────────

async function screenshotExt(page, name) {
  try {
    const path = `${SCREENSHOT_DIR}/${name}.png`;
    await page.screenshot({ path });
  } catch {}
}

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('EXT-ADDR-VALID-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { browser, page } = await connectExtensionCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Address Book — Validation (Extension) — ${casesToRun.length} case(s)`);
  console.log('='.repeat(60));

  await setup(page);

  const results = [];
  for (const test of casesToRun) {
    const startTime = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${test.id}] ${test.name}`);
    console.log('─'.repeat(60));

    try {
      if (page?.isClosed?.()) {
        ({ browser, page } = await connectExtensionCDP());
        await setup(page);
      }
      const result = await test.fn(page);
      const duration = Date.now() - startTime;
      const r = {
        testId: test.id, status: result.status, duration,
        steps: result.steps, errors: result.errors,
        timestamp: new Date().toISOString(),
      };
      console.log(`>> ${test.id}: ${r.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s)`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    } catch (error) {
      const duration = Date.now() - startTime;
      const r = {
        testId: test.id, status: 'failed', duration,
        error: error.message, timestamp: new Date().toISOString(),
      };
      console.error(`>> ${test.id}: FAILED (${(duration / 1000).toFixed(1)}s) — ${error.message}`);
      if (page && !page?.isClosed?.()) {
        await screenshotExt(page, `${test.id}-error`);
      }
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }
    await sleep(800);
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));

  const summary = { timestamp: new Date().toISOString(), total: results.length, passed, failed, results };
  writeFileSync(resolve(RESULTS_DIR, 'ext-address-book-validation-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
