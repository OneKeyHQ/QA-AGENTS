/**
 * 地址簿空状态/列表页 - 可交互元素规则
 * 对应页面对象: addressBookPageNoAddress (noAddressPage.js)
 * 用于生成测试用例
 */
export default {
  page: 'addressBookPageNoAddress',
  pageFile: 'noAddressPage.js',
  elements: {
    closeBtn: {
      action: 'navigate',
      target: 'previous',
      description: '返回上一级页面',
    },
    footerAddBtn: {
      action: 'navigate',
      target: 'addressBookPageAddAddress',
      description: '跳转添加地址页',
    },
    bankAddBtn: {
      action: 'navigate',
      target: 'addressBookPageAddAddress',
      description: '跳转添加地址页',
    },
  },
};
