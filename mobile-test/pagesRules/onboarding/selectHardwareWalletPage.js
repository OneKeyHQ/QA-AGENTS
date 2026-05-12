/**
 * 选择硬件钱包页面 - 可交互元素规则
 * 对应页面对象: selectHardwareWalletPage (selectHardwareWalletPage.js)
 * 用于生成测试用例
 */
export default {
  page: 'selectHardwareWalletPage',
  pageFile: 'selectHardwareWalletPage.js',
  elements: {
    // ========== 导航元素 ==========
    backButton: {
      action: 'navigate',
      target: 'previous',
      description: '返回上一级页面',
    },
    closeButton: {
      action: 'click',
      target: 'closeButton',
      description: '关闭按钮 - 右上角关闭图标',
    },
    // ========== 页面标题 ==========
    pageTitle: {
      action: 'verify',
      target: 'pageTitle',
      description: '页面标题 - "选择您的设备"',
    },
    // ========== 硬件钱包选项 ==========
    oneKeyProCard: {
      action: 'click',
      target: 'oneKeyProCard',
      description: '选择 OneKey Pro 硬件钱包',
    },
    oneKeyClassicCard: {
      action: 'click',
      target: 'oneKeyClassicCard',
      description: '选择 OneKey Classic 硬件钱包',
    },
    oneKeyTouchCard: {
      action: 'click',
      target: 'oneKeyTouchCard',
      description: '选择 OneKey Touch 硬件钱包',
    },
    // ========== 底部链接 ==========
    purchaseLink: {
      action: 'click',
      target: 'purchaseLink',
      description: '购买链接 - "购买 ↗"',
    },
  },
};
