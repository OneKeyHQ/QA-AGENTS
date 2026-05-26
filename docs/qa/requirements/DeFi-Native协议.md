# DeFi - Native 协议（Earn）

> **需求来源**：PR [#11717](https://github.com/OneKeyHQ/app-monorepo/pull/11717) — `fix: support Native Earn stake/withdraw/claim flows (OK-54973)`
> **Jira**：[OK-54973](https://onekeyhq.atlassian.net/browse/OK-54973)
> **目标版本**：`release/v6.3.0`
> **测试端**：桌面端 / Extension / Web（默认全端）
> **规则文档**：`docs/qa/rules/defi-rules.md`（Native 章节）

---

## 1. 协议概述

| 项 | 说明 |
|---|---|
| 协议名 | Native（自管 Vault 收益协议） |
| 支持资产 | `ETH`、`WETH`、`USDT` |
| Vault | `Native USDT`（USDT 独立 Vault）、`Native managed WETH`（WETH Vault，同时支持 ETH/WETH 两种 stake-token） |
| 网络 | Ethereum |
| 入口 | DeFi → 资产列表 → 选择 ETH / WETH / USDT → 选择 Native 渠道 |

---

## 2. Stake（存入）

| Stake Type | 触发条件 | 流程 | 接口字段 |
|---|---|---|---|
| `normal` | 直接使用 USDT / WETH 存入对应 Vault | Approve → Deposit（2 步） | `/earn/v2/stake` 携带 `stakeType=normal` |
| `wrap` | WETH Vault 选择 ETH 作为 stake-token | Wrap（ETH→WETH） → Approve → Deposit（3 步） | `/earn/v2/stake` 携带 `stakeType=wrap` |

**关键约束**：
- WETH Vault 的 stake-token 列表通过 `/earn/v1/asset-list` 返回，包含 WETH 与 ETH。
- `/earn/v1/transaction-confirmation` **不携带** `stakeType`；该字段仅出现在 check-amount / fee / build stake 路径。
- Token 选择器列表按法币价值（余额 × 单价）由高到低排序。

---

## 3. Withdraw（赎回）

| Withdraw Type | 流程 | 到账时间 | 手续费 | 接口字段 |
|---|---|---|---|---|
| `instant` | Approve（如需）→ Withdraw（1 步或 2 步） | 立即 | 收取 withdrawal fee（如 0.03%） | `withdrawType=instant` |
| `queued` | Approve receipt token → Withdraw 入队 | 约 9 天（ETH 7-9 天） | 无 fee | `withdrawType=queued` |
| `cancel` | 直接对 pending 队列发起取消交易 | 立即（取消后 Active 回补） | 无 fee | `withdrawType=cancel` |

**关键约束**：
- 在 Withdraw 面板从 Instant ↔ Queued 切换时，必须重新请求 `check-amount` 与 `transaction-confirmation`，前端展示的到账金额、fee 数据按当前选项更新。
- Queued 路径需要授权 receipt token；该授权步骤在 Stepper 中独立展示。
- 个别 Withdraw 选项暂时不可用时显示停用样式（设计稿中「暂时还不可用」黄色提示）。
- `withdrawPath.data.tip` 字段决定面板内的提示文案。

---

## 4. Cancel Withdrawal

| 项 | 说明 |
|---|---|
| 触发入口 | Positions 列表中 Native 分组「Withdrawal requested」行尾的 Cancel 链接；或通过 DeFi Portfolio 的 Cancel 动作进入 |
| 跳转目的页 | Withdraw 页面，标题或子项为 Cancel withdrawal |
| 数据回退 | `CancelWithdrawal.data.token` 缺失时，使用 `symbol/provider` fallback 打开 Withdraw 页面（PR 评审已修复） |
| 取消后状态 | Active 持仓金额回补，Withdrawal requested 行从 Positions 中移除 |

---

## 5. Claim（领取）

| Claim Type | 来源 | 接口字段 |
|---|---|---|
| `normal` | 普通收益 / Queued 到期后的本金 | `/earn/v2/claim` 携带 `claimType=normal`（或不传） |
| `airdrop` | `airdropAssets[]` 形式的空投奖励 | `/earn/v2/claim` 携带 `claimType=airdrop` |

**关键约束**：
- airdrop claim 不影响 normal claim 行为；两者互不污染。
- Claimable 数量为 0 时，Claim 入口隐藏或禁用。

---

## 6. Positions（持仓展示）

设计稿（Image #1）显示 Native 分组下每个代币行可同时承载三类状态：

| 列 | 内容 |
|---|---|
| Deposits | 本金数量 + USD 估值 |
| Est. 24h earnings | 24 小时预估收益（USD） |
| Asset status | Active 数量、Withdrawal requested 数量（含 Cancel 链接）、Claim 链接 |
| Claimable | 待领取数量 + USD 估值，附 Claim 入口 |
| 操作 | Manage 按钮，进入对应代币的 Manage 面板 |

**Withdrawal requested 详情弹窗**（点击 ⓘ 图标）：
- 排队中的金额（如 20 USDT）
- 剩余倒计时（如「1 days left」）
- 提示文案：`After the above time period, then your staked assets will be available to claim.`

---

## 7. APY 与详情页

| 元素 | 说明 |
|---|---|
| 顶部 APY | 当前 APY（如 5.00%），附走势图与时间范围（1H / 1D / 1W / Max） |
| Yield 弹窗 | Base APY / Native APY、Performance fee（负值）、Last day / Last week / Last month |
| Intro | Reward Token、Network、Vault、Vault manager |
| Performance | Last day / Last week / Last month 三档 |
| Native 介绍 | 协议简介 + Show more 展开，含 TVL、FDV、Established |
| Team members | 团队成员列表 |
| 外链 | Website、X、Discord |
| FAQs | 多个常见问题条目，独立展开 / 收起 |
| WETH 详情页特有 | Yield 弹窗底部显示「Withdrawals take 7-9 days for ETH」 |

---

## 8. 关联资源

- **PR**：https://github.com/OneKeyHQ/app-monorepo/pull/11717
- **Jira**：OK-54973
- **后端契约**：`OneKeyHQ/server-service-earn` `origin/feat/native@3ee58795`
  - `StakeParamsDTO.stakeType?: 'wrap' | 'normal'`
  - `UnstakeParamsDTO.withdrawType?: 'instant' | 'queued' | 'cancel'`
  - `ClaimParamDTO.claimType?: 'normal' | 'airdrop'`
  - `TransactionConfirmationParamsDTO` 支持 `withdrawType`，不支持 `stakeType`
- **设计稿**：Positions、USDT 详情/Deposit/Withdraw、WETH 详情/Deposit/Withdraw（3 图）

---

## 9. 变更记录

| 日期 | 内容 |
|---|---|
| 2026-05-22 | 初始版本，依据 PR #11717 与设计稿创建 |
