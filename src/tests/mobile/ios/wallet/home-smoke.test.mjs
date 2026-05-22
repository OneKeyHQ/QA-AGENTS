// iOS-specific home smoke test (mirror of MOBILE-SMOKE-001 for iOS verification).
// Goal: prove the lookupTestId → byTestId → WDIO+XCUITest chain works against
// a real iOS device using the SAME locator entries the Android smoke uses.
//
// Test IDs: IOS-SMOKE-001
//
// Set MOBILE_TARGET_PLATFORM=ios (or via Dashboard mobile picker) before run.

import { resolve } from 'node:path';
import { createStepTracker, safeStep } from '../../helpers/components.mjs';

export const platform = 'mobile';
export const displayName = 'iOS 主页冒烟';
const SCREENSHOT_DIR = resolve(import.meta.dirname, '../../../../../shared/results/mobile/ios');

export const testCases = [
  {
    id: 'IOS-SMOKE-001',
    name: 'iOS 钱包主页元素可见性 + 跨端 testID 共享验证',
    fn: async (driver) => {
      const t = createStepTracker('IOS-SMOKE-001');
      const { isDisplayed, platformOf } = await import('../../helpers/index.mjs');

      await safeStep(driver, t, '确认 driver 平台为 iOS', async () => {
        const p = platformOf(driver);
        if (p !== 'ios') throw new Error(`expected ios, got ${p}`);
        return `platform=${p}`;
      }, SCREENSHOT_DIR);

      // Same locator names as the Android smoke — they should resolve to the
      // iOS accessibility-id form via the lookupTestId platform translation.
      for (const name of ['Wallet-Tab-Header', 'AccountSelectorTriggerBase', 'header-right-notification']) {
        await safeStep(driver, t, `元素「${name}」可见`, async () => {
          const visible = await isDisplayed(driver, name);
          if (!visible) throw new Error(`${name} not displayed on iOS home`);
          return `${name} ✓`;
        }, SCREENSHOT_DIR);
      }

      await safeStep(driver, t, '截屏首页', async () => {
        const { mkdirSync } = await import('node:fs');
        mkdirSync(SCREENSHOT_DIR, { recursive: true });
        await driver.saveScreenshot(resolve(SCREENSHOT_DIR, 'IOS-SMOKE-001-home.png'));
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
