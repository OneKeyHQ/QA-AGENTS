/**
 * 设置密码弹层 - 可交互元素规则
 * 对应页面对象: setPasswordPopup (setPassword.popup.js)
 * 用于生成测试用例
 */
export default {
  page: 'setPasswordPopup',
  pageFile: 'setPassword.popup.js',
  elements: {
    passwordInput: {
      action: 'input',
      target: 'password',
      description: '输入密码',
    },
  },
};
