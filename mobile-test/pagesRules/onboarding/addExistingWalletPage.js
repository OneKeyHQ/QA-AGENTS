/**
 * AddExistingWallet页面 - 可交互元素规则
 * 对应页面对象: addExistingWalletPage (addExistingWalletPage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'addExistingWalletPage',
  pageFile: 'addExistingWalletPage.js',
  elements: {
    // ========== 导航类元素 ==========
    backButton: {
      action: 'navigate',
      target: 'homePage',
      description: '打开home',
    },
    topRightButton: {
      action: 'navigate',
      target: 'topright',
      description: '跳转到topright',
    },
    // ========== 操作类元素 ==========
    pageTitle: {
      action: 'tap',
      target: 'pagetitle',
      description: '点击page title',
    },
    transferCard: {
      action: 'tap',
      target: 'transfercard',
      description: '点击transfer card',
    },
    transferTitle: {
      action: 'tap',
      target: 'transfertitle',
      description: '点击transfer title',
    },
    transferSubtitle: {
      action: 'tap',
      target: 'transfersubtitle',
      description: '点击transfer subtitle',
    },
    importMnemonicOrPrivateKeyCard: {
      action: 'tap',
      target: 'importmnemonicorprivatekeycard',
      description: '点击import mnemonic or private key card',
    },
    importMnemonicOrPrivateKeyTitle: {
      action: 'tap',
      target: 'importmnemonicorprivatekeytitle',
      description: '点击import mnemonic or private key title',
    },
    oneKeyKeyTagCard: {
      action: 'tap',
      target: 'onekeykeytagcard',
      description: '点击one key key tag card',
    },
    oneKeyKeyTagTitle: {
      action: 'tap',
      target: 'onekeykeytagtitle',
      description: '点击one key key tag title',
    },
    oneKeyLiteCard: {
      action: 'tap',
      target: 'onekeylitecard',
      description: '点击one key lite card',
    },
    oneKeyLiteTitle: {
      action: 'tap',
      target: 'onekeylitetitle',
      description: '点击one key lite title',
    },
    googleDriveCard: {
      action: 'tap',
      target: 'googledrivecard',
      description: '点击google drive card',
    },
    googleDriveTitle: {
      action: 'tap',
      target: 'googledrivetitle',
      description: '点击google drive title',
    },
    watchAddressCard: {
      action: 'tap',
      target: 'watchaddresscard',
      description: '点击watch address card',
    },
    watchAddressTitle: {
      action: 'tap',
      target: 'watchaddresstitle',
      description: '点击watch address title',
    },
    watchAddressDescription: {
      action: 'tap',
      target: 'watchaddressdescription',
      description: '点击watch address description',
    },
  },
};
