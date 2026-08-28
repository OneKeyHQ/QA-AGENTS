# DeFi - Morpho 协议（Steakhouse / Gauntlet）

> **App 版本**：<br>
> **测试端**：默认全端<br>
> **需求来源**：DeFi 新增 Morpho Steakhouse 渠道（2026-08-27 用户提供）+ app-monorepo `x` 分支源码对齐（PR #12982 Katana integration）

## 1. 渠道概述

- **协议**：Morpho（金库由 Steakhouse Financial 策展），渠道名 Morpho Steakhouse
- **网络**：Katana（evm--747474），原生 gas 为 ETH
- **接入代币**：vbUSDC（Vault Bridge USDC）
- **金库管理员**：Steakhouse（详情页可跳转外链）
- **钱包支持**：HD 与 HW 钱包均支持认购 / 赎回 / 领取签名（HW 走设备确认，需固件支持 Katana 与 EIP-712 typed data）
- **收益口径**：APY；综合 APY = 原生 APY（vbUSDC）+ MORPHO 奖励 APY + KAT 奖励 APY − 业绩费，APY 弹窗四行分别展示（业绩费为负值扣减行）
- **简介区「收益代币」**：标题下分别展示 vbUSDC、MORPHO、KAT 三项
- **入口路径**：DeFi → 赚币 → vbUSDC → Morpho Steakhouse（面包屑：DeFi › vbUSDC › Morpho Steakhouse）；赚币列表代币卡片显示 APY、网络、渠道数

## 2. 认购规则

| 项 | 规则 |
|---|------|
| 最小认购金额 | 0.000001 vbUSDC（= 1 个精度单位，无更小可构造的非零输入） |
| 最大认购金额 | 无上限（仅受钱包余额限制） |
| 认购金额精度 | 6 位小数，第 7 位截断或拒绝 |
| 授权方式 | **Permit 签名**（EIP-712 typed data），不上链、不耗 gas。底部为单个按钮（文案「授权并认购 N vbUSDC」类），点击后先弹签名请求，签名后自动进入认购交易确认；**全程只有 1 笔链上交易**，不显示「1. 授权 → 2. 认购」两步 Stepper。已授权（命中缓存）时按钮直接显示「认购」 |
| Permit spender | 0x916aa175c36e845db45ff6ddb886ae437d403b61（Morpho GeneralAdapter on Katana）；App 侧校验 spender 不符直接报错 |
| Permit 签名缓存 | 本地缓存 24 小时，key = 账户 + 网络 + 代币 + 金额；同金额 24 小时内按钮显示「认购」、点击不弹签名；改金额按钮回到「授权并认购」需重签 |
| 预估年收益 | 固定三行（vbUSDC / MORPHO / KAT 各一行），各行 USD 之和 ≈ 综合 APY × 认购价值 |
| 余额不足 | 显示「vbUSDC 不足？」引导 + 「交易」「购买」按钮 |
| 未创建 Katana 地址 | HD 钱包在 Katana 无地址时，认购前显示创建地址引导，不弹签名 |

## 3. 赎回规则

- 管理弹窗「赎回」tab 输入金额 → 点击「赎回」→ 签名 → 广播，立即到账，无提现选项弹窗、无手续费
- 最小按代币精度；最大为全部持仓（100%）
- vbUSDC 收益体现为持仓价值增长，随本金一并结算；全额赎回后 vbUSDC 行从分组消失，**未领取的 MORPHO / KAT 仍可领取**
- 池内流动性不足：前端无预校验，提交后服务端 / 链上返回报错

## 4. 投资组合与累计收益

- 投资组合按协议分组，列：已认购 / 预计 24 小时收益 / 资产状态 / 可领取 / 管理
- **累计收益仅在投资组合展示**：预计 24 小时收益列第二行显示累计收益数值 + 「累计收益」标签，币种 vbUSDC，**数据来自 Morpho，每 1 小时刷新一次**；详情页持仓区与管理弹窗不展示该字段
- 累计收益不包含 MORPHO / KAT 奖励；准确性可与 Morpho 官方站点同地址同金库 Earned 数据对比（容差 1 小时内增量）

## 5. 协议奖励（MORPHO / KAT，各自独立领取）

