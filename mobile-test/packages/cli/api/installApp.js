import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';

const installApp = async (platform = detectPlatform()) => {
  if (PLATFORMS.android === platform)
    await browser.execute('mobile: installApp', {
      appPath: process.env.APPIUM_APP,
    });
  if (PLATFORMS.ios === platform)
    await browser.execute('mobile: installApp', {
      app: process.env.APPIUM_APP,
    });
};

export default installApp;
