import { api } from '@node-e2e/cli/api/index.js';
import Page from './base.js';
import { executeByPlatform } from '../util/index.js';
class MorePage extends Page {
  get settingBtn() {
    return api.by.id('me-settings');
  }
  get addressBook() {
    return api.by.id('setting-address-book');
  }
  get pickAddressBook() {
    return api.by.id('me-pick-address-book');
  }
  get encryptedStorageConfirm() {
    return api.by.id('encrypted-storage-confirm');
  }

  get lockBtn() {
    return api.by.id('me-lock');
  }

  async clickSettingBtn() {
    await api.tap(this.settingBtn);
  }

  async clickLockBtn() {
    await api.tap(this.lockBtn);
  }

  async clickAddressBook() {
    await executeByPlatform(
      async () => {
        await api.tap(this.addressBook);
      },
      async () => {
        await api.fixInterceptedClick('setting-address-book');
      },
    );
  }

  async clickEncryptedStorageConfirm() {
    await executeByPlatform(
      async () => {
        await api.tap(this.encryptedStorageConfirm);
      },
      async () => {
        await api.fixInterceptedClick('encrypted-storage-confirm');
      },
    );
  }

  async clickPickAddressBook() {
    await api.tap(this.pickAddressBook);
  }
}

export const morePage = new MorePage();
