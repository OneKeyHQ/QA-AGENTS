// iOS onboarding smoke test.
// Goal: prove Appium + XCUITest can launch OneKey and verify the fresh
// onboarding screen before wallet state exists.
//
// Test IDs: IOS-ONBOARD-001

import { resolve } from 'node:path';
import { createStepTracker, safeStep } from '../../helpers/components.mjs';

export const platform = 'mobile';
export const displayName = 'iOS 引导页冒烟';
const SCREENSHOT_DIR = resolve(import.meta.dirname, '../../../../../shared/results/mobile/ios/onboarding');

export const testCases = [
  {
    id: 'IOS-ONBOARD-001',
    name: 'iOS 引导页首屏可见性验证',
    fn: async (driver) => {
      const t = createStepTracker('IOS-ONBOARD-001');
      const { byText, platformOf } = await import('../../helpers/index.mjs');

      await safeStep(driver, t, '确认 driver 平台为 iOS', async () => {
        const p = platformOf(driver);
        if (p !== 'ios') throw new Error(`expected ios, got ${p}`);
        return `platform=${p}`;
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '等待引导页容器出现', async () => {
        const el = await driver.$('~onboarding-get-started-page');
        await el.waitForDisplayed({ timeout: 30000 });
        return 'onboarding-get-started-page visible';
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '创建新钱包按钮可见', async () => {
        const el = await byText(driver, '创建新钱包');
        await el.waitForDisplayed({ timeout: 8000 });
        return 'create wallet button visible';
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '添加已有钱包按钮可见', async () => {
        const el = await byText(driver, '添加已有钱包');
        await el.waitForDisplayed({ timeout: 8000 });
        return 'import wallet button visible';
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '截屏引导页', async () => {
        const { mkdirSync } = await import('node:fs');
        mkdirSync(SCREENSHOT_DIR, { recursive: true });
        await driver.saveScreenshot(resolve(SCREENSHOT_DIR, 'IOS-ONBOARD-001-home.png'));
        return 'screenshot saved';
      }, SCREENSHOT_DIR);

      return t.result();
    },
  },
];

export async function setup() { return { shouldSkip: () => false }; }

export async function run() {
  const { connectDriver, disconnectDriver } = await import('../../_appium.mjs');
  process.env.MOBILE_TARGET_PLATFORM = 'ios';
  const driver = await connectDriver();
  let failed = false;
  try {
    for (const tc of testCases) {
      console.log(`  RUN   ${tc.id}  ${tc.name}`);
      const start = Date.now();
      try {
        const result = await tc.fn(driver);
        if (result.status !== 'passed') {
          failed = true;
          console.log(`  FAIL  ${tc.id}  ${((Date.now() - start) / 1000).toFixed(1)}s  ${result.errors.join('; ')}`);
        } else {
          console.log(`  PASS  ${tc.id}  ${((Date.now() - start) / 1000).toFixed(1)}s`);
        }
      } catch (err) {
        failed = true;
        console.log(`  FAIL  ${tc.id}  ${((Date.now() - start) / 1000).toFixed(1)}s  ${err.message}`);
      }
    }
  } finally {
    await disconnectDriver(driver);
  }
  if (failed) process.exitCode = 1;
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) run().catch(e => { console.error(e); process.exit(1); });
