# Swap - ChangeHero 渠道跨链测试

> 生成时间：2026-07-16
> 规则文档：`docs/qa/rules/swap-rules.md`、`docs/qa/rules/swap-network-features.md`
> 需求文档：依据 `docs/qa/rules/swap-rules.md` 中 ChangeHero 渠道规则与网络特性表编写
> 测试端：iOS / Android / Desktop / Extension / Web
> 关联文档：同链场景见 `docs/qa/testcases/cases/swap/2026-07-16_Swap-ChangeHero渠道同链测试.md`
> 参考模板：`docs/qa/testcases/cases/swap/2026-07-16_Swap-Changelly渠道跨链测试.md`

## 前置条件

- 已登录 HD 或 HW 钱包；源链主币余额充足，覆盖跨链兑换金额、源链 Gas、协议费与桥费用。
- 已准备 ChangeHero 当前支持的跨链网络样本：`Ethereum / BSC / Polygon / Avalanche / Fantom / Arbitrum / Optimism / Solana / Near / ETC / DOGE / LTC / BCH / Ripple / zkSync Era / CFX / Base / Kaspa / Tron / TON / SUI / Aptos / BTC`。
- 账户地址、`USDC / USDT` 合约地址、主币标识以 `docs/qa/rules/swap-network-features.md` 为准。
- ChangeHero 构建依赖 `quoteResultCtx`；执行时必须覆盖 `quote -> quoteResultCtx -> build-tx` 闭环。
- `BTC / LTC / BCH / DOGE / Ripple / Kaspa / Near / Solana / SUI / Aptos / Tron / TON` 不覆盖 EVM 授权流；`TON` 相关路由统一使用 `ton--mainnet`。

## 测试范围说明

**ChangeHero 跨链支持网络**：Ethereum、BSC、Polygon、Avalanche、Fantom、Arbitrum、Optimism、Solana、Near、ETC、DOGE、LTC、BCH、Ripple、zkSync Era、CFX、Base、Kaspa、Tron、TON、SUI、Aptos、BTC

**测试覆盖要求**：
- 在上述跨链网络组合中覆盖 `主币->主币`、`主币->代币`、`代币->主币`、`代币->代币` 四种类型。
- `Ethereum -> BSC` 作为最小 + 中间 + `Max` 的完整标杆。
- **金额**：稳定币默认以 `100` 为基线；EVM 主币金额按执行日约 `100 USD` 口径取值；`BTC / LTC / BCH / DOGE / XRP / KAS / SOL / NEAR / TRX / TON / SUI / APT` 按执行日市价折算中间值，并补充最小可识别精度与 `Max`。
- **授权**：EVM 网络 ERC20 作为源币时，覆盖 `Approve+Swap` 捆绑提交与 `Approve / Swap` 单独提交；非 EVM 网络不覆盖授权流。
- **测试路线**：报价测试、构建订单测试、费用测试、历史记录测试。
- **渠道标识**：询价页、确认页、历史记录中的渠道商名称为 `ChangeHero` 或产品定义的等价文案。
- **链路依赖**：ChangeHero 构建依赖 `quoteResultCtx`；刷新报价或修改金额后，必须使用最新 `quoteResultCtx` 才能进入可提交构建态。
- **非 EVM 特性**：`BTC / LTC / BCH / DOGE / Ripple / Kaspa / Near / Solana / SUI / Aptos / Tron / TON` 需重点回归地址格式、矿工费或网络费展示、订单状态流转与实际到账一致性。

---

## 1. HD 钱包跨链兑换测试（ChangeHero）

### 1.1 主币到主币（Native → Native）

#### 场景：Ethereum → BSC（ETH → BNB）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已登录 HD 钱包<br>2. 当前源链=`Ethereum`<br>3. 账户有 `ETH` 余额 | 1. 进入 Swap<br>2. 源=`ETH`（Ethereum），目标=`BNB`（BSC）<br>3. 输入**最小可识别精度**询价 | 1. 显示跨链报价，命中 `ChangeHero` 路由，且无 `errorMessage`<br>2. 返回有效 `quoteResultCtx`<br>3. `Est Received`、`Network Fee`、预估时间等字段可读取 |
| ❗️❗️P0❗️❗️ | 1. 同上，已获取有效报价 | 1. 输入**中间值**重新询价<br>2. 点击 `Max` | 1. 报价随输入刷新<br>2. `Max` 填充值为扣除源链 Gas 后的可用上限<br>3. 新报价返回新的 `quoteResultCtx` |
| ❗️❗️P0❗️❗️ | 1. 已获取有效报价 | 1. 点击 `Swap` 或等价 CTA 进入确认页 | 1. 确认页显示网络=`Ethereum -> BSC`<br>2. 支付币种 / 数量、接收币种 / 数量与输入一致<br>3. 渠道商显示 `ChangeHero`<br>4. 构建请求携带最新 `quoteResultCtx` |
| ❗️❗️P0❗️❗️ | 1. 已进入确认页 | 1. 完成签名提交流程 | 1. 提交后生成 `Pending` 记录<br>2. 订单可流转至终态<br>3. 源链 ETH、目标链 BNB 余额变化正确 |

