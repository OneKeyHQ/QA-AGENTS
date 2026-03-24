// PerpsPage — page-specific operations for Perps tab
import { clickSidebarTab } from '../components.mjs';
import { sleep } from '../constants.mjs';

export class PerpsPage {
  constructor(page) { this.page = page; }

  setPage(page) { this.page = page; }

  async navigate() {
    await clickSidebarTab(this.page, 'Perps');
  }

  async getCurrentPair() {
    return this.page.evaluate(() => {
      const pairs = document.querySelectorAll('span, div');
      for (const el of pairs) {
        const text = el.textContent?.trim() || '';
        if (/^[A-Z]{2,10}\/[A-Z]{2,10}$/.test(text)) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.y < 200) return text;
        }
      }
      return null;
    });
  }

  async openPairSelector() {
    const pair = await this.getCurrentPair();
    if (!pair) throw new Error('Cannot find current pair to click');
    const clicked = await this.page.evaluate((pairText) => {
      for (const el of document.querySelectorAll('span, div')) {
        if (el.textContent?.trim() === pairText) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.y < 200) { el.click(); return true; }
        }
      }
      return false;
    }, pair);
    if (!clicked) throw new Error('Cannot click pair selector');
    await sleep(1000);
  }

  async searchPair(keyword) {
    await this.openPairSelector();
    const input = this.page.locator('[data-testid="ovelay-popover"] input, [role="dialog"] input').first();
    await input.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    await input.click();
    await input.pressSequentially(keyword, { delay: 40 });
    await sleep(1500);
  }

  async selectPair(name) {
    const clicked = await this.page.evaluate((pairName) => {
      const popover = document.querySelector('[data-testid="ovelay-popover"]') || document.body;
      for (const el of popover.querySelectorAll('span, div')) {
        if (el.textContent?.trim().includes(pairName)) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 20) { el.click(); return true; }
        }
      }
      return false;
    }, name);
    if (!clicked) throw new Error(`Pair "${name}" not found`);
    await sleep(1500);
  }
}
