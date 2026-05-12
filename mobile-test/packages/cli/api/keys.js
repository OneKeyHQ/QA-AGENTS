import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';

const keys = async (text, platform = detectPlatform()) => {
  return browser.keys(text);
};

export default keys;
