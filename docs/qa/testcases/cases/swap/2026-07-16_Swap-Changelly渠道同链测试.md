# Swap - Changelly 渠道同链测试

> 生成时间：2026-07-16
> 规则文档：`docs/qa/rules/swap-rules.md`、`docs/qa/rules/swap-network-features.md`
> 需求文档：依据 `docs/qa/rules/swap-rules.md` 中 Changelly 渠道规则与网络特性表编写
> 测试端：iOS / Android / Desktop / Extension / Web
> 关联文档：跨链场景见 `docs/qa/testcases/cases/swap/2026-07-16_Swap-Changelly渠道跨链测试.md`
> 参考模板：`docs/qa/testcases/cases/swap/2026-07-16_Swap-OKX渠道同链测试.md`

## 前置条件

- 已登录 HD 或 HW 钱包；各测试网络主币余额与网络费余额充足。
- 已准备 Changelly 当前支持的同链网络样本：`Tron / Solana / TON`。
- 账户地址、`USDC / USDT` 合约地址、主币标识以 `docs/qa/rules/swap-network-features.md` 为准。
- Changelly 构建依赖 `quoteResultCtx`；每条同链用例均需覆盖 `quote -> quoteResultCtx -> build-tx` 闭环。
- `Tron` 默认使用已验证地址 `TTZMu9v3cxs3dGhoUABBmE672MN8hsNfb8`；`TON` 同链统一使用 `ton--mainnet`；`Solana / TON / Tron` 不覆盖 EVM 授权流。

## 测试范围说明

**Changelly 同链支持网络**：Tron、Solana、TON

**同链兑换类型覆盖**：
- 主币→代币（Native → Token）
- 代币→主币（Token → Native）
- 代币→代币（Token → Token）

**测试覆盖要求**：
- Changelly 同链仅覆盖 `Tron / Solana / TON`，源网络与目标网络一致时才计入本用例。
- 每个支持网络至少覆盖 1 条同链兑换；整体需覆盖 `Native -> Token`、`Token -> Native`、`Token -> Token` 三类方向。
- **金额**：稳定币默认以 `100` 为基线；主币金额按执行日约 `100 USD` 口径取值；`Tron` 作为最小 + 中间 + `Max` 的完整标杆。
- **构建依赖**：确认页与提交前必须已拿到有效 `quoteResultCtx`；缺失 `quoteResultCtx` 不应进入可提交构建态。
- **渠道标识**：询价页、确认页、历史记录中的渠道商名称为 `Changelly` 或产品定义的等价文案。
- **特殊链路**：
  - `Tron` 同链优先覆盖 `TRX <-> USDT`，不将已知不支持的 `TRX <-> USDC`、`USDT -> USDC` 混入成功路径。
  - `Solana` 同链优先覆盖 `SOL -> USDC`、`USDC -> SOL`、`USDC -> USDT`。
  - `TON` 同链优先覆盖 `TON -> USDT(TON)`、`USDT(TON) -> TON`。

---

## 1. HD 钱包同链兑换测试（Changelly）

### 1.1 网络：Tron（标杆：最小 + 中间 + Max 完整示例）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已登录 HD 钱包<br>2. 当前网络=`Tron`<br>3. 账户有 `TRX` 余额 | 1. 进入 Swap<br>2. 源=`TRX`，目标=`USDT`（Tron）<br>3. 输入**最小可识别精度**询价 | 1. 返回同链报价<br>2. 路由条目命中 `Changelly`，且无 `errorMessage`<br>3. 返回有效 `quoteResultCtx`<br>4. `Est Received`、`Network Fee`、汇率字段可读取 |
| ❗️❗️P0❗️❗️ | 1. 同上，已获取有效报价 | 1. 输入**中间值**重新询价<br>2. 点击 `Max` | 1. 报价随输入刷新<br>2. `Max` 填充值为扣除网络费后的可用上限<br>3. 不出现余额透支提示 |
| ❗️❗️P0❗️❗️ | 1. 已获取有效报价 | 1. 点击 `Swap` 或等价 CTA 进入确认页 | 1. 确认页显示网络=`Tron`<br>2. 支付币种 / 数量、接收币种 / 数量与输入一致<br>3. 渠道商显示 `Changelly`<br>4. 构建请求携带询价返回的 `quoteResultCtx` |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`Tron`<br>2. 源=`USDT`<br>3. 账户有 `USDT` 余额 | 1. 源=`USDT`，目标=`TRX`<br>2. 输入中间值询价并继续提交 | 1. 返回 `Token -> Native` 报价<br>2. 不出现 EVM `Approve` 授权流<br>3. 提交后生成 `Pending` 记录并可流转至终态 |
| P1 | 1. 当前网络=`Tron`<br>2. 已准备已知不支持币对样本 | 1. 尝试 `TRX -> USDC`、`USDT -> USDC` 询价 | 1. 页面展示不支持该交易对或无有效报价<br>2. 不误展示为可提交状态 |

