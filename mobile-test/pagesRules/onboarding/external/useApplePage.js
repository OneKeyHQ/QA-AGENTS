/**
 * UseApple页面 - 可交互元素规则
 * 对应页面对象: useApplePage (useApplePage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'useApplePage',
  pageFile: 'useApplePage.js',
  elements: {
    // ========== 导航类元素 ==========
    continueButton: {
      action: 'navigate',
      target: 'continue',
      description: '跳转到continue',
    },
    loginWithiPhoneButton: {
      action: 'navigate',
      target: 'loginwithiphone',
      description: '跳转到loginwithiphone',
    },
    learnMoreLink: {
      action: 'navigate',
      target: 'morePage',
      description: '打开more',
    },
    // ========== 输入类元素 ==========
    accountInput: {
      action: 'input',
      target: 'account',
      description: '输入account',
    },
    // ========== 操作类元素 ==========
    pageTitle: {
      action: 'tap',
      target: 'pagetitle',
      description: '点击page title',
    },
  },
};
