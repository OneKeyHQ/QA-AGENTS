# PageRules 整理规则指南

本指南用于指导如何根据页面对象（Page Object）文件生成对应的 pageRules 文件。

## 一、识别页面对象

### 1.1 页面对象特征
- 文件位置：`pages/` 目录下，通常以 `Page.js` 结尾
- 类结构：继承自 `Page` 基类
- 导出方式：通常导出为单例实例，如 `export const addressBookPageNoAddress = new AddressBookNoAddressPage()`
- 导出命名：camelCase 格式，如 `addressBookPageNoAddress`

### 1.2 提取页面信息
```javascript
// 从页面对象文件中提取：
// 1. 导出名（export const xxx = ...）
// 2. 文件名（如 addAddressPage.js）
// 3. 类名（如 AddressBookAddAddressPage）
```

## 二、提取可交互元素

### 2.1 需要包含的元素类型

#### ✅ 应该包含的元素
1. **导航类元素**：按钮、链接等，点击后会跳转到其他页面
   - 命名特征：`*Btn`, `*Button`, `*Link`, `*Icon`, `*Trigger`
   - 示例：`backBtn`, `closeBtn`, `footerAddBtn`, `networkSelectBtn`

2. **输入类元素**：输入框、文本域等
   - 命名特征：`*Input`, `*Field`, `*Text`, `*Search`
   - 示例：`nameInput`, `addressInput`, `searchInput`

3. **操作类元素**：执行特定操作的按钮
   - 命名特征：`*Btn`, `*Button`, `*Action`
   - 示例：`saveBtn`, `removeBtn`, `copyBtn`, `scanBtn`, `confirmBtn`

4. **确认/取消类元素**：对话框中的确认、取消按钮
   - 命名特征：`*Confirm`, `*Cancel`, `*Remove`, `*Delete`
   - 示例：`removeConfirmBtn`, `confirmBtn`, `cancelBtn`

#### ❌ 不应该包含的元素
1. **只读元素**：仅用于显示，不可交互
   - 命名特征：`*Text`, `*Title`, `*Label`, `*Message`（非输入框）
   - 示例：`currentNetworkText`, `formNameMessage`（仅用于断言）

2. **内部辅助元素**：用于定位或内部逻辑
   - 命名特征：`keyElement`, `*Prefix`, `*Suffix`
   - 示例：`keyElement`, `addressBookItemPrefix`

3. **断言方法相关**：`expect*`, `wait*` 等方法对应的元素
   - 这些元素通常只用于验证，不用于交互

### 2.2 元素命名映射规则

页面对象中的 getter 名称 → pageRules 中的元素名称：
- 保持一致的命名（camelCase）
- 移除后缀如 `Btn`、`Button` 等（可选，但建议保留以保持清晰）

## 三、确定 Action 类型

### 3.1 Action 类型判断规则

#### `navigate` - 导航类操作
**判断条件**：
- 元素点击后会跳转到其他页面或返回上一页
- 对应的方法名通常包含：`click*`, `navigate*`, `goTo*`
- 目标页面可以通过方法实现或注释推断

**target 值**：
- `previous`：返回上一级页面（如 `backBtn`, `closeBtn`）
- 目标页面对象名：如 `addressBookPageAddAddress`, `networkSelectorModal`

**示例**：
```javascript
backBtn: {
  action: 'navigate',
  target: 'previous',
  description: '返回上一级页面',
},
networkSelectBtn: {
  action: 'navigate',
  target: 'networkSelectorModal',
  description: '打开网络选择器',
},
```

#### `input` - 输入类操作
**判断条件**：
- 元素是输入框（`*Input`, `*Field`, `*Search`）
- 对应的方法通常包含：`input*`, `set*`, `fill*`, `type*`

**target 值**：
- 输入字段的语义名称：如 `name`, `address`, `password`, `searchTerm`

**示例**：
```javascript
nameInput: {
  action: 'input',
  target: 'name',
  description: '输入地址名称',
},
addressInput: {
  action: 'input',
  target: 'address',
  description: '输入地址',
},
```

