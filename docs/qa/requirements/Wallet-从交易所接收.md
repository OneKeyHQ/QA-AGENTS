# Wallet - 从交易所接收

> 模块：Wallet
> App 版本：
> 测试端：全端（iOS / Android / Desktop / Extension）

---

## 1. 需求背景

在接收页面新增「从交易所接收」功能，支持用户从 Binance、OKX、Coinbase 等主流交易所直接提取加密资产到 OneKey 钱包。

---

## 2. 功能描述

### 2.1 入口

- 接收页面直接显示「从交易所接收」区域，交易所列表默认展开可见（Binance、OKX、Coinbase），无需点击展开

### 2.2 Binance（币安）流程

1. 点击 Binance 图标
2. supportAsset 接口返回币安支持的**网络列表**和**代币列表**
3. 网络模式分两种：
   - **所有网络模式**：先选择网络（Network），再选择代币（Token）
   - **单网络模式**：无网络选择步骤，直接选择代币（Token）
4. 选择完成后跳转至 Binance 交易所页面
   - 自动代入用户选择的代币
   - 用户在 Binance 端输入金额等信息完成提币
5. 充值反馈：
   - 插件端 & 桌面端：跳出充值结果页
   - 移动端：自动跳转回 App
6. **Binance 流程不受本次优化影响，仍使用独立的 BinanceConnect 流程**

### 2.3 OKX 流程（v2 - 含 ExchangeOpenRedirect）

**非硬件钱包流程**：
1. 点击 OKX 图标
2. 选择代币
3. 获取地址后直接跳转至 ExchangeOpenRedirect 页面（不经过 ReceiveToken）
4. ExchangeOpenRedirect 页面显示交易所 Logo、缩略地址、3s 倒计时
5. 倒计时结束后自动打开 OKX App 并关闭弹窗
6. 用户也可在倒计时期间点击底部按钮手动打开

**硬件钱包流程**：
1. 点击 OKX 图标
2. 选择代币 → 进入 ReceiveToken 页面（QR + 设备验证）
3. 在硬件钱包上确认地址
4. 确认后自动跳转至 ExchangeOpenRedirect 页面
5. 倒计时后自动打开 OKX App 并关闭弹窗

**未安装 OKX App**：跳转至浏览器帮助中心对应文章页面

### 2.4 Coinbase 流程（v2 - 含 ExchangeOpenRedirect）

**非硬件钱包流程**：
1. 点击 Coinbase 图标
2. 选择代币
3. 获取地址后直接跳转至 ExchangeOpenRedirect 页面（不经过 ReceiveToken）
4. ExchangeOpenRedirect 页面显示交易所 Logo、缩略地址、3s 倒计时
5. 倒计时结束后自动打开 Coinbase App 并关闭弹窗

**硬件钱包流程**：
1. 点击 Coinbase 图标
2. 选择代币 → 进入 ReceiveToken 页面（QR + 设备验证）
3. 在硬件钱包上确认地址
4. 确认后自动跳转至 ExchangeOpenRedirect 页面
5. 倒计时后自动打开 Coinbase App 并关闭弹窗

**未安装 Coinbase App**：跳转至浏览器帮助中心对应文章页面

### 2.5 ExchangeOpenRedirect 页面（新增）

移动端专属的跳转中间页，页面内容：
- 显示交易所 Logo
- 显示 "已复制地址 '0x1234...abcd'"（含缩略地址，方便用户确认）
- 显示倒计时 "正在打开 OKX，还有 3 秒..."（带 Spinner 动画）
- 底部按钮 "Open OKX"（secondary 样式），供用户手动触发
- 倒计时结束后自动打开交易所 App 并关闭弹窗
- 地址在页面加载时自动复制到剪贴板（不显示 Toast，因为页面已有文字提示）

### 2.6 通用规则

- 未安装交易所 App 时统一跳转帮助中心
- 硬件钱包需先在设备上确认后才显示地址
- Binance 流程不受影响，仍使用独立 BinanceConnect 流程

---

## 3. 业务规则

| 规则项 | 规则描述 |
|-------|---------|
| 入口展示 | 交易所列表默认展开可见，无需点击展开 |
| supportAsset 接口 | Binance API 同时返回支持的网络列表和代币列表 |
| 网络模式 | 所有网络模式：先选网络再选代币；单网络模式：直接选代币，无网络选择 |
| 充值反馈 | 插件/桌面端展示充值结果页；移动端自动返回 App |
| 应用检测 | OKX / Coinbase 需检测本地是否安装对应 App |
| 未安装处理 | 未安装对应交易所 App 统一跳转帮助中心 |
| 硬件钱包 | 涉及地址展示时需先在硬件设备上确认 |
| 地址复制 | ExchangeOpenRedirect 页面加载时自动复制到剪贴板（不显示 Toast） |
| 返回行为 | Binance 提币完成后返回可原路回到 OneKey App |
| ExchangeOpenRedirect | 移动端跳转中间页：Logo + 缩略地址 + 3s 倒计时 + 手动按钮 |
| 非硬件钱包流程 | ReceiveSelector → 选择代币 → 获取地址 → ExchangeOpenRedirect → 打开交易所 |
| 硬件钱包流程 | ReceiveSelector → 选择代币 → ReceiveToken（验证） → ExchangeOpenRedirect → 打开交易所 |
| Binance 不受影响 | Binance 仍使用独立 BinanceConnect 流程 |

---

## 4. 已知风险

- supportAsset 接口返回异常时的容错处理
- 交易所 App 检测在不同平台（iOS / Android / Desktop / Extension）的行为差异
- 硬件钱包确认超时场景
- 帮助中心文章链接失效
- ExchangeOpenRedirect 倒计时期间 App 切到后台再回来的行为
- 剪贴板自动复制在不同系统版本上的权限兼容性
- 倒计时结束时交易所 App 无法打开的兜底处理

---

## 5. 关联资源

- 接口：supportAsset（Binance 代币过滤）

---

## 6. 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-02-27 | v1.0 | 初始版本，新增从交易所接收功能（Binance API、OKX、Coinbase） |
| 2026-03-10 | v2.0 | 1. 接收页面交易所列表默认展开可见（移除展开/收起交互）<br>2. 新增 ExchangeOpenRedirect 中间页（移动端）<br>3. OKX/Coinbase 流程改为 ExchangeOpenRedirect 跳转<br>4. Coinbase 支持跳转打开 App（此前仅跳帮助中心）<br>5. 非硬件钱包跳过 ReceiveToken 直接进入 ExchangeOpenRedirect<br>6. Binance 流程不受影响 |
