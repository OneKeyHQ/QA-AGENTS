# Swap - Binance Web3 渠道同链测试

> 生成时间：2026-09-22
> 规则文档：`docs/qa/rules/swap-rules.md`、`docs/qa/rules/swap-network-features.md`
> 需求文档：`docs/qa/requirements/Swap-Binance-Web3同链支持网络.md`
> 测试端：iOS / Android / Desktop / Extension / Web
> 关联文档 / 参考模板：`docs/qa/testcases/cases/swap/2026-07-16_Swap-OKX渠道同链测试.md`
> 本渠道**仅同链**，不编写跨链专项文件。

## 前置条件

- 已登录 HD 或 HW 钱包；各测试网络主币余额与网络费余额充足。
- 已准备 Binance Web3 当前支持的同链网络样本：`BSC / Ethereum / Arbitrum / Base / Polygon / Optimism / Linea / Blast / Avalanche / Scroll / Sonic / Katana / Monad / Solana / Tron / Robinhood`。
- 账户地址、代币合约地址、主币标识以 `docs/qa/rules/swap-network-features.md` 为准。
- EVM 网络需准备未授权状态与已授权状态两类账户样本；`Solana` 不需要授权；`Tron` 的 TRC20 作为源币时需要授权。
- 特殊基线资产需提前准备：
  - `Blast`：稳定币基线使用 `USDB`，不使用未维护的 `USDC / USDT` 占位
  - `Katana`：`USDC`、`KAT`
  - `Monad`：`USDC`、`USDT`
  - `Robinhood`：`USDG`、`USDe`（不使用通用 `USDC / USDT`）
- 构建必须复用询价返回的 `quoteResultCtx`，不允许直接构建。
- 接入映射：Solana `binanceChainId=CT_501`；Tron `binanceChainId=CT_195`；其余 EVM 使用十进制 chainId。接入清单备注 `monda` 对应 `evm--143` / **Monad**。
- 不覆盖 `Mode / Metis / Plasma`。

## 测试范围说明

**Binance Web3 同链支持网络**：BSC、Ethereum、Arbitrum、Base、Polygon、Optimism、Linea、Blast、Avalanche、Scroll、Sonic、Katana、Monad、Solana、Tron、Robinhood

**同链兑换类型覆盖**：
- 主币→代币（Native → Token）
- 代币→主币（Token → Native）
- 代币→代币（Token → Token，特殊网络按已验证或产品当前可选基线选择可用币对）

**测试覆盖要求**：
- `Binance Web3` 仅覆盖**同链**，不覆盖跨链；源网络与目标网络不一致时，不应命中 `Binance Web3` 路由。
- 每个支持网络至少覆盖 1 条同链兑换；整体需覆盖 `Native -> Token`、`Token -> Native`、`Token -> Token` 三类方向。
- **金额**：最小可识别精度、中间值、`Max`（扣除 Gas / 网络费）并入 §1 表格步骤与预期，不单立边界章节；`Ethereum` 作为最小 + 中间 + `Max` 的完整标杆。
- **授权**：EVM 网络 ERC20、Tron TRC20 作为源币时，覆盖 `Approve+Swap` 捆绑提交与 `Approve / Swap` 单独提交；`Solana` 不覆盖授权流。
- **测试路线**：报价测试、构建订单测试、费用测试、历史记录测试。
- **渠道标识**：询价页、确认页、历史记录中的渠道商名称为 `Binance Web3` 或产品定义的等价文案。
- **provider 枚举**：手工用例按 UI 展示名断言；API / 自动化脚本生成前以 quote 或 `/swap/v1/providers/list` 返回值为准，回填 `swap-rules.md`。
- **链路依赖**：每条 Binance Web3 订单必须按 `quote -> quoteResultCtx -> build` 流程执行；缺少 `quoteResultCtx` 不得进入有效构建态。

---

## 1. HD 钱包同链兑换测试（Binance Web3）

