# DeFi - Aave 协议（借贷市场）

> **App 版本**：<br>
> **测试端**：默认全端<br>
> **需求来源**：接入 Aave 借贷市场，支持 Ethereum 与 Base 两条网络（2026-08-31 用户提供 + 6 张 UI 截图）+ app-monorepo `x` 分支源码对齐（PR #11597 borrow frontend、PR #12592/#12703 E-Mode、PR #12730/#12744 loading 修复）

## 1. 渠道概述

- **协议**：Aave v3 借贷市场
- **入口**：DeFi → 「借币」tab → 顶部市场选择器
- **市场**：
  | 市场名 | 网络 | networkId |
  |---|---|---|
  | Aave Core | Ethereum 主网 | evm--1 |
  | Aave Base | Base | evm--8453 |
  - 同一选择器中还有 Kamino Main（Solana，规则见 defi-rules.md 第 1 章），当前选中项带 ✓
- **仓位隔离**：Aave Core 与 Aave Base 的存入 / 借款 / 健康系数 / E-Mode 相互独立
- **核心操作**：存入（Supply）、借币（Borrow）、赎回（Withdraw）、偿还（Repay）、抵押品开关、E-Mode 管理

## 2. 借币首页

- **总览区**：净值（+ 刷新按钮）、净 APY、健康系数（有借款才显示数值 + 「健康」等状态标签，空仓显示 `-`）、E-Mode（显示「关闭」或当前类别名，点击打开管理弹窗）、平台奖励、收益、右上「历史记录」入口
- **我的存入**：区块头显示存入余额 + APY ⓘ；行 = 资产图标名称 / 已存入（数量 + USD）/ 存入 APY / 抵押品开关 / 「赎回」按钮；空态文案「暂无存入」；区块可收起展开
- **我的借款**：区块头显示借入余额 + APY ⓘ；行 = 资产 / 已借入（数量 + USD）/ 借款 APY / 「偿还」按钮 / 更多菜单（⋮）；空态文案「借款前请先提供抵押资产」
- **可存入资产**：顶部「显示余额为 0 的资产」开关；列 = 资产 / 余额（可排序）/ 存入 APY / 「存入」按钮 / 更多菜单；可作抵押品的资产带绿色 ✓ 标识
- **可借资产**：列 = 资产 / 余额 / 借款 APY / 「借币」按钮；无抵押品时可借为 0、「借币」按钮置灰

## 3. 资产详情页

- 面包屑：借币 › <资产>；资产名旁分享/跳转 icon；「预言机价格」数值
- 右上外链：「Aave 管理」「Aave Oracle 聚合」
- 市场数据：储备规模 / 可用流动性 / 利用率
- 存入信息：「可用作抵押品 ✓」标签；「存入上限使用」= 百分比环形图 + `已用 of 上限`（数量与 USD 双口径）
- 存入 APY 图表：时间范围 1 周 / 1 月 / 3 月 / 1 年
- 风险参数：最高 LTV / 清算 LTV / 软清算（各带 ⓘ 说明）
- 「我的信息」侧栏：钱包余额（数量 + USD）+「存入」按钮；可借 ⓘ（数量 + USD）+「借币」按钮（无可借额度时置灰）；存入余额；借入余额

## 4. E-Mode（仅 Aave 渠道）

- 入口：总览区 E-Mode → 「管理 E-Mode」弹窗；说明文案含「了解更多」外链
- 类别下拉：「关闭（当前）」+ 各 E-Mode 类别（类别名 + 最大 LTV）；类别集合按市场不同（截图观测：Core 有 ETH correlated 93% / sUSDe Stablecoins 90% / rsETH ETH wstETH ETHx 93% / LBTC WBTC 84% 等；Base 有 ezETH Stablecoins 72%）
- 未变更选择时底部按钮显示「当前 E-Mode」且禁用
- 选中新类别 → 显示**仓位影响**：最高 LTV `before → after`、健康系数 `before → after`（标注 清算 < 1.00）、资产表（列：资产 / 提升后 LTV / 可借款，✓ 与 — 标识）
- 无冲突仓位：直接确认切换（链上交易）
- 有冲突（当前借款资产不在目标类别内）：类别项标「需要操作」，弹窗顶部警告「切换前，先完成 N 项」，底部按钮变「解决前置条件」→ 进入「切换步骤」弹窗：按序号列出前置操作（如「偿还 ETH 0.00003836 ETH」）+ 最后一步「切换到 <类别>」，需依次确认，底部「授权」按钮
- 前置偿还时钱包余额不足：步骤内显示「<币种> 余额不足　钱包余额: X · 还差 Y」+ 「充值」下拉入口；「授权」按钮置灰
- 启用 E-Mode 后只能借入所选类别内的资产
- E-Mode 状态按市场隔离（Core 开启不影响 Base）

