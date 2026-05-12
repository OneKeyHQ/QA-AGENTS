import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';

/**

* 添加钱包页面 - 用户选择添加钱包方式的页面
 * 依据 xmls/onboarding/addWallet.xml
 * 从层级开始：//android.widget.FrameLayout[@resource-id="android:id/content"]
 */
class AddWalletPage extends Page {
  /**
   * 页面关键元素 - 用于判断页面是否加载完成
   */
  get keyElement() {
    return this.pageTitle;
  }

  // ========== 顶部导航栏元素 ==========

  /**
   * 页面标题 - "添加钱包" / "Add wallet"
   * text: "添加钱包"
   * bounds: [445,89][637,152]
   * 定位方式：使用文本内容定位，支持中英文
   */
  get pageTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="添加钱包" or @text="Add wallet"]',
    );
  }

  /**
   * 返回按钮 - 左上角返回图标按钮
   * bounds: [35,71][135,171]
   * 定位方式：content 下第一个 Button（无 text/content-desc 时用顺序）
   */
  get backButton() {
    return api.by.xpath(
      '(//android.widget.FrameLayout[@resource-id="android:id/content"]//android.widget.Button)[1]',
    );
  }

  /**
   * 右上角按钮 - 右上角功能按钮
   * bounds: [947,89][1029,152]
   * 定位方式：content 下第二个 Button
   */
  get topRightButton() {
    return api.by.xpath(
      '(//android.widget.FrameLayout[@resource-id="android:id/content"]//android.widget.Button)[2]',
    );
  }

  // ========== 主要内容区域 - 钱包选项卡片 ==========

  /**
   * 创建无私钥钱包卡片 - 第一个钱包选项卡片（可点击）
   * text: "创建无私钥钱包"
   * bounds: [54,205][1029,422]
   * 定位方式：通过标题文本定位其可点击父 ViewGroup
   */
  get createNoSeedWalletCard() {
    return api.by.xpath(
      '(//android.widget.TextView[@text="创建无私钥钱包" or @text="Create account"])[1]/ancestor::android.view.ViewGroup[@clickable="true"][1]',
    );
  }

  /**
   * 创建无私钥钱包标题 - 卡片内的标题文本
   * text: "创建无私钥钱包"
   * bounds: [239,259][533,322]
   */
  get createNoSeedWalletTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="创建无私钥钱包" or @text="Create account"]',
    );
  }

  /**
   * 创建无私钥钱包 - 了解更多按钮
   * content-desc: "了解更多" / "Learn more"
   * bounds: [229,322][420,375]
   * 定位方式：限定在创建无私钥钱包卡片内
   */
  get createNoSeedWalletLearnMoreBtn() {
    return api.by.xpath(
      '(//android.view.ViewGroup[@clickable="true"][.//android.widget.TextView[@text="创建无私钥钱包" or @text="Create account"]])[1]//android.widget.Button[@content-desc="了解更多" or @content-desc="Learn more" or @text="了解更多" or @text="Learn more"]',
    );
  }

  /**
   * 创建助记词钱包卡片 - 第二个钱包选项卡片（可点击）
   * text: "创建助记词钱包"
   * bounds: [54,475][1029,692]
   * 定位方式：通过标题文本定位其可点击父 ViewGroup
   */
  get createSeedWalletCard() {
    return api.by.xpath(
      '(//android.widget.TextView[@text="创建助记词钱包" or @text="Create recovery phrase wallet"])[1]/ancestor::android.view.ViewGroup[@clickable="true"][1]',
    );
  }

  /**
   * 创建助记词钱包标题 - 卡片内的标题文本
   * text: "创建助记词钱包"
   * bounds: [239,529][533,592]
   */
  get createSeedWalletTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="创建助记词钱包" or @text="Create recovery phrase wallet"]',
    );
  }

  /**
   * 创建助记词钱包 - 了解更多按钮
   * content-desc: "了解更多"
   * bounds: [229,592][420,645]
   * 定位方式：限定在创建助记词钱包卡片内
   */
  get createSeedWalletLearnMoreBtn() {
    return api.by.xpath(
      '(//android.view.ViewGroup[@clickable="true"][.//android.widget.TextView[@text="创建助记词钱包" or @text="Create recovery phrase wallet"]])[1]//android.widget.Button[@content-desc="了解更多" or @content-desc="Learn more" or @text="了解更多" or @text="Learn more"]',
    );
  }

  /**
   * 导入现有钱包卡片 - 第三个钱包选项卡片（可点击）
   * text: "导入现有钱包"
   * bounds: [54,745][1029,963]
   * 定位方式：通过标题文本定位其可点击父 ViewGroup，支持中英文
   */
  get addExistingWalletCard() {
    return api.by.xpath(
      '(//android.widget.TextView[@text="导入现有钱包" or @text="Add existing wallet"])[1]/ancestor::android.view.ViewGroup[@clickable="true"][1]',
    );
  }

  /**
   * 导入现有钱包标题 - 卡片内的标题文本
   * text: "导入现有钱包" / "Add existing wallet"
   * bounds: [239,799][491,862]
   */
  get addExistingWalletTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="导入现有钱包" or @text="Add existing wallet"]',
    );
  }

  /**
   * 导入现有钱包副标题 - 卡片内的副标题文本（若存在）
   * text: "传输、恢复或导入" / "Transfer, recover or import"
   */
  get addExistingWalletSubtitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="传输、恢复或导入" or @text="Transfer, recover or import"]',
    );
  }

  /**
   * 连接外部钱包卡片 - 第四个钱包选项卡片（可点击）
   * text: "连接外部钱包"
   * bounds: [54,1014][1029,1221]
   * 定位方式：通过标题文本定位其可点击父 ViewGroup
   */
  get connectExternalWalletCard() {
    return api.by.xpath(
      '(//android.widget.TextView[@text="连接外部钱包" or @text="Connect external wallet"])[1]/ancestor::android.view.ViewGroup[@clickable="true"][1]',
    );
  }

  /**
   * 连接外部钱包标题 - 卡片内的标题文本
   * text: "连接外部钱包"
   * bounds: [238,1085][881,1148]
   */
  get connectExternalWalletTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="连接外部钱包" or @text="Connect external wallet"]',
    );
  }

  // ========== 卡片内的特性标签文本 ==========

  /**
   * 无需助记词标签 - 创建无私钥钱包卡片内的特性标签
   * text: "无需助记词"
   * bounds: [129,480][289,522]
   */
  get noSeedPhraseLabel() {
    return api.by.xpath(
      '//android.widget.TextView[@text="无需助记词"]',
    );
  }

  /**
   * 新手友好标签 - 创建无私钥钱包卡片内的特性标签
   * text: "新手友好"
   * bounds: [352,480][480,522]
   */
  get beginnerFriendlyLabel() {
    return api.by.xpath(
      '//android.widget.TextView[@text="新手友好"]',
    );
  }

  /**
   * 支持数百个网络标签 - 多个卡片内的特性标签
   * text: "支持数百个网络"
   * bounds: [543,480][767,522]
   */
  get supportManyNetworksLabel() {
    return api.by.xpath(
      '//android.widget.TextView[@text="支持数百个网络"]',
    );
  }

  /**
   * 开源安全加密标签 - 创建无私钥钱包卡片内的特性标签
   * text: "开源安全加密"
   * bounds: [129,554][321,596]
   */
  get openSourceSecureLabel() {
    return api.by.xpath(
      '//android.widget.TextView[@text="开源安全加密"]',
    );
  }

  /**
   * 极速上手标签 - 创建无私钥钱包卡片内的特性标签
   * text: "极速上手"
   * bounds: [384,554][512,596]
   */
  get quickStartLabel() {
    return api.by.xpath(
      '//android.widget.TextView[@text="极速上手"]',
    );
  }

  /**
   * 最常使用标签 - 创建助记词钱包卡片内的特性标签
   * text: "最常使用"
   * bounds: [129,982][257,1024]
   */
  get mostUsedLabel() {
    return api.by.xpath(
      '//android.widget.TextView[@text="最常使用"]',
    );
  }

  /**
   * 助记词由12个单词组成标签 - 创建助记词钱包卡片内的特性标签
   * text: "助记词由 12 个单词组成"
   * bounds: [320,982][660,1024]
   */
  get seedPhrase12WordsLabel() {
    return api.by.xpath(
      '//android.widget.TextView[@text="助记词由 12 个单词组成"]',
    );
  }

  /**
   * 助记词就像是「密码」标签 - 创建助记词钱包卡片内的特性标签
   * text: "助记词就像是「密码」"
   * bounds: [129,1056][449,1098]
   */
  get seedPhraseLikePasswordLabel() {
    return api.by.xpath(
      '//android.widget.TextView[@text="助记词就像是「密码」"]',
    );
  }

  /**
   * 需要自己妥善保管标签 - 创建助记词钱包卡片内的特性标签
   * text: "需要自己妥善保管"
   * bounds: [512,1056][768,1098]
   */
  get needToKeepSafeLabel() {
    return api.by.xpath(
      '//android.widget.TextView[@text="需要自己妥善保管"]',
    );
  }

  /**
   * 手写备份标签 - 创建助记词钱包卡片内的特性标签
   * text: "手写备份"
   * bounds: [129,1129][257,1171]
   */
  get handwrittenBackupLabel() {
    return api.by.xpath(
      '//android.widget.TextView[@text="手写备份"]',
    );
  }

  /**
   * 支持12-24个单词的助记词标签 - 导入现有钱包卡片内的特性标签
   * text: "支持 12-24 个单词的助记词"
   * bounds: [129,1557][514,1599]
   */
  get support12To24WordsLabel() {
    return api.by.xpath(
      '//android.widget.TextView[@text="支持 12-24 个单词的助记词"]',
    );
  }

  // ========== 操作方法 ==========

  /**
   * 点击返回按钮
   */
  async clickBackButton() {
    await api.tap(this.backButton);
  }

  /**
   * 点击右上角按钮
   */
  async clickTopRightButton() {
    await api.tap(this.topRightButton);
  }

  /**
   * 点击创建无私钥钱包卡片
   */
  async clickCreateNoSeedWalletCard() {
    await api.tap(this.createNoSeedWalletCard);
  }

  /**
   * 点击创建无私钥钱包 - 了解更多按钮
   */
  async clickCreateNoSeedWalletLearnMoreBtn() {
    await api.tap(this.createNoSeedWalletLearnMoreBtn);
  }

  /**
   * 点击创建助记词钱包卡片
   */
  async clickCreateSeedWalletCard() {
    await api.tap(this.createSeedWalletCard);
  }

  /**
   * 点击创建助记词钱包 - 了解更多按钮
   */
  async clickCreateSeedWalletLearnMoreBtn() {
    await api.tap(this.createSeedWalletLearnMoreBtn);
  }

  /**
   * 点击导入现有钱包卡片
   * 通过标题文本定位可点击卡片，支持中英文
   */
  async clickAddExistingWalletCard() {
    await api.tap(this.addExistingWalletCard);
  }

  /**
   * 点击连接外部钱包卡片
   */
  async clickConnectExternalWalletCard() {
    await api.tap(this.connectExternalWalletCard);
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

export const addWalletPage = new AddWalletPage();
