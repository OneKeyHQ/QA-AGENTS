# Swap - RocketX 渠道同链测试

> 生成时间：2026-04-20
> 规则文档：`docs/qa/rules/swap-rules.md`、`docs/qa/rules/swap-network-features.md`
> 需求文档：（RocketX 渠道接入详情见 `swap-rules.md` §渠道白名单 / §RocketX 用例生成加速规则）
> 测试端：iOS / Android / Desktop / Extension / Web
> 关联文档：跨链场景见 `2026-04-20_Swap-RocketX渠道跨链测试.md`；构建依赖模型见 `swap-rules.md` §quoteResultCtx 表（RocketX = ✅ 需要）
> 参考模板：`2026-03-30_Swap-Houdini渠道同链测试.md`
> 本文档 **仅保留 P0** 用例。

## 前置条件

1. 已登录 HD 或 HW 钱包（§2 为 HW）
2. 所测试网络主币余额充足（覆盖兑换 + Gas，必要时包含 Solana ATA 租金）
3. 代币兑换前已完成对应 ERC20 授权（EVM 链），或持有 SPL 代币（Solana）
4. 账户地址与代币合约地址**统一以** `swap-network-features.md` 为基线，禁止临时手填
5. 后端已接入 RocketX 渠道（`provider = SwapRocketX`）且返回 `quoteResultCtx`

## 测试范围说明

> ⚠️ **TODO（待产品/后端确认）**：RocketX 在 `app-monorepo` 中暂未检索到 `SwapRocketX` 相关常量，下列网络清单为**占位**。正式清单落地后必须先更新 `docs/qa/rules/swap-rules.md` 的 RocketX 网络节点，再回填本文件。

**RocketX 同链支持网络（占位）**：Ethereum、BSC、Polygon、Arbitrum、Optimism、Base、Avalanche、Solana、BTC

> 说明：BTC 为 UTXO 链，通常只作为跨链源/目标；同链在本文件中不强制覆盖 BTC，若后端确认同链可用再补。

**测试覆盖要求**：
- 兑换类型：在上述网络内覆盖主币→代币、代币→主币、代币→代币（3 种类型）
- **金额**：最小可识别精度、中间值、**Max**（扣 Gas）并入 §1 各表步骤与预期，不另立边界章节；§1.1「Ethereum 同链（ETH → USDC）」为最小+中间+Max 完整示例
- 账户：软件钱包、硬件钱包
- 测试路线：报价测试、构建订单测试（**强制前置询价 + quoteResultCtx**）、手续费测试、历史记录测试
- **渠道标识**：询价路由、交易确认页、历史记录中渠道商名称为 **RocketX**（或与产品文案一致的官方名称；API 断言 `provider === 'SwapRocketX'`）

**构建依赖（强制）**：
- RocketX 构建接口（`POST /swap/v1/build-tx`）**依赖 `quoteResultCtx`**；每条用例必须按 `quote → 提取 RocketX quoteResultCtx → build-tx` 执行，不允许直接 build。
- `quote.data` 未命中 `SwapRocketX` 即判定 failed；命中但条目携带 `errorMessage` 判定 failed（见 K-095）；命中但无 `quoteResultCtx` 亦判定 failed。

---

## 1. 软件钱包同链兑换测试（RocketX）

> 前提：源代币与目标代币均在 **同一网络**；路由命中 RocketX 同链路径（断言 `provider === 'SwapRocketX'`）。
> 本节各场景应覆盖与本币对相关的**金额边界**（最小可识别精度、中间值、Max），已写在对应表格内；与 §1.1 ETH→USDC 的口径一致。

### 1.1 主币到代币（Native → Token）

