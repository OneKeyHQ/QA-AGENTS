import { chromium } from 'playwright-core';

const CDP_URL = 'http://127.0.0.1:9222';

async function main() {
  console.log('Connecting to OneKey via CDP...');
  const browser = await chromium.connectOverCDP(CDP_URL);

  const contexts = browser.contexts();
  console.log(`Found ${contexts.length} context(s)`);

  const mainPage = contexts[0]?.pages()[0];
  if (!mainPage) {
    console.error('No page found!');
    process.exit(1);
  }

  const title = await mainPage.title();
  console.log(`Connected to: "${title}" - ${mainPage.url()}`);

  // Take a screenshot
  await mainPage.screenshot({
    path: '/Users/chole/onekey-agent-test/shared/results/onekey-current-state.png',
    fullPage: false
  });
  console.log('Screenshot saved.');

  await browser.close();
}

main().catch(console.error);
