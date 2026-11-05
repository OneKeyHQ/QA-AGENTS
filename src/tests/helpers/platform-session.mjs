// Connect only to the selected platform. Web/extension never launch Desktop.
import { chromium as defaultChromium } from 'playwright-core';
import { connectCDP } from './index.mjs';
export function platformFromFile(file) {
  const prefix = file.replaceAll('\\', '/').split('/')[0];
  return ['desktop', 'web', 'extension', 'mobile'].includes(prefix) ? prefix : 'desktop';
}
export function assertTargetPage(page, platform, env = process.env) {
  const url = new URL(page.url());
  let valid = false;
  if (platform === 'desktop') valid = url.protocol === 'file:';
  else if (platform === 'web') {
    const expected = new URL(env.WEB_URL || 'https://app.onekeytest.com');
    valid = /^https?:$/.test(url.protocol) && url.origin === expected.origin;
  } else if (platform === 'extension') {
    if (!/^[a-p]{32}$/.test(env.ONEKEY_EXT_ID || '')) throw Error('Extension target requires the selected ONEKEY_EXT_ID');
    valid = url.protocol === 'chrome-extension:' && url.hostname === env.ONEKEY_EXT_ID;
  } else throw Error(`Unsupported CDP platform: ${platform}`);
  if (!valid) throw Error(`Wrong target platform ${platform}: ${url.protocol}//${url.host}${url.pathname}`);
  return true;
}
export async function connectPlatform(platform, { env = process.env, chromium = defaultChromium, desktopConnect = connectCDP } = {}) {
  if (platform === 'desktop') {
    const session = await desktopConnect();
    assertTargetPage(session.page, platform, env);
    return session;
  }
  if (!['web', 'extension'].includes(platform)) throw Error(`Unsupported CDP platform: ${platform}`);
  if (platform === 'extension' && !env.ONEKEY_EXT_ID) throw Error('Select extension profile and set ONEKEY_EXT_ID before connecting');
  const endpoint = (platform === 'web' ? env.WEB_CDP_URL : env.EXT_CDP_URL) || env.CDP_URL || `http://127.0.0.1:${platform === 'web' ? 9223 : 9224}`;
  const browser = await chromium.connectOverCDP(endpoint);
  const matching = browser.contexts().flatMap(context => context.pages()).filter(page => {
    try { assertTargetPage(page, platform, env); return true; } catch { return false; }
  });
  const perpsPages = matching.filter(page => /(?:\/|#\/)perps?(?:[/?#]|$)/.test(page.url()));
  const candidates = perpsPages.length ? perpsPages : matching;
  if (candidates.length !== 1) throw Error(`Expected one matching ${platform} target page, found ${candidates.length}; refusing to borrow or navigate another page`);
  return { browser, page: candidates[0] };
}
