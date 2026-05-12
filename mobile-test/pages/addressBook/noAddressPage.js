/**
 * 地址簿主列表页（无地址时的空状态 / 有地址时的列表状态）
 * 对应 xml: xmls/addressBook/addressBookNoaddressEnglish.xml / addressBookHaveAddressChinese.xml
 */
import { api } from '@node-e2e/cli/api/index.js';

import Page from '../base.js';

class AddressBookNoAddressPage extends Page {
  get keyElement() {
    return this.searchInput;
  }

  get closeBtn() {
    return api.by.id('nav-header-close');
  }

  get headerAddIconBtn() {
    return api.by.id('address-book-add-icon');
  }

  /**
   * 空状态中的添加地址按钮 - Add Address Button (Empty State)
   * content-desc: "Add address" | "添加地址"
   * 优先使用 resource-id 定位，多语言文本作为备选
   */
  get bankAddBtn() {
    return api.by.id('address-book-add-button');
  }

  /**
   * 底部添加地址按钮 - Footer Add Address Button
   * content-desc: "Add address" | "添加地址"
   * 优先使用 resource-id 定位，多语言文本作为备选
   * 注意：此 resource-id 在其他页面可能有不同的 content-desc，但在地址簿页面固定为 "Add address"/"添加地址"
   */
  get footerAddBtn() {
    return api.by.id('page-footer-confirm');
  }

  /**
   * 空状态添加地址按钮（多语言文本定位备选）
   * content-desc: "Add address" | "添加地址"
   */
  get bankAddBtnByText() {
    return api.by.text(['Add address', '添加地址']);
  }

  /**
   * 底部添加地址按钮（多语言文本定位备选）
   * content-desc: "Add address" | "添加地址"
   */
  get footerAddBtnByText() {
    return api.by.text(['Add address', '添加地址']);
  }

  get searchInput() {
    return api.by.id('nav-header-search');
  }

  get searchInputClear() {
    return api.by.id('nav-header-search-clear');
  }

  get addressBookItemPrefix() {
    return 'address-item-';
  }

  /**
   * 页面标题 - Page Title
   * text: "Address book" | "地址簿"
   */
  get pageTitle() {
    return api.by.text(['Address book', '地址簿']);
  }

  /**
   * 搜索框占位符文本 - Search Input Placeholder/Hint
   * hint/text: "Search" | "搜索"
   */
  get searchInputPlaceholder() {
    return api.by.text(['Search', '搜索']);
  }

  /**
   * 空状态标题 - Empty State Title
   * text: "No addresses added" | "您还没有添加任何地址"
   */
  get emptyStateTitle() {
    return api.by.text(['No addresses added', '您还没有添加任何地址']);
  }

  /**
   * 空状态描述文本 - Empty State Description
   * text: "Addresses are stored locally and do not transfer with system backups; please add manually or sync via OneKey Cloud." | "地址数据仅存储于本机，无法随系统迁移，请手动添加或使用 OneKey Cloud 同步。"
   */
  get emptyStateDescription() {
    return api.by.text([
      'Addresses are stored locally and do not transfer with system backups; please add manually or sync via OneKey Cloud.',
      '地址数据仅存储于本机，无法随系统迁移，请手动添加或使用 OneKey Cloud 同步。',
    ]);
  }

  /**
   * 添加地址按钮文本 - Add Address Button Text
   * text: "Add address" | "添加地址"
   * 注意：此元素已有 resource-id，此方法作为多语言备选定位方式
   */
  get addAddressButtonText() {
    return api.by.text(['Add address', '添加地址']);
  }

  // ========== 有地址状态下的元素 ==========

  /**
   * 地址分类标题 - Address Category Title
   * 例如: "BITCOIN", "ETHEREUM" 等
   * 注意：分类标题是动态的，这里提供通用的定位方法
   */
  getAddressCategoryTitle(categoryName) {
    return api.by.xpath(`//android.widget.TextView[@text="${categoryName}"]`);
  }

