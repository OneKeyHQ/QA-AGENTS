# Appium + Android 实时录制功能调研报告

## 📋 调研目标

基于 Appium 和 Android 开发一个实时录制功能，当用户点击元素时，自动将元素信息写入到对应的页面对象文件中，并封装好点击、input 等方法。

---

## ✅ 可行性分析

### 1. **技术可行性：高度可行**

#### 1.1 WebDriverIO Hook 机制
- ✅ **beforeCommand / afterCommand**: WebDriverIO 支持在命令执行前后拦截
- ✅ **可以获取**: 命令类型（click, setValue等）、元素对象、参数
- ✅ **可以获取元素属性**: 通过 `element.getAttribute()` 获取所有属性

#### 1.2 Appium UIAutomator2 能力
- ✅ **获取页面源码**: `driver.getPageSource()` 获取完整 XML
- ✅ **获取元素属性**: `element.getAttribute()` 获取 resource-id, text, content-desc, bounds 等
- ✅ **元素定位**: 支持 XPath, resource-id, accessibility-id 等多种定位方式

#### 1.3 项目现有基础
- ✅ 已有页面对象模式（Page Object Model）
- ✅ 已有统一的 API 封装（`api.tap`, `api.setValue` 等）
- ✅ 已有 WebSocket 通信机制（可用于实时通信）
- ✅ 已有录制屏幕功能（`startRecordingScreen`）

---

## 🎯 实现方案

### 方案一：基于 WebDriverIO Hook（推荐）

#### 核心思路
在 WebDriverIO 的 `beforeCommand` 和 `afterCommand` hooks 中拦截用户操作，获取元素信息并自动生成代码。

#### 实现步骤

1. **拦截命令**
```javascript
// packages/cli/confs/wdio.conf.js
beforeCommand: async function(commandName, args) {
  // 拦截 click, setValue 等操作
  if (['click', 'setValue', 'touchAction'].includes(commandName)) {
    const element = args[0]; // 第一个参数通常是元素
    if (element && element.elementId) {
      // 获取元素信息
      const elementInfo = await getElementInfo(element);
      // 记录到录制队列
      recordingQueue.push({
        action: commandName,
        element: elementInfo,
        timestamp: Date.now()
      });
    }
  }
}
```

2. **获取元素信息**
```javascript
async function getElementInfo(element) {
  const attributes = {};
  
  // 获取所有属性
  const resourceId = await element.getAttribute('resource-id');
  const text = await element.getAttribute('text');
  const contentDesc = await element.getAttribute('content-desc');
  const className = await element.getAttribute('class');
  const bounds = await element.getAttribute('bounds');
  const clickable = await element.getAttribute('clickable');
  
  // 获取页面源码定位路径
  const xpath = await generateXPath(element);
  
  return {
    resourceId,
    text,
    contentDesc,
    className,
    bounds,
    clickable,
    xpath,
    // 其他属性...
  };
}
```

