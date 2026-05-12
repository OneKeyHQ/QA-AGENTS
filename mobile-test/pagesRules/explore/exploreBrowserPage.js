/**
 * ExploreBrowser页面 - 可交互元素规则
 * 对应页面对象: exploreBrowserPage (browserPage.js)
 * 用于生成测试用例
 * 
 * ⚠️ 以下元素需要人工确认：toolBarGoBackBtn, toolBarGoForwardBtn
 */
export default {
  page: 'exploreBrowserPage',
  pageFile: 'browserPage.js',
  elements: {
    // ========== 导航类元素 ==========
    toolBarGoBackBtn: {
      action: 'navigate',
      target: 'bottomNavBarPage',
      description: '打开bottomNavBar',
      // TODO: 需要人工确认目标页面
    },
    toolBarGoForwardBtn: {
      action: 'navigate',
      target: 'bottomNavBarPage',
      description: '打开bottomNavBar',
      // TODO: 需要人工确认目标页面
    },
    toolBarAddBtn: {
      action: 'navigate',
      target: 'bottomNavBarPage',
      description: '打开bottomNavBar',
    },
    toolBarTabsBtn: {
      action: 'navigate',
      target: 'bottomNavBarPage',
      description: '打开bottomNavBar',
    },
    toolBarOptionsBtn: {
      action: 'navigate',
      target: 'bottomNavBarPage',
      description: '打开bottomNavBar',
    },
    closeAllTabBtn: {
      action: 'navigate',
      target: 'exploreTabManagePage',
      description: '打开exploreTabManage',
    },
    // ========== 输入类元素 ==========
    searchInput: {
      action: 'input',
      target: 'search',
      description: '输入search',
    },
    // ========== 操作类元素 ==========
    tabContainer: {
      action: 'tap',
      target: 'tabcontainer',
      description: '点击tab container',
    },
    browserGoBack: {
      action: 'tap',
      target: 'browsergoback',
      description: '点击browser go back',
    },
    browserGoForward: {
      action: 'tap',
      target: 'browsergoforward',
      description: '点击browser go forward',
    },
    browserBookmark: {
      action: 'tap',
      target: 'browserbookmark',
      description: '点击browser bookmark',
    },
    browserPin: {
      action: 'tap',
      target: 'browserpin',
      description: '点击browser pin',
    },
    browserReload: {
      action: 'tap',
      target: 'browserreload',
      description: '点击browser reload',
    },
    browserRemoveBookmark: {
      action: 'tap',
      target: 'browserremovebookmark',
      description: '点击browser remove bookmark',
    },
    browserRemovePin: {
      action: 'tap',
      target: 'browserremovepin',
      description: '点击browser remove pin',
    },
    pinTabDivider: {
      action: 'tap',
      target: 'pintabdivider',
      description: '点击pin tab divider',
    },
  },
};
