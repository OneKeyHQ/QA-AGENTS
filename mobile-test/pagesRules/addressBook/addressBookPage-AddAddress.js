/**
 * 地址簿添加/编辑地址表单页 - 可交互元素规则
 * 对应页面对象: addressBookAddAddressPage (addAddressPage.js)
 * 用于生成测试用例
 */
export default {
  page: 'addressBookAddAddressPage',
  pageFile: 'addAddressPage.js',
  elements: {
    backBtn: {
      action: 'navigate',
      target: 'previous',
      description: '返回上一级页面',
    },
    networkSelectBtn: {
      action: 'navigate',
      target: 'networkSelectorModal',
      description: '打开网络选择器',
    },
    nameInput: {
      action: 'input',
      target: 'name',
      description: '输入地址名称',
    },
    addressInput: {
      action: 'input',
      target: 'address',
      description: '输入地址',
    },
    copyBtn: {
      action: 'tap',
      target: 'copy',
      description: '复制地址到剪贴板',
    },
    scanBtn: {
      action: 'tap',
      target: 'scan',
      description: '扫描二维码获取地址',
    },
    saveBtn: {
      action: 'tap',
      target: 'save',
      description: '保存地址并返回上一页',
    },
    removeBtn: {
      action: 'tap',
      target: 'remove',
      description: '删除地址（编辑模式下）',
    },
    removeConfirmBtn: {
      action: 'tap',
      target: 'confirmRemove',
      description: '确认删除地址',
    },
  },
};
