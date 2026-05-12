import { config as base } from './wdio.conf.js';

export const config = {
  ...base,
  runner: 'local',
  capabilities: [
    {
      browserName: 'chrome',
      'goog:chromeOptions': {
        // given your wdio.conf.js is in the root directory and your compiled
        // web extension files are located in the `./dist` folder
        args: [
          `--load-extension=${process.env.LOAD_EXTENSION}`,
          `--disable-extensions-except=${process.env.LOAD_EXTENSION}`,
          '--disable-extensions-content-security-policy',
          '--disable-web-security', // 禁用同源策略，这可能会影响浏览器的安全
          '--use-fake-ui-for-media-stream', // 使用假的用户界面来处理媒体流权限请求（例如摄像头和麦克风）
          '--use-fake-device-for-media-stream', // 使用假设备来捕获媒体流，用于测试
          '--disable-popup-blocking', // 禁用弹窗拦截
          '--no-sandbox', // 在某些环境中禁用沙盒模式可能是必要的，但这也会降低安全性
          '--disable-infobars', // 禁用Chrome的信息栏（如"Chrome正在被自动化软件控制"的提示）
        ],
        excludeSwitches: ['enable-automation'],
        prefs: {
          'profile.default_content_setting_values.notifications': 1, // 允许通知
          'profile.default_content_setting_values.geolocation': 1, // 允许地理位置
          'profile.default_content_setting_values.media_stream': 1, // 允许媒体流
          'profile.default_content_setting_values.clipboard': 1,
        },
      },
      'wdio:chromedriverOptions': {
        binary: process.env.CHROME_DRIVER,
      },
    },
  ],
};
