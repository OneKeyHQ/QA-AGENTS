import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';

const pushToImageDir = async (fileBase64, platform = detectPlatform()) => {
  if (platform === PLATFORMS.android) {
    const filePath = `//storage/emulated/0/Download/${Date.now()}.png`;
    await browser.pushFile(filePath, fileBase64);
    // 触发媒体扫描
    await driver.execute('mobile: shell', {
      command: `am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///${filePath}`,
    });
  } else if (platform === PLATFORMS.ios) {
    const filePath = `@${
      process.env.APPIUM_BUNDLEID
    }:documents/${Date.now()}.png`;
    await browser.pushFile(filePath, fileBase64);
  }
};

export default pushToImageDir;
