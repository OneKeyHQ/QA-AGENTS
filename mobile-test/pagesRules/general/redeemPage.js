/**
 * Redeem页面 - 可交互元素规则
 * 对应页面对象: redeemPage (redeemPage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'redeemPage',
  pageFile: 'redeemPage.js',
  elements: {
    // ========== 导航类元素 ==========
    backBtn: {
      action: 'navigate',
      target: 'previous',
      description: '返回上一级页面',
    },
    // ========== 操作类元素 ==========
    redeemTitle: {
      action: 'tap',
      target: 'redeemtitle',
      description: '点击redeem title',
    },
  },
};
