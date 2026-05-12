/**
 * 扫描二维码页 - 可交互元素规则
 * 对应页面对象: scanPage (scanPage.js)
 * 用于生成测试用例
 */
export default {
  page: 'scanPage',
  pageFile: 'scanPage.js',
  elements: {
    closeBtn: {
      action: 'navigate',
      target: 'previous',
      description: '关闭扫描页并返回上一页',
    },
    photoBtn: {
      action: 'tap',
      target: 'openPhoto',
      description: '打开相册选择图片进行扫描',
    },
    firstImage: {
      action: 'tap',
      target: 'selectImage',
      description: '选择相册中的第一张图片',
    },
  },
};
