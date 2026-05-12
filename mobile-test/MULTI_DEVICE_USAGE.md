# 多设备并发执行测试用例使用指南

## 功能概述

该功能模块允许您将测试用例自动分配给多个Android设备，并并发执行，从而大幅提升测试执行效率。

## 核心功能

1. **自动检测设备**：通过 `adb devices` 命令自动获取所有已连接的Android设备
2. **智能分配**：将测试用例文件轮询分配给不同设备，确保负载均衡
3. **并发执行**：每个设备在独立的进程中运行测试，互不干扰
4. **端口管理**：自动为每个设备分配不同的Appium端口（默认从4723开始递增）

## 使用方法

### 基本用法

```bash
# 启用多设备模式执行测试（静态分配）
yarn cli test --platform android --framework wdio --test-case ./test/**/*.e2e.js --multiDevice

# 启用多设备模式 + 动态分配（推荐）
yarn cli test --platform android --framework wdio --test-case ./test/**/*.e2e.js --multiDevice --dynamic

# 或者使用npm/yarn脚本
yarn test:android --multiDevice --dynamic --test-case ./test/**/*.e2e.js
```

### 参数说明

- `--multiDevice`: 启用多设备并发执行模式（仅Android平台支持）
- `--dynamic`: 启用动态任务分配（设备完成后自动获取新任务，推荐使用）
- `--test-case`: 指定测试用例文件或模式（支持glob模式）
- `--basePort`: 指定基础端口号（默认4723），每个设备会在此基础上递增
- `--deviceSuites`: **按设备指定用例集**。逗号分隔的用例 pattern，与设备顺序一一对应（第 1 台设备跑第 1 个 pattern，第 2 台跑第 2 个…）。设备数量须与 pattern 数量一致。

### 示例

```bash
# 执行所有测试用例，自动分配给所有可用设备
yarn cli test --platform android --framework wdio --multiDevice

# 执行指定目录下的测试用例（例如：test/addressBook下有10个测试文件）
yarn cli test --platform android --framework wdio --test-case ./test/addressBook/*.e2e.js --multiDevice

# 执行单个测试文件（会被分配给第一个可用设备）
yarn cli test --platform android --framework wdio --test-case ./test/addressBook.e2e.js --multiDevice

# 指定基础端口为4800
yarn cli test --platform android --framework wdio --multiDevice --basePort 4800

# 两台设备分别跑不同用例集：设备1 跑 addressBook，设备2 跑 onboarding（顺序以 adb devices 为准）
yarn cli test --platform android --framework wdio --multiDevice \
  --deviceSuites "./test/addressBook/*.e2e.js,./test/onboarding/*.e2e.js"
```

### 分配示例

假设您连接了5台设备，`test/addressBook`目录下有10个测试文件：

**静态分配模式（默认）：**
```bash
yarn cli test --platform android --framework wdio --test-case ./test/addressBook/*.e2e.js --multiDevice
```

**系统会预先分配：**
```
=== Static Test Distribution ===
Device emulator-5554: 2 test file(s)
  1. test1.e2e.js
  2. test6.e2e.js
Device emulator-5556: 2 test file(s)
  1. test2.e2e.js
  2. test7.e2e.js
...
```

**动态分配模式（推荐）：**
```bash
yarn cli test --platform android --framework wdio --test-case ./test/addressBook/*.e2e.js --multiDevice --dynamic
```

**系统会使用任务队列：**
```
=== Dynamic Task Distribution ===
Total test files: 10
Devices will automatically pick up new tasks when they finish current ones

Device emulator-5554: executing test1.e2e.js
Device emulator-5556: executing test2.e2e.js
...
✓ Device emulator-5554 completed: test1.e2e.js
Device emulator-5554: executing test6.e2e.js  ← 自动获取新任务
✓ Device emulator-5554 completed: test6.e2e.js
Device emulator-5554: executing test7.e2e.js  ← 继续获取新任务
...
```

**执行结果：**
- ✅ 10个测试文件全部执行，无遗漏
- ✅ 每个测试文件只执行一次，无重复
- ✅ 5台设备并发执行，效率提升5倍
- ✅ **动态模式**：快速设备会自动承担更多任务，整体效率更高
- ✅ 所有结果合并为统一报告

## 工作流程

