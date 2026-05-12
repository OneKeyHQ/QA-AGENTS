import { config as base } from './wdio.conf.js';

export const config = {
  ...base,
  runner: 'local',
  port: parseInt(process.env.APPIUM_PORT || '4723', 10),
  capabilities: [
    {
      platformName: 'OneKey Touch',
      'appium:automationName': 'Touch',
      'appium:deviceName': 'Touch',

      // screenSize: '1920x1080',
      // usbPort: '/dev/cu.usbserial-0001',
      // baudRate: 115200,
      // 'appium:app': 'test',
      // 'appium:address': '127.0.0.1',
      // 'appium:port': '4774',
    },
  ],
  services: base.services.concat([
    [
      'appium',
      {
        args: {
          port: parseInt(process.env.APPIUM_PORT || '4723', 10),
          allowInsecure: ['*:chromedriver_autodownload'],
        },
        command: 'appium',
      },
    ],
  ]),
};
