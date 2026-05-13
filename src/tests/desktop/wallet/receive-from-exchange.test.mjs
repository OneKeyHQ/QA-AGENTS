// Wallet — 从交易所接收 (Desktop) — WALLET-RECV-001 ~ WALLET-RECV-005
// Thin wrapper: test logic lives in src/tests/shared/wallet/receive-from-exchange.mjs
// 用例文档：docs/qa/testcases/cases/wallet/2026-02-27_Wallet-从交易所接收.md

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
} from '../../helpers/index.mjs';
import { runPreconditions } from '../../helpers/preconditions.mjs';
import { createReceiveFromExchangeTests } from '../../shared/wallet/receive-from-exchange.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'wallet-receive-from-exchange');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const ALL_TEST_IDS = [
  'WALLET-RECV-001', 'WALLET-RECV-002',
  'WALLET-RECV-003', 'WALLET-RECV-004', 'WALLET-RECV-005',
];
let _preReport = null;

// ── Platform-specific Navigation ─────────────────────────────

/** 点击桌面侧栏的「钱包」tab */
async function goToWallet(page) {
  await page.evaluate(() => {
    const sidebar = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
    if (!sidebar) return false;
    for (const sp of sidebar.querySelectorAll('span, div')) {
      const txt = sp.textContent?.trim() || '';
      if (txt === '钱包' || txt === 'Wallet') {
        const r = sp.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { sp.click(); return true; }
      }
    }
    const fallback = document.querySelector('[data-testid="tab-modal-no-active-item-Wallet4Outline"]')
      || document.querySelector('[data-testid="tab-modal-active-item-Wallet4Solid"]');
    if (fallback) { fallback.click(); return true; }
    return false;
  });
  await sleep(1500);
}

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = '从交易所接收';

const { testCases } = createReceiveFromExchangeTests({
  prefix: 'WALLET-RECV',
  namePrefix: '',
  goToWallet,
});

export { testCases };

export async function setup(page) {
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
  _preReport = await runPreconditions(page, ALL_TEST_IDS);
  return _preReport;
}

// ── CLI Entry ───────────────────────────────────

export async function run() {
  const { page } = await connectCDP();
  const pre = await setup(page);

  const filter = process.argv.slice(2).find(a => a.startsWith('WALLET-RECV-'));
  const casesToRun = filter ? testCases.filter(tc => tc.id === filter) : testCases;

  const results = [];
  for (const tc of casesToRun) {
    if (pre.shouldSkip(tc.id)) {
      console.log(`  SKIP  ${tc.id}  ${tc.name}`);
      const skipped = {
        testId: tc.id, status: 'skipped', duration: 0,
        timestamp: new Date().toISOString(), error: null, screenshot: null,
      };
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(skipped, null, 2));
      results.push(skipped);
      continue;
    }

    console.log(`  RUN   ${tc.id}  ${tc.name}`);
    const start = Date.now();
    try {
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
      const shot = await screenshot(page, SCREENSHOT_DIR, `${tc.id}-fail`);
      const fail = {
        testId: tc.id, status: 'fail', duration: Date.now() - start,
        timestamp: new Date().toISOString(), error: err.message, screenshot: shot,
      };
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(fail, null, 2));
      results.push(fail);
    }
    await sleep(600);
  }

  const failed = results.filter(r => r.status === 'fail').length;
  console.log(`\n  Results: ${results.filter(r => r.status === 'pass').length} pass, ${failed} fail, ${results.filter(r => r.status === 'skipped').length} skip`);
  return { status: failed === 0 ? 'passed' : 'failed', results };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run()
    .then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error(e); process.exit(1); });
}
