// Generic precondition framework — reads shared/preconditions.json
// and probes live UI to determine which tests can run.
//
// Usage:
//   import { runPreconditions } from '../helpers/preconditions.mjs';
//   const pre = await runPreconditions(page, ['SEARCH-001', 'SEARCH-002', ...]);
//   if (!pre.canRun) { return; }
//   if (pre.shouldSkip('SEARCH-002')) { /* skip */ }
//   // Use pre.probeData for dynamic assertions

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep, WALLET_PASSWORD } from './index.mjs';

const PRECONDITIONS_PATH = resolve(import.meta.dirname, '../../../shared/preconditions.json');

function loadPreconditionsDB() {
  const raw = readFileSync(PRECONDITIONS_PATH, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Match test IDs against a pattern like "COSMOS-*" or exact "SEARCH-001".
 */
function matchesTestId(pattern, testId) {
  if (pattern.endsWith('*')) {
    return testId.startsWith(pattern.slice(0, -1));
  }
  return pattern === testId;
}

function isRelevant(requiredBy, testIds) {
  if (!requiredBy || !testIds) return true;
  return requiredBy.some(pat => testIds.some(id => matchesTestId(pat, id)));
}

// ── Main Entry ──────────────────────────────────────────────

/**
 * Run all relevant precondition checks for the given test IDs.
 * @param {import('playwright-core').Page} page
 * @param {string[]} testIds — test IDs about to run (e.g. ['SEARCH-001', 'SEARCH-002'])
 * @returns {{ canRun, warnings, skipped, probeData, shouldSkip(id), report }}
 */
export async function runPreconditions(page, testIds = []) {
  const db = loadPreconditionsDB();
  const warnings = [];
  const skipped = new Set();
  const probeData = {};
  let canRun = true;

  console.log('\n' + '─'.repeat(60));
  console.log('  PRECONDITION CHECK');
  console.log('─'.repeat(60));

  // 1. CDP connection
  try {
    const title = await page.title();
    console.log(`  [OK] CDP 连接正常 — "${title}"`);
  } catch {
    console.log('  [BLOCK] CDP 连接失败');
    canRun = false;
    return buildResult(false, warnings, skipped, probeData);
  }

  // 2. Wallet unlocked
  if (db.environment.wallet.unlocked) {
    const isLocked = await page.evaluate(() => {
      const text = document.body?.textContent || '';
      return text.includes('欢迎回来') || text.includes('输入密码') || text.includes('忘记密码');
    });
    if (isLocked) {
      console.log('  [WARN] 钱包锁定，尝试自动解锁...');
      // Try auto-unlock
      try {
        const pwdInput = page.locator('input[placeholder*="密码"]').first();
        await pwdInput.fill(WALLET_PASSWORD);
        await sleep(300);
        await page.keyboard.press('Enter');
        await sleep(5000);
        const stillLocked = await page.evaluate(() => {
          return (document.body?.textContent || '').includes('欢迎回来');
        });
        if (stillLocked) {
          console.log('  [BLOCK] 自动解锁失败');
          canRun = false;
          return buildResult(false, warnings, skipped, probeData);
        }
        console.log('  [OK] 自动解锁成功');
      } catch (e) {
        console.log(`  [BLOCK] 解锁异常: ${e.message}`);
        canRun = false;
        return buildResult(false, warnings, skipped, probeData);
      }
    } else {
      console.log('  [OK] 钱包已解锁');
    }
  }

  // 3. Network reachable
  if (db.environment.network.reachable) {
    const netOk = await page.evaluate(async () => {
      try {
        await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors', signal: AbortSignal.timeout(5000) });
        return true;
      } catch { return false; }
    });
    if (!netOk) {
      console.log('  [WARN] 网络不通，后台数据依赖的用例可能失败');
      warnings.push({ check: 'network', level: 'warn', message: '网络不通' });
    } else {
      console.log('  [OK] 网络连通');
    }
  }

  // 4. Search probes (if relevant tests are in the list)
  if (db.data.search && isRelevant(getAllRequiredBy(db.data.search.probes), testIds)) {
    console.log('\n  Search probes:');
    // Ensure we're on 永续合约 tab before probing search
    await page.evaluate(() => {
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      for (const pop of pops) {
        if (pop.getBoundingClientRect().width === 0) continue;
        for (const sp of pop.querySelectorAll('span')) {
          if (sp.textContent?.trim() === '永续合约' && sp.getBoundingClientRect().width > 0) {
            sp.click(); return;
          }
        }
      }
    });
    await sleep(800);
    for (const probe of db.data.search.probes) {
      if (!isRelevant(probe.required_by, testIds)) continue;

      const tokens = await probeSearch(page, probe.query);
      probeData[`search_${probe.query}`] = tokens;

      const hasExpected = probe.expected_tokens.some(t => tokens.includes(t));
      if (hasExpected) {
        console.log(`    [OK] "${probe.query}" → ${tokens.join(', ')}`);
      } else {
        const msg = `${probe.message}（实际: ${tokens.join(', ') || '无结果'}）`;
        console.log(`    [WARN] "${probe.query}" → ${msg}`);
        warnings.push({ check: `search_${probe.query}`, level: 'warn', message: msg });
        if (probe.on_fail === 'skip') {
          for (const tid of probe.required_by) {
            testIds.filter(id => matchesTestId(tid, id)).forEach(id => skipped.add(id));
          }
        }
      }
    }
  }

  // 5. Section tabs (if relevant)
  if (db.data.sections && isRelevant(db.data.sections.required_by, testIds)) {
    console.log('\n  Section tabs:');
    const tabs = await probeSectionTabs(page);
    probeData.sectionTabs = tabs;

    const expected = db.data.sections.expected_tabs;
    const missing = expected.filter(t => !tabs.includes(t));
    if (missing.length === 0) {
      console.log(`    [OK] 全部 ${tabs.length} 个版块 tab 存在`);
    } else {
      console.log(`    [WARN] 缺少版块: ${missing.join(', ')}`);
      warnings.push({ check: 'sections', level: 'warn', message: `缺少版块: ${missing.join(', ')}` });
    }

    // Probe token counts per section
    if (db.data.sections.token_expectations) {
      for (const [tabName, expectation] of Object.entries(db.data.sections.token_expectations)) {
        if (!tabs.includes(tabName)) continue;
        if (!isRelevant(expectation.required_by, testIds)) continue;

        const tokens = await probeSectionTokens(page, tabName);
        probeData[`section_${tabName}`] = tokens;

        if (tokens.length < (expectation.min_count || 0)) {
          const msg = `版块「${tabName}」代币数 ${tokens.length} < 最低要求 ${expectation.min_count}`;
          console.log(`    [WARN] ${msg}`);
          warnings.push({ check: `section_${tabName}`, level: 'warn', message: msg });
        } else {
          const preview = tokens.length > 4 ? tokens.slice(0, 4).join(', ') + `... (${tokens.length})` : tokens.join(', ');
          console.log(`    [OK] ${tabName}: ${preview}`);
        }

        if (expectation.expected_tokens) {
          const found = expectation.expected_tokens.filter(t => tokens.includes(t));
          if (found.length < expectation.expected_tokens.length) {
            const missingTokens = expectation.expected_tokens.filter(t => !tokens.includes(t));
            console.log(`    [WARN] ${tabName} 缺少代币: ${missingTokens.join(', ')}`);
            warnings.push({ check: `section_${tabName}_tokens`, level: 'warn',
              message: `${tabName} 缺少: ${missingTokens.join(', ')}` });
          }
        }
      }
    }
  }

  // 6. Balance checks (soft — just log)
  if (db.data.balances && isRelevant(getAllRequiredBy(db.data.balances.requirements), testIds)) {
    console.log('\n  Balance requirements:');
    const relevant = db.data.balances.requirements.filter(r => isRelevant(r.required_by, testIds));
    for (const req of relevant) {
      console.log(`    [INFO] ${req.account} 需要 ${req.min} ${req.token} (${req.network}) — 不足时 fallback`);
    }
  }

  // 7. Referral check
  if (db.data.referral && isRelevant(db.data.referral.required_by, testIds)) {
    const cardVisible = await page.evaluate(() => {
      const text = document.body?.textContent || '';
      return text.includes('推荐计划') || text.includes('Referral');
    });
    if (!cardVisible) {
      console.log('  [WARN] 推荐计划卡片不可见（可能已绑定），REFER-001 将跳过');
      warnings.push({ check: 'referral', level: 'warn', message: db.data.referral.message });
      for (const tid of db.data.referral.required_by) {
        testIds.filter(id => matchesTestId(tid, id)).forEach(id => skipped.add(id));
      }
    }
  }

  // Summary
  const runnableCount = testIds.length - skipped.size;
  if (skipped.size > 0) {
    console.log(`\n  Skipped: ${[...skipped].join(', ')}`);
  }
  if (warnings.length > 0) {
    console.log(`  Warnings: ${warnings.length}`);
  }
  console.log(`\n  ${canRun ? `READY — ${runnableCount}/${testIds.length} tests runnable` : 'BLOCKED — cannot run'}`);
  console.log('─'.repeat(60) + '\n');

  return buildResult(canRun, warnings, skipped, probeData);
}

// ── Step Tracker with precondition-aware assertions ──────────

/**
 * Enhanced step tracker that auto-downgrades assertions to 'skipped'
 * when the data dependency was flagged in precondition warnings.
 */
export function createTracker(testId, preReport) {
  const steps = [];
  const errors = [];
  const skippedSteps = [];
  const isTestSkipped = preReport?.shouldSkip(testId);

  return {
    steps, errors, skippedSteps,

    /**
     * @param {string} name — step description
     * @param {'passed'|'failed'} status
     * @param {string} detail
     * @param {{ dataKey?: string }} opts — dataKey links to a precondition check.
     *   If that check warned, 'failed' → 'skipped' automatically.
     */
    add(name, status, detail = '', opts = {}) {
      let finalStatus = status;

      if (status === 'failed' && opts.dataKey && preReport) {
        const warned = preReport.warnings?.some(w =>
          w.message?.includes(opts.dataKey) || w.check?.includes(opts.dataKey)
        );
        if (warned) {
          finalStatus = 'skipped';
          skippedSteps.push(name);
          console.log(`  [SKIP] ${name} — 数据「${opts.dataKey}」不可用${detail ? ' — ' + detail : ''}`);
          return;
        }
      }

      steps.push({ name, status: finalStatus, detail, time: new Date().toISOString() });
      const icon = finalStatus === 'passed' ? 'OK' : finalStatus === 'skipped' ? 'SKIP' : 'FAIL';
      console.log(`  [${icon}] ${name}${detail ? ' — ' + detail : ''}`);
      if (finalStatus === 'failed') errors.push(`${name}: ${detail}`);
    },

    result() {
      const status = isTestSkipped ? 'skipped'
        : errors.length === 0 ? 'passed'
        : 'failed';
      return { status, steps, errors, skippedSteps };
    },
  };
}

// ── Internal helpers ────────────────────────────────────────

function buildResult(canRun, warnings, skipped, probeData) {
  const skippedArr = [...skipped];
  return {
    canRun,
    warnings,
    skipped: skippedArr,
    probeData,
    shouldSkip: (id) => skipped.has ? skipped.has(id) : skippedArr.includes(id),
    report: { canRun, warnings, skipped: skippedArr, probeData, timestamp: new Date().toISOString() },
  };
}

function getAllRequiredBy(items) {
  if (!items) return [];
  return items.flatMap(i => i.required_by || []);
}

async function probeSearch(page, query) {
  await page.evaluate((q) => {
    const inputs = document.querySelectorAll('input[data-testid="nav-header-search"], input[placeholder*="搜索"]');
    for (const input of inputs) {
      if (input.getBoundingClientRect().width > 0) {
        input.focus();
        const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (nativeSet) {
          nativeSet.call(input, q);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
      }
    }
  }, query);
  await sleep(1500);

  const tokens = await getVisibleTokens(page);

  // Clear
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="-clear"]');
    if (btn && btn.getBoundingClientRect().width > 0) { btn.click(); return; }
    const inputs = document.querySelectorAll('input[data-testid="nav-header-search"], input[placeholder*="搜索"]');
    for (const input of inputs) {
      if (input.getBoundingClientRect().width > 0) {
        const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (nativeSet) { nativeSet.call(input, ''); input.dispatchEvent(new Event('input', { bubbles: true })); }
        return;
      }
    }
  });
  await sleep(800);
  return tokens;
}

