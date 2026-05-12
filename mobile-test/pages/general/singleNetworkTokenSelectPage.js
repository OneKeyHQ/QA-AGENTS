import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';
import { executeByPlatform } from '../../util/index.js';

/**
 * 单链网络的token选择页 - Single Network Token Select Page
 * 参考：xmls/general/singleNetworkTokenSelectEnglish.xml
 */
class SingleNetworkTokenSelectPage extends Page {
  // ========== 顶部导航栏元素 ==========

  /**
   * 关闭按钮 - Close Button
   * resource-id: "nav-header-close"
   * bounds: [53,82][135,182]
   */
  get closeBtn() {
    return api.by.id('nav-header-close');
  }

  /**
   * 标题 - Title
   * text: "Select token"
   * bounds: [169,94][463,168]
   */
  get titleText() {
    return api.by.xpath('//android.view.View[@text="Select token"]');
  }

  /**
   * 搜索框 - Search Input
   * resource-id: "nav-header-search"
   * hint: "Search symbol or contract address"
   * bounds: [56,203][921,298]
   */
  get searchInput() {
    return api.by.id('nav-header-search');
  }

  // ========== 网络信息区域 ==========

  /**
   * 网络标签 - Network Label
   * text: "Network:"
   * bounds: [52,341][221,394]
   */
  get networkLabel() {
    return api.by.xpath('//android.widget.TextView[@text="Network:"]');
  }

  /**
   * 网络名称 - Network Name
   * text: "Ethereum"
   * bounds: [222,341][380,394]
   */
  get networkNameText() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Network:"]/following-sibling::android.widget.TextView[@text="Ethereum"]',
    );
  }

  // ========== 热门Token区域 ==========

  /**
   * 热门Token标题 - Popular Token Title
   * text: "Popular token"
   * bounds: [52,607][1027,660]
   */
  get popularTokenTitle() {
    return api.by.xpath('//android.widget.TextView[@text="Popular token"]');
  }

  /**
   * ETH Token按钮 - ETH Token Button
   * content-desc: "ETH"
   * bounds: [53,693][224,779]
   */
  get ethTokenBtn() {
    return api.by.xpath('//android.widget.Button[@content-desc="ETH"]');
  }

  /**
   * USDT Token按钮 - USDT Token Button
   * content-desc: "USDT"
   * bounds: [240,693][436,779]
   */
  get usdtTokenBtn() {
    return api.by.xpath('//android.widget.Button[@content-desc="USDT"]');
  }

  /**
   * 获取Token按钮（通过content-desc）
   * @param {string} tokenSymbol - Token符号，如"ETH", "USDT", "USDC"等
   */
  getTokenBtn(tokenSymbol) {
    return api.by.xpath(
      `//android.widget.Button[@content-desc="${tokenSymbol}"]`,
    );
  }

  /**
   * 获取所有Token按钮列表
   */
  get allTokenButtons() {
    return api.by.xpath('//android.widget.Button[@content-desc]');
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
   * 在搜索框中输入文本
   * @param {string} text - 要搜索的文本
   */
  async inputSearchText(text) {
    await executeByPlatform(
      async () => {
        await api.tap(this.searchInput);
        await api.setValue(this.searchInput, text);
      },
      async () => {
        const input = api.by.xpath(
          '//input[@placeholder="Search symbol or contract address"]',
        );
        await api.tap(input);
        await api.setValue(input, text);
      },
    );
  }

  /**
   * 点击ETH Token
   */
  async clickEthToken() {
    await executeByPlatform(
      async () => {
        await api.tap(this.ethTokenBtn);
      },
      async () => {
        await api.fixInterceptedClick('ETH');
      },
    );
  }

  /**
   * 点击USDT Token
   */
  async clickUsdtToken() {
    await executeByPlatform(
      async () => {
        await api.tap(this.usdtTokenBtn);
      },
      async () => {
        await api.fixInterceptedClick('USDT');
      },
    );
  }

  /**
   * 点击指定Token
   * @param {string} tokenSymbol - Token符号，如"ETH", "USDT", "USDC"等
   */
  async clickToken(tokenSymbol) {
    await executeByPlatform(
      async () => {
        const tokenBtn = this.getTokenBtn(tokenSymbol);
        await api.tap(tokenBtn);
      },
      async () => {
        await api.fixInterceptedClick(tokenSymbol);
      },
    );
  }

  /**
   * 清空搜索框
   */
  async clearSearchInput() {
    await executeByPlatform(
      async () => {
        await api.setValue(this.searchInput, '');
      },
      async () => {
        const input = api.by.xpath(
          '//input[@placeholder="Search symbol or contract address"]',
        );
        await api.setValue(input, '');
      },
    );
  }

  // ========== 验证方法 ==========

  /**
   * 等待Token选择页显示
   */
  async waitForTokenSelectPage() {
    await api.waitPageByElement(this.titleText);
  }

  /**
   * 验证Token选择页是否显示
   */
  async verifyTokenSelectPageDisplayed() {
    const isDisplayed = await this.titleText.isDisplayed();
    return isDisplayed;
  }

  /**
   * 验证网络名称是否正确
   * @param {string} networkName - 网络名称，如"Ethereum"
   */
  async verifyNetworkName(networkName) {
    const networkText = api.by.xpath(
      `//android.widget.TextView[@text="${networkName}"]`,
    );
    const isDisplayed = await networkText.isDisplayed();
    return isDisplayed;
  }

  /**
   * 验证Token是否显示
   * @param {string} tokenSymbol - Token符号，如"ETH"
   */
  async verifyTokenDisplayed(tokenSymbol) {
    const tokenBtn = this.getTokenBtn(tokenSymbol);
    const isDisplayed = await tokenBtn.isDisplayed();
    return isDisplayed;
  }

  /**
   * 验证热门Token标题是否显示
   */
  async verifyPopularTokenTitleDisplayed() {
    const isDisplayed = await this.popularTokenTitle.isDisplayed();
    return isDisplayed;
  }

  /**
   * 获取搜索结果中的Token列表
   * @returns {Promise<Array<string>>} Token符号列表
   */
  async getSearchResultTokens() {
    const tokenButtons = await this.allTokenButtons;
    const tokens = [];
    for (const btn of tokenButtons) {
      const contentDesc = await btn.getAttribute('content-desc');
      if (contentDesc) {
        tokens.push(contentDesc);
      }
    }
    return tokens;
  }
}

export const singleNetworkTokenSelectPage = new SingleNetworkTokenSelectPage();
