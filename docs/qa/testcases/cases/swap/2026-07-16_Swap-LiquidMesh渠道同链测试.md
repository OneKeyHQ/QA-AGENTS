# Swap - LiquidMesh 渠道同链测试

> 生成时间：2026-07-16
> 规则文档：`docs/qa/rules/swap-rules.md`、`docs/qa/rules/swap-network-features.md`
> 需求文档：依据 `docs/qa/rules/swap-rules.md` 中 LiquidMesh 渠道规则与网络特性表编写
> 测试端：iOS / Android / Desktop / Extension / Web
> 关联文档 / 参考模板：`docs/qa/testcases/cases/swap/2026-07-16_Swap-OKX渠道同链测试.md`

## 前置条件

- 已登录 HD 或 HW 钱包；各测试网络主币余额与网络费余额充足。
- 已准备 `LiquidMesh` 当前支持的同链网络样本：`Ethereum / BSC / Base / Solana / Tron / Sonic / SUI`。
- 账户地址、`USDC / USDT` 合约地址、主币标识以 `docs/qa/rules/swap-network-features.md` 为准。
- EVM 网络需准备未授权状态与已授权状态两类账户样本；`Solana / SUI` 不需要授权；`Tron` 的 `TRC20` 源币场景需要授权。
- 若需联调渠道链路，LiquidMesh 询价走普通 `/swap/v1/quote`，构建阶段必须复用 quote 返回的 `quoteResultCtx.liquidMeshQuoteResultCtx`。
- 建议优先准备以下已验证金额 / 路由基线：
  - `Ethereum`：`ETH -> USDC`、`USDC -> ETH`、`USDC -> USDT`
  - `BSC`：`BNB -> USDC`、`USDC -> BNB`、`USDC -> USDT`
  - `Base`：`ETH -> USDC`、`USDC -> ETH`、`USDC -> USDT`
  - `Solana`：`SOL -> USDC`，金额优先使用 `0.2`
  - `Sonic`：`USDC -> SONIC`

## 测试范围说明

**LiquidMesh 同链支持网络**：Ethereum、BSC、Base、Solana、Tron、Sonic、SUI

**同链兑换类型覆盖**：
- 主币→代币（Native → Token）
- 代币→主币（Token → Native）
- 代币→代币（Token → Token，禁止同币对）

**测试覆盖要求**：
- `LiquidMesh` 仅覆盖**同链**，不覆盖跨链；源网络与目标网络不一致时，不应命中 `LiquidMesh` 路由。
- `Ethereum / BSC / Base` 作为 EVM 标杆网络，需覆盖 `Native -> Token`、`Token -> Native`、`Token -> Token` 三类方向，以及授权流。
- `Solana / Tron / Sonic / SUI` 作为异构链 / 特殊网络覆盖，其中：
  - `Solana` 重点验证 `SOL -> USDC` 已验证成功路由，以及 `USDC -> SOL / USDT` 的业务层兜底表现
  - `Tron / SUI` 按支持矩阵执行同链回归，若当前版本仍未命中 `LiquidMesh`，记录为渠道支持回归问题
  - `Sonic` 重点验证 `USDC -> SONIC` 已验证成功路由
- **金额**：稳定币默认以 `100` 为基线；`ETH` 约 `0.053`、`BNB` 约 `0.156`、`SOL` 优先 `0.2`；其余网络优先按稳定币源路由补足覆盖。
- **链路依赖**：每条 LiquidMesh 订单必须按 `quote -> quoteResultCtx.liquidMeshQuoteResultCtx -> build` 流程执行；缺少 `quoteResultCtx` 不得进入有效构建态。
- **渠道标识**：询价页、确认页、历史记录中的渠道商名称为 `LiquidMesh` 或产品定义的等价文案。

---

## 1. HD 钱包同链兑换测试（LiquidMesh）

