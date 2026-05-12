/**
 * 语言选择弹层 - 可交互元素规则
 * 对应页面对象: languageSelectPopup (languageSelect.popup.js)
 * 从层级开始：//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[4]
 * 用于生成测试用例
 */
export default {
  page: 'languageSelectPopup',
  pageFile: 'languageSelect.popup.js',
  elements: {
    // ========== 弹层头部元素 ==========
    popupTitle: {
      action: 'verify',
      target: 'popupTitle',
      description: '弹层标题 - "语言"',
    },
    closeButton: {
      action: 'click',
      target: 'closeButton',
      description: '关闭按钮 - 右上角关闭图标',
    },
    // ========== 语言选项列表 ==========
    englishOption: {
      action: 'click',
      target: 'englishOption',
      description: '选择英语 - English',
    },
    simplifiedChineseOption: {
      action: 'click',
      target: 'simplifiedChineseOption',
      description: '选择简体中文 - 简体中文',
    },
    traditionalChineseHKOption: {
      action: 'click',
      target: 'traditionalChineseHKOption',
      description: '选择繁体中文（香港） - 繁體中文（香港）',
    },
    traditionalChineseTWOption: {
      action: 'click',
      target: 'traditionalChineseTWOption',
      description: '选择繁体中文（台湾） - 繁體中文（臺灣）',
    },
    japaneseOption: {
      action: 'click',
      target: 'japaneseOption',
      description: '选择日语 - 日本語',
    },
    koreanOption: {
      action: 'click',
      target: 'koreanOption',
      description: '选择韩语 - 한국어',
    },
    bengaliOption: {
      action: 'click',
      target: 'bengaliOption',
      description: '选择孟加拉语 - বাংলা',
    },
    germanOption: {
      action: 'click',
      target: 'germanOption',
      description: '选择德语 - Deutsch',
    },
    spanishOption: {
      action: 'click',
      target: 'spanishOption',
      description: '选择西班牙语 - Español',
    },
    frenchOption: {
      action: 'click',
      target: 'frenchOption',
      description: '选择法语 - Français',
    },
    hindiOption: {
      action: 'click',
      target: 'hindiOption',
      description: '选择印地语 - हिन्दी',
    },
    indonesianOption: {
      action: 'click',
      target: 'indonesianOption',
      description: '选择印尼语 - Bahasa Indonesia',
    },
    italianOption: {
      action: 'click',
      target: 'italianOption',
      description: '选择意大利语 - Italiano',
    },
    portugueseOption: {
      action: 'click',
      target: 'portugueseOption',
      description: '选择葡萄牙语 - Português',
    },
  },
};
