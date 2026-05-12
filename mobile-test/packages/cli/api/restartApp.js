import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';
import { api } from './index.js';
import { APP_START_TIMEOUT } from '../const/index.js';

const restartApp = async (password, platform = detectPlatform()) => {
  await api.platformChain
    .android()
    .ios()
    .run(async () => {
      await browser.execute('mobile: terminateApp', {
        appId: process.env.APPIUM_APPPACKAGE,
        bundleId: process.env.APPIUM_BUNDLEID,
      });
    });
  await api.platformChain.android().run(async () => {
    await browser.execute('mobile: activateApp', {
      appId: process.env.APPIUM_APPPACKAGE,
    });
  });

  await api.platformChain.ios().run(async () => {
    await browser.execute('mobile: launchApp', {
      bundleId: process.env.APPIUM_BUNDLEID,
    });
  });

  await api.platformChain
    .not()
    .android()
    .ios()
    .run(async () => {
      await browser.execute(() => {
        location.href = `${location.origin}${location.pathname}`;
      });
    });

  const isSetPass = await api.globalStore.get(
    api.globalStore.constStr.password,
  );
  if (isSetPass && platform !== PLATFORMS.ext) {
    try {
      const elm = await api.by.id('enter-password');

      await api.platformChain
        .not()
        .ios()
        .run(async () => {
          await elm.waitForDisplayed({ timeout: APP_START_TIMEOUT });
        });
      await api.platformChain.ios().run(async () => {
        await elm.waitForExist({ timeout: APP_START_TIMEOUT });
      });
    } catch (error) {}

    await api.setValue(api.by.id('enter-password'), password);
    await api.tap(api.by.id('verifying-password'));
    await api.pause(1000);
  } else {
    await api.platformChain
      .android()
      .ios()
      .run(async () => {
        const hasWallet = await api.globalStore.get(
          api.globalStore.constStr.hasWallet,
        );
        if (!hasWallet) {
          await browser.waitUntil(
            async () => {
              return await api.by.id('create-wallet').isDisplayed();
            },
            {
              timeout: APP_START_TIMEOUT,
              timeoutMsg: `Restart timeout ${APP_START_TIMEOUT}`,
            },
          );
        } else {
          await browser.waitUntil(
            async () => {
              return await api.by.id('home').isDisplayed();
            },
            {
              timeout: APP_START_TIMEOUT,
              timeoutMsg: `Restart timeout ${APP_START_TIMEOUT}`,
            },
          );
        }
      });
  }
};

export default restartApp;
