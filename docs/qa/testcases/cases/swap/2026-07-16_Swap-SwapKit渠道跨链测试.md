# Swap - SwapKit 渠道跨链测试

> 生成时间：2026-07-16
> 规则文档：`docs/qa/rules/swap-rules.md`、`docs/qa/rules/swap-network-features.md`
> 需求文档：依据 `docs/qa/rules/swap-rules.md` 中 SwapKit 系列规则与网络特性表编写
> 测试端：iOS / Android / Desktop / Extension / Web
> 关联文档：`docs/qa/testcases/cases/swap/2026-07-16_Swap-历史记录测试.md`
> 参考模板：`docs/qa/testcases/cases/swap/2026-04-20_Swap-RocketX渠道跨链测试.md`

## 前置条件

- 已登录 HD 或 HW 钱包；源链主币余额充足，覆盖跨链兑换金额、源链 Gas、协议费与桥费用。
- 已准备 SwapKit 当前支持的跨链网络样本：`Ethereum / Avalanche / Base / BSC / BTC / LTC / BCH / DOGE / Arbitrum / Solana`。
- 账户地址、`USDC / USDT` 合约地址、主币标识以 `docs/qa/rules/swap-network-features.md` 为准。
- `SwapKit` 当前构建按静态参数处理，不依赖 `quoteResultCtx`；执行时不应伪造无效 `quoteResultCtx` 字段。
- EVM 网络 ERC20 作为源币时需准备未授权状态与已授权状态两类账户样本；`BTC / LTC / BCH / DOGE / Solana` 不需要授权。
- 若目标链为 `BTC`，需记录本次订单使用的新鲜接收地址；若源链为 `BTC`，需记录找零地址与 UTXO 对账结果。

## 测试范围说明

**SwapKit 跨链支持网络**：Ethereum、Avalanche、Base、BSC、BTC、LTC、BCH、DOGE、Arbitrum、Solana

**测试覆盖要求**：
- 在上述跨链网络组合中覆盖 `主币->主币`、`主币->代币`、`代币->主币`、`代币->代币` 四种类型。
- `Ethereum -> BSC` 作为最小 + 中间 + `Max` 的完整标杆。
- **金额**：稳定币默认以 `100` 为基线；EVM 主币金额按执行日约 `100 USD` 口径取值；`BTC / LTC / BCH / DOGE / SOL` 按执行日市价折算中间值，并补充最小可识别精度与 `Max`。
- **授权**：EVM 网络 ERC20 作为源币时，覆盖 `Approve+Swap` 捆绑提交与 `Approve / Swap` 单独提交；`Solana / UTXO` 不覆盖授权流。
- **测试路线**：报价测试、构建订单测试、费用测试、历史记录测试。
- **渠道标识**：询价页、确认页、历史记录中的渠道商名称为 `SwapKit`，或产品定义的 `ThorChain / MAYAChain / Chainflip` 等价路由文案。
- **链路依赖**：SwapKit 构建不依赖 `quoteResultCtx`；刷新报价或修改金额后，只要当前报价有效，即可进入可提交构建态。
- **UTXO 特性**：`BTC / LTC / BCH / DOGE` 不需要授权，需重点回归地址格式、矿工费展示、BTC 新鲜接收地址、BTC 找零地址与 UTXO 输入 / 输出对账。

---

## 1. HD 钱包跨链兑换测试（SwapKit）

### 1.1 主币到主币（Native → Native）

#### 场景：Ethereum → BSC（ETH → BNB）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已登录 HD 钱包<br>2. 当前源链=`Ethereum`<br>3. 账户有 `ETH` 余额 | 1. 进入 Swap<br>2. 源=`ETH`（Ethereum），目标=`BNB`（BSC）<br>3. 输入**最小可识别精度**询价 | 1. 显示跨链报价，命中 `SwapKit` 路由或产品定义的等价路由文案<br>2. `Est Received` 显示 `BNB` 数量，精度正确<br>3. `Network Fee`、`Protocol Fee`、预估时间等字段可读取 |
| ❗️❗️P0❗️❗️ | 1. 同上，已获取有效报价 | 1. 输入**中间值**重新询价<br>2. 点击 `Max` | 1. 报价随输入刷新<br>2. `Max` 填充值为扣除源链 Gas 后的可用上限<br>3. 不出现余额透支提示 |
| ❗️❗️P0❗️❗️ | 1. 已获取有效报价 | 1. 点击 `Swap` 或等价 CTA 进入确认页 | 1. 确认页显示网络=`Ethereum -> BSC`<br>2. 支付币种 / 数量、接收币种 / 数量与输入一致<br>3. 渠道商显示 `SwapKit` 或等价路由文案<br>4. 构建请求不依赖 `quoteResultCtx` |
| ❗️❗️P0❗️❗️ | 1. 已进入确认页 | 1. 完成签名提交流程 | 1. 提交后生成 `Pending` 记录<br>2. 订单可流转至终态<br>3. 源链 ETH、目标链 BNB 余额变化正确 |

