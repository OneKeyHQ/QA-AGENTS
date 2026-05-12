/**
 * UseGoogle页面 - 可交互元素规则
 * 对应页面对象: useGooglePage (useGooglePage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'useGooglePage',
  pageFile: 'useGooglePage.js',
  elements: {
    // ========== 导航类元素 ==========
    nextButton: {
      action: 'navigate',
      target: 'next',
      description: '跳转到next',
    },
    // ========== 操作类元素 ==========
    webView: {
      action: 'tap',
      target: 'webview',
      description: '点击web view',
    },
  },
};
