import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';

/**
 * 导入助记词或私钥页面
 * 来源: xmls/wallets/importMneOrPrvKeyChinese.xml / importMneOrPrvKeyPrvKeyChinese.xml / importMneOrPrvKeyMneChinese.xml
 */
class ImportMneOrPrvKeyPage extends Page {
  get keyElement() {
    return this.pageTitle;
  }

  // ========== 顶部导航 ==========

  get pageTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="导入助记词或私钥"]',
    );
  }

  get backButton() {
    return api.by.xpath(
      '//android.widget.TextView[@text="导入助记词或私钥"]/ancestor::android.view.ViewGroup[1]//android.widget.Button[1]',
    );
  }

  get closeButton() {
    return api.by.xpath(
      '//android.widget.TextView[@text="导入助记词或私钥"]/ancestor::android.view.ViewGroup[1]//android.view.ViewGroup[6]/android.widget.Button',
    );
  }

  // ========== Tab 切换 ==========

  /** 助记词 Tab */
  get tabMnemonic() {
    return api.by.xpath(
      '//android.view.ViewGroup[@clickable="true"]/android.widget.TextView[@text="助记词"]/..',
    );
  }

  /** 私钥 Tab */
  get tabPrivateKey() {
    return api.by.xpath(
      '//android.view.ViewGroup[@clickable="true"]/android.widget.TextView[@text="私钥"]/..',
    );
  }

  // ========== 私钥模式 ==========

  /** 私钥输入框 hint="输入您的私钥" */
  get privateKeyInput() {
    return api.by.xpath(
      '//android.widget.EditText[@hint="输入您的私钥"]',
    );
  }

  // ========== 助记词模式 ==========

  /** 助记词长度选择 resource-id="phrase-length" 如 "12 个单词" */
  get phraseLengthButton() {
    return api.by.id('phrase-length');
  }

  /** 第 index 个助记词输入框，index 0-11 */
  getPhraseInput(index) {
    return api.by.id(`phrase-input-index${index}`);
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

  async clickCloseButton() {
    await api.tap(this.closeButton);
  }

  async clickTabMnemonic() {
    await api.tap(this.tabMnemonic);
  }

  async clickTabPrivateKey() {
    await api.tap(this.tabPrivateKey);
  }

  async inputPrivateKey(value) {
    await api.setValue(this.privateKeyInput, value);
  }

  async setPhraseWord(index, value) {
    await api.setValue(this.getPhraseInput(index), value);
  }

  async inputMnemonicPhrase(words) {
    for (let i = 0; i < words.length && i < 12; i++) {
      await this.setPhraseWord(i, words[i]);
    }
  }

  async clickConfirm() {
    await api.tap(this.confirmButton);
  }

  async clickPhraseLength() {
    await api.tap(this.phraseLengthButton);
  }
}

export const importMneOrPrvKeyPage = new ImportMneOrPrvKeyPage();
