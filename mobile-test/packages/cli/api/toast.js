import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';

const isToastDisplayed = async (platform = detectPlatform()) => {
  const isDisplayed = await browser.$('//android.widget.Toast').isExisting();
  return isDisplayed;
};

export default isToastDisplayed;
