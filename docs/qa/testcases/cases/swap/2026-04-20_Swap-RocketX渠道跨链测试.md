# Swap - RocketX 渠道跨链测试

> 生成时间：2026-04-20
> 规则文档：`docs/qa/rules/swap-rules.md`、`docs/qa/rules/swap-network-features.md`
> 需求文档：（RocketX 渠道接入详情见 `swap-rules.md` §渠道白名单 / §RocketX 用例生成加速规则）
> 测试端：iOS / Android / Desktop / Extension / Web
> 关联文档：同链场景见 `2026-04-20_Swap-RocketX渠道同链测试.md`；构建依赖模型见 `swap-rules.md` §quoteResultCtx 表（RocketX = ✅ 需要）
> 参考模板：`2026-03-30_Swap-Houdini渠道跨链测试.md`
> 本文档 **仅保留 P0** 用例。

## 前置条件

1. 已登录 HD 或 HW 钱包（§2 为 HW）
2. 源链主币余额充足（覆盖跨链兑换金额 + 源链 Gas + 协议费）
3. 代币兑换前已完成源链 ERC20 授权；BTC / Solana 走各自链原生签名
4. 账户地址与代币合约地址**统一以** `swap-network-features.md` 为基线，禁止临时手填
5. 后端已接入 RocketX 跨链渠道（`provider = SwapRocketX`）且返回 `quoteResultCtx`（跨链路径 / 桥接 / 订单 ID 等）

## 测试范围说明

> ⚠️ **TODO（待产品/后端确认）**：RocketX 在 `app-monorepo` 中暂未检索到 `SwapRocketX` 相关常量，下列网络清单为**占位**。正式清单落地后必须先更新 `docs/qa/rules/swap-rules.md` 的 RocketX 网络节点，再回填本文件。

**RocketX 跨链支持网络（占位）**：Ethereum、BSC、Polygon、Arbitrum、Optimism、Base、Avalanche、Solana、BTC

**测试覆盖要求**：
- 兑换类型：在上述跨链网络组合中覆盖主币→主币、主币→代币、代币→主币、代币→代币（4 种类型）
- **金额**：最小可识别精度、中间值、**Max**（扣源链 Gas）并入 §1 各表步骤与预期，不另立边界章节；§1.1「Ethereum → BSC」为最小+中间+Max 完整示例
- 账户：软件钱包、硬件钱包
- 测试路线：报价测试、构建订单测试（**强制前置询价 + quoteResultCtx**）、手续费测试、历史记录测试
- **渠道标识**：询价路由、交易确认页、历史记录中渠道商名称为 **RocketX**（或与产品文案一致的官方名称；API 断言 `provider === 'SwapRocketX'`）

**构建依赖（强制）**：
- RocketX 跨链构建接口（`POST /swap/v1/build-tx`）**依赖 `quoteResultCtx`**（跨链路径、桥接/订单 ID 等）；每条用例必须按 `quote → 提取 RocketX quoteResultCtx → build-tx` 执行，不允许直接 build。
- `quote.data` 未命中 `SwapRocketX` 即判定 failed；命中但条目携带 `errorMessage` 判定 failed（见 K-095）；命中但无 `quoteResultCtx` 亦判定 failed。

---

## 1. 软件钱包跨链兑换测试（RocketX）

> 本节各场景在操作中应覆盖与本币对相关的**金额边界**（最小可识别精度、中间值、Max），已写在对应表格内；与 §1.1 ETH→BNB 的口径一致。

### 1.1 主币到主币（Native → Native）

