// Market Home Tests (Desktop) — MARKET-HOME-001 ~ MARKET-HOME-006
// Generated from confirmed recording flow (2026-03-23)

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
} from '../../helpers/index.mjs';
import { createStepTracker, safeStep } from '../../helpers/market-search.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'market-home');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function goToMarket(page) {
  const ok = await page.evaluate(() => {
    const direct = document.querySelector('[data-testid="tab-modal-no-active-item-TradingViewCandlesOutline"]');
    if (direct) {
      const r = direct.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        direct.click();
        return true;
      }
    }

    const sidebar = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
    if (!sidebar) return false;
    const labels = new Set(['Market', '市场', 'マーケット', 'Mercado']);
    for (const sp of sidebar.querySelectorAll('span')) {
      const txt = sp.textContent?.trim();
      if (!txt || !labels.has(txt)) continue;
      const r = sp.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        sp.click();
        return true;
      }
    }
    return false;
  });
  if (!ok) throw new Error('Cannot navigate to Market');
  await sleep(1800);
}

async function clickMainTab(page, tabName) {
  const clicked = await page.evaluate((name) => {
    for (const el of document.querySelectorAll('span')) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() !== name) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.y > 130 && r.y < 210) {
        el.click();
        return true;
      }
    }
    return false;
  }, tabName);
  if (!clicked) throw new Error(`Cannot click main tab "${tabName}"`);
  await sleep(1200);
}

async function clickChipByText(page, text) {
  const clicked = await page.evaluate((v) => {
    for (const el of document.querySelectorAll('span, button, div')) {
      if (el.children.length > 2) continue;
      if (el.textContent?.trim() !== v) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.y > 190 && r.y < 320) {
        el.scrollIntoView({ inline: 'center', block: 'nearest' });
        el.click();
        return true;
      }
    }
    return false;
  }, text);
  if (!clicked) throw new Error(`Cannot click chip "${text}"`);
  await sleep(1200);
}

async function findAndClickAnyTradableRow(page) {
  const clicked = await page.evaluate(() => {
    const rows = document.querySelectorAll('[data-testid="list-column-price"], [data-testid="list-column-name"], [role="row"], tr, div');
    for (const row of rows) {
      const r = row.getBoundingClientRect();
      if (r.width < 80 || r.height < 24 || r.y < 240) continue;
      const txt = row.textContent?.trim() || '';
      if (!txt) continue;
      if (txt.includes('$') || txt.includes('%')) {
        row.click();
        return true;
      }
    }
    return false;
  });
  if (!clicked) throw new Error('Cannot click any market list row');
  await sleep(1800);
}

async function clickBack(page) {
  const btn = page.locator('[data-testid="nav-header-back"]').first();
  const visible = await btn.isVisible({ timeout: 3000 }).catch(() => false);
  if (visible) {
    await btn.click();
    await sleep(1200);
    return;
  }
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(800);
}

async function hasHomeCoreBlocks(page) {
  return page.evaluate(() => {
    const text = document.body.textContent || '';
    const hasSearch = !!document.querySelector('[data-testid="nav-header-search"], input[placeholder*="搜索"], input[placeholder*="Search"]');
    const hasTabs = ['自选', '现货', '合约'].every(t => text.includes(t));
    const hasListSignals = !!document.querySelector('[data-testid="list-column-price"], [data-testid="list-column-name"]')
      || /\$[\d,.]+/.test(text);
    return hasSearch && hasTabs && hasListSignals;
  });
}

async function captureSpotStat(page) {
  return page.evaluate(() => {
    const text = document.body.textContent || '';
    const m = text.match(/\$[\d,.]+/g) || [];
    return { priceCount: m.length, head: m.slice(0, 5).join('|') };
  });
}

async function captureVisibleMarketSignature(page) {
  return page.evaluate(() => {
    // Prefer structured cells first; fall back to broad money/percent tokens.
    const priceCells = [];
    for (const el of document.querySelectorAll('[data-testid="list-column-price"]')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.y > 220) {
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (t) priceCells.push(t);
      }
    }

    const pctTokens = [];
    for (const el of document.querySelectorAll('span, div')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.y < 220) continue;
      const t = (el.textContent || '').trim();
      if (/^[+-]?\d+(\.\d+)?%$/.test(t)) pctTokens.push(t);
      if (pctTokens.length >= 20) break;
    }

    const fallbackText = document.body.textContent || '';
    const money = fallbackText.match(/\$[\d,.]+/g) || [];

    return {
      prices: priceCells.slice(0, 20),
      pcts: pctTokens.slice(0, 20),
      moneyHead: money.slice(0, 20),
    };
  });
}

