import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';

const back = async (platform = detectPlatform()) => {
  if (platform === PLATFORMS.android) {
    await browser.executeScript('mobile: pressKey', [{ 'keycode': 4 }]);
  } else if (platform === PLATFORMS.ios) {
    await browser.executeScript('mobile: dragFromToForDuration', [
      { 'fromX': 100, 'fromY': 100, 'toX': 100, 'toY': 600, 'duration': 1 },
    ]);
  } else {
    await browser.keys('Escape');
  }
};

export default back;
