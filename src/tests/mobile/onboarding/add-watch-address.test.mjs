// 添加观察地址流程
// 原文件: mobile-test/test/onboarding/addWatchAddress.e2e.js
// Test IDs: MOBILE-ONBOARD-WATCH-001
//
// 通过 ADDR / CHAIN 环境变量传入测试数据：
//   ADDR=bc1qxxx... CHAIN=BTC node src/tests/mobile/onboarding/add-watch-address.test.mjs
// 默认使用一个公开 BTC 地址。

import { resolve } from 'node:path';
import { createStepTracker, safeStep } from '../helpers/components.mjs';

export const platform = 'mobile';
export const displayName = '添加观察地址';
const SCREENSHOT_DIR = resolve(import.meta.dirname, '../../../../shared/results/mobile/onboarding');

const ADDR = process.env.ADDR || 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
const CHAIN = process.env.CHAIN || 'BTC';
const NAME = process.env.WALLET_NAME || `Watch-${CHAIN}`;

export const testCases = [
  {
    id: 'MOBILE-ONBOARD-WATCH-001',
    name: `观察地址添加 (${CHAIN})`,
    fn: async (driver) => {
      const t = createStepTracker('MOBILE-ONBOARD-WATCH-001');
      const { tap, setValue, waitFor, byText, isDisplayed } = await import('../helpers/index.mjs');

      await safeStep(driver, t, '等待 Onboarding 页面就绪', async () => {
        await waitFor(driver, 'APP-OnBoarding-Screen', { timeout: 15000 });
        return 'onboarding visible';
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '点击 创建/导入钱包', async () => {
        await tap(driver, 'onboarding-create-or-import-wallet');
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '进入「添加现有钱包」', async () => {
        if (await isDisplayed(driver, 'onboarding-add-existing-wallet-page')) {
          return 'on add-existing-wallet page';
        }
        const el = await byText(driver, '添加现有钱包');
        await el.click();
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '选择「观察地址」', async () => {
        const el = await byText(driver, '观察地址');
        await el.click();
      }, SCREENSHOT_DIR);

      // 网络选择目前没有专用 testID，按链名文本兜底
      await safeStep(driver, t, `选择网络 ${CHAIN}`, async () => {
        const networkBtn = await byText(driver, CHAIN);
        await networkBtn.click();
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '输入地址', async () => {
        await setValue(driver, 'onboarding-watch-address-input', ADDR);
        return ADDR.slice(0, 12) + '...';
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '设置账户名称', async () => {
        // 钱包名输入框暂时没专门 testID，先 SKIP 等设备验证后补
        return 'NAME default kept';
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '点击确认', async () => {
        const el = await byText(driver, '确认');
        await el.click();
      }, SCREENSHOT_DIR);

      t.skip('Home 页验证已生成观察账户', 'placeholder — 等设备实测后用 home-page testID 断言');

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