#### `tap` - 点击类操作
**判断条件**：
- 元素是按钮，点击后执行操作但不跳转页面
- 对应的方法通常包含：`click*`, `tap*`
- 操作包括：保存、删除、复制、扫描、确认等

**target 值**：
- 操作的语义名称：如 `save`, `remove`, `copy`, `scan`, `confirmRemove`

**示例**：
```javascript
saveBtn: {
  action: 'tap',
  target: 'save',
  description: '保存地址并返回上一页',
},
copyBtn: {
  action: 'tap',
  target: 'copy',
  description: '复制地址到剪贴板',
},
removeConfirmBtn: {
  action: 'tap',
  target: 'confirmRemove',
  description: '确认删除地址',
},
```

### 3.2 特殊情况处理

#### 复合操作
如果元素点击后执行多个操作（如保存并返回），在 description 中说明，action 仍为 `tap`：
```javascript
saveBtn: {
  action: 'tap',
  target: 'save',
  description: '保存地址并返回上一页', // 说明包含返回操作
},
```

#### 条件显示的元素
某些元素只在特定条件下显示（如编辑模式下的删除按钮），在 description 中说明：
```javascript
removeBtn: {
  action: 'tap',
  target: 'remove',
  description: '删除地址（编辑模式下）',
},
```

## 四、确定 Target 值

### 4.1 Target 命名规范

#### 导航类（action: 'navigate'）
- 返回上一页：`previous`
- 跳转到其他页面：使用目标页面对象的导出名（camelCase）
  - 示例：`addressBookPageAddAddress`, `networkSelectorModal`

#### 输入类（action: 'input'）
- 使用字段的语义名称（英文，小写）
- 示例：`name`, `address`, `password`, `searchTerm`

#### 点击类（action: 'tap'）
- 使用操作的语义名称（英文，小写）
- 示例：`save`, `remove`, `copy`, `scan`, `confirmRemove`, `cancel`

### 4.2 如何确定 Target

1. **查看方法实现**：查看页面对象中对应的方法，了解其行为
2. **查看注释**：页面对象文件中的注释可能包含线索
3. **查看 XML 文件**：对应的 XML 文件可能包含页面结构信息
4. **查看测试用例**：现有的测试用例可能展示元素的使用方式

## 五、编写 Description

### 5.1 Description 编写规则

- **语言**：使用中文
- **格式**：简洁明了，说明元素的作用
- **内容**：包含操作类型和结果
- **长度**：建议 5-15 个字

### 5.2 Description 模板

#### 导航类
- 返回：`返回上一级页面`
- 跳转：`跳转到{目标页面名称}` 或 `打开{功能名称}`

#### 输入类
- `输入{字段名称}`

#### 点击类
- 保存：`保存{内容}并返回上一页` 或 `保存{内容}`
- 删除：`删除{内容}` 或 `删除{内容}（{条件}）`
- 其他：`{操作}{内容}`，如 `复制地址到剪贴板`、`扫描二维码获取地址`

## 六、文件命名规范

### 6.1 规则文件命名

**格式**：`{PageName}-{Variant}.js`

**规则**：
1. 将页面对象的导出名（camelCase）转换为 PascalCase，并用连字符分隔变体
2. 示例：
   - `addressBookPageNoAddress` → `addressBookPage-NoAddress.js`
   - `addressBookAddAddressPage` → `addressBookPage-AddAddress.js`

**注意**：
- 如果页面对象名已经是完整的（如 `addressBookPageNoAddress`），直接转换
- 如果页面对象名是部分名称（如 `addressBookAddAddressPage`），需要根据上下文确定完整名称

### 6.2 文件位置

规则文件应放在 `pagesRules/{模块名}/` 目录下，与 `pages/{模块名}/` 对应。

## 七、文件结构规范

### 7.1 规则文件结构

```javascript
/**
 * {页面描述} - 可交互元素规则
 * 对应页面对象: {页面对象导出名} ({文件名})
 * 用于生成测试用例
 */
export default {
  page: '{页面对象导出名}',      // 必须：与页面对象导出名一致
  pageFile: '{文件名}',          // 可选：对应的页面对象文件名
  elements: {
    // 元素规则...
  },
};
```

