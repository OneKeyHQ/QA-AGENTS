// 创建软件钱包 — MOBILE-ONBOARD-001
// 数据: ../data/create-wallet.mjs

import { resolve } from 'node:path';
import { createStepTracker, safeStep } from '../../../helpers/components.mjs';
import { createMobileRunner, runAsMain } from '../../../run-mobile.mjs';
import { OnboardingPage } from '../pages/onboarding.mjs';
import { CREATE_WALLET_CASES, loadCreateWalletData } from '../data/create-wallet.mjs';

export const platform = 'mobile';
export const displayName = '创建钱包';

const screenshotDir = resolve(import.meta.dirname, '../../../../../../shared/results/mobile/onboarding');
const data = loadCreateWalletData();

export const testCases = CREATE_WALLET_CASES.map((caseDef) => ({
  id: caseDef.id,
  name: caseDef.name,
  fn: async (driver) => {
    const t = createStepTracker(caseDef.id);
    const onboarding = new OnboardingPage(driver);

    await safeStep(driver, t, '等待引导页就绪', async () => {
      return onboarding.waitForReady();
    }, screenshotDir);

    await safeStep(driver, t, '点击 Create or import wallet', async () => {
      return onboarding.tapCreateOrImport();
    }, screenshotDir);

    await safeStep(driver, t, '设置钱包密码', async () => {
      return onboarding.setWalletPassword(data.password);
    }, screenshotDir);

    t.skip('钱包创建完成断言', 'placeholder — needs device verification before assertion locator is finalized');

    return t.result();
  },
}));

export async function setup() {
  return { shouldSkip: () => false };
}

export const { run } = createMobileRunner({
  testCases,
  setup,
  connectOptions: { platform: 'android' },
});

runAsMain(import.meta.url, run);
