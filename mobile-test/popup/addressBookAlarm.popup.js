import Page from '../pages/base.js';
import { api } from '@node-e2e/cli/api/index.js';

/**
 * 地址簿弹层 - Address Book Alarm Popup
 * 参考：xmls/popups/addressbookAlarmPopupChinese.xml / addressbookAlarmPopupEnglish.xml
 * 弹层容器路径：//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/.../android.view.ViewGroup[4]
 * 多语言：默认先根据中文查找，使用 api.by.text([中文, English]) 实现中文优先
 */
class AddressBookAlarmPopup extends Page {
  /**
   * 弹层容器 - Popup Container
   * 路径：//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[4]
   */
  get container() {
    return api.by.xpath(
      '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[4]',
    );
  }

  /**
   * 标题 - Title
   * 中文: "地址簿" | English: "Address book"
   */
  get title() {
    return api.by.text(['地址簿', 'Address book']);
  }

  /**
   * 描述文本 - Description Text
   * 中文: "了解 OneKey 地址簿如何提升联系人地址的安全性" | English: "Discover how the OneKey address book enhances..."
   */
  get description() {
    return api.by.text([
      '了解 OneKey 地址簿如何提升联系人地址的安全性',
      'Discover how the OneKey address book enhances the security of your contact addresses.',
    ]);
  }

  /**
   * 加密存储标题 - Encrypted Storage Title
   * 中文: "数据加密" | English: "Encrypted storage"
   */
  get encryptedStorageTitle() {
    return api.by.text(['数据加密', 'Encrypted storage']);
  }

  /**
   * 加密存储描述 - Encrypted Storage Description
   * 中文: "OneKey 保护您的信息安全。您所有的联系人数据都将被加密并在每次使用时进行验证，防止数据被篡改"
   * English: "OneKey ensures your information security. All your contact data is encrypted and hash-verified with each use to prevent tampering."
   */
  get encryptedStorageDescription() {
    return api.by.text([
      'OneKey 保护您的信息安全。您所有的联系人数据都将被加密并在每次使用时进行验证，防止数据被篡改',
      'OneKey ensures your information security. All your contact data is encrypted and hash-verified with each use to prevent tampering.',
    ]);
  }

  /**
   * 转账白名单标题 - Transfer Allowlist Title
   * 中文: "转账白名单" | English: "Transfer allowlist"
   */
  get transferAllowlistTitle() {
    return api.by.text(['转账白名单', 'Transfer allowlist']);
  }

  /**
   * 转账白名单状态 - Transfer Allowlist Status
   * 中文: "已禁用" | English: "Disabled"
   */
  get transferAllowlistStatus() {
    return api.by.text(['已禁用', 'Disabled']);
  }

  /**
   * 转账白名单描述 - Transfer Allowlist Description
   * 中文优先：contains("您只能将资金转移") or contains("You can only transfer funds...")
   */
  get transferAllowlistDescription() {
    return api.by.xpath(
      '//android.widget.TextView[contains(@text, "您只能将资金转移") or contains(@text, "You can only transfer funds to accounts within the wallet")]',
    );
  }

  /**
   * OK按钮 - OK Button
   * resource-id: "encrypted-storage-confirm"
   * content-desc: "OK"
   * bounds: [53,2153][1028,2285]
   */
  get okBtn() {
    return api.by.id('encrypted-storage-confirm');
  }

  // ========== 操作方法 ==========

  /**
   * 等待弹层显示
   */
  async waitForPopup() {
    await api.waitPageByElement(this.container);
  }

  /**
   * 验证弹层是否显示
   */
  async verifyPopupDisplayed() {
    const isDisplayed = await this.container.isDisplayed();
    return isDisplayed;
  }

  /**
   * 点击OK按钮
   */
  async clickOkBtn() {
    await api.tap(this.okBtn);
  }

  /**
   * 等待OK按钮显示
   */
  async waitForOkBtn() {
    await api.waitPageByElement(this.okBtn);
  }

  /**
   * 验证标题是否显示
   */
  async verifyTitleDisplayed() {
    const isDisplayed = await this.title.isDisplayed();
    return isDisplayed;
  }

  /**
   * 验证描述文本是否显示
   */
  async verifyDescriptionDisplayed() {
    const isDisplayed = await this.description.isDisplayed();
    return isDisplayed;
  }
}

export const addressBookAlarmPopup = new AddressBookAlarmPopup();
