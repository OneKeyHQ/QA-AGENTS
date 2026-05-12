/**
 * Bulk Copy Address 批量复制地址页 - 可交互元素规则
 * 对应页面对象: bulkCopyAddressPage (bulkCopyAddressPage.js)
 * 来源: xmls/settings/bulkCopyAddressNologinEnglish.xml
 * 用于生成测试用例（未登录用户 Prime 功能介绍）
 */
export default {
  page: 'bulkCopyAddressPage',
  pageFile: 'bulkCopyAddressPage.js',
  elements: {
    closeBtn: {
      action: 'navigate',
      target: 'previous',
      description: '关闭批量复制地址页并返回上一页',
    },
    aboutOneKeyPrimeBtn: {
      action: 'tap',
      target: 'aboutOneKeyPrime',
      description: '查看 OneKey Prime 详情',
    },
  },
};
