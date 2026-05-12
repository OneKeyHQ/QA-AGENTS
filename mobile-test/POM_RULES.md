# Page Object Model (POM) 规则文档

本文档定义了创建页面对象（Page Object）时需要遵循的规则和最佳实践。

## 1. 层级规则

### 1.1 起始层级
所有页面元素的定位都从以下固定层级开始：

```
//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[2]/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup
```

**规则说明：**
- 这是 Android 应用的通用起始层级
- 所有元素的 xpath 定位都基于此层级继续向下定位
- 在页面对象类的注释中必须注明此起始层级

### 1.2 层级定位示例

```javascript
/**
 * 返回按钮 - 左上角返回图标按钮
 * bounds: [35,71][135,171]
 * 定位方式：使用相对xpath从指定层级开始定位第一个Button
 */
get backButton() {
  return api.by.xpath(
    '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[2]/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.widget.Button[1]',
  );
}
```

## 2. 定位优先级规则

### 2.1 定位方式优先级（从高到低）

1. **text 属性定位** - 最稳定，优先使用
   ```javascript
   // 优先使用
   api.by.xpath('//android.widget.TextView[@text="添加钱包"]')
   ```

2. **content-desc 属性定位** - 次优先，用于按钮等可交互元素
   ```javascript
   // 次优先
   api.by.xpath('//android.widget.Button[@content-desc="连接硬件钱包"]')
   ```

3. **text 和 content-desc 组合定位** - 提高兼容性
   ```javascript
   // 组合使用，更稳定
   api.by.xpath('//android.widget.Button[@content-desc="了解更多" or @text="了解更多"]')
   ```

4. **相对 xpath 定位** - 当无法使用 text/content-desc 时使用
   ```javascript
   // 从起始层级继续向下定位
   api.by.xpath('起始层级/android.widget.Button[1]')
   ```

5. **resource-id 定位** - 如果元素有稳定的 resource-id
   ```javascript
   // 使用 api.by.id() 方法
   api.by.id('element-resource-id')
   ```

### 2.2 定位规则说明

- ✅ **优先使用**：`text`、`content-desc` 属性（最稳定）
- ✅ **必须支持多语言**：所有文本定位必须包含中英文（如：`@text="中文" or @text="English"`）
- ✅ **默认先根据中文查找**：多语言定位时优先匹配中文，再回退英文；使用 `api.by.text([中文, English])` 时框架会自动将中文排在前面优先匹配。
- ✅ **可以使用**：`resource-id`（如果稳定）
- ⚠️ **谨慎使用**：相对 xpath（易受 UI 结构变化影响）
- ❌ **避免使用**：绝对坐标定位、bounds 定位

### 2.3 多语言定位示例

```javascript
// ✅ 推荐：使用 api.by.text，自动中文优先
api.by.text(['添加钱包', 'Add wallet'])

// ✅ 正确：xpath 时中文写在前，默认先根据中文查找
api.by.xpath('//android.widget.TextView[@text="添加钱包" or @text="Add wallet"]')

// ✅ 正确：支持中英文 content-desc，中文在前
api.by.xpath('//android.widget.Button[@content-desc="确认" or @content-desc="Confirm"]')

// ✅ 正确：支持中英文 hint
api.by.xpath('//android.widget.EditText[@hint="账户名称" or @hint="Account name"]')

// ❌ 错误：只支持单一语言
api.by.xpath('//android.widget.TextView[@text="添加钱包"]')
```

## 3. 文件组织规则

### 3.1 文件位置
- 所有页面对象文件必须放在 `pages/` 目录下
- 文件命名格式：`{pageName}Page.js`（小驼峰命名）
- 示例：`addWalletPage.js`、`onboardingPage.js`

### 3.2 文件结构
```javascript
import { api } from '@node-e2e/cli/api/index.js';
import Page from './base.js';  // 或 '../base.js'（根据目录层级）

/**
 * 页面名称 - 页面功能描述
 * 从层级开始：[起始层级路径]
 */
class PageName extends Page {
  // 1. keyElement 定义
  // 2. 元素定义（按功能分组）
  // 3. 操作方法
}

export const pageName = new PageName();
```

## 4. 代码结构规则

### 4.1 必需元素

