# Gas Account 功能需求文档

## 基本信息

| 项目 | 内容 |
|------|------|
| 模块 | Wallet |
| 功能名称 | Gas Account（Gas 代付账户） |
| App 版本 | - |
| 测试端 | 全端（iOS / Android / Desktop / Extension） |

## 文档分域与测试口径

| 分域 | 说明 |
|------|------|
| **Gas Account 面板** | 登录页、余额、充值（Apple Pay）、Activity；下文「gasAccountInfo」「feePaymentMethod」等 JSON 示例面向该域与后端兼容。 |
| **SignatureConfirm Gas Sponsor** | 任意业务（发送 / Swap / Perps / Earn / dApp）交易确认页：`/estimate-fee` 的 `payer`、`gasAccountEligible`、`gasAccountQuote`（`quoteId`/`maxFee`/`expiresAt`），`/send-transaction` 的 `quoteId`/`idempotencyKey`，A/B/C 类错误与 `gasAccountTemporarilyDisabled`；**以 `docs/qa/rules/wallet-rules.md` §8.9 与 `docs/qa/testcases/cases/wallet/2026-03-31_Wallet-GasAccount功能测试.md` 为准**。 |
| **与用例关系** | 当前手工用例 `Wallet-GasAccount功能测试.md` 聚焦 SignatureConfirm 链路，**暂不覆盖**充值流程；面板能力仍以本章功能说明为准，分阶段验收。 |

## 产品定位

Gas Account 是 OneKey 钱包内的"代付 Gas 账户"，用户充值 USDT 等值资产后，可用于支付多链交易的 Gas 费用，无需在每条链上持有原生代币。

## 解决问题

- **一次充值，多链通用**：充 USDT 即可支付 ETH/BNB/MATIC 等各链 Gas
- **新手友好**：不用理解每条链的原生代币
- **资金效率**：无需在多链分散持有小额原生代币

## 用户角色（账户体系）

以 OneKey ID 绑定的 Gas 账户体系，该账户的存款可被用户所有可用钱包使用。

| 角色 | 说明 |
|------|------|
| 未登录用户 | 可享受平台补贴额度（Guest 模式），GRO 组存在一些补贴活动 |
| 已登录用户 | 可充值、提现、查看完整记录，所有地址共享余额 |

## 功能模块

| 模块 | 入口位置 | 说明 |
|------|---------|------|
| Gas Account 核心管理面板 | Wallet 首页 | Gas Account 入口，进行查看、管理等操作主要面板 |
| 查看是否支持且发送赞助交易 | 交易确认页 | Network Fee 区域显示 "Gas Sponsor" 开关，决定是否能进行赞助广播且发送赞助交易的操控开关 |

## 功能说明

### 1. 登录界面
- 未登录的情况，展示登录页面
- 未登录页面向用户介绍核心功能，提供 OneKey ID 登录选项
- 点击 Connect 连接 OneKey ID 后即可开始使用
- 底部提供帮助入口和服务条款链接

### 2. Gas Account 核心操作界面
- **余额展示**：显示当前可用 USD 余额
- **充值**：存款进 Gas Account 账户
- **Activity 记录**：展示所有收支明细，包括 Gas 代付、充值、提现等，可按类型筛选

### 3. 充值
第一期支持通过 Apple Pay 充值到 Gas Account：
- 提供 $10 / $20 / $50 三档快选，也支持自定义金额
- 点击 Pay 调起 Apple Pay 完成支付
- 充值即时到账，无需等待链上确认

### 4. 交易确认页面
- 用户发起交易
- 交易确认页显示 "Gas Account 可用" 开关
- 用户开启开关，点击 Send
- 交易成功，补贴额度扣减
- 补贴用完，引导登录充值

## 赞助规则系统

检查时机：在 `/EstimateFee` 接口内提交交易时进行检查，进行各种条件的检查。

| 规则 | 内容 | 判断 |
|------|------|------|
| 链白名单 | evm--1, evm--137, evm--42161, evm--10, evm--56 | 任一不通过时，交易整体代付返回不支持 |
| 余额检查 | 如果 gasAccount 内余额不够支付该笔 gas | 同上 |
| 地址黑名单 | 支持封禁某些地址列表 | 同上 |
| Gas 价格熔断 | 链上 gas 过高时暂停赞助<br>evm--1: maxGwei = 200<br>evm--137: maxGwei = 500 | 同上 |

## API 集成

### /EstimateFee 返回字段（新增 gasAccountInfo）

```json
{
  "gasAccountInfo": {
    "isGasAccountAvailable": true,
    "balanceIsEnough": true,
    "chainNotSupport": false,
    "errMsg": "",
    "cost": {
      "totalCost": "0.003996",
      "txCost": "0.002858",
      "gasCost": "0.001138",
      "estimateTxCost": "0.001887"
    }
  }
}
```

### /sendTransaction（新增 feePaymentMethod 字段）

```json
{
  "networkId": "evm--1",
  "signedTx": "0x...",
  "fromAddress": "0xAAA",
  "feePaymentMethod": "gas_account"
}
```

## 代付端流水记录

记录内容包括：network_id、from_address、user_tx_hash、gas_tx_hash、total_cost、tx_cost、gas_cost、estimate_tx_cost、actual_gas_used、actual_total_cost、status（pending/success/failed）、created_at、confirmed_at。

## 项目阶段

| 阶段 | 目标 | 内容 |
|------|------|------|
| 阶段一（已完成） | 底层实现上流程跑通 | 乐观模拟交易；构造充值 Gas 交易并广播；支持链：Ethereum、BSC、BASE、Arbitrum |
| 阶段二（进行中） | 端到端跑通 | 后端：/estimate-fee 返回 gasAccountInfo、规则系统、/sendTransaction 支持代付广播、spend_log 记录<br>客户端：交易确认页 Gas Sponsor 开关逻辑；支持链：ETH、BSC、BASE、Arbitrum |
| 阶段三 | 可对外灰度 | 可配置规则系统（地址黑名单、每日限额、Gas 熔断）；OneKey ID 账户体系；Gas Account 核心操作（余额展示、Apple Pay 充值、历史记录）；完整客户端 UI |
| 阶段四 | 更多链支持 | 支持更多链 |

## 已知风险

- Gas 价格波动可能导致预估与实际扣费存在偏差
- Apple Pay 支付环节涉及第三方系统，需关注支付失败场景
- 高 Gas 时熔断机制可能影响用户体验
- 并发场景下余额扣减的一致性
- 跨端状态同步（不同端看到的余额是否一致）

## 变更记录

| 日期 | 变更内容 |
|------|---------|
| 2026-03-31 | 初始版本，基于 4 份设计文档汇总 |
| 2026-04-20 | 增加「文档分域与测试口径」：区分面板与 SignatureConfirm；与 §8.9 / 手工用例对齐说明 |
