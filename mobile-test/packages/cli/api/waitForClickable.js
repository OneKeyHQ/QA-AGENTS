import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';
import accessible from './accessible.js';
/**
 *  deprecated
 *
 * @param {*} element
 * @param {*} ms
 * @param {*} platform
 */
const waitForClickable = async (
  element,
  ms = 10000,
  platform = detectPlatform(),
) => {
  if (platform === PLATFORMS.android || platform === PLATFORMS.ios) {
    await browser.waitUntil(
      async () => {
        const isClickable = await accessible(element);
        return isClickable;
      },
      {
        timeout: ms,
        timeoutMsg: 'Element was not displayed after 5s',
        interval: 500,
      },
    );
  } else {
    const waiteElement = await element;
    await waiteElement.waitForClickable({ timeout: ms });
  }
};

export default waitForClickable;
