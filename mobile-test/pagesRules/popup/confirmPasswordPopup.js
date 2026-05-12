/**
 * 确认密码弹层 - 可交互元素规则
 * 对应页面对象: confirmPasswordPopup (confirmPassword.popup.js)
 * 用于生成测试用例
 */
export default {
  page: 'confirmPasswordPopup',
  pageFile: 'confirmPassword.popup.js',
  elements: {
    confirmPasswordInput: {
      action: 'input',
      target: 'confirmPassword',
      description: '输入确认密码',
    },
  },
};