### 1.1 网络：Ethereum（标杆：最小 + 中间 + Max 完整示例）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已登录 HD 钱包<br>2. 当前网络=`Ethereum`<br>3. 账户有 `ETH` 余额 | 1. 进入 Swap<br>2. 源=`ETH`，目标=`USDC`（Ethereum）<br>3. 输入**最小可识别精度**询价 | 1. 返回同链报价<br>2. 路由 / 渠道标识包含 `LiquidMesh`<br>3. `Est Received` 显示 `USDC` 数量，精度正确<br>4. `Network Fee` 显示 `ETH` 与法币值 |
| ❗️❗️P0❗️❗️ | 1. 同上，已获取有效报价 | 1. 输入**中间值**重新询价<br>2. 点击 `Max` | 1. 报价随输入刷新<br>2. `Max` 填充值为扣除 Gas 后的可用上限<br>3. 不出现余额透支提示 |
| ❗️❗️P0❗️❗️ | 1. 已获取有效报价 | 1. 点击 `Swap` 或等价 CTA 进入确认页 | 1. 确认页显示网络=`Ethereum`<br>2. 支付币种 / 数量、接收币种 / 数量与输入一致<br>3. 渠道商显示 `LiquidMesh`<br>4. 显示滑点、汇率、费用与 `Network Fee` |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`Ethereum`<br>2. 源=`USDC`<br>3. `USDC` 未授权 | 1. 源=`USDC`，目标=`ETH`<br>2. 输入中间值 | 1. 底部主 CTA 为 `Approve` 或等价授权入口<br>2. 不直接进入兑换提交态 |
| ❗️❗️P0❗️❗️ | 1. `USDC -> ETH` 未授权 | 1. 按 `Approve+Swap` 捆绑流程完成兑换 | 1. 钱包弹窗按产品定义展示授权与兑换两步<br>2. 授权完成后继续发起兑换<br>3. 订单进入 `Pending` 并可流转至终态 |
| ❗️❗️P0❗️❗️ | 1. 重新进入 `USDC -> ETH`<br>2. `USDC` 未授权 | 1. 按 `Approve`、`Swap` 单独提交流程完成兑换 | 1. `Approve` 单独提交后，主 CTA 变为 `Swap` 或等价兑换按钮<br>2. 兑换订单进入 `Pending` 并可流转至终态 |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`Ethereum`<br>2. 源=`USDC`<br>3. 目标=`USDT` | 1. 输入中间值询价<br>2. 进入确认页 | 1. 返回同链 `Token -> Token` 报价<br>2. 渠道商显示 `LiquidMesh`<br>3. 两侧代币地址不相同 |

### 1.2 多网络已验证成功路由回归

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`BSC`<br>2. 账户有 `BNB / USDC / USDT` 样本 | 1. 依次覆盖 `BNB -> USDC`、`USDC -> BNB`、`USDC -> USDT`<br>2. 输入基线金额询价并进入确认页 | 1. 三个方向均返回同链报价<br>2. 渠道商显示 `LiquidMesh`<br>3. 源币为 `USDC` 时展示授权或已授权后的兑换态 |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`Base`<br>2. 账户有 `ETH / USDC / USDT` 样本 | 1. 依次覆盖 `ETH -> USDC`、`USDC -> ETH`、`USDC -> USDT`<br>2. 输入基线金额询价并进入确认页 | 1. 三个方向均返回同链报价<br>2. `Network Fee` 单位与 Base 主币一致<br>3. 渠道商显示 `LiquidMesh` |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`Sonic`<br>2. 账户有 `USDC` 余额 | 1. 源=`USDC`，目标=`SONIC`<br>2. 输入 `100` 询价<br>3. 进入确认页 | 1. 返回同链 `Token -> Native` 报价<br>2. 接收资产显示为 `SONIC`<br>3. 渠道商显示 `LiquidMesh` |

### 1.3 异构链与支持矩阵回归

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`Solana`<br>2. 账户有 `SOL` 余额 | 1. 源=`SOL`，目标=`USDC`<br>2. 输入 `0.2` 询价<br>3. 进入确认页并尝试提交流程 | 1. 返回同链报价<br>2. `Network Fee` 单位为 `SOL`<br>3. 不出现授权步骤<br>4. 已验证成功路由可正常进入提交态 |
| P1 | 1. 当前网络=`Solana`<br>2. 账户有 `USDC` 余额 | 1. 源=`USDC`，目标=`SOL` 或 `USDT`<br>2. 输入 `100` 询价<br>3. 继续到提交前后 | 1. 报价阶段可命中 `LiquidMesh` 并返回有效报价上下文<br>2. 若 build 阶段返回“报价不可用，请刷新后重试”或产品定义的等价文案，页面按业务层错误展示<br>3. 不误判为参数缺失或渠道不支持 |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`Tron`<br>2. 账户有 `TRX / USDT / USDC` 样本 | 1. 覆盖 `TRX -> USDT`、`USDT -> TRX` 或 `TRX -> USDC` 任一路由询价 | 1. 按支持矩阵应返回 `LiquidMesh` 同链报价<br>2. 若未命中 `LiquidMesh`，记录为 Tron 支持回归问题<br>3. `TRC20` 作为源币时，需符合授权逻辑 |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`SUI`<br>2. 账户有 `SUI / USDC / USDT` 样本 | 1. 覆盖 `SUI -> USDC`、`USDC -> SUI` 或 `SUI -> USDT` 任一路由询价 | 1. 按支持矩阵应返回 `LiquidMesh` 同链报价<br>2. 若未命中 `LiquidMesh`，记录为 SUI 支持回归问题<br>3. 不出现授权步骤 |

