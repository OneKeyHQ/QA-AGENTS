/**
 * 菜单页 - 可交互元素规则
 * 对应页面对象: menuPage (menuPage.js)
 * 用于生成测试用例
 */
export default {
  page: 'menuPage',
  pageFile: 'general/menuPage.js',
  elements: {
    backBtn: {
      action: 'navigate',
      target: 'previous',
      description: '返回上一级页面',
    },
    signUpLoginBtn: {
      action: 'navigate',
      target: 'signUpLogin',
      description: '打开注册/登录页面',
    },
    addBtn: {
      action: 'tap',
      target: 'addHardwareWallet',
      description: '添加硬件钱包',
    },
    settingsBtn: {
      action: 'navigate',
      target: 'settings',
      description: '打开设置页面',
    },
    scanQrCodeBtn: {
      action: 'navigate',
      target: 'scan',
      description: '打开扫描二维码页面',
    },
    primeBtn: {
      action: 'navigate',
      target: 'prime',
      description: '打开Prime页面',
    },
    lockNowBtn: {
      action: 'tap',
      target: 'lock',
      description: '立即锁定应用',
    },
    backupBtn: {
      action: 'navigate',
      target: 'backup',
      description: '打开备份页面',
    },
    addressBookBtn: {
      action: 'navigate',
      target: 'addressBookAlarmPopup',
      description: '打开地址簿弹层',
    },
    networkBtn: {
      action: 'navigate',
      target: 'networkSettings',
      description: '打开网络设置页面',
    },
    preferencesBtn: {
      action: 'navigate',
      target: 'preferencesSettings',
      description: '打开偏好设置页面',
    },
    securityBtn: {
      action: 'navigate',
      target: 'securitySettings',
      description: '打开安全设置页面',
    },
    bulkCopyAddressesBtn: {
      action: 'navigate',
      target: 'bulkCopyAddresses',
      description: '打开批量复制地址页面',
    },
    contactUsBtn: {
      action: 'tap',
      target: 'contactUs',
      description: '打开联系我们页面',
    },
    referralBtn: {
      action: 'navigate',
      target: 'referral',
      description: '打开推荐页面',
    },
    redeemBtn: {
      action: 'navigate',
      target: 'redeem',
      description: '打开兑换页面',
    },
  },
};
