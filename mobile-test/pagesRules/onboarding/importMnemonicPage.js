/**
 * ImportMnemonic 页面 - 可交互元素规则
 * 对应页面对象: importMnemonicPage (importMnemonicPage.js)
 * 用于生成测试用例
 *
 * 页面规则说明：
 * 1. 第一个助记词填写框的 xpath 为 //android.widget.EditText[@resource-id="phrase-input-index0"]，
 *    其余助记词输入框为 phrase-input-index1 ~ phrase-input-index11
 * 2. 右上角按钮为切换语言按钮（languageSwitchButton）
 * 3. 左上角按钮为返回按钮（backButton），点击后返回 addExistingWallet 页面
 */
export default {
  page: 'importMnemonicPage',
  pageFile: 'importMnemonicPage.js',
  elements: {
    // ========== 导航类元素 ==========
    backButton: {
      action: 'navigate',
      target: 'addExistingWalletPage',
      description: '点击返回，回到添加现有钱包页面',
    },
    languageSwitchButton: {
      action: 'tap',
      target: 'languageswitch',
      description: '点击右上角切换语言按钮',
    },
    confirmButton: {
      action: 'navigate',
      target: 'confirm',
      description: '点击确认，进入下一步',
    },
    // ========== Tab 与选择类 ==========
    tabMnemonic: {
      action: 'tap',
      target: 'tabmnemonic',
      description: '点击助记词 Tab',
    },
    tabPrivateKey: {
      action: 'tap',
      target: 'tabprivatekey',
      description: '点击私钥 Tab',
    },
    phraseLengthButton: {
      action: 'tap',
      target: 'phraselength',
      description: '点击助记词长度选择（如 12/24 个单词）',
    },
    // ========== 输入类元素 ==========
    phraseInputFirst: {
      action: 'input',
      target: 'phraseinput0',
      description: '第一个助记词输入框，resource-id=phrase-input-index0',
    },
    // 助记词输入框 1~11 通过 getPhraseInput(index) 获取，规则上仅标注第一个
    // ========== 只读/展示类（一般不作为操作目标） ==========
    pageTitle: {
      action: 'tap',
      target: 'pagetitle',
      description: '页面标题「导入助记词或私钥」',
    },
    hardwareWalletWarning: {
      action: 'tap',
      target: 'hardwarewalletwarning',
      description: '硬件钱包提示文案',
    },
  },
};
