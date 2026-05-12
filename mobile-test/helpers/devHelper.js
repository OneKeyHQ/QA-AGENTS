import { api } from '@node-e2e/cli';

import { lockPassword } from '../dataset/index.js';

import { settingPage, clearDataMenuPage } from '../pages/index.js';

class DevHelperClass {
  static async clearWalletData() {
    await processDataClear(
      async () => await clearDataMenuPage.clickClearWalletsDataBtn(),
    );
  }

  static async clearContactData() {
    await processDataClear(
      async () => await clearDataMenuPage.clickClearContactsDataBtn(),
    );
  }
  static async clearBrowserData() {
    await processDataClear(
      async () => await clearDataMenuPage.clickClearBrowserDataBtn(),
    );
  }
  static async clearPassword() {
    await processDataClear(
      async () => await clearDataMenuPage.clearPasswordBtn(),
    );
  }
}
const processDataClear = async clearProcess => {
  await settingPage.toSettingPage();
  await settingPage.waitEntryPage();
  await settingPage.clickClearDataMenuBtn();
  await clearDataMenuPage.waitEntryPage();
  await clearProcess();
  await api.restartApp(lockPassword);
};

export const DevHelper = DevHelperClass;
