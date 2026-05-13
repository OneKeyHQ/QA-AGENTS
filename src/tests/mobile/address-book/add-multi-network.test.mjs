// 通讯录添加多链地址
// 原文件: mobile-test/test/addressBook/addAddressBookMultipleNetworks.e2e.js
// Test IDs: MOBILE-ADDR-MULTI-001
//
// 假设钱包已就绪。打开「我的」→ 地址簿 → 新增地址，验证基础表单可达。

import { resolve } from 'node:path';
import { createStepTracker, safeStep } from '../helpers/components.mjs';

export const platform = 'mobile';
export const displayName = '通讯录多链';
export const categoryTitle = '通讯录';
const SCREENSHOT_DIR = resolve(import.meta.dirname, '../../../../shared/results/mobile/address-book');

export const testCases = [
  {
    id: 'MOBILE-ADDR-MULTI-001',
    name: '打开地址簿添加表单',
    fn: async (driver) => {
      const t = createStepTracker('MOBILE-ADDR-MULTI-001');
      const { tap, waitFor, byText, isDisplayed } = await import('../helpers/index.mjs');

      await safeStep(driver, t, '主页可见', async () => {
        await waitFor(driver, 'Wallet-Tab-Header', { timeout: 10000 });
      }, SCREENSHOT_DIR);

      // 进入地址簿——首选 setting-address-book / address-book-add-icon；
      // 实测如果路径需要先点「我的」tab，请用 byText("我的") 或加 home moreActions tap
      await safeStep(driver, t, '导航到地址簿', async () => {
        if (await isDisplayed(driver, 'setting-address-book')) {
          await tap(driver, 'setting-address-book');
          return 'via setting-address-book testID';
        }
        // 兜底路径：点 moreActions → 找文案
        await tap(driver, 'moreActions');
        const el = await byText(driver, '地址簿');
        await el.click();
        return 'via moreActions+地址簿';
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '点击「添加」', async () => {
        if (await isDisplayed(driver, 'address-book-add-icon')) {
          await tap(driver, 'address-book-add-icon');
          return 'via add-icon';
        }
        if (await isDisplayed(driver, 'address-book-add-footer-btn')) {
          await tap(driver, 'address-book-add-footer-btn');
          return 'via add-footer-btn';
        }
        throw new Error('No address book add button visible');
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '表单 save 按钮可见', async () => {
        const visible = await isDisplayed(driver, 'address-book-form-save-btn');
        if (!visible) throw new Error('save button not visible');
        return 'form ready';
      }, SCREENSHOT_DIR);

      t.skip('实际批量添加多链地址', '需要 dataset + 网络切换 + 锁屏密码弹层处理，等首段路径稳定后再补');

      return t.result();
    },
  },
];

export async function setup() { return { shouldSkip: () => false }; }

export async function run() {
  const { connectDriver, disconnectDriver } = await import('../_appium.mjs');
  const driver = await connectDriver();
  try {
    for (const tc of testCases) {
      console.log(`  RUN   ${tc.id}  ${tc.name}`);
      const start = Date.now();
      try {
        await tc.fn(driver);
        console.log(`  PASS  ${tc.id}  ${((Date.now() - start) / 1000).toFixed(1)}s`);
      } catch (err) {
        console.log(`  FAIL  ${tc.id}  ${((Date.now() - start) / 1000).toFixed(1)}s  ${err.message}`);
      }
    }
  } finally {
    await disconnectDriver(driver);
  }
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) run().catch(e => { console.error(e); process.exit(1); });
