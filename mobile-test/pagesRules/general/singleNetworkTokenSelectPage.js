/**
 * SingleNetworkTokenSelect页面 - 可交互元素规则
 * 对应页面对象: singleNetworkTokenSelectPage (singleNetworkTokenSelectPage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'singleNetworkTokenSelectPage',
  pageFile: 'singleNetworkTokenSelectPage.js',
  elements: {
    // ========== 导航类元素 ==========
    closeBtn: {
      action: 'navigate',
      target: 'closeButton',
      description: '跳转到closeButton',
    },
    ethTokenBtn: {
      action: 'navigate',
      target: 'ethtoken',
      description: '跳转到ethtoken',
    },
    usdtTokenBtn: {
      action: 'navigate',
      target: 'usdttoken',
      description: '跳转到usdttoken',
    },
    // ========== 输入类元素 ==========
    searchInput: {
      action: 'input',
      target: 'search',
      description: '输入search',
    },
    // ========== 操作类元素 ==========
    networkLabel: {
      action: 'tap',
      target: 'networklabel',
      description: '点击network label',
    },
    popularTokenTitle: {
      action: 'tap',
      target: 'populartokentitle',
      description: '点击popular token title',
    },
    allTokenButtons: {
      action: 'tap',
      target: 'alltokenbuttons',
      description: '点击all token buttons',
    },
  },
};
