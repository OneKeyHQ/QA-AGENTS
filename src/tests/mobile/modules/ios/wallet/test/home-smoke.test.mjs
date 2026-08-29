// iOS 主页冒烟 — IOS-SMOKE-001
// 数据: ../data/home-smoke.mjs

import { resolve } from 'node:path';
import { createStepTracker, safeStep } from '../../../../helpers/components.mjs';
import { createMobileRunner, runAsMain } from '../../../../run-mobile.mjs';
import { WalletHomePage } from '../../../wallet/pages/wallet-home.mjs';
import { IOS_HOME_ELEMENTS, IOS_HOME_SMOKE_CASES } from '../data/home-smoke.mjs';

export const platform = 'mobile';
export const displayName = 'iOS 主页冒烟';

const screenshotDir = resolve(import.meta.dirname, '../../../../../../../shared/results/mobile/ios');

export const testCases = IOS_HOME_SMOKE_CASES.map((caseDef) => ({
  id: caseDef.id,
  name: caseDef.name,
  fn: async (driver) => {
    const t = createStepTracker(caseDef.id);
    const home = new WalletHomePage(driver);

    await safeStep(driver, t, '确认 driver 平台为 iOS', async () => {
      const p = await home.platform();
      if (p !== 'ios') throw new Error(`expected ios, got ${p}`);
      return `platform=${p}`;
    }, screenshotDir);

    for (const testId of IOS_HOME_ELEMENTS) {
      await safeStep(driver, t, `元素「${testId}」可见`, async () => {
        return home.assertElementVisible(testId);
      }, screenshotDir);
    }

    await safeStep(driver, t, '截屏首页', async () => {
      const path = resolve(screenshotDir, `${caseDef.id}-home.png`);
      await home.screenshot(path);
      return 'screenshot saved';
    }, screenshotDir);

    return t.result();
  },
}));

export async function setup() {
  return { shouldSkip: () => false };
}

export const { run } = createMobileRunner({
  testCases,
  setup,
  connectOptions: { platform: 'ios' },
});

runAsMain(import.meta.url, run);
