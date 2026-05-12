/**
 * 地址簿 - 添加/编辑地址表单页
 * 对应 xml: xmls/addressBook/addressBookAddAddressEnglish.xml / addressBookAddAddressChinese.xml
 */
import { api } from '@node-e2e/cli/api/index.js';

import Page from '../../pages/base.js';
import { networkSelectorModal } from '../../pages/modal/networkSelectorModalPage.js';
import util from '../../util/index.js';

class AddressBookAddAddressPage extends Page {
  get keyElement() {
    return this.networkSelectBtn;
  }

  /**
   * 页面标题 - Page Title
   * text: "添加地址" | "Add address"
   */
  get pageTitle() {
    return api.by.text(['添加地址', 'Add address']);
  }

  get backBtn() {
    return api.by.id('nav-header-back');
  }

  /**
   * 网络标签 - Network Label
   * text: "网络" | "Network"
   */
  get networkLabel() {
    return api.by.text(['网络', 'Network']);
  }

  /**
   * 名称标签 - Name Label
   * text: "名称" | "Name"
   */
  get nameLabel() {
    return api.by.text(['名称', 'Name']);
  }

  /**
   * 地址标签 - Address Label
   * text: "地址" | "Address"
   */
  get addressLabel() {
    return api.by.text(['地址', 'Address']);
  }

  get currentNetworkText() {
    return api.by.idStartWith('address-form-network-value-');
  }

  get networkSelectBtn() {
    return api.by.id('network-selector-input');
  }

  get networkSelectorInputText() {
    return api.by.id('network-selector-input-text');
  }

  get nameInput() {
    return api.by.id('address-form-name');
  }

  /**
   * 名称输入框（多语言 hint 定位备选）
   * hint: "必需" | "Required"
   */
  get nameInputByHint() {
    return api.by.text(['必需', 'Required']);
  }

  get addressInput() {
    return api.by.id('address-form-address');
  }

  get copyBtn() {
    return api.by.id('address-form-address-clip');
  }

  get scanBtn() {
    return api.by.id('address-form-address-scan');
  }

  get saveBtn() {
    return api.by.id('address-form-save');
  }

  /**
   * 保存按钮（多语言文本定位备选）
   * content-desc/text: "保存" | "Save"
   */
  get saveBtnByText() {
    return api.by.text(['保存', 'Save']);
  }

  get removeBtn() {
    return api.by.id('address-form-remove');
  }

  get removeConfirmBtn() {
    return api.by.id('address-remove-confirm');
  }

  get formNameMessage() {
    return api.by.id('address-form-name-field-message');
  }

  get formAddressMessage() {
    return api.by.id('address-form-address-field-message');
  }

  async inputName(name) {
    await api.setValue(this.nameInput, name);
  }

  async inputAddress(value) {
    await api.setValue(this.addressInput, value);
  }

  async clickScanBtn() {
    await api.tap(this.scanBtn);
    await api.allowSysAlerts();
  }

  async clickSaveBtn() {
    await api.tap(this.saveBtn);
  }

  async clickSaveBtnForScan() {
    await api.tap(this.saveBtn);
  }

  async clickRemoveBtn() {
    await api.tap(this.removeBtn);
  }

  async clickRemoveConfirmBtn() {
    await api.tap(this.removeConfirmBtn);
  }

  async save({ name, address, chainId }) {
    if (chainId) {
      await this.clickSelectChain();
      await networkSelectorModal.waitEntryPage();
      await networkSelectorModal.selectNetworkById(chainId);
    }

    if (name) {
      await this.inputName(name);
    }
    if (address) {
      await this.inputAddress(address);
    }

    await api.tap(this.saveBtn);
  }

  async clickSelectChain() {
    await api.tap(this.networkSelectBtn);
  }

  async pushQRcodeFile(text) {
    const base64 = await util.generateQRCodeBase64(text);
    await api.pushToImageDir(base64);
  }

  async expectAddressDuplicateTip() {
    const isNameMessageVisible = await this.formNameMessage.isDisplayed();
    expect(isNameMessageVisible).toBe(true);
  }

  async expectMismatchedDomainAndChainTip() {
    const isAddressMessageVisible = await this.formAddressMessage.isDisplayed();
    expect(isAddressMessageVisible).toBe(true);
  }
}

export const addressBookAddAddressPage = new AddressBookAddAddressPage();
