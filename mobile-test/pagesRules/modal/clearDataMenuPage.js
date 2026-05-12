/**
 * ClearDataMenu页面 - 可交互元素规则
 * 对应页面对象: clearDataMenuPage (clearDataMenuPage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'clearDataMenuPage',
  pageFile: 'clearDataMenuPage.js',
  elements: {
    // ========== 导航类元素 ==========
    clearPasswordBtn: {
      action: 'navigate',
      target: 'setPasswordPage',
      description: '打开setPassword',
    },
    clearWalletsDataBtn: {
      action: 'navigate',
      target: 'walletSelectorPage',
      description: '打开walletSelector',
    },
    clearContactsDataBtn: {
      action: 'navigate',
      target: 'clearcontactsdata',
      description: '跳转到clearcontactsdata',
    },
    clearBrowserBtn: {
      action: 'navigate',
      target: 'exploreBrowserPage',
      description: '打开exploreBrowser',
    },
    clearDataMenuBtn: {
      action: 'navigate',
      target: 'menuPage',
      description: '打开menu',
    },
  },
};
