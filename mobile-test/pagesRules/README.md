# Pages Rules

PageRules 有两个主要目的：

1. **记录 App 的交互逻辑**：记录每个页面对象下可交互元素的交互逻辑，包括元素的操作类型（导航、输入、点击等）和目标页面，形成 App 的交互逻辑文档。
2. **生成自动化测试用例**：基于记录的交互逻辑，自动生成测试用例，提高测试用例编写的效率和一致性。

## 相关文档

- **[PAGE_RULES_GUIDE.md](./PAGE_RULES_GUIDE.md)**：详细的 pageRules 整理规则指南，包含如何从页面对象生成 pageRules 的完整流程和规范。

## 自动生成工具

### 使用方法

我们提供了自动生成工具 `generatePageRules.js`，可以基于页面对象的命名规律自动生成 pageRules 文件。

#### 基本用法

```bash
# 生成单个页面的 pageRules
node pagesRules/generatePageRules.js pages/onboarding/onboardingPage.js

# 生成所有页面的 pageRules（扫描 pages/ 和 popup/ 目录下的所有文件）
node pagesRules/generatePageRules.js
```

#### 工作原理

1. **扫描页面文件**：自动扫描 `pages/` 和 `popup/` 目录下的所有 `Page.js` 和 `.popup.js` 文件
2. **建立页面索引**：提取每个页面对象的导出名、类名等信息，建立索引用于匹配
3. **提取元素**：从页面对象文件中提取所有 getter 方法（可交互元素）
4. **智能匹配**：基于命名规律自动匹配元素的目标页面：
   - `continueWithGoogleBtn` → `useGooglePage`
   - `continueWithAppleBtn` → `useApplePage`
   - `connectHardwareWalletBtn` → `selectHardwareWalletPage`
   - `moreOptionsBtn` → `addWalletPage`
   - `topRightButton` → `languageSelectPopup`
5. **生成规则**：自动生成 pageRules 文件，包含 action、target 和 description

#### 特殊规则

工具会自动处理以下特殊情况：

- **返回按钮**：`backButton` 在 onboarding 页面会自动匹配到 `homePage`，其他页面匹配到 `previous`
- **关闭按钮**：`closeButton` 自动识别为关闭操作
- **外部链接**：包含 `agreement`、`Terms`、`Privacy` 等关键词的文本元素会自动识别为外部链接
- **Popup 识别**：`topRightButton` 等按钮会自动匹配到对应的 popup

#### 输出说明

- ✅ **自动匹配成功**：工具会自动生成规则，无需人工干预
- ⚠️ **需要人工确认**：如果无法自动匹配，会在生成的文件中标记 `// TODO: 需要人工确认`，需要手动补充

#### 注意事项

1. **文件已存在**：如果目标 pageRules 文件已存在，工具会跳过生成，避免覆盖已有规则。如需重新生成，请先手动删除旧文件。
2. **命名规范**：工具基于命名规律进行匹配，建议保持页面对象和元素的命名规范一致，以提高自动匹配率。
3. **人工审核**：生成后建议人工审核，特别是标记为需要确认的元素。

#### 示例

```bash
# 为 onboarding 页面生成 pageRules
node pagesRules/generatePageRules.js pages/onboarding/onboardingPage.js

# 输出：
# 🔍 扫描页面文件...
# ✅ 找到 46 个页面对象
# 
# 📝 处理: pages/onboarding/onboardingPage.js
#   ✅ 生成: pagesRules/onboarding/onboardingPage.js
# 
# ✨ 完成！
```

更多详细信息请参考 [PAGE_RULES_GUIDE.md](./PAGE_RULES_GUIDE.md) 中的"自动生成 pageRules 的可行性分析"章节。

## 层级设计

```
pagesRules/
├── README.md                 # 本说明
├── index.js                  # 统一导出各模块 rules
├── addressBook/              # 地址簿模块（与 pages/addressBook 对应）
│   ├── index.js
│   ├── addressBookPage-NoAddress.js    # 地址簿空状态/列表页
│   ├── addressBookPage-AddAddress.js   # 添加地址页（待补充）
│   └── addressBookPage-SelectNetworks.js # 选择网络页（待补充）
├── onboarding/               # 引导/ onboarding 模块（待补充）
├── explore/                  # 探索模块（待补充）
└── ...                       # 其他与 pages 目录对应的模块
```

- 每个 **页面对象** 对应一个 **规则文件**，命名：`{PageName}-{Variant}.js`（与页面导出名对应，如 `addressBookPageNoAddress` → `addressBookPage-NoAddress.js`）。
- 规则文件内描述该页面上 **可交互元素** 的：`action`（navigate / input / tap 等）、`target`（跳转目标页或描述）、`description`（中文说明）。

## 规则格式

每个规则文件默认导出一个对象：

```js
export default {
  page: 'addressBookPageNoAddress',   // 对应页面对象导出名
  pageFile: 'noAddressPage.js',      // 对应 pages 下的文件名（可选）
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
  },
};
```

- **action**：`navigate` | `input` | `tap` | 等（可扩展）
- **target**：跳转目标页名（如 `addressBookPageAddAddress`）或 `previous` 表示返回上一级
- **description**：用于文档与用例生成的简短说明
