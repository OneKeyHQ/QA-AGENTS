/**
 * NetworkSelect页面 - 可交互元素规则
 * 对应页面对象: networkSelectPage (networkSelectPage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'networkSelectPage',
  pageFile: 'networkSelectPage.js',
  elements: {
    // ========== 导航类元素 ==========
    closeButton: {
      action: 'navigate',
      target: 'closeButton',
      description: '跳转到closeButton',
    },
    // ========== 输入类元素 ==========
    searchInput: {
      action: 'input',
      target: 'search',
      description: '输入search',
    },
    // ========== 操作类元素 ==========
    pageTitle: {
      action: 'tap',
      target: 'pagetitle',
      description: '点击page title',
    },
    bitcoinNetwork: {
      action: 'tap',
      target: 'bitcoinnetwork',
      description: '点击bitcoin network',
    },
    ethereumNetwork: {
      action: 'tap',
      target: 'ethereumnetwork',
      description: '点击ethereum network',
    },
    tronNetwork: {
      action: 'tap',
      target: 'tronnetwork',
      description: '点击tron network',
    },
    solanaNetwork: {
      action: 'tap',
      target: 'solananetwork',
      description: '点击solana network',
    },
    bnbChainNetwork: {
      action: 'tap',
      target: 'bnbchainnetwork',
      description: '点击bnb chain network',
    },
    polygonNetwork: {
      action: 'tap',
      target: 'polygonnetwork',
      description: '点击polygon network',
    },
    tonNetwork: {
      action: 'tap',
      target: 'tonnetwork',
      description: '点击ton network',
    },
    arbitrumNetwork: {
      action: 'tap',
      target: 'arbitrumnetwork',
      description: '点击arbitrum network',
    },
    avalancheNetwork: {
      action: 'tap',
      target: 'avalanchenetwork',
      description: '点击avalanche network',
    },
    auroraNetwork: {
      action: 'tap',
      target: 'auroranetwork',
      description: '点击aurora network',
    },
    alephZeroEVMNetwork: {
      action: 'tap',
      target: 'alephzeroevmnetwork',
      description: '点击aleph zero e v m network',
    },
    akashNetwork: {
      action: 'tap',
      target: 'akashnetwork',
      description: '点击akash network',
    },
    astarNetwork: {
      action: 'tap',
      target: 'astarnetwork',
      description: '点击astar network',
    },
    aptosNetwork: {
      action: 'tap',
      target: 'aptosnetwork',
      description: '点击aptos network',
    },
    algorandNetwork: {
      action: 'tap',
      target: 'algorandnetwork',
      description: '点击algorand network',
    },
  },
};
