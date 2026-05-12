import { api } from '@node-e2e/cli/api/index.js';
import Page from '../../base.js';

/**
 * Google登录外部页面 - 在Google Play Services中显示的Google登录页面
 * 注意：由于是WebView内容，元素定位可能不稳定，主要用于页面检测
 */
class UseGooglePage extends Page {
  /**
   * 页面关键元素 - 用于判断页面是否加载完成
   * 使用WebView或"下一步"按钮作为检测元素
   */
  get keyElement() {
    return this.nextButton;
  }

  // ========== 页面检测元素 ==========

  /**
   * WebView容器 - Google登录页面的WebView
   * class: "android.webkit.WebView"
   * package: "com.google.android.gms"
   * bounds: [0,63][1080,2148]
   * 定位方式：使用WebView类定位
   */
  get webView() {
    return api.by.xpath(
      '//android.webkit.WebView[@package="com.google.android.gms"]',
    );
  }

  /**
   * 下一步按钮 - 页面底部的"下一步"按钮
   * text: "下一步"
   * package: "com.google.android.gms"
   * bounds: [796,2179][1027,2305]
   * 定位方式：使用文本和package定位
   */
  get nextButton() {
    return api.by.xpath(
      '//android.widget.Button[@package="com.google.android.gms" and @text="下一步"]',
    );
  }

  // ========== 操作方法 ==========

  /**
   * 点击下一步按钮
   * 注意：由于WebView内容动态变化，此方法可能不稳定
   */
  async clickNextButton() {
    await api.tap(this.nextButton);
  }

  /**
   * 获取下一步按钮文本
   * @returns {Promise<string>} 按钮文本
   */
  async getNextButtonText() {
    return await api.getText(this.nextButton);
  }

  /**
   * 验证页面是否已加载
   * 通过检查关键元素是否存在来判断
   */
  async verifyPageLoaded() {
    await this.waitEntryPage();
    await this.assertCurrentPage();
  }

  /**
   * 检查WebView是否存在
   * @returns {Promise<boolean>} WebView是否存在
   */
  async isWebViewDisplayed() {
    try {
      return await this.webView.isDisplayed();
    } catch (error) {
      return false;
    }
  }
}

export const useGooglePage = new UseGooglePage();
