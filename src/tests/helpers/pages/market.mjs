// MarketPage — page-specific operations for Market tab
import { clickSidebarTab, openSearchModal, typeSearch, clearSearch, closeSearch } from '../components.mjs';
import { registry } from '../ui-registry.mjs';
import { sleep } from '../constants.mjs';

export class MarketPage {
  constructor(page) { this.page = page; }

  setPage(page) { this.page = page; }

  async navigate() {
    await clickSidebarTab(this.page, 'Market');
  }

  async openSearch() {
    await openSearchModal(this.page);
  }

  async typeSearch(value) {
    await typeSearch(this.page, value);
  }

  async clearSearch() {
    await clearSearch(this.page);
  }

  async closeSearch() {
    await closeSearch(this.page);
  }

  async switchFilter(network) {
    const clicked = await this.page.evaluate((name) => {
      const filters = document.querySelectorAll('button, [role="tab"]');
      for (const el of filters) {
        const r = el.getBoundingClientRect();
        if (r.y < 50 || r.y > 250 || r.width === 0) continue;
        if (el.textContent?.trim().includes(name)) {
          el.click();
          return true;
        }
      }
      return false;
    }, network);
    if (!clicked) throw new Error(`Filter "${network}" not found`);
    await sleep(1500);
  }

  async clickTokenRow(index) {
    const clicked = await this.page.evaluate((idx) => {
      const rows = document.querySelectorAll('[data-testid="list-column-name"]');
      let visibleIdx = 0;
      for (const row of rows) {
        const r = row.getBoundingClientRect();
        if (r.width > 0 && r.height > 30 && r.y > 200) {
          if (visibleIdx === idx) { row.click(); return true; }
          visibleIdx++;
        }
      }
      return false;
    }, index);
    if (!clicked) throw new Error(`Token row ${index} not found`);
    await sleep(1500);
  }

  async getTokenList() {
    return this.page.evaluate(() => {
      const cells = document.querySelectorAll('[data-testid="list-column-name"]');
      const names = [];
      cells.forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 30 && r.y > 200) {
          const text = el.textContent?.trim();
          if (text) names.push(text);
        }
      });
      return names;
    });
  }

  async switchTab(name) {
    const clicked = await this.page.evaluate((tabName) => {
      const candidates = document.querySelectorAll('button, span, [role="tab"]');
      for (const el of candidates) {
        const txt = el.textContent?.trim();
        const r = el.getBoundingClientRect();
        if (txt === tabName && r.width > 0 && r.height > 0 && r.y > 50 && r.y < 250) {
          el.click();
          return true;
        }
      }
      return false;
    }, name);
    if (!clicked) throw new Error(`Tab "${name}" not found`);
    await sleep(1500);
  }

  async snapshotWatchlistCount() {
    await this.switchTab('自选');
    return this.page.evaluate(() => {
      const nameCells = document.querySelectorAll('[data-testid="list-column-name"]');
      let count = 0;
      nameCells.forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 30 && r.y > 200) count++;
      });
      return count;
    });
  }

  async toggleFavorite(index = 0) {
    const clicked = await this.page.evaluate((idx) => {
      // Try star buttons on the list page
      const starBtns = document.querySelectorAll('[data-testid="list-column-star"] button');
      let visibleIdx = 0;
      for (const btn of starBtns) {
        const r = btn.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          if (visibleIdx === idx) { btn.click(); return true; }
          visibleIdx++;
        }
      }
      return false;
    }, index);
    if (!clicked) throw new Error(`Favorite toggle at index ${index} not found`);
    await sleep(1000);
  }
}
