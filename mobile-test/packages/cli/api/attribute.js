import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';

// attribute name define
const attribute = {
  get accessible() {
    const platform = detectPlatform();
    if (platform === PLATFORMS.ios) {
      return 'accessible'; // rn accessible={!!tab?.canGoForward}
    }
    if (platform === PLATFORMS.android) {
      return 'focusable'; // disabled={displayHomePage ? true : !tab?.canGoForward}
    }
    if (platform === PLATFORMS.electron) {
      return 'aria-disabled'; // disabled={displayHomePage ? true : !tab?.canGoForward}
    }
  },

  async id(element, platform = detectPlatform()) {
    if (platform === PLATFORMS.ios) {
      return await this.value(element, 'name', platform);
    }
    if (platform === PLATFORMS.android) {
      return await this.value(element, 'resource-id', platform);
    }
    return await this.value(element, 'data-testid', platform);
  },
  async value(element, name, platform) {
    const ele = element;
    if (platform === PLATFORMS.ios) {
      return await browser.getElementAttribute(ele.elementId, name);
    }
    if (platform === PLATFORMS.android) {
      return await browser.getElementAttribute(ele.elementId, name);
    }
    return await browser.getElementAttribute(ele.elementId, name);
  },
};

export default attribute;