#### 场景：Ethereum 同链（ETH → USDC）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 已登录软件钱包<br>2. 选择 Ethereum 网络<br>3. 账户有 ETH 余额 | 1. 进入 Swap 页面<br>2. 源=ETH，目标=USDC（均为 Ethereum）<br>3. **最小可识别精度**询价 | 1. 显示同链报价，路由条目含 RocketX（`provider=SwapRocketX`）且**不含** `errorMessage`<br>2. Est Received 为 USDC，精度正确（6 decimals）<br>3. Network Fee 为 ETH+法币<br>4. RocketX 条目返回 `quoteResultCtx`（非空） |
| ❗️❗️P0❗️❗️ | 1. 同上 | 1. 输入**中间值**（如余额 50%） | 1. 报价刷新，Est Received、Network Fee 更新<br>2. 费用与展示一致<br>3. `quoteResultCtx` 随每次询价刷新 |
| ❗️❗️P0❗️❗️ | 1. 同上 | 1. 点击 **Max** | 1. 自动填充扣 Gas 后可用上限<br>2. 余额检查通过<br>3. 报价正确 |
| ❗️❗️P0❗️❗️ | 1. 已获取有效 RocketX 报价（含 `quoteResultCtx`） | 1. 点击「兑换」<br>2. 交易确认页核对 | 1. 网络为 Ethereum（同链，无跨链误文案）<br>2. 支付/接收与询价一致<br>3. 渠道为 RocketX<br>4. `build-tx` 请求体**携带**询价返回的 `quoteResultCtx`（非伪造、非空） |
| ❗️❗️P0❗️❗️ | 1. 交易成功 | 1. 核对余额与历史记录 | 1. ETH 减少与兑换+Gas 一致<br>2. USDC 余额增加<br>3. 历史记录完整，渠道 RocketX |

#### 场景：Solana 同链（SOL → USDC）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 已登录软件钱包<br>2. Solana、有 SOL | 1. 源=SOL，目标=USDC（均为 Solana）<br>2. **最小可识别精度**询价 | 1. 显示同链报价（命中 RocketX 且含 `quoteResultCtx`）或显示**最小限额**提示 |
| ❗️❗️P0❗️❗️ | 1. 同上 | 1. **中间值**询价 | 1. 同链报价返回，命中 RocketX 条目且含 `quoteResultCtx`<br>2. Est Received、Network Fee（lamports 展示）精度与链规则一致 |
| ❗️❗️P0❗️❗️ | 1. 同上 | 1. 点 **Max** | 1. 自动填充扣 Gas + ATA 租金后的可用上限<br>2. 余额校验通过（不显示「余额不足」提示） |
| ❗️❗️P0❗️❗️ | 1. 已报价 | 1. 完成兑换并签名 | 1. `build-tx` 返回非空 `data.tx`，请求体携带询价返回的 `quoteResultCtx`<br>2. 生成 Pending 历史记录，渠道为 RocketX |

### 1.2 代币到主币（Token → Native）

#### 场景：BSC 同链（USDT → BNB）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. BSC、USDT 已授权有余额 | 1. 源=USDT，目标=BNB（均为 BSC）<br>2. **最小可识别精度**询价 | 1. 同链报价返回，命中 RocketX 条目且含 `quoteResultCtx`<br>2. Est Received 为 BNB，精度与链规则一致 |
| ❗️❗️P0❗️❗️ | 1. 同上 | 1. **中间值**询价；点 **Max** | 1. 报价刷新<br>2. Max 扣费后上限正确 |
| ❗️❗️P0❗️❗️ | 1. 有效报价 | 1. 兑换至成功 | 1. USDT 减、BNB 增与记录一致<br>2. `build-tx` 携带 `quoteResultCtx` |

#### 场景：Base 同链（USDC → ETH）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. Base、USDC 已授权有余额 | 1. 源=USDC，目标=ETH（均为 Base）<br>2. **最小可识别精度**询价 | 1. 显示同链报价（命中 RocketX 且含 `quoteResultCtx`）或显示最小限额提示 |
| ❗️❗️P0❗️❗️ | 1. 同上 | 1. **中间值**；点 **Max** | 1. RocketX 同链报价正确，含 `quoteResultCtx`<br>2. 确认页网络为 Base，无跨链桥误展示<br>3. Max 上限正确 |
| ❗️❗️P0❗️❗️ | 1. 有效报价 | 1. 兑换至成功 | 1. 余额与记录正确 |

### 1.3 代币到代币（Token → Token）

#### 场景：Polygon 同链（USDC → USDT）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. Polygon、USDC 已授权 | 1. 源=USDC，目标=USDT（均为 Polygon）<br>2. **最小可识别精度**询价 | 1. 同链报价，命中 RocketX 且含 `quoteResultCtx`<br>2. 两代币 decimals 正确<br>3. 路由/DEX 清晰 |
| ❗️❗️P0❗️❗️ | 1. 同上 | 1. **中间值**；点 **Max** | 1. 报价刷新；Max 上限正确 |
| ❗️❗️P0❗️❗️ | 1. 已报价 | 1. 兑换并确认 | 1. `build-tx` 返回非空 `data.tx`，请求体携带 `quoteResultCtx`<br>2. 状态可更新为 Success / Failed<br>3. 历史记录渠道为 RocketX |

