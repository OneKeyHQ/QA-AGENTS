// 导入助记词 — MOBILE-ONBOARD-IMPORT-001
// 数据: ../data/import-mnemonic.mjs

import { resolve } from 'node:path';
import { createStepTracker, safeStep } from '../../../helpers/components.mjs';
import { createMobileRunner, runAsMain } from '../../../run-mobile.mjs';
import { OnboardingPage } from '../pages/onboarding.mjs';
import { buildImportMnemonicCases, loadImportMnemonicData } from '../data/import-mnemonic.mjs';

export const platform = 'mobile';
export const displayName = '导入助记词';

const screenshotDir = resolve(import.meta.dirname, '../../../../../../shared/results/mobile/onboarding');
const data = loadImportMnemonicData();

export const testCases = buildImportMnemonicCases().map((caseDef) => ({
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

    await safeStep(driver, t, '选择「导入助记词」', async () => {
      return onboarding.tapImportMnemonic();
    }, screenshotDir);

    await safeStep(driver, t, '输入助记词', async () => {
      return onboarding.enterMnemonic(data.mnemonic);
    }, screenshotDir);

    await safeStep(driver, t, '设置密码', async () => {
      return onboarding.setWalletPassword(data.password);
    }, screenshotDir);

    t.skip('钱包就绪断言', 'placeholder — 等真机跑通后补具体 Home 页元素断言');

    return t.result();
  },
}));

export async function setup() {
  return { shouldSkip: () => false };
}

export const { run } = createMobileRunner({ testCases, setup });

runAsMain(import.meta.url, run);