function buildSignature(snapshot) {
  return JSON.stringify({
    prices: snapshot.prices,
    pcts: snapshot.pcts,
    moneyHead: snapshot.moneyHead,
  });
}

async function waitForMarketDataUpdate(page, totalMs = 30000, intervalMs = 3000) {
  const first = await captureVisibleMarketSignature(page);
  const baseSig = buildSignature(first);
  const attempts = Math.max(1, Math.floor(totalMs / intervalMs));
  const series = [baseSig];

  for (let i = 0; i < attempts; i++) {
    await sleep(intervalMs);
    const snap = await captureVisibleMarketSignature(page);
    const sig = buildSignature(snap);
    series.push(sig);
    if (sig !== baseSig) {
      return {
        changed: true,
        checked: i + 1,
        before: first,
        after: snap,
      };
    }
  }

  return {
    changed: false,
    checked: attempts,
    before: first,
    after: first,
    stableCount: new Set(series).size,
  };
}

async function observeMarketDomMutations(page, totalMs = 30000) {
  return page.evaluate(async (ms) => {
    const pickRoot = () => {
      const priceCell = document.querySelector('[data-testid="list-column-price"]');
      if (priceCell) {
        let p = priceCell.parentElement;
        for (let i = 0; i < 8; i++) {
          if (!p) break;
          const r = p.getBoundingClientRect();
          if (r.width > 400 && r.height > 250 && r.y < 260) return p;
          p = p.parentElement;
        }
      }
      return document.body;
    };

    const root = pickRoot();
    let mutationCount = 0;
    let textMutationCount = 0;

    const obs = new MutationObserver((records) => {
      mutationCount += records.length;
      for (const rec of records) {
        if (rec.type === 'characterData') {
          const text = (rec.target?.textContent || '').trim();
          if (text) textMutationCount++;
          continue;
        }
        if (rec.type === 'childList') {
          const changedText = [
            ...Array.from(rec.addedNodes || []),
            ...Array.from(rec.removedNodes || []),
          ].some((n) => {
            const t = (n.textContent || '').trim();
            return !!t;
          });
          if (changedText) textMutationCount++;
        }
      }
    });

    obs.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    await new Promise((resolve) => setTimeout(resolve, ms));
    obs.disconnect();

    return { mutationCount, textMutationCount };
  }, totalMs);
}

const _safeStep = (page, t, name, fn) =>
  safeStep(page, t, name, fn, (p, n) => screenshot(p, SCREENSHOT_DIR, n));

async function testMarketHome001(page) {
  const t = createStepTracker('MARKET-HOME-001');
  await goToMarket(page);

  await _safeStep(page, t, '进入 Market 首页并校验基础布局', async () => {
    const ok = await hasHomeCoreBlocks(page);
    if (!ok) throw new Error('Home core blocks missing');
    return 'search/tabs/list all detected';
  });

  await _safeStep(page, t, '左侧市场入口可点击且页面保持可用', async () => {
    await goToMarket(page);
    const ok = await hasHomeCoreBlocks(page);
    if (!ok) throw new Error('Market page not stable after re-enter');
    return 'market sidebar entry works';
  });

  return t.result();
}

async function testMarketHome002(page) {
  const t = createStepTracker('MARKET-HOME-002');
  await goToMarket(page);

  await _safeStep(page, t, '主标签切换 自选->现货->合约->自选', async () => {
    for (const tab of ['自选', '现货', '合约', '自选']) {
      await clickMainTab(page, tab);
    }
    return 'tab sequence completed';
  });

  return t.result();
}

async function testMarketHome003(page) {
  const t = createStepTracker('MARKET-HOME-003');
  await goToMarket(page);
  await clickMainTab(page, '现货');

  await _safeStep(page, t, '现货网络筛选 All Networks -> BNB Chain -> Ethereum', async () => {
    await clickChipByText(page, 'All Networks');
    await clickChipByText(page, 'BNB Chain');
    await clickChipByText(page, 'Ethereum');
    return 'spot network chips clicked';
  });

  return t.result();
}