- 两处展示：
  1. 详情页「协议奖励」区块：每个奖励代币一行 = 图标 + 可领取数量（USD）+ 「领取」按钮；行下方「未来可领取 X <代币>」；标题旁 info icon 弹窗显示更新频率说明
  2. 投资组合分组下方「可领取协议奖励」区：各代币数量 + 「领取」按钮
- 显示条件：任一代币 claimableNow 或 claimableNext > 0 才显示区块；claimableNow = 0 时该代币「领取」按钮置灰（不隐藏）
- 领取按代币独立发起（请求携带 claimTokenAddress），任一代币领取不影响另一代币数量、本金与累计收益
- MORPHO / KAT 为协议方额外发放的奖励，**协议方停发某奖励时该代币行不显示**（非缺陷）；协议方仍在发放但 App 缺行才判缺陷。奖励代币 token 元数据已内置

## 6. 测试数据

| 项 | 值 |
|---|---|
| vbUSDC 合约地址（Katana） | 0x203A662b0BD271A6ed5a60EdFbd04bFce608FD36 |
| vbUSDC 观察地址 | 0x92bAA173828d55B2F1ed611352Aa0627AB825178 |
| Permit spender（Morpho GeneralAdapter） | 0x916aa175c36e845db45ff6ddb886ae437d403b61 |

> 观察地址仅可用于只读验证（持仓、累计收益、协议奖励数量展示），不能提交交易。认购 / 赎回 / 领取核心流程必须使用有 vbUSDC 余额及 Katana gas 的 HD 钱包账户真实执行（签名 + 广播 + 到账验证）。

## 7. Gauntlet 渠道（Base / USDC）

- **渠道名**：Morpho Gauntlet（金库由 Gauntlet 策展）
- **网络**：Base（evm--8453），原生 gas 为 ETH
- **接入代币**：USDC；最小 0.000001（6 位精度）、无上限
- **授权 / 赎回 / 累计收益**：与 Steakhouse 完全一致（Permit 签名单按钮、24h 缓存、累计收益仅投资组合展示、Morpho 数据源、1 小时刷新）
- **Permit spender**：0xb98c948cfa24072e58935bc004a8a7b376ae746a（Morpho Bundler on Base）
- **协议奖励**：无（已确认）；详情页「协议奖励」区块与投资组合「可领取协议奖励」区均不显示
- **凭证代币**：gtokenusdc（详情页简介区展示，外链至 Base 区块浏览器）
- **综合 APY**：原生 APY − 业绩费；预估年收益仅 USDC 一行
- **测试数据**：

| 项 | 值 |
|---|---|
| USDC 合约地址（Base） | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 |
| 凭证代币 gtokenusdc 合约地址（Base） | 0xefa40c84f1f2335a8599dd7686a28d2b6263b6ef |
| USDC 观察地址 | 0x92bAA173828d55B2F1ed611352Aa0627AB825178 |

## 变更记录

- 2026-08-27：初始版本。Katana 网络 vbUSDC 接入 Morpho Steakhouse：最小 0.000001 / 6 位精度 / 无上限；累计收益在投资组合展示、数据来自 Morpho；MORPHO + KAT 协议奖励分开领取。
- 2026-08-28：源码对齐修正：授权为 Permit 签名（单按钮、1 笔链上交易、24h 缓存、spender 0x916a…3b61）；协议奖励两处展示、每代币独立领取按钮、claimableNext 字段；累计收益展示位置确认为投资组合。
- 2026-08-28：产品确认：综合 APY 扣业绩费（弹窗四行）；累计收益每 1 小时刷新；简介「收益代币」标题下分列三项；预估年收益固定三行；未创建 Katana 地址显示创建引导；已授权时按钮显示「认购」；MORPHO / KAT 为协议方额外奖励，停发则不显示。
- 2026-08-28：新增第 7 节 Gauntlet 渠道（Base / USDC）：规则同 Steakhouse，spender 0xb98c…746a，无固定协议奖励代币。
- 2026-08-28：产品确认 Gauntlet：无协议奖励代币；USDC 代币地址 0x8335…2913，0xefa4…b6ef 为凭证代币 gtokenusdc 合约地址；赚币列表代币卡片显示 APY、网络、渠道数；文档标题改为 Morpho 协议（Steakhouse / Gauntlet）。