### 1.1 网络：Ethereum（标杆：最小 + 中间 + Max 完整示例）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已登录 HD 钱包<br>2. 当前网络=`Ethereum`<br>3. 账户有 `ETH` 余额 | 1. 进入 Swap<br>2. 源=`ETH`，目标=`USDC`（Ethereum）<br>3. 输入**最小可识别精度**询价 | 1. 返回同链报价<br>2. `Est Received` 显示 `USDC` 数量，精度正确<br>3. `Network Fee` 显示 `ETH` 与法币值<br>4. 路由 / 渠道标识包含 `Binance Web3`<br>5. 若金额低于渠道限额，显示最小限额提示 |
| ❗️❗️P0❗️❗️ | 1. 同上，已获取有效报价 | 1. 输入**中间值**重新询价<br>2. 点击 `Max` | 1. 报价随输入刷新<br>2. `Max` 填充值为扣除 Gas 后的可用上限<br>3. 不出现余额透支提示 |
| ❗️❗️P0❗️❗️ | 1. 已获取有效报价 | 1. 点击 `Swap` 或等价 CTA 进入确认页 | 1. 确认页显示网络=`Ethereum`<br>2. 支付币种 / 数量、接收币种 / 数量与输入一致<br>3. 渠道商显示 `Binance Web3`<br>4. 显示滑点、汇率、费用与 `Network Fee`<br>5. 当前路由已拿到有效 `quoteResultCtx`，构建使用该上下文 |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`Ethereum`<br>2. 源=`USDC`<br>3. `USDC` 未授权 | 1. 源=`USDC`，目标=`ETH`<br>2. 输入中间值 | 1. 底部主 CTA 为 `Approve` 或等价授权入口<br>2. 不直接进入兑换提交态 |
| ❗️❗️P0❗️❗️ | 1. `USDC -> ETH` 未授权 | 1. 按 `Approve+Swap` 捆绑流程完成兑换 | 1. 钱包弹窗按产品定义展示授权与兑换两步<br>2. 授权完成后继续发起兑换<br>3. 订单进入 `Pending` 并可流转至终态 |
| ❗️❗️P0❗️❗️ | 1. 重新进入 `USDC -> ETH`<br>2. `USDC` 未授权 | 1. 按 `Approve`、`Swap` 单独提交流程完成兑换 | 1. `Approve` 单独提交后，主 CTA 变为 `Swap` 或等价兑换按钮<br>2. 兑换订单进入 `Pending` 并可流转至终态 |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`Ethereum`<br>2. 源=`USDT`<br>3. 目标=`ETH`<br>4. `USDT` 为未授权或历史授权状态 | 1. 输入中间值<br>2. 继续授权与兑换流程 | 1. 满足 `Ethereum USDT -> ETH` 二次授权规则时，按产品定义展示重置授权 / 再授权流程<br>2. 二次授权完成后才进入兑换提交流程 |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`Ethereum`<br>2. 源=`USDC`<br>3. 目标=`USDT` | 1. 输入中间值询价<br>2. 进入确认页 | 1. 返回同链 `Token -> Token` 报价<br>2. 渠道商显示 `Binance Web3`<br>3. 两侧代币地址不相同 |
| P1 | 1. 报价带刷新倒计时或过期机制 | 1. 等待报价失效后点击 `Swap` | 1. 触发重新询价或展示报价失效提示<br>2. 更新后的报价仍可继续进入确认页 |
| P1 | 1. 页面网络异常或聚合器异常 | 1. 触发询价 | 1. 显示错误提示或重试入口<br>2. 不残留上一笔错误报价 |

### 1.2 异构链同链能力验证（Solana / Tron）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`Solana`<br>2. 账户有 `SOL` 余额 | 1. 源=`SOL`，目标=`USDC`<br>2. 输入中间值询价<br>3. 进入确认页 | 1. 返回同链报价<br>2. `Network Fee` 单位为 `SOL`<br>3. 渠道商显示 `Binance Web3`<br>4. 不出现 `Approve` 步骤 |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`Solana`<br>2. 账户有 `USDC` 余额 | 1. 源=`USDC`，目标=`SOL` 或 `USDT`<br>2. 输入中间值询价 | 1. 返回 `Token -> Native` 或 `Token -> Token` 报价<br>2. 不出现授权入口<br>3. 报价与确认页字段可读取 |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`Tron`<br>2. 账户有 `TRX` 余额 | 1. 源=`TRX`，目标=`USDT`（Tron）<br>2. 输入中间值询价<br>3. 进入确认页 | 1. 返回同链报价<br>2. `Network Fee` 单位为 `TRX`<br>3. 渠道商显示 `Binance Web3`<br>4. Native `TRX` 作为源币时不出现授权入口 |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`Tron`<br>2. 源=`USDT`（TRC20）未授权<br>3. 账户有 `USDT` 与 `TRX` 网络费 | 1. 源=`USDT`，目标=`TRX`<br>2. 输入中间值 | 1. 底部主 CTA 为 `Approve` 或等价授权入口<br>2. 不直接进入兑换提交态 |
| ❗️❗️P0❗️❗️ | 1. `USDT -> TRX` 未授权 | 1. 按 `Approve+Swap` 捆绑或 `Approve` / `Swap` 单独提交完成兑换 | 1. 授权完成后主 CTA 变为可提交兑换态或直接继续兑换<br>2. 订单进入 `Pending` 并可流转至终态 |