#### keyElement（页面关键元素）
```javascript
/**
 * 页面关键元素 - 用于判断页面是否加载完成
 */
get keyElement() {
  return this.pageTitle;  // 或 this.mainButton 等
}
```

### 4.2 元素分组

使用注释分隔不同功能区域的元素：

```javascript
// ========== 顶部导航栏元素 ==========
get backButton() { ... }
get topRightButton() { ... }

// ========== 主要内容区域元素 ==========
get mainContent() { ... }

// ========== 底部操作栏元素 ==========
get confirmButton() { ... }
```

### 4.3 元素注释规范

每个元素必须包含以下信息：

```javascript
/**
 * 元素名称 - 元素功能描述
 * text: "元素文本"（如果有）
 * content-desc: "元素描述"（如果有）
 * bounds: [x1,y1][x2,y2]（从 XML 中获取）
 * 定位方式：说明使用的定位策略
 */
get elementName() {
  return api.by.xpath(...);
}
```

## 5. 命名规则

### 5.1 元素命名
- 使用小驼峰命名：`backButton`、`pageTitle`
- 命名要有意义，能清楚表达元素功能
- 按钮元素以 `Btn` 结尾：`confirmBtn`、`cancelBtn`
- 文本元素以 `Text` 结尾：`titleText`、`descriptionText`
- 卡片/容器元素以 `Card` 结尾：`walletCard`、`optionCard`

### 5.2 方法命名
- 操作方法以 `click`、`get`、`set`、`verify` 等动词开头
- 点击方法：`click{ElementName}()`
- 获取文本方法：`get{ElementName}Text()`
- 验证方法：`verify{Functionality}()`

示例：
```javascript
async clickBackButton() { ... }
async getPageTitle() { ... }
async verifyPageLoaded() { ... }
```

## 6. 注释规则

### 6.1 中文注释
- 所有注释必须使用中文
- 注释要清晰描述元素的功能和定位方式
- 包含元素的属性信息（text、content-desc、bounds）

### 6.2 注释示例

```javascript
/**
 * 连接硬件钱包按钮 - 主要的操作按钮（第一个大按钮）
 * content-desc: "连接硬件钱包"
 * text: "连接硬件钱包"
 * bounds: [122,1172][962,1303]
 * 定位方式：优先使用content-desc，更稳定
 */
get connectHardwareWalletBtn() {
  return api.by.xpath(
    '//android.widget.Button[@content-desc="连接硬件钱包" or @text="连接硬件钱包"]',
  );
}
```

## 7. 操作方法规则

### 7.1 必需方法

每个页面对象应该包含以下方法：

```javascript
/**
 * 验证页面是否已加载
 * 通过检查关键元素是否存在来判断
 */
async verifyPageLoaded() {
  await this.waitEntryPage();
  await this.assertCurrentPage();
}
```

### 7.2 操作方法规范

- 所有操作方法必须是 `async` 函数
- 使用 `api.tap()` 进行点击操作
- 使用 `api.getText()` 获取文本内容
- 方法要有清晰的 JSDoc 注释

示例：
```javascript
/**
 * 点击返回按钮
 */
async clickBackButton() {
  await api.tap(this.backButton);
}

/**
 * 获取页面标题文本
 * @returns {Promise<string>} 页面标题文本
 */
async getPageTitle() {
  return await api.getText(this.pageTitle);
}
```

## 8. 最佳实践

### 8.1 元素定位
- ✅ 优先使用稳定的属性（text、content-desc）
- ✅ 使用组合定位提高兼容性
- ✅ 在注释中记录 bounds 信息，便于调试
- ❌ 避免使用易变的索引定位（如 `[1]`、`[2]`）

### 8.2 代码组织
- ✅ 按功能区域分组元素
- ✅ 使用清晰的分隔注释
- ✅ 保持代码结构一致
- ✅ 提供完整的操作方法

### 8.3 可维护性
- ✅ 注释要详细，包含定位策略说明
- ✅ 方法命名要清晰表达功能
- ✅ 遵循统一的代码风格
- ✅ 定期检查元素定位的稳定性

## 9. 多语言支持规则

### 9.1 多语言支持要求

**所有包含文本的元素都必须支持多语言定位**，包括但不限于：
- 页面标题
- 按钮文本
- 输入框 hint
- 卡片标题
- 描述文本

### 9.2 多语言定位方式

