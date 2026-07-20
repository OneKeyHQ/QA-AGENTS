# Swap - Pro Mode 测试

> 生成时间：2026-07-16
> 规则文档：`docs/qa/rules/swap-rules.md`、`docs/qa/rules/market-rules.md`
> 需求依据：用户提供的移动端 Pro Mode 截图与交互备注
> 测试端：Android / iOS
> 关联场景：Trade 顶部 `Pro mode` 入口、移动端 Market / Limit 订单类型、代币信息区、搜索、告警、持仓与订单列表

## 测试范围说明

**功能范围**：移动端 Trade 下 `Pro mode` 入口、Market 订单类型主流程、Order Type 切换、代币 metadata 展示、Global search 来源的代币搜索、K 线入口、钱包入口、滑点设置、`My positions / Open order / Order history`、不支持告警。

**覆盖重点**：
- Pro Mode 是移动端的独立交易视图，整合 `Market` 与 `Limit` 两种订单类型。
- `Market` 主流程在本用例内完整覆盖。
- `Limit` 详细下单、参数、状态流转**不在本用例重复描述**，直接按 [2026-07-16_Swap-Limit测试.md](/Users/andoxzhou/Documents/github/QA-AGENTS/docs/qa/testcases/cases/swap/2026-07-16_Swap-Limit测试.md) 执行。
- 代币 metadata、价格、成交列表、买卖比、搜索数据源与 Market 保持一致。

---

## 前置条件

1. 已登录移动端可用钱包，Trade 页面可打开。
2. 已准备至少 1 个 Pro Mode 支持代币样本，且对应网络 / 钱包可执行市价单。
3. 已准备 1 个 Pro Mode 不支持代币样本，或可通过测试环境 / Mock 返回 `Swap unsupported` / `This token is not supported. Try Swap or Bridge.` 告警。
4. 已准备一组有持仓的钱包样本，便于校验 `My positions`、`Current symbol` 过滤、估值排序。
5. 若需验证 `Open order / Order history`，已准备至少 1 笔 Pro Mode 订单样本；Limit 类型订单明细按独立 Limit 用例执行。

## 1. 入口与页面结构

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 已进入移动端 Trade 页面<br>2. 当前版本包含 Pro Mode | 1. 观察顶部入口<br>2. 点击 `Pro` / `Pro mode` | 1. 顶部展示 `Swap / Bridge / Pro` 或产品定义的等价入口<br>2. 点击后进入 Pro Mode 页面 |
| ❗️❗️P0❗️❗️ | 1. 已进入 Pro Mode 页面 | 1. 观察页面主结构 | 1. 页面包含代币 metadata 区、`Buy / Sell` 切换、`Order Type` 选择器、金额输入区、价格 / 成交列表、钱包区、交易参数区、`My positions / Open order / Order history` 区域 |
| P1 | 1. 已进入 Pro Mode 页面 | 1. 在竖屏与横屏或不同尺寸设备上观察布局 | 1. 关键交互元素不重叠、不截断<br>2. `Buy / Sell`、`Order Type`、主 CTA 始终可点击 |

## 2. 代币信息与 K 线入口

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 已进入 Pro Mode 页面<br>2. 当前代币存在 Market 数据 | 1. 观察顶部代币信息区 | 1. 显示代币图标、代币名、当前网络角标<br>2. 显示 `Market cap / 24h Vol / Liquidity / Holders` |
| ❗️❗️P0❗️❗️ | 1. 已进入 Pro Mode 页面 | 1. 观察价格与列表区域 | 1. 最新价格与涨跌幅正常展示<br>2. `Price / Value` 成交列表可读取<br>3. `B / S` 比例与统计区域可读取 |
| ❗️❗️P0❗️❗️ | 1. 当前代币支持 Token Details | 1. 点击 K 线 / 外链图标或等价入口 | 1. 跳转到 Token Details 或产品定义的 K 线详情页<br>2. 不在 Pro 当前页内打开第二套 K 线面板 |
| P1 | 1. 实时价格源可更新 | 1. 持续停留页面观察价格 | 1. 最新价格按 ws / 实时订阅更新<br>2. 页面不出现明显闪烁或脏数据回退 |

## 3. Token 搜索与切换

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 已进入 Pro Mode 页面 | 1. 点击顶部当前代币 | 1. 打开 `Select token` 弹层<br>2. 可见搜索框、网络筛选 / 收藏入口或等价元素 |
| ❗️❗️P0❗️❗️ | 1. Token 弹层已打开 | 1. 观察默认列表 | 1. 默认仅展示 Global search 来源的 Market 数据<br>2. 列表项包含代币名、网络、价格、流动性或产品定义的等价字段 |
| ❗️❗️P0❗️❗️ | 1. Token 弹层已打开 | 1. 搜索关键词，如 `ETH` | 1. 返回 Global search 中命中的 Market 代币列表<br>2. 不混入非 Market 来源结果 |
| P1 | 1. Token 弹层已打开 | 1. 切换网络 / 收藏状态 | 1. 交互行为与 Market 模块一致<br>2. 切换后列表正常刷新 |
| ❗️❗️P0❗️❗️ | 1. Token 弹层已打开 | 1. 选择一个新代币 | 1. 返回 Pro 主页面<br>2. 顶部 metadata、价格、成交列表、持仓过滤基准同步切换为新代币 |

