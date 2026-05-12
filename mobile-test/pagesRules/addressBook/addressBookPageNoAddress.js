/**
 * AddressBookNoAddress页面 - 可交互元素规则
 * 对应页面对象: addressBookPageNoAddress (noAddressPage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'addressBookPageNoAddress',
  pageFile: 'noAddressPage.js',
  elements: {
    // ========== 导航类元素 ==========
    closeBtn: {
      action: 'navigate',
      target: 'closeButton',
      description: '跳转到closeButton',
    },
    headerAddIconBtn: {
      action: 'navigate',
      target: 'addWalletPage',
      description: '打开addWallet',
    },
    bankAddBtn: {
      action: 'navigate',
      target: 'addWalletPage',
      description: '打开addWallet',
    },
    footerAddBtn: {
      action: 'navigate',
      target: 'addWalletPage',
      description: '打开addWallet',
    },
    transferWhitelistBtn: {
      action: 'navigate',
      target: 'transferwhitelist',
      description: '跳转到transferwhitelist',
    },
    // ========== 输入类元素 ==========
    searchInput: {
      action: 'input',
      target: 'search',
      description: '输入search',
    },
    // ========== 操作类元素 ==========
    searchInputClear: {
      action: 'tap',
      target: 'searchinputclear',
      description: '点击search input clear',
    },
    addressBookItemPrefix: {
      action: 'tap',
      target: 'addressbookitemprefix',
      description: '点击address book item prefix',
    },
    pageTitle: {
      action: 'tap',
      target: 'pagetitle',
      description: '点击page title',
    },
    searchInputPlaceholder: {
      action: 'tap',
      target: 'searchinputplaceholder',
      description: '点击search input placeholder',
    },
    emptyStateTitle: {
      action: 'tap',
      target: 'emptystatetitle',
      description: '点击empty state title',
    },
    emptyStateDescription: {
      action: 'tap',
      target: 'emptystatedescription',
      description: '点击empty state description',
    },
  },
};
