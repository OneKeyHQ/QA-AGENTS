/**
 * PreferencesSettings页面 - 可交互元素规则
 * 对应页面对象: preferencesSettingsPage (preferencesSettingsPage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'preferencesSettingsPage',
  pageFile: 'preferencesSettingsPage.js',
  elements: {
    // ========== 导航类元素 ==========
    closeBtn: {
      action: 'navigate',
      target: 'closeButton',
      description: '跳转到closeButton',
    },
    // ========== 操作类元素 ==========
    preferencesTitle: {
      action: 'tap',
      target: 'preferencestitle',
      description: '点击preferences title',
    },
    languageOption: {
      action: 'tap',
      target: 'languageoption',
      description: '点击language option',
    },
    languageValue: {
      action: 'tap',
      target: 'languagevalue',
      description: '点击language value',
    },
    defaultCurrencyOption: {
      action: 'tap',
      target: 'defaultcurrencyoption',
      description: '点击default currency option',
    },
    defaultCurrencyValue: {
      action: 'tap',
      target: 'defaultcurrencyvalue',
      description: '点击default currency value',
    },
    themeOption: {
      action: 'tap',
      target: 'themeoption',
      description: '点击theme option',
    },
    themeValue: {
      action: 'tap',
      target: 'themevalue',
      description: '点击theme value',
    },
    notificationsOption: {
      action: 'tap',
      target: 'notificationsoption',
      description: '点击notifications option',
    },
  },
};
