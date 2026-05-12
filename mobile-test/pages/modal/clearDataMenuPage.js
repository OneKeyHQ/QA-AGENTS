import { api } from '@node-e2e/cli/api/index.js';

import Popover from './popover.js';

class ClearDataMenuPage extends Popover {
  get keyElement() {
    return api.by.id('clear-password');
  }

  get clearPasswordBtn() {
    return api.by.id('clear-password');
  }
  get clearWalletsDataBtn() {
    return api.by.id('clear-wallets-data');
  }
  get clearContactsDataBtn() {
    return api.by.id('clear-contacts-data');
  }
  get clearBrowserBtn() {
    return api.by.id('clear-dapp-data');
  }
  get clearDataMenuBtn() {
    return api.by.id('clear-data-menu');
  }

  async clickClearPasswordBtn() {
    await api.tap(this.clearPasswordBtn);
    await api.globalStore.del(api.globalStore.constStr.password);
  }
  async clickClearContactsDataBtn() {
    await api.tap(this.clearContactsDataBtn);
  }

  /**
   * @description Clear account, wallet, credential, address, indexedAccount, decvice, etc.
   */
  async clickClearWalletsDataBtn() {
    await api.pause(300);
    await api.tap(this.clearWalletsDataBtn);
    await api.globalStore.del(api.globalStore.constStr.hasWallet);
  }

  /**
   * @description Clear DiscoveryPageData
   */
  async clickClearBrowserDataBtn() {
    await api.tap(this.clearBrowserBtn);
  }

  /**
   * @description Clear btn entrance
   */
  async clickClearDataMenuBtn() {
    await api.scrollToId('clear-data-menu');
    await api.tap(this.clearDataMenuBtn);
  }
}


/**
 * @description details: https://github.com/OneKeyHQ/app-monorepo/blob/x/packages/kit-bg/src/services/ServiceE2E.ts
 */
export const clearDataMenuPage = new ClearDataMenuPage();
