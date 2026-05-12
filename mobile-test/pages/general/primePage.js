/**
 * Prime页 - Prime Page (未登录状态)
 * 对应 xml: xmls/settings/primeNotLoginEnglish.xml
 */
import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';
import { executeByPlatform } from '../../util/index.js';

class PrimePage extends Page {
  get keyElement() {
    return this.oneKeyPrimeTitle;
  }

  // ========== 顶部导航栏元素 ==========

  /**
   * 关闭按钮 - Close Button
   * resource-id: "nav-header-close"
   */
  get closeBtn() {
    return api.by.id('nav-header-close');
  }

  // ========== 内容区域 ==========

  /**
   * OneKey Prime标题 - OneKey Prime Title
   * text: "OneKey Prime"
   */
  get oneKeyPrimeTitle() {
    return api.by.xpath('//android.widget.TextView[@text="OneKey Prime"]');
  }

  /**
   * Prime描述文本 - Prime Description
   * text: "Unlock advanced features to enhance your crypto asset management experience."
   */
  get primeDescription() {
    return api.by.xpath(
      '//android.widget.TextView[contains(@text, "Unlock advanced features")]',
    );
  }

  // ========== 功能卡片 ==========

  /**
   * OneKey Cloud卡片 - OneKey Cloud Card
   * text: "OneKey Cloud"
   */
  get oneKeyCloudCard() {
    return api.by.xpath('//android.widget.TextView[@text="OneKey Cloud"]');
  }

  /**
   * 批量复制地址卡片 - Bulk copy addresses Card
   * text: "Bulk copy addresses"
   */
  get bulkCopyAddressesCard() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Bulk copy addresses"]',
    );
  }

  /**
   * 批量撤销卡片 - Bulk revoke Card
   * text: "Bulk revoke"
   */
  get bulkRevokeCard() {
    return api.by.xpath('//android.widget.TextView[@text="Bulk revoke"]');
  }

  /**
   * 增加通知限制卡片 - Increase notification limit Card
   * text: "Increase notification limit"
   */
  get increaseNotificationLimitCard() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Increase notification limit"]',
    );
  }

  /**
   * 导出交易卡片 - Export transactions Card
   * text: "Export transactions"
   */
  get exportTransactionsCard() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Export transactions"]',
    );
  }

  // ========== 底部按钮 ==========

  /**
   * 订阅按钮 - Subscribe Button
   * text: "Subscribe for $239.00/year"
   * content-desc: "Subscribe for $239.00/year"
   * resource-id: "page-footer-confirm"
   */
  get subscribeBtn() {
    return api.by.id('page-footer-confirm');
  }

  /**
   * 订阅按钮文本 - Subscribe Button Text
   */
  get subscribeBtnText() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Subscribe for $239.00/year"]',
    );
  }

  /**
   * 条款文本 - Terms Text
   * text: "By subscribing to OneKey Prime you agree to..."
   */
  get termsText() {
    return api.by.xpath(
      '//android.widget.TextView[contains(@text, "By subscribing to OneKey Prime")]',
    );
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
   * 点击订阅按钮
   */
  async clickSubscribeBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.subscribeBtn);
      },
      async () => {
        await api.fixInterceptedClick('page-footer-confirm');
      },
    );
  }

  /**
   * 点击OneKey Cloud卡片
   */
  async clickOneKeyCloudCard() {
    await executeByPlatform(
      async () => {
        await api.tap(this.oneKeyCloudCard);
      },
      async () => {
        await api.fixInterceptedClick('OneKey Cloud');
      },
    );
  }

  /**
   * 点击批量复制地址卡片
   */
  async clickBulkCopyAddressesCard() {
    await executeByPlatform(
      async () => {
        await api.tap(this.bulkCopyAddressesCard);
      },
      async () => {
        await api.fixInterceptedClick('Bulk copy addresses');
      },
    );
  }

  /**
   * 点击批量撤销卡片
   */
  async clickBulkRevokeCard() {
    await executeByPlatform(
      async () => {
        await api.tap(this.bulkRevokeCard);
      },
      async () => {
        await api.fixInterceptedClick('Bulk revoke');
      },
    );
  }

  /**
   * 点击增加通知限制卡片
   */
  async clickIncreaseNotificationLimitCard() {
    await executeByPlatform(
      async () => {
        await api.tap(this.increaseNotificationLimitCard);
      },
      async () => {
        await api.fixInterceptedClick('Increase notification limit');
      },
    );
  }

  /**
   * 点击导出交易卡片
   */
  async clickExportTransactionsCard() {
    await executeByPlatform(
      async () => {
        await api.tap(this.exportTransactionsCard);
      },
      async () => {
        await api.fixInterceptedClick('Export transactions');
      },
    );
  }

  // ========== 验证方法 ==========

  /**
   * 等待Prime页显示
   */
  async waitForPrimePage() {
    await api.waitPageByElement(this.oneKeyPrimeTitle);
  }

  /**
   * 验证Prime页是否显示
   */
  async verifyPrimePageDisplayed() {
    const isDisplayed = await this.oneKeyPrimeTitle.isDisplayed();
    return isDisplayed;
  }
}

export const primePage = new PrimePage();
