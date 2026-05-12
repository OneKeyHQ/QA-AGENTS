import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';

const pause = async (ms = 2000, platform = detectPlatform()) => {
  await browser.pause(ms);
};

export default pause;
