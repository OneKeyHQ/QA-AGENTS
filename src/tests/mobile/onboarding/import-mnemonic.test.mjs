// 助记词导入流程
// 原文件: mobile-test/test/onboarding/importMnemonic.e2e.js
// Test IDs: MOBILE-ONBOARD-IMPORT-001
//
// 要从 onboarding 起步页运行——需要先清数据或装新包未登录状态。
// 12/15/18/21/24 词通过 PHRASE_WORDS env 切换（默认 12 词）。

import { resolve } from 'node:path';
import { createStepTracker, safeStep } from '../helpers/components.mjs';

export const platform = 'mobile';
export const displayName = '导入助记词';
const SCREENSHOT_DIR = resolve(import.meta.dirname, '../../../../shared/results/mobile/onboarding');

// 12 词测试助记词（可被 PHRASE 环境变量覆盖；不要用真钱包的助记词）
const MNEMONIC = process.env.PHRASE
  || 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

export const testCases = [
  {
    id: 'MOBILE-ONBOARD-IMPORT-001',
    name: `助记词导入流程 (${MNEMONIC.split(/\s+/).length} 词)`,
    fn: async (driver) => {
      const t = createStepTracker('MOBILE-ONBOARD-IMPORT-001');
      const { tap, setValue, waitFor, byTestId, byText, isDisplayed } = await import('../helpers/index.mjs');

      await safeStep(driver, t, '等待 Onboarding 页面就绪', async () => {
        await waitFor(driver, 'APP-OnBoarding-Screen', { timeout: 15000 });
        return 'onboarding visible';
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '点击 创建/导入钱包', async () => {
        await tap(driver, 'onboarding-create-or-import-wallet');
        return 'create/import tapped';
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '进入「添加现有钱包」', async () => {
        // PR #10966 暴露了页面级 testID；按钮文本也可以兜底
        if (await isDisplayed(driver, 'onboarding-add-existing-wallet-page')) {
          return 'on add-existing-wallet page';
        }
        // 兜底：通过 byText 点中
        const el = await byText(driver, '添加现有钱包');
        await el.click();
        return 'navigated to add-existing-wallet';
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '选择「导入助记词」', async () => {
        const el = await byText(driver, '导入助记词');
        await el.click();
        return 'import mnemonic tapped';
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '输入助记词', async () => {
        await setValue(driver, 'onboardingv2-handle-import-custom-mnemonic-input', MNEMONIC);
        return `${MNEMONIC.split(/\s+/).length} words entered`;
      }, SCREENSHOT_DIR);

      // 密码设置流程依赖 setPasswordPopup / confirmPasswordPopup 弹层
      // testID 在 security 模块下：set-password, confirm-password
      await safeStep(driver, t, '设置密码', async () => {
        const pwd = '11111111';
        await setValue(driver, 'password', pwd);
        if (await isDisplayed(driver, 'confirm-password')) {
          await setValue(driver, 'confirm-password', pwd);
        }
        await tap(driver, 'set-password');
        return 'password set';
      }, SCREENSHOT_DIR);

      t.skip('钱包就绪断言', 'placeholder — 等真机跑通后补具体 Home 页元素断言');

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
