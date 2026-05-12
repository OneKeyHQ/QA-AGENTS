/**
 * SecuritySettings页面 - 可交互元素规则
 * 对应页面对象: securitySettingsPage (securitySettingsPage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'securitySettingsPage',
  pageFile: 'securitySettingsPage.js',
  elements: {
    // ========== 导航类元素 ==========
    closeBtn: {
      action: 'navigate',
      target: 'closeButton',
      description: '跳转到closeButton',
    },
    // ========== 操作类元素 ==========
    securityTitle: {
      action: 'tap',
      target: 'securitytitle',
      description: '点击security title',
    },
    setPasscodeOption: {
      action: 'tap',
      target: 'setpasscodeoption',
      description: '点击set passcode option',
    },
    protectionOption: {
      action: 'tap',
      target: 'protectionoption',
      description: '点击protection option',
    },
    connectedSitesOption: {
      action: 'tap',
      target: 'connectedsitesoption',
      description: '点击connected sites option',
    },
    signatureRecordOption: {
      action: 'tap',
      target: 'signaturerecordoption',
      description: '点击signature record option',
    },
    clearCacheOption: {
      action: 'tap',
      target: 'clearcacheoption',
      description: '点击clear cache option',
    },
    clearPendingTransactionsOption: {
      action: 'tap',
      target: 'clearpendingtransactionsoption',
      description: '点击clear pending transactions option',
    },
    resetAppOption: {
      action: 'tap',
      target: 'resetappoption',
      description: '点击reset app option',
    },
  },
};
