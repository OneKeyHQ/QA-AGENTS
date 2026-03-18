# DeFi - Pendle 协议（固定收益）

> **模块**：DeFi<br>
> **功能**：Pendle 协议接入（固定 APY 资产展示、购买/提前出售、仓位管理）<br>
> **版本**：待定<br>
> **测试端**：全端（Desktop / iOS / Android / Extension 按实际支持）<br>
> **日期**：2026-03-03

---

## 1. 需求背景

- 新增 Pendle 协议，DeFi 首页「所有资产」增加**固定 APY** 列，所列资产均为 Pendle 协议下资产。
- 用户可：选择交易币种 → 选择网络/到期 → 进入代币详情查看收益图表 → 购买或提前出售（Swap 时 OneKey 按**动态费率**收取手续费，仅当到期收益能覆盖手续费时收取）→ 在投资组合查看并管理仓位。

---

## 2. 功能描述

| 功能点 | 描述 |
|--------|------|
| 固定 APY 列 | 首页所有资产列表增加固定 APY 列；支持「固定 APY」筛选标签，展示 Pendle 资产 |
| 交易币种选择 | 购买/出售时选择支付币种与接收币种（如 sUSDe、USDe、USDT、PT sUSDe、PT USDe 等） |
| 网络与到期 | 展示/选择网络（如 Ethereum）、到期日（Maturity），不同到期对应不同市场 |
| 代币详情与图表 | 代币详情页展示 Fixed APY、Effective fixed APY、收益图表（Fixed APY / Underlying APY 可选）、PT 价格走势、Intro（Underlying asset、Network、Liquidity、24h volume、Yield source）、Rule（Maturity、Redemption 规则） |
| 购买 / 提前出售 | Buy / Sell early 选项卡；Amount / Receive 输入与估算；Effective fixed APY、到期可获得金额、提前出售可获得金额及与到期差异；交易流程 Approve → Swap；Route selection（如 Ethena unstake vs Swap now） |
| PT-sUSDe 兑换 USDe（ETH 主网） | **默认** Ethena 解质押：约 7 天提现、最优汇率；可**手动切换** Swap 渠道：立即到账、汇率有损耗。Ethena 为**三步**（1.授权 → 2.兑换 → 3.解质押），立即兑换为**两步**（1.授权 → 2.兑换） |
| OneKey 手续费 | **双渠道**：到期收益 > 手续费时走 OneKey Swap 并收取（费率因币种动态计算）；到期收益无法覆盖手续费时走 Pendle Swap，手续费显示为 0。已到期市场接口不返回 onekey fee，不收取。 |
| 滑点与 MEV | 支持 Slippage tolerance（Auto / Custom，如 0.1%、0.5%、1%）；MEV protection 说明（发送至 Anti-MEV 节点） |
| 投资组合与仓位 | Positions 入口；展示 Pendle 仓位（资产、到期、数量、价值）；Manage、Redeem、Roll over 等管理能力 |

---

## 3. 业务规则

- **PT 赎回**：到期后 1 PT 按市场规则赎回为 accounting asset（如 1 PT sUSDe → sUSDe worth 1 USDe；1 PT USDe → 1 USDe）。Rebasing 与 interest-bearing 资产赎回口径不同，以产品展示为准。
- **提前出售**：Sell early 可获得金额可能低于持有至到期的金额，需展示「Selling now you get」与「At maturity you get」及差异提示（如 "Selling early may result in a lower value than holding to maturity"）。
- **OneKey 手续费（双渠道）**：  
  - **到期收益 > 手续费**：走 OneKey Swap 渠道，OneKey 收取 Swap 手续费（不同币种费率可不同，动态计算）。  
  - **到期收益无法覆盖手续费**：走 Pendle Swap 渠道，OneKey 手续费显示为 0。  
  - **公式**：到期收益 = 金额 × 年化收益率 × (到期剩余天数 / 365)；佣金 = 金额 × OneKey fee%；**仅当 佣金 < 到期收益 时收取**。  
  - **已到期**：接口不再返回 onekey fee 字段，不收取佣金。
- **其他费用**：可能另有 Pendle / External dex 等费用，总 Fee 或 Fee details 中需区分展示。
- **Effective fixed APY**：基于用户实际交换比例计算的有效固定年化，与市场 Implied APY 可能因滑点/路由不同而略有差异。
- **询价与刷新**：用户输入金额后系统实时询价并更新 Receive/费用；刷新按钮点击后 5 秒再次自动刷新；系统每 15 秒自动轮询刷新；手动刷新后需等待 5 秒才可再次触发刷新。
- **PT-sUSDe 兑换 USDe（ETH 主网）**：默认通过 Ethena 解质押（约 7 天提现、最优汇率）；用户可切换为 Swap 渠道（立即到账、汇率有损耗）。选 Ethena 时流程为三步（授权 → 兑换 → 解质押），选立即兑换时流程为两步（授权 → 兑换）。
- **默认币对选择**：在 Pendle 的 Buy 与 Sell early 场景中，除当前资产本身外，Swap 会**自动选择当前账户中余额最大的资产**作为对手币种，作为默认交易组合；当账户资产分布发生变化时，下次进入页面时默认对手币种随最新余额最大资产更新。
- **Token 列表排序**：Token 选择列表按 **Token 法币价值（Token 余额 × 法币单价）从高到低排序**，而非按字母顺序；余额或价格变动后，排序按最新法币价值动态调整。
- **购买/售出与授权**：**主币**（如 ETH）作为支付时**不需要 Approve**，直接 Swap；**代币**（如 USDT、sUSDe）作为支付时**必须先 Approve 再 Swap**，未授权时仅展示 Approve 步骤。
- **金额与精度**：不同代币有不同 **decimals**（如 6、8、18），输入与展示按该代币精度；需测试 **最大值**（Max/全部余额，主币预留 Gas、代币为余额全部）与 **最小值**（协议最小可交易量或精度下限），过小金额需提示或禁用提交。
- **Swap 法币价值边界**：Swap 交易时，单笔最大法币价值为 **$10,000,000**，最小法币价值为 **$0.01**。超出最大值或低于最小值时需有对应提示或禁用提交。
- **Ethena 解质押投资组合展示**：通过 Ethena 解质押 USDe 的流程发起后，投资组合/Positions 页面需展示以下信息：
  - 显示「Unstaking via Ethena」分组，展示解质押中的金额与法币价值（如「100 USDe ($100.01) Unstaking」）及信息图标。
  - 点击信息图标弹出 Popover，展示：解质押总金额（如「500.11 USDe」）、剩余倒计时天数（如「7 days left」）。
  - Popover 提示文案：「Ethena unbonding can only be withdrawn in full, and any new unbonding resets the unlock time.」

