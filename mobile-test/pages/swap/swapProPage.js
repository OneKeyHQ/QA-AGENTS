import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';
import { executeByPlatform } from '../../util/index.js';

/**
 * Swap_Pro页 - Swap Pro Page (无余额状态)
 * 参考：xmls/swap/swapNomoneyProEnglish.xml
 */
class SwapProPage extends Page {
  // ========== 顶部导航栏元素 ==========

  /**
   * Swap内容容器 - Swap Content Container
   * resource-id: "swap-content-container"
   * bounds: [0,84][1080,2194]
   */
  get swapContentContainer() {
    return api.by.id('swap-content-container');
  }

  /**
   * Swap标签 - Swap Tab
   * text: "Swap"
   * bounds: [79,120][183,183]
   */
  get swapTab() {
    return api.by.xpath('//android.widget.TextView[@text="Swap"]');
  }

  /**
   * Bridge标签 - Bridge Tab
   * text: "Bridge"
   * bounds: [267,120][387,183]
   */
  get bridgeTab() {
    return api.by.xpath('//android.widget.TextView[@text="Bridge"]');
  }

  /**
   * Pro标签 - Pro Tab (当前选中)
   * text: "Pro"
   * bounds: [471,120][536,183]
   */
  get proTab() {
    return api.by.xpath('//android.widget.TextView[@text="Pro"]');
  }

  /**
   * 导航头部按钮组 - Navigation Header Button Group
   * resource-id: "Navigation-HeaderView-ButtonGroup"
   * bounds: [860,110][1028,194]
   */
  get navigationHeaderButtonGroup() {
    return api.by.id('Navigation-HeaderView-ButtonGroup');
  }

  // ========== From区域元素 ==========

  /**
   * From标签 - From Label
   * text: "From"
   * bounds: [90,246][176,299]
   */
  get fromLabel() {
    return api.by.xpath('//android.widget.TextView[@text="From"]');
  }

  /**
   * From网络显示 - From Network Display
   * text: "Ethereum"
   */
  get fromNetworkText() {
    return api.by.xpath(
      '//android.view.ViewGroup[./android.widget.TextView[@text="From"]]/following-sibling::android.view.ViewGroup/android.widget.TextView[@text="Ethereum"]',
    );
  }

  /**
   * From金额输入框 - From Amount Input
   * hint: "0.0"
   */
  get fromAmountInput() {
    return api.by.xpath('//android.widget.EditText[@hint="0.0"]');
  }

  /**
   * From Token按钮 - From Token Button
   * content-desc: "ETH"
   */
  get fromTokenBtn() {
    return api.by.xpath('//android.widget.Button[@content-desc="ETH"]');
  }

  /**
   * From金额USD显示 - From Amount USD Display
   * text: "$0.00"
   */
  get fromAmountUsdText() {
    return api.by.xpath('//android.widget.TextView[@text="$0.00"]');
  }

  /**
   * Max按钮 - Max Button
   * text: "Max"
   */
  get maxBtn() {
    return api.by.xpath('//android.widget.TextView[@text="Max"]');
  }

  // ========== To区域元素 ==========

  /**
   * To标签 - To Label
   * text: "To"
   */
  get toLabel() {
    return api.by.xpath('//android.widget.TextView[@text="To"]');
  }

  /**
   * To网络显示 - To Network Display
   * text: "Ethereum"
   */
  get toNetworkText() {
    return api.by.xpath(
      '//android.view.ViewGroup[./android.widget.TextView[@text="To"]]/following-sibling::android.view.ViewGroup/android.widget.TextView[@text="Ethereum"]',
    );
  }

  /**
   * To金额输入框 - To Amount Input
   * hint: "0.0"
   */
  get toAmountInput() {
    return api.by.xpath(
      '(//android.widget.EditText[@hint="0.0"])[2]',
    );
  }

  /**
   * To Token按钮 - To Token Button
   * content-desc: "USDC"
   */
  get toTokenBtn() {
    return api.by.xpath('//android.widget.Button[@content-desc="USDC"]');
  }

  /**
   * To金额USD显示 - To Amount USD Display
   * text: "$0.00"
   */
  get toAmountUsdText() {
    return api.by.xpath(
      '(//android.widget.TextView[@text="$0.00"])[2]',
    );
  }