#### 场景：Ethereum → BSC（ETH → BNB）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 已登录软件钱包<br>2. 选择 Ethereum 网络<br>3. 账户有 ETH 余额 | 1. 进入 Swap<br>2. 源=ETH（Ethereum），目标=BNB（BSC）<br>3. 输入**最小可识别精度**询价 | 1. 显示跨链报价，路由条目含 RocketX（`provider=SwapRocketX`）且**不含** `errorMessage`<br>2. Est Received 为 BNB，精度正确<br>3. Network Fee、Protocol Fee（如有）、Est. Time 展示正确<br>4. RocketX 条目返回 `quoteResultCtx`（非空） |
| ❗️❗️P0❗️❗️ | 1. 同上，已报价 | 1. 中间值、再测 Max | 1. 报价与余额校验正确<br>2. Max 扣除源链 Gas 后可用<br>3. `quoteResultCtx` 随询价刷新 |
| ❗️❗️P0❗️❗️ | 1. 有效报价（含 `quoteResultCtx`） | 1. 点击「兑换」<br>2. 确认页核对 | 1. 网络 Ethereum → BSC<br>2. 渠道商为 RocketX<br>3. 费用明细完整<br>4. `build-tx` 请求体**携带**询价返回的 `quoteResultCtx`（非伪造、非空） |
| ❗️❗️P0❗️❗️ | 1. 确认交易并签名 | 1. 等待终态 | 1. Pending → Processing → Success（或失败可溯源）<br>2. 源链 ETH、目标链 BNB 余额变化正确<br>3. 历史记录完整 |

#### 场景：BTC → Ethereum（BTC → ETH）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. Bitcoin 网络有余额 | 1. 源=BTC，目标=ETH（Ethereum）<br>2. 输入**最小可识别精度**询价 | 1. 显示跨链报价（命中 RocketX 且含 `quoteResultCtx`）或显示**最小限额**提示 |
| ❗️❗️P0❗️❗️ | 1. 同上 | 1. 输入**中间值**询价 | 1. RocketX 跨链报价返回，命中 RocketX 条目且含 `quoteResultCtx`<br>2. 费用与预估时间展示可读 |
| ❗️❗️P0❗️❗️ | 1. 同上 | 1. 点击 **Max** | 1. 填充为扣费后可用上限<br>2. 报价与余额校验通过 |
| ❗️❗️P0❗️❗️ | 1. 有效报价（建议取中间值执行全链路） | 1. 完成兑换并签名 | 1. `build-tx` 返回非空 `data.tx`，请求体携带 `quoteResultCtx`<br>2. 生成 Pending 历史记录，渠道为 RocketX |

### 1.2 主币到代币（Native → Token）

#### 场景：Ethereum → Polygon（ETH → USDC）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. Ethereum、有 ETH | 1. 源=ETH（Ethereum），目标=USDC（Polygon）<br>2. **最小可识别精度**询价 | 1. 跨链报价，命中 RocketX 且含 `quoteResultCtx`<br>2. USDC 精度 6<br>3. 路由含桥信息 |
| ❗️❗️P0❗️❗️ | 1. 同上、已最小值询价 | 1. 改**中间值**；再点 **Max** | 1. 报价随输入刷新<br>2. Max 扣除源链 Gas 后上限正确 |
| ❗️❗️P0❗️❗️ | 1. 已报价 | 1. 确认页 | 1. 支付 ETH、接收 USDC<br>2. 合约地址可跳转浏览器（如产品支持）<br>3. 渠道 RocketX<br>4. `build-tx` 携带 `quoteResultCtx` |
| ❗️❗️P0❗️❗️ | 1. 交易成功 | 1. 余额与记录 | 1. ETH 减少、Polygon USDC 增加<br>2. 手续费与记录一致 |

