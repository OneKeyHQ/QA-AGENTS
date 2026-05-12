import { api } from '@node-e2e/cli/api/index.js';
import { detectPlatform, PLATFORMS } from '@node-e2e/cli/utils/detectPlatform.js';
import Page from '../base.js';

/**
 * 页面内容根节点 XPath（6.1.0 新 DOM）
 * 用于限定本页元素层级，避免与其他页面混淆
 */
const PAGE_ROOT_XPATH =
  '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[2]/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup[1]';

/**
 * 网络选择页面 - 用户选择网络的页面
 * 基于 xmls/general/networkSelectPageChinese610.xml 层级
 */
class NetworkSelectPage extends Page {
  /**
   * 页面关键元素 - 用于判断页面是否加载完成
   */
  get keyElement() {
    return this.pageTitle;
  }

  // ========== 顶部导航栏元素 ==========

  /**
   * 页面标题 - "Networks" / "网络"
   * 定位方式：在页面根下按文本定位，支持中英文
   */
  get pageTitle() {
    return api.by.xpath(
      `${PAGE_ROOT_XPATH}//android.widget.TextView[@text="网络" or @text="Networks"]`,
    );
  }

  /**
   * 关闭按钮 - 左上角关闭图标按钮
   * resource-id: "nav-header-close"
   * 定位方式：使用 resource-id 定位
   */
  get closeButton() {
    return api.by.id('nav-header-close');
  }

  // ========== 搜索区域 ==========

  /**
   * 搜索输入框 - 搜索网络（6.1.0 新 DOM）
   * resource-id: "nav-header-search-all-networks-manager-search-bar"
   * hint: "搜索" / "Search"
   */
  get searchInput() {
    return api.by.id('nav-header-search-all-networks-manager-search-bar');
  }

  // ========== 网络列表区域（6.1.0 新 DOM：all-networks-manager-item-*） ==========

  /**
   * 获取指定网络选项（可点击的整行）
   * 新 DOM：resource-id="all-networks-manager-item-{networkId}"
   * @param {string} networkId - 网络ID，例如 "btc--0", "evm--1", "tron--0x2b6653dc"
   * @returns {WebdriverIO.Element} 网络选项元素
   */
  getNetworkItem(networkId) {
    return api.by.id(`all-networks-manager-item-${networkId}`);
  }

  /**
   * 获取指定网络的标题文本元素
   * 新 DOM：resource-id="select-item-all-networks-manager-item-{networkId}"
   * @param {string} networkId - 网络ID
   * @returns {WebdriverIO.Element} 网络标题元素
   */
  getNetworkTitle(networkId) {
    return api.by.id(`select-item-all-networks-manager-item-${networkId}`);
  }

  /**
   * 取消全选按钮 - 批量取消已选网络（6.1.0 新 DOM）
   * content-desc/text: "取消全选"
   */
  get deselectAllButton() {
    return api.by.xpath(
      `${PAGE_ROOT_XPATH}//android.widget.Button[@content-desc="取消全选" or @text="取消全选"]`,
    );
  }

  // ========== 常用网络快捷方法 ==========

  /**
   * Bitcoin 网络选项
   * 6.1.0: resource-id="all-networks-manager-item-btc--0"
   */
  get bitcoinNetwork() {
    return this.getNetworkItem('btc--0');
  }

  /**
   * Ethereum 网络选项
   * 6.1.0: resource-id="all-networks-manager-item-evm--1"
   */
  get ethereumNetwork() {
    return this.getNetworkItem('evm--1');
  }

  /**
   * Tron 网络选项
   * 6.1.0: resource-id="all-networks-manager-item-tron--0x2b6653dc"
   */
  get tronNetwork() {
    return this.getNetworkItem('tron--0x2b6653dc');
  }

  /**
   * Solana 网络选项
   * 6.1.0: resource-id="all-networks-manager-item-sol--101"
   */
  get solanaNetwork() {
    return this.getNetworkItem('sol--101');
  }

  /**
   * BNB Chain 网络选项
   * 6.1.0: resource-id="all-networks-manager-item-evm--56"
   */
  get bnbChainNetwork() {
    return this.getNetworkItem('evm--56');
  }

  /**
   * Polygon 网络选项
   * 6.1.0: resource-id="all-networks-manager-item-evm--137"
   */
  get polygonNetwork() {
    return this.getNetworkItem('evm--137');
  }