### 7.2 Elements 组织规则

1. **按功能分组**（可选）：可以将相关元素分组，但当前格式不支持嵌套，所以按顺序排列
2. **优先级顺序**：
   - 导航类元素（返回、跳转）
   - 输入类元素
   - 操作类元素（保存、删除等）
   - 确认/取消类元素

## 八、更新索引文件

创建规则文件后，需要在对应的 `index.js` 中添加导出：

```javascript
export { default as {规则导出名} } from './{规则文件名}.js';
```

**规则导出名**：与 `page` 字段保持一致

## 九、检查清单

创建 pageRules 文件前，请确认：

- [ ] 已识别页面对象的导出名和文件名
- [ ] 已提取所有可交互元素（导航、输入、操作类）
- [ ] 已排除只读元素和辅助元素
- [ ] 已正确判断每个元素的 action 类型
- [ ] 已确定每个元素的 target 值
- [ ] 已编写清晰的中文 description
- [ ] 已遵循文件命名规范
- [ ] 已更新对应的 index.js 文件
- [ ] 已添加文件头注释

## 十、示例对比

### 页面对象文件（addAddressPage.js）
```javascript
class AddressBookAddAddressPage extends Page {
  get backBtn() {
    return api.by.id('nav-header-back');
  }
  
  get networkSelectBtn() {
    return api.by.id('network-selector-input');
  }
  
  get nameInput() {
    return api.by.id('address-form-name');
  }
  
  get addressInput() {
    return api.by.id('address-form-address');
  }
  
  get saveBtn() {
    return api.by.id('address-form-save');
  }
  
  async clickSelectChain() {
    await api.tap(this.networkSelectBtn);
  }
  
  async inputName(name) {
    await api.setValue(this.nameInput, name);
  }
}

export const addressBookAddAddressPage = new AddressBookAddAddressPage();
```

### 对应的 pageRules 文件（addressBookPage-AddAddress.js）
```javascript
export default {
  page: 'addressBookAddAddressPage',
  pageFile: 'addAddressPage.js',
  elements: {
    backBtn: {
      action: 'navigate',
      target: 'previous',
      description: '返回上一级页面',
    },
    networkSelectBtn: {
      action: 'navigate',
      target: 'networkSelectorModal',
      description: '打开网络选择器',
    },
    nameInput: {
      action: 'input',
      target: 'name',
      description: '输入地址名称',
    },
    addressInput: {
      action: 'input',
      target: 'address',
      description: '输入地址',
    },
    saveBtn: {
      action: 'tap',
      target: 'save',
      description: '保存地址并返回上一页',
    },
  },
};
```

## 十一、自动生成 pageRules 的可行性分析

### 11.1 当前可以实现的部分自动化

**✅ 可以自动推断的情况：**

1. **基于命名规律的页面导航匹配**
   - `continueWithGoogleBtn` → `useGooglePage` (提取关键词 "Google" → 匹配页面名包含 "Google")
   - `continueWithAppleBtn` → `useApplePage` (提取关键词 "Apple" → 匹配页面名包含 "Apple")
   - `connectHardwareWalletBtn` → `selectHardwareWalletPage` (提取关键词 "HardwareWallet" → 匹配页面名包含 "HardwareWallet")
   
2. **标准返回按钮**
   - `backButton`, `backBtn` → `action: 'navigate'`, `target: 'previous'` (可自动识别)

3. **标准关闭按钮**
   - `closeButton`, `closeBtn` → `action: 'click'`, `target: 'closeButton'` (可自动识别)

4. **输入类元素**
   - `*Input`, `*Field`, `*Search` → `action: 'input'` (可自动识别)

### 11.2 需要人工干预的情况

**❌ 难以自动推断的情况：**

1. **命名规律不明显**
   - `moreOptionsBtn` → `addWalletPage` (需要业务上下文理解)
   - `topRightButton` → `languageSelectPopup` (需要知道按钮功能)

