import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';

const getDeviceSetting = async (settingStr, platform = detectPlatform()) => {
  if (PLATFORMS.android === platform) {
    // await browser.getDeviceSetting(settingStr);
  }
};

export default getDeviceSetting;
