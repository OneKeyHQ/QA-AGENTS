import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';
import { api } from './index.js';

const resetApp = async (platform = detectPlatform()) => {
  // if (platform === PLATFORMS.ext) {
  //   await browser.newWindow('https://www.cloudflare.com/favicon.ico');
  //   const handles = await browser.getWindowHandles();
  //   await browser.switchToWindow(handles[0]);
  //   await api.pause(1000);
  // }
  await api.tapOnDevBtn('dev-button');
  await api.tapOnDevBtn('open-settings-page');
  await api.tap(api.by.id('setting-clear-data'));
  await api.tap(api.by.id('setting-erase-data'));
  await api.setValue(api.by.id('erase-data-input'), 'RESET');
  await api.platformChain
    .not()
    .ios()
    .android()
    .run(async () => {
      await browser.execute(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    });
  await api.globalStore.del(api.globalStore.constStr.password);
  await api.globalStore.del(api.globalStore.constStr.hasWallet);
  await api.platformChain
    .not()
    .ext()
    .run(async () => await api.tap(api.by.id('erase-data-confirm')));

  // try {
  // if (platform === PLATFORMS.ext) {
  //   const handles = await browser.getWindowHandles();
  //   await browser.switchToWindow(handles[0]);
  //   await browser.url('chrome://extensions/');
  //   const extension = await $$('>>> extensions-item')[0];
  //   const extId = await extension.getAttribute('id');
  //   await browser.url(`chrome-extension://${extId}/ui-popup.html`);
  //   // await api.back();
  // } else {
  // await api.pause(3000); // 等待启动
  // }
  // } catch (error) {}
};

export default resetApp;
