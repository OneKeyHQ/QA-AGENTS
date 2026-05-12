/**
 * ImportPrvKeySelectNetwork页面 - 可交互元素规则
 * 对应页面对象: importPrvKeySelectNetworkPage (importPrvKeySelectNetworkPage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'importPrvKeySelectNetworkPage',
  pageFile: 'importPrvKeySelectNetworkPage.js',
  elements: {
    // ========== 导航类元素 ==========
    backButton: {
      action: 'navigate',
      target: 'previous',
      description: '返回上一级页面',
    },
    closeButton: {
      action: 'navigate',
      target: 'closeButton',
      description: '跳转到closeButton',
    },
    showMoreNetworksButton: {
      action: 'navigate',
      target: 'morePage',
      description: '打开more',
    },
    confirmButton: {
      action: 'navigate',
      target: 'confirm',
      description: '跳转到confirm',
    },
    // ========== 操作类元素 ==========
    pageTitle: {
      action: 'tap',
      target: 'pagetitle',
      description: '点击page title',
    },
    evmNetworkSection: {
      action: 'tap',
      target: 'evmnetworksection',
      description: '点击evm network section',
    },
    cosmosNetworkSection: {
      action: 'tap',
      target: 'cosmosnetworksection',
      description: '点击cosmos network section',
    },
    polkadotNetworkSection: {
      action: 'tap',
      target: 'polkadotnetworksection',
      description: '点击polkadot network section',
    },
    cannotFindNetworkHint: {
      action: 'tap',
      target: 'cannotfindnetworkhint',
      description: '点击cannot find network hint',
    },
  },
};