## 5. 核心流程

- 存入 / 借币 / 赎回 / 偿还均为真实签名 + 广播，密码弹窗按通用规则处理，完成后仓位区与历史记录更新
- ERC-20 首次存入需授权（授权 → 存入）；原生 ETH 存入无需授权
- 原生 ETH 的存入 / 借币 / 赎回 / 偿还在 Ethereum 与 Base 均支持
- **偿还仅支持钱包余额**，不提供「用抵押物还款」（2026-08-31 产品确认）
- **健康系数警告阈值沿用 Kamino 口径 `1.50`**（2026-08-31 产品确认）：借币 / 赎回后健康系数 < `1.50` 显示警示文案 + 风险确认弹窗（勾选「我已知晓相关风险」后才能提交）；≥ `1.50` 无警告
- **抵押开关**（2026-08-31 产品确认）：已开启仓位始终可关闭（仅受清算风险拦截）；未开启仓位仅可抵押资产可开启（不可抵押的置灰）；E-Mode 激活不限制开启类别外抵押

## 6. 源码实现参考（app-monorepo `x` 分支）

> 本节全部条目均已经产品确认为真实行为（2026-08-31 确认前 4 项，2026-09-01 确认其余 3 项），可作为正式需求口径；括号内源码位置仅作实现参考。

- E-Mode 仅对 Aave 渠道查询，其他渠道（Kamino）不请求（`useBorrowEModeStatus.ts`）；帮助外链 `https://aave.com/help/borrowing/e-mode`（`EModeDescription.tsx`）
- **用抵押物还款 allowlist 仅含 Kamino**（`borrowRepayPosition.utils.ts` `collateralRepayProviderAllowlist`）→ Aave 偿还只支持钱包余额
- 原生代币走 WrappedTokenGateway：仅 `evm--1` / `evm--8453` 且 `reserveAddress === ''` 时启用（`shouldUseAaveNativeGateway`）；不在列表的网络会隐藏用户已有原生仓位
- 抵押开关语义（`collateralControls.utils.ts`）：已开启的仓位始终可关闭；未开启的仅后端 `canBeCollateral === true` 时可开启；E-Mode 激活**不限制**开启类别外抵押（Aave v3.2 liquid e-modes——类别外抵押保留自身 LTV/LT，不吃加成）
- 可借资产可见性：`canBeBorrowed !== false` 即显示（数据缺失不隐藏资产）
- 抵押开关提交后轮询刷新：快速 5 次、最多 8 次，超次数为 `exhausted`
- 详情页 Deep link 格式：`https://app.onekey.so/borrow/evm--1/usdc/aave?marketAddress=0x...&reserveAddress=0x...`（`borrowUtils.ts`）

## 7. 测试数据

| 项 | 值 |
|---|---|
| Aave Core 网络 | Ethereum 主网（evm--1），gas 为 ETH |
| Aave Base 网络 | Base（evm--8453），gas 为 ETH |
| 截图观测资产（Core） | ETH（原生）/ USDT / DAI / USDC / cbBTC |
| 截图观测资产（Base） | ETH / GHO / cbBTC / USDC / ezETH |
| 截图观测风险参数（Core USDT） | 最高 LTV 75.00% / 清算 LTV 78.00% / 软清算 4.50%；存入上限使用 84.59%（2.94B of 3.48B） |
| E-Mode 帮助外链 | https://aave.com/help/borrowing/e-mode |

## 变更记录

- 2026-08-31：首版，覆盖借币首页 / 资产详情页 / E-Mode / 四大核心流程，双网络（Ethereum + Base）
- 2026-08-31：产品确认——偿还仅钱包余额、E-Mode 仅 Aave、抵押开关语义、E-Mode 不限制类别外抵押；健康系数警告阈值沿用 Kamino `1.50`
- 2026-09-01：产品确认——可借资产缺数据不隐藏、抵押开关轮询刷新、详情页 Deep link；第 6 章全部条目升级为正式需求口径
