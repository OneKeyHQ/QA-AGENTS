import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';

const activeApp = async (platform = detectPlatform()) => {
  if (PLATFORMS.android === platform) {
    await browser.execute('mobile: activateApp', {
      appId: process.env.APPIUM_APPPACKAGE,
    });
  }
  if (PLATFORMS.ios === platform) {
    await browser.execute('mobile: activateApp', {
      bundleId: process.env.APPIUM_BUNDLEID,
    });
  }
};

export default activeApp;