#### 场景：BTC → Ethereum（BTC → ETH）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前源链=`BTC`<br>2. 账户有 `BTC` 余额 | 1. 源=`BTC`，目标=`ETH`（Ethereum）<br>2. 输入中间值询价 | 1. 返回跨链报价，命中 `SwapKit` 路由<br>2. `Network Fee` 单位为 `BTC` 或产品定义的矿工费展示单位<br>3. 不出现授权步骤 |
| P1 | 1. 已获取有效报价 | 1. 进入确认页并提交流程 | 1. 提交后生成 `Pending` 记录<br>2. 若本次构建产生找零输出，找零地址回到当前钱包<br>3. 终态后目标链 ETH 余额增加 |

### 1.2 主币到代币（Native → Token）

#### 场景：Avalanche → Base（AVAX → USDC）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前源链=`Avalanche`<br>2. 账户有 `AVAX` 余额 | 1. 源=`AVAX`（Avalanche），目标=`USDC`（Base）<br>2. 输入中间值询价<br>3. 进入确认页 | 1. 返回跨链报价，命中 `SwapKit`<br>2. 接收资产显示为 `USDC`，精度正确<br>3. 费用、预估时间字段可读取 |
| ❗️❗️P0❗️❗️ | 1. 已进入确认页 | 1. 完成签名提交流程 | 1. 提交后生成 `Pending` 记录<br>2. 终态后目标链 `USDC` 余额增加 |

#### 场景：Solana → Ethereum（SOL → USDC）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前源链=`Solana`<br>2. 账户有 `SOL` 余额 | 1. 源=`SOL`，目标=`USDC`（Ethereum）<br>2. 输入中间值询价 | 1. 返回跨链报价，命中 `SwapKit`<br>2. `Network Fee` 单位为 `SOL`<br>3. 不出现授权步骤 |
| P1 | 1. 已获取有效报价 | 1. 继续到确认页并提交流程 | 1. 提交流程符合 Solana 签名特性<br>2. 终态后目标链 `USDC` 余额增加 |

### 1.3 代币到主币（Token → Native）

#### 场景：Arbitrum → Avalanche（USDC → AVAX）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前源链=`Arbitrum`<br>2. 账户有 `USDC` 余额 | 1. 源=`USDC`（Arbitrum），目标=`AVAX`（Avalanche）<br>2. 输入中间值询价 | 1. 返回跨链报价，命中 `SwapKit`<br>2. 接收资产显示为 `AVAX`<br>3. 源币未授权时按产品定义展示授权流 |
| ❗️❗️P0❗️❗️ | 1. 源币未授权 | 1. 观察主 CTA 并继续兑换流程 | 1. EVM 网络源币为 ERC20 时按产品定义展示授权流<br>2. 授权完成后才进入跨链提交态 |

#### 场景：Base → Bitcoin（USDC → BTC）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前源链=`Base`<br>2. 账户有 `USDC` 余额<br>3. 已派生新的 BTC 接收地址 | 1. 源=`USDC`（Base），目标=`BTC`<br>2. 输入中间值询价并进入确认页 | 1. 返回跨链报价，命中 `SwapKit`<br>2. 目标链接收地址使用本次派生的新鲜 BTC 地址<br>3. 不复用历史已使用的 BTC 接收地址 |

### 1.4 代币到代币（Token → Token）

#### 场景：BSC → Base（USDT → USDC）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前源链=`BSC`<br>2. 账户有 `USDT` 余额 | 1. 源=`USDT`（BSC），目标=`USDC`（Base）<br>2. 输入中间值询价 | 1. 返回跨链报价，命中 `SwapKit`<br>2. 接收资产显示为 `USDC`，精度正确<br>3. 未授权时按产品定义展示授权流 |

#### 场景：Litecoin → Dogecoin（LTC → DOGE）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | 1. 当前源链=`LTC`<br>2. 账户有 `LTC` 余额 | 1. 源=`LTC`，目标=`DOGE`<br>2. 输入中间值询价并进入确认页 | 1. 返回跨链报价，命中 `SwapKit`<br>2. `Network Fee` 按 UTXO 矿工费口径展示<br>3. 不出现授权步骤 |

