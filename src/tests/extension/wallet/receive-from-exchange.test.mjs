// Wallet — 从交易所接收 (Extension) — EXT-WALLET-RECV-001 ~ EXT-WALLET-RECV-005
// Thin wrapper: test logic lives in src/tests/shared/wallet/receive-from-exchange.mjs
// Connects via CDP port 9224 using connectExtensionCDP.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep } from '../../helpers/constants.mjs';
import { connectExtensionCDP, getExtensionId } from '../../helpers/extension-cdp.mjs';
import { createReceiveFromExchangeTests } from '../../shared/wallet/receive-from-exchange.mjs';

const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'ext-wallet-receive-from-exchange');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function screenshotExt(page, name) {
  try {
    const path = `${SCREENSHOT_DIR}/${name}.png`;
    await page.screenshot({ path });
  } catch {}
}

// ── Platform-specific Navigation ─────────────────────────────

/** Navigate to wallet home via sidebar tab; falls back to extension URL. */
async function goToWallet(page) {
  const clicked = await page.evaluate(() => {
    const sidebar = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
    if (sidebar) {
      for (const sp of sidebar.querySelectorAll('span, div')) {
        const txt = sp.textContent?.trim() || '';
        if (txt === '钱包' || txt === 'Wallet') {
          const r = sp.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { sp.click(); return true; }
        }
      }
    }
    const fallback = document.querySelector('[data-testid="tab-modal-no-active-item-Wallet4Outline"]')
      || document.querySelector('[data-testid="tab-modal-active-item-Wallet4Solid"]');
    if (fallback) { fallback.click(); return true; }
    return false;
  });
  if (!clicked) {
    const extId = getExtensionId();
    await page.goto(`chrome-extension://${extId}/ui-expand-tab.html#/main/TabHome`).catch(() => {});
    await sleep(2000);
  }
  await sleep(1500);
}

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = '从交易所接收';

const { testCases } = createReceiveFromExchangeTests({
  prefix: 'EXT-WALLET-RECV',
  namePrefix: 'Ext-',
  goToWallet,
});

export { testCases };

export async function setup(/* page */) {
  // No-op: each test invokes goToWallet internally.
}

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('EXT-WALLET-RECV-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { browser, page } = await connectExtensionCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Wallet Receive from Exchange (Extension) — ${casesToRun.length} case(s)`);
  console.log('='.repeat(60));

  await setup(page);

  const results = [];
  for (const tc of casesToRun) {
    const start = Date.now();
    console.log(`\n[${tc.id}] ${tc.name}`);
    try {
      if (page?.isClosed?.()) {
        ({ browser, page } = await connectExtensionCDP());
        await setup(page);
      }
      await tc.fn(page);
      const dur = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  PASS  ${tc.id}  ${dur}s`);
      const pass = {
        testId: tc.id, status: 'pass', duration: Date.now() - start,
        timestamp: new Date().toISOString(), error: null, screenshot: null,
      };
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(pass, null, 2));
      results.push(pass);
    } catch (err) {
      const dur = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  FAIL  ${tc.id}  ${dur}s  ${err.message}`);
      if (page && !page?.isClosed?.()) await screenshotExt(page, `${tc.id}-fail`);
      const fail = {
        testId: tc.id, status: 'fail', duration: Date.now() - start,
        timestamp: new Date().toISOString(), error: err.message,
      };
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(fail, null, 2));
      results.push(fail);
    }
    await sleep(600);
  }

  const failed = results.filter(r => r.status === 'fail').length;
  console.log(`\n  Results: ${results.filter(r => r.status === 'pass').length} pass, ${failed} fail`);
  return { status: failed === 0 ? 'passed' : 'failed', results };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
