// Cosmos Transfer Tests (Extension) — EXT-COSMOS-001 ~ EXT-COSMOS-012
// Thin wrapper: test logic lives in src/tests/shared/transfer/cosmos/transfer.mjs
// Connects via CDP port 9224 using connectExtensionCDP.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep, WALLET_PASSWORD } from '../../../helpers/constants.mjs';
import { connectExtensionCDP, getExtensionId } from '../../../helpers/extension-cdp.mjs';
import { createCosmosTransferTests } from '../../../shared/transfer/cosmos/transfer.mjs';

const RESULTS_DIR = resolve(import.meta.dirname, '../../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'ext-cosmos-screenshots');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

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

export const displayName = 'Cosmos 转账';

const { testCases, setup } = createCosmosTransferTests({
  prefix: 'EXT-COSMOS',
  namePrefix: 'Ext-',
  password: WALLET_PASSWORD,
  goToWallet,
  screenshotDir: SCREENSHOT_DIR,
});

export { testCases, setup };

// ── Standalone runner ──────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('EXT-COSMOS-'));
  const cases = filter
    ? testCases.filter(c => c.id === filter)
    : testCases;

  if (cases.length === 0) {
    console.error(`No cases matching "${filter}"`);
    console.error('Available:', testCases.map(c => c.id).join(', '));
    return { status: 'error', error: `No match: ${filter}` };
  }

  let { browser, page } = await connectExtensionCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Cosmos Transfer Tests (Extension) — ${cases.length} case(s)`);
  console.log('='.repeat(60));

  await setup(page);

  const results = [];
  for (const tc of cases) {
    const startTime = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`▶ ${tc.id}: ${tc.name}`);
    console.log('─'.repeat(60));

    try {
      if (page?.isClosed?.()) {
        ({ browser, page } = await connectExtensionCDP());
        await setup(page);
      }
      const result = await tc.fn(page);
      const duration = Date.now() - startTime;
      const r = {
        testId: tc.id,
        status: result.status,
        duration,
        steps: result.steps,
        summary: result.summary,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      };
      console.log(`\n◆ ${tc.id}: ${r.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s)`);
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    } catch (error) {
      const duration = Date.now() - startTime;
      const r = {
        testId: tc.id,
        status: 'failed',
        duration,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
      console.error(`\n◆ ${tc.id}: FAILED (${(duration / 1000).toFixed(1)}s): ${error.message}`);
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }
    await sleep(1000);
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
