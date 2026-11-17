// PerpsPage — page-specific operations for Perps tab
// Pair selector uses TMPopover-ScrollView popover (same component as favorites)
// IMPORTANT (K-024): Always use querySelectorAll + find visible, not querySelector
import { clickSidebarTab, clickWithPointerEvents, dismissPopover } from '../components.mjs';
import { sleep } from '../constants.mjs';
import {currentPair,openPairs,searchPairs,closePairs,pairPopover,locator} from '../perps-ui.mjs';

/** Find the visible TMPopover inside page.evaluate. Inlined for use in evaluate(). */
const _findPop = `
  const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
  let _pop = null;
  for (const p of pops) { if (p.getBoundingClientRect().width > 0) { _pop = p; break; } }
`;

export class PerpsPage {
  constructor(page) { this.page = page; }

  setPage(page) { this.page = page; }

  async navigate() {
    await closePairs(this.page);
    await navigateToPerps(this.page);
  }

  /** Supports spot pairs, DEX names and digits through the stable selector. */
  async getCurrentPair() { return currentPair(this.page); }
  async openPairSelector() { await openPairs(this.page); }
  async isPairSelectorOpen() { return await pairPopover(this.page).count() > 0; }
  async ensurePairSelectorOpen() { await openPairs(this.page); }
  async dismissPairSelector() { await closePairs(this.page); }
  async searchPair(keyword) { await searchPairs(this.page,keyword); }
  async selectPair(symbol) {
    const pop=pairPopover(this.page);
    const row=pop.locator('[data-testid^="perp-token-selector-row-"]').filter({has: this.page.getByText(symbol,{exact:true})});
    if (await row.count()!==1) throw Error(`Expected unique pair ${symbol}, found ${await row.count()}`);
    await row.click();
    await pop.waitFor({state:'hidden',timeout:10000});
    const selected=await currentPair(this.page);
    if (!selected.includes(symbol)) throw Error(`Selected ${selected}, expected ${symbol}`);
  }
  async switchPair(symbol) {
    await openPairs(this.page);
    await this.clickPairTab('永续合约');
    await searchPairs(this.page,symbol);
    await this.selectPair(symbol);
  }

  /** Click a tab in the pair selector popover (自选/永续合约/加密货币/股票...). */
  async clickPairTab(tabName) {
    await this.ensurePairSelectorOpen();
    const clicked = await this.page.evaluate((txt) => {
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      for (const p of pops) {
        if (p.getBoundingClientRect().width === 0) continue;
        for (const sp of p.querySelectorAll('span')) {
          if (sp.textContent?.trim() === txt && sp.getBoundingClientRect().width > 0) {
            sp.click(); return true;
          }
        }
      }
      return false;
    }, tabName);
    if (!clicked) throw new Error(`Tab "${tabName}" not found`);
    await sleep(1000);
  }
}

export function perpsLandingSnapshot() {
    const visible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true});
    };
    const text = (document.body.innerText || '').replace(/\s+/g, ' ').trim();
    const selector = [...document.querySelectorAll('[data-testid="perp-token-selector"]')].find(visible);
    const currentPair = selector?.innerText.trim() || null;
    const visibleTestIds = [
      'perp-token-selector',
      'perp-portfolio-button',
      'perp-btn',
      'perp-deposit-button',
      'perp-holdings-empty-deposit-button',
    ].filter((id) => visible(document.querySelector(`[data-testid="${id}"]`)));
    const hasPerpsText = /图表|持有币种|统一|开仓|平仓|杠杆|永续合约/.test(text);
    return {
      currentPair,
      visibleTestIds,
      hasPerpsText,
      isPerps: !!currentPair || visibleTestIds.length > 0,
      text: text.slice(0, 500),
    };
}

export async function getPerpsLandingState(page) { return page.evaluate(perpsLandingSnapshot); }

async function waitForPerpsLanding(page, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  let lastState = null;
  while (Date.now() < deadline) {
    lastState = await getPerpsLandingState(page).catch(() => null);
    if (lastState?.isPerps) return lastState;
    await sleep(500);
  }
  return lastState;
}

async function clickPerpsSidebarTestId(page) {
  return page.evaluate(() => {
    const candidates = [
      '[data-testid="perp"]',
      '[data-testid="perps"]',
      '[data-testid="sidebarPerps"]',
    ];
    for (const selector of candidates) {
      const el = document.querySelector(selector);
      const r = el?.getBoundingClientRect();
      if (el && r && r.width > 0 && r.height > 0) {
        el.click();
        return { clicked: true, selector };
      }
    }
    const sidebar = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
    if (sidebar) {
      for (const el of sidebar.querySelectorAll('span, div, button')) {
        const txt = el.textContent?.trim();
        const r = el.getBoundingClientRect();
        if ((txt === 'Perps' || txt === '合约' || txt === '永续') && r.width > 0 && r.height > 0) {
          el.click();
          return { clicked: true, selector: `sidebar text ${txt}` };
        }
      }
    }
    return { clicked: false, selector: null };
  });
}

export async function navigateToPerps(page) {
  if (/^https?:/.test(page.url())) {
    const header=locator(page,'global.header.navigation');
    if(await header.count()) {
      const tab=header.getByText(/^(合约|Perps)$/).filter({visible:true});
      if(await tab.count()!==1) throw Error('Expected one Web Perps navigation entry');
      await tab.click();
      const landing=await waitForPerpsLanding(page);
      if(!landing?.isPerps) throw Error('Web Perps navigation did not reach trading page');
      return landing;
    }
  }
  await clickSidebarTab(page, 'Perps').catch(() => {});
  let state = await waitForPerpsLanding(page, 6000);
  if (state?.isPerps) return state;

  const direct = await clickPerpsSidebarTestId(page);
  if (direct.clicked) {
    await sleep(1000);
    state = await waitForPerpsLanding(page, 8000);
    if (state?.isPerps) return state;
  }

  throw new Error(`Cannot navigate to Perps page: ${state?.text || 'no page text'}${direct.clicked ? ` (fallback=${direct.selector})` : ' (fallback not found)'}`);
}
