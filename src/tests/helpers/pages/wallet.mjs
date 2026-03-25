// WalletPage — page-specific operations for Wallet tab
import { clickSidebarTab } from '../components.mjs';
import { registry } from '../ui-registry.mjs';
import { sleep } from '../constants.mjs';

export class WalletPage {
  constructor(page) { this.page = page; }

  setPage(page) { this.page = page; }

  async navigate() {
    await clickSidebarTab(this.page, 'Wallet');
  }

  async openReceive() {
    const clicked = await this.page.evaluate(() => {
      for (const el of document.querySelectorAll('button, [role="button"]')) {
        const text = el.textContent?.trim();
        if ((text === '收款' || text === 'Receive') && el.getBoundingClientRect().width > 0) {
          el.click();
          return true;
        }
      }
      return false;
    });
    if (!clicked) throw new Error('Receive button not found');
    await sleep(1500);
  }

  async openSend() {
    const clicked = await this.page.evaluate(() => {
      for (const el of document.querySelectorAll('button, [role="button"]')) {
        const text = el.textContent?.trim();
        if ((text === '发送' || text === 'Send') && el.getBoundingClientRect().width > 0) {
          el.click();
          return true;
        }
      }
      return false;
    });
    if (!clicked) throw new Error('Send button not found');
    await sleep(1500);
  }

  async selectAccount(index) {
    const selector = await registry.resolve(this.page, 'walletSelector', { context: 'page' });
    await selector.click();
    await sleep(1000);
    const account = await registry.resolve(this.page, 'accountItemByIndex', { context: 'modal', params: { N: index } });
    await account.click();
    await sleep(1500);
  }
}