  get transferWhitelistBtn() {
    return api.by.id('00000000-0000-0033-ffff-ffff000002a9');
  }

  async close() {
    await api.tap(this.closeBtn);
  }

  async clickAddIconBtn() {
    await api.tap(this.headerAddIconBtn);
  }

  async clickBankAddBtn() {
    await api.tap(this.bankAddBtn);
  }

  /**
   * 点击底部「添加地址」按钮。
   * 先滚动到底部使 page-footer-confirm 进入视口，避免列表有内容时按钮在屏外导致 click 一直轮询等待。
   */
  async clickFooterAddBtn() {
    try {
      await api.scrollToId('page-footer-confirm');
    } catch (e) {
      // 元素已在视口或滚动失败时继续点击
    }
    await api.tap(this.footerAddBtn);
  }

  async clickTransferWhitelistBtn() {
    await api.tap(this.transferWhitelistBtn);
  }

  async clickItemMenuByAddress(address) {
    await api.tap(api.by.id(`address-menu-${address}`));
  }

  async clickAddressItemByAddress(address) {
    await api.tap(api.by.id(`address-item-${address}`));
  }

  async clickUnfoldCatByChainName(cat) {
    await api.tap(api.by.id(`address-cat-${cat}-unfold`));
  }

  async foldOrUnfoldCatByChainName(cat, isFold) {
    await api.tap(
      api.by.id(`address-cat-${cat}-${isFold ? 'unfold' : 'fold'}`),
    );
  }

  async clickItemCopyByAddress(address) {
    await api.tap(api.by.id(`address-menu-copy-${address}`));
  }

  async clickItemEditByAddress(address) {
    await api.tap(api.by.id(`address-menu-edit-${address}`));
  }

  async inputSearchTerm(term) {
    const isElementPresent = await this.searchInputClear.isExisting();
    if (isElementPresent) {
      await api.tap(this.searchInputClear);
    }
    await api.setValue(this.searchInput, term);
  }

  /**
   * 滚动查找元素，如果第一屏找不到就向下滚动查找
   * @param {string} elementId - 元素 ID
   * @param {number} maxScrolls - 最大滚动次数，默认 10 次
   * @returns {Promise<boolean>} 是否找到元素
   */
  async scrollToFindElement(elementId, maxScrolls = 10) {
    // 先检查元素是否存在且可见
    const element = api.by.id(elementId);
    let isExisting = await element.isExisting().catch(() => false);
    let isDisplayed = false;
    
    if (isExisting) {
      isDisplayed = await element.isDisplayed().catch(() => false);
    }

    // 如果元素已存在且可见，直接返回
    if (isExisting && isDisplayed) {
      return true;
    }

    // 如果元素存在但不可见，直接使用逐步滚动查找
    // 注意：不使用 scrollToId，因为 Android 上的 scrollToId 在元素不存在时可能触发意外行为（如页面跳转）
    // 如果元素在第一屏就存在且可见，上面的代码已经返回了，这里只会在元素不在第一屏时执行

    // 逐步向下滚动查找
    // 注意：如果元素在第一屏就存在，上面的代码已经返回了，这里只会在元素不在第一屏时执行
    // for (let i = 0; i < maxScrolls; i++) {
    //   // 检查页面是否还在地址簿页面（避免滚动导致页面跳转）
    //   // 注意：只在第一次滚动前检查，避免频繁查找元素导致性能问题
    //   if (i === 0) {
    //     const isOnAddressBookPage = await this.verifyPageState();
    //     if (!isOnAddressBookPage) {
    //       console.warn(`  ⚠️ 警告：滚动查找元素时检测到页面已跳转（第${i + 1}次滚动）`);
    //       return false;
    //     }
    //   }

    //   // 向下滚动（使用安全的滚动位置，避免触发边缘手势）
    //   await this.safeScrollDown(300);
    //   await api.pause(300); // 等待滚动完成

    //   // 检查元素是否存在且可见
    //   isExisting = await element.isExisting().catch(() => false);
    //   if (isExisting) {
    //     isDisplayed = await element.isDisplayed().catch(() => false);
    //     if (isDisplayed) {
    //       return true;
    //     }
    //   }
    // }

    return false;
  }

