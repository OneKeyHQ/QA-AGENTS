import Page from '../pages/base.js';
import { api } from '@node-e2e/cli/api/index.js';

/**
 * Redeem 弹层 - Redeem Popup
 * 参考：xmls/popups/redeemLoginedPopupEnglish.xml
 * 弹层容器路径：//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[4]
 */
class RedeemPopup extends Page {
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
   * bounds: [949,1402][1028,1480]
   */
  get closeBtn() {
    return api.by.xpath(
      '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[4]//android.widget.Button[contains(@bounds, "949") and contains(@bounds, "1402")]',
    );
  }

  /**
   * History按钮 - History Button
   * content-desc: "History"
   * text: "History"
   * bounds: [29,1388][210,1478]
   */
  get historyBtn() {
    return api.by.xpath(
      '//android.widget.Button[@content-desc="History" or @text="History"]',
    );
  }

  /**
   * 标题 - Title
   * text: "Redemption center"
   * bounds: [317,1727][762,1801]
   */
  get title() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Redemption center"]',
    );
  }

  /**
   * 描述文本 - Description Text
   * text: "Enter code to claim exclusive rewards"
   * bounds: [189,1811][890,1874]
   */
  get description() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Enter code to claim exclusive rewards"]',
    );
  }

  /**
   * 兑换码输入框 - Redeem Code Input
   * hint: "Enter the Code"
   * text: "Enter the Code"
   * bounds: [56,1930][1026,2045]
   */
  get codeInput() {
    return api.by.xpath(
      '//android.widget.EditText[@hint="Enter the Code" or @text="Enter the Code"]',
    );
  }

  /**
   * Redeem按钮 - Redeem Button
   * content-desc: "Redeem"
   * text: "Redeem"
   * bounds: [53,2153][1028,2284]
   */
  get redeemBtn() {
    return api.by.xpath(
      '//android.widget.Button[@content-desc="Redeem" or @text="Redeem"]',
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
   * 点击History按钮
   */
  async clickHistoryBtn() {
    await api.tap(this.historyBtn);
  }

  /**
   * 输入兑换码
   * @param {string} code - 兑换码
   */
  async inputCode(code) {
    await api.setValue(this.codeInput, code);
  }

  /**
   * 点击Redeem按钮
   */
  async clickRedeemBtn() {
    await api.tap(this.redeemBtn);
  }

  /**
   * 等待Redeem按钮显示
   */
  async waitForRedeemBtn() {
    await api.waitPageByElement(this.redeemBtn);
  }

  /**
   * 等待Redeem按钮可点击（enabled）
   */
  async waitForRedeemBtnEnabled() {
    await this.redeemBtn.waitForEnabled({ timeout: 10000 });
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
   * 验证兑换码输入框是否显示
   */
  async verifyCodeInputDisplayed() {
    const isDisplayed = await this.codeInput.isDisplayed();
    return isDisplayed;
  }

  /**
   * 完整的兑换流程
   * @param {string} code - 兑换码
   */
  async redeemCode(code) {
    await this.waitForPopup();
    await this.inputCode(code);
    await this.waitForRedeemBtnEnabled();
    await this.clickRedeemBtn();
  }
}

export const redeemPopup = new RedeemPopup();
