/**
 * BottomNavBar页面 - 可交互元素规则
 * 对应页面对象: bottomNavBarPage (bottomNavBarPage.js)
 * 用于生成测试用例
 * 
 * ⚠️ 以下元素需要人工确认：swapBtn
 */
export default {
  page: 'bottomNavBarPage',
  pageFile: 'bottomNavBarPage.js',
  elements: {
    // ========== 导航类元素 ==========
    homeBtn: {
      action: 'navigate',
      target: 'homePage',
      description: '打开home',
    },
    swapBtn: {
      action: 'navigate',
      target: 'swapProPage',
      description: '打开swapPro',
      // TODO: 需要人工确认目标页面
    },
    perpBtn: {
      action: 'navigate',
      target: 'perp',
      description: '跳转到perp',
    },
    discoveryBtn: {
      action: 'navigate',
      target: 'discovery',
      description: '跳转到discovery',
    },
    // ========== 操作类元素 ==========
    bottomNavBar: {
      action: 'tap',
      target: 'bottomnavbar',
      description: '点击bottom nav bar',
    },
  },
};
