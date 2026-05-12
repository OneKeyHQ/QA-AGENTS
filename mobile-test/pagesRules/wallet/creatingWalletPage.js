/**
 * CreatingWallet页面 - 可交互元素规则
 * 对应页面对象: creatingWalletPage (creatingWalletPage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'creatingWalletPage',
  pageFile: 'creatingWalletPage.js',
  elements: {
    // ========== 操作类元素 ==========
    pageTitle: {
      action: 'tap',
      target: 'pagetitle',
      description: '点击page title',
    },
    doNotExitHint: {
      action: 'tap',
      target: 'donotexithint',
      description: '点击do not exit hint',
    },
    centerIconArea: {
      action: 'tap',
      target: 'centericonarea',
      description: '点击center icon area',
    },
  },
};
