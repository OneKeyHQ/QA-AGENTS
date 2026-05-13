// 添加公钥（xpub）账户流程
// 原文件: mobile-test/test/onboarding/addPublickeyAddress.e2e.js
// Test IDs: MOBILE-ONBOARD-XPUB-001
//
// 通过 XPUB / CHAIN 环境变量传入测试数据。

import { resolve } from 'node:path';
import { createStepTracker, safeStep } from '../helpers/components.mjs';

export const platform = 'mobile';
export const displayName = '添加公钥账户';
const SCREENSHOT_DIR = resolve(import.meta.dirname, '../../../../shared/results/mobile/onboarding');

const XPUB = process.env.XPUB || 'xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWKiKrhko4egpiMZbpiaQL2jkwSB1icqYh2cfDfVxdx4df189oLKnC5fSwqPfgyP3hooxujYzAu3fDVmz';
const CHAIN = process.env.CHAIN || 'BTC';

export const testCases = [
  {
    id: 'MOBILE-ONBOARD-XPUB-001',
    name: `公钥账户添加 (${CHAIN} xpub)`,
    fn: async (driver) => {
      const t = createStepTracker('MOBILE-ONBOARD-XPUB-001');
      const { tap, setValue, waitFor, byText, isDisplayed } = await import('../helpers/index.mjs');

      await safeStep(driver, t, '等待 Onboarding 页面就绪', async () => {
        await waitFor(driver, 'APP-OnBoarding-Screen', { timeout: 15000 });
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '点击 创建/导入钱包', async () => {
        await tap(driver, 'onboarding-create-or-import-wallet');
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '进入「添加现有钱包」', async () => {
        if (await isDisplayed(driver, 'onboarding-add-existing-wallet-page')) return 'already there';
        const el = await byText(driver, '添加现有钱包');
        await el.click();
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '选择「观察地址」入口', async () => {
        const el = await byText(driver, '观察地址');
        await el.click();
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '切到「公钥」Tab', async () => {
        // 公钥 tab 暂无独立 testID，按文本兜底
        const el = await byText(driver, '公钥');
        await el.click();
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, `选择网络 ${CHAIN}`, async () => {
        const el = await byText(driver, CHAIN);
        await el.click();
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '输入 xpub', async () => {
        // import-address-input 是观察地址/公钥输入框的通用 testID
        await setValue(driver, 'import-address-input', XPUB);
        return XPUB.slice(0, 16) + '...';
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '点击确认', async () => {
        const el = await byText(driver, '确认');
        await el.click();
      }, SCREENSHOT_DIR);

      t.skip('Home 页验证 xpub 账户创建', 'placeholder');

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