#### 方式一：在 getter 中直接支持多语言（推荐）

```javascript
/**
 * 页面标题 - "添加钱包" / "Add wallet"
 * text: "添加钱包" / "Add wallet"
 * 定位方式：使用文本内容定位，支持中英文
 */
get pageTitle() {
  return api.by.xpath(
    '//android.widget.TextView[@text="添加钱包" or @text="Add wallet"]',
  );
}
```

#### 方式二：在操作方法中使用多个定位策略（复杂场景）

当元素定位不稳定或需要多种定位方式时，在操作方法中实现多个定位策略：

```javascript
/**
 * 点击确认按钮
 * 尝试多个定位策略，找到第一个存在的元素就点击
 */
async clickConfirmButton() {
  const selectors = [
    // 策略1: 通过 resource-id 定位（最稳定）
    '//android.widget.Button[@resource-id="page-footer-confirm"]',
    // 策略2: 通过 content-desc 定位 - 中文
    '//android.widget.Button[@content-desc="确认"]',
    // 策略3: 通过 content-desc 定位 - 英文
    '//android.widget.Button[@content-desc="Confirm"]',
    // 策略4: 通过按钮内文本定位 - 中英文混合
    '//android.widget.Button[.//android.widget.TextView[@text="确认" or @text="Confirm"]]',
  ];

  // 依次尝试每个定位策略
  for (let i = 0; i < selectors.length; i++) {
    try {
      const selector = selectors[i];
      const element = api.by.xpath(selector);
      
      try {
        await api.platformChain
          .not()
          .ios()
          .run(async () => {
            await element.waitForDisplayed({ timeout: 2000 });
          });
        await api.platformChain
          .ios()
          .run(async () => {
            await element.waitForExist({ timeout: 2000 });
          });
        
        await api.tap(element);
        return; // 成功点击，退出方法
      } catch (waitError) {
        continue; // 元素不存在，继续尝试下一个策略
      }
    } catch (error) {
      continue; // 定位失败，继续尝试下一个策略
    }
  }

  throw new Error('无法找到确认按钮，已尝试所有定位策略');
}
```

### 9.3 多语言支持场景

#### 场景1：文本元素（TextView）
```javascript
// ✅ 正确：支持中英文
get pageTitle() {
  return api.by.xpath(
    '//android.widget.TextView[@text="添加钱包" or @text="Add wallet"]',
  );
}
```

#### 场景2：按钮元素（Button）
```javascript
// ✅ 正确：支持中英文 content-desc 和 text
get confirmButton() {
  return api.by.xpath(
    '//android.widget.Button[@content-desc="确认" or @content-desc="Confirm" or @text="确认" or @text="Confirm"]',
  );
}
```

#### 场景3：输入框 hint
```javascript
// ✅ 正确：支持中英文 hint
get nameInput() {
  return api.by.xpath(
    '//android.widget.EditText[@hint="账户名称" or @hint="Account name"]',
  );
}
```

#### 场景4：卡片元素（通过文本定位）
```javascript
// ✅ 正确：支持中英文文本定位
get watchAddressCard() {
  return api.by.xpath(
    '//android.view.ViewGroup[@clickable="true"]/android.widget.TextView[@text="观察地址" or @text="Watch-only address"]/..',
  );
}
```

### 9.4 多语言文本获取方式

从 XML 文件中获取多语言文本：
- 中文版本：`xmls/{module}/{pageName}Chinese.xml`（驼峰命名，如 addWallet.xml）
- 英文版本：`xmls/{module}/{pageName}English.xml`（驼峰命名，如 addWalletEnglish.xml）

对比两个 XML 文件中的相同元素，获取中英文文本。

## 10. 多个定位策略规则

### 10.1 何时使用多个定位策略

在以下情况下，**必须**在操作方法中实现多个定位策略：

1. **元素定位不稳定**：页面结构可能变化，单一定位方式容易失败
2. **多语言环境**：不同语言下元素属性可能不同
3. **动态内容**：元素位置或结构可能动态变化
4. **关键操作**：重要按钮或操作需要更高的成功率

### 10.2 定位策略优先级

多个定位策略应按以下优先级排序：

1. **resource-id 定位**（最稳定）
   ```javascript
   '//android.widget.Button[@resource-id="page-footer-confirm"]'
   ```