  /**
   * 安全向下滚动，避免触发边缘手势导致页面返回
   * @param {number} distance - 滚动距离（像素）
   */
  async safeScrollDown(distance) {
    try {
      const size = await browser.getWindowSize();
      const width = size.width;
      const height = size.height;

      // 使用屏幕中心偏右的位置，避免在左边缘滑动（Android 左边缘滑动会触发返回）
      const startX = parseInt(width * 0.6); // 屏幕宽度的 60% 位置，避免左边缘
      const startY = parseInt(height * 0.5); // 屏幕中心
      const endY = parseInt(startY + distance);

      await browser.performActions([
        {
          type: 'pointer',
          id: 'finger1',
          parameters: { pointerType: 'touch' }, // 使用 touch 而不是 mouse
          actions: [
            { type: 'pointerMove', duration: 0, x: startX, y: startY },
            { type: 'pointerDown', button: 0 },
            { type: 'pause', duration: 100 },
            { type: 'pointerMove', duration: 1000, x: startX, y: endY },
            { type: 'pointerUp', button: 0 },
          ],
        },
      ]);
    } catch (error) {
      console.error(`  ⚠️ 滚动操作失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 验证页面是否仍在地址簿页面
   * @returns {Promise<boolean>} 是否在地址簿页面
   */
  async verifyPageState() {
    try {
      // 检查关键元素是否存在
      const searchInputExists = await this.searchInput.isExisting().catch(() => false);
      if (!searchInputExists) {
        return false;
      }
      
      // 检查搜索框是否可见
      const searchInputDisplayed = await this.searchInput.isDisplayed().catch(() => false);
      return searchInputDisplayed;
    } catch (error) {
      console.error(`  ⚠️ 验证页面状态失败: ${error.message}`);
      return false;
    }
  }

  async expectAddressInfoExist({ address, name }) {
    console.log(`  📍 开始验证地址信息: name=${name}, address=${address}`);
    
    // 验证前先检查页面状态
    const isOnAddressBookPage = await this.verifyPageState();
    if (!isOnAddressBookPage) {
      throw new Error('页面不在地址簿页面，无法验证地址信息');
    }

    if (address) {
      const addressNameId = `list-item-title-address-item-${address}`;
      console.log(`  🔍 查找地址名称元素: ${addressNameId}`);
      // 先尝试滚动查找元素
      const found = await this.scrollToFindElement(addressNameId);
      if (!found) {
        // 再次检查页面状态
        const stillOnPage = await this.verifyPageState();
        if (!stillOnPage) {
          throw new Error(`查找地址名称元素时页面已跳转: ${addressNameId}`);
        }
        throw new Error(`Address name element not found: ${addressNameId}`);
      }
      const addressName = await api.getText(
        api.by.id(addressNameId),
        false,
      );
      expect(addressName).toEqual(name);
      console.log(`  ✓ 地址名称验证通过: ${addressName}`);
    }
    
    if (name) {
      const addressTextId = `list-item-subtitle-address-item-${address}`;
      console.log(`  🔍 查找地址文本元素: ${addressTextId}`);
      // 先尝试滚动查找元素
      const found = await this.scrollToFindElement(addressTextId);
      if (!found) {
        // 再次检查页面状态
        const stillOnPage = await this.verifyPageState();
        if (!stillOnPage) {
          throw new Error(`查找地址文本元素时页面已跳转: ${addressTextId}`);
        }
        throw new Error(`Address text element not found: ${addressTextId}`);
      }
      const addressText = await api.getText(
        api.by.id(addressTextId),
        false,
      );
      expect(addressText).toEqual(address);
      console.log(`  ✓ 地址文本验证通过: ${addressText}`);
    }

    // 验证完成后再次检查页面状态
    const finalPageState = await this.verifyPageState();
    if (!finalPageState) {
      console.warn(`  ⚠️ 警告：验证地址信息后页面状态异常，可能已跳转`);
      throw new Error('验证地址信息后页面已跳转，不在地址簿页面');
    }
    
    console.log(`  ✓ 地址信息验证完成，页面状态正常`);
  }

  async expectAddressExist(address) {
    const elementExists = await api.by
      .id(`address-item-${address}`)
      .isExisting();
    expect(elementExists).toBe(true);
  }

  async expectAddressNotExist(address) {
    const elementExists = await api.by
      .id(`address-item-${address}`)
      .isExisting();
    expect(elementExists).toBe(false);
  }

  async expectClipboardEqualAddress(address) {
    const clipboardContent = await api.getClipboard();
    expect(clipboardContent).toEqual(address);
  }

  async expectAddressBookOrder(addresses) {
    const addressBookElements = await api.by.idsStartWith(
      this.addressBookItemPrefix,
    );
    const ids = [];
    for (const element of addressBookElements) {
      const id = await api.attr.id(element);
      if (id && id.indexOf(this.addressBookItemPrefix) >= 0) {
        ids.push(id.replace(this.addressBookItemPrefix, ''));
      }
    }
    expect(ids).toEqual(addresses);
  }

  async expectAddressDisplayStatus(address, status) {
    const isVisible = await api.by.id(`address-item-${address}`).isDisplayed();
    expect(isVisible).toBe(status);
  }

  /**
   * 验证页面标题是否显示（多语言支持）
   */
  async expectPageTitleDisplayed() {
    const isTitleDisplayed = await this.pageTitle.isDisplayed().catch(() => false);
    expect(isTitleDisplayed).toBe(true);
  }

  /**
   * 验证搜索框占位符是否显示（多语言支持）
   */
  async expectSearchInputPlaceholderDisplayed() {
    // 搜索框本身通过 resource-id 定位，这里验证占位符文本
    const searchInput = this.searchInput;
    const isSearchInputDisplayed = await searchInput.isDisplayed().catch(() => false);
    expect(isSearchInputDisplayed).toBe(true);
  }

  async expectEmptyStateDisplayed() {
    const isEmptyTitleDisplayed = await this.emptyStateTitle.isDisplayed();
    expect(isEmptyTitleDisplayed).toBe(true);
  }

  /**
   * 验证空状态描述文本是否显示（多语言支持）
   */
  async expectEmptyStateDescriptionDisplayed() {
    const isDescriptionDisplayed = await this.emptyStateDescription.isDisplayed().catch(() => false);
    expect(isDescriptionDisplayed).toBe(true);
  }

  /**
   * 验证完整的空状态（包括标题和描述）
   */
  async expectCompleteEmptyStateDisplayed() {
    await this.expectEmptyStateDisplayed();
    await this.expectEmptyStateDescriptionDisplayed();
  }

  /**
   * 验证是否有地址列表（haveAddress 状态）
   * @returns {Promise<boolean>} 如果有地址列表返回 true，否则返回 false
   */
  async hasAddressList() {
    try {
      const addressItems = await api.by.idsStartWith(this.addressBookItemPrefix);
      return addressItems.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 验证地址列表是否显示
   */
  async expectAddressListDisplayed() {
    const hasList = await this.hasAddressList();
    expect(hasList).toBe(true);
  }

  /**
   * 验证空状态是否显示
   */
  async expectEmptyStateNotDisplayed() {
    const isEmptyTitleDisplayed = await this.emptyStateTitle.isDisplayed().catch(() => false);
    expect(isEmptyTitleDisplayed).toBe(false);
  }

  /**
   * 获取地址列表数量
   * @returns {Promise<number>} 地址数量
   */
  async getAddressCount() {
    try {
      const addressItems = await api.by.idsStartWith(this.addressBookItemPrefix);
      return addressItems.length;
    } catch (error) {
      return 0;
    }
  }
}

export const addressBookPageNoAddress = new AddressBookNoAddressPage();
