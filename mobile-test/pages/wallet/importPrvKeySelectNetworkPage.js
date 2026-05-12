import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';

/**
 * 导入私钥 - 选择网络页面
 * 来源: xmls/wallets/importPrvKeySelectNetworkChinese.xml
 */
class ImportPrvKeySelectNetworkPage extends Page {
  get keyElement() {
    return this.pageTitle;
  }

  // ========== 顶部导航 ==========

  get pageTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="选择网络"]',
    );
  }

  get backButton() {
    return api.by.xpath(
      '//android.widget.TextView[@text="选择网络"]/ancestor::android.view.ViewGroup[1]//android.widget.Button[1]',
    );
  }

  get closeButton() {
    return this.backIcon;
  }

  // ========== 网络分组与选项 ==========

  /** EVM 兼容网络 分组标题 */
  get evmNetworkSection() {
    return api.by.xpath(
      '//android.widget.TextView[@text="EVM 兼容网络"]',
    );
  }

  /** Cosmos 兼容网络 */
  get cosmosNetworkSection() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Cosmos 兼容网络"]',
    );
  }

  /** Polkadot 兼容网络 */
  get polkadotNetworkSection() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Polkadot 兼容网络"]',
    );
  }

  /** 按网络名称获取可点击的网络项（如 Kaspa、Aptos、SUI、Conflux、BenFen） */
  getNetworkItemByName(name) {
    return api.by.xpath(
      `//android.view.ViewGroup[@clickable="true"][.//android.widget.TextView[@text="${name}"]]`,
    );
  }

  /** 显示更多网络按钮 */
  get showMoreNetworksButton() {
    return api.by.xpath(
      '//android.widget.Button[@content-desc="显示更多网络" or .//android.widget.TextView[@text="显示更多网络"]]',
    );
  }

  get cannotFindNetworkHint() {
    return api.by.xpath(
      '//android.widget.TextView[@text="找不到您的网络？"]',
    );
  }

  // ========== 底部确认 ==========

  get confirmButton() {
    return api.by.xpath(
      '//android.widget.Button[@content-desc="确认" or .//android.widget.TextView[@text="确认"]]',
    );
  }

  // ========== 操作方法 ==========

  async clickBackButton() {
    await api.tap(this.backButton);
  }

  async clickNetworkByName(name) {
    await api.tap(this.getNetworkItemByName(name));
  }

  async clickShowMoreNetworks() {
    await api.tap(this.showMoreNetworksButton);
  }

  async clickConfirm() {
    await api.tap(this.confirmButton);
  }
}

export const importPrvKeySelectNetworkPage = new ImportPrvKeySelectNetworkPage();
