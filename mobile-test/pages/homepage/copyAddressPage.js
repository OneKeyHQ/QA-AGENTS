import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';

/**
 * 复制地址页面 - 从首页进入的「账户地址」弹层，用于选择网络并复制地址
 * 基于 xmls/homePage/homepageCopyAddressPageChinese610.xml
 *
 * 主要元素：
 * - 标题：账户地址 / Account Address
 * - 关闭按钮：nav-header-close
 * - 搜索框：nav-header-search，hint「搜索网络」
 * - 列表项：每行为可点击 ViewGroup，含网络名 + 地址/「创建地址」副标题（select-item-subtitle-）
 */
class CopyAddressPage extends Page {
  /**
   * 页面关键元素 - 用于判断页面是否加载完成
   */
  get keyElement() {
    return this.pageTitle;
  }

  // ========== 顶部导航栏 ==========

  /**
   * 页面标题 - "账户地址" / "Account Address"
   * 来源 XML: android.view.View text="账户地址" bounds="[169,159][381,233]"
   */
  get pageTitle() {
    return api.by.xpath(
      '//android.view.View[@text="账户地址" or @text="Account Address"]',
    );
  }

  /**
   * 关闭按钮 - 左上角关闭
   * resource-id: "nav-header-close"
   */
  get closeButton() {
    return api.by.id('nav-header-close');
  }

  // ========== 搜索区域 ==========

  /**
   * 搜索输入框 - 搜索网络
   * resource-id: "nav-header-search"
   * hint: "搜索网络" / "Search network"
   */
  get searchInput() {
    return api.by.id('nav-header-search');
  }

  // ========== 地址列表 ==========

  /**
   * 获取指定网络名称对应的地址行（整行可点击）
   * 来源 XML: android.view.ViewGroup clickable="true" 内包含 TextView 网络名 + TextView resource-id="select-item-subtitle-"
   * @param {string} networkName - 网络名称，如 "Bitcoin", "Ethereum", "Lightning Network", "Tron", "Solana"
   * @returns {WebdriverIO.Element} 该行元素
   */
  getAddressRowByNetworkName(networkName) {
    return api.by.xpath(
      `//android.view.ViewGroup[@clickable="true" and .//android.widget.TextView[@text="${networkName}"]]`,
    );
  }

  /**
   * 获取列表中带指定副标题（地址或「创建地址」）的某一项
   * 可用于校验或按副标题定位
   * @param {string} subtitle - 副标题文本，如 "创建地址" 或地址缩写 "bc1pc945...u23c8v"
   * @returns {WebdriverIO.Element}
   */
  getAddressRowBySubtitle(subtitle) {
    return api.by.xpath(
      `//android.widget.TextView[@resource-id="select-item-subtitle-" and contains(@text,"${subtitle}")]/ancestor::android.view.ViewGroup[@clickable="true"]`,
    );
  }

  /**
   * 获取第 n 个搜索结果行的副标题元素（0-based）
   * 用于搜索后按顺序取地址/「创建地址」文案
   * @param {number} n - 序号 0-based
   * @returns {WebdriverIO.Element}
   */
  getNthSearchResultSubtitleElement(n) {
    return api.by.xpath(
      `(//android.widget.TextView[@resource-id="select-item-subtitle-"])[${n + 1}]`,
    );
  }

  /**
   * 获取第 n 个搜索结果行（整行可点击，0-based），用于点击「创建地址」等
   * @param {number} n - 序号 0-based
   * @returns {WebdriverIO.Element}
   */
  getNthSearchResultRow(n) {
    return api.by.xpath(
      `(//android.widget.TextView[@resource-id="select-item-subtitle-"])[${n + 1}]/ancestor::android.view.ViewGroup[@clickable="true"][1]`,
    );
  }

  /**
   * BTC 搜索结果中的地址类型标签：Taproot
   * 约定：搜索 BTC 后该元素应存在
   */
  get btcTaprootTypeLabel() {
    return api.by.xpath('//android.widget.TextView[@text="Taproot"]');
  }

  /**
   * LTC 搜索结果中的地址类型标签：Nested SegWit
   * 约定：搜索 LTC 后该元素应存在
   */
  get ltcNestedSegWitTypeLabel() {
    return api.by.xpath('//android.widget.TextView[@text="Nested SegWit"]');
  }

  // ========== 常用网络快捷 getter（与 XML 中列表一致）==========

  /** Bitcoin 地址行 */
  get bitcoinAddressRow() {
    return this.getAddressRowByNetworkName('Bitcoin');
  }

  /** Lightning Network 地址行 */
  get lightningAddressRow() {
    return this.getAddressRowByNetworkName('Lightning Network');
  }

  /** Ethereum 地址行 */
  get ethereumAddressRow() {
    return this.getAddressRowByNetworkName('Ethereum');
  }

  /** Tron 地址行 */
  get tronAddressRow() {
    return this.getAddressRowByNetworkName('Tron');
  }

  /** Solana 地址行 */
  get solanaAddressRow() {
    return this.getAddressRowByNetworkName('Solana');
  }

  /** BNB Chain 地址行 */
  get bnbChainAddressRow() {
    return this.getAddressRowByNetworkName('BNB Chain');
  }

  /** Polygon 地址行 */
  get polygonAddressRow() {
    return this.getAddressRowByNetworkName('Polygon');
  }

  /** TON 地址行 */
  get tonAddressRow() {
    return this.getAddressRowByNetworkName('TON');
  }

  /** Arbitrum 地址行 */
  get arbitrumAddressRow() {
    return this.getAddressRowByNetworkName('Arbitrum');
  }

  // ========== 操作方法 ==========

  /**
   * 点击关闭按钮，关闭复制地址页
   */
  async clickCloseButton() {
    await api.tap(this.closeButton);
  }

  /**
   * 在搜索框中输入文本（搜索网络）
   * @param {string} text - 搜索关键词
   */
  async inputSearchText(text) {
    await api.setValue(this.searchInput, text);
  }

  /**
   * 清空搜索框（api 无 clearValue，用 setValue 清空）
   */
  async clearSearchInput() {
    await api.setValue(this.searchInput, '');
  }

  /**
   * 点击指定网络的地址行（会触发复制或进入该网络地址详情）
   * @param {string} networkName - 网络名称，如 "Bitcoin", "Ethereum"
   */
  async clickAddressRow(networkName) {
    const row = this.getAddressRowByNetworkName(networkName);
    await api.tap(row);
  }

  /**
   * 点击第 n 个搜索结果行的副标题元素（0-based）
   * @param {number} n - 序号 0-based
   */
  async clickNthSearchResultSubtitleElement(n) {
    await api.tap(this.getNthSearchResultSubtitleElement(n));
  }

  /**
   * 点击 BTC 搜索结果中的 Taproot 地址类型标签
   */
  async clickBtcTaprootTypeLabel() {
    await api.tap(this.btcTaprootTypeLabel);
  }

  /**
   * 点击 LTC 搜索结果中的 Nested SegWit 地址类型标签
   */
  async clickLtcNestedSegWitTypeLabel() {
    await api.tap(this.ltcNestedSegWitTypeLabel);
  }

  /**
   * 等待进入复制地址页面
   * @param {number} [timeout] - 超时时间（毫秒）
   */
  async waitEntryPage(timeout) {
    await api.waitPageByElement(this.keyElement, timeout);
  }
}

export default CopyAddressPage;
