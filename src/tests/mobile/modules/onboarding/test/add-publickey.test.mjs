// 添加公钥账户 — MOBILE-ONBOARD-XPUB-001
// 数据: ../data/publickey.mjs

import { resolve } from 'node:path';
import { createStepTracker, safeStep } from '../../../helpers/components.mjs';
import { createMobileRunner, runAsMain } from '../../../run-mobile.mjs';
import { OnboardingPage } from '../pages/onboarding.mjs';
import { buildPublicKeyCases, loadPublicKeyData } from '../data/publickey.mjs';

export const platform = 'mobile';
export const displayName = '添加公钥账户';

const screenshotDir = resolve(import.meta.dirname, '../../../../../../shared/results/mobile/onboarding');
const data = loadPublicKeyData();

export const testCases = buildPublicKeyCases().map((caseDef) => ({
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

    await safeStep(driver, t, '选择「观察地址」入口', async () => {
      return onboarding.tapWatchAddress();
    }, screenshotDir);

    await safeStep(driver, t, '切到「公钥」Tab', async () => {
      return onboarding.tapPublicKeyTab();
    }, screenshotDir);

    await safeStep(driver, t, `选择网络 ${data.chain}`, async () => {
      return onboarding.selectNetwork(data.chain);
    }, screenshotDir);

    await safeStep(driver, t, '输入 xpub', async () => {
      return onboarding.enterPublicKey(data.xpub);
    }, screenshotDir);

    await safeStep(driver, t, '点击确认', async () => {
      return onboarding.confirm();
    }, screenshotDir);

    t.skip('Home 页验证 xpub 账户创建', 'placeholder');

    return t.result();
  },
}));

export async function setup() {
  return { shouldSkip: () => false };
}

export const { run } = createMobileRunner({ testCases, setup });

runAsMain(import.meta.url, run);
