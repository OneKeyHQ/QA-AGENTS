/**
 * More页面 - 可交互元素规则
 * 对应页面对象: morePage (morePage.js)
 * 用于生成测试用例
 * 
 * ⚠️ 以下元素需要人工确认：settingBtn
 */
export default {
  page: 'morePage',
  pageFile: 'morePage.js',
  elements: {
    // ========== 导航类元素 ==========
    settingBtn: {
      action: 'navigate',
      target: 'settingPage',
      description: '打开setting',
      // TODO: 需要人工确认目标页面
    },
    lockBtn: {
      action: 'navigate',
      target: 'lock',
      description: '跳转到lock',
    },
    // ========== 操作类元素 ==========
    addressBook: {
      action: 'tap',
      target: 'addressbook',
      description: '点击address book',
    },
    pickAddressBook: {
      action: 'tap',
      target: 'pickaddressbook',
      description: '点击pick address book',
    },
    encryptedStorageConfirm: {
      action: 'tap',
      target: 'encryptedstorageconfirm',
      description: '点击encrypted storage confirm',
    },
  },
};
