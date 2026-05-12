import { api } from '@node-e2e/cli/api/index.js';

import Page from './base.js';

import { SAVE_PASSWORD } from '../const/index.js';

class SetPasswordPage extends Page {
  get passwordInput() {
    return api.by.id('password');
  }
  get confirmInput() {
    return api.by.id('confirm-password');
  }

  get setPasswordBtn() {
    return api.by.id('set-password');
  }

  async inputPassword(pass) {
    await api.setValue(this.passwordInput, pass);
  }

  async inputConfirmPassword(pass) {
    await api.setValue(this.confirmInput, pass);
  }

  async savePassword(pass) {
    await this.inputPassword(pass);
    await this.inputConfirmPassword(pass);
    const elem = await this.setPasswordBtn;

    await api.tap(elem);

    await api.globalStore.set(api.globalStore.constStr.password, pass);
    // try {
    //   await elem.waitForDisplayed({ timeout: SAVE_PASSWORD, reverse: true });
    // } catch (error) {}
    await api.platformChain
      .ext()
      .electron()
      .run(async () => {
        await api.pause(6000); //等待toast 消失
      });
  }
}

export const setPasswordPage = new SetPasswordPage();
