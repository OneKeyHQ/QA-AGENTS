/**
 * 安全设置页 - Security Settings Page
 * 对应 xml: xmls/settings/securitySettingsEnglish.xml
 */
import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';
import { executeByPlatform } from '../../util/index.js';

class SecuritySettingsPage extends Page {
  get keyElement() {
    return this.securityTitle;
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
   * 安全标题 - Security Title
   * text: "Security"
   */
  get securityTitle() {
    return api.by.xpath('//android.view.View[@text="Security"]');
  }

  // ========== 设置选项 ==========

  /**
   * 设置密码选项 - Set passcode Option
   * text: "Set passcode"
   * resource-id: "select-item-"
   */
  get setPasscodeOption() {
    return api.by.xpath('//android.widget.TextView[@text="Set passcode"]');
  }

  /**
   * 保护选项 - Protection Option
   * text: "Protection"
   * resource-id: "select-item-"
   */
  get protectionOption() {
    return api.by.xpath('//android.widget.TextView[@text="Protection"]');
  }

  /**
   * 已连接站点选项 - Connected sites Option
   * text: "Connected sites"
   * resource-id: "select-item-"
   */
  get connectedSitesOption() {
    return api.by.xpath('//android.widget.TextView[@text="Connected sites"]');
  }

  /**
   * 签名记录选项 - Signature record Option
   * text: "Signature record"
   * resource-id: "select-item-"
   */
  get signatureRecordOption() {
    return api.by.xpath('//android.widget.TextView[@text="Signature record"]');
  }

  /**
   * 清除应用缓存选项 - Clear cache on App Option
   * text: "Clear cache on App"
   * resource-id: "select-item-"
   */
  get clearCacheOption() {
    return api.by.xpath('//android.widget.TextView[@text="Clear cache on App"]');
  }

  /**
   * 清除待处理交易选项 - Clear pending transactions Option
   * text: "Clear pending transactions"
   * resource-id: "select-item-"
   */
  get clearPendingTransactionsOption() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Clear pending transactions"]',
    );
  }

  /**
   * 重置应用选项 - Reset App Option
   * text: "Reset App"
   * resource-id: "select-item-setting-erase-data"
   * resource-id: "setting-erase-data"
   */
  get resetAppOption() {
    return api.by.id('setting-erase-data');
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
   * 点击设置密码选项
   */
  async clickSetPasscodeOption() {
    await executeByPlatform(
      async () => {
        await api.tap(this.setPasscodeOption);
      },
      async () => {
        await api.fixInterceptedClick('Set passcode');
      },
    );
  }

  /**
   * 点击保护选项
   */
  async clickProtectionOption() {
    await executeByPlatform(
      async () => {
        await api.tap(this.protectionOption);
      },
      async () => {
        await api.fixInterceptedClick('Protection');
      },
    );
  }

  /**
   * 点击已连接站点选项
   */
  async clickConnectedSitesOption() {
    await executeByPlatform(
      async () => {
        await api.tap(this.connectedSitesOption);
      },
      async () => {
        await api.fixInterceptedClick('Connected sites');
      },
    );
  }

  /**
   * 点击签名记录选项
   */
  async clickSignatureRecordOption() {
    await executeByPlatform(
      async () => {
        await api.tap(this.signatureRecordOption);
      },
      async () => {
        await api.fixInterceptedClick('Signature record');
      },
    );
  }

  /**
   * 点击清除应用缓存选项
   */
  async clickClearCacheOption() {
    await executeByPlatform(
      async () => {
        await api.tap(this.clearCacheOption);
      },
      async () => {
        await api.fixInterceptedClick('Clear cache on App');
      },
    );
  }

  /**
   * 点击清除待处理交易选项
   */
  async clickClearPendingTransactionsOption() {
    await executeByPlatform(
      async () => {
        await api.tap(this.clearPendingTransactionsOption);
      },
      async () => {
        await api.fixInterceptedClick('Clear pending transactions');
      },
    );
  }

  /**
   * 点击重置应用选项
   */
  async clickResetAppOption() {
    await executeByPlatform(
      async () => {
        await api.scrollToId('setting-erase-data');
        await api.tap(this.resetAppOption);
      },
      async () => {
        await api.fixInterceptedClick('setting-erase-data');
      },
    );
  }

  // ========== 验证方法 ==========

  /**
   * 等待安全设置页显示
   */
  async waitForSecuritySettingsPage() {
    await api.waitPageByElement(this.securityTitle);
  }

  /**
   * 验证安全设置页是否显示
   */
  async verifySecuritySettingsPageDisplayed() {
    const isDisplayed = await this.securityTitle.isDisplayed();
    return isDisplayed;
  }
}

export const securitySettingsPage = new SecuritySettingsPage();
