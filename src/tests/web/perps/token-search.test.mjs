import {connectPlatform} from '../../helpers/platform-session.mjs';
import {mustStopAfterResult} from '../../helpers/execution-policy.mjs';
// Token Search Tests (Web) — WEB-PERPS-SEARCH-001 ~ WEB-PERPS-SEARCH-008
// Thin wrapper: test logic lives in src/tests/shared/perps/token-search.mjs
// Connects via CDP port 9223 (Chrome) instead of 9222 (OneKey Electron).
//
// 弹窗结构（两级 tab，2026-05 之后）：
//   顶级 tab (y≈180): 自选 / 永续合约 / 现货
//   子级 tab (y≈227, 仅 永续合约 下): 全部 / 加密货币 / 股票 / 贵金属 / 指数 / 大宗商品 / 外汇 / 预上线
//   现货下无子级 tab，列：资产/最新价格/24h涨跌/成交量/市值（无资金费率）
//   现货行: "BTC/USDC"（带斜杠的 pair）；永续行: "BTC" + "40x" + "比特币"

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep } from '../../helpers/constants.mjs';
import { createPerpsTokenSearchTests } from '../../shared/perps/token-search.mjs';

const WEB_URL = process.env.WEB_URL || 'https://app.onekeytest.com';
const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'web-perps-search');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── CDP Connection (Web) ─────────────────────────────────────



async function connectWebCDP() { return connectPlatform('web'); }

async function screenshotWeb(page, dir, name) {
  try {
    const path = `${dir}/${name}.png`;
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
  await sleep(1500);
}

// ── Test Cases (from shared module) ──────────────────────────

export const platform = 'web';
export const displayName = '代币搜索';

const { testCases, setup, ensurePopoverOpen, dismissPopover, getPreReport } =
  createPerpsTokenSearchTests({
    prefix: 'WEB-PERPS-SEARCH',
    namePrefix: 'Web-',
    goToPerps,
    screenshot: screenshotWeb,
    screenshotDir: SCREENSHOT_DIR,
    tabLayout: 'two-level',
  });

export { testCases, setup };

// ── Main (CLI) ──────────────────────────────────────────────

export async function run() {
  const filters = process.argv.slice(2).filter(a => a.startsWith('WEB-PERPS-SEARCH-'));
  const casesToRun = filters.length ? testCases.filter(c => filters.includes(c.id)) : testCases;
  const filter = filters.join(', ');
  for (const id of filters) if (!testCases.some(c => c.id === id)) throw Error(`Unknown case ${id}`);

  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { browser, page } = await connectWebCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Token Search Tests (Web) — ${casesToRun.length} case(s)`);
  console.log('='.repeat(60));

  await setup(page);

  const preReport = getPreReport();
  if (!preReport?.canRun) {
    console.log('\n  Preconditions not met, aborting.');
    return { status: 'failed', error: 'preconditions_failed' };
  }

  const results = [];
  for (const test of casesToRun) {
    const startTime = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${test.id}] ${test.name}`);
    console.log('─'.repeat(60));

    if (preReport.shouldSkip(test.id)) {
      const r = { testId: test.id, status: 'skipped', duration: 0,
        reason: 'precondition warned', timestamp: new Date().toISOString() };
      console.log(`>> ${test.id}: SKIPPED (precondition)`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
      if(mustStopAfterResult(r)) { console.error('恢复失败，停止后续用例；剩余条目未执行'); break; }
      continue;
    }

    await ensurePopoverOpen(page);

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
        await screenshotWeb(page, SCREENSHOT_DIR, `${test.id}-error`);
      }
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
      if(mustStopAfterResult(r)) { console.error('恢复失败，停止后续用例；剩余条目未执行'); break; }
    }
  }

  await dismissPopover(page);

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${skipped} skipped, ${results.length} total`);
  console.log('='.repeat(60));

  const summary = { timestamp: new Date().toISOString(), total: results.length, passed, failed, skipped, results };
  writeFileSync(resolve(RESULTS_DIR, 'web-perps-search-summary.json'), JSON.stringify(summary, null, 2));

  return { fatalRestore: Object.values(results).some(mustStopAfterResult), status: failed === 0 ? 'passed' : 'failed', passed, failed, skipped, total: results.length };
}

const isMain = Boolean(process.argv[1]) && process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
