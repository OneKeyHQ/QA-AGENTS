/**
 * ExploreTabManage页面 - 可交互元素规则
 * 对应页面对象: exploreTabManagePage (tabsPage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'exploreTabManagePage',
  pageFile: 'tabsPage.js',
  elements: {
    // ========== 导航类元素 ==========
    doneBtn: {
      action: 'navigate',
      target: 'done',
      description: '跳转到done',
    },
  },
};
