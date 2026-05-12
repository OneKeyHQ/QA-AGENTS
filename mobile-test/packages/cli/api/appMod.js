import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';

class AppMod {
  #webview = null;

  async #setWebview() {
    const platform = detectPlatform();
    if (platform === PLATFORMS.electron) {
      this.#webview = 'electron';
      return;
    }
    const contexts = await browser.getContexts();
    if (platform === PLATFORMS.ios && contexts[1]) {
      this.#webview = contexts[1];
    }
    if (
      platform === PLATFORMS.android &&
      contexts.includes(`WEBVIEW_${process.env.APPIUM_APPPACKAGE}`)
    ) {
      this.#webview = `WEBVIEW_${process.env.APPIUM_APPPACKAGE}`;
    }
  }

  async getWebview() {
    if (this.#webview === null) {
      await this.#setWebview();
    }
    return this.#webview;
  }
  getApp() {
    return Promise.resolve('NATIVE_APP');
  }
}

const appMod = new AppMod();

export default appMod;
