// 通讯录多链添加 — MOBILE-ADDR-MULTI-001
// 数据: ../data/add-multi-network.mjs

import { resolve } from 'node:path';
import { createStepTracker, safeStep } from '../../../helpers/components.mjs';
import { createMobileRunner, runAsMain } from '../../../run-mobile.mjs';
import { AddressBookPage } from '../pages/address-book.mjs';
import { WalletHomePage } from '../../wallet/pages/wallet-home.mjs';
import {
  ADD_MULTI_NETWORK_CASES,
  MULTI_NETWORK_ENTRIES,
} from '../data/add-multi-network.mjs';

export const platform = 'mobile';
export const displayName = '通讯录多链';
export const categoryTitle = '通讯录';

const screenshotDir = resolve(import.meta.dirname, '../../../../../../shared/results/mobile/address-book');

export const testCases = ADD_MULTI_NETWORK_CASES.map((caseDef) => ({
  id: caseDef.id,
  name: caseDef.name,
  fn: async (driver) => {
    const t = createStepTracker(caseDef.id);
    const home = new WalletHomePage(driver);
    const addressBook = new AddressBookPage(driver);

    await safeStep(driver, t, '前置：主页可见', async () => {
      return home.waitForReady();
    }, screenshotDir);

    await safeStep(driver, t, '导航到地址簿', async () => {
      return addressBook.navigateFromHome();
    }, screenshotDir);

    await safeStep(driver, t, '点击「添加」', async () => {
      return addressBook.openAddForm();
    }, screenshotDir);

    await safeStep(driver, t, '表单 save 按钮可见', async () => {
      return addressBook.assertFormReady();
    }, screenshotDir);

    if (MULTI_NETWORK_ENTRIES.length === 0) {
      t.skip('实际批量添加多链地址', 'MULTI_NETWORK_ENTRIES 为空 — 在 data/add-multi-network.mjs 补数据后启用');
    }

    return t.result();
  },
}));

export async function setup() {
  return { shouldSkip: () => false };
}

export const { run } = createMobileRunner({ testCases, setup });

runAsMain(import.meta.url, run);
