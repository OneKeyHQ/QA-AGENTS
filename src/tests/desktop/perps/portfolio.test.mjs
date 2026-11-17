const connectCDP = () => connectPlatform('desktop');
import {connectPlatform} from '../../helpers/platform-session.mjs';
import {mustStopAfterResult} from '../../helpers/execution-policy.mjs';
// Perps Portfolio & PnL Tests (Desktop) — PERPS-PNL-001 ~ PERPS-PNL-013
// Thin wrapper: test logic lives in src/tests/shared/perps/portfolio.mjs
// Connects via CDP port 9222 (OneKey Electron app).
//
// Test case doc: docs/qa/testcases/cases/perps/2026-03-26_Perps-投资组合&盈亏.md

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  sleep, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
} from '../../helpers/index.mjs';
import { clickSidebarTab, importWatchAddress } from '../../helpers/components.mjs';
import { PerpsPage } from '../../helpers/pages/index.mjs';
import {typeInput} from '../../helpers/perps-ui.mjs';
import { createPortfolioTests, WATCH_ADDRESSES } from '../../shared/perps/portfolio.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'perps-portfolio');
mkdirSync(SCREENSHOT_DIR, { recursive: true });
// ── Platform-specific Navigation ─────────────────────────────

async function goToPerps(page) {
  await new PerpsPage(page).navigate();
}

// ── Account Switching (Desktop) ──────────────────────────────

/**
 * 通过地址搜索并切换到指定观察钱包账户。
 * 流程：打开账户选择器 → 观察钱包 tab → 搜索地址 → 点击结果 → 关闭弹窗
 * 未配置地址时明确跳过，禁止首条兜底或自动导入。
 */
async function switchToWatchAccount(page,address,label) {
  await unlockWalletIfNeeded(page);
  await clickSidebarTab(page,'Wallet');
  await page.locator('[data-testid="AccountSelectorTriggerBase"]:visible').click();
  const modal=page.locator('[data-testid="APP-Modal-Screen"]:visible').last();
  await modal.locator('[data-testid="wallet-others-view-tabs-watching"]').click();
  const input=modal.locator('input').first();
  await typeInput(input,address.slice(0,10));
  await sleep(1200);
  const rows=modal.locator('[data-testid^="account-item-"]:visible');
  for(let i=0;i<await rows.count();i++) {
    const row=rows.nth(i),text=(await row.innerText()).toLowerCase();
    if(text.includes(address.slice(0,8).toLowerCase()) && text.includes(address.slice(-4).toLowerCase())) {
      await row.click();
      await modal.waitFor({state:'hidden',timeout:10000});
      return;
    }
  }
  await page.keyboard.press('Escape');
  return `SKIP: ${label} 未配置匹配地址的观察账户；不选择首条兜底，不自动导入钱包`;
}

/** 切换到有资产的 Perps 账户（高胜率观察钱包） */
async function switchToFundedAccount(page) {
  await unlockWalletIfNeeded(page);
  await goToPerps(page);
  const text=await page.getByTestId('perp-portfolio-button').innerText();
  if(!/[1-9]/.test(text)) return 'SKIP: 当前账户未提供有资产的投资组合测试数据';
}

// ── Test Cases (from shared module) ──────────────────────────

export const platform = 'desktop';
export const displayName = '投资组合';

const { testCases, setup, ALL_TEST_IDS } = createPortfolioTests({
  prefix: 'PERPS-PNL',
  namePrefix: '',
  screenshotDir: SCREENSHOT_DIR,
  goToPerps,
  switchToFundedAccount,
  switchToWatchAccount,
  accounts: [{label:'当前账户',isFunded:true}],
});

export { testCases, setup, ALL_TEST_IDS };

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  const selectedIds = process.argv.slice(2).filter(a => a.startsWith('PERPS-PNL-'));
  const toRun = selectedIds.length > 0
    ? testCases.filter(tc => selectedIds.includes(tc.id))
    : testCases;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Perps Portfolio & PnL Tests — ${toRun.length} case(s)`);
  console.log(`${'='.repeat(60)}\n`);

  let { browser, page } = await connectCDP();
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
  await setup(page);

  const results = {};

  for (const tc of toRun) {
    console.log(`${'─'.repeat(60)}`);
    console.log(`[${tc.id}] ${tc.name}`);
    console.log(`${'─'.repeat(60)}`);

    const start = Date.now();
    try {
      const result = await tc.fn(page);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      results[tc.id] = result;
      const summary = result.summary || {};
      const skipInfo = summary.skipped > 0 ? ` (${summary.skipped} skipped)` : '';
      console.log(`>> ${tc.id}: ${result.status.toUpperCase()} (${elapsed}s) — ${summary.passed || 0} passed, ${summary.failed || 0} failed, ${summary.skipped || 0} skipped${skipInfo}`);
      if (result.errors.length > 0) {
        result.errors.forEach(e => console.log(`   * ${e}`));
      }
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify({
        testId: tc.id, status: result.status, duration: Date.now() - start,
        steps: result.steps, errors: result.errors,
        timestamp: new Date().toISOString(),
      }, null, 2));
    } catch (e) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      results[tc.id] = { status: 'failed', steps: [], errors: [e.message], fatalRestore: Boolean(e.fatalRestore) };
      console.log(`>> ${tc.id}: FAILED (${elapsed}s) — ${e.message}`);
      try {
        await page.screenshot({ path: resolve(SCREENSHOT_DIR, `${tc.id}-fatal-or-timeout.png`) });
      } catch {}
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify({
        testId: tc.id, status: 'failed', duration: Date.now() - start,
        error: e.message, timestamp: new Date().toISOString(),
      }, null, 2));
      if (!e.fatalRestore && /timed out|Target page|context or browser has been closed/i.test(e.message || '')) {
        ({ browser, page } = await connectCDP());
        await unlockWalletIfNeeded(page).catch(() => {});
        await dismissOverlays(page).catch(() => {});
        await setup(page).catch(() => {});
      }
    }
    if(mustStopAfterResult(results[tc.id])) { console.error('恢复失败，停止后续用例；剩余条目未执行'); break; }
    console.log();
  }

  const passed = Object.values(results).filter(r => r.status === 'passed').length;
  const failed = Object.values(results).filter(r => r.status === 'failed').length;
  console.log(`${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${toRun.length} total`);
  console.log(`${'='.repeat(60)}`);

  const resultPath = resolve(RESULTS_DIR, 'perps-portfolio/results.json');
  mkdirSync(resolve(RESULTS_DIR, 'perps-portfolio'), { recursive: true });
  writeFileSync(resultPath, JSON.stringify(results, null, 2));
  console.log(`Results saved to ${resultPath}`);

  return { fatalRestore: Object.values(results).some(mustStopAfterResult), status: failed === 0 ? 'passed' : 'failed', passed, failed, total: Object.keys(results).length, notRun: toRun.length-Object.keys(results).length };
}

const _thisFile = new URL(import.meta.url).pathname;
const isDirectRun = process.argv[1] && process.argv[1].endsWith('portfolio.test.mjs');
if (isDirectRun) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
