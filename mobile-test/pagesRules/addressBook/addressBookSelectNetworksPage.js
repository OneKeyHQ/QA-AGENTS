/**
 * AddressBookSelectNetworks页面 - 可交互元素规则
 * 对应页面对象: addressBookSelectNetworksPage (selectNetworksPage.js)
 * 用于生成测试用例
 * 
 */
export default {
  page: 'addressBookSelectNetworksPage',
  pageFile: 'selectNetworksPage.js',
  elements: {
    // ========== 导航类元素 ==========
    closeBtn: {
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
  },
};
