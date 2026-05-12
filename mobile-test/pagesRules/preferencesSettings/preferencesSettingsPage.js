/**
 * 偏好设置页 - 可交互元素规则
 * 对应页面对象: preferencesSettingsPage (preferencesSettingsPage.js)
 * 用于生成测试用例
 */
export default {
  page: 'preferencesSettingsPage',
  pageFile: 'general/preferencesSettingsPage.js',
  elements: {
    closeBtn: {
      action: 'navigate',
      target: 'previous',
      description: '关闭偏好设置页并返回上一页',
    },
    languageOption: {
      action: 'navigate',
      target: 'languageSettings',
      description: '打开语言设置页面',
    },
    defaultCurrencyOption: {
      action: 'navigate',
      target: 'currencySettings',
      description: '打开默认货币设置页面',
    },
    themeOption: {
      action: 'navigate',
      target: 'themeSettings',
      description: '打开主题设置页面',
    },
    notificationsOption: {
      action: 'navigate',
      target: 'notificationsSettings',
      description: '打开通知设置页面',
    },
  },
};
