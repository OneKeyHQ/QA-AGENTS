/**
 * 网络设置页 - 可交互元素规则
 * 对应页面对象: networkSettingsPage (networkSettingsPage.js)
 * 用于生成测试用例
 */
export default {
  page: 'networkSettingsPage',
  pageFile: 'general/networkSettingsPage.js',
  elements: {
    closeBtn: {
      action: 'navigate',
      target: 'previous',
      description: '关闭网络设置页并返回上一页',
    },
    addCustomNetworkBtn: {
      action: 'navigate',
      target: 'addCustomNetwork',
      description: '打开添加自定义网络页面',
    },
    customRpcBtn: {
      action: 'navigate',
      target: 'customRpc',
      description: '打开自定义RPC设置页面',
    },
    exportCustomNetworkConfigBtn: {
      action: 'tap',
      target: 'exportConfig',
      description: '导出自定义网络配置',
    },
  },
};
