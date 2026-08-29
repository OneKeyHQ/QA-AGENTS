// iOS 引导页冒烟 — IOS-ONBOARD-001
// 数据: ../data/onboarding-smoke.mjs

import { resolve } from 'node:path';
import { createStepTracker, safeStep } from '../../../../helpers/components.mjs';
import { createMobileRunner, runAsMain } from '../../../../run-mobile.mjs';
import { OnboardingPage } from '../../../onboarding/pages/onboarding.mjs';
import { IOS_ONBOARDING_SMOKE_CASES, IOS_ONBOARDING_TEXTS } from '../data/onboarding-smoke.mjs';

export const platform = 'mobile';
export const displayName = 'iOS 引导页冒烟';

const screenshotDir = resolve(import.meta.dirname, '../../../../../../../shared/results/mobile/ios/onboarding');

export const testCases = IOS_ONBOARDING_SMOKE_CASES.map((caseDef) => ({
  id: caseDef.id,
  name: caseDef.name,
  fn: async (driver) => {
    const t = createStepTracker(caseDef.id);
    const onboarding = new OnboardingPage(driver);

    await safeStep(driver, t, '确认 driver 平台为 iOS', async () => {
      const p = await onboarding.platform();
      if (p !== 'ios') throw new Error(`expected ios, got ${p}`);
      return `platform=${p}`;
    }, screenshotDir);

    await safeStep(driver, t, '等待引导页容器出现', async () => {
      const el = await driver.$('~onboarding-get-started-page');
      await el.waitForDisplayed({ timeout: 30000 });
      return 'onboarding-get-started-page visible';
    }, screenshotDir);

    for (const text of IOS_ONBOARDING_TEXTS) {
      await safeStep(driver, t, `「${text}」按钮可见`, async () => {
        const el = await onboarding.byText(text);
        await el.waitForDisplayed({ timeout: 8000 });
        return `${text} visible`;
      }, screenshotDir);
    }

    await safeStep(driver, t, '截屏引导页', async () => {
      const path = resolve(screenshotDir, `${caseDef.id}-home.png`);
      await onboarding.screenshot(path);
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
