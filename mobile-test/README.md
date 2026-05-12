# node-e2e

基于 webdriveio 为 React Native、Web、移动端（iOS、Android）,桌面端（Electron）,其他基于屏截图与 usb touch 指令设备 的 E2E 测试框架。
实现一份用例多端执行，支持测试报告，性能报告，录屏，视觉基线。

## 目录

- [前置条件](#前置条件)
- [安装](#安装)
- [环境变量](#环境变量)
- [文件结构](#文件结构)
- [测试执行](#测试执行)
- [可视化](#可视化)
- [功能](#功能)
- [e2e.js 示例](#e2ejs-示例)
- [核心概念](#核心概念)
- [自动化测试 API](#自动化测试-api)
- [许可](#许可)

## 前置条件

在开始使用本测试框架之前，请确保已安装并配置以下前置条件：

1. **Node.js**:

   - 安装 [Node.js](https://nodejs.org/) (推荐最新稳定版本)。
   - 验证安装：在终端运行 `node -v`。

2. **Appium**:

   - 全局安装 Appium：`npm install -g appium`。
   - 验证安装：运行 `appium -v`。

3. **WebDriverIO CLI**:

   - 全局安装 WebDriverIO 命令行工具：`npm install -g @wdio/cli`。

4. **多端配置**:

   - [Appium 文档](https://appium.io/)
   - [WebDriverIO 文档](https://webdriver.io/)

5. **本地调试app**
   - 需要到 e2e 流水线下载对应的包，`isE2E`变量影响指纹解锁功能。会导致流程中断、开发者功能不能使用。

## 安装

使用以下命令安装框架：

```bash
// 安装 Node.js 18+
https://nodejs.org/dist/latest-v18.x/node-v18.19.0-darwin-arm64.tar.gz

// 克隆仓库并安装依赖
git clone git@github.com:OneKeyHQ/node-e2e.git
yarn install

// 如需运行 Web UI
yarn web

```

## 项目结构

```plaintext
node-e2e/
|-- allure-report/ #allure 报告相关
|-- allure-results/ #allure 报告相关
|-- artifacts/ # 运行使用的chromedriver
|-- const/ # 不同端不同场景timeout
|-- dataset/ # 用例使用到的input 数据，后续可以进行fuzzing test
|-- helpers/ # 页面操作聚合，
|-- packages/ # 存放测试用例链的目录
| |-- cli #  运行框架 启动webdirveio
| |-- driver # appium 自定义driver 用于触屏点击
| |-- web # 可视化图片元素识别
|-- pages/ # 应用page model
|-- test/ # 应用测试用例
|-- tmp/ # 视觉基线数据
|-- package.json
|-- README.md
```

## 环境变量

环境变量用于配置不同平台的测试设置

### 示例环境变量文件

#### .env

```
LOG_LEVEL=debug  //日志
SPECS=../test/2/*.e2e.js //用例文件

# Allure 报告配置（可选）
ALLURE_REALTIME_REPORT=true  // 启用实时报告（默认：true），设置为 false 则测试完成后才生成报告
ALLURE_RESULTS_DIR=allure-results  // Allure 结果目录（默认：allure-results）
ALLURE_REPORT_PORT=5050  // 实时报告服务器端口（可选，默认随机）
ALLURE_AUTO_OPEN=true  // 是否自动打开浏览器（默认：true）
```

#### .env.android.example

```
APPIUM_DEVICENAME=Pixel_6
APPIUM_APPPACKAGE=xx.xx.dev
APPIUM_APPACTIVITY=xx.xx.MainActivity
APPIUM_APP=/path/artifacts/app-direct-debug.apk
APPIUM_PORT=4728

```

#### .env.electron

```
APPIUM_APPBINARYPATH=/path/node-e2e/aritifacts/xx.app/Contents/MacOS/xx
APPIUM_CHROMEDRIVER=/path/node-e2e/aritifacts/chromedriver
```

#### .env.ext.example

```
LOAD_EXTENSION=/path/node-e2e/aritifacts/chrome/
```

#### .env.ios.example

```
APPIUM_PLATFORMVERSION=16.7.1
APPIUM_XCODEORGID=
APPIUM_BUNDLEID=
APPIUM_UDID=
APPIUM_APP=/path/node-e2e/aritifacts/OneKeyWallet.app
APPIUM_PORT=4728

```

#### .env.web.example

```
BASEURL=http://localhost:3000/
```

## test 执行

使用以下命令来运行测试用例：

```bash

# 运行 Web （暂时不支持）

yarn test:web

# 运行 iOS

yarn test:ios

# 运行 Android

yarn test:android

# 运行桌面端

yarn test:electron

# 运行插件端

yarn test:ext
# 可视化

npm run web

```

## 功能

### 报告

使用 allure 显示用例执行报告，录屏与性能数据 通过生产 html 静态页面 attach 到用例中

#### 实时报告（默认启用）

测试框架默认启用实时报告功能，测试开始时会自动启动 Allure 服务器，报告会在测试运行过程中实时更新，无需等待测试完成即可查看测试进度和结果。

**特性：**
- ✅ 测试过程中实时更新报告状态
- ✅ 自动打开浏览器显示报告
- ✅ 无需等待测试完成即可查看结果
- ✅ 支持多设备并行测试时合并报告

**配置：**
在 `.env` 文件中设置以下环境变量：
- `ALLURE_REALTIME_REPORT=true` - 启用实时报告（默认：true）
- `ALLURE_REALTIME_REPORT=false` - 禁用实时报告，测试完成后才生成报告
- `ALLURE_REPORT_PORT=5050` - 指定报告服务器端口（可选）
- `ALLURE_AUTO_OPEN=false` - 禁用自动打开浏览器（默认：true）

**查看报告：**
- 实时模式下，报告会在测试开始时自动打开浏览器
- 如果浏览器未自动打开，查看控制台输出的 URL
- 报告会在测试过程中自动刷新，显示最新的测试状态

#### 多设备执行看板（多设备模式）

使用 `--multiDevice` 时会自动启动**执行看板**页面，动态展示：
- **设备**：当前执行该用例的设备 ID
- **用例**：测试文件名称
- **状态**：未执行 / 执行中 / 通过 / 失败

看板每 2 秒轮询更新，无需刷新页面。可通过环境变量 `LIVE_REPORT_PORT=5051` 指定看板端口（默认 5051）。

### 录屏

web/chrome 插件/electron 通过 rrweb 实现
ios/android 通过 appium 实现

### 性能报告

android - 通过 appium 实现，执行每一步操作后进行性能数据收集。
其他端 暂时未支持。
后续考虑使用

### 视觉测试

使用 webdriveio

## 自动化测试 API

框架基于 WebDriverIO 和 Appium 实现。

### 配置 (Config)

`config` 目录包含了针对不同端的预定义配置。如遇问题或需要进一步了解，可访问以下链接：

- [WebDriverIO 官网](https://webdriver.io/)
- [Appium 官网](https://appium.io/)
- [Appium UIAutomator2 Driver GitHub 仓库](https://github.com/appium/appium-uiautomator2-driver)
- [Appium XCUITest Driver GitHub 仓库](https://github.com/appium/appium-xcuitest-driver)

### 选择器 (Selector)

`const { by } = api; // 封装了两种类型的元素选择器`

单个元素选择：使用 `by.id("")`，通过 React Native testID 进行选择，已适配多端。
多元素选择：使用 `by.idsStartWith("")`，根据 ID 前缀选择多个元素。

需结合 WebDriverIO 的 `$` 和 `$$` 方法进行元素的单选和多选。例如：

`$('test');`
`$$('test-');`

相关文档：

- [WebDriverIO `$` 方法文档](https://webdriver.io/docs/api/browser/$)
- [WebDriverIO `$$` 方法文档](https://webdriver.io/docs/api/browser/$$)

### 操作 (Action)

`const { tap, longPress, switchContext, execute, waitUntil, pause } = api; // 提供了一系列操作函数`

tap：单击操作。
longPress：长按操作。
switchContext：测试 WebView 时切换至 WebView 或 Native 环境。
execute：执行 JavaScript 代码或 Appium 的 `mobile: xx` 命令。
waitUntil：在移动环境下执行等待函数，在 Web 环境下不执行。
pause：暂停执行操作。

### 断言 (Expect)

expect 使用 WebDriverIO 原生断言。

- 元素类断言：利用 WebDriverIO 提供的断言功能进行元素相关的测试。
- 基础类断言：使用 Jest 进行基础断言。

### webview

https://webkit.org/blog/13936/enabling-the-inspection-of-web-content-in-apps/

## 贡献

欢迎任何形式的贡献和建议。

## 许可

本项目使用 MIT 许可证。