3. **生成 XPath**
```javascript
async function generateXPath(element) {
  // 优先使用 resource-id
  if (resourceId) {
    return `//*[@resource-id="${resourceId}"]`;
  }
  
  // 使用 text
  if (text) {
    return `//*[@text="${text}"]`;
  }
  
  // 使用 content-desc
  if (contentDesc) {
    return `//*[@content-desc="${contentDesc}"]`;
  }
  
  // 生成相对 XPath（通过层级关系）
  return await generateRelativeXPath(element);
}
```

4. **自动生成页面对象代码**
```javascript
function generatePageObjectCode(elementInfo, action) {
  const elementName = generateElementName(elementInfo);
  const selector = generateSelector(elementInfo);
  
  // 生成 getter
  const getter = `
  /**
   * ${elementInfo.text || elementName}
   * ${elementInfo.bounds ? `bounds: ${elementInfo.bounds}` : ''}
   */
  get ${elementName}() {
    return api.by.xpath('${selector}');
  }`;
  
  // 生成方法
  const method = `
  /**
   * ${action === 'click' ? '点击' : action === 'setValue' ? '输入' : ''}${elementName}
   */
  async ${action === 'click' ? 'click' : 'input'}${capitalize(elementName)}() {
    ${action === 'click' 
      ? `await api.tap(this.${elementName});`
      : `await api.setValue(this.${elementName}, value);`
    }
  }`;
  
  return { getter, method };
}
```

5. **写入文件**
```javascript
async function appendToPageObjectFile(pageName, code) {
  const filePath = `pages/${pageName}Page.js`;
  const content = fs.readFileSync(filePath, 'utf8');
  
  // 智能插入代码（避免重复）
  if (!content.includes(code.getter)) {
    // 插入到合适的位置
    const newContent = insertCodeAtPosition(content, code);
    fs.writeFileSync(filePath, newContent);
  }
}
```

#### 优点
- ✅ 实现简单，基于现有 WebDriverIO 机制
- ✅ 不需要修改 Appium 或 Android 系统
- ✅ 可以获取完整的元素信息
- ✅ 可以实时生成代码

#### 缺点
- ⚠️ 只能拦截通过 WebDriverIO 执行的操作
- ⚠️ 无法拦截用户手动点击（需要配合其他方案）

---

### 方案二：基于 AccessibilityService（补充方案）

#### 核心思路
使用 Android AccessibilityService 监听所有点击事件，然后通过 Appium 获取元素信息。

#### 实现步骤

1. **创建 AccessibilityService**
```java
public class ClickRecorderService extends AccessibilityService {
    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getEventType() == AccessibilityEvent.TYPE_VIEW_CLICKED) {
            AccessibilityNodeInfo source = event.getSource();
            if (source != null) {
                // 获取元素信息
                String resourceId = source.getViewIdResourceName();
                String text = source.getText() != null ? source.getText().toString() : null;
                String contentDesc = source.getContentDescription() != null 
                    ? source.getContentDescription().toString() : null;
                
                // 通过 WebSocket 发送到录制服务
                sendToRecordingService(resourceId, text, contentDesc);
            }
        }
    }
}
```

2. **通过 Appium 获取元素**
```javascript
// 当收到点击事件时，通过 Appium 查找元素
async function findElementByClickEvent(event) {
  const pageSource = await driver.getPageSource();
  // 解析 XML，找到对应的元素
  const element = findElementInPageSource(pageSource, event);
  return element;
}
```

#### 优点
- ✅ 可以监听所有点击（包括手动点击）
- ✅ 不依赖 WebDriverIO

#### 缺点
- ⚠️ 需要开发 Android 应用
- ⚠️ 需要用户授权无障碍服务
- ⚠️ 可能存在时序问题（点击事件和页面状态不同步）

---

### 方案三：混合方案（最佳实践）

#### 核心思路
结合方案一和方案二：
- **主要使用方案一**：拦截 WebDriverIO 命令，自动生成代码
- **辅助使用方案二**：监听手动点击，提供"学习模式"

#### 工作流程

```
用户操作
  ↓
[方案一] WebDriverIO Hook 拦截
  ↓
获取元素信息
  ↓
生成代码片段
  ↓
询问用户确认
  ↓
写入页面对象文件
```

---

## 🛠️ 技术实现细节

### 1. 元素信息收集

需要收集的元素属性：
- `resource-id`: 最优先使用
- `text`: 文本内容
- `content-desc`: 内容描述
- `class`: 类名
- `bounds`: 位置信息
- `clickable`: 是否可点击
- `enabled`: 是否启用
- `selected`: 是否选中

### 2. 智能选择器生成策略

优先级顺序：
1. **resource-id** (最稳定)
2. **text** (如果唯一)
3. **content-desc** (如果唯一)
4. **XPath 相对路径** (通过层级关系)
5. **XPath 绝对路径** (最后选择)

### 3. 元素命名规则

```javascript
function generateElementName(elementInfo) {
  // 优先使用 resource-id
  if (elementInfo.resourceId) {
    return camelCase(elementInfo.resourceId.split('/').pop());
  }
  
  // 使用 text
  if (elementInfo.text) {
    return camelCase(elementInfo.text);
  }
  
  // 使用 content-desc
  if (elementInfo.contentDesc) {
    return camelCase(elementInfo.contentDesc);
  }
  
  // 使用类名 + 序号
  return `${elementInfo.className}${index}`;
}
```

### 4. 页面识别

需要识别当前页面，以确定写入哪个页面对象文件：

```javascript
async function detectCurrentPage() {
  // 方法1: 通过页面关键元素识别
  const pageSource = await driver.getPageSource();
  const pageTitle = extractPageTitle(pageSource);
  
  // 方法2: 通过 Activity 名称（Android）
  const currentActivity = await driver.getCurrentActivity();
  
  // 方法3: 通过 URL（Web）
  const url = await driver.getUrl();
  
  return mapToPageObjectFile(pageTitle, currentActivity, url);
}
```

---

## 📦 需要开发的功能模块

### 1. 录制服务模块 (`packages/cli/services/recording.service.js`)

```javascript
class RecordingService {
  constructor() {
    this.isRecording = false;
    this.recordedActions = [];
    this.currentPage = null;
  }
  
  startRecording() {
    this.isRecording = true;
  }
  
  stopRecording() {
    this.isRecording = false;
    return this.generatePageObjectCode();
  }
  
  async recordAction(action, element) {
    if (!this.isRecording) return;
    
    const elementInfo = await this.getElementInfo(element);
    const pageName = await this.detectCurrentPage();
    
    this.recordedActions.push({
      page: pageName,
      action,
      element: elementInfo,
      timestamp: Date.now()
    });
    
    // 实时生成代码预览
    await this.previewCode(pageName, action, elementInfo);
  }
  