## 4. Market 订单类型主流程

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 已进入 Pro Mode<br>2. `Order Type` 默认为 `Market` | 1. 观察 `Order Type` 选择器 | 1. 当前高亮 `Market`<br>2. 订单表单处于市价单输入态 |
| ❗️❗️P0❗️❗️ | 1. 当前在 `Buy` | 1. 输入数量或点击快捷金额分档，如 `0.1 / 0.5 / 1 / 10` | 1. `Amount` 正确回填<br>2. `Total value`、`Est. Receive`、费用字段同步刷新 |
| ❗️❗️P0❗️❗️ | 1. 当前在 `Buy`<br>2. 支持滑动 / 分位控件 | 1. 拖动滑杆或切换分位 | 1. 按固定分位吸附<br>2. `Amount` 与 `Value` 自动联动更新 |
| ❗️❗️P0❗️❗️ | 1. 当前支持直接输入法币 value | 1. 输入 `Value` | 1. 自动反算 `Amount`<br>2. 精度与金额换算合理 |
| ❗️❗️P0❗️❗️ | 1. 当前在 `Sell` | 1. 切换到 `Sell`<br>2. 输入数量 | 1. 主 CTA、`Est. Receive`、费用字段按卖出方向刷新<br>2. 不沿用 Buy 的方向文案 |
| ❗️❗️P0❗️❗️ | 1. 已输入有效数量<br>2. 钱包支持当前市场单交易 | 1. 点击主 CTA 提交 Market 订单 | 1. 成功进入确认 / 签名 / 提交流程<br>2. 订单结果回写到 Pro 对应订单区域或历史 |

## 5. Order Type 切换与 Limit 引用

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 已进入 Pro Mode 页面 | 1. 点击 `Order Type` 选择器 | 1. 弹出 `Order Type` 面板<br>2. 至少显示 `Market` 与 `Limit` 两项 |
| ❗️❗️P0❗️❗️ | 1. `Order Type` 面板已打开 | 1. 从 `Market` 切到 `Limit` | 1. 页面切换到 Limit 表单布局<br>2. 表单字段与 Pro 内嵌 Limit 设计一致 |
| ❗️❗️P0❗️❗️ | 1. 已切到 `Limit` | 1. 仅验证入口切换、布局切换、返回 `Market` | 1. `Limit` 入口与表单切换正常<br>2. **Limit 详细下单、授权、价格、到期时间、Partial fill、状态流转统一按 [2026-07-16_Swap-Limit测试.md](/Users/andoxzhou/Documents/github/QA-AGENTS/docs/qa/testcases/cases/swap/2026-07-16_Swap-Limit测试.md) 执行，不在本用例重复验证** |
| P1 | 1. 当前在 `Limit` | 1. 再切回 `Market` | 1. 返回市价单表单<br>2. 页面不残留错误的 Limit 字段占位 |

## 6. 钱包与交易参数

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 已进入 Pro Mode 页面 | 1. 观察钱包区域 | 1. 交易面板内显示当前钱包名称与地址缩略<br>2. 顶部导航不重复展示钱包入口 |
| ❗️❗️P0❗️❗️ | 1. 已进入 Pro Mode 页面 | 1. 点击钱包区域 | 1. 打开 Wallet modal 或等价切换面板<br>2. 切换后余额、地址、交易能力同步刷新 |
| ❗️❗️P0❗️❗️ | 1. 已进入 Pro Mode 页面 | 1. 点击滑点 / Auto / 设置区域 | 1. 打开交易参数设置<br>2. 修改后当前 Market 订单估算结果即时刷新 |
| P1 | 1. 当前切换不同钱包或不同网络 | 1. 返回主表单观察 | 1. `Balance`、钱包地址、支持状态、主 CTA 同步更新 |

## 7. 持仓、Open order 与 Order history

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 已进入 Pro Mode 页面<br>2. 钱包存在多链持仓 | 1. 查看 `My positions` | 1. 展示 Market 支持的所有链仓位<br>2. 按估值从高到低排序 |
| ❗️❗️P0❗️❗️ | 1. `My positions` 已展示多条仓位 | 1. 勾选 `Current symbol` | 1. 仅保留当前代币相关仓位<br>2. 取消勾选后恢复完整列表 |
| P1 | 1. `My positions` 存在当前代币仓位 | 1. 点击任一持仓代币 | 1. 顶部 metadata 切换到该代币<br>2. 主表单和价格区域同步切换 |
| ❗️❗️P0❗️❗️ | 1. 已有 Pro 订单样本 | 1. 查看 `Open order` 与 `Order history` | 1. 订单列表可正常展示<br>2. Market 与 Limit 订单按产品定义区分展示 |
| P1 | 1. 当前 `Open order / Order history` 包含 Limit 订单 | 1. 进入订单详情 | 1. 入口、列表、跳转正常<br>2. 订单详情字段与状态流转按独立 Limit 用例验证 |

## 8. 告警与不支持场景

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 当前网络或钱包不支持 Pro 交易 | 1. 进入 Pro Mode 页面 | 1. 展示 `Swap unsupported` 或产品定义的等价告警<br>2. 告警文案明确提示切换网络或钱包 |
| ❗️❗️P0❗️❗️ | 1. 当前代币不支持 Pro Mode | 1. 切换到不支持代币 | 1. 展示 `This token is not supported. Try Swap or Bridge.` 或产品定义等价文案<br>2. 主 CTA 不可误触发有效下单 |
| P1 | 1. 告警已展示 | 1. 切换到支持的钱包 / 网络 / 代币 | 1. 告警自动消失或刷新为正常状态<br>2. 页面恢复可交易态 |

## 变更记录

| 日期 | 版本说明 |
|------|----------|
| 2026-07-16 | 初版：新增移动端 Swap Pro Mode 测试，用例覆盖入口、Market 主流程、Order Type 切换、token metadata、Global search、钱包入口、持仓与告警；Limit 详细场景引用独立 Limit 用例，不重复描述 |
