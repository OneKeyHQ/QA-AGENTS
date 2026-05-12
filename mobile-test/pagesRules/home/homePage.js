/**
 * 首页 - 可交互元素规则
 * 对应页面对象: homePage (homePage.js)
 * 用于生成测试用例
 */
export default {
  page: 'homePage',
  pageFile: 'homePage.js',
  elements: {
    moreActionsBtn: {
      action: 'navigate',
      target: 'menuPage',
      description: '打开菜单页面',
    },
  },
};