---

## 2. HW 钱包跨链兑换测试（SwapKit）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已连接 HW 钱包<br>2. 当前源链=`Ethereum`<br>3. 账户有 `ETH` 余额 | 1. 覆盖 `Ethereum -> BSC (ETH -> BNB)` 路由<br>2. 输入中间值询价并在设备上确认 | 1. 设备确认流程完整<br>2. App 确认页与设备展示的网络、币种、数量一致<br>3. 构建请求不依赖 `quoteResultCtx` |
| P1 | 1. 已连接 HW 钱包<br>2. 当前源链为 `Avalanche / Base / BSC / Arbitrum / Solana` 之一 | 1. 抽样覆盖 1 条 `主币->代币` 或 `代币->主币` 跨链路由<br>2. 完成授权 / 签名流程 | 1. EVM 网络代币源场景按产品定义展示授权流<br>2. Solana 无授权步骤<br>3. 终态后余额与历史记录一致 |

---

## 3. 构建与费用验证测试（跨链）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已进入 SwapKit 跨链确认页 | 1. 查看费用明细 | 1. 显示 `Network Fee`、`Protocol Fee`、预估时间等字段<br>2. 若产品展示渠道费用，则字段可读取<br>3. 渠道商名称为 `SwapKit` 或等价路由文案 |
| ❗️❗️P0❗️❗️ | 1. 已获取有效 SwapKit 报价 | 1. 观察提交前状态 | 1. 在不携带 `quoteResultCtx` 的情况下可进入可提交构建态<br>2. 不要求额外的上下文字段 |
| ❗️❗️P0❗️❗️ | 1. 当前源链=`BTC / LTC / BCH / DOGE` 之一 | 1. 查看确认页矿工费相关字段 | 1. 矿工费字段按 UTXO 口径展示<br>2. 费用展示与链上实际扣费差异在可接受范围内 |
| P1 | 1. 交易已进入终态 | 1. 对比确认页费用与资产余额变化 | 1. 源资产减少值包含兑换金额与费用项（允许精度误差）<br>2. 历史详情中的费用字段与确认页口径一致 |

---

## 4. 历史记录测试（跨链）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已提交 SwapKit 跨链兑换 | 1. 打开 Swap 历史列表 | 1. 列表及时出现 `Pending` 记录<br>2. 记录包含源链、目标链、币对、数量、状态、时间等摘要字段 |
| ❗️❗️P0❗️❗️ | 1. SwapKit 跨链历史记录已生成 | 1. 进入详情页 | 1. `Provider` 显示 `SwapKit`、`ThorChain`、`MAYAChain` 或 `Chainflip` 中之一，且与实际路由一致<br>2. `Rate`、`Network Fee`、费用字段可读取<br>3. 源链 / 目标链与下单一致 |
| P1 | 1. 当前记录为 `Pending` | 1. 观察状态流转 | 1. 状态可更新为 `Processing / Success / Failed`<br>2. `Status detail` 与终态一致 |
| P1 | 1. 目标链为 `BTC` 的成功订单已进入详情 | 1. 对照本次记录的 BTC 新鲜地址 | 1. `Received address` 与本次派生的新鲜地址一致 |
| P1 | 1. 源链为 `BTC` 的成功订单已进入详情 | 1. 查看详情并对照链上明细 | 1. 可追溯到本次找零地址<br>2. 找零地址属于当前钱包 |

---

## 5. 跨链边界与账户限制

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前误选同链场景<br>2. 源网络与目标网络一致 | 1. 进入 SwapKit 跨链回归场景 | 1. 不将同链路由误计入跨链用例覆盖<br>2. 源链与目标链必须不同 |
| P1 | 1. 当前账户类型=`观察账户` | 1. 进入 Swap 并选择 SwapKit 跨链路由 | 1. 显示不可提交提示或限制文案<br>2. 不进入链上签名流程 |
| P1 | 1. 当前账户类型=`外部账户` 或产品定义的不可交易账户 | 1. 进入 SwapKit 跨链兑换流程 | 1. 保持与产品定义一致的限制行为<br>2. 不出现可执行的兑换提交态 |

---

## 变更记录

| 日期 | 版本说明 |
|------|----------|
| 2026-07-16 | 初版：新增 SwapKit 跨链渠道手工测试用例，覆盖 `Ethereum / Avalanche / Base / BSC / BTC / LTC / BCH / DOGE / Arbitrum / Solana` 十条支持网络、四类跨链方向、无 `quoteResultCtx` 构建、UTXO 地址与找零校验、费用与历史记录 |
