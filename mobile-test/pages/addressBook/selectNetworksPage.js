/**
 * 地址簿 - 选择网络页（添加地址时选链）
 * 对应 xml: xmls/addressBook/addressBookSelectNetworksEnglish.xml
 */
import { api } from '@node-e2e/cli/api/index.js';

import Page from '../base.js';

class AddressBookSelectNetworksPage extends Page {
  get keyElement() {
    return this.searchInput;
  }

  get closeBtn() {
    return api.by.id('nav-header-close');
  }

  get searchInput() {
    return api.by.id('nav-header-search-chain-selector');
  }

  /**
   * 根据网络项 resource-id 获取选项元素
   * 例如: select-item-btc--0, select-item-evm--1, select-item-tron--0x2b6653dc
   */
  getNetworkItemById(networkId) {
    return api.by.id(`select-item-${networkId}`);
  }

  /**
   * 根据网络名称文本获取选项（列表内 TextView 的 resource-id 为 select-item-select-item-xxx）
   */
  getNetworkItemByText(networkName) {
    return api.by.xpath(
      `//android.widget.TextView[@text="${networkName}"]/parent::android.view.ViewGroup`,
    );
  }

  async close() {
    await api.tap(this.closeBtn);
  }

  async inputSearch(keyword) {
    await api.setValue(this.searchInput, keyword);
  }

  async selectNetworkById(networkId) {
    const item = this.getNetworkItemById(networkId);
    await api.tap(item);
  }

  async selectNetworkByName(networkName) {
    const item = this.getNetworkItemByText(networkName);
    await api.tap(item);
  }
}

export const addressBookSelectNetworksPage = new AddressBookSelectNetworksPage();
