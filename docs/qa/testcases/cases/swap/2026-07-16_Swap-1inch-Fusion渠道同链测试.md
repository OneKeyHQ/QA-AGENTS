# Swap - 1inch Fusion 渠道同链测试

> 生成时间：2026-07-16
> 规则文档：`docs/qa/rules/swap-rules.md`、`docs/qa/rules/swap-network-features.md`
> 需求文档：依据 `docs/qa/rules/swap-rules.md` 中 1inch Fusion 渠道规则与网络特性表编写
> 测试端：iOS / Android / Desktop / Extension / Web
> 关联文档 / 参考模板：`docs/qa/testcases/cases/swap/2026-07-16_Swap-1inch渠道同链测试.md`

## 前置条件

- 已登录 HD 或 HW 钱包；各测试网络 Gas 主币余额充足。
- 可切换 `Ethereum / Arbitrum / Optimism / BSC / Polygon / Avalanche`。
- 已准备各网络可稳定命中 `1inch Fusion` 的 `ERC20 -> ERC20`、`ERC20 -> Native` 代币对与余额，建议优先使用 `USDC / USDT / DAI` 等稳定币组与 `USDC -> ETH / BNB / MATIC / AVAX` 等路径。
- 账户地址、代币合约地址以 `swap-network-features.md` 为准。
- 需准备未授权状态与已授权状态两类样本；Fusion 构建阶段必须使用询价返回的 `quoteResultCtx`。

## 测试范围说明

**1inch Fusion 同链支持网络**：Ethereum、Arbitrum、Optimism、BSC、Polygon、Avalanche

**同链兑换类型覆盖**：
- 覆盖 代币→代币（`ERC20 -> ERC20`）
- 覆盖 代币→主币（`ERC20 -> Native`）
- 不覆盖 主币→代币、主币→主币

**测试覆盖要求**：
- 每个支持网络至少覆盖 1 条可稳定命中 Fusion provider 的同链兑换，且整体需覆盖 `Token -> Token` 与 `Token -> Native` 两类路径。
- **金额**：默认以 `100` 为基线，可补充最小可识别精度与中间值；若命中不稳定，先做金额阶梯探测再执行完整流程。
- **授权**：源币为 ERC20 时，覆盖 `Approve+Swap` 捆绑提交与 `Approve / Swap` 单独提交。
- **测试路线**：报价测试、构建订单测试、费用测试、历史记录测试。
- **渠道标识**：询价页、确认页、历史记录中的渠道商名称为 `1inch Fusion`，不误显示为普通 `1inch`。
- **链路依赖**：每条 Fusion 订单必须按 `quote -> quoteResultCtx -> build` 流程执行；缺少 `quoteResultCtx` 不得进入有效构建态。
- **历史记录重点**：若产品展示 `Order ID`，则历史详情中需展示可追溯的 `Order ID`。

---

## 1. HD 钱包同链兑换测试（1inch Fusion）

### 1.1 网络：Ethereum（标杆：Token -> Token + Token -> Native 完整示例）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已登录 HD 钱包<br>2. 当前网络=`Ethereum`<br>3. 账户有 `USDC` 余额 | 1. 进入 Swap<br>2. 源=`USDC`，目标=`USDT`（Ethereum）<br>3. 输入**最小可识别精度**询价 | 1. 返回同链报价<br>2. 路由 / 渠道标识包含 `1inch Fusion`<br>3. `Est Received` 显示 `USDT` 数量，精度正确 |
| ❗️❗️P0❗️❗️ | 1. 同上，已获取有效报价 | 1. 输入**中间值**重新询价 | 1. 报价随输入刷新<br>2. 渠道商持续显示 `1inch Fusion`<br>3. `Network Fee` 显示 `ETH` 与法币值 |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`Ethereum`<br>2. 源=`USDC`<br>3. 目标=`ETH`<br>4. `USDC` 未授权 | 1. 输入中间值 | 1. 底部主 CTA 为 `Approve` 或等价授权入口<br>2. 不直接进入兑换提交态 |
| ❗️❗️P0❗️❗️ | 1. `USDC -> ETH` 未授权 | 1. 按 `Approve+Swap` 捆绑流程完成兑换 | 1. 钱包弹窗按产品定义展示授权与兑换两步<br>2. 授权完成后继续发起 Fusion 订单<br>3. 订单进入 `Pending` 并可流转至终态 |
| ❗️❗️P0❗️❗️ | 1. 重新进入 `USDC -> ETH`<br>2. `USDC` 未授权 | 1. 按 `Approve`、`Swap` 单独提交流程完成兑换 | 1. `Approve` 单独提交后，主 CTA 变为 `Swap` 或等价兑换按钮<br>2. Fusion 订单进入 `Pending` 并可流转至终态 |
| ❗️❗️P0❗️❗️ | 1. 当前网络=`Ethereum`<br>2. 源=`USDC`<br>3. 目标=`ETH` | 1. 输入中间值询价<br>2. 进入确认页 | 1. 返回同链 `Token -> Native` 报价<br>2. 接收资产显示为 `ETH`<br>3. 渠道商显示 `1inch Fusion` |
| ❗️❗️P0❗️❗️ | 1. 已获取有效 Fusion 报价 | 1. 点击 `Swap` 或等价 CTA 进入确认页 | 1. 确认页显示网络=`Ethereum`<br>2. 支付币种 / 数量、接收币种 / 数量与输入一致<br>3. 渠道商显示 `1inch Fusion`<br>4. 费用、汇率、`Network Fee` 字段可读取 |
| ❗️❗️P0❗️❗️ | 1. 已获取有效 Fusion 报价 | 1. 继续进入提交前最后一步 | 1. 当前路由已完成 `quote -> quoteResultCtx -> build` 闭环<br>2. 若缺少 `quoteResultCtx`，主 CTA 保持不可提交或展示错误提示 |
| P1 | 1. 当前网络=`Ethereum` | 1. 尝试选择 `ETH -> USDC` 或 `ETH -> ETH` 类路径 | 1. 不命中 `1inch Fusion` 渠道<br>2. 不把不支持路径误展示为 Fusion 路由 |
| P1 | 1. 报价带刷新倒计时或过期机制 | 1. 等待报价失效后点击 `Swap` | 1. 触发重新询价或展示报价失效提示<br>2. 更新后的报价仍可继续进入确认页 |

