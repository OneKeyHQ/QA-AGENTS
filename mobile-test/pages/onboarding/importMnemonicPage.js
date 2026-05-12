import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';
import { addExistingWalletPage } from './addExistingWalletPage.js';

/**
 * 导入助记词或私钥页面 - 用户输入助记词或私钥的页面
 * 依据 xmls/onboarding/importMnemonicOrPrivateKeyPage.xml
 *
 * 注意事项：
 * 1. 第一个助记词填写框的 xpath 为 //android.widget.EditText[@resource-id="phrase-input-index0"]
 * 2. 右上角按钮为切换语言按钮
 * 3. 左上角按钮为返回按钮，点击后返回 addExistingWallet 页面
 */
class ImportMnemonicPage extends Page {
  /**
   * 页面关键元素 - 用于判断页面是否加载完成
   */
  get keyElement() {
    return this.pageTitle;
  }

  // ========== 顶部导航栏元素 ==========

  /**
   * 页面标题 - "导入助记词或私钥" / "Import mnemonic or private key"
   * text: "导入助记词或私钥"
   * bounds: [349,89][733,152]
   */
  get pageTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="导入助记词或私钥" or contains(@text, "Import")]',
    );
  }

  /**
   * 返回按钮 - 左上角返回图标，点击后返回 addExistingWallet 页面
   * bounds: [35,71][135,171]
   */
  get backButton() {
    return api.by.xpath(
      '(//android.widget.FrameLayout[@resource-id="android:id/content"]//android.widget.Button)[1]',
    );
  }

  /**
   * 切换语言按钮 - 右上角语言切换按钮
   * bounds: [947,89][1029,152]
   */
  get languageSwitchButton() {
    return api.by.xpath(
      '(//android.widget.FrameLayout[@resource-id="android:id/content"]//android.widget.Button)[2]',
    );
  }

  // ========== Tab 与表单区域 ==========

  /**
   * 助记词 Tab - 切换到助记词输入模式
   * text: "助记词"
   * bounds: [54,205][541,289]
   */
  get tabMnemonic() {
    return api.by.xpath(
      '//android.view.ViewGroup[@clickable="true"]/android.widget.TextView[@text="助记词"]/..',
    );
  }

  /**
   * 私钥 Tab - 切换到私钥输入模式
   * text: "私钥"
   * bounds: [542,205][1029,289]
   */
  get tabPrivateKey() {
    return api.by.xpath(
      '//android.view.ViewGroup[@clickable="true"]/android.widget.TextView[@text="私钥"]/..',
    );
  }

  /**
   * 硬件钱包提示文案 - "不要导入硬件钱包的助记词，请使用连接硬件钱包"
   * bounds: [139,353][1007,406]
   */
  get hardwareWalletWarning() {
    return api.by.xpath(
      '//android.widget.TextView[contains(@text, "不要导入硬件钱包的助记词")]',
    );
  }

  /**
   * 助记词长度选择按钮 - "12 个单词" / "24 个单词" 等
   * resource-id: phrase-length
   * content-desc: "12 个单词"
   * bounds: [54,471][276,524]
   */
  get phraseLengthButton() {
    return api.by.id('phrase-length');
  }

  /**
   * 获取第 index 个助记词输入框（0-based）
   * 第一个输入框 xpath: //android.widget.EditText[@resource-id="phrase-input-index0"]
   * 支持 12/15/18/21/24 词：phrase-input-index0 ~ phrase-input-index23
   * @param {number} index - 助记词序号 0~23
   * @returns {ChainablePromiseElement}
   */
  getPhraseInput(index) {
    if (index < 0 || index > 23) {
      throw new Error('phrase index must be 0~23');
    }
    return api.by.xpath(
      `//android.widget.EditText[@resource-id="phrase-input-index${index}"]`,
    );
  }

  /**
   * 第一个助记词输入框（固定使用指定 xpath）
   * resource-id: phrase-input-index0
   */
  get phraseInputFirst() {
    return api.by.xpath(
      '//android.widget.EditText[@resource-id="phrase-input-index0"]',
    );
  }

  /**
   * 确认按钮 - 底部主操作按钮
   * text: "确认" / content-desc: "确认"
   * bounds: [54,2180][1029,2311]
   */
  get confirmButton() {
    return api.by.xpath(
      '//android.widget.Button[@content-desc="确认" or @text="确认"]',
    );
  }

  // ========== 操作方法 ==========

  /**
   * 点击返回按钮，返回 addExistingWallet 页面
   */
  async clickBackButton() {
    await api.tap(this.backButton);
    await addExistingWalletPage.waitEntryPage();
  }

  /**
   * 点击右上角切换语言按钮
   */
  async clickLanguageSwitchButton() {
    await api.tap(this.languageSwitchButton);
  }

  /**
   * 点击助记词 Tab
   */
  async clickTabMnemonic() {
    await api.tap(this.tabMnemonic);
  }

  /**
   * 点击私钥 Tab
   */
  async clickTabPrivateKey() {
    await api.tap(this.tabPrivateKey);
  }

  /**
   * 点击助记词长度选择按钮（如 "12 个单词"）
   */
  async clickPhraseLengthButton() {
    await api.tap(this.phraseLengthButton);
  }

  /**
   * 在指定序号的助记词输入框中输入内容
   * @param {number} index - 助记词序号 0~23
   * @param {string} value - 要输入的助记词
   */
  async setPhraseInput(index, value) {
    const input = this.getPhraseInput(index);
    await api.setValue(input, value);
  }

  /**
   * 按顺序填写全部助记词（支持 12/15/18/21/24 词）
   * @param {string[]} words - 助记词数组，长度为 12、15、18、21 或 24
   */
  async fillMnemonicPhrases(words) {
    const count = Math.min(words.length, 24);
    for (let i = 0; i < count; i++) {
      await this.setPhraseInput(i, words[i]);
    }
  }

  /**
   * 选择助记词长度（在点击 phraseLength 后弹出的选项中选对应词数）
   * @param {number} wordCount - 12、15、18、21 或 24
   */
  async selectPhraseLengthByWordCount(wordCount) {
    const validCounts = [12, 15, 18, 21, 24];
    if (!validCounts.includes(wordCount)) {
      throw new Error(`wordCount must be one of ${validCounts.join(', ')}`);
    }
    await this.clickPhraseLengthButton();
    // 选项可能是可点击的父节点或文案节点，优先点包含词数的可点击项
    const option = api.by.xpath(
      `(//*[contains(@text, "${wordCount}") or contains(@content-desc, "${wordCount}")])[1]`,
    );
    await api.tap(option);
  }

  /**
   * 点击第一个助记词输入框（聚焦后便于输入）
   */
  async clickPhraseInputFirst() {
    await api.tap(this.phraseInputFirst);
  }

  /**
   * 点击确认按钮
   */
  async clickConfirmButton() {
    await api.tap(this.confirmButton);
  }

  /**
   * 验证页面是否已加载
   */
  async verifyPageLoaded() {
    await this.waitEntryPage();
    await this.assertCurrentPage();
  }
}

export const importMnemonicPage = new ImportMnemonicPage();
