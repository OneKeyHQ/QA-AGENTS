/**
 * Intercom 客服/帮助页 - 可交互元素规则
 * 对应页面对象: intercomPage (intercomPage.js)
 * 来源: xmls/settings/intercomEnglish.xml
 * 用于生成测试用例
 */
export default {
  page: 'intercomPage',
  pageFile: 'intercomPage.js',
  elements: {
    closeBtn: {
      action: 'navigate',
      target: 'previous',
      description: '关闭 Intercom 客服页并返回上一页',
    },
    headerRightBtn: {
      action: 'tap',
      target: 'headerOptions',
      description: '打开头部更多选项',
    },
  },
};
