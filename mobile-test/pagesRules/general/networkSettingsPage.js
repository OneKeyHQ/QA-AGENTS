/**
 * NetworkSettings页面 - 可交互元素规则
 * 对应页面对象: networkSettingsPage (networkSettingsPage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'networkSettingsPage',
  pageFile: 'networkSettingsPage.js',
  elements: {
    // ========== 导航类元素 ==========
    closeBtn: {
      action: 'navigate',
      target: 'closeButton',
      description: '跳转到closeButton',
    },
    addCustomNetworkBtn: {
      action: 'navigate',
      target: 'addressBookSelectNetworksPage',
      description: '打开addressBookSelectNetworks',
    },
    customRpcBtn: {
      action: 'navigate',
      target: 'customrpc',
      description: '跳转到customrpc',
    },
    exportCustomNetworkConfigBtn: {
      action: 'navigate',
      target: 'importPrvKeySelectNetworkPage',
      description: '打开importPrvKeySelectNetwork',
    },
    // ========== 操作类元素 ==========
    networkTitle: {
      action: 'tap',
      target: 'networktitle',
      description: '点击network title',
    },
  },
};
