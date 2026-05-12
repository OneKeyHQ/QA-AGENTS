/**
 * Dev页面 - 可交互元素规则
 * 对应页面对象: devPage (devPage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'devPage',
  pageFile: 'devPage.js',
  elements: {
    // ========== 导航类元素 ==========
    globalDevBtn: {
      action: 'navigate',
      target: 'globaldev',
      description: '跳转到globaldev',
    },
  },
};
