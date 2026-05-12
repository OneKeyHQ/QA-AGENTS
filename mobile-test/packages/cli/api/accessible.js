import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';

const accessible = async (elem, platform = detectPlatform()) => {
  const element = await elem;

  if (platform === PLATFORMS.ios) {
    return !!(await element.getAttribute('accessible'));
  }
  if (platform === PLATFORMS.android) {
    return !!(await element.getAttribute('focusable'));
  }
  return !(await element.getAttribute('aria-disabled'));
};

export default accessible;
