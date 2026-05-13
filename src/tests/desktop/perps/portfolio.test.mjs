// Perps Portfolio & PnL Tests (Desktop) — PERPS-PNL-001 ~ PERPS-PNL-008
// Thin wrapper: test logic lives in src/tests/shared/perps/portfolio.mjs
// Connects via CDP port 9222 (OneKey Electron app).
//
// Test case doc: docs/qa/testcases/cases/perps/2026-03-26_Perps-投资组合&盈亏.md

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
} from '../../helpers/index.mjs';
import { clickSidebarTab, importWatchAddress } from '../../helpers/components.mjs';
import { createPortfolioTests, WATCH_ADDRESSES } from '../../shared/perps/portfolio.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'perps-portfolio');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Platform-specific Navigation ─────────────────────────────

async function goToPerps(page) {
  await clickSidebarTab(page, 'Perps');
  await sleep(2000);
}

// ── Account Switching (Desktop) ──────────────────────────────

/**
 * 通过地址搜索并切换到指定观察钱包账户。
 * 流程：打开账户选择器 → 观察钱包 tab → 搜索地址 → 点击结果 → 关闭弹窗
 * 搜不到则自动导入。
 */
async function switchToWatchAccount(page, address, label) {
  await clickSidebarTab(page, 'Wallet');
  await sleep(2000);

  // 打开账户选择器
  await page.evaluate(() => {
    document.querySelector('[data-testid="AccountSelectorTriggerBase"]')?.click();
  });
  await sleep(2000);

  // 点击「观察钱包」tab
  await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return;
    for (const sp of modal.querySelectorAll('span')) {
      if (sp.textContent?.trim() === '观察钱包' && sp.children.length === 0 && sp.getBoundingClientRect().width > 0) {
        sp.click(); return;
      }
    }
  });
  await sleep(1500);

  // 搜索地址（用前 10 字符）
  const searchKey = address.slice(0, 10);
  const found = await page.evaluate((key) => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return false;
    const input = modal.querySelector('input[placeholder*="搜索"]');
    if (!input) return false;
    input.focus();
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (nativeSet) {
      nativeSet.call(input, key);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return true;
  }, searchKey);

  if (!found) {
    console.log(`  [warn] 搜索框未找到，尝试直接导入`);
  } else {
    await sleep(2000);
  }

  // 检查搜索结果中是否有匹配的账户（地址包含搜索词）
  const clicked = await page.evaluate((key) => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return false;
    for (const el of modal.querySelectorAll('[data-testid^="account-item-"]')) {
      const text = el.textContent || '';
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 20 && text.toLowerCase().includes(key.toLowerCase())) {
        el.click();
        return true;
      }
    }
    const first = modal.querySelector('[data-testid="account-item-index-0"]');
    if (first && first.getBoundingClientRect().width > 0) {
      first.click();
      return true;
    }
    return false;
  }, searchKey);

  if (clicked) {
    await sleep(2000);
    console.log(`  ✓ 切换到 ${label} (${searchKey}...)`);
    return;
  }

  // 搜不到 → 关闭弹窗 → 导入
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(500);
  console.log(`  [AUTO] ${label} 不存在，导入 ${address.slice(0, 10)}...`);
  await importWatchAddress(page, address, { name: label !== '空账户' ? label : undefined });
  await sleep(2000);
  console.log(`  ✓ 导入并切换到 ${label}`);
}

/** 切换到有资产的 Perps 账户（高胜率观察钱包） */
async function switchToFundedAccount(page) {
  await switchToWatchAccount(page, WATCH_ADDRESSES['高胜率'], '高胜率');
}

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = '投资组合';

const { testCases, setup, ALL_TEST_IDS } = createPortfolioTests({
  prefix: 'PERPS-PNL',
  namePrefix: '',
  screenshotDir: SCREENSHOT_DIR,
  goToPerps,
  switchToFundedAccount,
  switchToWatchAccount,
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

  const { browser, page } = await connectCDP();
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);

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
      results[tc.id] = { status: 'failed', steps: [], errors: [e.message] };
      console.log(`>> ${tc.id}: FAILED (${elapsed}s) — ${e.message}`);
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify({
        testId: tc.id, status: 'failed', duration: Date.now() - start,
        error: e.message, timestamp: new Date().toISOString(),
      }, null, 2));
    }
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

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: toRun.length };
}

const _thisFile = new URL(import.meta.url).pathname;
const isDirectRun = process.argv[1] && process.argv[1].endsWith('portfolio.test.mjs');
if (isDirectRun) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
