/**
 * Onboarding页面 - 可交互元素规则
 * 对应页面对象: onboardingPage (onboardingPage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'onboardingPage',
  pageFile: 'onboardingPage.js',
  elements: {
    // ========== 导航类元素 ==========
    backButton: {
      action: 'navigate',
      target: 'homePage',
      description: '返回首页',
    },
    topRightButton: {
      action: 'navigate',
      target: 'languageSelectPopup',
      description: '打开语言选择弹层',
    },
    connectHardwareWalletBtn: {
      action: 'navigate',
      target: 'selectHardwareWalletPage',
      description: '打开选择硬件钱包页面',
    },
    continueWithGoogleBtn: {
      action: 'navigate',
      target: 'useGooglePage',
      description: '打开Google登录页面',
    },
    continueWithAppleBtn: {
      action: 'navigate',
      target: 'useApplePage',
      description: '打开Apple登录页面',
    },
    moreOptionsBtn: {
      action: 'navigate',
      target: 'addWalletPage',
      description: '打开添加钱包页面',
    },
    // ========== 协议文本 ==========
    agreementText: {
      action: 'navigate',
      target: 'external',
      description: '跳转外部浏览器查看协议',
    },
  },
};
