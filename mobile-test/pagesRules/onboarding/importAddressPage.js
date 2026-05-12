/**
 * 导入观察地址页面 - 可交互元素规则
 * 对应页面对象: importAddressPage (importAddressPage.js)
 * 基于 xmls/onboarding/importWatchAddress.xml、importPublicKey.xml（clickPublicKeyTab 后 DOM）
 * 用于生成测试用例
 */
export default {
  page: 'importAddressPage',
  pageFile: 'importAddressPage.js',
  elements: {
    // ========== 导航类元素 ==========
    closeButton: {
      action: 'navigate',
      target: 'previous',
      description: '关闭并返回上一级页面',
    },
    chooseChainBtn: {
      action: 'navigate',
      target: 'networkSelectorModal',
      description: '打开网络选择器',
    },
    // ========== 模式切换（地址/公钥） ==========
    addressTab: {
      action: 'tap',
      target: 'switchToAddress',
      description: '切换到地址输入模式',
    },
    publicKeyTab: {
      action: 'tap',
      target: 'switchToPublicKey',
      description: '切换到公钥输入模式',
    },
    // ========== 输入类元素 ==========
    addressInput: {
      action: 'input',
      target: 'address',
      description: '输入地址或域名（地址/公钥模式共用）',
    },
    nameInput: {
      action: 'input',
      target: 'name',
      description: '输入账户名称（可选）',
    },
    // ========== 操作类元素 ==========
    pasteButton: {
      action: 'tap',
      target: 'paste',
      description: '从剪贴板粘贴地址或公钥',
    },
    scanButton: {
      action: 'tap',
      target: 'scan',
      description: '扫描二维码获取地址或公钥',
    },
    confirmButton: {
      action: 'tap',
      target: 'confirm',
      description: '确认并完成导入',
    },
  },
};