2. **外部链接和浏览器跳转**
   - `agreementText` → `target: 'external'` (需要识别外部链接特征)

3. **Popup 和 Modal**
   - 需要区分是页面导航还是弹层打开

4. **复杂的业务逻辑**
   - 某些按钮可能执行多个操作
   - 某些按钮的行为可能依赖状态

### 11.3 自动生成工具的实现思路

#### 方案1：基于命名规律匹配（推荐，可立即实现）

**实现步骤：**
1. 扫描 `pages/` 目录，建立页面名映射表（导出名 → 文件路径）
2. 提取按钮名中的关键词（如 "Google", "Apple", "HardwareWallet"）
3. 在页面名映射表中查找包含关键词的页面
4. 如果找到唯一匹配，自动生成规则；如果多个匹配或未找到，标记为需要人工确认

**示例代码逻辑：**
```javascript
// 伪代码
function inferTargetPage(buttonName, allPages) {
  const keywords = extractKeywords(buttonName); // ["Google"]
  const matches = allPages.filter(page => 
    keywords.some(keyword => page.name.includes(keyword))
  );
  
  if (matches.length === 1) {
    return matches[0].exportName; // "useGooglePage"
  }
  return null; // 需要人工确认
}
```

#### 方案2：分析测试用例（需要测试用例支持）

**实现步骤：**
1. 扫描测试用例文件，查找模式：`clickXxxBtn()` 后紧跟 `xxxPage.waitEntryPage()`
2. 建立按钮 → 页面的映射关系
3. 自动生成规则

**限制：**
- 需要测试用例覆盖完整
- 测试用例格式需要规范

#### 方案3：静态代码分析（复杂但准确）

**实现步骤：**
1. 使用 AST 解析页面对象文件
2. 分析 `click*` 方法的实现
3. 查找方法中是否有 `waitEntryPage()` 调用
4. 推断目标页面

**限制：**
- 实现复杂度高
- 如果导航逻辑在应用路由层，无法静态分析

### 11.4 推荐的迭代优化路径

#### 第一阶段：基础自动化（当前可做）

1. **实现命名规律匹配**
   - 扫描所有页面文件，建立页面名索引
   - 实现关键词提取和匹配算法
   - 自动生成可匹配的规则，未匹配的标记为待确认

2. **建立命名规范文档**
   - 明确按钮命名和页面命名的对应关系
   - 例如：`continueWith{X}Btn` → `use{X}Page`

#### 第二阶段：增强自动化（需要优化）

1. **分析测试用例**
   - 从测试用例中提取导航关系
   - 补充命名规律无法覆盖的情况

2. **建立规则模板**
   - 为常见模式建立模板（如返回按钮、关闭按钮）
   - 自动应用模板生成规则

#### 第三阶段：智能推断（长期目标）

1. **机器学习辅助**
   - 基于历史规则数据训练模型
   - 预测按钮的目标页面

2. **运行时分析**
   - 在测试执行时记录页面跳转关系
   - 自动更新 pageRules

### 11.5 当前建议

**可以做到部分自动化**，建议：

1. **立即实现**：
   - 开发基础工具，基于命名规律自动生成可匹配的规则
   - 未匹配的规则标记为 `// TODO: 需要人工确认`，由人工补充

2. **短期优化**：
   - 建立命名规范，提高自动匹配率
   - 分析现有测试用例，提取导航关系

3. **长期优化**：
   - 考虑静态代码分析或运行时分析
   - 建立规则验证机制，确保一致性

## 十二、迭代优化建议

本规则文件应持续迭代优化，建议关注以下方面：

1. **Action 类型扩展**：根据实际需求添加新的 action 类型
2. **Target 命名规范**：建立更完善的命名规范文档，提高自动匹配率
3. **自动化工具**：开发工具自动生成 pageRules，基于命名规律匹配 + 人工确认
4. **验证机制**：建立规则文件的验证机制，确保与页面对象一致
5. **文档完善**：根据实际使用情况补充更多示例和特殊情况处理
6. **命名规范统一**：统一按钮和页面的命名规范，便于自动推断
