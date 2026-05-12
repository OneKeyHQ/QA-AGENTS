/**
 * Referral页面 - 可交互元素规则
 * 对应页面对象: referralPage (referralPage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'referralPage',
  pageFile: 'referralPage.js',
  elements: {
    // ========== 导航类元素 ==========
    closeBtn: {
      action: 'navigate',
      target: 'closeButton',
      description: '跳转到closeButton',
    },
    nextBtn: {
      action: 'navigate',
      target: 'next',
      description: '跳转到next',
    },
    // ========== 操作类元素 ==========
    referralTitle: {
      action: 'tap',
      target: 'referraltitle',
      description: '点击referral title',
    },
    inviteFriendsTitle: {
      action: 'tap',
      target: 'invitefriendstitle',
      description: '点击invite friends title',
    },
  },
};