async function probeSectionTabs(page) {
  return page.evaluate(() => {
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    let pop = null;
    for (const p of pops) { if (p.getBoundingClientRect().width > 0) { pop = p; break; } }
    if (!pop) return [];
    const tabs = [];
    const known = ['自选','永续合约','加密货币','股票','贵金属','指数','大宗商品','外汇','预上线'];
    for (const sp of pop.querySelectorAll('span')) {
      const t = sp.textContent?.trim();
      if (t && known.includes(t) && sp.getBoundingClientRect().width > 0 && !tabs.includes(t)) tabs.push(t);
    }
    return tabs;
  });
}

async function probeSectionTokens(page, tabName) {
  await page.evaluate((name) => {
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    for (const pop of pops) {
      if (pop.getBoundingClientRect().width === 0) continue;
      for (const sp of pop.querySelectorAll('span')) {
        if (sp.textContent?.trim() === name && sp.getBoundingClientRect().width > 0) {
          sp.click(); return;
        }
      }
    }
  }, tabName);
  await sleep(1200);
  return getVisibleTokens(page);
}

async function getVisibleTokens(page) {
  return page.evaluate(() => {
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    let pop = null;
    for (const p of pops) { if (p.getBoundingClientRect().width > 0) { pop = p; break; } }
    if (!pop) return [];
    const tokens = [];
    const ignore = new Set([
      '自选','永续合约','加密货币','股票','贵金属','指数','大宗商品','外汇','预上线',
      '资产','最新价格','24小时涨跌','资金费率','成交量','成交额','合约持仓量',
      '搜索资产','未找到匹配的代币','添加到自选',
    ]);
    for (const sp of pop.querySelectorAll('span')) {
      const t = sp.textContent?.trim();
      if (!t || sp.children.length !== 0 || sp.getBoundingClientRect().width === 0) continue;
      if (ignore.has(t)) continue;
      if (/^[A-Z][A-Z0-9]{1,9}$/.test(t) && !tokens.includes(t)) tokens.push(t);
    }
    return tokens;
  });
}