### 1.2 网络：Solana

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`Solana`<br>2. 账户有 `SOL` 余额 | 1. 源=`SOL`，目标=`USDC`<br>2. 输入中间值询价<br>3. 进入确认页 | 1. 返回同链报价，命中 `Changelly` 且含 `quoteResultCtx`<br>2. `Network Fee` 单位为 `SOL`<br>3. 不出现授权步骤 |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`Solana`<br>2. 账户有 `USDC` 余额 | 1. 覆盖 `USDC -> SOL`<br>2. 再覆盖 `USDC -> USDT` | 1. 两个方向均可返回有效报价<br>2. `Token -> Native` 与 `Token -> Token` 的确认页字段完整<br>3. 构建请求均携带 `quoteResultCtx` |
| P1 | 1. 报价带刷新倒计时或过期机制 | 1. 等待报价失效后点击 `Swap` | 1. 触发重新询价或报价失效提示<br>2. 刷新后的 `quoteResultCtx` 被重新用于构建 |

### 1.3 网络：TON

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`TON`<br>2. 账户有 `TON` 余额 | 1. 源=`TON`，目标=`USDT(TON)`<br>2. 输入中间值询价 | 1. 返回同链报价，命中 `Changelly` 且含 `quoteResultCtx`<br>2. `networkId` 口径使用 `ton--mainnet`<br>3. `Network Fee` 单位为 `TON` |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`TON`<br>2. 账户有 `USDT(TON)` 余额 | 1. 源=`USDT(TON)`，目标=`TON`<br>2. 输入中间值询价并提交 | 1. 返回 `Token -> Native` 报价<br>2. 不出现授权步骤<br>3. 历史记录生成并可更新至终态 |

---

## 2. HW 钱包同链兑换测试（Changelly）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已连接 HW 钱包<br>2. 当前网络=`Tron / Solana / TON` 之一<br>3. 账户有对应资产余额 | 1. 抽样覆盖 1 条 `Native -> Token` 同链路由<br>2. 进入确认页并在设备上完成签名 | 1. 设备确认流程完整<br>2. App 确认页与设备展示的网络、币种、数量一致<br>3. 构建请求携带 `quoteResultCtx` |
| P1 | 1. 已连接 HW 钱包<br>2. 当前网络=`Solana` 或 `TON` | 1. 抽样覆盖 1 条 `Token -> Native` 或 `Token -> Token` 路由 | 1. 不出现 EVM 授权文案<br>2. 终态后余额与历史记录一致 |

---

## 3. 构建与费用验证测试（同链）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已进入 Changelly 同链确认页 | 1. 查看费用明细 | 1. 显示 `Network Fee`、汇率、预估时间等字段<br>2. 若产品展示渠道费用，则字段可读取<br>3. 渠道商名称为 `Changelly` |
| ❗️❗️P0❗️❗️ | 1. 已获取有效 Changelly 报价 | 1. 修改金额后重新询价<br>2. 再次进入确认页 | 1. 报价刷新后返回新的 `quoteResultCtx`<br>2. 构建阶段使用最新 `quoteResultCtx`<br>3. 不因缺少上下文导致确认页卡死 |
| P1 | 1. 交易已进入终态 | 1. 对比确认页费用与资产余额变化 | 1. 源资产减少值包含兑换金额与费用项（允许精度误差）<br>2. 历史详情中的费用字段与确认页口径一致 |

---

## 4. 历史记录测试（同链）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已提交 Changelly 同链兑换 | 1. 打开 Swap 历史列表 | 1. 列表及时出现 `Pending` 记录<br>2. 记录包含币对、数量、状态、时间等摘要字段 |
| ❗️❗️P0❗️❗️ | 1. Changelly 历史记录已生成 | 1. 进入详情页 | 1. `Provider` 显示 `Changelly`<br>2. `Rate`、`Network Fee`、费用字段可读取<br>3. 网络与交易对与下单一致 |
| P1 | 1. 当前记录为 `Pending` | 1. 观察状态流转 | 1. 状态可更新为 `Success` 或 `Failed`<br>2. `Status detail` 与终态一致 |

---

## 5. 同链边界与账户限制

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前选择跨链场景<br>2. 源网络与目标网络不一致 | 1. 进入 Changelly 回归场景 | 1. 不将跨链路由误计入同链用例覆盖<br>2. 源链与目标链必须相同 |
| P1 | 1. 当前账户类型=`观察账户` | 1. 进入 Swap 并选择 Changelly 同链路由 | 1. 显示不可提交提示或限制文案<br>2. 不进入链上签名流程 |
| P1 | 1. 当前账户类型=`外部账户` 或产品定义的不可交易账户 | 1. 进入 Changelly 同链兑换流程 | 1. 保持与产品定义一致的限制行为<br>2. 不出现可执行的兑换提交态 |

---

## 变更记录

| 日期 | 版本说明 |
|------|----------|
| 2026-07-16 | 初版：新增 Changelly 同链渠道手工测试用例，覆盖 `Tron / Solana / TON` 三条支持网络、三类同链方向、`quoteResultCtx` 构建依赖、Tron 地址口径、TON `ton--mainnet`、费用与历史记录 |
