/**
 * Setting页面 - 可交互元素规则
 * 对应页面对象: settingPage (settingPage.js)
 * 用于生成测试用例
 * 
 * ⚠️ 以下元素需要人工确认：walletBtn, networkBtn
 */
export default {
  page: 'settingPage',
  pageFile: 'settingPage.js',
  elements: {
    // ========== 导航类元素 ==========
    closeBtn: {
      action: 'navigate',
      target: 'closeButton',
      description: '跳转到closeButton',
    },
    backupBtn: {
      action: 'navigate',
      target: 'backup',
      description: '跳转到backup',
    },
    preferencesBtn: {
      action: 'navigate',
      target: 'preferencesSettingsPage',
      description: '打开preferencesSettings',
    },
    walletBtn: {
      action: 'navigate',
      target: 'walletSelectorPage',
      description: '打开walletSelector',
      // TODO: 需要人工确认目标页面
    },
    securityBtn: {
      action: 'navigate',
      target: 'securitySettingsPage',
      description: '打开securitySettings',
    },
    networkBtn: {
      action: 'navigate',
      target: 'importPrvKeySelectNetworkPage',
      description: '打开importPrvKeySelectNetwork',
      // TODO: 需要人工确认目标页面
    },
    aboutBtn: {
      action: 'navigate',
      target: 'about',
      description: '跳转到about',
    },
    addressBookBtn: {
      action: 'navigate',
      target: 'addressBookSelectNetworksPage',
      description: '打开addressBookSelectNetworks',
    },
    versionBtn: {
      action: 'navigate',
      target: 'version',
      description: '跳转到version',
    },
    devOverlayBtn: {
      action: 'navigate',
      target: 'devPage',
      description: '打开dev',
    },
    clearDataMenuBtn: {
      action: 'navigate',
      target: 'clearDataMenuPage',
      description: '打开clearDataMenu',
    },
    // ========== 输入类元素 ==========
    searchInput: {
      action: 'input',
      target: 'search',
      description: '输入search',
    },
    // ========== 操作类元素 ==========
    settingsTitle: {
      action: 'tap',
      target: 'settingstitle',
      description: '点击settings title',
    },
  },
};
