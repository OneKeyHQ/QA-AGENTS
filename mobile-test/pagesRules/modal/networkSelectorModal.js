/**
 * NetworkSelectorModal页面 - 可交互元素规则
 * 对应页面对象: networkSelectorModal (networkSelectorModalPage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'networkSelectorModal',
  pageFile: 'networkSelectorModalPage.js',
  elements: {
    // ========== 输入类元素 ==========
    searchInput: {
      action: 'input',
      target: 'search',
      description: '输入search',
    },
  },
};
