// PerpsPage — page-specific operations for Perps tab
// Pair selector uses TMPopover-ScrollView popover (same component as favorites)
// IMPORTANT (K-024): Always use querySelectorAll + find visible, not querySelector
import { clickSidebarTab, clickWithPointerEvents, dismissPopover } from '../components.mjs';
import { sleep } from '../constants.mjs';

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
    await clickSidebarTab(this.page, 'Perps');
  }

  /** Get current trading pair (e.g., "ETHUSDC" or "BTCUSDC"). */
  async getCurrentPair() {
    return this.page.evaluate(() => {
      for (const sp of document.querySelectorAll('span')) {
        const text = sp.textContent?.trim();
        // Match XXXUSDC format (Perps uses USDC as quote)
        if (text && /^[A-Z]{2,10}USDC$/.test(text) && sp.children.length === 0) {
          const r = sp.getBoundingClientRect();
          if (r.width > 50 && r.height > 20) return text;
        }
      }
      return null;
    });
  }

  /** Open the pair selector popover by clicking the current pair name. */
  async openPairSelector() {
    const pair = await this.getCurrentPair();
    if (!pair) throw new Error('Cannot detect current pair');
    await this.page.evaluate((p) => {
      for (const sp of document.querySelectorAll('span')) {
        if (sp.textContent?.trim() === p && sp.getBoundingClientRect().width > 50) {
          sp.click(); return;
        }
      }
    }, pair);
    await sleep(1500);
  }

  /** Check if the pair selector popover is open. */
  async isPairSelectorOpen() {
    return this.page.evaluate(() => {
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      for (const p of pops) { if (p.getBoundingClientRect().width > 0) return true; }
      return false;
    });
  }

  /** Ensure pair selector is open. */
  async ensurePairSelectorOpen() {
    if (!(await this.isPairSelectorOpen())) {
      await this.openPairSelector();
    }
  }

  /** Dismiss the pair selector popover. */
  async dismissPairSelector() {
    await dismissPopover(this.page);
  }

  /** Search for a pair in the popover. Opens popover if needed. */
  async searchPair(keyword) {
    await this.ensurePairSelectorOpen();
    // Use nativeInputValueSetter for React compatibility inside popover
    await this.page.evaluate((q) => {
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      let input = null;
      for (const pop of pops) {
        if (pop.getBoundingClientRect().width === 0) continue;
        const inp = pop.querySelector('input[data-testid="nav-header-search"]')
          || pop.querySelector('input[placeholder*="搜索"]');
        if (inp && inp.getBoundingClientRect().width > 0) { input = inp; break; }
      }
      if (!input) throw new Error('Search input not found in pair selector');
      input.focus();
      const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (nativeSet) {
        nativeSet.call(input, q);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, keyword);
    await sleep(1000);
  }

  /**
   * Select a pair from the popover list by clicking it.
   * @param {string} symbol — e.g., "BTC", "ETH". Matches span text in popover.
   */
  async selectPair(symbol) {
    await this.ensurePairSelectorOpen();
    const clicked = await this.page.evaluate((sym) => {
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      for (const pop of pops) {
        if (pop.getBoundingClientRect().width === 0) continue;
        // Find the row containing the symbol and click it
        for (const el of pop.querySelectorAll('span, div')) {
          const text = el.textContent?.trim();
          const r = el.getBoundingClientRect();
          if (text === sym && r.width > 0 && r.height > 10 && r.height < 30 && el.children.length === 0) {
            // Click the parent row for better hit area
            const row = el.closest('[class]');
            if (row && row.getBoundingClientRect().height > 20) { row.click(); return true; }
            el.click(); return true;
          }
        }
      }
      return false;
    }, symbol);
    if (!clicked) throw new Error(`Pair "${symbol}" not found in selector`);
    await sleep(2000);
  }

  /**
   * Switch to a different trading pair.
   * Opens selector → searches pair → clicks it → waits for chart reload.
   * Uses search to find pairs not visible in initial list.
   * @param {string} symbol — e.g., "BTC", "ETH", "ENA"
   */
  async switchPair(symbol) {
    // First try direct select (for common pairs visible in list)
    await this.openPairSelector();
    await sleep(500);

    // Ensure "永续合约" tab is selected (search only works within current tab)
    await this.page.evaluate(() => {
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
    await sleep(500);

    const directClick = await this.page.evaluate((sym) => {
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      for (const pop of pops) {
        if (pop.getBoundingClientRect().width === 0) continue;
        for (const el of pop.querySelectorAll('span')) {
          const text = el.textContent?.trim();
          const r = el.getBoundingClientRect();
          if (text === sym && r.width > 0 && r.height > 10 && r.height < 30 && el.children.length === 0) {
            const row = el.closest('[class]');
            if (row && row.getBoundingClientRect().height > 20) { row.click(); return true; }
            el.click(); return true;
          }
        }
      }
      return false;
    }, symbol);

    if (!directClick) {
      // Not in visible list — use search
      await this.searchPair(symbol);
      await sleep(1000);
      const searchClick = await this.page.evaluate((sym) => {
        const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
        for (const pop of pops) {
          if (pop.getBoundingClientRect().width === 0) continue;
          for (const el of pop.querySelectorAll('span, div')) {
            const text = el.textContent?.trim();
            const r = el.getBoundingClientRect();
            if (text && text.includes(sym) && r.width > 0 && r.height > 15 && r.height < 50 && el.children.length < 3) {
              const row = el.closest('[class]');
              if (row && row.getBoundingClientRect().height > 20) { row.click(); return true; }
              el.click(); return true;
            }
          }
        }
        return false;
      }, symbol);
      if (!searchClick) throw new Error(`Pair "${symbol}" not found even after search`);
    }

    await sleep(2000);
    // Verify pair changed
    const newPair = await this.getCurrentPair();
    if (newPair && !newPair.startsWith(symbol)) {
      throw new Error(`Expected pair to start with ${symbol}, got ${newPair}`);
    }
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