### 1.3 多网络同链可用性冒烟

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已登录 HD 钱包<br>2. 逐个切换以下网络：`BSC / Arbitrum / Base / Polygon / Optimism / Avalanche / Linea / Scroll / Sonic`<br>3. 当前网络主币余额充足 | 1. 源=当前网络主币，目标=`USDC`（同网络）<br>2. 输入中间值询价<br>3. 进入确认页 | 1. 返回同链报价<br>2. `Network Fee` 使用当前网络主币单位<br>3. 渠道商显示 `Binance Web3` |
| ❗️❗️P0❗️❗️ | 1. 已登录 HD 钱包<br>2. 逐个切换以下网络：`BSC / Arbitrum / Base / Polygon / Optimism / Avalanche / Linea / Scroll / Sonic`<br>3. 当前网络 `USDC` 余额充足 | 1. 源=`USDC`，目标=当前网络主币<br>2. 输入中间值询价 | 1. 返回 `Token -> Native` 报价<br>2. 源币为 ERC20 时展示授权或已授权后的兑换态 |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`BSC`<br>2. 账户有 `USDC` 与 `USDT` 样本 | 1. 源=`USDC`，目标=`USDT`<br>2. 输入中间值询价 | 1. 返回同链 `Token -> Token` 报价<br>2. 渠道商显示 `Binance Web3`<br>3. 两侧代币地址不相同 |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`Blast`<br>2. 账户有 `ETH` 与 `USDB` 样本 | 1. 覆盖 `ETH -> USDB` 或 `USDB -> ETH` 路由 | 1. 按 `USDB` 基线返回同链报价<br>2. 不误要求使用 `USDC / USDT` 作为 Blast 稳定币基线 |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`Katana`<br>2. 账户有主币与 `USDC` / `KAT` 样本 | 1. 覆盖 `主币 -> USDC`<br>2. 再覆盖 `USDC -> KAT` | 1. 返回同链报价，渠道商显示 `Binance Web3`<br>2. `USDC` 地址=`0x203a662b0bd271a6ed5a60edfbd04bfce608fd36`<br>3. `KAT` 地址=`0x7f1f4b4b29f5058fa32cc7a97141b8d7e5abdc2d`<br>4. 构建携带询价返回的 `quoteResultCtx` |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`Monad`<br>2. 账户有 `MON` 与 `USDC` / `USDT` 样本 | 1. 覆盖 `MON -> USDC` 或 `USDC -> MON`<br>2. 再覆盖 `USDC -> USDT` | 1. 返回同链报价，渠道商显示 `Binance Web3`<br>2. `USDC` 地址=`0x00000000efe302beaa2b3e6e1b18d08d69a9012a`<br>3. `USDT` 地址=`0xe7cd86e13ac4309349f30b3435a9d337750fc82d`<br>4. 构建携带询价返回的 `quoteResultCtx` |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`Robinhood`<br>2. 账户有主币与 `USDG` / `USDe` 样本 | 1. 覆盖 `主币 -> USDG`<br>2. 再覆盖 `USDG -> USDe` | 1. 返回同链报价，渠道商显示 `Binance Web3`<br>2. `USDG` 地址=`0x5fc5360d0400a0fd4f2af552add042d716f1d168`<br>3. `USDe` 地址=`0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34`<br>4. 不误使用通用 `USDC / USDT` 作为 Robinhood 基线<br>5. 构建携带询价返回的 `quoteResultCtx` |

