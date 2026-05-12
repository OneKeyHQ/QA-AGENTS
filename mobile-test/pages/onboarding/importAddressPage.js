import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';
import { networkSelectorModal } from '../modal/networkSelectorModalPage.js';

/**
 * 导入观察地址页面 - 用户导入观察地址的表单页面
 * 基于 xmls/onboarding/importWatchAddress.xml
 * 层级：content > FrameLayout > ViewGroup(...) > ScrollView > ViewGroup > 导航栏/表单/底部按钮
 */
class ImportAddressPage extends Page {
  /**
   * 页面关键元素 - 用于判断页面是否加载完成
   */
  get keyElement() {
    return this.pageTitle;
  }

  // ========== 顶部导航栏元素 ==========

  /**
   * 页面标题 - "导入地址" / "Import address"
   * text: "导入地址" / "Import address"
   * bounds: [169,94][381,168]
   * 定位方式：使用文本内容定位，更稳定，支持中英文
   */
  get pageTitle() {
    return api.by.xpath(
      '//android.view.View[@text="导入地址" or @text="Import address"]',
    );
  }

  /**
   * 关闭按钮 - 左上角关闭图标按钮
   * resource-id: "nav-header-close"
   * bounds: [53,82][135,182]
   * 定位方式：优先使用resource-id定位，更稳定
   */
  get closeButton() {
    return api.by.id('nav-header-close');
  }

  // ========== 表单区域元素 ==========

  /**
   * 网络选择器 - 网络选择输入框
   * resource-id: "network-selector-input"
   * bounds: [53,269][1028,390]
   * 定位方式：优先使用resource-id定位，更稳定
   */
  get chooseChainBtn() {
    return api.by.id('network-selector-input');
  }

  /**
   * 网络选择器文本 - 显示当前选中的网络
   * resource-id: "network-selector-input-text"
   * bounds: [150,297][936,360] (或 [87,300][936,357])
   * 定位方式：优先使用 resource-id
   */
  get networkSelectorText() {
    return api.by.id('network-selector-input-text');
  }

  /**
   * 地址 Tab - 切换为「地址」输入模式
   * resource-id: "import-address-address"
   * bounds: [53,442][540,526]
   * 定位方式：优先使用 resource-id
   */
  get addressTab() {
    return api.by.id('import-address-address');
  }

  /**
   * 公钥 Tab - 切换为「公钥」输入模式
   * resource-id: "import-address-publicKey"
   * bounds: [541,442][1029,526]
   * 定位方式：优先使用 resource-id
   */
  get publicKeyTab() {
    return api.by.id('import-address-publicKey');
  }

  /**
   * 输入框上方标签 - 当前模式下的字段标签（「地址」或「公钥」）
   * 与 addressTab/publicKeyTab 对应，用于断言当前为地址模式或公钥模式
   * 基于 xmls/onboarding/importPublicKey.xml：与 import-address-input 同父的 TextView
   * bounds: [53,579][127,632]（地址）或公钥时同位置
   * 定位方式：与输入框同父容器的 TextView
   */
  get inputFieldLabel() {
    return api.by.xpath(
      '//android.widget.EditText[@resource-id="import-address-input"]/../android.widget.TextView[@text="地址" or @text="公钥" or @text="Address" or @text="Public key"]',
    );
  }

  /**
   * 地址输入框 - 地址或域名输入框（地址/公钥模式共用同一输入框）
   * resource-id: "import-address-input"
   * hint: "地址或域名" / "公钥"（公钥模式下可能变化）
   * bounds: [53,648][1028,766]
   * 定位方式：优先使用 resource-id
   */
  get addressInput() {
    return api.by.id('import-address-input');
  }

  /**
   * 粘贴按钮 - 从剪贴板粘贴地址
   * resource-id: "import-address-input-clip"
   * bounds: [787,773][887,873]
   * 定位方式：优先使用 resource-id
   */
  get pasteButton() {
    return api.by.id('import-address-input-clip');
  }

  /**
   * 扫描按钮 - 扫描二维码输入地址
   * resource-id: "import-address-input-scan"
   * bounds: [913,773][1013,873]
   * 定位方式：优先使用 resource-id
   */
  get scanButton() {
    return api.by.id('import-address-input-scan');
  }

  /**
   * 派生路径选择器 - 填入 xpub 后出现的选择路径下拉区域
   * 起始层级 + .../android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup[10]
   * 定位方式：相对 xpath，从 POM 规定起始层级定位至该 ViewGroup
   */
  get derivePathSelectorDropdown() {
    return api.by.xpath(
      '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[2]/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup[10]',
    );
  }

  /**
   * 名称（可选）标签 - 表单标签
   * text: "名称（可选）" / "Name (optional)"
   * bounds: [53,935][275,988]
   * 定位方式：文本定位，支持中英文
   */
  get nameLabel() {
    return api.by.xpath(
      '//android.widget.TextView[@text="名称（可选）" or @text="Name (optional)"]',
    );
  }

  /**
   * 名称输入框 - 账户名称输入框（可选）
   * hint: "账户名称" / "Account name"
   * bounds: [56,1007][1026,1101]
   * 定位方式：使用 hint 定位，支持中英文
   */
  get nameInput() {
    return api.by.xpath(
      '//android.widget.EditText[@hint="账户名称" or @hint="Account name"]',
    );
  }

