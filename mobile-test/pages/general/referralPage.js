/**
 * 推荐页 - Referral Page
 * 对应 xml: Referral_English.xml
 */
import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';
import { executeByPlatform } from '../../util/index.js';

class ReferralPage extends Page {
  get keyElement() {
    return this.referralTitle;
  }

  // ========== 顶部导航栏元素 ==========

  /**
   * 关闭按钮 - Close Button
   * resource-id: "nav-header-close"
   */
  get closeBtn() {
    return api.by.id('nav-header-close');
  }

  /**
   * 推荐标题 - Referral Title
   * text: "Referral"
   */
  get referralTitle() {
    return api.by.xpath('//android.view.View[@text="Referral"]');
  }

  // ========== 内容区域 ==========

  /**
   * 邀请朋友标题 - Invite friends title
   * text: "Invite friends, earn about $55* for each one"
   */
  get inviteFriendsTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Invite friends, earn about $55* for each one"]',
    );
  }

  /**
   * 你赚取文本 - You earn text
   * text: "You earn up to 20% on every wallet sale"
   */
  get youEarnText() {
    return api.by.xpath(
      '//android.widget.TextView[@text="You earn up to 20% on every wallet sale"]',
    );
  }

  /**
   * 他们节省文本 - They save text
   * text: "They save $27* on their purchase"
   */
  get theySaveText() {
    return api.by.xpath(
      '//android.widget.TextView[@text="They save $27* on their purchase"]',
    );
  }

  /**
   * 说明文本 - Disclaimer text
   * text: "*Based on OneKey Pro price and the maximum commission rate"
   */
  get disclaimerText() {
    return api.by.xpath(
      '//android.widget.TextView[contains(@text, "*Based on OneKey Pro price")]',
    );
  }

  // ========== 底部按钮 ==========

  /**
   * 下一步按钮 - Next Button
   * text: "Next"
   * content-desc: "Next"
   */
  get nextBtn() {
    return api.by.xpath('//android.widget.Button[@content-desc="Next"]');
  }

  // ========== 操作方法 ==========

  /**
   * 点击关闭按钮
   */
  async clickCloseBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.closeBtn);
      },
      async () => {
        await api.fixInterceptedClick('nav-header-close');
      },
    );
  }

  /**
   * 点击下一步按钮
   */
  async clickNextBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.nextBtn);
      },
      async () => {
        await api.fixInterceptedClick('Next');
      },
    );
  }

  // ========== 验证方法 ==========

  /**
   * 等待推荐页显示
   */
  async waitForReferralPage() {
    await api.waitPageByElement(this.referralTitle);
  }

  /**
   * 验证推荐页是否显示
   */
  async verifyReferralPageDisplayed() {
    const isDisplayed = await this.referralTitle.isDisplayed();
    return isDisplayed;
  }
}

export const referralPage = new ReferralPage();
