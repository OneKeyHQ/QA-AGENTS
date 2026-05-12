import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';

const switchContext = async (context, platform = detectPlatform()) => {
  if (platform === PLATFORMS.ios || platform === PLATFORMS.android) {
    await browser.switchContext(context);
  }
};

export default switchContext;
