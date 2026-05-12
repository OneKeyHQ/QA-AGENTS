import Page from '../pages/base.js';
import { api } from '@node-e2e/cli/api/index.js';

/**
 * LanguageSelect 弹层 - Language Select Popup
 * 参考：xmls/onboarding/onboardingLanguageChinese.xml
 * 弹层容器路径：//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[4]
 */
class LanguageSelectPopup extends Page {
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
   * 弹层关键元素 - 用于判断弹层是否加载完成
   */
  get keyElement() {
    return this.popupTitle;
  }

  // ========== 弹层头部元素 ==========

  /**
   * 弹层标题 - "语言" / "Language"
   * text: "语言" / "Language"
   * bounds: [106,570][212,644]
   * 定位方式：使用文本内容定位，支持中英文
   */
  get popupTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="语言" or @text="Language"]',
    );
  }

  /**
   * 关闭按钮 - 右上角关闭图标按钮
   * resource-id: "popover-btn-close"
   * bounds: [897,570][976,648]
   * 定位方式：优先使用 resource-id，最稳定
   */
  get closeButton() {
    return api.by.id('popover-btn-close');
  }

  // ========== 语言选项列表 ==========

  /**
   * 英语选项 - English
   * resource-id: "select-item-en"
   * text: "English"
   * bounds: [85,728][997,844]
   * 定位方式：优先使用 resource-id，最稳定
   */
  get englishOption() {
    return api.by.id('select-item-en');
  }

  /**
   * 简体中文选项 - Simplified Chinese
   * resource-id: "select-item-zh-CN"
   * text: "简体中文"
   * bounds: [85,844][997,960]
   * 定位方式：优先使用 resource-id，最稳定
   */
  get simplifiedChineseOption() {
    return api.by.id('select-item-zh-CN');
  }

  /**
   * 繁体中文（香港）选项 - Traditional Chinese (Hong Kong)
   * resource-id: "select-item-zh-HK"
   * text: "繁體中文（香港）"
   * bounds: [85,960][997,1076]
   * 定位方式：优先使用 resource-id，最稳定
   */
  get traditionalChineseHKOption() {
    return api.by.id('select-item-zh-HK');
  }

  /**
   * 繁体中文（台湾）选项 - Traditional Chinese (Taiwan)
   * resource-id: "select-item-zh-TW"
   * text: "繁體中文（臺灣）"
   * bounds: [85,1076][997,1192]
   * 定位方式：优先使用 resource-id，最稳定
   */
  get traditionalChineseTWOption() {
    return api.by.id('select-item-zh-TW');
  }

  /**
   * 日语选项 - Japanese
   * resource-id: "select-item-ja-JP"
   * text: "日本語"
   * bounds: [85,1192][997,1308]
   * 定位方式：优先使用 resource-id，最稳定
   */
  get japaneseOption() {
    return api.by.id('select-item-ja-JP');
  }

  /**
   * 韩语选项 - Korean
   * resource-id: "select-item-ko-KR"
   * text: "한국어"
   * bounds: [85,1308][997,1424]
   * 定位方式：优先使用 resource-id，最稳定
   */
  get koreanOption() {
    return api.by.id('select-item-ko-KR');
  }

  /**
   * 孟加拉语选项 - Bengali
   * resource-id: "select-item-bn"
   * text: "বাংলা"
   * bounds: [85,1424][997,1540]
   * 定位方式：优先使用 resource-id，最稳定
   */
  get bengaliOption() {
    return api.by.id('select-item-bn');
  }

  /**
   * 德语选项 - German
   * resource-id: "select-item-de"
   * text: "Deutsch"
   * bounds: [85,1540][997,1656]
   * 定位方式：优先使用 resource-id，最稳定
   */
  get germanOption() {
    return api.by.id('select-item-de');
  }

  /**
   * 西班牙语选项 - Spanish
   * resource-id: "select-item-es"
   * text: "Español"
   * bounds: [85,1656][997,1772]
   * 定位方式：优先使用 resource-id，最稳定
   */
  get spanishOption() {
    return api.by.id('select-item-es');
  }

  /**
   * 法语选项 - French
   * resource-id: "select-item-fr-FR"
   * text: "Français"
   * bounds: [85,1772][997,1888]
   * 定位方式：优先使用 resource-id，最稳定
   */
  get frenchOption() {
    return api.by.id('select-item-fr-FR');
  }

  /**
   * 印地语选项 - Hindi
   * resource-id: "select-item-hi-IN"
   * text: "हिन्दी"
   * bounds: [85,1888][997,2004]
   * 定位方式：优先使用 resource-id，最稳定
   */
  get hindiOption() {
    return api.by.id('select-item-hi-IN');
  }

  /**
   * 印尼语选项 - Indonesian
   * resource-id: "select-item-id"
   * text: "Bahasa Indonesia"
   * bounds: [85,2004][997,2120]
   * 定位方式：优先使用 resource-id，最稳定
   */
  get indonesianOption() {
    return api.by.id('select-item-id');
  }

  /**
   * 意大利语选项 - Italian
   * resource-id: "select-item-it-IT"
   * text: "Italiano"
   * bounds: [85,2120][997,2236]
   * 定位方式：优先使用 resource-id，最稳定
   */
  get italianOption() {
    return api.by.id('select-item-it-IT');
  }

  /**
   * 葡萄牙语选项 - Portuguese
   * resource-id: "select-item-pt"
   * text: "Português"
   * bounds: [85,2236][997,2284]
   * 定位方式：优先使用 resource-id，最稳定
   */
  get portugueseOption() {
    return api.by.id('select-item-pt');
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
  async clickCloseButton() {
    await api.tap(this.closeButton);
  }

  /**
   * 选择英语
   */
  async selectEnglish() {
    await api.tap(this.englishOption);
  }

  /**
   * 选择简体中文
   */
  async selectSimplifiedChinese() {
    await api.tap(this.simplifiedChineseOption);
  }

  /**
   * 选择繁体中文（香港）
   */
  async selectTraditionalChineseHK() {
    await api.tap(this.traditionalChineseHKOption);
  }

  /**
   * 选择繁体中文（台湾）
   */
  async selectTraditionalChineseTW() {
    await api.tap(this.traditionalChineseTWOption);
  }

  /**
   * 选择日语
   */
  async selectJapanese() {
    await api.tap(this.japaneseOption);
  }

  /**
   * 选择韩语
   */
  async selectKorean() {
    await api.tap(this.koreanOption);
  }

  /**
   * 选择孟加拉语
   */
  async selectBengali() {
    await api.tap(this.bengaliOption);
  }

  /**
   * 选择德语
   */
  async selectGerman() {
    await api.tap(this.germanOption);
  }

  /**
   * 选择西班牙语
   */
  async selectSpanish() {
    await api.tap(this.spanishOption);
  }

  /**
   * 选择法语
   */
  async selectFrench() {
    await api.tap(this.frenchOption);
  }

  /**
   * 选择印地语
   */
  async selectHindi() {
    await api.tap(this.hindiOption);
  }

  /**
   * 选择印尼语
   */
  async selectIndonesian() {
    await api.tap(this.indonesianOption);
  }

  /**
   * 选择意大利语
   */
  async selectItalian() {
    await api.tap(this.italianOption);
  }

  /**
   * 选择葡萄牙语
   */
  async selectPortuguese() {
    await api.tap(this.portugueseOption);
  }
}

export const languageSelectPopup = new LanguageSelectPopup();
