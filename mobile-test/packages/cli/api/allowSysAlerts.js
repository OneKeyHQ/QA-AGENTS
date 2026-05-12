import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';
import { api } from './index.js';

const allowSysAlerts = async (platform = detectPlatform()) => {
  if (platform === PLATFORMS.android) {
    let element = await $(
      "//android.widget.Button[starts-with(@text, 'Allow')]",
    );
    await api.tap(element);
  } else if (platform === PLATFORMS.ios) {
    await api.tap(api.by.xpath(`//XCUIElementTypeButton[@name="OK"]`));
  }
};

export default allowSysAlerts;