#### 场景：BTC → Base（BTC → ETH）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前源链=`BTC`<br>2. 账户有 `BTC` 余额 | 1. 源=`BTC`，目标=`ETH`（Base）<br>2. 输入中间值询价 | 1. 返回跨链报价，命中 `ChangeHero` 且含 `quoteResultCtx`<br>2. `Network Fee` 单位为 `BTC` 或产品定义的矿工费展示单位<br>3. 不出现授权步骤 |
| P1 | 1. 已获取有效报价 | 1. 继续到确认页并提交流程 | 1. 提交后生成 `Pending` 记录<br>2. 历史记录可追溯源链交易 hash 与目标链到账结果<br>3. 终态后目标链资产增加 |

### 1.2 主币到代币（Native → Token）

#### 场景：Avalanche → Arbitrum（AVAX → USDC）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前源链=`Avalanche`<br>2. 账户有 `AVAX` 余额 | 1. 源=`AVAX`，目标=`USDC`（Arbitrum）<br>2. 输入中间值询价<br>3. 进入确认页 | 1. 返回跨链报价，命中 `ChangeHero` 且含 `quoteResultCtx`<br>2. 接收资产显示为 `USDC`，精度正确<br>3. 费用、预估时间字段可读取 |
| ❗️❗️P0❗️❗️ | 1. 已进入确认页 | 1. 完成签名提交流程 | 1. 提交后生成 `Pending` 记录<br>2. 终态后目标链 `USDC` 余额增加 |

#### 场景：Solana → zkSync Era（SOL → USDC）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前源链=`Solana`<br>2. 账户有 `SOL` 余额 | 1. 源=`SOL`，目标=`USDC`（zkSync Era）<br>2. 输入中间值询价 | 1. 返回跨链报价，命中 `ChangeHero` 且含 `quoteResultCtx`<br>2. `Network Fee` 单位为 `SOL`<br>3. 不出现授权步骤 |
| P1 | 1. 已获取有效报价 | 1. 继续到确认页并提交流程 | 1. 提交流程符合 Solana 签名特性<br>2. 终态后目标链 `USDC` 余额增加 |

### 1.3 代币到主币（Token → Native）

#### 场景：Arbitrum → Fantom（USDC → FTM）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前源链=`Arbitrum`<br>2. 账户有 `USDC` 余额 | 1. 源=`USDC`（Arbitrum），目标=`FTM`（Fantom）<br>2. 输入中间值询价 | 1. 返回跨链报价，命中 `ChangeHero` 且含 `quoteResultCtx`<br>2. 接收资产显示为 `FTM`<br>3. 源币未授权时按产品定义展示授权流 |
| ❗️❗️P0❗️❗️ | 1. 源币未授权 | 1. 观察主 CTA 并继续兑换流程 | 1. EVM 网络源币为 ERC20 时按产品定义展示授权流<br>2. 授权完成后才进入跨链提交态 |

#### 场景：Base → Ripple（USDC → XRP）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前源链=`Base`<br>2. 账户有 `USDC` 余额 | 1. 源=`USDC`（Base），目标=`XRP`（Ripple）<br>2. 输入中间值询价并进入确认页 | 1. 返回跨链报价，命中 `ChangeHero` 且含 `quoteResultCtx`<br>2. 目标链接收地址格式符合 Ripple 规则<br>3. 历史详情中的接收地址与下单一致 |

### 1.4 代币到代币（Token → Token）

#### 场景：Polygon → Base（USDT → USDC）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前源链=`Polygon`<br>2. 账户有 `USDT` 余额 | 1. 源=`USDT`（Polygon），目标=`USDC`（Base）<br>2. 输入中间值询价 | 1. 返回跨链报价，命中 `ChangeHero` 且含 `quoteResultCtx`<br>2. 接收资产显示为 `USDC`，精度正确<br>3. 未授权时按产品定义展示授权流 |

#### 场景：Aptos → Kaspa（USDC → KAS）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | 1. 当前源链=`Aptos`<br>2. 账户有可用代币余额 | 1. 源=`USDC`（Aptos），目标=`KAS`（Kaspa）<br>2. 输入中间值询价并进入确认页 | 1. 返回跨链报价，命中 `ChangeHero` 且含 `quoteResultCtx`<br>2. 非 EVM 源链与目标链地址格式校验正确<br>3. 不出现 EVM 授权文案 |

#### 场景：SUI → Tron（USDC → TRX）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | 1. 当前源链=`SUI`<br>2. 账户有 `USDC` 余额 | 1. 源=`USDC`（SUI），目标=`TRX`（Tron）<br>2. 输入中间值询价并进入确认页 | 1. 返回跨链报价，命中 `ChangeHero` 且含 `quoteResultCtx`<br>2. SUI 主币 / 代币参数口径符合客户端规则<br>3. 历史详情中的目标链与接收资产一致 |