---

## 2. HW 钱包同链兑换测试（LiquidMesh）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已连接 HW 钱包<br>2. 当前网络=`Ethereum`<br>3. 账户有 `ETH` 余额 | 1. 源=`ETH`，目标=`USDC`<br>2. 输入中间值询价<br>3. 点击兑换并在设备上确认 | 1. 设备确认流程完整<br>2. App 确认页与设备展示的网络、币种、数量一致<br>3. 提交后生成 `Pending` 记录 |
| P1 | 1. 已连接 HW 钱包<br>2. 当前版本支持对应网络签名<br>3. 当前网络为 `BSC / Base / Solana / Sonic / Tron / SUI` 之一 | 1. 覆盖 1 条该网络的同链路由<br>2. 完成授权 / 签名提交流程 | 1. EVM / Tron 的代币源场景按产品定义展示授权流<br>2. Solana / SUI 无授权步骤<br>3. 终态后余额与历史记录一致 |

---

## 3. 构建与费用验证测试（同链）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已进入 LiquidMesh 确认页 | 1. 查看费用明细 | 1. 显示 `Network Fee`（主币 + 法币）<br>2. 若产品展示渠道费用，则字段可读取<br>3. 渠道商名称为 `LiquidMesh` |
| ❗️❗️P0❗️❗️ | 1. 已获取有效 LiquidMesh 报价 | 1. 观察提交前状态 | 1. 仅在 `quoteResultCtx.liquidMeshQuoteResultCtx` 存在时允许进入可提交构建态<br>2. 不允许绕过询价直接进入有效构建态 |
| ❗️❗️P0❗️❗️ | 1. 已获取有效 LiquidMesh 报价<br>2. 当前环境可比对异常返回 | 1. 移除或模拟缺失 `quoteResultCtx` 后再次提交 | 1. 当前请求进入失败态或产品定义错误提示<br>2. 不把缺少 `quoteResultCtx` 的请求误当作正常构建 |
| P1 | 1. 交易已进入终态 | 1. 对比确认页费用与资产余额变化 | 1. 源资产减少值包含兑换金额与费用项（允许精度误差）<br>2. 历史详情中的费用字段与确认页口径一致 |

---

## 4. 历史记录测试（同链）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已提交 LiquidMesh 同链兑换 | 1. 打开 Swap 历史列表 | 1. 列表及时出现 `Pending` 记录<br>2. 记录包含币对、数量、状态、时间等摘要字段 |
| ❗️❗️P0❗️❗️ | 1. LiquidMesh 历史记录已生成 | 1. 进入详情页 | 1. `Provider` 显示 `LiquidMesh`<br>2. `Rate`、`Network Fee`、费用字段可读取<br>3. 网络与交易对与下单一致 |
| P1 | 1. 当前记录为 `Pending` | 1. 观察状态流转 | 1. 状态可更新为 `Success` 或 `Failed`<br>2. `Status detail` 与终态一致 |

---

## 5. 同链边界与账户限制

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前选择跨链场景<br>2. 源网络与目标网络不一致 | 1. 进入 Swap 并完成询价 | 1. 当前路由不命中 `LiquidMesh`<br>2. 不把仅支持同链的 `LiquidMesh` 误展示到跨链报价结果中 |
| P1 | 1. 当前账户类型=`观察账户` | 1. 进入 Swap 并选择 LiquidMesh 同链路由 | 1. 显示不可提交提示或限制文案<br>2. 不进入链上签名流程 |
| P1 | 1. 当前账户类型=`外部账户` 或产品定义的不可交易账户 | 1. 进入 LiquidMesh 同链兑换流程 | 1. 保持与产品定义一致的限制行为<br>2. 不出现可执行的兑换提交态 |

---

## 变更记录

| 日期 | 版本说明 |
|------|----------|
| 2026-07-16 | 初版：新增 LiquidMesh 同链渠道手工测试用例，覆盖 `Ethereum / BSC / Base / Solana / Tron / Sonic / SUI` 七条支持网络、`quoteResultCtx` 依赖、EVM / Tron 授权流、Solana 业务兜底、Tron / SUI 支持回归、费用与历史记录 |
