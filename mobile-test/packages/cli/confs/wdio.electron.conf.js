import { config as base } from './wdio.conf.js';

export const config = {
  ...base,
  runner: 'local',
  capabilities: [
    {
      browserName: 'electron',
      // Electron service options
      // see https://webdriver.io/docs/wdio-electron-service/#configuration
      'wdio:electronServiceOptions': {
        // custom application args
        appArgs: [
          '--disable-web-security', // 禁用Web安全特性，注意这可能会引入安全风险
          '--disable-popup-blocking', // 禁用弹窗拦截
        ],
        prefs: {
          'profile.default_content_setting_values.notifications': 1, // 允许通知
          'profile.default_content_setting_values.geolocation': 1, // 允许地理位置
          'profile.default_content_setting_values.media_stream': 1, // 允许媒体流
          'profile.default_content_setting_values.media_stream_camera': 1, // 自动允许访问摄像头
          'webview.webpreferences': {
            nodeIntegration: true,
            contextIsolation: false,
            canPromptTouchID: false, // 关闭 canPromptTouchID
          },
          // 其他权限设置...
        },
        appBinaryPath: process.env.APPIUM_APPBINARYPATH,
      },
      'wdio:chromedriverOptions': {
        args: [
          `--lang=en-US`,
          '--disable-web-security', // 禁用Web安全特性，注意这可能会引入安全风险
          '--disable-popup-blocking', // 禁用弹窗拦截
          '--disable-infobars',
        ],
        binary: process.env.CHROME_DRIVER,
        excludeSwitches: ['enable-automation'],
      },
    },
  ],

  services: base.services.concat([['electron']]),
};
