/**
 * 地址簿弹层 - 可交互元素规则
 * 对应页面对象: addressBookAlarmPopup (addressBookAlarm.popup.js)
 * 用于生成测试用例
 */
export default {
  page: 'addressBookAlarmPopup',
  pageFile: 'addressBookAlarm.popup.js',
  elements: {
    okBtn: {
      action: 'navigate',
      target: 'setPasswordPopup',
      description: '打开设置密码弹层',
    },
  },
};
