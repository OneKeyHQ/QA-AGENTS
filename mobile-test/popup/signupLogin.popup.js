import Page from '../pages/base.js';
import { api } from '@node-e2e/cli/api/index.js';

/**
 * 注册/登录弹层 - Sign up / Login Popup
 * 参考：xmls/popups/signupLoginPopupEnglish.xml
 * 弹层容器路径：//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[4]
 */
class SignupLoginPopup extends Page {
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
   * 关闭按钮 - Close Button
   * 位于弹层容器内的右上角
   * bounds: [949,1507][1028,1585]
   * 使用弹层容器内的相对路径定位
   */
  get closeBtn() {
    return api.by.xpath(
      '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[4]//android.widget.Button[contains(@bounds, "949") and contains(@bounds, "1507")]',
    );
  }

  /**
   * 标题 - Title
   * text: "Sign up / Login"
   * bounds: [52,1706][912,1786]
   */
  get title() {
    return api.by.xpath('//android.view.View[@text="Sign up / Login"]');
  }

  /**
   * 描述文本 - Description Text
   * text: "OneKey ID is all you need to access all OneKey services and earn referral rewards."
   * bounds: [52,1801][912,1927]
   */
  get description() {
    return api.by.xpath(
      '//android.widget.TextView[@text="OneKey ID is all you need to access all OneKey services and earn referral rewards."]',
    );
  }

  /**
   * 邮箱输入框 - Email Input
   * text: "your@email.com"
   * hint: "your@email.com"
   * bounds: [56,1983][1026,2099]
   */
  get emailInput() {
    return api.by.xpath(
      '//android.widget.EditText[@hint="your@email.com" or @text="your@email.com"]',
    );
  }

  /**
   * Continue按钮 - Continue Button
   * content-desc: "Continue"
   * text: "Continue"
   * bounds: [53,2153][1028,2284]
   */
  get continueBtn() {
    return api.by.xpath(
      '//android.widget.Button[@content-desc="Continue" or @text="Continue"]',
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
   * 点击关闭按钮
   */
  async clickCloseBtn() {
    await api.tap(this.closeBtn);
  }

  /**
   * 输入邮箱
   * @param {string} email - 邮箱地址
   */
  async inputEmail(email) {
    await api.setValue(this.emailInput, email);
  }

  /**
   * 点击Continue按钮
   */
  async clickContinueBtn() {
    await api.tap(this.continueBtn);
  }

  /**
   * 等待Continue按钮显示
   */
  async waitForContinueBtn() {
    await api.waitPageByElement(this.continueBtn);
  }

  /**
   * 等待Continue按钮可点击（enabled）
   */
  async waitForContinueBtnEnabled() {
    await this.continueBtn.waitForEnabled({ timeout: 10000 });
  }

  /**
   * 验证标题是否显示
   */
  async verifyTitleDisplayed() {
    const isDisplayed = await this.title.isDisplayed();
    return isDisplayed;
  }

  /**
   * 验证描述文本是否显示
   */
  async verifyDescriptionDisplayed() {
    const isDisplayed = await this.description.isDisplayed();
    return isDisplayed;
  }

  /**
   * 验证邮箱输入框是否显示
   */
  async verifyEmailInputDisplayed() {
    const isDisplayed = await this.emailInput.isDisplayed();
    return isDisplayed;
  }

  /**
   * 完整的注册/登录流程
   * @param {string} email - 邮箱地址
   */
  async signupOrLogin(email) {
    await this.waitForPopup();
    await this.inputEmail(email);
    await this.waitForContinueBtnEnabled();
    await this.clickContinueBtn();
  }
}

export const signupLoginPopup = new SignupLoginPopup();
