import {connectPlatform} from '../../helpers/platform-session.mjs';
import {mustStopAfterResult} from '../../helpers/execution-policy.mjs';
// Perps Portfolio & PnL Tests (Web) — WEB-PERPS-PNL-001 ~ WEB-PERPS-PNL-013
// Thin wrapper: test logic lives in src/tests/shared/perps/portfolio.mjs
// Connects via CDP port 9223 (Chrome) instead of 9222 (OneKey Electron).
//
// Note: Web 端账户切换尚未实现，多账户相关用例将以 SKIP 形式跳过：
//   - WEB-PERPS-PNL-001: empty/funded 切换 skip
//   - WEB-PERPS-PNL-005/006: 多账户 loop 全部 skip
//   - WEB-PERPS-PNL-007/008: 切换到 funded account 步骤 skip → 后续步骤短路返回

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep } from '../../helpers/constants.mjs';
import { createPortfolioTests } from '../../shared/perps/portfolio.mjs';

const WEB_URL = process.env.WEB_URL || 'https://app.onekeytest.com';
const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'web-perps-portfolio');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── CDP Connection (Web) ─────────────────────────────────────



async function connectWebCDP() { return connectPlatform('web'); }

async function screenshotWeb(page, name) {
  try {
    const path = `${SCREENSHOT_DIR}/${name}.png`;
    await page.screenshot({ path });
  } catch {}
}

// ── Platform-specific Navigation ─────────────────────────────

/** Navigate to perps page via web header "合约" button */
async function goToPerps(page) {
  const clicked = await page.evaluate(() => {
    const nav = document.querySelector('[data-testid="Header-Navigation"]');
    if (nav) {
      for (const el of nav.querySelectorAll('a, button, span, div')) {
        const text = el.textContent?.trim();
        if (['合约', 'Perps'].includes(text) && el.getBoundingClientRect().width > 0) {
          el.click(); return true;
        }
      }
    }
    for (const el of document.querySelectorAll('a, button, [role="tab"], [role="menuitem"]')) {
      const text = el.textContent?.trim();
      if (['合约', 'Perps'].includes(text)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.y < 80) {
          el.click(); return true;
        }
      }
    }
    for (const sp of document.querySelectorAll('span')) {
      const text = sp.textContent?.trim();
      if (['合约', 'Perps'].includes(text)) {
        const r = sp.getBoundingClientRect();
        if (r.width > 0 && r.y < 80) {
          sp.click(); return true;
        }
      }
    }
    return false;
  });
  if (!clicked) {
    await page.goto(`${WEB_URL}/swap`);
    await sleep(3000);
    const retry = await page.evaluate(() => {
      for (const el of document.querySelectorAll('a, button, span, div')) {
        const text = el.textContent?.trim();
        if (['合约', 'Perps'].includes(text)) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.y < 80) { el.click(); return true; }
        }
      }
      return false;
    });
    if (!retry) throw new Error('Cannot navigate to perps page (web)');
  }
  await sleep(3000);
}

// ── Account Switching (Web) — placeholder ────────────────────
// Web 端账户切换交互未实现；返回 skip 原因。

async function switchToFundedAccount(page) {
  await unlockWalletIfNeeded(page);
  await goToPerps(page);
  const text=await page.getByTestId('perp-portfolio-button').innerText();
  if(!/[1-9]/.test(text)) return 'SKIP: 当前账户缺少有资产的投资组合测试数据';
}

async function switchToWatchAccount(/* page, address, label */) {
  return 'SKIP: Web 端账户切换待实现';
}

// ── Test Cases (from shared module) ──────────────────────────

export const platform = 'web';
export const displayName = '投资组合';

const { testCases, setup, ALL_TEST_IDS } = createPortfolioTests({
  prefix: 'WEB-PERPS-PNL',
  namePrefix: 'Web-',
  screenshotDir: SCREENSHOT_DIR,
  goToPerps,
  switchToFundedAccount,
  switchToWatchAccount,
  accounts:[{label:'当前账户',isFunded:true}],
});

export { testCases, setup, ALL_TEST_IDS };

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('WEB-PERPS-PNL-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { browser, page } = await connectWebCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Perps Portfolio & PnL Tests (Web) — ${casesToRun.length} case(s)`);
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
        ({ browser, page } = await connectWebCDP());
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
        await screenshotWeb(page, `${test.id}-error`);
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
  writeFileSync(resolve(RESULTS_DIR, 'web-perps-portfolio-summary.json'), JSON.stringify(summary, null, 2));

  return { fatalRestore: Object.values(results).some(mustStopAfterResult), status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

const isMain = Boolean(process.argv[1]) && process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
