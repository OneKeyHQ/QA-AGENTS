import Page from '../pages/base.js';
import { api } from '@node-e2e/cli/api/index.js';

const CONFIRM_PASSWORD_CONTAINER_XPATH =
  '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[4]';

/**
 * ConfirmPassword 弹层 - Confirm Password Popup
 * 参考：xmls/popups/confirmPasswordPopupEnglish.xml
 * 弹层容器路径：见 CONFIRM_PASSWORD_CONTAINER_XPATH
 */
class ConfirmPasswordPopup extends Page {
  /**
   * 弹层容器 - Popup Container
   */
  get container() {
    return api.by.xpath(CONFIRM_PASSWORD_CONTAINER_XPATH);
  }

  /**
   * 确认密码输入框 - Confirm Password Input
   * resource-id: "confirm-pass-code"
   * bounds: [278,2073][803,2283]
   */
  get confirmPasswordInput() {
    return api.by.id('confirm-pass-code');
  }

  /**
   * 是否使用生物识别进行身份验证的开关 - Biometric auth Switch
   * android.widget.Switch，默认打开（checked=true）
   */
  get biometricSwitch() {
    return api.by.xpath(
      `${CONFIRM_PASSWORD_CONTAINER_XPATH}//android.widget.Switch`,
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
   * 输入确认密码
   * @param {string} password - 确认密码
   */
  async inputConfirmPassword(password) {
    await api.setValue(this.confirmPasswordInput, password);
  }

  /**
   * 等待确认密码输入框显示
   */
  async waitForConfirmPasswordInput() {
    await api.waitPageByElement(this.confirmPasswordInput);
  }

  /**
   * 获取生物识别开关状态
   * @returns {Promise<boolean>} true=打开，false=关闭。默认打开
   */
  async getBiometricSwitchState() {
    try {
      const checked = await this.biometricSwitch.getAttribute('checked');
      return checked === 'true';
    } catch {
      return null; // 当前 UI 无此开关
    }
  }

  /**
   * 设置生物识别开关状态（通过点击切换）
   * 若当前版本弹层无此 Switch 则跳过，不抛错
   * @param {boolean} enabled - 期望状态 true=打开，false=关闭
   */
  async setBiometricSwitch(enabled) {
    try {
      const current = await this.getBiometricSwitchState();
      if (current !== null && current !== enabled) {
        await api.tap(this.biometricSwitch);
      }
    } catch {
      // 弹层无生物识别开关或结构变化时跳过
    }
  }
}

export const confirmPasswordPopup = new ConfirmPasswordPopup();
