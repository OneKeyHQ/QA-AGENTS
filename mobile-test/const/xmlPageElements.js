/**
 * 从 XML 文件提取的页面元素定义
 * 用于 Page Object 创建和测试用例生成
 *
 * 来源:
 * - xmls/settings/intercomEnglish.xml
 * - xmls/settings/backupEnglish.xml
 * - xmls/settings/bulkCopyAddressNologinEnglish.xml
 */

/**
 * Intercom 客服/帮助页 - WebView 嵌入式页面
 * 来源: xmls/settings/intercomEnglish.xml
 */
export const intercomElements = {
  page: 'intercomPage',
  source: 'settings/intercomEnglish.xml',
  description: 'Intercom 客服/帮助 WebView 页面',
  elements: {
    closeBtn: {
      resourceId: 'nav-header-close',
      class: 'android.widget.Button',
      clickable: true,
      bounds: '[53,82][135,182]',
      xpath: '//android.widget.Button[@resource-id="nav-header-close"]',
    },
    headerRightBtn: {
      class: 'android.widget.Button',
      clickable: true,
      bounds: '[966,100][1028,163]',
      description: '头部右侧按钮（更多选项）',
    },
    webView: {
      class: 'android.webkit.WebView',
      bounds: '[0,200][1080,2337]',
      description: 'Intercom WebView 内容区域',
    },
  },
};

/**
 * Backup 备份页 - 钱包备份选项页
 * 来源: xmls/settings/backupEnglish.xml
 */
export const backupElements = {
  page: 'backupPage',
  source: 'settings/backupEnglish.xml',
  description: '钱包备份选项页',
  elements: {
    closeBtn: {
      resourceId: 'nav-header-close',
      class: 'android.widget.Button',
      clickable: true,
      bounds: '[53,82][135,182]',
      xpath: '//android.widget.Button[@resource-id="nav-header-close"]',
    },
    pageTitle: {
      text: 'Backup',
      class: 'android.view.View',
      bounds: '[169,94][346,168]',
      xpath: '//android.view.View[@text="Backup"]',
    },
    googleDriveOption: {
      text: 'Google Drive',
      resourceId: 'select-item-',
      class: 'android.widget.TextView',
      clickable: true,
      bounds: '[43,233][1037,359]',
      xpath:
        '//android.view.ViewGroup[@clickable="true"]/android.widget.TextView[@text="Google Drive"]/..',
    },
    oneKeyCloudOption: {
      text: 'OneKey Cloud',
      resourceId: 'select-item-',
      class: 'android.widget.TextView',
      clickable: true,
      bounds: '[43,360][1037,486]',
      xpath:
        '//android.view.ViewGroup[@clickable="true"]/android.widget.TextView[@text="OneKey Cloud"]/..',
    },
    transferOption: {
      text: 'Transfer',
      subtitle:
        'Securely transfer wallets between devices with local end-to-end encryption.',
      resourceId: 'select-item-',
      class: 'android.widget.TextView',
      clickable: true,
      bounds: '[43,530][1037,762]',
      xpath:
        '//android.view.ViewGroup[@clickable="true"]/android.widget.TextView[@text="Transfer"]/..',
    },
    manualBackupOption: {
      text: 'Manual backup',
      resourceId: 'select-item-',
      class: 'android.widget.TextView',
      clickable: true,
      bounds: '[43,806][1037,932]',
      xpath:
        '//android.view.ViewGroup[@clickable="true"]/android.widget.TextView[@text="Manual backup"]/..',
    },
    oneKeyLiteOption: {
      text: 'OneKey Lite',
      resourceId: 'select-item-',
      class: 'android.widget.TextView',
      clickable: true,
      bounds: '[43,933][1037,1059]',
      xpath:
        '//android.view.ViewGroup[@clickable="true"]/android.widget.TextView[@text="OneKey Lite"]/..',
    },
    oneKeyKeyTagOption: {
      text: 'OneKey KeyTag',
      resourceId: 'select-item-',
      class: 'android.widget.TextView',
      clickable: true,
      bounds: '[43,1060][1037,1186]',
      xpath:
        '//android.view.ViewGroup[@clickable="true"]/android.widget.TextView[@text="OneKey KeyTag"]/..',
    },
  },
};

/**
 * Bulk Copy Address 批量复制地址页 - 未登录用户 Prime 功能介绍
 * 来源: xmls/settings/bulkCopyAddressNologinEnglish.xml
 */
export const bulkCopyAddressElements = {
  page: 'bulkCopyAddressPage',
  source: 'settings/bulkCopyAddressNologinEnglish.xml',
  description: '批量复制地址功能介绍页（未登录）',
  elements: {
    closeBtn: {
      resourceId: 'nav-header-close',
      class: 'android.widget.Button',
      clickable: true,
      bounds: '[53,116][116,179]',
      xpath: '//android.widget.Button[@resource-id="nav-header-close"]',
    },
    pageTitle: {
      text: 'Bulk copy addresses',
      class: 'android.widget.TextView',
      bounds: '[52,788][1027,862]',
      xpath: '//android.widget.TextView[@text="Bulk copy addresses"]',
    },
    pageDescription: {
      text: 'Quickly select or generate addresses for bulk copying.',
      class: 'android.widget.TextView',
      bounds: '[52,867][1027,993]',
      xpath:
        '//android.widget.TextView[@text="Quickly select or generate addresses for bulk copying."]',
    },
    aboutOneKeyPrimeBtn: {
      resourceId: 'page-footer-confirm',
      contentDesc: 'About OneKey Prime',
      text: 'About OneKey Prime',
      class: 'android.widget.Button',
      clickable: true,
      bounds: '[53,2154][1028,2286]',
      xpath:
        '//android.widget.Button[@resource-id="page-footer-confirm" or @content-desc="About OneKey Prime"]',
    },
    featureWorksWith: {
      title: 'Works with Bitcoin, Ethereum, and more',
      description:
        'Manage all your blockchain addresses in one convenient place.',
    },
    featureSupportsWallets: {
      title: 'Supports all your wallets',
      description:
        'Easily export your crypto addresses — no tech skills needed.',
    },
    featureExportNeed: {
      title: 'Export what you need',
      description:
        'Download everything, or just the addresses you want.',
    },
  },
};
