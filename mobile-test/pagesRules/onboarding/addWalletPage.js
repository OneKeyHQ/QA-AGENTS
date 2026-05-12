/**
 * 添加钱包页面 - 可交互元素规则
 * 对应页面: addWalletPage.js
 * 依据 xmls/onboarding/addWallet.xml
 * 用于录制/生成测试用例
 */
export default {
  page: 'addWalletPage',
  pageFile: 'addWalletPage.js',
  xmlRef: 'xmls/onboarding/addWallet.xml',
  elements: {
    // ========== 顶部导航 ==========
    backButton: {
      action: 'navigate',
      target: '上一页/关闭',
      description: '点击返回按钮',
    },
    topRightButton: {
      action: 'navigate',
      target: '右上角功能',
      description: '点击右上角按钮',
    },
    pageTitle: {
      action: 'assert',
      target: '页面标题',
      description: '校验标题为「添加钱包」',
    },

    // ========== 钱包方式卡片（主操作） ==========
    createNoSeedWalletCard: {
      action: 'tap',
      target: '创建无私钥钱包',
      description: '点击「创建无私钥钱包」卡片',
    },
    createNoSeedWalletTitle: {
      action: 'assert',
      target: '创建无私钥钱包标题',
      description: '校验创建无私钥钱包标题文案',
    },
    createNoSeedWalletLearnMoreBtn: {
      action: 'navigate',
      target: '创建无私钥钱包-了解更多',
      description: '点击创建无私钥钱包下的「了解更多」',
    },

    createSeedWalletCard: {
      action: 'tap',
      target: '创建助记词钱包',
      description: '点击「创建助记词钱包」卡片',
    },
    createSeedWalletTitle: {
      action: 'assert',
      target: '创建助记词钱包标题',
      description: '校验创建助记词钱包标题文案',
    },
    createSeedWalletLearnMoreBtn: {
      action: 'navigate',
      target: '创建助记词钱包-了解更多',
      description: '点击创建助记词钱包下的「了解更多」',
    },

    addExistingWalletCard: {
      action: 'tap',
      target: '导入现有钱包',
      description: '点击「导入现有钱包」卡片',
    },
    addExistingWalletTitle: {
      action: 'assert',
      target: '导入现有钱包标题',
      description: '校验导入现有钱包标题文案',
    },
    addExistingWalletSubtitle: {
      action: 'assert',
      target: '导入现有钱包副标题',
      description: '校验导入现有钱包副标题文案',
    },

    connectExternalWalletCard: {
      action: 'tap',
      target: '连接外部钱包',
      description: '点击「连接外部钱包」卡片',
    },
    connectExternalWalletTitle: {
      action: 'assert',
      target: '连接外部钱包标题',
      description: '校验连接外部钱包标题文案',
    },

    // ========== 卡片内标签（辅助校验，当前 XML 未包含） ==========
    noSeedPhraseLabel: {
      action: 'assert',
      target: '无需助记词标签',
      description: '校验「无需助记词」标签',
    },
    beginnerFriendlyLabel: {
      action: 'assert',
      target: '新手友好标签',
      description: '校验「新手友好」标签',
    },
    supportManyNetworksLabel: {
      action: 'assert',
      target: '支持数百个网络标签',
      description: '校验「支持数百个网络」标签',
    },
    openSourceSecureLabel: {
      action: 'assert',
      target: '开源安全加密标签',
      description: '校验「开源安全加密」标签',
    },
    quickStartLabel: {
      action: 'assert',
      target: '极速上手标签',
      description: '校验「极速上手」标签',
    },
    mostUsedLabel: {
      action: 'assert',
      target: '最常使用标签',
      description: '校验「最常使用」标签',
    },
    seedPhrase12WordsLabel: {
      action: 'assert',
      target: '助记词12词标签',
      description: '校验「助记词由 12 个单词组成」标签',
    },
    seedPhraseLikePasswordLabel: {
      action: 'assert',
      target: '助记词如密码标签',
      description: '校验「助记词就像是「密码」」标签',
    },
    needToKeepSafeLabel: {
      action: 'assert',
      target: '需要妥善保管标签',
      description: '校验「需要自己妥善保管」标签',
    },
    handwrittenBackupLabel: {
      action: 'assert',
      target: '手写备份标签',
      description: '校验「手写备份」标签',
    },
    support12To24WordsLabel: {
      action: 'assert',
      target: '支持12-24词助记词标签',
      description: '校验「支持 12-24 个单词的助记词」标签',
    },
  },
};
