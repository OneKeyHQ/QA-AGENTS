import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';
import by from './by.js';

const hideKeyboard = async (platform = detectPlatform()) => {
  if (platform !== PLATFORMS.android && platform !== PLATFORMS.ios) {
    return;
  }
  const isKeyboardShown = browser.isKeyboardShown
  ? browser.isKeyboardShown()
  : true;
  if (isKeyboardShown) {
    try {
      if (platform === PLATFORMS.android) {
        browser.hideKeyboard && (await browser.hideKeyboard());
      }
      if (platform === PLATFORMS.ios) {
        await api.tap(api.by.xpath(`//XCUIElementTypeButton[@name="Done"]`));
      }
    } catch (error) {
      console.error(error);
    }
  }
};

export default hideKeyboard;