  /**
   * 观察账户说明标题 - 说明文本标题
   * text: "观察账户"
   * bounds: [53,1251][1028,1304]
   * 定位方式：文本内容定位
   */
  get watchAccountTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="观察账户"]',
    );
  }

  /**
   * 观察账户说明内容 - 说明文本内容
   * contains: "观察账户"
   * bounds: [53,1314][1028,1420]
   * 定位方式：文本部分匹配
   */
  get watchAccountDescription() {
    return api.by.xpath(
      '//android.widget.TextView[contains(@text, "观察账户")]',
    );
  }

  // ========== 底部操作栏元素 ==========

  /**
   * 确认按钮 - 底部确认按钮
   * resource-id: "page-footer-confirm"
   * content-desc: "确认"
   * bounds: [53,2154][1028,2286]
   * 定位方式：优先使用resource-id定位，更稳定
   */
  get confirmButton() {
    return api.by.id('page-footer-confirm');
  }

  // ========== 操作方法 ==========

  /**
   * 点击关闭按钮
   */
  async clickCloseButton() {
    await api.tap(this.closeButton);
  }

  /**
   * 点击网络选择器
   */
  async clickChooseChainBtn() {
    await api.tap(this.chooseChainBtn);
  }

  /**
   * 点击「地址」Tab，切换为地址输入模式
   */
  async clickAddressTab() {
    await api.tap(this.addressTab);
  }

  /**
   * 点击「公钥」Tab，切换为公钥输入模式
   */
  async clickPublicKeyTab() {
    await api.tap(this.publicKeyTab);
  }

  /**
   * 获取当前选中的网络文本
   * @returns {Promise<string>} 网络名称文本
   */
  async getSelectedNetworkText() {
    return await api.getText(this.networkSelectorText);
  }

  /**
   * 输入地址
   * @param {string} addr - 要输入的地址或域名
   */
  async inputAddress(addr) {
    await api.tap(this.addressInput);
    await api.setValue(this.addressInput, addr);
  }

  /**
   * 输入公钥（公钥模式下使用，与 inputAddress 共用同一输入框）
   * @param {string} publicKey - 要输入的公钥
   */
  async inputPublicKey(publicKey) {
    await api.tap(this.addressInput);
    await api.setValue(this.addressInput, publicKey);
  }

  /**
   * 获取当前输入框上方标签文本（「地址」或「公钥」），用于断言当前模式
   * @returns {Promise<string>} 标签文本
   */
  async getInputFieldLabelText() {
    return await api.getText(this.inputFieldLabel);
  }

  /**
   * 点击粘贴按钮
   */
  async clickPasteButton() {
    await api.tap(this.pasteButton);
  }

  /**
   * 点击扫描按钮
   */
  async clickScanButton() {
    await api.tap(this.scanButton);
  }

  /**
   * 点击派生路径选择器（填入 xpub 后出现的路径下拉）
   */
  async clickDerivePathSelectorDropdown() {
    await api.tap(this.derivePathSelectorDropdown);
  }

  /**
   * 输入账户名称
   * @param {string} name - 账户名称
   */
  async inputName(name) {
    await api.tap(this.nameInput);
    await api.setValue(this.nameInput, name);
  }

  /**
   * 点击确认按钮
   * 尝试多个定位策略，找到第一个存在的元素就点击
   */
  async clickConfirmButton() {
    // 定义多个定位策略
    const selectors = [
      // 策略1: 通过 resource-id 定位（最稳定）
      '//android.widget.Button[@resource-id="page-footer-confirm"]',
      // 策略2: 通过 content-desc 定位 - 中文
      '//android.widget.Button[@content-desc="确认"]',
      // 策略3: 通过 content-desc 定位 - 英文
      '//android.widget.Button[@content-desc="Confirm"]',
      // 策略4: 通过 content-desc 定位 - 中英文混合
      '//android.widget.Button[@content-desc="确认" or @content-desc="Confirm"]',
      // 策略5: 通过按钮内文本定位 - 中文
      '//android.widget.Button[.//android.widget.TextView[@text="确认"]]',
      // 策略6: 通过按钮内文本定位 - 英文
      '//android.widget.Button[.//android.widget.TextView[@text="Confirm"]]',
      // 策略7: 通过按钮内文本定位 - 中英文混合
      '//android.widget.Button[.//android.widget.TextView[@text="确认" or @text="Confirm"]]',
      // 策略8: 通过 resource-id 和 content-desc 组合定位
      '//android.widget.Button[@resource-id="page-footer-confirm" and (@content-desc="确认" or @content-desc="Confirm")]',
      // 策略9: 底部确认按钮的通用定位（如果 resource-id 存在）
      '//android.widget.Button[@resource-id="page-footer-confirm"][last()]',
    ];

    // 依次尝试每个定位策略
    for (let i = 0; i < selectors.length; i++) {
      try {
        const selector = selectors[i];
        const element = api.by.xpath(selector);
        
        // 尝试等待元素显示（短超时）
        try {
          await api.platformChain
            .not()
            .ios()
            .run(async () => {
              await element.waitForDisplayed({ timeout: 2000 });
            });
          await api.platformChain
            .ios()
            .run(async () => {
              await element.waitForExist({ timeout: 2000 });
            });
          
          // 元素找到了，点击它
          await api.tap(element);
          return; // 成功点击，退出方法
        } catch (waitError) {
          // 元素不存在，继续尝试下一个策略
          continue;
        }
      } catch (error) {
        // 定位失败，继续尝试下一个策略
        continue;
      }
    }

    // 所有策略都失败了，抛出错误
    throw new Error('无法找到确认按钮，已尝试所有定位策略');
  }

  /**
   * 选择网络
   * @param {string} networkId - 网络ID
   */
  async chooseNetwork(networkId) {
    if (networkId) {
      await this.clickChooseChainBtn();
      await networkSelectorModal.selectNetworkById(networkId);
    }
  }

  /**
   * 获取页面标题文本
   * @returns {Promise<string>} 页面标题文本
   */
  async getPageTitle() {
    return await api.getText(this.pageTitle);
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

export const importAddressPage = new ImportAddressPage();
