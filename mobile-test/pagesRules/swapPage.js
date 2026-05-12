/**
 * Swap页面 - 可交互元素规则
 * 对应页面对象: swapPage (swapPage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'swapPage',
  pageFile: 'swapPage.js',
  elements: {
    // ========== 导航类元素 ==========
    fromTokenBtn: {
      action: 'navigate',
      target: 'singleNetworkTokenSelectPage',
      description: '打开singleNetworkTokenSelect',
    },
    maxBtn: {
      action: 'navigate',
      target: 'max',
      description: '跳转到max',
    },
    toTokenBtn: {
      action: 'navigate',
      target: 'singleNetworkTokenSelectPage',
      description: '打开singleNetworkTokenSelect',
    },
    swapDirectionBtn: {
      action: 'navigate',
      target: 'swapProPage',
      description: '打开swapPro',
    },
    // ========== 输入类元素 ==========
    fromAmountInput: {
      action: 'input',
      target: 'fromamount',
      description: '输入fromamount',
    },
    toAmountInput: {
      action: 'input',
      target: 'toamount',
      description: '输入toamount',
    },
    // ========== 操作类元素 ==========
    swapContentContainer: {
      action: 'tap',
      target: 'swapcontentcontainer',
      description: '点击swap content container',
    },
    swapTab: {
      action: 'tap',
      target: 'swaptab',
      description: '点击swap tab',
    },
    bridgeTab: {
      action: 'tap',
      target: 'bridgetab',
      description: '点击bridge tab',
    },
    proTab: {
      action: 'tap',
      target: 'protab',
      description: '点击pro tab',
    },
    navigationHeaderButtonGroup: {
      action: 'tap',
      target: 'navigationheaderbuttongroup',
      description: '点击navigation header button group',
    },
    fromLabel: {
      action: 'tap',
      target: 'fromlabel',
      description: '点击from label',
    },
    toLabel: {
      action: 'tap',
      target: 'tolabel',
      description: '点击to label',
    },
  },
};
