/**
 * 设置页 - 可交互元素规则
 * 对应页面对象: settingPage (settingPage.js)
 * 用于生成测试用例
 */
export default {
  page: 'settingPage',
  pageFile: 'general/settingPage.js',
  elements: {
    closeBtn: {
      action: 'navigate',
      target: 'previous',
      description: '关闭设置页并返回上一页',
    },
    searchInput: {
      action: 'input',
      target: 'search',
      description: '在搜索框中输入文本搜索设置项',
    },
    backupBtn: {
      action: 'navigate',
      target: 'backup',
      description: '打开备份设置页面',
    },
    preferencesBtn: {
      action: 'navigate',
      target: 'preferencesSettings',
      description: '打开偏好设置页面',
    },
    walletBtn: {
      action: 'navigate',
      target: 'walletSettings',
      description: '打开钱包设置页面',
    },
    securityBtn: {
      action: 'navigate',
      target: 'securitySettings',
      description: '打开安全设置页面',
    },
    networkBtn: {
      action: 'navigate',
      target: 'networkSettings',
      description: '打开网络设置页面',
    },
    aboutBtn: {
      action: 'navigate',
      target: 'about',
      description: '打开关于页面',
    },
    addressBookBtn: {
      action: 'navigate',
      target: 'addressBook',
      description: '打开地址簿页面',
    },
    versionBtn: {
      action: 'tap',
      target: 'version',
      description: '点击版本信息（连续点击可打开开发者工具）',
    },
  },
};
