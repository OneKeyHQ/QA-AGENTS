/**
 * Prime页 - 可交互元素规则
 * 对应页面对象: primePage (primePage.js)
 * 用于生成测试用例
 */
export default {
  page: 'primePage',
  pageFile: 'general/primePage.js',
  elements: {
    closeBtn: {
      action: 'navigate',
      target: 'previous',
      description: '关闭Prime页并返回上一页',
    },
    subscribeBtn: {
      action: 'tap',
      target: 'subscribe',
      description: '订阅OneKey Prime服务',
    },
    oneKeyCloudCard: {
      action: 'tap',
      target: 'oneKeyCloud',
      description: '查看OneKey Cloud功能详情',
    },
    bulkCopyAddressesCard: {
      action: 'tap',
      target: 'bulkCopyAddresses',
      description: '查看批量复制地址功能详情',
    },
    bulkRevokeCard: {
      action: 'tap',
      target: 'bulkRevoke',
      description: '查看批量撤销功能详情',
    },
    increaseNotificationLimitCard: {
      action: 'tap',
      target: 'increaseNotificationLimit',
      description: '查看增加通知限制功能详情',
    },
    exportTransactionsCard: {
      action: 'tap',
      target: 'exportTransactions',
      description: '查看导出交易功能详情',
    },
  },
};