#### 场景：Arbitrum 同链（USDC → USDT）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. Arbitrum、USDC 已授权 | 1. 源=USDC，目标=USDT（均为 Arbitrum）<br>2. **最小可识别精度**询价 | 1. RocketX 同链报价，含 `quoteResultCtx` |
| ❗️❗️P0❗️❗️ | 1. 同上 | 1. **中间值**；点 **Max** | 1. 报价刷新正确；Max 扣费后上限正确 |
| ❗️❗️P0❗️❗️ | 1. 有效报价 | 1. 兑换至成功 | 1. 余额与记录一致 |

---

## 2. 硬件钱包同链兑换测试（RocketX）

> **金额边界**以 §1 软件钱包同币对为口径抽样（可补测 Max）；下列为硬件主流程 P0。
> 硬件签名前 `build-tx` 必须已经通过 `quote → quoteResultCtx` 闭环生成（断言同 §1）。

### 2.1 主币到代币

#### 场景：Ethereum 同链（ETH → USDC）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 已连接硬件钱包<br>2. Ethereum、有 ETH | 1. 同链 ETH→USDC，**中间值**询价 | 1. 报价正确，命中 RocketX 且含 `quoteResultCtx`<br>2. 渠道/路由为 RocketX |
| ❗️❗️P0❗️❗️ | 1. 已报价 | 1. 兑换并在设备上确认 | 1. 设备显示与 App 一致<br>2. `build-tx` 请求体携带 `quoteResultCtx`<br>3. 签名后生成 Pending 历史记录，状态可更新为 Success / Failed |

### 2.2 代币到主币 / 代币到代币（抽样）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 硬件钱包<br>2. 任选已支持网络上一组「代币→主币」或「代币→代币」同链 | 1. 完整流程（quote → 提取 `quoteResultCtx` → build-tx → 硬件签名） | 1. 签名在硬件完成<br>2. 状态更新为 Success 后，账户余额变化与历史记录一致，渠道商=RocketX |

---

## 3. 手续费验证测试（同链）

### 3.1 渠道服务费 / 返佣展示

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 已获取 RocketX 同链报价 | 1. 查看确认页服务费用 | 1. 费用项清晰<br>2. 比例或金额与产品规则一致 |
| ❗️❗️P0❗️❗️ | 1. 交易成功 | 1. 对比实际扣除与页面展示 | 1. 一致或误差在文档允许范围内 |

### 3.2 Network Fee

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 已询价 | 1. 查看 Network Fee | 1. Native + 法币展示<br>2. 与链上实际 Gas 基本一致 |

### 3.3 手续费总和（同链）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 交易成功 | 1. 汇总 Network Fee + 渠道相关费用（按产品展示项） | 1. 源资产减少与兑换数量+费用一致（允许精度误差） |

---

## 4. 历史记录测试（同链）

### 4.1 记录生成与字段

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 提交交易后 | 1. 打开历史 | 1. 及时出现 Pending<br>2. 含 hash、时间、币对、数量、状态、手续费 |
| ❗️❗️P0❗️❗️ | 1. 成功订单 | 1. 查看详情 | 1. 渠道商为 RocketX<br>2. 汇率可切换方向（若产品支持）<br>3. 费用与询价时列表一致 |

### 4.2 查询与状态

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 同链交易 Pending | 1. 观察状态至终态 | 1. 状态流转正确，与链上一致 |

### 4.3 数据一致性

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 成功 | 1. 对比记录与当时输入 | 1. 币对、数量、精度、地址、网络费与确认页一致<br>2. **无**错误跨链文案（单网络） |

---

## 变更记录

| 日期 | 版本说明 |
|------|----------|
| 2026-04-20 | 初版：参考 `2026-03-30_Swap-Houdini渠道同链测试.md` 模板生成 RocketX 同链 P0 用例；断言统一按 `provider === 'SwapRocketX'`；**强制** `quote → 提取 quoteResultCtx → build-tx` 闭环（对齐 `docs/qa/rules/swap-rules.md` §渠道构建依赖）；网络清单为**占位**（EVM 七条 + Solana），正式清单以产品/后端确认为准，待确认后回填 |
