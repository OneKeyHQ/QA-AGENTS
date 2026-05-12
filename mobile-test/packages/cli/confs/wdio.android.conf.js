import { config as base } from './wdio.conf.js';
import { isFirstRun } from '../utils/firstLock.js';

export const config = {
  ...base,
  runner: 'local',
  port: parseInt(process.env.APPIUM_PORT || '4723', 10),
  capabilities: [
    {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': process.env.APPIUM_DEVICENAME,
      // 使用udid来指定设备ID（多设备模式）
      ...(process.env.APPIUM_DEVICENAME ? { 'appium:udid': process.env.APPIUM_DEVICENAME } : {}),
      'appium:appPackage': process.env.APPIUM_APPPACKAGE,
      'appium:appActivity': process.env.APPIUM_APPACTIVITY,
      'appium:app': process.env.APPIUM_APP,
      'appium:waitForIdleTimeout': 10,
      'appium:newCommandTimeout': 86400,
      'appium:autoGrantPermissions': 'true',
      // 设置以下 capabilities 以避免重新安装
      'appium:isHybridApp': true, // 是混合应用，非原生
      //'appium:noReset': true, // 不重置应用状态
      //'appium:fullReset': false, // 不进行完全重置（不重新安装应用）
      'appium:language': 'en',
      'appium:locale': 'US',
      // 'appium:autoWebview': true,
      // 'appium:autoWebviewName': process.env.APPIUM_APPPACKAGE,
      'appium:chromedriverExecutable': process.env.CHROME_DRIVER,
      // 无线调试/部分真机无 WRITE_SECURE_SETTINGS 时，忽略 hidden_api_policy 设置失败，避免 session 创建报错
      'appium:ignoreHiddenApiPolicyError': true,
      // 部分设备禁止 adb install -g（INSTALL_GRANT_RUNTIME_PERMISSIONS），可设 SKIP_DEVICE_INIT=1 跳过安装 io.appium.settings
      ...(process.env.SKIP_DEVICE_INIT === '1' ? { 'appium:skipDeviceInitialization': true } : {}),
    },
  ],
  services: base.services.concat([
    [
      'appium',
      {
        args: {
          port: parseInt(process.env.APPIUM_PORT || '4723', 10),
          allowInsecure: ['*:chromedriver_autodownload', '*:adb_shell'],
        },
        command: 'appium',
        env: {
          ...process.env,
          ANDROID_HOME: process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (process.platform === 'darwin' ? `${process.env.HOME}/Library/Android/sdk` : `${process.env.HOME}/Android/Sdk`),
          ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || (process.platform === 'darwin' ? `${process.env.HOME}/Library/Android/sdk` : `${process.env.HOME}/Android/Sdk`),
        },
      },
    ],
  ]),
  before: async function(capabilities, specs, browser) {
    // if (isFirstRun()) {
    //   await browser.execute('mobile: installApp', {
    //     appPath: process.env.APPIUM_APP,
    //   });
    //   await browser.execute('mobile: activateApp', {
    //     appId: process.env.APPIUM_APPPACKAGE,
    //   });
    // }
    await base.before(capabilities, specs, browser);
  },
  after: async function(result, capabilities, specs) {
    // 测试完成后不退出App，只停止操作
    // try {
    //   // 关闭应用
    //   if (browser && typeof browser.execute === 'function') {
    //     await browser.execute('mobile: terminateApp', {
    //       appId: process.env.APPIUM_APPPACKAGE,
    //     });
    //   }
    // } catch (error) {
    //   console.error('Error during cleanup: ', error);
    // }
    
    // 在 session 关闭前重新激活 App，防止 App 退出
    try {
      if (browser && typeof browser.execute === 'function') {
        await browser.execute('mobile: activateApp', {
          appId: process.env.APPIUM_APPPACKAGE,
        });
        console.log('App reactivated to keep it running after test completion');
      }
    } catch (error) {
      console.warn('Could not reactivate app via browser:', error.message);
    }
    
    await base.after(result, capabilities, specs);
    
    // 如果 browser session 已关闭，使用 adb 命令作为备选方案
    if (process.env.APPIUM_APPPACKAGE) {
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        await execAsync(`adb shell monkey -p ${process.env.APPIUM_APPPACKAGE} -c android.intent.category.LAUNCHER 1`);
        console.log('App reactivated via adb to keep it running');
      } catch (adbError) {
        console.warn('Could not reactivate app via adb:', adbError.message);
      }
    }
  },
};
//cli/index.js test --platform android --framework wdio  --test-case ./test/recording.e2e.js
