const connectExtensionCDP = () => connectPlatform('extension');
import {connectPlatform} from '../../helpers/platform-session.mjs';
import {mustStopAfterResult} from '../../helpers/execution-policy.mjs';
// Perps Portfolio & PnL Tests (Extension) — EXT-PERPS-PNL-001 ~ EXT-PERPS-PNL-013
// Thin wrapper: test logic lives in src/tests/shared/perps/portfolio.mjs
// Connects via CDP port 9224 using connectExtensionCDP.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep } from '../../helpers/constants.mjs';
import { importWatchAddress } from '../../helpers/components.mjs';
import { getExtensionId } from '../../helpers/extension-cdp.mjs';
import { createPortfolioTests, WATCH_ADDRESSES } from '../../shared/perps/portfolio.mjs';

const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'ext-perps-portfolio');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function screenshotExt(page, name) {
  try {
    const path = `${SCREENSHOT_DIR}/${name}.png`;
    await page.screenshot({ path });
  } catch {}
}

// ── Platform-specific Navigation ─────────────────────────────

/** Navigate to perps page via sidebar or extension URL fallback */
async function goToPerps(page) {
  const clicked = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="perp"]');
    if (el) { el.click(); return true; }
    const container = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
    if (container) {
      for (const sp of container.querySelectorAll('span')) {
        if (['合约', 'Perps'].includes(sp.textContent.trim()) && sp.getBoundingClientRect().width > 0) {
          sp.click(); return true;
        }
      }
    }
    for (const el of document.querySelectorAll('a, button, [role="tab"], [role="menuitem"]')) {
      const text = el.textContent?.trim();
      if (['合约', 'Perps'].includes(text)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          el.click(); return true;
        }
      }
    }
    return false;
  });
  if (!clicked) {
    const extId = getExtensionId();
    await page.goto(`chrome-extension://${extId}/ui-expand-tab.html#/swap`);
    await sleep(3000);
    const retry = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="perp"]');
      if (el) { el.click(); return true; }
      for (const sp of document.querySelectorAll('span')) {
        if (['合约', 'Perps'].includes(sp.textContent?.trim())) {
          const r = sp.getBoundingClientRect();
          if (r.width > 0) { sp.click(); return true; }
        }
      }
      return false;
    });
    if (!retry) throw new Error('Cannot navigate to perps page (extension)');
  }
  await sleep(3000);
}

// ── Account Switching (Extension) ────────────────────────────

/**
 * Switch to a specific account in the extension by name (optionally within walletType tab).
 * Navigates to wallet tab first, clicks account selector, then selects account.
 */
async function switchToAccountExt(page, accountName, walletType) {
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="wallet"]');
    if (el) { el.click(); return; }
    for (const sp of document.querySelectorAll('span')) {
      if (['钱包', 'Wallet'].includes(sp.textContent?.trim())) {
        const r = sp.getBoundingClientRect();
        if (r.width > 0) { sp.click(); return; }
      }
    }
  });
  await sleep(1500);

  const selectorClicked = await page.evaluate(() => {
    const trigger = document.querySelector('[data-testid="AccountSelectorTriggerBase"]');
    if (trigger) { trigger.click(); return true; }
    return false;
  });
  if (!selectorClicked) throw new Error('Account selector trigger not found');
  await sleep(1500);

  if (walletType) {
    await page.evaluate((wt) => {
      for (const el of document.querySelectorAll('span, div, button')) {
        if (el.textContent?.trim() === wt && el.children.length === 0) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { el.click(); return; }
        }
      }
    }, walletType);
    await sleep(1000);
  }

  await page.evaluate((name) => {
    const input = document.querySelector('input[placeholder*="搜索"], input[data-testid="nav-header-search"]');
    if (input && input.getBoundingClientRect().width > 0) {
      const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (nativeSet) {
        nativeSet.call(input, name);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    return true;
  }, accountName);
  await sleep(1000);

  const selected = await page.evaluate((name) => {
    for (const el of document.querySelectorAll('span, div')) {
      const text = el.textContent?.trim();
      if (text === name && el.children.length === 0) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.height < 50) {
          el.click();
          return true;
        }
      }
    }
    return false;
  }, accountName);
  if (!selected) throw new Error(`Account "${accountName}" not found`);
  await sleep(1500);
}

/**
 * Switch to the funded Perps account (wallet "ran", first account).
 * @returns {true|string} true if switched, skip reason string if "ran" wallet not found
 */
async function switchToFundedAccount(page) {
  await unlockWalletIfNeeded(page);
  await goToPerps(page);
  const text=await page.getByTestId('perp-portfolio-button').innerText();
  if(!/[1-9]/.test(text)) return 'SKIP: 当前账户缺少有资产的投资组合测试数据';
}
async function switchToWatchAccount() {
  return 'SKIP: 需配置并验证观察账户地址；禁止按名称兜底或自动导入';
}

// ── Test Cases (from shared module) ──────────────────────────

export const platform = 'extension';
export const displayName = '投资组合';

const { testCases, setup, ALL_TEST_IDS } = createPortfolioTests({
  prefix: 'EXT-PERPS-PNL',
  namePrefix: 'Ext-',
  screenshotDir: SCREENSHOT_DIR,
  goToPerps,
  switchToFundedAccount,
  switchToWatchAccount,
  accounts:[{label:'当前账户',isFunded:true}],
});

export { testCases, setup, ALL_TEST_IDS };

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('EXT-PERPS-PNL-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { browser, page } = await connectExtensionCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Perps Portfolio & PnL Tests (Extension) — ${casesToRun.length} case(s)`);
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
        console.log('  Page was closed, reconnecting CDP...');
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
      if(mustStopAfterResult(r)) { console.error('恢复失败，停止后续用例；剩余条目未执行'); break; }
    } catch (error) {
      const duration = Date.now() - startTime;
      const r = {
        testId: test.id, status: 'failed', duration,
        error: error.message, fatalRestore: Boolean(error.fatalRestore), timestamp: new Date().toISOString(),
      };
      console.error(`>> ${test.id}: FAILED (${(duration / 1000).toFixed(1)}s) — ${error.message}`);
      if (page && !page?.isClosed?.()) {
        await screenshotExt(page, `${test.id}-error`);
      }
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
      if(mustStopAfterResult(r)) { console.error('恢复失败，停止后续用例；剩余条目未执行'); break; }
    }

    await sleep(1000);
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));
  results.forEach(r => {
    const icon = r.status === 'passed' ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] ${r.testId} (${(r.duration / 1000).toFixed(1)}s)${r.error ? ' — ' + r.error : ''}`);
  });

  const summary = { timestamp: new Date().toISOString(), total: results.length, passed, failed, results };
  writeFileSync(resolve(RESULTS_DIR, 'ext-perps-portfolio-summary.json'), JSON.stringify(summary, null, 2));

  return { fatalRestore: Object.values(results).some(mustStopAfterResult), status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

const isMain = Boolean(process.argv[1]) && process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
