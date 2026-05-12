import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';

const waitUntil = (fn, ...args) => {
  let platform = detectPlatform();
  if (platform === PLATFORMS.android || platform === PLATFORMS.ios) {
    return browser.waitUntil(fn, args);
  } else {
    return true;
  }
};

export default waitUntil;
