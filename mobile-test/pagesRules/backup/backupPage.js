/**
 * Backup 备份页 - 可交互元素规则
 * 对应页面对象: backupPage (backupPage.js)
 * 来源: xmls/settings/backupEnglish.xml
 * 用于生成测试用例
 */
export default {
  page: 'backupPage',
  pageFile: 'backupPage.js',
  elements: {
    closeBtn: {
      action: 'navigate',
      target: 'previous',
      description: '关闭备份页并返回上一页',
    },
    googleDriveOption: {
      action: 'tap',
      target: 'googleDrive',
      description: '选择 Google Drive 云备份',
    },
    oneKeyCloudOption: {
      action: 'tap',
      target: 'oneKeyCloud',
      description: '选择 OneKey Cloud 云备份',
    },
    transferOption: {
      action: 'tap',
      target: 'transfer',
      description: '选择 Transfer 跨设备传输',
    },
    manualBackupOption: {
      action: 'tap',
      target: 'manualBackup',
      description: '选择手动备份',
    },
    oneKeyLiteOption: {
      action: 'tap',
      target: 'oneKeyLite',
      description: '选择 OneKey Lite 硬件备份',
    },
    oneKeyKeyTagOption: {
      action: 'tap',
      target: 'oneKeyKeyTag',
      description: '选择 OneKey KeyTag 备份',
    },
  },
};
