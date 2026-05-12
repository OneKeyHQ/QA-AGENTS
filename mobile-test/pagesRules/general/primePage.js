/**
 * Prime页面 - 可交互元素规则
 * 对应页面对象: primePage (primePage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'primePage',
  pageFile: 'primePage.js',
  elements: {
    // ========== 导航类元素 ==========
    closeBtn: {
      action: 'navigate',
      target: 'closeButton',
      description: '跳转到closeButton',
    },
    subscribeBtn: {
      action: 'navigate',
      target: 'subscribe',
      description: '跳转到subscribe',
    },
    // ========== 操作类元素 ==========
    oneKeyPrimeTitle: {
      action: 'tap',
      target: 'onekeyprimetitle',
      description: '点击one key prime title',
    },
    primeDescription: {
      action: 'tap',
      target: 'primedescription',
      description: '点击prime description',
    },
    oneKeyCloudCard: {
      action: 'tap',
      target: 'onekeycloudcard',
      description: '点击one key cloud card',
    },
    bulkCopyAddressesCard: {
      action: 'tap',
      target: 'bulkcopyaddressescard',
      description: '点击bulk copy addresses card',
    },
    bulkRevokeCard: {
      action: 'tap',
      target: 'bulkrevokecard',
      description: '点击bulk revoke card',
    },
    increaseNotificationLimitCard: {
      action: 'tap',
      target: 'increasenotificationlimitcard',
      description: '点击increase notification limit card',
    },
    exportTransactionsCard: {
      action: 'tap',
      target: 'exporttransactionscard',
      description: '点击export transactions card',
    },
  },
};