  /**
   * TON 网络选项
   * 6.1.0: resource-id="all-networks-manager-item-ton--mainnet"
   */
  get tonNetwork() {
    return this.getNetworkItem('ton--mainnet');
  }

  /**
   * Arbitrum 网络选项
   * 6.1.0: resource-id="all-networks-manager-item-evm--42161"
   */
  get arbitrumNetwork() {
    return this.getNetworkItem('evm--42161');
  }

  /**
   * Avalanche 网络选项
   * 6.1.0: resource-id="all-networks-manager-item-evm--43114"
   */
  get avalancheNetwork() {
    return this.getNetworkItem('evm--43114');
  }

  /**
   * Aurora 网络选项
   * 6.1.0: resource-id="all-networks-manager-item-evm--1313161554"
   */
  get auroraNetwork() {
    return this.getNetworkItem('evm--1313161554');
  }

  /**
   * Aleph Zero EVM 网络选项
   * 6.1.0: resource-id="all-networks-manager-item-evm--41455"
   */
  get alephZeroEVMNetwork() {
    return this.getNetworkItem('evm--41455');
  }

  /**
   * Akash 网络选项
   * 6.1.0: resource-id="all-networks-manager-item-cosmos--akashnet-2"
   */
  get akashNetwork() {
    return this.getNetworkItem('cosmos--akashnet-2');
  }

  /**
   * Astar 网络选项
   * 6.1.0: resource-id="all-networks-manager-item-dot--astar"
   */
  get astarNetwork() {
    return this.getNetworkItem('dot--astar');
  }

  /**
   * Aptos 网络选项
   * 6.1.0: resource-id="all-networks-manager-item-aptos--1"
   */
  get aptosNetwork() {
    return this.getNetworkItem('aptos--1');
  }

  /**
   * Algorand 网络选项
   * 6.1.0: resource-id="all-networks-manager-item-algo--4160"
   */
  get algorandNetwork() {
    return this.getNetworkItem('algo--4160');
  }

  // ========== 操作方法 ==========

  /**
   * 点击关闭按钮
   */
  async clickCloseButton() {
    await api.tap(this.closeButton);
  }

  /**
   * 在搜索框中输入文本
   * @param {string} text - 要搜索的文本
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
   * 通过搜索定位并选择网络
   * Android 6.1.0+ 使用 all-networks-manager-item-{networkId}
   * @param {string} chainName - 链名称，用于搜索（如 Bitcoin、Ethereum）
   * @param {string} networkId - 网络 ID，用于点击选项（如 btc--0、evm--1）
   */
  async selectNetworkBySearch(chainName, networkId) {
    await this.inputSearchText(chainName);
    await api.pause(800);
    const platform = detectPlatform();
    const selector =
      platform === PLATFORMS.ios
        ? `~all-networks-manager-item-${networkId}`
        : `//*[@resource-id="all-networks-manager-item-${networkId}"]`;
    const element = await browser.$(selector);
    await api.tap(element);
  }

