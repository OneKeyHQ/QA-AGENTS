import Page from '../pages/base.js';
import { api } from '@node-e2e/cli/api/index.js';

/**
 * 导入 xpub 后 BTC 派生路径选择弹窗 - Import BTC Publickey Choose Xpub Path Popup
 * 参考：xmls/popups/importXpubBtcDerivePathSelectPopup.xml
 * 弹层容器路径：//android.widget.FrameLayout[@resource-id="android:id/content"]/.../android.view.ViewGroup[4]
 */
class ImportBTCPublickeyChooseXpubPathPopup extends Page {
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
   * 派生路径
   */
  get title() {
    return api.by.text(['派生路径']);
  }

  /**
   * 关闭按钮 - Close Button
   * resource-id: "popover-btn-close"
   */
  get closeBtn() {
    return api.by.id('popover-btn-close');
  }

  /**
   * Taproot 选项 - Taproot (BIP86)
   * resource-id: "select-item-BIP86"
   * 以"bc1p"开头。P2TR (m/86'/0'/0')
   */
  get taprootOption() {
    return api.by.id('select-item-BIP86');
  }

  /**
   * Legacy 选项 - Legacy (BIP44)
   * resource-id: "select-item-BIP44"
   * 以"1"开头。P2PKH (m/44'/0'/0')
   */
  get legacyOption() {
    return api.by.id('select-item-BIP44');
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
   * 点击关闭按钮
   */
  async clickCloseBtn() {
    await api.tap(this.closeBtn);
  }

  /**
   * 选择 Taproot 派生路径
   */
  async selectTaproot() {
    await api.tap(this.taprootOption);
  }

  /**
   * 选择 Legacy 派生路径
   */
  async selectLegacy() {
    await api.tap(this.legacyOption);
  }

  /**
   * 根据 pathType 名称选择同名派生路径（如 Legacy -> Legacy, Taproot -> Taproot）
   */
  async selectPathByType(pathType) {
    switch (pathType) {
      case 'Legacy':
        await this.selectLegacy();
        break;
      case 'Taproot':
        await this.selectTaproot();
        break;
      default:
        throw new Error(`Unsupported pathType in popup: ${pathType}`);
    }
  }

  /**
   * 等待标题显示
   */
  async waitForTitle() {
    await api.waitPageByElement(this.title);
  }
}

export const importBTCPublickeyChooseXpubPathPopup =
  new ImportBTCPublickeyChooseXpubPathPopup();