---

## 4. 测试用观察地址

| 用途 | 地址 |
|------|------|
| 到期/临近到期（持仓测试） | `0xed81f8ba2941c3979de2265c295748a6b6956567`、`0xfaa8f05d068716dce1cf53b32dbb0c9ae4d0c685` |
| 当前持仓（持仓测试） | `0x81b76ff3fed28ba0b4a5d4c76bd5c13bd0641d86`、`0x9458e2007c1f3caeccd68f80fd36241bb915b657` |

导入为观察账户或切换至该账户后，用于验证 Positions 列表、仓位数量/价值、到期市场仅赎回与无 Buy 等。

---

## 5. 已知风险与依赖

- 依赖 Pendle 协议及底层资产（如 Ethena sUSDe）的合约与 API；第三方协议风险由协议方承担。
- 不同底层资产类型（Rebasing vs Interest-bearing）影响 PT 赎回与展示单位，需按资产区分校验。

---

## 6. 关联资源

- Pendle 官方文档：https://docs.pendle.finance/pendle-v2/Introduction
- 项目内规则：`docs/qa/rules/defi-rules.md`（Pendle 章节）

---

## 7. API 接口测试范围

> 以下接口用于 Pendle 协议的询价、构建交易与 Fee 验证，对应 API 测试用例：`docs/skills/apifox-testcase-generator/output/Pendle-Swap-Quote-BuildTx-Apifox-TestCases.json`

| 接口 | Method | 用途 | 关键参数 |
|------|--------|------|----------|
| `/swap/v1/quote` | GET | 询价（Buy/Sell early） | `protocol=pendle`, `fromTokenAddress`, `toTokenAddress`, `fromTokenAmount` |
| `/swap/v1/build-tx` | POST | 构建交易 | `protocol=pendle`, body 含 from/to token、金额、地址 |
| `/earn/v2/stake-protocol/detail` | GET | Pendle 协议详情 | `provider=pendle`, `symbol`, `networkId`；返回到期时间 `eventEndTime` |
| `/earn/v1/apy/history` | GET | APY 历史图表 | `provider=pendle`, `symbol`, `networkId` |
| `/earn/v1/positions` | POST | 仓位查询 | body 含 `accounts[].networkId` + `accountAddress` |
| `/earn/v1/rebate` | GET | 佣金查询 | `networkId`, `accountAddress` |
| `/earn/v1/check-amount` | GET | 金额校验 | `provider`, `symbol`, `amount`, `action` |
| `/earn/v1/estimate-fee` | GET | Gas 手续费预估 | `provider`, `symbol`, `action`, `amount` |
| `/earn/v1/transaction-confirmation` | GET | 交易确认面板 | `provider`, `symbol`, `action`, `amount` |

**Fee 双渠道验证公式**：
- 到期收益 = 金额 × 年化 × 剩余天数 / 365
- 佣金 = 金额 × OneKey fee%
- 佣金 < 到期收益 → 走 OneKey Swap（fee > 0）；否则走 Pendle Swap（fee = 0）
- 已到期 → 接口不返回 onekey fee

---

## 8. 变更记录

| 日期 | 变更内容 |
|------|----------|
| 2026-03-10 | 补充：Swap 法币价值边界（最大 $10,000,000、最小 $0.01）；Ethena 解质押投资组合展示（Unstaking via Ethena 分组、解质押金额与法币价值、Popover 倒计时天数与提示文案） |
| 2026-03-09 | 补充：API 接口测试范围（询价/构建交易/Fee 验证/仓位/详情等 9 个接口）；新增 API 测试用例文件 |
| 2026-03-03 | 初版：Pendle 协议需求（固定 APY 列、交易流程、手续费、投资组合与仓位管理） |
| 2026-03-03 | 补充：OneKey 手续费双渠道（收益覆盖则收取/否则为 0）、公式与约束、已到期不返 fee、询价与刷新机制（输入询价、刷新 5s、轮询 15s、手动 5s 节流） |
| 2026-03-03 | 补充：ETH 主网 PT-sUSDe 兑换 USDe 解质押选项（默认 Ethena 约 7 天/最优汇率，可切换 Swap 立即到账/汇率损耗；Ethena 三步、立即兑换两步） |
| 2026-03-05 | 补充：Pendle Buy / Sell early 默认对手币种为当前资产 + 账户余额最大资产；Token 列表按 Token 法币价值从高到低排序，随余额与价格动态更新 |
| 2026-03-05 | 补充：购买/售出主币不需 Approve、代币需先 Approve；不同代币精度（decimals）、最大值与最小值测试；测试用观察地址（到期 2 个、当前持仓 2 个） |
