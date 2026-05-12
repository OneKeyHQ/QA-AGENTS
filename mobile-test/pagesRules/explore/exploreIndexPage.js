/**
 * ExploreIndex页面 - 可交互元素规则
 * 对应页面对象: exploreIndexPage (indexPage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'exploreIndexPage',
  pageFile: 'indexPage.js',
  elements: {
    // ========== 导航类元素 ==========
    searchBtn: {
      action: 'navigate',
      target: 'search',
      description: '跳转到search',
    },
    // ========== 输入类元素 ==========
    searchInput: {
      action: 'input',
      target: 'search',
      description: '输入search',
    },
    // ========== 操作类元素 ==========
    searchResultElement: {
      action: 'tap',
      target: 'searchresultelement',
      description: '点击search result element',
    },
  },
};
