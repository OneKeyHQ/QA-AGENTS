import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';

/**
 * 创建您的钱包页面（创建过程中展示进度/助记词等）
 * 来源: xmls/wallets/creatingWalletChinese.xml
 */
class CreatingWalletPage extends Page {
  get keyElement() {
    return this.pageTitle;
  }

  // ========== 页面标识 ==========

  get pageTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="创建您的钱包"]',
    );
  }

  /** 提示文案：设置过程中请勿退出应用，否则创建将失败 */
  get doNotExitHint() {
    return api.by.xpath(
      '//android.widget.TextView[@text="设置过程中请勿退出应用，否则创建将失败"]',
    );
  }

  /** 中央图标/动画区域 */
  get centerIconArea() {
    return api.by.xpath(
      '//android.widget.TextView[@text="创建您的钱包"]/preceding-sibling::android.view.ViewGroup[1]',
    );
  }

  // ========== 操作方法 ==========

  async waitUntilCreated(timeout = 60000) {
    await api.waitPageByElement(this.pageTitle, timeout);
  }

  async isDisplayed() {
    return await this.pageTitle.isDisplayed();
  }
}

export const creatingWalletPage = new CreatingWalletPage();