#### 场景：Solana → Ethereum（SOL → USDC）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. Solana、有 SOL | 1. 源=SOL，目标=USDC（Ethereum）<br>2. **最小可识别精度**询价 | 1. 显示跨链报价（命中 RocketX 且含 `quoteResultCtx`）或显示**最小限额**提示 |
| ❗️❗️P0❗️❗️ | 1. 同上 | 1. **中间值**询价 | 1. 跨链报价返回，命中 RocketX 条目且含 `quoteResultCtx`<br>2. Network Fee（SOL）与 Protocol Fee 展示项齐全 |
| ❗️❗️P0❗️❗️ | 1. 同上 | 1. 点 **Max** | 1. 填充为扣除 Gas + ATA 租金预留后的上限<br>2. 余额校验通过 |
| ❗️❗️P0❗️❗️ | 1. 已报价 | 1. 兑换并签名 | 1. `build-tx` 返回非空 `data.tx`，请求体携带 `quoteResultCtx`<br>2. 生成 Pending 历史记录 |

### 1.3 代币到主币（Token → Native）

#### 场景：Arbitrum → Ethereum（USDC → ETH）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. Arbitrum、USDC 已授权有余额 | 1. 源=USDC（Arbitrum），目标=ETH（Ethereum）<br>2. **最小可识别精度**询价 | 1. 跨链报价，命中 RocketX 且含 `quoteResultCtx`<br>2. Est Received 为 ETH，18 decimals |
| ❗️❗️P0❗️❗️ | 1. 同上 | 1. **中间值**询价；再点 **Max** | 1. 报价刷新正确<br>2. Max 后可用上限与余额校验通过 |
| ❗️❗️P0❗️❗️ | 1. 已报价 | 1. 确认页 | 1. 渠道 RocketX<br>2. 费用明细完整<br>3. `build-tx` 携带 `quoteResultCtx` |
| ❗️❗️P0❗️❗️ | 1. 交易成功 | 1. 余额与记录 | 1. Arbitrum USDC 减、Ethereum ETH 增<br>2. 记录一致 |

#### 场景：Polygon → BSC（USDC → BNB）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. Polygon USDC 已授权 | 1. 源=USDC（Polygon），目标=BNB（BSC）<br>2. **最小可识别精度**询价 | 1. 显示跨链报价（命中 RocketX 且含 `quoteResultCtx`）或显示最小限额提示 |
| ❗️❗️P0❗️❗️ | 1. 同上 | 1. **中间值**询价；点 **Max** | 1. 报价正确，含 `quoteResultCtx`；Max 扣费后上限正确 |
| ❗️❗️P0❗️❗️ | 1. 有效报价 | 1. 兑换至成功 | 1. 余额与记录正确 |

### 1.4 代币到代币（Token → Token）

#### 场景：Optimism → Avalanche（USDC → USDC）

> 同符号跨链（USDC↔USDC）在跨链场景允许，因合约地址分别对应不同链；不同于同链「代币<>代币禁止同地址」。

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. Optimism、USDC 已授权 | 1. 源=USDC（Optimism），目标=USDC（Avalanche）<br>2. **最小可识别精度**询价 | 1. 跨链报价，命中 RocketX 且含 `quoteResultCtx`<br>2. USDC 精度正确<br>3. 路由含桥 |
| ❗️❗️P0❗️❗️ | 1. 同上 | 1. **中间值**；点 **Max** | 1. 报价刷新；Max 上限正确 |
| ❗️❗️P0❗️❗️ | 1. 已报价 | 1. 确认并签名 | 1. 支付/接收与合约信息正确<br>2. 渠道 RocketX<br>3. `build-tx` 携带 `quoteResultCtx` |
| ❗️❗️P0❗️❗️ | 1. 交易成功 | 1. 核对 | 1. 双链代币余额变化正确<br>2. 历史记录手续费与询价一致 |

#### 场景：Base → Polygon（USDC → USDT）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. Base、USDC 已授权 | 1. 源=USDC（Base），目标=USDT（Polygon）<br>2. **最小可识别精度**询价 | 1. 显示跨链报价（命中 RocketX 且含 `quoteResultCtx`）或显示最小限额提示 |
| ❗️❗️P0❗️❗️ | 1. 同上 | 1. **中间值**；点 **Max** | 1. 报价与 Max 上限正确，含 `quoteResultCtx`<br>2. USDT decimals 正确 |
| ❗️❗️P0❗️❗️ | 1. 有效报价 | 1. 兑换至成功 | 1. 流程与记录正确 |