  /**
   * 检查网络元素是否可见
   * @param {string} networkId - 网络ID
   * @returns {Promise<boolean>} 元素是否可见
   */
  async isNetworkVisible(networkId) {
    try {
      const element = this.getNetworkItem(networkId);
      await api.platformChain
        .not()
        .ios()
        .run(async () => {
          await element.waitForDisplayed({ timeout: 1000 });
        });
      await api.platformChain
        .ios()
        .run(async () => {
          await element.waitForExist({ timeout: 1000 });
        });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 向下滑动页面查找网络
   * @param {string} networkId - 网络ID
   * @param {number} maxScrolls - 最大滑动次数，默认10次
   * @returns {Promise<boolean>} 是否找到网络
   */
  async scrollToFindNetwork(networkId, maxScrolls = 10) {
    // 先检查是否已经在当前页面可见
    if (await this.isNetworkVisible(networkId)) {
      return true;
    }

    // 记录初始页面位置，用于检测是否到达底部
    let previousPageSource = '';
    let scrollCount = 0;

    while (scrollCount < maxScrolls) {
      // 获取当前页面源码用于检测是否到达底部
      const currentPageSource = await browser.getPageSource();

      // 向下滑动
      await api.scrollY(500); // 向下滑动500像素
      await api.pause(500); // 等待滑动完成

      // 检查是否找到网络
      if (await this.isNetworkVisible(networkId)) {
        return true;
      }

      // 检查是否到达底部（页面内容没有变化）
      if (currentPageSource === previousPageSource) {
        // 已经到达底部，无法继续滑动
        break;
      }

      previousPageSource = currentPageSource;
      scrollCount++;
    }

    return false;
  }

  /**
   * 选择指定网络（支持滑动查找）
   * @param {string} networkId - 网络ID，例如 "btc--0", "evm--1"
   * @param {Object} options - 选项
   * @param {boolean} options.enableScroll - 是否启用滑动查找，默认true
   * @param {number} options.maxScrolls - 最大滑动次数，默认10次
   */
  async selectNetwork(networkId, options = {}) {
    const { enableScroll = true, maxScrolls = 10 } = options;
    const element = this.getNetworkItem(networkId);

    if (enableScroll) {
      // 先尝试滑动查找
      const found = await this.scrollToFindNetwork(networkId, maxScrolls);
      if (!found) {
        throw new Error(
          `无法找到网络 ${networkId}，已尝试滑动 ${maxScrolls} 次`,
        );
      }
    } else {
      // 如果不启用滑动，直接检查元素是否存在
      if (!(await this.isNetworkVisible(networkId))) {
        throw new Error(`无法找到网络 ${networkId}，元素不可见`);
      }
    }

    // 点击网络
    await api.tap(element);
  }

  /**
   * 点击 Bitcoin 网络
   */
  async clickBitcoinNetwork() {
    await api.tap(this.bitcoinNetwork);
  }

  /**
   * 点击 Ethereum 网络
   */
  async clickEthereumNetwork() {
    await api.tap(this.ethereumNetwork);
  }

  /**
   * 点击 Tron 网络
   */
  async clickTronNetwork() {
    await api.tap(this.tronNetwork);
  }

  /**
   * 点击 Solana 网络
   */
  async clickSolanaNetwork() {
    await api.tap(this.solanaNetwork);
  }

  /**
   * 点击 BNB Chain 网络
   */
  async clickBNBChainNetwork() {
    await api.tap(this.bnbChainNetwork);
  }

  /**
   * 点击 Polygon 网络
   */
  async clickPolygonNetwork() {
    await api.tap(this.polygonNetwork);
  }

  /**
   * 点击 TON 网络
   */
  async clickTONNetwork() {
    await api.tap(this.tonNetwork);
  }

  /**
   * 点击 Arbitrum 网络
   */
  async clickArbitrumNetwork() {
    await api.tap(this.arbitrumNetwork);
  }

  /**
   * 点击 Avalanche 网络
   */
  async clickAvalancheNetwork() {
    await api.tap(this.avalancheNetwork);
  }

  /**
   * 点击 Aurora 网络
   */
  async clickAuroraNetwork() {
    await api.tap(this.auroraNetwork);
  }

  /**
   * 点击 Aleph Zero EVM 网络
   */
  async clickAlephZeroEVMNetwork() {
    await api.tap(this.alephZeroEVMNetwork);
  }

  /**
   * 点击 Akash 网络
   */
  async clickAkashNetwork() {
    await api.tap(this.akashNetwork);
  }

  /**
   * 点击 Astar 网络
   */
  async clickAstarNetwork() {
    await api.tap(this.astarNetwork);
  }

  /**
   * 点击 Aptos 网络
   */
  async clickAptosNetwork() {
    await api.tap(this.aptosNetwork);
  }

  /**
   * 点击 Algorand 网络
   */
  async clickAlgorandNetwork() {
    await api.tap(this.algorandNetwork);
  }

  /**
   * 获取页面标题文本
   * @returns {Promise<string>} 页面标题文本
   */
  async getPageTitle() {
    return await api.getText(this.pageTitle);
  }

  /**
   * 获取指定网络的标题文本
   * @param {string} networkId - 网络ID
   * @returns {Promise<string>} 网络标题文本
   */
  async getNetworkTitleText(networkId) {
    return await api.getText(this.getNetworkTitle(networkId));
  }

  /**
   * 验证页面是否已加载
   * 通过检查关键元素是否存在来判断
   */
  async verifyPageLoaded() {
    await this.waitEntryPage();
    await this.assertCurrentPage();
  }
}

export const networkSelectPage = new NetworkSelectPage();