1. **设备检测**：系统自动执行 `adb devices` 获取所有已连接的设备ID
2. **设备验证**：验证每个设备是否可用（通过 `adb -s <deviceId> shell echo "ok"`）
3. **测试文件收集**：根据 `--test-case` 参数收集所有测试用例文件
4. **分配策略**：
   - **静态分配**（默认）：使用轮询（round-robin）方式预先分配所有测试文件
     - **示例1**：5个设备，10个测试文件
       - 设备1: 文件1, 文件6
       - 设备2: 文件2, 文件7
       - 设备3: 文件3, 文件8
       - 设备4: 文件4, 文件9
       - 设备5: 文件5, 文件10
     - **重要**：每个测试文件只会分配给一个设备，不会重复执行
     - **限制**：如果设备1先完成，不会自动执行其他设备的任务
   
   - **动态分配**（`--dynamic`）：使用任务队列，设备完成后自动获取新任务
     - **优势**：更高效的负载均衡，快速设备会自动承担更多任务
     - **示例**：5个设备，10个测试文件
       - 开始时：设备1执行文件1，设备2执行文件2，...，设备5执行文件5
       - 设备1完成文件1后：自动从队列获取文件6
       - 设备1完成文件6后：自动从队列获取文件7（如果其他设备还在执行）
       - 直到所有任务完成
     - **推荐**：当测试文件执行时间差异较大时，使用动态分配可以显著提升效率
5. **并发执行**：每个设备在独立进程中启动WebDriverIO，使用不同的Appium端口
6. **独立报告**：每个设备生成独立的allure报告到 `allure-results/device-<deviceId>/` 目录
7. **报告合并**：所有设备执行完成后，自动合并所有报告到统一的 `allure-results/` 目录
8. **结果汇总**：输出执行摘要并自动打开合并后的报告

## 环境变量

多设备模式下，每个进程会自动设置以下环境变量：

- `APPIUM_DEVICENAME`: 设备ID
- `APPIUM_PORT`: Appium端口（每个设备不同）
- `ANDROID_SERIAL`: 设备ID（用于adb命令）
- `SPECS`: 分配给该设备的测试文件列表

## 注意事项

1. **仅支持Android平台**：多设备模式目前仅支持Android平台
2. **设备连接**：确保所有设备已通过USB连接并启用USB调试
3. **端口冲突**：确保基础端口及后续端口未被占用
4. **Appium服务**：每个设备需要独立的Appium服务实例，系统会自动启动
5. **资源占用**：多设备并发执行会占用更多系统资源，请根据实际情况调整
6. **测试文件分配**：
   - ✅ 每个测试文件只会分配给一个设备，不会重复执行
   - ✅ 分配采用轮询方式，确保负载均衡
   - ✅ 执行前会显示详细的分配信息
7. **报告处理**：
   - ✅ 每个设备生成独立的报告目录，避免冲突
   - ✅ 所有设备完成后自动合并为统一报告
   - ✅ 合并后的报告包含所有设备的测试结果

## 故障排查

### 问题：找不到设备

```bash
# 检查设备连接
adb devices

# 确保设备已启用USB调试
# 在设备上：设置 -> 开发者选项 -> USB调试
```

### 问题：端口被占用

```bash
# 检查端口占用情况
lsof -i :4723
lsof -i :4724

# 使用不同的基础端口
yarn cli test --platform android --framework wdio --multiDevice --basePort 4800
```

### 问题：设备不可用

```bash
# 手动验证设备
adb -s <deviceId> shell echo "ok"

# 重新连接设备
adb kill-server
adb start-server
adb devices
```

## 代码结构

```
packages/cli/
├── utils/
│   ├── adbHelper.js              # ADB设备检测工具
│   ├── testSuiteDistributor.js  # 测试用例分配器
│   └── multiDeviceRunner.js      # 多设备执行器
└── cli/
    └── commands/
        └── test.js               # 测试命令（已集成多设备支持）
```

## API说明

### adbHelper.js

- `getAdbDevices()`: 获取所有adb设备列表
- `isDeviceAvailable(deviceId)`: 检查设备是否可用
- `getAvailableDeviceIds()`: 获取可用设备ID列表

### testSuiteDistributor.js

- `getTestFiles(testCasePattern)`: 获取测试用例文件列表
- `distributeTestsToDevices(testFiles, deviceIds)`: 分配测试用例到设备
- `createTestSuite(deviceId, testFiles)`: 创建testSuite配置

### multiDeviceRunner.js

- `MultiDeviceRunner`: 多设备执行器类
  - `runTestsOnDevice(deviceId, testFiles, platform, port)`: 在指定设备运行测试
  - `runConcurrentTests(distributions, platform, basePort)`: 并发执行多个设备测试
  - `stopAll()`: 停止所有正在运行的进程

### reportMerger.js

- `mergeAllureReports(deviceResultsDirs, mergedResultsDir)`: 合并多个设备的allure报告
- `generateMergedAllureReport(resultsDir, openBrowser)`: 生成合并后的allure报告
