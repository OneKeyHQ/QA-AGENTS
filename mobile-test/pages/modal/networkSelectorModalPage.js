import { api } from '@node-e2e/cli/api/index.js';

import Popover from './popover.js';

class NetworkSelectorModal extends Popover {
  get searchInput() {
    return api.by.id('nav-header-search-chain-selector');
  }

  async keyElement() {
    return api.by.id('network-selector-input');
  }

  async selectNetworkById(id) {
    try {
      await api.tap(api.by.id(`select-item-${id}`));
    } catch (error) {}
  }

  async searchAndSelectNetwork(chainName) {
    // 在搜索框中输入链名称
    await api.setValue(this.searchInput, chainName);
    await api.pause(1000); // 等待搜索结果

    // 通过文本匹配查找网络项
    const networkItem = api.by.xpath(`//android.widget.TextView[@text="${chainName}"]`);
    await api.tap(networkItem);
  }
}

export const networkSelectorModal = new NetworkSelectorModal();