---

## 2. HW 钱包同链兑换测试（Binance Web3）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已连接 HW 钱包<br>2. 当前网络=`Ethereum`<br>3. 账户有 `ETH` 余额 | 1. 源=`ETH`，目标=`USDC`<br>2. 输入中间值询价<br>3. 点击兑换并在设备上确认 | 1. 设备确认流程完整<br>2. App 确认页与设备展示的网络、币种、数量一致<br>3. `build` 请求依赖 `quoteResultCtx`<br>4. 提交后生成 `Pending` 记录 |
| P1 | 1. 已连接 HW 钱包<br>2. 当前版本支持对应链签名<br>3. 当前网络=`Solana / Tron / BSC` 之一 | 1. 覆盖 1 条该网络同链路由<br>2. 完成签名提交流程 | 1. Solana 不出现授权步骤<br>2. EVM / Tron 代币源场景按产品定义展示授权流<br>3. 终态后余额与历史记录一致 |

---

## 3. 构建与费用验证测试（同链）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已进入 Binance Web3 确认页 | 1. 查看费用明细 | 1. 显示 `Network Fee`（主币 + 法币）<br>2. 若产品展示渠道费用，则字段可读取<br>3. 渠道商名称为 `Binance Web3` |
| ❗️❗️P0❗️❗️ | 1. 已获取有效 Binance Web3 报价 | 1. 修改金额后重新询价<br>2. 再次进入确认页 | 1. 报价刷新后返回新的 `quoteResultCtx`<br>2. 构建阶段使用最新 `quoteResultCtx`<br>3. 缺少 `quoteResultCtx` 时不进入可提交构建态 |
| ❗️❗️P0❗️❗️ | 1. 已获取有效 Binance Web3 报价 | 1. 观察提交前状态 | 1. 仅在 `quoteResultCtx` 存在时允许进入可提交构建态<br>2. 不允许绕过询价直接进入有效构建态 |
| P1 | 1. 交易已进入终态 | 1. 对比确认页费用与资产余额变化 | 1. 源资产减少值包含兑换金额与费用项（允许精度误差）<br>2. 历史详情中的费用字段与确认页口径一致 |

---

## 4. 历史记录测试（同链）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已提交 Binance Web3 同链兑换 | 1. 打开 Swap 历史列表 | 1. 列表及时出现 `Pending` 记录<br>2. 记录包含币对、数量、状态、时间等摘要字段 |
| ❗️❗️P0❗️❗️ | 1. Binance Web3 历史记录已生成 | 1. 进入详情页 | 1. `Provider` 显示 `Binance Web3` 或产品定义等价文案<br>2. `Rate`、`Network Fee`、费用字段可读取<br>3. 网络与交易对与下单一致 |
| P1 | 1. 当前记录为 `Pending` | 1. 观察状态流转 | 1. 状态可更新为 `Success` 或 `Failed`<br>2. `Status detail` 与终态一致 |

---

## 5. 同链边界与账户限制

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前选择跨链场景<br>2. 源网络与目标网络不一致 | 1. 进入 Swap 并完成询价 | 1. 当前路由不命中 `Binance Web3`<br>2. 不把仅支持同链的 `Binance Web3` 误展示到跨链报价结果中 |
| P1 | 1. 当前账户类型=`观察账户` | 1. 进入 Swap 并选择 Binance Web3 同链路由 | 1. 显示不可提交提示或限制文案<br>2. 不进入链上签名流程 |
| P1 | 1. 当前账户类型=`外部账户` 或产品定义的不可交易账户 | 1. 进入 Binance Web3 同链兑换流程 | 1. 保持与产品定义一致的限制行为<br>2. 不出现可执行的兑换提交态 |

---

## 变更记录

| 日期 | 版本说明 |
|------|----------|
| 2026-09-22 | 初版：新增 Binance Web3 同链渠道手工测试用例，覆盖 19 条支持网络、EVM / Tron 授权流、Solana 无授权、Blast `USDB` 基线、新网络冒烟、跨链不命中、费用与历史记录 |
| 2026-09-22 | 构建改为强制依赖 `quoteResultCtx`；去掉 Mode / Metis / Plasma；Katana / Monad / Robinhood 按已回填代币基线覆盖 |
