/**
 * 网络设置页 - Network Settings Page
 * 对应 xml: xmls/settings/networkSettingsEnglish.xml
 */
import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';
import { executeByPlatform } from '../../util/index.js';

class NetworkSettingsPage extends Page {
  get keyElement() {
    return this.networkTitle;
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
   * 网络标题 - Network Title
   * text: "Network"
   */
  get networkTitle() {
    return api.by.xpath('//android.view.View[@text="Network"]');
  }

  // ========== 网络设置选项 ==========

  /**
   * 添加自定义网络 - Add custom network
   * text: "Add custom network"
   * resource-id: "select-item-"
   */
  get addCustomNetworkBtn() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Add custom network"]',
    );
  }

  /**
   * 自定义RPC - Custom RPC
   * text: "Custom RPC"
   * resource-id: "select-item-"
   */
  get customRpcBtn() {
    return api.by.xpath('//android.widget.TextView[@text="Custom RPC"]');
  }

  /**
   * 导出自定义网络配置 - Export custom network config
   * text: "Export custom network config"
   * resource-id: "select-item-"
   */
  get exportCustomNetworkConfigBtn() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Export custom network config"]',
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
   * 点击添加自定义网络按钮
   */
  async clickAddCustomNetworkBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.addCustomNetworkBtn);
      },
      async () => {
        await api.fixInterceptedClick('Add custom network');
      },
    );
  }

  /**
   * 点击自定义RPC按钮
   */
  async clickCustomRpcBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.customRpcBtn);
      },
      async () => {
        await api.fixInterceptedClick('Custom RPC');
      },
    );
  }

  /**
   * 点击导出自定义网络配置按钮
   */
  async clickExportCustomNetworkConfigBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.exportCustomNetworkConfigBtn);
      },
      async () => {
        await api.fixInterceptedClick('Export custom network config');
      },
    );
  }

  // ========== 验证方法 ==========

  /**
   * 等待网络设置页显示
   */
  async waitForNetworkSettingsPage() {
    await api.waitPageByElement(this.networkTitle);
  }

  /**
   * 验证网络设置页是否显示
   */
  async verifyNetworkSettingsPageDisplayed() {
    const isDisplayed = await this.networkTitle.isDisplayed();
    return isDisplayed;
  }
}

export const networkSettingsPage = new NetworkSettingsPage();
