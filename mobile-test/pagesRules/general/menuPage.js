/**
 * Menu页面 - 可交互元素规则
 * 对应页面对象: menuPage (menuPage.js)
 * 用于生成测试用例
 * 
 * ⚠️ 以下元素需要人工确认：signUpLoginBtn, addBtn, settingsBtn, networkBtn, bulkCopyAddressesBtn, contactUsBtn
 */
export default {
  page: 'menuPage',
  pageFile: 'menuPage.js',
  elements: {
    // ========== 导航类元素 ==========
    backBtn: {
      action: 'navigate',
      target: 'previous',
      description: '返回上一级页面',
    },
    signUpLoginBtn: {
      action: 'navigate',
      target: 'clearDataMenuPage',
      description: '打开clearDataMenu',
      // TODO: 需要人工确认目标页面
    },
    addBtn: {
      action: 'navigate',
      target: 'addressBookSelectNetworksPage',
      description: '打开addressBookSelectNetworks',
      // TODO: 需要人工确认目标页面
    },
    settingsBtn: {
      action: 'navigate',
      target: 'securitySettingsPage',
      description: '打开securitySettings',
      // TODO: 需要人工确认目标页面
    },
    scanQrCodeBtn: {
      action: 'navigate',
      target: 'scanPage',
      description: '打开scan',
    },
    primeBtn: {
      action: 'navigate',
      target: 'primePage',
      description: '打开prime',
    },
    lockNowBtn: {
      action: 'navigate',
      target: 'locknow',
      description: '跳转到locknow',
    },
    backupBtn: {
      action: 'navigate',
      target: 'backup',
      description: '跳转到backup',
    },
    addressBookBtn: {
      action: 'navigate',
      target: 'addressBookSelectNetworksPage',
      description: '打开addressBookSelectNetworks',
    },
    networkBtn: {
      action: 'navigate',
      target: 'importPrvKeySelectNetworkPage',
      description: '打开importPrvKeySelectNetwork',
      // TODO: 需要人工确认目标页面
    },
    preferencesBtn: {
      action: 'navigate',
      target: 'preferencesSettingsPage',
      description: '打开preferencesSettings',
    },
    securityBtn: {
      action: 'navigate',
      target: 'securitySettingsPage',
      description: '打开securitySettings',
    },
    bulkCopyAddressesBtn: {
      action: 'navigate',
      target: 'addressBookSelectNetworksPage',
      description: '打开addressBookSelectNetworks',
      // TODO: 需要人工确认目标页面
    },
    contactUsBtn: {
      action: 'navigate',
      target: 'useGooglePage',
      description: '打开useGoogle',
      // TODO: 需要人工确认目标页面
    },
    referralBtn: {
      action: 'navigate',
      target: 'referralPage',
      description: '打开referral',
    },
    redeemBtn: {
      action: 'navigate',
      target: 'redeemPage',
      description: '打开redeem',
    },
    // ========== 操作类元素 ==========
    generalTitle: {
      action: 'tap',
      target: 'generaltitle',
      description: '点击general title',
    },
    walletTitle: {
      action: 'tap',
      target: 'wallettitle',
      description: '点击wallet title',
    },
    moreTitle: {
      action: 'tap',
      target: 'moretitle',
      description: '点击more title',
    },
  },
};
