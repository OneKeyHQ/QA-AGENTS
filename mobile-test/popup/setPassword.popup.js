import Page from '../pages/base.js';
import { api } from '@node-e2e/cli/api/index.js';

/**
 * SetPassword 弹层 - Set Password Popup
 * 参考：xmls/popups/setPasswordPopupEnglish.xml
 * 弹层容器路径：//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[4]
 */
class SetPasswordPopup extends Page {
  /**
   * 弹层容器 - Popup Container
   * 路径：//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[4]
   */
  get container() {
    return api.by.xpath(
      '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[4]',
    );
  }

  /**
   * 密码输入框 - Password Input
   * resource-id: "pass-code"
   * bounds: [278,1969][803,2179]
   */
  get passwordInput() {
    return api.by.id('pass-code');
  }

  /**
   * 切换为字母数字密码按钮 - Switch to Alphanumeric Passcode Button
   * content-desc: "Alphanumeric passcode "
   * bounds: [29,2218][1051,2297]
   */
  get alphanumericPasscodeBtn() {
    return api.by.xpath(
      '//android.widget.Button[@content-desc="Alphanumeric passcode "]',
    );
  }

  // ========== 操作方法 ==========

  /**
   * 等待弹层显示
   */
  async waitForPopup() {
    await api.waitPageByElement(this.container);
  }

  /**
   * 验证弹层是否显示
   */
  async verifyPopupDisplayed() {
    const isDisplayed = await this.container.isDisplayed();
    return isDisplayed;
  }

  /**
   * 输入密码
   * @param {string} password - 密码
   */
  async inputPassword(password) {
    await api.setValue(this.passwordInput, password);
  }

  /**
   * 点击切换为字母数字密码按钮
   */
  async clickAlphanumericPasscodeBtn() {
    await api.tap(this.alphanumericPasscodeBtn);
  }

  /**
   * 等待密码输入框显示
   */
  async waitForPasswordInput() {
    await api.waitPageByElement(this.passwordInput);
  }
}

export const setPasswordPopup = new SetPasswordPopup();
