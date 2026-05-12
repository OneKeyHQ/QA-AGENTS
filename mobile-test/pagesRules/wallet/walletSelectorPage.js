/**
 * WalletSelector页面 - 可交互元素规则
 * 对应页面对象: walletSelectorPage (walletSelectorPage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'walletSelectorPage',
  pageFile: 'walletSelectorPage.js',
  elements: {
    // ========== 导航类元素 ==========
    addWalletButton: {
      action: 'navigate',
      target: 'addWalletPage',
      description: '打开addWallet',
    },
    walletImportedButton: {
      action: 'navigate',
      target: 'creatingWalletPage',
      description: '打开creatingWallet',
    },
    accountSearchBarAddButton: {
      action: 'navigate',
      target: 'bottomNavBarPage',
      description: '打开bottomNavBar',
    },
    // ========== 输入类元素 ==========
    searchAccountInput: {
      action: 'input',
      target: 'searchaccount',
      description: '输入searchaccount',
    },
    // ========== 操作类元素 ==========
    walletList: {
      action: 'tap',
      target: 'walletlist',
      description: '点击wallet list',
    },
    importedWalletItem: {
      action: 'tap',
      target: 'importedwalletitem',
      description: '点击imported wallet item',
    },
    accountList: {
      action: 'tap',
      target: 'accountlist',
      description: '点击account list',
    },
    accountHeader: {
      action: 'tap',
      target: 'accountheader',
      description: '点击account header',
    },
    addAccountEntry: {
      action: 'tap',
      target: 'addaccountentry',
      description: '点击add account entry',
    },
  },
};
