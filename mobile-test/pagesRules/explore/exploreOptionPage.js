/**
 * ExploreOption页面 - 可交互元素规则
 * 对应页面对象: exploreOptionPage (optionsPage.js)
 * 用于生成测试用例
 * 
 * ⚠️ 以下元素需要人工确认：bookmarkBtn, removeBookmarkBtn
 */
export default {
  page: 'exploreOptionPage',
  pageFile: 'optionsPage.js',
  elements: {
    // ========== 导航类元素 ==========
    reloadBtn: {
      action: 'navigate',
      target: 'reload',
      description: '跳转到reload',
    },
    bookmarkBtn: {
      action: 'navigate',
      target: 'addressBookSelectNetworksPage',
      description: '打开addressBookSelectNetworks',
      // TODO: 需要人工确认目标页面
    },
    pinBtn: {
      action: 'navigate',
      target: 'pin',
      description: '跳转到pin',
    },
    shareBtn: {
      action: 'navigate',
      target: 'share',
      description: '跳转到share',
    },
    openBtn: {
      action: 'navigate',
      target: 'open',
      description: '跳转到open',
    },
    backToHomeBtn: {
      action: 'navigate',
      target: 'homePage',
      description: '打开home',
    },
    removeBookmarkBtn: {
      action: 'navigate',
      target: 'addressBookSelectNetworksPage',
      description: '打开addressBookSelectNetworks',
      // TODO: 需要人工确认目标页面
    },
    removePinBtn: {
      action: 'navigate',
      target: 'removepin',
      description: '跳转到removepin',
    },
    closeTabBtn: {
      action: 'navigate',
      target: 'exploreTabManagePage',
      description: '打开exploreTabManage',
    },
    closePinTabBtn: {
      action: 'navigate',
      target: 'exploreTabManagePage',
      description: '打开exploreTabManage',
    },
  },
};
