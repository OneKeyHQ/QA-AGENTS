# 实时录制功能使用指南

## 📋 功能概述

实时录制功能可以**监听你在设备上的手动点击操作**，自动检测被点击的元素，并生成页面对象代码。

**重要**：这个功能监听的是你在**设备上手动点击的元素**，而不是测试代码中的操作。

---

## 🚀 快速开始

**想「走一遍新流程」生成/更新 Page？** 可直接用下面的「方式一」：运行一个录制用例，在设备上手动点击要记录的元素，结束后会自动生成或追加到 `pages/<pageName>Page.js`。单页用 `recordManualClicks.e2e.js`，多页用 `recordMultiplePages.e2e.js`。详细步骤见 [元素定位策略 - 录制+轮询操作步骤](./docs/ELEMENT_LOCATOR_STRATEGY.md#221-如何用录制--轮询走一遍新流程生成或更新-page)。

### 方式一：集成到测试文件中（推荐）

在测试文件中启动录制：

```javascript
import { recordingService } from '@node-e2e/cli/services/recording.service.js';
import { pages } from '../config/setup.js';

describe('Record Manual Clicks', () => {
  before(async () => {
    // 等待App初始化
    await api.waitUntilAppInit();
    
    // 启动录制
    await recordingService.startRecording({
      pageName: 'onboarding',
      autoGenerate: true
    });
    
    console.log('✅ Recording started! Click elements on the device now...');
  });

  it('Record clicks', async () => {
    // 这里不需要写任何测试代码
    // 只需要在设备上手动点击元素
    // 系统会自动检测并记录
    
    // 等待一段时间，让你有时间点击元素
    await api.pause(60000); // 等待60秒
  });

  after(async () => {
    // 停止录制并生成代码
    await recordingService.stopRecording();
  });
});
```

运行测试：

```bash
yarn test:android --test-case ./test/record-clicks.e2e.js
```

### 方式二：独立运行录制服务

**注意**：这种方式需要先有一个活动的WebDriverIO session。

```bash
# 1. 先启动一个测试来建立session（在终端1）
yarn test:android --test-case ./test/your-test.e2e.js

# 2. 在测试运行期间，在另一个终端启动录制（终端2）
yarn cli record --platform android --page-name onboarding --auto-generate

# 3. 在设备上手动点击元素
# 4. 按 Ctrl+C 停止录制并生成代码
```

---

## 🎯 工作原理

1. **轮询检测**：系统定期（每500ms）获取页面源码
2. **状态对比**：对比前后页面状态，找出状态变化的元素
3. **元素识别**：通过Appium获取元素的详细信息（resource-id, text等）
4. **代码生成**：自动生成getter和方法代码
5. **文件写入**：将代码写入对应的页面对象文件

### 检测策略

系统通过以下方式检测被点击的元素：

- **状态变化**：检测元素的 `selected`, `focused`, `checked`, `enabled` 状态变化
- **新元素出现**：检测新出现的可点击元素（如弹窗、对话框）
- **页面变化**：对比页面源码的前后差异

---

## 📝 使用示例

### 示例1：录制onboarding页面

创建测试文件 `test/record-onboarding.e2e.js`：

```javascript
import { api } from '@node-e2e/cli/api/index.js';
import { recordingService } from '@node-e2e/cli/services/recording.service.js';

describe('Record Onboarding Page', () => {
  before(async () => {
    await api.waitUntilAppInit();
    
    await recordingService.startRecording({
      pageName: 'onboarding',
      autoGenerate: true
    });
    
    console.log('\n📱 Now click elements on the device!');
    console.log('   You have 60 seconds to click...\n');
  });

  it('Record manual clicks', async () => {
    // 等待60秒，让你有时间点击元素
    await api.pause(60000);
  });

  after(async () => {
    await recordingService.stopRecording();
  });
});
```

运行：

```bash
yarn test:android --test-case ./test/record-onboarding.e2e.js
```

在设备上点击元素，系统会自动记录。

### 示例2：录制多个页面

```javascript
describe('Record Multiple Pages', () => {
  before(async () => {
    await api.waitUntilAppInit();
  });

  it('Record onboarding page', async () => {
    await recordingService.startRecording({ pageName: 'onboarding' });
    await api.pause(30000); // 30秒
    await recordingService.stopRecording();
  });

  it('Record add wallet page', async () => {
    // 导航到添加钱包页面
    await onboardingPage.clickRightSideButton();
    
    await recordingService.startRecording({ pageName: 'addWallet' });
    await api.pause(30000); // 30秒
    await recordingService.stopRecording();
  });
});
```

---

## ⚙️ 配置选项

### startRecording 参数

```javascript
await recordingService.startRecording({
  pageName: 'onboarding',        // 页面名称（可选，会自动检测）
  outputDir: './pages',          // 输出目录（默认：./pages）
  autoGenerate: true,            // 自动生成代码（默认：false）
  pollingInterval: 500           // 轮询间隔，毫秒（默认：500）
});
```

### CLI 参数

```bash
yarn cli record \
  --platform android \
  --page-name onboarding \
  --output ./pages \
  --auto-generate
```

---

## 📦 生成的代码格式

### Getter定义

```javascript
/**
 * createWalletBtn
 * text: "创建钱包", resource-id: "onboarding/create-wallet-btn"
 */
get createWalletBtn() {
  return api.by.id('createWalletBtn');
}
```

### 操作方法

```javascript
/**
 * 点击createWalletBtn
 */
async clickCreateWalletBtn() {
  await api.tap(this.createWalletBtn);
}
```

---

## 🔍 选择器生成策略

系统会按以下优先级生成选择器：

1. **resource-id** (Android) / **name** (iOS) - 最稳定
2. **text** - 如果文本唯一且有意义
3. **content-desc** - 内容描述
4. **XPath相对路径** - 通过类名和位置
5. **XPath绝对路径** - 最后选择

---

## ⚠️ 注意事项

1. **需要WebDriverIO session**：录制功能需要活动的WebDriverIO session才能工作
2. **轮询延迟**：由于使用轮询方式，可能有500ms的延迟
3. **元素识别**：某些动态元素可能无法准确识别
4. **页面识别**：如果未指定 `pageName`，系统会尝试自动识别，但可能不够准确
5. **代码去重**：系统会自动检测已存在的元素，避免重复生成

---

## 🐛 故障排除

### 问题1: "No active WebDriverIO session found"

**原因**：没有活动的WebDriverIO session

**解决方案**：
- 确保先运行一个测试来建立session
- 或者将录制集成到测试文件中

### 问题2: 没有检测到点击 / 点击了但没有任何文件更新

**原因**：原先只靠「同一元素的 selected/focused/checked 变化」或「新出现的可点击元素」来识别点击；很多按钮点击后并不会在 DOM 里改变这些属性，导致漏检。

**解决方案**：
- **使用最新版录制逻辑**：已增加兜底策略——当页面源码发生明显变化时，会记录「上一帧」中所有可点击且带定位属性的元素，通常能录到刚点过的按钮。
- **尽量点会改变页面的操作**：例如点「下一步」「确定」等会跳转或关闭弹窗的按钮，这样页面 DOM 会变，更容易触发检测或兜底。
- **开启 debug**：在 `startRecording` 里加上 `debug: true`，控制台会输出轮询与检测日志，便于排查。
- 可适当减小 `pollingInterval`（如 300），点击后稍等约 1 秒再点下一个。

### 问题3: 检测到错误的元素

**原因**：页面变化太快，检测到了其他元素

**解决方案**：
- 点击后等待一下
- 一次只点击一个元素
- 检查生成的代码，手动调整

### 问题4: 页面识别不准确

**解决方案**：使用 `pageName` 参数明确指定页面名称

---

## 💡 最佳实践

1. **一次录制一个页面**：避免混淆，提高准确性
2. **明确页面名称**：使用 `pageName` 参数
3. **点击有明显反馈的元素**：按钮、链接等，避免点击空白区域
4. **点击后等待**：给系统时间检测变化
5. **检查生成的代码**：生成后检查代码质量，特别是元素命名
6. **逐步录制**：不要一次性点击太多元素

---

## 📚 相关文档

- [调研报告](./RECORDING_RESEARCH.md) - 详细的技术调研
- [页面对象模式](./POM_RULES.md) - 页面对象编写规范
- [架构指南](./ARCHITECTURE_GUIDE.md) - 项目架构说明

---

## 🎉 示例输出

```
🎬 Recording started. You can now manually click elements on the device.
   The system will automatically detect and record your clicks.

🔄 Starting polling method to detect clicks...
   Polling interval: 500ms

📌 [onboarding] CLICK detected:
   Element: createWalletBtn
   Text: "创建钱包"
   Resource ID: onboarding/create-wallet-btn
   Selector: api.by.id('createWalletBtn')
   Generated method: clickCreateWalletBtn()

📌 [onboarding] CLICK detected:
   Element: continueWithGoogleBtn
   Text: "使用 Google 继续"
   Resource ID: onboarding/continue-google-btn
   Selector: api.by.id('continueWithGoogleBtn')
   Generated method: clickContinueWithGoogleBtn()

🛑 Stopping recording...
📝 Recording stopped. Total actions: 2

✅ Generated code in onboardingPage.js
   - Added 2 getters
   - Added 2 methods
✅ Code generation completed!
```