---

## 2. HW 钱包跨链兑换测试（ChangeHero）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已连接 HW 钱包<br>2. 当前源链=`Ethereum`<br>3. 账户有 `ETH` 余额 | 1. 覆盖 `Ethereum -> BSC (ETH -> BNB)` 路由<br>2. 输入中间值询价并在设备上确认 | 1. 设备确认流程完整<br>2. App 确认页与设备展示的网络、币种、数量一致<br>3. 构建请求携带 `quoteResultCtx` |
| P1 | 1. 已连接 HW 钱包<br>2. 当前源链为 `Avalanche / Arbitrum / Solana / BTC / Aptos / SUI` 之一 | 1. 抽样覆盖 1 条 `主币->代币` 或 `代币->主币` 跨链路由<br>2. 完成授权 / 签名流程 | 1. EVM 网络代币源场景按产品定义展示授权流<br>2. 非 EVM 网络无授权步骤<br>3. 终态后余额与历史记录一致 |

---

## 3. 构建与费用验证测试（跨链）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已进入 ChangeHero 跨链确认页 | 1. 查看费用明细 | 1. 显示 `Network Fee`、预估时间等字段<br>2. 若产品展示渠道费用，则字段可读取<br>3. 渠道商名称为 `ChangeHero` |
| ❗️❗️P0❗️❗️ | 1. 已获取有效 ChangeHero 报价 | 1. 观察提交前状态 | 1. 只有携带有效 `quoteResultCtx` 才可进入可提交构建态<br>2. 缺失或过期 `quoteResultCtx` 时需重新询价 |
| ❗️❗️P0❗️❗️ | 1. 当前源链=`BTC / LTC / BCH / DOGE` 之一 | 1. 查看确认页矿工费相关字段 | 1. 矿工费字段按 UTXO 口径展示<br>2. 费用展示与链上实际扣费差异在可接受范围内 |
| P1 | 1. 当前源链=`Ripple / Kaspa / Aptos / SUI / TON / Tron` 之一 | 1. 查看确认页网络费与地址展示 | 1. 网络费单位、地址格式、目标链信息与对应链规则一致<br>2. 不误展示为 EVM Gas 文案 |
| P1 | 1. 交易已进入终态 | 1. 对比确认页费用与资产余额变化 | 1. 源资产减少值包含兑换金额与费用项（允许精度误差）<br>2. 历史详情中的费用字段与确认页口径一致 |

---

## 4. 历史记录测试（跨链）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已提交 ChangeHero 跨链兑换 | 1. 打开 Swap 历史列表 | 1. 列表及时出现 `Pending` 记录<br>2. 记录包含源链、目标链、币对、数量、状态、时间等摘要字段 |
| ❗️❗️P0❗️❗️ | 1. ChangeHero 跨链历史记录已生成 | 1. 进入详情页 | 1. `Provider` 显示 `ChangeHero`<br>2. `Rate`、`Network Fee`、费用字段可读取<br>3. 源链 / 目标链与下单一致 |
| P1 | 1. 当前记录为 `Pending` | 1. 观察状态流转 | 1. 状态可更新为 `Processing / Success / Failed`<br>2. `Status detail` 与终态一致 |
| P1 | 1. 目标链为 `Ripple / Kaspa / BTC / DOGE / Aptos / SUI / TON / Tron` 的成功订单已进入详情 | 1. 对照本次记录的接收地址 | 1. `Received address` 与本次下单地址一致<br>2. 地址格式符合对应链规则 |

---

## 5. 跨链边界与账户限制

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前误选同链场景<br>2. 源网络与目标网络一致 | 1. 进入 ChangeHero 跨链回归场景 | 1. 不将同链路由误计入跨链用例覆盖<br>2. 源链与目标链必须不同 |
| P1 | 1. 当前账户类型=`观察账户` | 1. 进入 Swap 并选择 ChangeHero 跨链路由 | 1. 显示不可提交提示或限制文案<br>2. 不进入链上签名流程 |
| P1 | 1. 当前账户类型=`外部账户` 或产品定义的不可交易账户 | 1. 进入 ChangeHero 跨链兑换流程 | 1. 保持与产品定义一致的限制行为<br>2. 不出现可执行的兑换提交态 |

---

## 变更记录

| 日期 | 版本说明 |
|------|----------|
| 2026-07-16 | 初版：新增 ChangeHero 跨链渠道手工测试用例，覆盖 `Ethereum / BSC / Polygon / Avalanche / Fantom / Arbitrum / Optimism / Solana / Near / ETC / DOGE / LTC / BCH / Ripple / zkSync Era / CFX / Base / Kaspa / Tron / TON / SUI / Aptos / BTC` 二十三条支持网络、四类跨链方向、`quoteResultCtx` 构建依赖、非 EVM 地址口径、费用与历史记录 |
