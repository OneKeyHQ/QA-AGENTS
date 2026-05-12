import Page from '../pages/base.js';
import { api } from '@node-e2e/cli/api/index.js';

/**
 * 输入密码弹层 - Input Passcode Popup
 * 参考：xmls/popups/inputPasscodePopupChinese.xml
 * 弹层容器路径：//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[4]
 */
class InputPasscodePopup extends Page {
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
   * 标题 - Title
   * text: "输入密码" | "Enter passcode"
   * bounds: [52,1122][912,1202]
   */
  get title() {
    return api.by.text(['输入密码', 'Enter passcode']);
  }

  /**
   * 关闭按钮 - Close Button
   * 位于标题右侧的关闭按钮，与标题在同一层级
   * bounds: [949,1123][1028,1201]
   */
  get closeBtn() {
    return api.by.xpath(
      '//android.view.ViewGroup[.//android.view.View[@text="输入密码" or @text="Enter passcode"]]/android.widget.Button[@clickable="true"]',
    );
  }

  /**
   * 密码输入框 - Password Input
   * resource-id: "pass-code-input"
   * bounds: [278,1254][803,1464]
   */
  get passwordInput() {
    return api.by.id('pass-code-input');
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
   * 点击关闭按钮
   */
  async clickCloseBtn() {
    await api.tap(this.closeBtn);
  }

  /**
   * 等待密码输入框显示
   */
  async waitForPasswordInput() {
    await api.waitPageByElement(this.passwordInput);
  }

  /**
   * 验证标题是否显示
   */
  async verifyTitleDisplayed() {
    const isDisplayed = await this.title.isDisplayed();
    return isDisplayed;
  }
}

export const inputPasscodePopup = new InputPasscodePopup();
