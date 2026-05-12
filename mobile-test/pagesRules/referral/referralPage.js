/**
 * 推荐页 - 可交互元素规则
 * 对应页面对象: referralPage (referralPage.js)
 * 用于生成测试用例
 */
export default {
  page: 'referralPage',
  pageFile: 'general/referralPage.js',
  elements: {
    closeBtn: {
      action: 'navigate',
      target: 'previous',
      description: '关闭推荐页并返回上一页',
    },
    nextBtn: {
      action: 'navigate',
      target: 'next',
      description: '进入推荐流程的下一步',
    },
  },
};
