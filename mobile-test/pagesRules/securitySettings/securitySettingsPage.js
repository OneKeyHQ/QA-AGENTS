/**
 * 安全设置页 - 可交互元素规则
 * 对应页面对象: securitySettingsPage (securitySettingsPage.js)
 * 用于生成测试用例
 */
export default {
  page: 'securitySettingsPage',
  pageFile: 'general/securitySettingsPage.js',
  elements: {
    closeBtn: {
      action: 'navigate',
      target: 'previous',
      description: '关闭安全设置页并返回上一页',
    },
    setPasscodeOption: {
      action: 'navigate',
      target: 'setPasscode',
      description: '打开设置密码页面',
    },
    protectionOption: {
      action: 'navigate',
      target: 'protection',
      description: '打开保护设置页面',
    },
    connectedSitesOption: {
      action: 'navigate',
      target: 'connectedSites',
      description: '打开已连接站点列表页面',
    },
    signatureRecordOption: {
      action: 'navigate',
      target: 'signatureRecord',
      description: '打开签名记录页面',
    },
    clearCacheOption: {
      action: 'tap',
      target: 'clearCache',
      description: '清除应用缓存',
    },
    clearPendingTransactionsOption: {
      action: 'tap',
      target: 'clearPendingTransactions',
      description: '清除待处理交易',
    },
    resetAppOption: {
      action: 'tap',
      target: 'resetApp',
      description: '重置应用（危险操作）',
    },
  },
};