---

## 2. 硬件钱包跨链兑换测试（RocketX）

### 2.1 主币到主币

#### 场景：Ethereum → BSC（ETH → BNB）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 硬件钱包、Ethereum 有 ETH | 1. 跨链 ETH→BNB，中间值 | 1. 报价正确，命中 RocketX 且含 `quoteResultCtx`<br>2. 确认页渠道 RocketX |
| ❗️❗️P0❗️❗️ | 1. 已报价 | 1. 设备上确认 | 1. 跨链信息在设备可读<br>2. `build-tx` 请求体携带 `quoteResultCtx`<br>3. 签名后生成 Pending 历史记录，状态可更新为 Success / Failed |

### 2.2 主币到代币 / 代币到主币 / 代币到代币（抽样）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 硬件钱包 | 1. 各选 1 条：ETH→USDC（跨链）、USDC→ETH（跨链）、USDC→USDT（跨链），流程与 §1 同构（quote → `quoteResultCtx` → build-tx → 硬件签名），渠道为 RocketX | 1. 设备签名流程完整<br>2. 余额与记录正确 |

---

## 3. 手续费验证测试（跨链）

### 3.1 渠道服务费 / 返佣展示

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 已获取 RocketX 跨链报价 | 1. 查看确认页服务费用 | 1. 费用项清晰<br>2. 比例或金额与产品规则一致 |
| ❗️❗️P0❗️❗️ | 1. 交易成功 | 1. 对比实际扣除与页面展示 | 1. 一致或误差在文档允许范围内 |

### 3.2 Network Fee

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 已询价 | 1. 查看 Network Fee | 1. Native + 法币展示<br>2. 与链上实际 Gas 基本一致 |

### 3.3 Protocol Fee

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. RocketX 跨链报价 | 1. 查看 Protocol Fee | 1. 法币或代币计价清晰<br>2. 与 `docs/qa/rules/swap-rules.md` 跨链费用规则一致 |
| ❗️❗️P0❗️❗️ | 1. 交易成功 | 1. 对账 | 1. 展示与实际一致 |

### 3.4 手续费总和

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 交易成功 | 1. 汇总 Network + Protocol + 渠道费 | 1. 源资产减少 = 兑换数量 + 各项费用（允许精度误差） |

---

## 4. 历史记录测试（跨链）

### 4.1 记录生成与字段

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 提交交易后 | 1. 打开历史 | 1. 及时出现 Pending<br>2. 含 hash、时间、币对、数量、状态、手续费 |
| ❗️❗️P0❗️❗️ | 1. 成功订单 | 1. 查看详情 | 1. 渠道商为 RocketX<br>2. 汇率可切换方向（若产品支持）<br>3. 费用与询价时列表一致 |

### 4.2 查询与跨链状态

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 跨链订单 Pending | 1. 观察状态 | 1. Pending → Processing → Success/Failed<br>2. 与后端/链上状态同步 |

### 4.3 数据一致性

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 成功 | 1. 对比记录与当时输入 | 1. 币对、数量、精度、地址、网络费与确认页一致<br>2. **跨链**订单源链/目标链展示正确 |

---

## 变更记录

| 日期 | 版本说明 |
|------|----------|
| 2026-04-20 | 初版：参考 `2026-03-30_Swap-Houdini渠道跨链测试.md` 模板生成 RocketX 跨链 P0 用例；断言统一按 `provider === 'SwapRocketX'`；**强制** `quote → 提取 quoteResultCtx → build-tx` 闭环（对齐 `docs/qa/rules/swap-rules.md` §渠道构建依赖）；网络清单为**占位**（EVM 七条 + Solana + BTC），正式清单以产品/后端确认为准，待确认后回填 |
