import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';

/**
 * 钱包选择器页面（侧边栏钱包列表 + 账户列表）
 * 来源: xmls/wallets/walletSelectorChinese.xml
 */
class WalletSelectorPage extends Page {
  get keyElement() {
    return this.walletList;
  }

  // ========== 左侧钱包列表 ==========

  get walletList() {
    return api.by.id('account-selector-wallet-list');
  }

  /** 添加钱包按钮 resource-id="add-wallet"，下方文案「钱包」 */
  get addWalletButton() {
    return api.by.id('add-wallet');
  }

  /** 已导入的私钥钱包项 content-desc="导入私钥" / resource-id="wallet-imported" */
  get importedWalletItem() {
    return api.by.xpath(
      '//android.view.ViewGroup[@content-desc="导入私钥" or .//android.widget.TextView[@text="导入私钥"]]',
    );
  }

  get walletImportedButton() {
    return api.by.id('wallet-imported');
  }

  // ========== 右侧账户区域 ==========

  get accountList() {
    return api.by.id('account-selector-accountList');
  }

  get accountHeader() {
    return api.by.id('account-selector-header');
  }

  /** 搜索账户名称输入框 */
  get searchAccountInput() {
    return api.by.xpath(
      '//android.widget.EditText[@hint="搜索账户名称"]',
    );
  }

  /** 账户列表区域内的「添加」按钮 */
  get accountSearchBarAddButton() {
    return api.by.id('account-search-bar-add-button');
  }

  /** 第 index 个账户项 resource-id="account-item-index-0" 等 */
  getAccountItem(index) {
    return api.by.id(`account-item-index-${index}`);
  }

  /** 添加账户入口 resource-id="account-add-account"，文案「帐户」 */
  get addAccountEntry() {
    return api.by.id('account-add-account');
  }

  /** 某个账户的编辑按钮 resource-id="account-item-edit-button-Account #1" 等 */
  getAccountEditButton(accountName) {
    return api.by.id(`account-item-edit-button-${accountName}`);
  }

  // ========== 操作方法 ==========

  async clickAddWallet() {
    await api.tap(this.addWalletButton);
  }

  async clickImportedWallet() {
    await api.tap(this.importedWalletItem);
  }

  async clickWalletImportedButton() {
    await api.tap(this.walletImportedButton);
  }

  async searchAccount(keyword) {
    await api.setValue(this.searchAccountInput, keyword);
  }

  async clickAccountSearchBarAdd() {
    await api.tap(this.accountSearchBarAddButton);
  }

  async clickAccountItem(index) {
    await api.tap(this.getAccountItem(index));
  }

  async clickAddAccountEntry() {
    await api.tap(this.addAccountEntry);
  }

  async clickAccountEditButton(accountName) {
    await api.tap(this.getAccountEditButton(accountName));
  }
}

export const walletSelectorPage = new WalletSelectorPage();