async function testMarketHome004(page) {
  const t = createStepTracker('MARKET-HOME-004');
  await goToMarket(page);

  await _safeStep(page, t, '合约二级筛选 加密货币->股票->加密货币', async () => {
    await clickMainTab(page, '合约');
    await clickChipByText(page, '加密货币');
    await clickChipByText(page, '股票');
    await clickChipByText(page, '加密货币');
    return 'perp sub-filters switched';
  });

  return t.result();
}

async function testMarketHome005(page) {
  const t = createStepTracker('MARKET-HOME-005');
  await goToMarket(page);
  await clickMainTab(page, '现货');

  await _safeStep(page, t, '列表点击进入详情并返回', async () => {
    await findAndClickAnyTradableRow(page);
    await clickBack(page);
    const ok = await hasHomeCoreBlocks(page);
    if (!ok) throw new Error('Failed to return market home');
    return 'detail navigation round-trip ok';
  });

  return t.result();
}

async function testMarketHome006(page) {
  const t = createStepTracker('MARKET-HOME-006');
  await goToMarket(page);
  await clickMainTab(page, '现货');

  await _safeStep(page, t, '观察实时数据刷新（30s）', async () => {
    const baseline = await captureSpotStat(page);
    // Run value-diff probe and DOM mutation probe in the same 30s window.
    const [probe, domProbe] = await Promise.all([
      waitForMarketDataUpdate(page, 30000, 3000),
      observeMarketDomMutations(page, 30000),
    ]);

    const hasValueChange = probe.changed;
    const hasDomRefresh = domProbe.textMutationCount > 0 || domProbe.mutationCount > 0;
    if (!hasValueChange && !hasDomRefresh) {
      throw new Error(
        `No visible market update detected in 30s (samples=${probe.checked}, domMut=${domProbe.mutationCount})`,
      );
    }
    const after = await captureSpotStat(page);
    return `valueChanged=${hasValueChange}, domMut=${domProbe.mutationCount}, textMut=${domProbe.textMutationCount}, moneyHead=${baseline.head} -> ${after.head}`;
  });

  return t.result();
}

export const testCases = [
  { id: 'MARKET-HOME-001', name: 'Market-首页-入口与布局', fn: testMarketHome001 },
  { id: 'MARKET-HOME-002', name: 'Market-首页-主标签切换', fn: testMarketHome002 },
  { id: 'MARKET-HOME-003', name: 'Market-首页-现货网络筛选', fn: testMarketHome003 },
  { id: 'MARKET-HOME-004', name: 'Market-首页-合约二级筛选', fn: testMarketHome004 },
  { id: 'MARKET-HOME-005', name: 'Market-首页-列表详情跳转返回', fn: testMarketHome005 },
  { id: 'MARKET-HOME-006', name: 'Market-首页-实时更新观察', fn: testMarketHome006 },
];

export async function setup(page) {
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
  await goToMarket(page);
}

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('MARKET-HOME-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { page } = await connectCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Market Home Tests (Desktop) — ${casesToRun.length} case(s)`);
  console.log('='.repeat(60));

  const results = [];
  await setup(page);

  for (const test of casesToRun) {
    const startTime = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${test.id}] ${test.name}`);
    console.log('─'.repeat(60));

    try {
      if (page?.isClosed?.()) {
        ({ page } = await connectCDP());
        await setup(page);
      }
      const result = await test.fn(page);
      const duration = Date.now() - startTime;
      const r = {
        testId: test.id,
        status: result.status,
        duration,
        steps: result.steps,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      };
      console.log(`>> ${test.id}: ${r.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s)`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    } catch (error) {
      const duration = Date.now() - startTime;
      const r = {
        testId: test.id,
        status: 'failed',
        duration,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
      console.error(`>> ${test.id}: FAILED (${(duration / 1000).toFixed(1)}s) — ${error.message}`);
      if (page && !page?.isClosed?.()) {
        await screenshot(page, SCREENSHOT_DIR, `${test.id}-error`);
      }
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }

    try { if (page && !page?.isClosed?.()) await dismissOverlays(page); } catch {}
    await sleep(700);
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;
  const summary = { timestamp: new Date().toISOString(), total: results.length, passed, failed, results };
  writeFileSync(resolve(RESULTS_DIR, 'market-home-summary.json'), JSON.stringify(summary, null, 2));

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
