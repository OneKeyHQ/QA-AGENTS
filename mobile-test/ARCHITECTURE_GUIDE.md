# Node-E2E 项目架构与使用指南

## 📋 目录

1. [项目架构](#项目架构)
2. [如何编写和维护测试用例](#如何编写和维护测试用例)
3. [如何配置](#如何配置)
4. [Android设备执行测试用例](#android设备执行测试用例)

---

## 🏗️ 项目架构

### 整体架构

这是一个基于 **WebDriverIO** 和 **Appium** 的统一 E2E 测试框架，支持多端测试：
- **React Native** (iOS/Android)
- **Web** (浏览器)
- **Electron** (桌面端)
- **Chrome Extension** (插件端)
- **基于截图和USB触屏的设备**

### 核心设计理念

**一份用例，多端执行** - 通过统一的 API 和平台链式调用，实现跨平台测试代码复用。

### 目录结构详解

```
node-e2e/
├── packages/                    # 核心包目录
│   ├── cli/                     # 测试运行框架
│   │   ├── api/                 # 统一测试API封装
│   │   ├── cli/                 # 命令行工具
│   │   ├── confs/               # WebDriverIO配置文件
│   │   │   ├── wdio.conf.js     # 基础配置
│   │   │   ├── wdio.android.conf.js  # Android配置
│   │   │   ├── wdio.ios.conf.js       # iOS配置
│   │   │   ├── wdio.web.conf.js       # Web配置
│   │   │   └── ...
│   │   └── services/            # 自定义服务
│   │       ├── ocr.service.js   # OCR识别服务
│   │       ├── rrWebHttp.service.js  # 录屏服务
│   │       └── ...
│   ├── driver/                  # Appium自定义驱动（触屏点击）
│   └── web/                     # 可视化图片元素识别UI
│
├── pages/                       # 页面对象模型 (Page Object Model)
│   ├── base.js                 # 基础页面类
│   ├── onboarding/             # 引导流程页面
│   ├── explore/                # 探索页面
│   └── ...
│
├── helpers/                     # 业务操作封装
│   ├── onboardingHelper.js     # 引导流程操作
│   ├── exploreHelper.js        # 探索功能操作
│   └── ...
│
├── dataset/                     # 测试数据
│   ├── onboarding.js           # 引导流程数据
│   └── ...
│
├── test/                        # 测试用例文件
│   ├── onboarding.e2e.js       # 引导流程测试
│   └── ...
│
├── stories/                     # 步骤化测试用例
│   ├── 1/                       # 故事1
│   │   ├── 1.step.js           # 步骤1
│   │   └── ...
│   └── ...
│
├── const/                       # 常量定义（超时时间等）
├── config/                      # 测试配置
│   └── setup.js                # 测试环境初始化
└── util/                        # 工具函数
```

### 核心组件

#### 1. **API层** (`packages/cli/api/`)
提供统一的测试操作接口，屏蔽平台差异：

```javascript
import { api } from '@node-e2e/cli/api/index.js';

// 元素选择
api.by.id('test-id')              // 通过testID选择
api.by.idsStartWith('prefix-')    // 通过前缀选择多个

// 操作
api.tap(element)                  // 点击
api.longPress(element)            // 长按
api.setValue(element, value)      // 输入
api.back()                        // 返回

// 等待
api.waitUntilAppInit()            // 等待应用初始化
api.waitPageByElement(element)    // 等待页面元素

// 平台特定操作
api.platformChain
  .ios()
  .android()
  .run(async () => {
    // 仅在iOS和Android执行
  })
```

#### 2. **页面对象模型** (`pages/`)
封装页面元素和操作：

```javascript
// pages/onboarding/indexPage.js
class OnboardingPage extends Page {
  get createWalletBtn() {
    return api.by.id('create-wallet');
  }
  
  async clickCreateWalletBtn() {
    await api.tap(this.createWalletBtn);
  }
}
```

#### 3. **Helper层** (`helpers/`)
封装业务流程操作：

```javascript
// helpers/onboardingHelper.js
class OnboardingHelper {
  static async createWallet() {
    await onboardingPage.clickCreateWalletBtn();
    // ... 完整创建钱包流程
  }
}
```

#### 4. **数据集** (`dataset/`)
管理测试数据，支持参数化测试：

```javascript
// dataset/onboarding.js
export default {
  importPhrases: [
    {
      input: { phrases: 'word1 word2 ...' },
      output: {},
      name: 'phrase 12 words'
    }
  ]
}
```

---

## ✍️ 如何编写和维护测试用例

### 测试用例类型

项目支持两种测试用例格式：

#### 1. **传统Mocha测试用例** (`test/*.e2e.js`)

```javascript
import { api } from '@node-e2e/cli/api/index.js';
import { pages, OnboardingHelper } from '../config/setup.js';

describe('Onboarding', () => {
  before(async () => {
    await api.globalStore.clear();
    await api.waitUntilAppInit();
  });

  it('Create Software Wallet', async () => {
    await OnboardingHelper.createWallet();
    await app.expectNavToHomePage();
  });
});
```

#### 2. **步骤化测试用例** (`stories/*/step.js`)

```javascript
import { step } from '@node-e2e/cli';

step(
  { id: '1', describe: '初始化' },
  [],  // 前置步骤
  [],  // 后置步骤
  async (data, { platform, step, getStore, setStore, reporter }) => {
    await platform.ios().run(async () => {
      await browser.$('~无线局域网与蜂窝网络').click();
    });
    await browser.$("[data-testid='welcome_action__create_wallet']").click();
  }
);
```

### 编写测试用例的最佳实践

#### 1. **使用Page Object Model**

```javascript
// pages/homePage.js
import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';

class HomePage extends Page {
  get settingBtn() {
    return api.by.id('setting-btn');
  }
  
  async clickSettingBtn() {
    await api.tap(this.settingBtn);
  }
  
  async waitEntryPage() {
    await api.waitPageByElement(this.settingBtn);
  }
}

export const homePage = new HomePage();
```

#### 2. **使用Helper封装业务流程**

```javascript
// helpers/onboardingHelper.js
class OnboardingHelper {
  static async createWallet() {
    await onboardingPage.clickCreateWalletBtn();
    await setPasswordPage.savePassword(lockPassword);
    await beforeYouProceedPage.clickConfirmBtn();
    // ... 完整流程
  }
}
```

#### 3. **参数化测试**

```javascript
// 使用util.forEachAsync
it(
  'Import Wallet by phrases',
  util.forEachAsync(dataset.importPhrases, async ({ input, output }) => {
    await OnboardingHelper.importWalletByPhrases(input.phrases);
    await app.expectNavToHomePage();
  })
);

// 使用util.forEachParameterizeIt（支持清理）
util.forEachParameterizeIt(
  'Import Wallet with password',
  dataset.importPhrases,
  async ({ input, output }) => {
    await OnboardingHelper.importWalletByPhrases(input.phrases);
  },
  async () => {
    // 清理操作
    await DevHelper.clearPassword();
    await api.restartApp();
  }
);
```

#### 4. **平台特定操作**

```javascript
// 使用platformChain处理平台差异
await api.platformChain
  .ios()
  .android()
  .run(async () => {
    // 仅在iOS和Android执行
    await browser.startRecordingScreen();
  });

await api.platformChain
  .web()
  .ext()
  .run(async () => {
    // 仅在Web和Extension执行
    await browser.url(process.env.BASEURL);
  });
```

#### 5. **数据驱动测试**

```javascript
// dataset/onboarding.js
export default {
  importPhrases: [
    {
      input: {
        phrases: 'word1 word2 word3 ...'
      },
      output: {
        expectedAddress: '0x...'
      },
      name: '12 words phrase'
    }
  ]
}

// test/onboarding.e2e.js
util.forEachParameterizeIt(
  'Import by phrases',
  dataset.importPhrases,
  async ({ input, output }) => {
    await OnboardingHelper.importWalletByPhrases(input.phrases);
    // 验证output中的预期结果
  }
);
```

### 维护测试用例

#### 1. **元素选择器维护**

- 使用 `testID` 作为主要选择器（React Native）
- 在页面对象中统一管理选择器
- 避免硬编码选择器

#### 2. **测试数据维护**

- 将测试数据集中在 `dataset/` 目录
- 使用有意义的命名
- 支持多组测试数据

#### 3. **等待策略**

```javascript
// 应用级别等待
await api.waitUntilAppInit();

// 页面级别等待
await api.waitPageByElement(element);

// 接口级别等待
await api.waitReqByElement(element);

// 通用等待
await api.waitUntil(async () => {
  return await element.isDisplayed();
}, { timeout: 5000 });
```

#### 4. **错误处理**

```javascript
try {
  await someOperation();
} catch (error) {
  // 添加截图到报告
  const screenshot = await browser.takeScreenshot();
  api.reporter.addAttachment('Error Screenshot', screenshot, 'image/png');
  throw error;
}
```

---

## ⚙️ 如何配置

### 环境变量配置

项目使用 `.env` 文件进行配置，支持不同平台的环境变量文件。

#### 1. **基础配置** (`.env`)

```bash
# 日志级别
LOG_LEVEL=debug

# 测试用例文件（支持通配符）
SPECS=../test/onboarding.e2e.js
# 或
SPECS=../test/**/*.e2e.js
```

#### 2. **Android配置** (`.env.android`)

创建 `.env.android` 文件：

```bash
# 设备名称（通过 adb devices 查看）
APPIUM_DEVICENAME=Pixel_6

# 应用包名
APPIUM_APPPACKAGE=so.onekey.app.wallet

# 应用启动Activity
APPIUM_APPACTIVITY=so.onekey.app.wallet.MainActivity

# APK文件路径
APPIUM_APP=/path/to/artifacts/app-direct-debug.apk

# Appium端口（默认4723）
APPIUM_PORT=4728

# ChromeDriver路径（WebView测试需要）
CHROME_DRIVER=/path/to/chromedriver
```

#### 3. **iOS配置** (`.env.ios`)

```bash
# iOS版本
APPIUM_PLATFORMVERSION=16.7.1

# Xcode组织ID
APPIUM_XCODEORGID=YourTeamID

# Bundle ID
APPIUM_BUNDLEID=so.onekey.app.wallet

# 设备UDID（通过 xcrun simctl list devices 查看）
APPIUM_UDID=12345678-1234-1234-1234-123456789012

# APP文件路径
APPIUM_APP=/path/to/artifacts/OneKeyWallet.app

# Appium端口
APPIUM_PORT=4728
```

#### 4. **Web配置** (`.env.web`)

```bash
# 基础URL
BASEURL=http://localhost:3000/
```

#### 5. **Electron配置** (`.env.electron`)

```bash
# Electron应用二进制路径
APPIUM_APPBINARYPATH=/path/to/app.app/Contents/MacOS/app

# ChromeDriver路径
APPIUM_CHROMEDRIVER=/path/to/chromedriver
```

#### 6. **Extension配置** (`.env.ext`)

```bash
# Chrome扩展路径
LOAD_EXTENSION=/path/to/chrome-extension/
```

### WebDriverIO配置

配置文件位于 `packages/cli/confs/` 目录：

- `wdio.conf.js` - 基础配置
- `wdio.android.conf.js` - Android特定配置
- `wdio.ios.conf.js` - iOS特定配置
- 等等...

主要配置项：

```javascript
export const config = {
  runner: 'local',
  maxInstances: 1,
  logLevel: process.env.LOG_LEVEL,
  framework: 'mocha',
  reporters: [['allure', { outputDir: 'allure-results' }]],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000 * 60,  // 1小时超时
  },
  // ...
};
```

### 前置条件配置

#### 1. **安装Node.js**
```bash
# 推荐Node.js 18+
node -v
```

#### 2. **安装Appium**
```bash
npm install -g appium
appium -v
```

#### 3. **安装WebDriverIO CLI**
```bash
npm install -g @wdio/cli
```

#### 4. **Android环境**
- 安装Android SDK
- 配置ADB环境变量
- 连接设备或启动模拟器
- 验证设备连接：`adb devices`

#### 5. **iOS环境**
- 安装Xcode
- 安装CocoaPods
- 配置开发者证书
- 启动模拟器或连接真机

---

## 📱 Android设备执行测试用例

### 前置准备

#### 1. **检查Android设备连接**

```bash
# 查看连接的设备
adb devices

# 应该看到类似输出：
# List of devices attached
# emulator-5554    device
# 或
# ABC123XYZ        device
```

#### 2. **获取设备信息**

```bash
# 获取设备名称
adb shell getprop ro.product.model

# 获取Android版本
adb shell getprop ro.build.version.release

# 获取应用包名（如果应用已安装）
adb shell pm list packages | grep onekey
```

#### 3. **准备APK文件**

- 从CI/CD流水线下载E2E专用APK（包含`isE2E`变量）
- 或使用本地构建的debug版本
- 将APK放在 `artifacts/` 目录

#### 4. **配置环境变量**

创建 `.env.android` 文件：

```bash
# 设备名称（从 adb devices 获取）
APPIUM_DEVICENAME=Pixel_6

# 应用包名
APPIUM_APPPACKAGE=so.onekey.app.wallet

# 应用启动Activity
APPIUM_APPACTIVITY=so.onekey.app.wallet.MainActivity

# APK文件路径（绝对路径或相对路径）
APPIUM_APP=/Users/onekey/Documents/UI自动化/node-e2e/artifacts/app-direct-debug.apk

# Appium端口（默认4723，如果端口冲突可修改）
APPIUM_PORT=4728
```

创建 `.env` 文件：

```bash
# 日志级别
LOG_LEVEL=info

# 测试用例文件
SPECS=../test/onboarding.e2e.js
# 或运行所有测试
SPECS=../test/**/*.e2e.js
```

### 执行测试

#### 方法1：使用Yarn脚本（推荐）

```bash
# 在项目根目录执行
yarn test:android
```

#### 方法2：使用CLI命令

```bash
# 运行所有测试用例
cd packages/cli
yarn android

# 或指定特定测试用例
yarn android --test-case ../test/onboarding.e2e.js
```

#### 方法3：直接使用CLI工具

```bash
# 从项目根目录
./packages/cli/cli/index.js test --platform android --framework wdio

# 指定测试用例
./packages/cli/cli/index.js test --platform android --framework wdio --test-case ./test/onboarding.e2e.js
```

### 执行流程

1. **加载环境变量** - 自动加载 `.env` 和 `.env.android`
2. **启动Appium服务** - 在指定端口启动Appium服务器
3. **安装/启动应用** - 如果应用未安装则安装，然后启动应用
4. **执行测试用例** - 运行指定的测试文件
5. **生成报告** - 测试完成后自动生成Allure报告

### 查看测试结果

#### 1. **控制台输出**

测试执行过程中会在控制台显示：
- 测试用例执行状态
- 错误信息
- 日志输出

#### 2. **Allure报告**

测试完成后会自动：
- 生成Allure报告到 `allure-results/`
- 在浏览器中打开报告

也可以手动查看：

```bash
# 生成报告
allure generate allure-results --clean

# 打开报告
allure open
```

报告包含：
- 测试用例执行结果
- 执行时间
- 录屏视频（Android/iOS）
- 性能数据（Android：CPU、内存、网络、电池）
- 截图
- 日志

### 常见问题排查

#### 1. **设备未连接**

```bash
# 检查设备
adb devices

# 如果显示 unauthorized，在设备上允许USB调试
# 如果显示 offline，尝试：
adb kill-server
adb start-server
adb devices
```

#### 2. **Appium启动失败**

```bash
# 检查端口是否被占用
lsof -i :4728

# 手动启动Appium查看错误
appium --port 4728
```

#### 3. **应用安装失败**

- 检查APK路径是否正确
- 检查APK是否损坏
- 检查设备存储空间
- 尝试手动安装：`adb install -r /path/to/app.apk`

#### 4. **元素找不到**

- 检查应用是否正确启动
- 检查testID是否正确
- 增加等待时间
- 使用 `browser.takeScreenshot()` 查看当前页面

#### 5. **权限问题**

在 `wdio.android.conf.js` 中已配置：
```javascript
'appium:autoGrantPermissions': 'true'
```

如果仍有问题，可以手动授权：
```bash
adb shell pm grant so.onekey.app.wallet android.permission.CAMERA
```

### 调试技巧

#### 1. **增加日志级别**

在 `.env` 中设置：
```bash
LOG_LEVEL=debug
```

#### 2. **暂停执行**

在测试代码中使用：
```javascript
await api.pause(5000);  // 暂停5秒
```

#### 3. **截图调试**

```javascript
const screenshot = await browser.takeScreenshot();
api.reporter.addAttachment('Debug Screenshot', screenshot, 'image/png');
```

#### 4. **查看元素信息**

```javascript
const element = await browser.$(api.by.id('test-id'));
console.log('Element text:', await api.getText(element));
console.log('Element displayed:', await element.isDisplayed());
```

### 性能监控

Android测试会自动收集性能数据：
- **CPU使用率** - 图表展示
- **内存使用** - 图表展示
- **网络流量** - 图表展示
- **电池状态** - 图表展示

这些数据会在Allure报告中以HTML图表形式展示。

---

## 📚 总结

### 核心优势

1. **跨平台统一** - 一份代码多端执行
2. **易于维护** - Page Object Model + Helper模式
3. **数据驱动** - 支持参数化测试
4. **完整报告** - Allure报告 + 录屏 + 性能数据
5. **灵活配置** - 环境变量配置，支持多环境

### 快速开始检查清单

- [ ] 安装Node.js 18+
- [ ] 安装Appium和WebDriverIO CLI
- [ ] 配置Android/iOS开发环境
- [ ] 连接测试设备
- [ ] 准备测试APK/APP
- [ ] 配置环境变量文件
- [ ] 运行测试用例
- [ ] 查看Allure报告

---

**更多信息请参考：**
- [WebDriverIO文档](https://webdriver.io/)
- [Appium文档](https://appium.io/)
- 项目README.md
