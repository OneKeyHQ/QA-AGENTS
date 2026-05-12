import { api } from '@node-e2e/cli/api/index.js';
import Page from '../../base.js';

/**
 * Apple登录外部页面 - 在Chrome浏览器中显示的Apple登录页面
 * 从层级开始：//android.widget.FrameLayout[@resource-id="com.android.chrome:id/compositor_view_holder"]/android.widget.FrameLayout[2]
 */
class UseApplePage extends Page {
  /**
   * 页面关键元素 - 用于判断页面是否加载完成
   */
  get keyElement() {
    return this.pageTitle;
  }

  // ========== 页面标题元素 ==========

  /**
   * 页面标题 - "使用 Apple 账户登录"OneKey""
   * resource-id: "contentheader"
   * text: "使用 Apple 账户登录"OneKey""
   * bounds: [10,895][1068,966]
   * 定位方式：从指定层级开始，使用resource-id定位
   */
  get pageTitle() {
    return api.by.xpath(
      '//android.widget.FrameLayout[@resource-id="com.android.chrome:id/compositor_view_holder"]/android.widget.FrameLayout[2]//android.widget.TextView[@resource-id="contentheader"]',
    );
  }

  // ========== 表单元素 ==========

  /**
   * 账户输入框 - 电子邮件或电话号码输入框
   * resource-id: "account_name_text_field"
   * hint: "电子邮件或电话号码"
   * bounds: [10,1044][1068,1197]
   * 定位方式：从指定层级开始，使用resource-id定位
   */
  get accountInput() {
    return api.by.xpath(
      '//android.widget.FrameLayout[@resource-id="com.android.chrome:id/compositor_view_holder"]/android.widget.FrameLayout[2]//android.widget.EditText[@resource-id="account_name_text_field"]',
    );
  }

  /**
   * 继续按钮 - 提交账户信息的按钮
   * resource-id: "sign-in"
   * text: "继续"
   * bounds: [10,1554][527,1656]
   * 定位方式：从指定层级开始，使用resource-id定位
   */
  get continueButton() {
    return api.by.xpath(
      '//android.widget.FrameLayout[@resource-id="com.android.chrome:id/compositor_view_holder"]/android.widget.FrameLayout[2]//android.widget.Button[@resource-id="sign-in"]',
    );
  }

  /**
   * 通过 iPhone 登录按钮 - 使用iPhone设备登录的按钮
   * resource-id: "swp"
   * text: "通过 iPhone 登录"
   * bounds: [551,1554][1068,1656]
   * 定位方式：从指定层级开始，使用resource-id定位
   */
  get loginWithiPhoneButton() {
    return api.by.xpath(
      '//android.widget.FrameLayout[@resource-id="com.android.chrome:id/compositor_view_holder"]/android.widget.FrameLayout[2]//android.widget.Button[@resource-id="swp"]',
    );
  }

  /**
   * 隐私说明文本 - 关于数据管理的说明文本
   * text: "在设置"通过 Apple 登录"时，Apple 可能会使用你与 Apple 以及此设备互动的相关信息来帮助预防欺诈。"
   * bounds: [73,1386][1005,1470]
   * 定位方式：从指定层级开始，使用文本内容定位
   */
  get privacyText() {
    return api.by.xpath(
      '//android.widget.FrameLayout[@resource-id="com.android.chrome:id/compositor_view_holder"]/android.widget.FrameLayout[2]//android.widget.TextView[contains(@text, "在设置"通过 Apple 登录"时")]',
    );
  }

  /**
   * 了解数据管理方式链接 - 可点击的链接
   * content-desc: "了解数据的管理方式… 在新窗口中打开。"
   * bounds: [651,1428][963,1470]
   * 定位方式：从指定层级开始，使用content-desc定位
   */
  get learnMoreLink() {
    return api.by.xpath(
      '//android.widget.FrameLayout[@resource-id="com.android.chrome:id/compositor_view_holder"]/android.widget.FrameLayout[2]//android.view.View[@content-desc="了解数据的管理方式… 在新窗口中打开。"]',
    );
  }

  // ========== 操作方法 ==========

  /**
   * 输入账户信息（电子邮件或电话号码）
   * @param {string} account - 账户信息（邮箱或手机号）
   */
  async inputAccount(account) {
    await api.setValue(this.accountInput, account);
  }

  /**
   * 点击继续按钮
   */
  async clickContinueButton() {
    await api.tap(this.continueButton);
  }

  /**
   * 点击通过 iPhone 登录按钮
   */
  async clickLoginWithiPhoneButton() {
    await api.tap(this.loginWithiPhoneButton);
  }

  /**
   * 点击了解数据管理方式链接
   */
  async clickLearnMoreLink() {
    await api.tap(this.learnMoreLink);
  }

  /**
   * 获取页面标题文本
   * @returns {Promise<string>} 页面标题文本
   */
  async getPageTitle() {
    return await api.getText(this.pageTitle);
  }

  /**
   * 获取账户输入框的提示文本
   * @returns {Promise<string>} 提示文本
   */
  async getAccountInputHint() {
    return await api.getAttribute(this.accountInput, 'hint');
  }

  /**
   * 获取继续按钮文本
   * @returns {Promise<string>} 按钮文本
   */
  async getContinueButtonText() {
    return await api.getText(this.continueButton);
  }

  /**
   * 获取通过 iPhone 登录按钮文本
   * @returns {Promise<string>} 按钮文本
   */
  async getLoginWithiPhoneButtonText() {
    return await api.getText(this.loginWithiPhoneButton);
  }

  /**
   * 验证页面是否已加载
   * 通过检查关键元素是否存在来判断
   */
  async verifyPageLoaded() {
    await this.waitEntryPage();
    await this.assertCurrentPage();
  }
}

export const useApplePage = new UseApplePage();