### 1.2 多网络同链可用性冒烟

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已登录 HD 钱包<br>2. 逐个切换以下网络：`Arbitrum / Optimism / BSC / Polygon / Avalanche`<br>3. 当前网络 `USDC`、`USDT` 或其他稳定 ERC20 余额充足 | 1. 源=当前网络稳定币 A，目标=当前网络稳定币 B<br>2. 输入中间值询价<br>3. 进入确认页 | 1. 返回同链 `Token -> Token` 报价<br>2. 渠道商显示 `1inch Fusion`<br>3. `Network Fee` 使用当前网络主币单位 |
| ❗️❗️P0❗️❗️ | 1. 已登录 HD 钱包<br>2. 任一支持网络<br>3. 当前网络存在稳定 ERC20 与主币目标路径 | 1. 选择 `USDC -> 当前网络主币` 或等价 `Token -> Native` 路由询价<br>2. 进入确认页 | 1. 返回同链 `Token -> Native` 报价<br>2. 接收资产显示为当前网络主币<br>3. 渠道商显示 `1inch Fusion` |
| ❗️❗️P0❗️❗️ | 1. 已登录 HD 钱包<br>2. 任一支持网络<br>3. 当前网络存在多个 ERC20 可选项 | 1. 分别选择 `USDC -> USDT`、`USDT -> DAI` 等两组 `Token -> Token` 路由询价 | 1. 两组路由均可命中 `1inch Fusion` 或按产品定义展示无可用报价<br>2. 不错误降级展示为普通 `1inch` |

---

## 2. HW 钱包同链兑换测试（1inch Fusion）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已连接 HW 钱包<br>2. 当前网络=`Ethereum`<br>3. 账户有 `USDC` 余额 | 1. 源=`USDC`，目标=`USDT`<br>2. 输入中间值询价<br>3. 点击兑换并在设备上确认 | 1. 设备确认流程完整<br>2. App 确认页与设备展示的网络、币种、数量一致<br>3. 提交后生成 `Pending` 记录 |
| P1 | 1. 已连接 HW 钱包<br>2. 当前网络任一支持网络 | 1. 覆盖 1 条 `Token -> Token` 或 `Token -> Native` Fusion 路由<br>2. 完成授权 / 兑换流程 | 1. ERC20 授权与兑换流程在设备 / App 两端可追踪<br>2. 终态后余额与历史记录一致 |

---

## 3. 构建与费用验证测试（同链）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已进入 1inch Fusion 确认页 | 1. 查看费用明细 | 1. 显示 `Network Fee`（主币 + 法币）<br>2. 若产品展示渠道费用，则字段可读取<br>3. 渠道商名称为 `1inch Fusion` |
| ❗️❗️P0❗️❗️ | 1. 已获取有效 Fusion 报价 | 1. 观察提交前状态 | 1. 仅在 `quoteResultCtx` 存在时允许进入可提交构建态<br>2. 不允许绕过询价直接提交 |
| P1 | 1. 交易已进入终态 | 1. 对比确认页费用与资产余额变化 | 1. 源资产减少值包含兑换金额与费用项（允许精度误差）<br>2. 历史详情中的费用字段与确认页口径一致 |

---

## 4. 历史记录测试（同链）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已提交 1inch Fusion 同链兑换 | 1. 打开 Swap 历史列表 | 1. 列表及时出现 `Pending` 记录<br>2. 记录包含币对、数量、状态、时间等摘要字段 |
| ❗️❗️P0❗️❗️ | 1. 1inch Fusion 历史记录已生成 | 1. 进入详情页 | 1. `Provider` 显示 `1inch Fusion`<br>2. `Rate`、`Network Fee`、费用字段可读取<br>3. 不误显示为普通 `1inch` |
| ❗️❗️P0❗️❗️ | 1. 历史详情页已打开<br>2. 当前产品版本展示 `Order ID` | 1. 查看详情页中的订单追踪字段 | 1. 显示可追溯的 `Order ID`<br>2. `Order ID` 格式完整，可复制或关联查询（若产品提供） |
| P1 | 1. 当前记录为 `Pending` | 1. 观察状态流转 | 1. 状态可更新为 `Success` 或 `Failed`<br>2. `Status detail` 与终态一致 |

---

## 5. 账户类型限制

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | 1. 当前账户类型=`观察账户` | 1. 进入 Swap 并选择 1inch Fusion 路由 | 1. 显示不可提交提示或限制文案<br>2. 不进入链上签名流程 |
| P1 | 1. 当前账户类型=`外部账户` 或产品定义的不可交易账户 | 1. 进入 1inch Fusion 同链兑换流程 | 1. 保持与产品定义一致的限制行为<br>2. 不出现可执行的兑换提交态 |

---

## 变更记录

| 日期 | 版本说明 |
|------|----------|
| 2026-07-16 | 初版：新增 1inch Fusion 同链渠道手工测试用例，覆盖 6 条支持网络、`Token -> Token` / `Token -> Native` 路由、授权流程、`quoteResultCtx` 依赖、费用与历史记录 |
