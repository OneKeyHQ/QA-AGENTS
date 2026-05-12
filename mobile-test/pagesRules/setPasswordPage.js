/**
 * SetPassword页面 - 可交互元素规则
 * 对应页面对象: setPasswordPage (setPasswordPage.js)
 * 用于生成测试用例
 * 
 * ⚠️ 以下元素需要人工确认：setPasswordBtn
 */
export default {
  page: 'setPasswordPage',
  pageFile: 'setPasswordPage.js',
  elements: {
    // ========== 导航类元素 ==========
    setPasswordBtn: {
      action: 'navigate',
      target: 'settingPage',
      description: '打开setting',
      // TODO: 需要人工确认目标页面
    },
    // ========== 输入类元素 ==========
    passwordInput: {
      action: 'input',
      target: 'password',
      description: '输入password',
    },
    confirmInput: {
      action: 'input',
      target: 'confirm',
      description: '输入confirm',
    },
  },
};
