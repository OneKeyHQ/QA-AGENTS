/**
 * Home页面 - 可交互元素规则
 * 对应页面对象: homePage (homePage.js)
 * 用于生成测试用例
 * 
 * ⚠️ 以下元素需要人工确认：settingBtn
 */
export default {
  page: 'homePage',
  pageFile: 'homePage.js',
  elements: {
    // ========== 导航类元素 ==========
    settingBtn: {
      action: 'navigate',
      target: 'settingPage',
      description: '打开setting',
      // TODO: 需要人工确认目标页面
    },
    accountSelectorBtn: {
      action: 'navigate',
      target: 'walletSelectorPage',
      description: '打开walletSelector',
    },
    networkSelectorBtn: {
      action: 'navigate',
      target: 'networkSelectorModal',
      description: '跳转到networkSelectorModal',
    },
    notificationBtn: {
      action: 'navigate',
      target: 'notification',
      description: '跳转到notification',
    },
    moreActionsBtn: {
      action: 'navigate',
      target: 'morePage',
      description: '打开more',
    },
    viewMoreBtn: {
      action: 'navigate',
      target: 'morePage',
      description: '打开more',
    },
    showMoreBtn: {
      action: 'navigate',
      target: 'morePage',
      description: '打开more',
    },
    getPrimeBtn: {
      action: 'navigate',
      target: 'primePage',
      description: '打开prime',
    },
    addMoneyBtn: {
      action: 'navigate',
      target: 'addWalletPage',
      description: '打开addWallet',
    },
    add4TokensBtn: {
      action: 'navigate',
      target: 'singleNetworkTokenSelectPage',
      description: '打开singleNetworkTokenSelect',
    },
    joinBtn: {
      action: 'navigate',
      target: 'join',
      description: '跳转到join',
    },
    createWalletBtn: {
      action: 'navigate',
      target: 'walletSelectorPage',
      description: '打开walletSelector',
    },
    // ========== 输入类元素 ==========
    searchInput: {
      action: 'input',
      target: 'search',
      description: '输入search',
    },
    referralCodeInput: {
      action: 'input',
      target: 'referralcode',
      description: '输入referralcode',
    },
    // ========== 操作类元素 ==========
    walletPageHeaderRight: {
      action: 'tap',
      target: 'walletpageheaderright',
      description: '点击wallet page header right',
    },
    walletTabHeader: {
      action: 'tap',
      target: 'wallettabheader',
      description: '点击wallet tab header',
    },
    portfolioTab: {
      action: 'tap',
      target: 'portfoliotab',
      description: '点击portfolio tab',
    },
    nftTab: {
      action: 'tap',
      target: 'nfttab',
      description: '点击nft tab',
    },
    historyTab: {
      action: 'tap',
      target: 'historytab',
      description: '点击history tab',
    },
    approvalTab: {
      action: 'tap',
      target: 'approvaltab',
      description: '点击approval tab',
    },
    earnTitle: {
      action: 'tap',
      target: 'earntitle',
      description: '点击earn title',
    },
    upgradeTitle: {
      action: 'tap',
      target: 'upgradetitle',
      description: '点击upgrade title',
    },
    primeTitle: {
      action: 'tap',
      target: 'primetitle',
      description: '点击prime title',
    },
    supportHubTitle: {
      action: 'tap',
      target: 'supporthubtitle',
      description: '点击support hub title',
    },
    bottomNavBar: {
      action: 'tap',
      target: 'bottomnavbar',
      description: '点击bottom nav bar',
    },
    homeTab: {
      action: 'tap',
      target: 'hometab',
      description: '点击home tab',
    },
    swapTab: {
      action: 'tap',
      target: 'swaptab',
      description: '点击swap tab',
    },
    perpTab: {
      action: 'tap',
      target: 'perptab',
      description: '点击perp tab',
    },
    discoveryTab: {
      action: 'tap',
      target: 'discoverytab',
      description: '点击discovery tab',
    },
    noWalletEmptyContainer: {
      action: 'tap',
      target: 'nowalletemptycontainer',
      description: '点击no wallet empty container',
    },
  },
};
