import Page from '../pages/base.js';
import { api } from '@node-e2e/cli/api/index.js';

// 通过弹窗固定描述文案反向锚定容器，避免依赖易变的层级 index
const CHOOSE_ADDRESS_TYPE_POPUP_CONTAINER_XPATH =
  '//android.widget.TextView[@text="选择地址类型后，新地址将被设置为交易的默认地址。"]/ancestor::android.view.ViewGroup[2]';

/**
 * 复制地址-选择地址类型弹窗（BTC/LTC）
 * 同一个弹窗对象，BTC 与 LTC 仅为不同状态下的数据装载。
 */
class CopyAddressChoosePathPopup extends Page {
  /**
   * 弹窗主容器（BTC/LTC 两种状态共用）
   */
  get container() {
    return api.by.xpath(CHOOSE_ADDRESS_TYPE_POPUP_CONTAINER_XPATH);
  }

  /**
   * 弹窗标题：选择地址类型
   */
  get title() {
    return api.by.text(['选择地址类型'], this.container);
  }

  /**
   * 弹窗描述文案（用于断言弹窗语义正确）
   */
  get description() {
    return api.by.text(
      ['选择地址类型后，新地址将被设置为交易的默认地址。'],
      this.container,
    );
  }

  /**
   * 弹窗右上角关闭按钮
   */
  get closeBtn() {
    return api.by.xpath('.//android.widget.Button', this.container);
  }

  // ===== BTC 状态（默认均已创建，共 4 种） =====
  get btcTaprootOption() {
    return this.getPathTypeOption('Taproot');
  }

  get btcNestedSegWitOption() {
    return this.getPathTypeOption('Nested SegWit');
  }

  get btcNativeSegWitOption() {
    return this.getPathTypeOption('Native SegWit');
  }

  get btcLegacyOption() {
    return this.getPathTypeOption('Legacy');
  }

  // ===== LTC 状态（默认未创建，共 3 种，点击后创建地址） =====
  get ltcNestedSegWitOption() {
    return this.getPathTypeOption('Nested SegWit');
  }

  get ltcNativeSegWitOption() {
    return this.getPathTypeOption('Native SegWit');
  }

  get ltcLegacyOption() {
    return this.getPathTypeOption('Legacy');
  }

  /**
   * "创建地址" 副标题（LTC 未创建状态下常见）
   */
  get createAddressText() {
    return api.by.xpath(
      './/android.widget.TextView[@resource-id="select-item-subtitle-" and @text="创建地址"]',
      this.container,
    );
  }

  /**
   * 按地址类型名称定位可点击选项行。
   *
   * 说明：
   * - BTC 与 LTC 的地址类型项都复用 `select-item-`；
   * - 因此只需按文本区分（Taproot / Nested SegWit / Native SegWit / Legacy）。
   */
  getPathTypeOption(pathType) {
    return api.by.xpath(
      `.//android.widget.TextView[@resource-id="select-item-" and @text="${pathType}"]/ancestor::android.view.ViewGroup[@clickable="true"][1]`,
      this.container,
    );
  }

  /**
   * 按地址类型名称获取该行副标题元素（地址缩写文案）。
   * 用于在弹层内取「Taproot / Nested SegWit 等」同一行 select-item-subtitle- 的 text 做地址比对。
   * @param {string} pathType - 如 "Taproot", "Nested SegWit", "Native SegWit", "Legacy"
   * @returns {WebdriverIO.Element}
   */
  getSubtitleElementByPathType(pathType) {
    return api.by.xpath(
      `.//android.widget.TextView[@resource-id="select-item-" and @text="${pathType}"]/../android.widget.TextView[@resource-id="select-item-subtitle-"]`,
      this.container,
    );
  }

  /**
   * 等待弹窗出现并确认标题可见。
   */
  async waitForPopup() {
    await api.waitPageByElement(this.container);
    await api.waitPageByElement(this.title);
  }

  async verifyPopupDisplayed() {
    return this.container.isDisplayed();
  }

  async clickCloseBtn() {
    await api.tap(this.closeBtn);
  }

  /**
   * 通用选择入口：按地址类型点击。
   */
  async selectPathType(pathType) {
    const option = this.getPathTypeOption(pathType);
    await api.tap(option);
  }

  /**
   * 点击指定地址类型所在行的副标题元素。
   * @param {string} pathType - 如 "Taproot", "Nested SegWit", "Native SegWit", "Legacy"
   */
  async clickSubtitleElementByPathType(pathType) {
    await api.tap(this.getSubtitleElementByPathType(pathType));
  }

  /**
   * BTC 状态下选择地址类型（4 种，均已创建）。
   */
  async selectBtcPathType(pathType) {
    const supported = ['Taproot', 'Nested SegWit', 'Native SegWit', 'Legacy'];
    if (!supported.includes(pathType)) {
      throw new Error(`Unsupported BTC pathType in popup: ${pathType}`);
    }
    await this.selectPathType(pathType);
  }

  /**
   * LTC 状态下选择地址类型（3 种，默认未创建）。
   */
  async selectLtcPathType(pathType) {
    const supported = ['Nested SegWit', 'Native SegWit', 'Legacy'];
    if (!supported.includes(pathType)) {
      throw new Error(`Unsupported LTC pathType in popup: ${pathType}`);
    }
    await this.selectPathType(pathType);
  }

  /**
   * LTC 未创建地址状态下：点击对应地址类型会触发“创建地址”。
   */
  async createAddressByPathType(pathType) {
    await this.selectLtcPathType(pathType);
  }
}

export const copyAddressChoosePathPopup = new CopyAddressChoosePathPopup();
