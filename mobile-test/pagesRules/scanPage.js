/**
 * Scan页面 - 可交互元素规则
 * 对应页面对象: scanPage (scanPage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'scanPage',
  pageFile: 'scanPage.js',
  elements: {
    // ========== 导航类元素 ==========
    closeBtn: {
      action: 'navigate',
      target: 'closeButton',
      description: '跳转到closeButton',
    },
    photoBtn: {
      action: 'navigate',
      target: 'photo',
      description: '跳转到photo',
    },
    // ========== 操作类元素 ==========
    scanQrCodeTitle: {
      action: 'tap',
      target: 'scanqrcodetitle',
      description: '点击scan qr code title',
    },
    scanView: {
      action: 'tap',
      target: 'scanview',
      description: '点击scan view',
    },
    scanAddressCodesHint: {
      action: 'tap',
      target: 'scanaddresscodeshint',
      description: '点击scan address codes hint',
    },
    scanWalletConnectHint: {
      action: 'tap',
      target: 'scanwalletconnecthint',
      description: '点击scan wallet connect hint',
    },
    firstImage: {
      action: 'tap',
      target: 'firstimage',
      description: '点击first image',
    },
  },
};