2. **content-desc 定位**（次稳定）
   ```javascript
   '//android.widget.Button[@content-desc="确认" or @content-desc="Confirm"]'
   ```

3. **文本定位**（相对稳定）
   ```javascript
   '//android.widget.Button[.//android.widget.TextView[@text="确认" or @text="Confirm"]]'
   ```

4. **相对路径定位**（易变，但作为备选）
   ```javascript
   '//android.view.ViewGroup[@clickable="true"]/android.widget.TextView[@text="观察地址"]/..'
   ```

5. **绝对路径定位**（最后备选）
   ```javascript
   '//android.widget.FrameLayout[...]/android.view.ViewGroup[...]/android.widget.Button[3]'
   ```

### 10.3 多个定位策略实现模板

```javascript
/**
 * 点击{元素名称}
 * 尝试多个定位策略，找到第一个存在的元素就点击
 */
async click{ElementName}() {
  // 定义多个定位策略
  const selectors = [
    // 策略1: 最稳定的定位方式（resource-id 或 content-desc）
    '//android.widget.Button[@resource-id="element-id"]',
    // 策略2: 多语言 content-desc 定位
    '//android.widget.Button[@content-desc="中文文本" or @content-desc="English Text"]',
    // 策略3: 多语言文本定位
    '//android.widget.Button[.//android.widget.TextView[@text="中文文本" or @text="English Text"]]',
    // 策略4: 相对路径定位
    '(//android.view.ViewGroup[@clickable="true"][.//android.widget.TextView[@text="中文文本" or @text="English Text"]])[1]',
    // 策略5: 绝对路径定位（最后备选）
    '//android.widget.FrameLayout[@resource-id="android:id/content"]/.../android.widget.Button[3]',
  ];

  // 依次尝试每个定位策略
  for (let i = 0; i < selectors.length; i++) {
    try {
      const selector = selectors[i];
      const element = api.by.xpath(selector);
      
      // 尝试等待元素显示（短超时）
      try {
        await api.platformChain
          .not()
          .ios()
          .run(async () => {
            await element.waitForDisplayed({ timeout: 2000 });
          });
        await api.platformChain
          .ios()
          .run(async () => {
            await element.waitForExist({ timeout: 2000 });
          });
        
        // 元素找到了，执行操作
        await api.tap(element);
        return; // 成功操作，退出方法
      } catch (waitError) {
        // 元素不存在，继续尝试下一个策略
        continue;
      }
    } catch (error) {
      // 定位失败，继续尝试下一个策略
      continue;
    }
  }

  // 所有策略都失败了，抛出错误
  throw new Error(`无法找到{元素名称}，已尝试所有定位策略`);
}
```

### 10.4 多个定位策略最佳实践

- ✅ **策略数量**：建议 5-8 个定位策略，覆盖不同定位方式
- ✅ **超时时间**：每个策略的等待超时设置为 2 秒，避免总耗时过长
- ✅ **错误处理**：所有策略失败后抛出明确的错误信息
- ✅ **注释说明**：每个策略都要有注释说明其定位方式
- ✅ **优先级排序**：按稳定性从高到低排序
- ❌ **避免重复**：不要使用完全相同的定位策略
- ❌ **避免过多**：不要超过 10 个策略，影响性能

### 10.5 多个定位策略示例

#### 示例1：按钮点击（支持多语言）
```javascript
async clickConfirmButton() {
  const selectors = [
    '//android.widget.Button[@resource-id="page-footer-confirm"]',
    '//android.widget.Button[@content-desc="确认" or @content-desc="Confirm"]',
    '//android.widget.Button[.//android.widget.TextView[@text="确认" or @text="Confirm"]]',
    '(//android.widget.Button[@resource-id="page-footer-confirm"])[last()]',
  ];
  // ... 实现代码
}
```

