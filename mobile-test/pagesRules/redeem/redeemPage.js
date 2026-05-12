/**
 * 兑换页 - 可交互元素规则
 * 对应页面对象: redeemPage (redeemPage.js)
 * 用于生成测试用例
 */
export default {
  page: 'redeemPage',
  pageFile: 'general/redeemPage.js',
  elements: {
    backBtn: {
      action: 'navigate',
      target: 'previous',
      description: '返回上一级页面',
    },
  },
};