  /**
   * 交换按钮 - Swap Button (From和To之间的交换按钮)
   */
  get swapDirectionBtn() {
    return api.by.xpath(
      '//android.widget.Button[@bounds="[507,492][575,560]"]',
    );
  }

  // ========== Pro特有元素 ==========

  /**
   * Pro模式标识 - Pro Mode Indicator
   * 可能包含Pro相关的特殊UI元素或标识
   */
  get proModeIndicator() {
    return this.proTab;
  }

  // ========== 操作方法 ==========

  /**
   * 点击Swap标签
   */
  async clickSwapTab() {
    await executeByPlatform(
      async () => {
        await api.tap(this.swapTab);
      },
      async () => {
        await api.fixInterceptedClick('Swap');
      },
    );
  }

  /**
   * 点击Bridge标签
   */
  async clickBridgeTab() {
    await executeByPlatform(
      async () => {
        await api.tap(this.bridgeTab);
      },
      async () => {
        await api.fixInterceptedClick('Bridge');
      },
    );
  }

  /**
   * 点击Pro标签
   */
  async clickProTab() {
    await executeByPlatform(
      async () => {
        await api.tap(this.proTab);
      },
      async () => {
        await api.fixInterceptedClick('Pro');
      },
    );
  }

  /**
   * 点击From Token按钮
   */
  async clickFromTokenBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.fromTokenBtn);
      },
      async () => {
        await api.fixInterceptedClick('ETH');
      },
    );
  }

  /**
   * 点击To Token按钮
   */
  async clickToTokenBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.toTokenBtn);
      },
      async () => {
        await api.fixInterceptedClick('USDC');
      },
    );
  }

  /**
   * 输入From金额
   * @param {string} amount - 金额
   */
  async inputFromAmount(amount) {
    await executeByPlatform(
      async () => {
        await api.tap(this.fromAmountInput);
        await api.setValue(this.fromAmountInput, amount);
      },
      async () => {
        const input = api.by.xpath('//input[@placeholder="0.0"]');
        await api.tap(input);
        await api.setValue(input, amount);
      },
    );
  }

  /**
   * 点击Max按钮
   */
  async clickMaxBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.maxBtn);
      },
      async () => {
        await api.fixInterceptedClick('Max');
      },
    );
  }

  /**
   * 点击交换方向按钮
   */
  async clickSwapDirectionBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.swapDirectionBtn);
      },
      async () => {
        await api.pause(500);
      },
    );
  }

  // ========== 验证方法 ==========

  /**
   * 等待Swap Pro页显示
   */
  async waitForSwapProPage() {
    await api.waitPageByElement(this.swapContentContainer);
    // 验证Pro标签是否选中
    await api.waitPageByElement(this.proTab);
  }

  /**
   * 验证Swap Pro页是否显示
   */
  async verifySwapProPageDisplayed() {
    const containerDisplayed =
      await this.swapContentContainer.isDisplayed();
    const proTabDisplayed = await this.proTab.isDisplayed();
    return containerDisplayed && proTabDisplayed;
  }

  /**
   * 验证Pro模式是否激活
   */
  async verifyProModeActive() {
    const proTabDisplayed = await this.proTab.isDisplayed();
    return proTabDisplayed;
  }

  /**
   * 验证From Token是否显示
   * @param {string} tokenSymbol - Token符号，如"ETH"
   */
  async verifyFromToken(tokenSymbol) {
    const tokenBtn = api.by.xpath(
      `//android.widget.Button[@content-desc="${tokenSymbol}"]`,
    );
    const isDisplayed = await tokenBtn.isDisplayed();
    return isDisplayed;
  }

  /**
   * 验证To Token是否显示
   * @param {string} tokenSymbol - Token符号，如"USDC"
   */
  async verifyToToken(tokenSymbol) {
    const tokenBtn = api.by.xpath(
      `//android.widget.Button[@content-desc="${tokenSymbol}"]`,
    );
    const isDisplayed = await tokenBtn.isDisplayed();
    return isDisplayed;
  }
}

export const swapProPage = new SwapProPage();