#### 示例2：卡片点击（支持多语言和多种定位方式）
```javascript
async clickAddExistingWalletCard() {
  const selectors = [
    // 绝对路径定位
    '//android.widget.FrameLayout[@resource-id="android:id/content"]/.../android.view.ViewGroup[2]',
    // 通过文本定位卡片 - 中文
    '//android.view.ViewGroup[@clickable="true"]/android.widget.TextView[@text="添加现有钱包"]/..',
    // 通过文本定位卡片 - 英文
    '//android.view.ViewGroup[@clickable="true"]/android.widget.TextView[@text="Add existing wallet"]/..',
    // 通过文本定位卡片 - 中英文混合
    '//android.view.ViewGroup[@clickable="true"][.//android.widget.TextView[@text="添加现有钱包" or @text="Add existing wallet"]]',
    // 通过标题文本定位父容器
    '(//android.widget.TextView[@text="添加现有钱包" or @text="Add existing wallet"])[1]/ancestor::android.view.ViewGroup[@clickable="true"][1]',
  ];
  // ... 实现代码
}
```

## 11. 示例模板

```javascript
import { api } from '@node-e2e/cli/api/index.js';
import Page from './base.js';

/**
 * 页面名称 - 页面功能描述
 * 从层级开始：//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[2]/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup
 */
class PageName extends Page {
  /**
   * 页面关键元素 - 用于判断页面是否加载完成
   */
  get keyElement() {
    return this.pageTitle;
  }

  // ========== 顶部导航栏元素 ==========

  /**
   * 页面标题 - 页面标题文本
   * text: "页面标题" / "Page Title"
   * bounds: [x1,y1][x2,y2]
   * 定位方式：使用文本内容定位，更稳定，支持中英文
   */
  get pageTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="页面标题" or @text="Page Title"]',
    );
  }

  /**
   * 返回按钮 - 左上角返回图标按钮
   * bounds: [x1,y1][x2,y2]
   * 定位方式：使用相对xpath从指定层级开始定位
   */
  get backButton() {
    return api.by.xpath('起始层级/android.widget.Button[1]');
  }

  // ========== 操作方法 ==========

  /**
   * 点击返回按钮
   */
  async clickBackButton() {
    await api.tap(this.backButton);
  }

  /**
   * 点击确认按钮
   * 尝试多个定位策略，找到第一个存在的元素就点击
   */
  async clickConfirmButton() {
    const selectors = [
      '//android.widget.Button[@resource-id="page-footer-confirm"]',
      '//android.widget.Button[@content-desc="确认" or @content-desc="Confirm"]',
      '//android.widget.Button[.//android.widget.TextView[@text="确认" or @text="Confirm"]]',
    ];

    for (let i = 0; i < selectors.length; i++) {
      try {
        const selector = selectors[i];
        const element = api.by.xpath(selector);
        
        try {
          await api.platformChain
            .not()
            .ios()
            .run(async () => {
              await element.waitForDisplayed({ timeout: 2000 });
            });
          await api.platformChain
            .ios()
            .run(async () => {
              await element.waitForExist({ timeout: 2000 });
            });
          
          await api.tap(element);
          return;
        } catch (waitError) {
          continue;
        }
      } catch (error) {
        continue;
      }
    }

    throw new Error('无法找到确认按钮，已尝试所有定位策略');
  }

  /**
   * 获取页面标题文本
   * @returns {Promise<string>} 页面标题文本
   */
  async getPageTitle() {
    return await api.getText(this.pageTitle);
  }

  /**
   * 验证页面是否已加载
   * 通过检查关键元素是否存在来判断
   */
  async verifyPageLoaded() {
    await this.waitEntryPage();
    await this.assertCurrentPage();
  }
}

export const pageName = new PageName();
```

## 12. 检查清单

创建页面对象时，请确保：

- [ ] 文件放在 `pages/` 目录下
- [ ] 文件命名符合 `{pageName}Page.js` 格式
- [ ] 类继承自 `Page` 基类
- [ ] 定义了 `keyElement` 属性
- [ ] 所有元素都有中文注释
- [ ] 注释包含 text/content-desc/bounds 信息
- [ ] 元素按功能区域分组
- [ ] 优先使用 text/content-desc 定位
- [ ] **所有文本元素都支持多语言定位**
- [ ] **关键操作方法实现了多个定位策略**
- [ ] 提供了必要的操作方法
- [ ] 包含 `verifyPageLoaded()` 方法
- [ ] 导出了页面实例

## 13. 相关文档

- **E2E 测试流程约定**（从 Home 进入钱包选择器、再走导入观察地址流程、数据源与随机取数）：见 `docs/E2E_FLOW_RULES.md`；Cursor 规则见 `.cursor/rules/e2e-add-watch-address-flow.mdc`。

---

**最后更新：** 2026-01-28