  async generatePageObjectCode() {
    // 按页面分组
    const actionsByPage = groupBy(this.recordedActions, 'page');
    
    // 为每个页面生成代码
    for (const [pageName, actions] of Object.entries(actionsByPage)) {
      await this.writeToPageObjectFile(pageName, actions);
    }
  }
}
```

### 2. Hook 集成 (`packages/cli/confs/wdio.conf.js`)

```javascript
import { recordingService } from '../services/recording.service.js';

export const config = {
  // ...
  beforeCommand: async function(commandName, args) {
    if (recordingService.isRecording) {
      await recordingService.beforeCommand(commandName, args);
    }
  },
  
  afterCommand: async function(commandName, args, result) {
    if (recordingService.isRecording) {
      await recordingService.afterCommand(commandName, args, result);
    }
  }
};
```

### 3. CLI 命令 (`packages/cli/cli/commands/record.js`)

```javascript
export const command = {
  command: 'record',
  describe: 'Start recording user interactions',
  builder: {
    'page-name': {
      describe: 'Target page object file name',
      type: 'string'
    },
    'output': {
      describe: 'Output directory',
      type: 'string',
      default: './pages'
    }
  },
  handler: async (argv) => {
    recordingService.startRecording({
      pageName: argv['page-name'],
      outputDir: argv.output
    });
    
    console.log('Recording started. Press Ctrl+C to stop and generate code.');
    
    // 监听 Ctrl+C
    process.on('SIGINT', async () => {
      await recordingService.stopRecording();
      process.exit(0);
    });
  }
};
```

---

## 🎨 用户体验设计

### 1. 录制模式

```bash
# 启动录制模式
yarn cli record --page-name=onboarding

# 或者交互式选择页面
yarn cli record --interactive
```

### 2. 实时预览

在录制过程中，实时显示生成的代码预览：

```
[Recording] Click detected on element:
  - Resource ID: onboarding/create-wallet-btn
  - Text: "创建钱包"
  - Generated code:
  
  get createWalletBtn() {
    return api.by.id('onboarding/create-wallet-btn');
  }
  
  async clickCreateWalletBtn() {
    await api.tap(this.createWalletBtn);
  }
  
  [✓] Add to page object  [✗] Skip
```

### 3. 代码生成选项

- **自动生成**: 立即写入文件
- **确认后生成**: 每次操作后询问
- **批量生成**: 录制结束后统一生成

---

## ⚠️ 挑战与限制

### 1. 元素定位稳定性
- **问题**: 动态生成的 resource-id 可能不稳定
- **解决**: 使用多种定位策略，生成多个备选方案

### 2. 页面识别
- **问题**: 如何准确识别当前页面
- **解决**: 结合页面标题、Activity 名称、关键元素

### 3. 代码重复
- **问题**: 可能生成重复的元素定义
- **解决**: 检测已存在的元素，智能合并

### 4. 元素命名
- **问题**: 自动生成的名称可能不够语义化
- **解决**: 提供命名建议，允许用户修改

### 5. 复杂操作
- **问题**: 滚动、长按等复杂操作难以自动生成
- **解决**: 提供模板和示例代码

---

## 📊 对比现有方案

### Appium Inspector
- ✅ 可以查看元素属性
- ❌ 需要手动复制选择器
- ❌ 不能自动生成页面对象代码

### 本方案
- ✅ 自动拦截操作
- ✅ 自动生成选择器
- ✅ 自动生成页面对象代码
- ✅ 实时预览和确认

---

## 🚀 实施建议

### 阶段一：MVP（最小可行产品）
1. ✅ 实现 WebDriverIO Hook 拦截
2. ✅ 获取元素基本信息
3. ✅ 生成简单的 getter 和方法
4. ✅ 写入页面对象文件

### 阶段二：增强功能
1. ✅ 智能选择器生成
2. ✅ 页面自动识别
3. ✅ 代码去重和优化
4. ✅ 交互式确认

### 阶段三：高级功能
1. ✅ AccessibilityService 支持手动点击
2. ✅ 代码模板自定义
3. ✅ 批量操作支持
4. ✅ 可视化预览

---

## 📚 参考资源

1. **WebDriverIO Hooks**: https://webdriver.io/docs/options/#hooks
2. **Appium UIAutomator2**: https://appium.github.io/appium.io/docs/en/drivers/android-uiautomator2/
3. **Android AccessibilityService**: https://developer.android.com/guide/topics/ui/accessibility/service
4. **Appium Inspector**: https://appium.github.io/appium-inspector/

---

## ✅ 结论

**可行性：高度可行** ✅

基于 WebDriverIO Hook 机制可以实现实时录制功能，技术方案成熟，实施难度中等。

**推荐方案**：使用 WebDriverIO Hook 拦截命令，结合智能选择器生成和代码自动写入，可以很好地满足需求。

**下一步行动**：
1. 实现 MVP 版本
2. 测试基本功能
3. 根据反馈迭代优化
