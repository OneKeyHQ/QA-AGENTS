// Read-only mobile smoke test — runs against an already-logged-in OneKey
// wallet without modifying any state. Purpose: prove the end-to-end chain
// (lookupTestId → byTestId → WDIO → uiautomator2) works.
//
// Test IDs: MOBILE-SMOKE-001

import { resolve } from 'node:path';
import { createStepTracker, safeStep } from '../helpers/components.mjs';

export const platform = 'mobile';
export const displayName = '主页冒烟';
const SCREENSHOT_DIR = resolve(import.meta.dirname, '../../../../shared/results/mobile/wallet');

export const testCases = [
  {
    id: 'MOBILE-SMOKE-001',
    name: '钱包主页元素可见性',
    fn: async (driver) => {
      const t = createStepTracker('MOBILE-SMOKE-001');
      const { isDisplayed } = await import('../helpers/index.mjs');

      await safeStep(driver, t, '验证 Wallet-Tab-Header 可见', async () => {
        const visible = await isDisplayed(driver, 'Wallet-Tab-Header');
        if (!visible) throw new Error('Wallet-Tab-Header not displayed');
        return 'header visible';
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '验证账户选择器可见', async () => {
        const visible = await isDisplayed(driver, 'AccountSelectorTriggerBase');
        if (!visible) throw new Error('AccountSelectorTriggerBase not displayed');
        return 'account selector visible';
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '验证右上通知按钮可见', async () => {
        const visible = await isDisplayed(driver, 'header-right-notification');
        if (!visible) throw new Error('notification button not displayed');
        return 'notification visible';
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '截屏一次（不点击任何元素）', async () => {
        const { mkdirSync } = await import('node:fs');
        mkdirSync(SCREENSHOT_DIR, { recursive: true });
        await driver.saveScreenshot(resolve(SCREENSHOT_DIR, 'MOBILE-SMOKE-001-home.png'));
        return 'screenshot saved';
      }, SCREENSHOT_DIR);

      return t.result();
    },
  },
  {
    id: 'MOBILE-SMOKE-002',
    name: '主页顶部搜索与更多按钮可见',
    fn: async (driver) => {
      const t = createStepTracker('MOBILE-SMOKE-002');
      const { isDisplayed } = await import('../helpers/index.mjs');

      await safeStep(driver, t, '验证顶部搜索框', async () => {
        const visible = await isDisplayed(driver, 'nav-header-search');
        if (!visible) throw new Error('search bar not displayed');
        return 'search visible';
      }, SCREENSHOT_DIR);

      await safeStep(driver, t, '验证更多按钮', async () => {
        const visible = await isDisplayed(driver, 'moreActions');
        if (!visible) throw new Error('moreActions button not displayed');
        return 'more actions visible';
      }, SCREENSHOT_DIR);

      return t.result();
    },
  },
  {
    id: 'MOBILE-SMOKE-003',
    name: '底部 4 个 Tab 全部可见',
    fn: async (driver) => {
      const t = createStepTracker('MOBILE-SMOKE-003');
      const { isTextVisible } = await import('../helpers/index.mjs');

      // Bottom nav tabs have no testID — fall back to content-desc text.
      for (const label of ['钱包', '交易', '合约', '发现']) {
        await safeStep(driver, t, `验证 Tab "${label}" 可见`, async () => {
          const visible = await isTextVisible(driver, label);
          if (!visible) throw new Error(`tab "${label}" not displayed`);
          return `${label} visible`;
        }, SCREENSHOT_DIR);
      }

      return t.result();
    },
  },
];

export async function setup() {
  return { shouldSkip: () => false };
}

export async function run() {
  const { connectDriver, disconnectDriver } = await import('../_appium.mjs');
  const driver = await connectDriver({ platform: 'android' });
  try {
    const pre = await setup(driver);
    for (const tc of testCases) {
      if (pre.shouldSkip(tc.id)) { console.log(`  SKIP  ${tc.id}  ${tc.name}`); continue; }
      console.log(`  RUN   ${tc.id}  ${tc.name}`);
      const start = Date.now();
      try {
        const r = await tc.fn(driver);
        const ok = r?.status === 'passed';
        console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${tc.id}  ${((Date.now() - start) / 1000).toFixed(1)}s`);
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
