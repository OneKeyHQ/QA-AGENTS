/**
 * EncryptedStorageModal页面 - 可交互元素规则
 * 对应页面对象: encryptedStorageModal (encryptedStorageModalPage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'encryptedStorageModal',
  pageFile: 'encryptedStorageModalPage.js',
  elements: {
    // ========== 操作类元素 ==========
    encryptedStorageConfirm: {
      action: 'tap',
      target: 'encryptedstorageconfirm',
      description: '点击encrypted storage confirm',
    },
  },
};
