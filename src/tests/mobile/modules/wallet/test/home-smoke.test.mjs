// 钱包主页冒烟 — MOBILE-SMOKE-001 ~ 003
// 数据: ../data/home-smoke.mjs

import { resolve } from 'node:path';
import { createStepTracker, safeStep } from '../../../helpers/components.mjs';
import { createMobileRunner, runAsMain } from '../../../run-mobile.mjs';
import { WalletHomePage } from '../pages/wallet-home.mjs';
import {
  BOTTOM_TAB_LABELS,
  HEADER_ELEMENTS,
  HOME_SMOKE_CASES,
  TOP_BAR_ELEMENTS,
} from '../data/home-smoke.mjs';

export const platform = 'mobile';
export const displayName = '主页冒烟';

const screenshotDir = resolve(import.meta.dirname, '../../../../../../shared/results/mobile/wallet');

export const testCases = HOME_SMOKE_CASES.map((caseDef) => ({
  id: caseDef.id,
  name: caseDef.name,
  fn: async (driver) => {
    const t = createStepTracker(caseDef.id);
    const home = new WalletHomePage(driver);

    if (caseDef.kind === 'header') {
      await safeStep(driver, t, '前置：确认在钱包主页', async () => {
        return home.waitForReady();
      }, screenshotDir);

      for (const testId of HEADER_ELEMENTS) {
        await safeStep(driver, t, `验证 ${testId} 可见`, async () => {
          return home.assertElementVisible(testId);
        }, screenshotDir);
      }

      await safeStep(driver, t, '截屏一次（不点击任何元素）', async () => {
        const path = resolve(screenshotDir, `${caseDef.id}-home.png`);
        await home.screenshot(path);
        return 'screenshot saved';
      }, screenshotDir);
    }

    if (caseDef.kind === 'topBar') {
      await safeStep(driver, t, '前置：确认在钱包主页', async () => {
        return home.waitForReady();
      }, screenshotDir);

      for (const testId of TOP_BAR_ELEMENTS) {
        await safeStep(driver, t, `验证 ${testId} 可见`, async () => {
          return home.assertElementVisible(testId);
        }, screenshotDir);
      }
    }

    if (caseDef.kind === 'bottomTabs') {
      await safeStep(driver, t, '前置：确认在钱包主页', async () => {
        return home.waitForReady();
      }, screenshotDir);

      for (const label of BOTTOM_TAB_LABELS) {
        await safeStep(driver, t, `验证 Tab "${label}" 可见`, async () => {
          return home.assertTextVisible(label);
        }, screenshotDir);
      }
    }

    return t.result();
  },
}));

export async function setup() {
  return { shouldSkip: () => false };
}

export const { run } = createMobileRunner({ testCases, setup });

runAsMain(import.meta.url, run);
