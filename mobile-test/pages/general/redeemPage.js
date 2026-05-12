/**
 * 兑换页 - Redeem Page
 * 对应 xml: xmls/popups/redeemLoginedPopupEnglish.xml
 */
import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';
import { executeByPlatform } from '../../util/index.js';

class RedeemPage extends Page {
  get keyElement() {
    return this.redeemTitle;
  }

  // ========== 顶部导航栏元素 ==========

  /**
   * 返回按钮 - Back Button
   * resource-id: "nav-header-back"
   */
  get backBtn() {
    return api.by.id('nav-header-back');
  }

  /**
   * 兑换标题 - Redeem Title
   * text: "Redeem"
   */
  get redeemTitle() {
    return api.by.xpath('//android.widget.TextView[@text="Redeem"]');
  }

  // ========== 操作方法 ==========

  /**
   * 点击返回按钮
   */
  async clickBackBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.backBtn);
      },
      async () => {
        await api.fixInterceptedClick('nav-header-back');
      },
    );
  }

  // ========== 验证方法 ==========

  /**
   * 等待兑换页显示
   */
  async waitForRedeemPage() {
    await api.waitPageByElement(this.redeemTitle);
  }

  /**
   * 验证兑换页是否显示
   */
  async verifyRedeemPageDisplayed() {
    const isDisplayed = await this.redeemTitle.isDisplayed();
    return isDisplayed;
  }
}

export const redeemPage = new RedeemPage();
