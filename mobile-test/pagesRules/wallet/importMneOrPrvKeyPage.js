/**
 * ImportMneOrPrvKey页面 - 可交互元素规则
 * 对应页面对象: importMneOrPrvKeyPage (importMneOrPrvKeyPage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'importMneOrPrvKeyPage',
  pageFile: 'importMneOrPrvKeyPage.js',
  elements: {
    // ========== 导航类元素 ==========
    backButton: {
      action: 'navigate',
      target: 'previous',
      description: '返回上一级页面',
    },
    closeButton: {
      action: 'navigate',
      target: 'closeButton',
      description: '跳转到closeButton',
    },
    phraseLengthButton: {
      action: 'navigate',
      target: 'phraselength',
      description: '跳转到phraselength',
    },
    confirmButton: {
      action: 'navigate',
      target: 'confirm',
      description: '跳转到confirm',
    },
    // ========== 输入类元素 ==========
    privateKeyInput: {
      action: 'input',
      target: 'privatekey',
      description: '输入privatekey',
    },
    // ========== 操作类元素 ==========
    pageTitle: {
      action: 'tap',
      target: 'pagetitle',
      description: '点击page title',
    },
    tabMnemonic: {
      action: 'tap',
      target: 'tabmnemonic',
      description: '点击tab mnemonic',
    },
    tabPrivateKey: {
      action: 'tap',
      target: 'tabprivatekey',
      description: '点击tab private key',
    },
  },
};
