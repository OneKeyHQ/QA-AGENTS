// 添加观察地址 — MOBILE-ONBOARD-WATCH-001
// 数据: ../data/watch-address.mjs

import { resolve } from 'node:path';
import { createStepTracker, safeStep } from '../../../helpers/components.mjs';
import { createMobileRunner, runAsMain } from '../../../run-mobile.mjs';
import { OnboardingPage } from '../pages/onboarding.mjs';
import { buildWatchAddressCases, loadWatchAddressData } from '../data/watch-address.mjs';

export const platform = 'mobile';
export const displayName = '添加观察地址';

const screenshotDir = resolve(import.meta.dirname, '../../../../../../shared/results/mobile/onboarding');
const data = loadWatchAddressData();

export const testCases = buildWatchAddressCases().map((caseDef) => ({
  id: caseDef.id,
  name: caseDef.name,
  fn: async (driver) => {
    const t = createStepTracker(caseDef.id);
    const onboarding = new OnboardingPage(driver);

    await safeStep(driver, t, '等待 Onboarding 页面就绪', async () => {
      return onboarding.waitForReady();
    }, screenshotDir);

    await safeStep(driver, t, '点击 创建/导入钱包', async () => {
      return onboarding.tapCreateOrImport();
    }, screenshotDir);

    await safeStep(driver, t, '进入「添加现有钱包」', async () => {
      return onboarding.goToAddExistingWallet();
    }, screenshotDir);

    await safeStep(driver, t, '选择「观察地址」', async () => {
      return onboarding.tapWatchAddress();
    }, screenshotDir);

    await safeStep(driver, t, `选择网络 ${data.chain}`, async () => {
      return onboarding.selectNetwork(data.chain);
    }, screenshotDir);

    await safeStep(driver, t, '输入地址', async () => {
      return onboarding.enterWatchAddress(data.address);
    }, screenshotDir);

    await safeStep(driver, t, '设置账户名称', async () => {
      return `NAME=${data.walletName} (default kept)`;
    }, screenshotDir);

    await safeStep(driver, t, '点击确认', async () => {
      return onboarding.confirm();
    }, screenshotDir);

    t.skip('Home 页验证已生成观察账户', 'placeholder — 等设备实测后用 home-page testID 断言');

    return t.result();
  },
}));

export async function setup() {
  return { shouldSkip: () => false };
}

export const { run } = createMobileRunner({ testCases, setup });

runAsMain(import.meta.url, run);
