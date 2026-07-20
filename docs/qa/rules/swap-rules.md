# Swap 模块测试规则文档

> 本文档记录 Swap 模块的核心测试规则，包括报价测试、构建订单测试、手续费测试、历史记录测试等。
> 生成 Swap 模块测试用例时，必须参考本文档中的规则。

---

## 📄 Swap 渠道/场景用例文档编写规范（Markdown）

> 适用于 `docs/qa/testcases/cases/swap/` 下渠道专项、路由专项等 **表格化用例**；与通用边界维度（见 `qa-rules.md`）配合使用：**专项文档不写重复章节时，不削弱全局质量要求**，由通用用例或其它文档覆盖。

### 1. 同链与跨链分文件

- 同一渠道若同时具备 **同链**、**跨链** 能力，用 **两份** 用例文件分别维护；文件名须体现 `同链` / `跨链`（或同等语义）。
- 文首「关联文档」互链另一份路径，避免读者混读。

### 2. 优先级（P0-only 约定）

- 若约定本文档 **仅保留 P0**：文首声明「仅保留 P0」，表格 **不得** 出现 P1/P2 行。
- 需保留 P1/P2 时：单独说明交付范围，或另文件/附录（按项目约定）。

### 3. 默认不收录的章节（渠道/路由专项）

- **除非**需求或版本明确要求，渠道/路由专项用例中可不编写独立章节：
  - 「异常场景测试」
  - 「账户类型限制测试」
- 避免与主流程表及通用 Swap 规则重复；通用异常与账户限制在回归或其它用例集中覆盖。

### 4. 金额边界：并入 §1，不单立章节

- **禁止**单立「金额边界值测试」一章。
- **最小可识别精度**（或等价最小输入）、**中间值**、**Max**（扣除 Gas / 源链 Gas 后的可用上限）必须写入 **§1 软件钱包主流程**各场景表的「操作步骤 / 预期结果」。
- 「测试范围说明」中须用 **一条** 明确：金额三档并入 §1，不另立边界章节，并指定 **完整三档标杆场景**：
  - **同链文档**：以首组 **主币→代币**（如 Ethereum 上 ETH→USDC）为最小+中间+Max 的完整示例；§1 其余场景表须补齐与本币对相关的未覆盖档位（可与标杆同口径合并行表述）。
  - **跨链文档**：以首组 **主币→主币**（如 Ethereum→BSC，ETH→BNB）为完整示例；§1 其余场景类推。
- 表中用语统一：**最小可识别精度** / **最小可识别精度询价**；预期中体现 **最小限额** 提示（若产品支持）。

### 5. 硬件钱包章节

- 可与软件侧 **同币对** 对照；金额边界以 §1 软件表为口径 **抽样**（可在 §2 文首或步骤中注明）。

### 6. 变更记录

- 文档末尾维护「变更记录」表；涉及上述约定调整时须追加一行说明。

---

## 📋 核心测试路线（必须覆盖）

生成 Swap 模块测试用例时，必须覆盖以下四个核心测试路线：

**重要说明**：
- **兑换类型变量化**：同链和跨链的兑换类型测试流程相同，在测试用例中应作为变量处理，不需要为每种类型单独编写用例
  - **同链渠道测试场景**：主币到代币、代币到主币、代币到代币（共 3 种）
  - **跨链渠道测试场景**：主币到主币、主币到代币、代币到主币、代币到代币（共 4 种）
- **特殊情况单独测试**：特殊情况（如 Ethereum USDT 需要二次授权）需要单独编写测试用例，不能使用变量化处理

### 1. 报价测试（Quote Testing）

#### 1.1 同链报价

**报价展示验证**：
- 报价金额精度符合代币 decimals 规范
- Gas 费展示：显示为 native token 和法币价值（保留 2 位小数）
- 法币价值计算准确性

**路由验证**：
- 路由信息展示：DEX 名称、路径百分比、路由占比
- 多条路由时：显示最优路由（接收代币数量最大）
- 路由详情可展开查看

**刷新机制**：
- 报价有效期检查（如 30 秒）
- 自动刷新倒计时显示
- 手动刷新功能
- 报价过期后自动重新询价

**异常处理**：
- 报价失败：返回错误、超时、空数据
- 网络错误：断网、弱网、服务器错误
- 容错处理：错误提示、重试入口

#### 1.2 跨链报价

**报价展示验证**：
- 报价金额精度符合代币 decimals 规范
- Gas 费展示：显示为 native token 和法币价值
- Protocol Fee 展示：显示为代币计价和法币价值
- 时间展示：Est. Time 显示为可读时间格式（如"约 5 分钟"）

**费用计算**：
- Protocol Fee 由两部分组成，都转换为法币价值后求和
- 费用展示与计算一致性验证

**时间展示**：
- Est. Time 格式转换：秒 → 可读时间格式（如"约 5 分钟"）
- 时间展示准确性

**路由验证**：
- 跨链路由信息展示（可能只显示 100% 通过某个路径）
- 路由包含跨链桥名称
- 路由信息清晰展示

**特殊场景**：
- Solana 跨链 CCTP 路径可能需要多签交易（2 个私钥签名）
- 多签交易流程验证

#### 1.3 报价一致性

**页面展示一致性**：
- Est Received 显示正确
- Network Fee 显示正确
- Protocol Fee 显示正确
- RouteInfo 显示正确

**OneKey 与第三方报价差距控制**：
- 报价对比测试的核心目标是验证 **OneKey 询价接口返回结果** 与 **第三方渠道 API 原始报价** 的差距不会过大。
- 对比前提必须保持一致：源链 / 目标链、源币 / 目标币、输入金额、滑点、接收地址、钱包类型、时间窗一致。
- 在同一轮有效报价或同一时间窗内，`Est Received`、`Rate` 与按产品定义折算后的最终报价结果，**默认差距应控制在 5% 以内**。
- 若价差超过 5%，优先排查：
  - 第三方接口升级或字段口径变化，而 OneKey 侧仍使用旧版接口或旧字段
  - OneKey 与第三方的费用口径、滑点口径、接收地址口径不一致
  - 报价已过期、跨时间窗取值、市场快速波动导致样本失效
- 对已确认的接口升级 / 口径漂移问题，应优先记录为版本兼容或数据源同步问题，而不是直接判定为正常波动。

**多次询价结果对比**：
- 价格波动容忍度验证
- 报价刷新后数据更新及时性

**报价来源标识**：
- 显示路由/报价来源（如"OKX Dex Aggregator"）
- 来源标识清晰可见

---

### 2. 构建订单测试（Build Order Testing）

#### 2.1 同链订单构建

**订单构建验证**：
- 订单构建成功，包含完整的交易参数
- Gas Limit 计算准确性验证

**授权检查**：
- ERC20 代币需要检查授权状态
- 授权额度需满足兑换数量要求
- Native token 无需授权

**授权流程测试规则**（必须覆盖）：
- **中心化渠道豁免规则**：如果渠道商属于中心化交易所 / 中心化换汇服务（例如 HiFiSwap 这类非托管但由中心化服务商撮合或换汇的渠道），则 EVM 与 Tron 网络不覆盖 ERC20 / TRC20 授权逻辑；用例应验证页面不展示授权入口，直接进入渠道订单确认 / 换汇确认流程。
- **授权按钮状态验证**：未授权状态下显示"授权"按钮（非"兑换"按钮），授权按钮可点击
- **Approve+Swap 捆绑提交**：
  - 支持将 Approve 和 Swap 两笔交易捆绑在一起提交
  - 钱包弹窗显示 Approve+Swap 两笔交易捆绑
  - 在钱包中一次性确认两笔交易
  - Approve 交易先执行，Swap 交易在 Approve 成功后自动执行
  - 两笔交易都成功确认，授权状态更新为已授权
- **Approve、Swap 单独提交**：
  - 支持 Approve 和 Swap 分别单独提交
  - 先单独提交 Approve 交易，等待确认
  - Approve 成功后，授权按钮变为"兑换"按钮
  - 再单独提交 Swap 交易，等待确认
  - Swap 交易成功，余额变化正确

**特殊代币授权规则**：
- **Ethereum USDT**：需要二次授权（特殊代币）
  - **适用范围**：仅当 USDT → ETH 时需要二次授权，USDT → 其他代币不需要二次授权
  - 第一次授权：将授权额度设置为 0（重置授权）
  - 第二次授权：设置实际授权额度
  - 需要验证两次授权交易都能正常执行
  - 需要验证授权流程提示清晰（如显示"USDT 需要二次授权"或类似提示）
- 其他特殊代币：根据代币特性确定授权规则

**余额检查**：
- 可用余额验证：余额 ≥ 兑换数量 + Gas 费
- Max 按钮功能：自动填充可用余额（扣除 Gas 费）
- 余额不足提示

**交易确认页面数据验证**（构建订单后）：
- **网络信息**：显示当前网络名称，与选择的网络一致
- **账户信息**：
  - 账户地址：显示当前账户地址
  - 地址标签：显示账户标签（如有）
- **支付信息**：
  - 支付代币：显示源代币名称和图标
  - 支付数量：显示兑换数量，精度正确
- **接收信息**：
  - 接收代币：显示目标代币名称和图标
  - 接收数量：显示预计收到的目标代币数量，精度正确
  - 接收地址：显示接收地址（通常为当前账户地址）
  - 账户标签：显示接收账户标签（如有）
  - 合约地址：显示目标代币合约地址
  - 合约地址跳转：可以点击合约地址跳转到区块浏览器
- **渠道商信息**：
  - 渠道商名称：显示渠道名称（如"0x Protocol"）
  - 汇率：显示兑换汇率
  - 滑点：显示设置的滑点百分比
  - 服务费用：显示渠道服务费用比例（如 0x 渠道为 0.25%）
- **进阶设置数据**：
  - Gas Limit：显示 Gas Limit 值
  - Gas Price：显示 Gas Price（如有）
  - 其他进阶设置参数（如有）

#### 2.2 跨链订单构建

**订单构建验证**：
- 订单构建成功，包含完整的交易参数
- Gas Limit 值合理性验证

**多签支持**：
- Solana 跨链 CCTP 路径的多签交易处理
- 多签交易流程验证（2 个私钥签名）
- 钱包支持多签交易流程

**订单状态查询**：
- 订单状态查询功能验证
- 状态更新及时性

#### 2.3 订单状态流转

**状态转换**：
- Pending → Processing → Success/Failed 状态转换
- 状态转换时机验证

**状态更新**：
- 状态更新及时性（实时或轮询更新）
- 状态更新准确性

**失败回滚机制**：
- 交易失败后状态回滚
- 失败原因可追溯
- 提供重试入口

---

### 3. 手续费测试（Fee Testing）

#### 3.1 渠道返佣收费验证

**重要说明**：
- **不同渠道的返佣比例和收款地址不同**，测试时需要根据具体渠道验证
- 各渠道的返佣比例和收款地址见下方渠道列表

**收费比例**：
- 收费比例根据渠道不同而不同（如 0x 渠道为 0.25%）
- 收费比例配置验证

**收费计算**：
- 收费金额 = 兑换数量 × 收费比例
- 收费计算准确性验证
- 不同渠道的收费比例需要分别验证

**收费扣除**：
- 从源代币中扣除
- 直接发送到渠道对应的返佣地址
- 收费扣除时机验证
- 需要验证返佣地址是否为该渠道的正确地址

**收费展示**：
- 页面展示的手续费与实际扣除的手续费一致
- 收费展示清晰明确

**各渠道返佣信息**：
- **0x 渠道**：
  - 返佣比例：0.25%
  - 返佣地址：0x0994e6337a6c69c3ef4c2e2de885c22c4f0cf5b4
- **1inch 渠道**：
  - 返佣比例：0.25%
  - 返佣地址：0xeb373e57f59aaaf4e2957bc9920a20255b9aa694
- **其他渠道**：根据实际配置确定返佣比例和地址

#### 3.2 Network Fee 验证

**同链 Network Fee**：
- 展示：显示为 native token 和法币价值
- 页面展示的 Network Fee 与实际扣除的 Gas 费一致

**跨链 Network Fee**：
- 展示：显示为 native token 和法币价值
- 页面展示的 Network Fee 与实际扣除的 Gas 费一致

**Gas Limit 计算**：
- Gas Limit 计算准确性验证

**展示一致性**：
- 页面展示的 Network Fee 与实际扣除的 Gas 费一致
- Gas 费计算准确性

#### 3.3 Protocol Fee 验证（仅跨链）

**费用组成**：
- Protocol Fee 由两部分组成
- 两个费用都转换为法币价值后求和

**计价转换**：
- 一部分以目标链 native token 计价，转换为法币价值
- 另一部分以代币计价，转换为法币价值

**法币价值**：
- 两个费用转换为法币价值后求和
- 法币价值计算准确性

**展示一致性**：
- 页面展示的 Protocol Fee 与实际扣除的费用一致
- Protocol Fee 展示清晰明确

#### 3.4 手续费总和验证

**总手续费计算**：
- 总手续费 = Network Fee + Protocol Fee（跨链）+ 渠道返佣收费
- 总手续费计算准确性

**余额扣除验证**：
- 源代币余额减少 = 兑换数量 + 总手续费
- 余额扣除准确性验证（允许精度误差）

**手续费展示与计算一致性**：
- 页面展示的所有手续费与实际扣除的手续费一致
- 手续费明细清晰可查

---

### 4. 历史记录测试（History Testing）

#### 4.1 交易记录生成

**记录生成时机**：
- 交易提交后立即生成 Pending 记录
- 记录生成及时性验证

**记录字段完整性**：
- 交易 hash
- 时间戳
- 源代币/目标代币信息
- 兑换数量
- 状态（Pending/Success/Failed）
- 状态说明（Status detail）
- 发送地址（Pay address）
- 接收地址（Received address）
- 手续费信息
- 渠道商（Provider）
- 汇率（Rate）
- 渠道商费用（Provider Fee）
- 其他必要字段

**状态更新**：
- Pending → Success/Failed 状态更新及时性
- 状态更新准确性

#### 4.2 历史记录查询

**列表展示**：
- 按时间倒序排列
- 分页加载功能
- 列表展示性能

**搜索功能**：
- 按交易 hash 搜索
- 搜索功能准确性

**详情查看**：
- 点击记录查看详情
- 详情包含：交易参数、状态、状态说明、时间、支付/接收地址、交易 hash、Network Fee、Provider、Rate、Provider Fee 等完整信息
- 详情顶部摘要区显示源币 / 目标币、数量正负号、法币估值、网络角标
- 支持详情内复制地址 / hash、跳转区块浏览器（若产品提供）、清空历史、Support 入口
- 详情展示准确性

#### 4.3 记录数据一致性

**订单数据验证**：
- **交易对核对**：记录中显示的源代币和目标代币与交易时选择的一致
- **兑换数量核对**：记录中显示的兑换数量与交易时输入的一致，精度正确
- **订单状态**：记录中显示的状态（Pending/Success/Failed）与链上状态一致
- **下单时间**：记录中显示的下单时间准确，时间格式一致

**链上数据验证**：
- **发送地址**：记录中显示的发送地址为当前账户地址，格式正确
- **接收地址**：默认接收场景下，记录中显示的接收地址与当前账户接收地址一致；开启自定义接收地址时，记录中显示用户本次填写 / 选择的目标地址
- **地址标签**：当支付地址或接收地址属于当前钱包账户时，显示对应账户标签；外部地址不冒充为本地账户标签
- **网络费一致性**：记录中显示的网络费与交易确认页面显示的网络费差距较小（允许合理误差）

**渠道商数据验证**：
- **渠道商名称**：记录中显示的渠道商名称正确（如"0x Protocol"）
- **汇率显示**：记录中显示的汇率正常，可以点击汇率切换汇率方向（正向/反向）
- **渠道商费用**：记录中显示的渠道商费用与询价时渠道商列表展示的费用一致（如 0x 渠道为 0.25%）
- **Order ID**：对于支持 Order ID 的渠道（如 CowSwap、1inch Fusion），记录中显示 Order ID 且格式正确

**金额一致性**：
- 记录中的金额与交易时输入的金额一致
- 金额精度一致性

**手续费一致性**：
- 记录中的手续费与交易时扣除的手续费一致
- 手续费明细一致性

**状态一致性**：
- 记录中的状态与链上状态一致
- 状态更新及时性

**时间戳准确性**：
- 记录中的时间戳准确
- 时间格式一致性

#### 4.4 跨链订单记录

**订单状态查询**：
- 订单状态查询功能验证

**状态同步**：
- 订单状态从 Pending → Processing → Success/Failed
- 状态同步及时性和准确性

**记录关联**：
- 跨链订单记录与链上交易记录关联正确
- 记录关联准确性

---

### 5. Swap K 线入口测试（K-line Testing）

#### 5.1 入口状态

- Swap 页面新增 K 线按钮入口。
- From 与 To 均未选择时，K 线按钮禁用且不可点击。
- From 与 To 任一已选择时，K 线按钮启用，点击后打开 K 线视图。
- Pro 交易端已有 K 线入口，本期不改动 Pro 交易端入口。

#### 5.2 默认展示代币

| From / To 类型 | 默认展示 | 切换规则 |
|---------------|----------|----------|
| 两个均为非稳定币 | From 代币 | 支持切换到 To |
| 一个稳定币 + 一个非稳定币 | 非稳定币 | 支持切换到稳定币 |
| 两个均为稳定币 | From 代币 | 支持切换到 To |

- 稳定币识别复用现有滑点判定中的稳定币判定逻辑。
- 用户主动切换时间区间后，不需要记住该选择；重新进入按默认周期加载。

#### 5.3 K 线数据与 fallback

- K 线数据复用 Market 模块请求方式，根据当前选中 Token 的网络与合约地址拉取行情。
- 默认请求小时线（1H）数据。
- 若 1H 无数据，自动 fallback 到日线（1D）。
- 若 1D 仍无数据，自动 fallback 到周线（1W）。
- 若 1H / 1D / 1W 均无数据，展示设计稿空状态。

#### 5.4 内容展示与异常

- K 线视图仅保留 K 线主图与 Volume，不展示 MA、MACD、RSI 等冗余指标。
- 切换 From / To 代币时，K 线视图必须重新加载对应 Token 数据。
- K 线请求 loading 时显示加载状态，不能出现空白内容区域。
- 网络异常或加载失败时显示失败提示，并提供重试入口。

### 5.5 Swap Stocks 入口与布局测试（Stocks Entry & Layout）

- Trade 页面新增股票（Stocks）分类，和 `Swap & Bridge`、`Pro` 等分类并列展示。
- 小屏移动端分类栏超出一屏时，必须使用横向滑动选择器：
  - Tab 间距按设计稿收敛
  - 右侧 3 个选项保持可见
  - 其余分类通过左右滑动访问
- 大屏范围内必须直接展示全部分类，不出现被截断的 Tab 文案。

### 5.6 Stocks 资产、渠道与面板信息

- Stocks 模式使用维护的股票代币列表，本期仅开放 BNB Chain 维护列表。
- 当前交易渠道固定为 `1inch Fusion`；未命中该渠道时，页面不能伪装成普通 Swap 渠道。
- 可买卖稳定币列表由 Dashboard 配置，当前默认基线为 `USDC / USDT`。
- 当前股票代币展示区必须显示：
  - Ticker
  - 公司名称
  - 发行商
  - 交易状态
  - 价格
- 上述字段均复用 Market 数据源；缺字段时应显示 loading / 空态 / 错误态之一，不能静默留白。
- K 线按钮点击后进入 Market Token details，不复用 Swap & Bridge 的简化 K 线弹层。

### 5.7 Stocks Buy / Sell 默认规则

- Buy 模式下支付币种只能是稳定币，不显示主币作为可选支付币种。
- 默认支付币种判定顺序：
  1. 比较 BSC 上 `USDC` 与 `USDT` 余额
  2. 余额较多者为默认值
  3. 若两者余额都为 0，则取 Dashboard 返回列表的第一个
- 用户主动切换过支付币种后，后续进入 Stocks 页面应沿用最后一次切换结果。
- Buy 的 `Estimated received`、`Rate`、渠道商展开信息、自动刷新次数与 Swap 逻辑一致。
- Sell 模式下卖出币种固定为当前 Ticker 位置的股票代币，不通过支付币种选择器切换。
- Sell 的稳定币默认值沿用 Buy 的默认规则；切换顶部股票代币后，Sell 的卖出币种随之切换。

### 5.8 Stocks 设置、持仓与搜索规则

- Stocks 交易统一走 REQ 模式。
- Stocks 设置面板不显示滑点设置；除滑点外，其余设置项沿用 Swap 现有结构。
- Stocks Tab 的持仓列表仅统计维护列表内的股票代币，不包含普通代币持仓。
- 股票代币选择器仅展示维护列表中的股票代币。
- 搜索支持关键词与合约地址，但搜索范围仅限维护列表。
- 本期仅展示 BNB Chain 股票列表，不提供网络切换入口。

### 5.9 Stocks 订单、历史与异常处理

- Stocks 模式沿用 Swap 的询价、构建订单、确认、签名与提交链路。
- 提交成功后，订单必须新增到 Trade 历史中。
- 后端错误返回分为两部分：
  - 错误信息：用于控制文案
  - 交易控制：用于控制按钮禁用与可提交状态
- 需要覆盖的后端错误至少包括：
  - 未知错误
  - 最小金额限制 `20 USDC`
  - 最大金额限制 `100K`
  - 地区限制
  - 休市
- 休市态规则：
  - 若 Perps 有同标的 Ticker，提示前往 Perps
  - 若无同标的 Ticker 且有倒计时，展示开市倒计时
  - 若无倒计时，展示等待开市提示

### 5.10 Stocks Desktop K 线与 Market Data

- Desktop Stocks 页面在交易面板外额外展示 K 线与 Market Data 区域。
- K 线直接使用 TradingView，默认选中 `1h`。
- Market Data 数据与 tooltip 复用 Market 模块，不单独维护第二套文案或字段源。
- Desktop 的图表、交易面板、持仓与历史区域应可在同一页面内联动当前股票代币。

### 5.11 Swap Limit 入口与交易规则（Limit）

- Trade 页面新增 `Limit` 分类，和 `Swap & Bridge`、`Stocks` 并列展示。
- 当前 Limit 模式固定渠道为 `Cow Limit`；若未命中该渠道，不应伪装成 Limit 可下单态。
- 当前支持网络仅限：`Ethereum / Base / Arbitrum`。
- 当前 Limit 模式仅覆盖同链限价订单，不扩展到跨链。
- **from 主币不支持**：
  - `Ethereum / Base / Arbitrum` 上以原生主币作为 `From` 时，不允许进入可下单态
  - 页面需展示禁用态或限制文案，不应继续构建 `Cow Limit` 订单
- Limit 模式当前有效方向以 **ERC20 作为源币**：
  - `Token -> Token`
  - `Token -> Native / Wrapped Native`（若产品在 `To` 侧开放原生币或包装主币）
- Limit 面板至少覆盖以下信息：
  - `From / To` 网络与币种
  - 输入金额与余额
  - `25% / 50% / 100% / Max` 快捷填充
  - `Limit price`
  - `Provider`
  - `Order expires in`
  - `Partial fill`
- `Limit price` 支持按当前市场价回填或切换为用户自定义价格；修改价格后，订单预估结果与 Review 页必须同步刷新。
- `Order expires in` 与 `Partial fill` 属于订单参数的一部分；用户修改后，Review 页、历史详情与订单状态需保留对应配置。
- ERC20 作为源币时，需覆盖未授权与已授权两类状态；未授权时先走授权，再进入 Limit 下单流程。
- 成功提交 Limit 订单后，历史 / 订单列表中需记录：
  - 交易对
  - 下单数量
  - Limit price
  - Provider=`Cow Limit`
  - 订单状态（如 Open / Filled / Partially Filled / Cancelled / Expired / Failed）
- 取消订单、订单过期、部分成交后继续成交等状态流转，需在历史 / 订单详情中持续可追踪。

### 5.12 移动端 Swap Pro Mode 规则（Mobile Pro Mode）

- 移动端 `Pro mode` 入口与 `Swap / Bridge` 并列展示，是移动端 Trade 下的独立交易视图。
- 移动端 Pro Mode 结合了**市价单（Market）**与**限价单（Limit）**两种订单类型：
  - `Market` 场景在 Pro Mode 用例内完整覆盖
  - `Limit` 场景的详细下单、参数、状态流转**不在 Pro Mode 用例重复描述**，直接复用 `docs/qa/testcases/cases/swap/2026-07-16_Swap-Limit测试.md`
- Pro Mode 顶部代币信息区需复用 Market 数据源，至少展示：
  - 代币名 / 图标
  - `Market cap / 24h Vol / Liquidity / Holders`
  - 最新价格与涨跌幅
  - `Price / Value` 成交列表
  - `B / S` 比例与最近周期成交统计
- 顶部代币切换弹层只展示 **Global search 的 Market 数据**；搜索、切换网络、收藏等其余交互规则与 Market 保持一致。
- Pro Mode 的 K 线 / 图表入口点击后跳转 Token Details，不在当前页内维护第二套 K 线详情。
- `Market` 订单类型下：
  - 金额输入逻辑沿用 Market 口径
  - 支持快捷金额分档
  - 支持滑动 / 分段控件按固定分位调节 amount，联动刷新 value
  - 支持输入法币 value 反算 amount
- 钱包入口不占用顶部导航；当前选中的钱包名称与地址缩略展示在交易面板内，点击后进入 Wallet modal 切换。
- Pro Mode 应展示滑点 / Auto 设置等交易参数；参数修改后需即时影响 Market 下单结果。
- `My positions / Open order / Order history`（若当前版本展示）需与当前 Pro Mode 代币和订单类型联动：
  - `My positions` 展示 Market 支持的链仓位，按估值从高到低排序
  - 勾选 `Current symbol` 时，仅保留当前代币相关仓位
  - `Open order / Order history` 中的 Limit 订单明细验证复用独立 Limit 用例
- 不支持场景需展示业务告警文案，如：
  - 当前网络 / 钱包不支持 Swap
  - 当前代币不支持 Pro Mode，提示用户回到 `Swap` 或 `Bridge`

---

## 🌐 多链测试覆盖规则

### 渠道与网络支持矩阵

生成 Swap 模块测试用例时，必须根据不同的 Swap 渠道覆盖其支持的网络。各渠道支持的网络如下：

**渠道与 provider 映射表**（编写 API 用例时，请求体/断言中的 `provider` 必须按下表取值，不得自拟）：

| 渠道 | provider |
|------|----------|
| 0x | `Swap0x` |
| 1inch | `Swap1inch` |
| 1inch Fusion | `Swap1inchFusion` |
| Jupiter | `SwapJupiter` |
| OKX | `SwapOKX` |
| CowSwap | `SwapCow` |
| Swft | `SwapSwft` |
| Exodus | `SwapExodusBridge` |
| Panora | `SwapPanora` |
| LiquidMesh | `SwapLiquidMesh` |
| LiFi | `SwapLifi` |
| Near | `SwapNear` |
| Changelly | `SwapChangelly` |
| ChangeHero | `SwapChangeHero` |
| Houdini | `SwapHoudi` |
| RocketX | `SwapRocketX` |
| HiFi | `SwapHifiSwap` |
| SwapKit（ThorChain） | `SwapThor` |

**渠道构建依赖规则（quoteResultCtx）**：
- 部分渠道的构建接口（`POST /swap/v1/build-tx`）**必须依赖询价返回的上下文**（如 `quoteResultCtx` / 内部 quoteId / CowSwap 未签名订单等），不能只靠静态字段拼 body。
- 编写任意渠道的构建用例前，必须先根据下表确认**是否需要传 `quoteResultCtx`**：

| 是否需要 quoteResultCtx | 渠道 | 说明 |
|------------------------|------|------|
| ✅ 需要 | LiFi (`SwapLifi`) | 构建依赖前一步跨链询价结果（内部路径/quoteId 等） |
| ✅ 需要 | Changelly (`SwapChangelly`) | 构建依赖 Changelly 侧 quote 上下文 |
| ✅ 需要 | ChangeHero (`SwapChangeHero`) | 构建依赖 ChangeHero 侧 quote 上下文 |
| ✅ 需要 | 1inch Fusion (`Swap1inchFusion`) | 必须先 quote，使用返回的 `quoteResultCtx` 进行 Fusion 构建 |
| ✅ 需要 | CowSwap (`SwapCow`) | 必须携带 CowSwap 询价返回的 `quoteResultCtx`（包括 unsignedOrder、appData、quoteId、签名等） |
| ✅ 需要 | Exodus (`SwapExodusBridge`) | 仅跨链渠道，构建前必须先询价并携带返回的 `quoteResultCtx`（跨链路径、桥接信息等） |
| ✅ 需要 | Houdini (`SwapHoudi`) | 构建前必须先询价并携带返回的 `quoteResultCtx`；询价请求固定传 `incognito=true` |
| ✅ 需要 | RocketX (`SwapRocketX`) | 同链 + 跨链聚合，构建前必须先询价并携带返回的 `quoteResultCtx`（路由 / 订单 ID 等） |
| ✅ 需要 | HiFi (`SwapHifiSwap`) | 构建前必须先询价并携带返回的 `quoteResultCtx` |
| ✅ 需要 | Near (`SwapNear`) | 实探发现不带 `quoteResultCtx` 的 build 容易落到通用 `500`，带上后才能进入业务层校验 |
| ❌ 不需要 | 0x (`Swap0x`) | 仅依赖静态参数（from/to/tokenAmount/network/provider/slippage 等） |
| ❌ 不需要 | 1inch (`Swap1inch`) | 普通 1inch 构建不需要 quoteResultCtx，按静态参数构建 |
| ❌ 不需要 | OKX (`SwapOKX`) | 构建按静态参数+provider 即可 |
| ❌ 不需要 | ThorSwap / SwapKit（`SwapThor`） | 由 SwapKit 封装，当前构建按静态参数处理 |
| ✅ 需要 | Panora (`SwapPanora`) | Aptos Panora 当前按 `quote/events -> quoteResultCtx.panoraQuoteResultCtx -> build-tx` 执行 |
| ✅ 需要 | Jupiter (`SwapJupiter`) | Solana Jupiter 构建依赖 quote 返回的 `quoteResultCtx`，并且必须返回 `data.tx` |

> 规则：生成构建用例时，先根据渠道名查本表——**需要 quoteResultCtx 的渠道**，用例必须先说明「前置询价 + 提取 quoteResultCtx」或直接使用真实 quoteResultCtx 示例；**不需要的渠道**则禁止伪造无效 quoteResultCtx 字段，保持 body 简洁一致。
>
> Exodus 额外规则（强制）：
> - 每条 Exodus 用例必须按 `quote -> 提取 Exodus quoteResultCtx -> build-tx` 执行，不允许直接 build。
> - `quote.data` 未命中 `SwapExodusBridge` 即判定 failed。
> - 命中 Exodus 但无 `quoteResultCtx` 也判定 failed。
> - 断言失败时输出 providers / exodusQuote 便于定位（减少重复调试）。

**Apifox 渠道询价跳过口径（统一规则）**：
- 适用范围：所有 `Swap-*-Apifox-TestCases.json` 渠道集合的 **quote 阶段**。
- 以下情况改记为 **SKIP**，不再按硬失败处理：
  - `quote` 接口返回 `HTTP 502 / 503 / 504`
  - 请求超时（如 `timeout` / `timed out` / `超时`）
  - 命中目标 provider，但条目 `errorMessage` 为 `Provider error`、`渠道商异常`、`报价不可用`
  - 询价成功返回，但 `data=[]` 或等价空结果（偶发空 data）
- SKIP 输出要求：测试结果中必须显式输出 `[\u7528\u4f8b\u540d] SKIP <provider> <reason>`，让执行结果能直接看出“这条是跳过的用例”以及原因归属。
- 命中上述 SKIP 条件后，**立即停止当前 case 的 build 阶段**，避免把上游瞬态问题继续放大成二次失败。
- 以下情况仍按 **failed** 处理，不得降级成 SKIP：
  - `data` 非空，但目标 provider 根本未命中
  - 命中 provider 且 `errorMessage` 为空，但缺少有效 `toAmount / fromAmount`
  - 命中 provider 且 `errorMessage` 为空，但缺少 `quoteResultCtx`（对依赖上下文的渠道）
  - 已确认属于参数、地址大小写、header 口径、networkId、变量未展开等本地脚本问题

> 目的：把“产品/脚本真失败”和“渠道商/网关瞬态波动”分层展示，避免批量回归被上游偶发抖动污染，同时保留清晰的 SKIP 留痕。

#### 同链聚合器（DEX Aggregator）

**0x**：
- Ethereum、Polygon、Arbitrum、Avalanche、BSC、Optimism、Base

**1inch**：
- Ethereum、Polygon、Arbitrum、Avalanche、BSC、Optimism、Base、zkSync Era、Fantom

**1inch Fusion**：
- Ethereum、Arbitrum、Optimism、BSC、Polygon、Avalanche

**Jupiter**：
- Solana

**CowSwap**：
- Ethereum、Arbitrum、Base

#### 跨链桥（Cross-Chain Bridge）

**Socket Bridge**：
- Ethereum、Optimism、BSC、Polygon、zkSync Era、Base、Arbitrum、Avalanche

#### SwapKit 系列

**ThorChain**：
- Ethereum、Avalanche、Base、BSC、BTC、LTC、BCH、DOGE

**MAYAChain**：
- Ethereum、Arbitrum、BTC

**Chainflip**：
- Ethereum、Arbitrum、Solana、BTC

**SwapKit（统一渠道口径）**：
- 跨链支持网络：Ethereum、Avalanche、Base、BSC、BTC、LTC、BCH、DOGE、Arbitrum、Solana

#### 第三方服务商

**SWFT**：
- 同链支持网络：Tron、SUI、TON
- 跨链支持网络：BTC、Ethereum、BSC、Polygon、Avalanche、Arbitrum、Optimism、Base、SOL、Tron、Near、DOGE、LTC、BCH、APT、TON、SUI

**Exodus（仅跨链）**：
- BTC、Doge、LTC、Optimism、Arbitrum、Ethereum、Base、BSC、Solana、Avalanche、Polygon、Fantom、Ripple、Tron、TON、SUI

**LiquidMesh**：
- 同链支持网络：Ethereum、BSC、Base、Solana、Tron、Sonic、SUI
- provider 为 `SwapLiquidMesh`
- 当前 Apifox 口径：quote 走普通 `/swap/v1/quote`，build **必须**携带 quote 返回的 `quoteResultCtx`
- 已验证成功集：Ethereum、BSC、Base、Solana、Sonic
- `Tron / SUI` 当前按常规参数实探未命中 `SwapLiquidMesh`，暂不写入成功集，等待客户端成功 curl 回填

**Changelly**：
- 同链支持网络：Tron、Solana、TON
- 跨链支持网络：BTC、Ethereum、Polygon、Avalanche、Fantom、Arbitrum、Optimism、Solana、Near、ETC、DOGE、LTC、BCH、Ripple、zkSync Era、CFX、Base、Kaspa

**ChangeHero**：
- 同链支持网络：Tron、Solana、TON
- 跨链支持网络：Ethereum、BSC、Polygon、Avalanche、Fantom、Arbitrum、Optimism、Solana、Near、ETC、DOGE、LTC、BCH、Ripple、zkSync Era、CFX、Base、Kaspa、Tron、TON、SUI、Aptos、BTC

**OKX**：
- 同链支持网络：Ethereum、Arbitrum、Optimism、BSC、Polygon、Avalanche、Fantom、zkSync Era、Base、Solana、TON、SUI、Sonic、Scroll、Blast、Linea、X Layer
- provider 为 `SwapOKX`
- 当前 Apifox 成功集只维护**同链**路由，quote 使用普通 `/swap/v1/quote`
- build 不依赖 `quoteResultCtx`，按静态参数 + quote 返回的 `toAmount` 构建即可
- 头部已对齐客户端口径：`6.4.0 / 2026060378 / zh-cn / light / jsbundle 13236892`
- 特殊资产口径：`Blast` 当前使用 `USDB` 基线，`X Layer` 主币为 `OKB`
- `SUI` 当前三类同链方向都能命中 `SwapOKX` 并进入业务层，但 `build` 可能返回 `20505 / 流动性不足`；在批量 Apifox 成功集中应视为可接受兜底，而不是参数错误

**Panora**：
- Aptos

**LiFi**：
- 多链聚合器，同链 + 跨链均覆盖；provider 为 `SwapLifi`。
- 同链支持网络：Ethereum、BSC、Polygon、Arbitrum、Avalanche、zkSync、Sonic、Scroll、Mantle、Blast、Base、Optimism、Fantom、Solana、HyperEVM、Robinhood
- 跨链支持网络：Ethereum、BSC、Polygon、Arbitrum、Avalanche、zkSync、Sonic、Scroll、Mantle、Blast、Base、Optimism、Fantom、Solana、HyperEVM
- 构建请求必须复用 quote 返回的 `quoteResultCtx`，不允许直接 build。
- LiFi 当前 Apifox 金额基线：稳定币 `100`；主币按 `2026-06-03` 市价近似折算 `~100 USD`，默认采用 `ETH 系 0.053`、`BNB 0.156`、`POL 1070`、`AVAX 12.1`、`SOL 1.34`、`MNT 164`、`S 2635`、`HYPE 1.38`。
- 地址与合约：统一从 `swap-network-features.md` 读取。
- LiFi 的部分 EVM 稳定币地址当前对大小写敏感：Arbitrum / Optimism / Mantle / HyperEVM 的 `USDC / USDT` 在 Apifox 集合中应统一使用**全小写**，否则可能出现 `Provider error` 且不返回 `quoteResultCtx`。
- LiFi Apifox 询价头部当前对齐客户端 `6.4.0 / 2026060378 / zh-cn / light / jsbundle 13236892`，并补齐 `x-amzn-trace-id`、`x-onekey-hide-asset-details`、`priority`、`sec-ch-*` 等字段。

**RocketX**：
- 多链聚合器，同链 + 跨链均覆盖。
- 已确认覆盖网络（同链 + 跨链组合使用）：Ethereum、BSC、Polygon、Avalanche、Arbitrum、Optimism、Base、Solana、SUI、Tron
- Apifox 成功集当前必须对照 Houdini 集合生成：除渠道名称与 provider 改为 `SwapRocketX` 外，请求参数、header、金额、滑点、钱包类型与路由配对均保持和 `Swap-Houdini-全网络全类型-Apifox-TestCases.json` 一致。
- RocketX API 询价必须走 `/swap/v1/quote/events`（SSE），不能用普通 `/swap/v1/quote` 判断渠道可用性；Apifox 脚本需解析 `data:` 事件行后再提取 provider 条目。
- RocketX 的 SUI 主币参数使用 `toNetworkId/fromNetworkId = sui--mainnet`，主币 token 地址使用 `0x2::sui::SUI`；不要使用 `sui--0 + 空 native token`。
- 地址与合约：必须从 `swap-network-features.md` 读取，不允许临时手填

**Houdini**：
- 多链聚合器，同链 + 跨链均覆盖；provider 为 `SwapHoudi`。
- 同链支持网络：Ethereum、BSC、Polygon、Avalanche、Arbitrum、Optimism、Base、Solana、SUI、Tron
- 跨链支持网络：BTC、Ethereum、BSC、Polygon、Avalanche、Arbitrum、Optimism、Base、Solana、SUI、Tron
- 询价请求必须携带 `incognito=true`；构建请求必须使用 quote 返回的 `quoteResultCtx`。
- Houdini API 询价必须走 `/swap/v1/quote/events`（SSE），不能用普通 `/swap/v1/quote` 判断渠道可用性；Apifox 脚本需解析 `data:` 事件行后再提取 provider 条目。
- Houdini 的 SUI 主币参数使用 `toNetworkId/fromNetworkId = sui--mainnet`，主币 token 地址使用 `0x2::sui::SUI`；不要套用通用 SUI 代币表中的 `sui--0 + 空 native token`。
- Houdini 的 Tron 主网参数使用 `fromNetworkId/toNetworkId = tron--0x2b6653dc`；不要使用旧的 `tron--0`，否则 Tron 源链询价可能返回空 provider。
- 地址与合约：必须从 `swap-network-features.md` 读取，不允许继承其他渠道变量表。

**HiFi**：
- 新渠道，同链 + 跨链均覆盖；HiFiSwap 按中心化换汇服务渠道处理，EVM / Tron 网络不覆盖授权逻辑；provider 为 `SwapHifiSwap`。
- 同链支持网络：Ethereum、BSC、Polygon、Arbitrum、Base、Solana、Tron
- 跨链支持网络：BTC、Ethereum、BSC、Polygon、Arbitrum、Base、Solana、Tron
- BTC 特殊规则：凡命中 BTC 网络，必须覆盖 BTC 目标链新鲜地址与 BTC 源链找零地址，规则以 `swap-network-features.md` §BTC 新鲜地址 / 找零地址为准。

### 多链测试覆盖原则

#### 1. 同链测试覆盖

**必须覆盖场景**：
- 每个渠道在其支持的每个网络上至少覆盖 1 个同链兑换场景
- 优先覆盖主流网络（Ethereum、BSC、Polygon、Arbitrum、Optimism、Base、Avalanche）
- 特殊网络（如 Solana、zkSync Era）需单独验证渠道特定逻辑

**兑换类型覆盖**（必须全部覆盖）：
- **主币到代币**（Native Token → ERC20 Token）：如 ETH → USDC
- **代币到主币**（ERC20 Token → Native Token）：如 USDC → ETH
- **代币到代币**（ERC20 Token → ERC20 Token）：如 USDC → DAI
- **注意**：同链不支持主币到主币（同链主币到主币没有意义）

**测试重点**：
- 渠道路由选择正确性（如 Ethereum 使用 0x/1inch，Solana 使用 Jupiter）
- 网络特定 Gas 费计算（不同网络的 Gas 单位不同）
- 网络特定代币精度处理

#### 2. 跨链测试覆盖

**必须覆盖场景**：
- 每个跨链渠道在其支持的源链和目标链组合中至少覆盖 1 个跨链兑换场景
- 优先覆盖主流链组合（如 Ethereum ↔ Arbitrum、Ethereum ↔ BSC）
- 特殊链组合（如 BTC ↔ Ethereum、Solana ↔ Ethereum）需单独验证

**兑换类型覆盖**（必须全部覆盖）：
- **主币到主币**（Native Token → Native Token）：如 ETH → BNB（跨链）
- **主币到代币**（Native Token → ERC20 Token）：如 ETH → USDC（跨链）
- **代币到主币**（ERC20 Token → Native Token）：如 USDC → ETH（跨链）
- **代币到代币**（ERC20 Token → ERC20 Token）：如 USDC → DAI（跨链）

**测试重点**：
- 跨链路由选择正确性
- 跨链费用计算准确性
- 跨链时间估算准确性
- 跨链订单状态查询

#### 3. 渠道切换测试

**必须覆盖场景**：
- 同一网络多个渠道可用时，验证渠道切换功能
- 渠道不可用时（如网络不支持），验证降级或错误提示

**测试重点**：
- 渠道优先级选择逻辑
- 渠道不可用时的错误处理
- 渠道切换后报价刷新

#### 4. 网络特定规则测试

**重要说明**：详细的网络特性表请参考 `docs/qa/rules/swap-network-features.md`，包含所有支持网络的详细特性（主币信息、授权要求、交易费单位、特殊规则等）。

**地址来源强制规则**：
- 生成 Swap 用例时，`userAddress` / `receivingAddress` / 代币合约地址必须从 `docs/qa/rules/swap-network-features.md` 读取。
- 新增网络或新增渠道时，必须先更新 `swap-network-features.md` 的账户与合约地址，再生成用例。
- 地址文档未更新时，应先提醒补齐，不直接产出新用例。

**渠道最低金额确认规则**：
- 生成或维护任意 Swap Apifox 接口测试用例前，必须先向用户确认该渠道是否存在最低金额限制。
- 如果用户已给出渠道最低金额口径，必须写入对应渠道规则并同步到 Apifox 集合；不得直接继承其他渠道或旧集合的金额表。
- 未确认最低金额限制时，不要批量生成全网络用例，先使用少量探测用例或等待用户确认。

**用户地址（userAddress）规则**：
- 本文件不再维护独立地址表；统一以 `docs/qa/rules/swap-network-features.md` 为唯一来源（source of truth）。
- 所有 Swap API 用例在同一网络下必须复用该文档中的 `userAddress` / `receivingAddress`。
- 禁止在单个用例里临时手填历史地址或随机地址。

> 规则：编写任意渠道的 Swap 用例时，`userAddress` 与 `receivingAddress` 必须从 `swap-network-features.md` 读取。

**代币合约地址规则**：
- 不同网络常用代币的合约地址在本节中维护，**生成测试用例时必须从表中选取**，避免临时手填导致不一致
- **代币<>代币场景禁止使用同一个合约地址**，如 USDC→USDC 不允许，需使用 USDC→USDT 或 USDT→USDC 等组合
- 实际地址维护以 `docs/qa/rules/swap-network-features.md` 为准；本节强调规则，不再作为最新地址源。

| 网络 | 代币 | 类型 | 合约地址 / Mint |
|------|------|------|-----------------|
| Solana | SOL | 主币 | `native`（无合约地址，使用账户地址+lamports） |
| Solana | USDC | 代币 | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| Solana | USDT | 代币 | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` |
| Aptos | APT | 主币 | `0x1::aptos_coin::AptosCoin` |
| Aptos | USDC | 代币 | `0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b` |
| Aptos | USDT | 代币 | `0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b` |
| SUI | SUI | 主币 | `0x2::sui::SUI` |

> 生成 Jupiter、Panora 等异构链渠道的用例时：  
> - 主币<>代币场景：主币使用上表主币标识（如 Aptos APT 用 `0x1::aptos_coin::AptosCoin`，SUI 主币用 `0x2::sui::SUI`，Solana 主币保持空字符串）。  
> - 「代币<>代币」用例应优先使用上表中的 USDC/USDT 组合，确保 `fromTokenAddress` 与 `toTokenAddress` 不同。

### Exodus 用例生成加速规则（避免重复调试）

1. `主币<>代币`、`代币<>主币`、`代币<>代币` 必须采用**跨链多网络组合**，不允许写成单一同链示例。
2. 生成前必须先做 `/swap/v1/quote` 可用性探测，只保留「命中 `SwapExodusBridge` 且带 `quoteResultCtx`」的组合为成功用例。
3. 对于持续 `data=[]` 的组合，单独归档为预期失败场景，不混入成功用例集。
4. 当前金额基线：
   - 主币：Ethereum `0.1`、BSC `1`、Solana `1`、SUI `1000`
   - 代币：默认 `100`
5. 若路由失效，先调金额重新探测，再改用例，不要直接反复调试脚本断言。

### Jupiter 用例生成加速规则（避免重复调试）

1. Jupiter 仅支持 Solana 网络，优先覆盖 Solana 同链三类：主币<>代币、代币<>主币、代币<>代币。
2. 代币地址、账户地址必须取自 `swap-network-features.md`，禁止写历史地址。
3. **询价接口**：Jupiter 当前按 `/swap/v1/quote/events` SSE 执行，与客户端成功 curl 保持一致。
4. **构建依赖 `quoteResultCtx`**：每条 Jupiter 用例必须按 `quote/events -> 提取 Jupiter quoteResultCtx.jupiterQuoteResultCtx -> build-tx` 执行，不允许直接 build。
5. 生成前先探测 `/swap/v1/quote/events`：至少保留 1 组稳定返回 Jupiter 报价且可构建（`data.tx`）的参数组。
6. 对持续返回空路由、命中 Jupiter 但无 `quoteResultCtx`、或构建无 `data.tx` 的参数，归档为预期失败，不混入成功集。
7. 代币<>代币需使用不同合约地址（如 USDC↔USDT），禁止同币对敲。
8. 当前成功集金额基线（`2026-06-04` 实探）：
   - `SOL -> USDC` 使用 `0.01`
   - `USDC -> SOL` 使用 `10`
   - `USDC -> USDT` 使用 `10`
9. 当前三类同链方向都可在项目基线地址上稳定命中 `SwapJupiter` 并返回 `build.data.tx`；`SOL -> USDC` 当前成功 curl 已回归到 `0.01`，旧集合里的 `0.2` 不再优先沿用。
10. Jupiter 的 SSE 报价响应当前可能不保证始终携带顶层 `code=0`，断言以 HTTP 200 + provider 条目有效为主，不要把 `code` 缺失误判成失败。
11. 若 Apifox 中出现 `providers=[]` 且 `raw={"code":0,"message":"Success","data":[]}`，优先排查 Tests 脚本里是否把 `{{...}}` 变量字面量直接拼进了 `pm.sendRequest`。

### Panora 用例生成加速规则（避免重复调试）

1. Panora 仅支持 Aptos 同链，provider 固定为 `SwapPanora`。
2. **询价接口**：Panora 当前按 `/swap/v1/quote/events` SSE 执行，与客户端成功 curl 保持一致。
3. **构建依赖 `quoteResultCtx`**：每条 Panora 用例必须按 `quote/events -> 提取 Panora quoteResultCtx.panoraQuoteResultCtx -> build-tx` 执行，不允许直接 build。
4. 断言口径：
   - `quote/events` 返回 HTTP 200 后，若未命中 `SwapPanora` 即判定 failed；
   - 命中 Panora 但条目携带 `errorMessage` 判定 failed；
   - 命中 Panora 且有 `toAmount`、`quoteResultCtx` 视为有效报价；
   - Panora 的 SSE 响应当前可能不保证始终携带顶层 `code=0`，断言以 HTTP 200 + provider 条目有效为主，不要把 `code` 缺失误判成失败；
   - 若 Apifox 中出现 `providers=[]` 且 `raw={"code":0,"message":"Success","data":[]}`，优先排查 Tests 脚本里是否把 `{{...}}` 变量字面量直接拼进了 `pm.sendRequest`；
   - `build` 断言 `code=0`，并校验 `data.tx` 存在。
5. 当前成功集金额基线（`2026-06-04` 实探）：
   - `APT -> USDC` 使用 `1`
   - `USDC -> APT` 使用 `1`
   - `USDC -> USDT` 使用 `100`
6. **Aptos 主币特例**：`APT -> USDC` 的主币 `fromTokenAddress` 使用 `0x1::aptos_coin::AptosCoin`；`USDC -> APT` 当前要稳定命中 `SwapPanora`，目标 `toTokenAddress` 也应显式写成 `0x1::aptos_coin::AptosCoin`，不要继续沿用旧集合里的空字符串。
7. 当前 Panora 成功集对齐桌面端成功 curl：header 基线使用 `6.4.0 / 2026060380 / 13293249 / locale=en / theme=light`。
8. 地址与 token 基线必须从 `swap-network-features.md` 读取；`2026-06-04` 已回填 Panora 当前稳定命中的 Aptos 样例地址。

### LiFi 用例生成加速规则（避免重复调试）

1. LiFi 为多链聚合器，**同链 + 跨链均覆盖**；配套文档维护在 `2026-06-03_Swap-LiFi渠道同链测试.md` 与 `2026-06-03_Swap-LiFi渠道跨链测试.md`。
2. **构建依赖 quoteResultCtx**：每条 LiFi API 用例必须按 `quote -> 提取 LiFi quoteResultCtx -> build-tx` 执行，不允许直接 build。
3. 断言口径：
   - `quote.data` 未命中 `SwapLifi` 即判定 failed；
   - 命中 LiFi 但条目携带 `errorMessage` 判定 failed（见 `shared/knowledge.json` K-095）；
   - 命中 LiFi 但无 `quoteResultCtx` 判定 failed；
   - 失败时输出 `providers=` 与 `lifiQuote=` 辅助定位。
4. **网络清单（已确认）**：
   - 同链：Ethereum、BSC、Polygon、Arbitrum、Avalanche、zkSync、Sonic、Scroll、Mantle、Blast、Base、Optimism、Fantom、Solana、HyperEVM、Robinhood
   - 跨链：Ethereum、BSC、Polygon、Arbitrum、Avalanche、zkSync、Sonic、Scroll、Mantle、Blast、Base、Optimism、Fantom、Solana、HyperEVM
5. **金额基线（用户已确认）**：
   - 稳定币（USDC / USDT）统一使用 `100`
   - 主币按 `2026-06-03` 市价近似折算 `~100 USD`：`ETH 系 0.053`、`BNB 0.156`、`POL 1070`、`AVAX 12.1`、`SOL 1.34`、`MNT 164`、`S 2635`、`HYPE 1.38`
   - 若执行日行情变化明显，可在 collection 中按同一折算原则微调，但不得回退到旧渠道金额表
6. **询价接口**：LiFi Apifox 用例统一调用 `/swap/v1/quote/events`，并按 SSE `data:` 行解析结果；不要再用普通 `/swap/v1/quote` 作为主口径。
7. **HyperEVM 特例**：HyperEVM 的 `USDC / USDT` 地址已按用户提供值回填到规则与 collection；执行时仍需保持全小写。
8. 变量表必须按 LiFi 支持网络生成，不允许直接继承 RocketX / Houdini / HiFi 的网络矩阵或金额表。
9. 若 Apifox 中同一 case 出现两条同名失败，优先检查是否是同一条 LiFi quote 同时触发了两个断言：`errorMessage !== ''` 与 `quoteResultCtx 缺失`。这通常是地址大小写或渠道参数口径不一致，不是两条独立 case 都失败。

### Swft 用例生成加速规则（避免重复调试）

1. Swft 为多链换汇渠道，provider 固定为 `SwapSwft`；当前按用户确认口径覆盖：
   - 同链：`Tron、SUI、TON`
   - 跨链：`BTC、Ethereum、BSC、Polygon、Avalanche、Arbitrum、Optimism、Base、SOL、Tron、Near、DOGE、LTC、BCH、APT、TON、SUI`
2. **构建依赖 `quoteResultCtx`**：每条 Swft API 用例必须按 `quote -> 提取 Swft quoteResultCtx -> build-tx` 执行，不允许直接 build。
3. **询价接口**：Swft 当前走普通 `/swap/v1/quote` JSON 接口；本轮实探不需要切 `/swap/v1/quote/events` SSE。
4. 断言口径：
   - `quote.data` 未命中 `SwapSwft` 即判定 failed；
   - 命中 Swft 但条目携带 `errorMessage` 判定 failed；
   - 命中 Swft 但无 `quoteResultCtx` 判定 failed；
   - 单条路由手动实探时，`build.code=0 + data 存在` 视为下单成功；`TRX -> USDT`、`TON -> USDT(TON)`、`SUI -> USDC`、`ETH -> BNB`、`BTC -> ETH` 已实探为 `code=0`。
   - Apifox 批量连续跑 `quote -> build` 时，Swft 目前容易返回 `code=20344 / 操作频繁，请稍后再试`。这是服务端限频，说明请求已进入业务层，不应继续按“参数错误 / body 错误”处理；集合断言应将 `20344` 视为可接受的限频兜底结果。
5. **金额基线**：稳定币（USDC / USDT）统一使用 `100`；主币按 `2026-06-03` 实时价格近似折算 `~100 USD`：
   - `ETH 系 0.053`
   - `POL 1070`
   - `AVAX 12.1`
   - `SOL 1.34`
   - `NEAR 38`
   - `DOGE 1000`
   - `LTC 2.07`
   - `BCH 0.4`
   - `TON 50`
   - `SUI 120`
   - `TRX 300`
   - `BTC 0.0015`
6. **已验证的同链路由口径**：
   - Tron 同链当前保留 `TRX <-> USDT`。
   - TON 同链使用 `networkId=ton--mainnet`；当前可用 `TON -> USDT(TON)`、`USDT(TON) -> TON`。TON `USDT` 地址基线为 `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs`。
   - SUI 同链当前可用 `SUI -> USDC`、`USDC -> SUI`；`USDC -> USDT` 虽能返回 `SwapSwft` provider 元信息，但不返回有效 `toAmount / quoteResultCtx`，不要混入成功集。
7. **跨链特例**：
   - SUI 主币路径当前按 `sui--mainnet + 0x2::sui::SUI` 生成。
   - `BSC -> Avalanche (USDT -> USDC)` 已验证可作为 Swft 的跨链 `token -> token` 覆盖样例。
   - 用户提供的客户端成功 curl 进一步确认：Swft 的 build body 核心依赖 `quoteResultCtx.swftQuoteResultCtx.quoteFromAmount / quoteToAmount`，不要求额外订单 ID 字段；因此若批量集合出现大面积 build 失败，应优先排查限频，而不是误改 body 结构。
   - Aptos 虽在支持网络清单里，但 `2026-06-03` 对 `Aptos -> Ethereum APT -> ETH` 与 `Ethereum -> Aptos ETH -> APT` 两组路由实探均未命中 `SwapSwft`。在拿到客户端成功 curl 前，**不要把 Aptos 路由写入 Swft Apifox 成功集**。
8. 变量表必须从 `swap-network-features.md` 读取；当前 Swft collection 额外依赖 `SUI USDC` 与 `TON USDT` 地址基线。

### Near 用例生成加速规则（避免重复调试）

1. Near 为跨链聚合器，**仅覆盖跨链**，provider 固定为 `SwapNear`；网络清单为 `XRP、Tron、Ethereum、AVAX、Base、BSC、BTC、DOGE、Near、Solana`。
2. **构建依赖 quoteResultCtx**：Near API 用例必须按 `quote -> 提取 Near quoteResultCtx -> build-tx` 执行，不允许直接 build。2026-06-03 实探显示：不带 `quoteResultCtx` 的 build 容易直接返回通用 `500`。
3. **询价接口**：Near 当前走普通 `/swap/v1/quote` JSON 接口，不需要 `/quote/events` SSE。
4. 断言口径：
   - `quote.data` 未命中 `SwapNear` 即判定 failed；
   - 命中 Near 但条目携带 `errorMessage` 判定 failed；
   - 命中 Near 但无 `quoteResultCtx` 判定 failed；
   - `build` 阶段至少要到业务层，避免把“通用 500”误判成渠道失败。当前可接受结果为：`code=0`（构建成功）、`code=20033`（报价不可用，请刷新后重试）、`code=20699`（余额不足以支付网络费用）。
5. 金额基线：
   - 稳定币（USDC / USDT）统一使用 `100`
   - 主币按 `2026-06-03` 市价近似折算 `~100 USD`：`ETH 0.053`、`BTC 0.001`、`NEAR 38`、`DOGE 500`、`XRP 45`、`SOL 1.34`、`TRX 370`
6. 变量表必须显式包含 `Near / XRP / DOGE` 地址；当前项目基线里这三条先按有效样例地址维护，真正执行前建议替换成当前测试钱包地址。

### ChangeHero 用例生成加速规则（避免重复调试）

1. ChangeHero 为多链换汇渠道，provider 固定为 `SwapChangeHero`；当前按用户确认口径覆盖：
   - 同链：`Tron、Solana、TON`
   - 跨链：`Ethereum、BSC、Polygon、Avalanche、Fantom、Arbitrum、Optimism、Solana、Near、ETC、DOGE、LTC、BCH、Ripple、zkSync Era、CFX、Base、Kaspa、Tron、TON、SUI、Aptos、BTC`
2. **构建依赖 `quoteResultCtx`**：每条 ChangeHero API 用例必须按 `quote -> 提取 ChangeHero quoteResultCtx -> build-tx` 执行，不允许直接 build。
3. **询价接口**：ChangeHero 当前走普通 `/swap/v1/quote` JSON 接口；`/swap/v1/quote/events` 也能命中 provider，但生成 Apifox 成功集时优先用普通 `/quote`，与当前 build 探测口径保持一致。
4. 断言口径：
   - `quote.data` 未命中 `SwapChangeHero` 即判定 failed；
   - 命中 ChangeHero 但条目携带 `errorMessage` 判定 failed；
   - 命中 ChangeHero 但无 `quoteResultCtx` 判定 failed；
   - 当前成功集中的 build 可直接断言 `code=0` + `data` 存在；`ETH -> BNB`、`Tron.USDT -> TRX`、`TON -> USDT(TON)`、`BTC -> ETH` 已实探为 `code=0`。
5. **金额基线**：稳定币（USDC / USDT）统一使用 `100`；主币按 `2026-06-03` 实时价格近似折算 `~100 USD`：
   - `ETH 系 0.053`
   - `BNB 0.156`
   - `POL 1070`
   - `AVAX 12.1`
   - `SOL 1.34`
   - `NEAR 34`
   - `DOGE 1000`
   - `LTC 2.07`
   - `BCH 0.4`
   - `TON 50`
   - `SUI 120`
   - `TRX 300`
   - `BTC 0.0015`
   - `APT 116`
6. **已验证的同链路由口径**：
   - Tron 同链当前保留 `TRX <-> USDT`；`TRX <-> USDC`、`USDT -> USDC`、`USDC -> TRX` 已实探返回 `不支持该交易对`，不要混入成功集。
   - Solana 同链可用 `SOL -> USDC`、`USDC -> SOL`、`USDC -> USDT`。
   - TON 同链使用 `networkId=ton--mainnet`；当前可用 `TON -> USDT(TON)`、`USDT(TON) -> TON`。TON `USDT` 地址基线为 `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs`。
7. **跨链特例**：
   - TON 相关路由使用 `ton--mainnet`，不要用 `ton--0 / ton--1 / ton--239`。
   - SUI 主币路径当前按 `sui--mainnet + 0x2::sui::SUI` 生成。
   - 手工用例需按当前支持网络清单覆盖 `主币->主币`、`主币->代币`、`代币->主币`、`代币->代币` 四类方向；涉及 `BTC / LTC / BCH / DOGE / Ripple / Kaspa / Aptos / SUI` 等非 EVM 网络时，重点校验地址格式、网络费展示、历史记录与实际到账一致性。
   - Aptos 虽在支持网络清单里，但 `2026-06-03` 对 `aptos--1` 的多组 `APT / USDC` 路由实探均未命中 `SwapChangeHero`。在拿到客户端成功 curl 前，**不要把 Aptos 路由写入 ChangeHero Apifox 成功集**。
8. 变量表必须从 `swap-network-features.md` 读取；本次为 ChangeHero 补齐了 `TON / Aptos / Litecoin / Bitcoin Cash` 地址基线，以及 `TON / Aptos` 的稳定币地址。

### Changelly 用例生成加速规则（避免重复调试）

1. Changelly 为多链换汇渠道，provider 固定为 `SwapChangelly`；用户已明确确认其支持网络矩阵与 ChangeHero 相同：
   - 同链：`Tron、Solana、TON`
   - 跨链：`BTC、Ethereum、Polygon、Avalanche、Fantom、Arbitrum、Optimism、Solana、Near、ETC、DOGE、LTC、BCH、Ripple、zkSync Era、CFX、Base、Kaspa`
2. **构建依赖 `quoteResultCtx`**：每条 Changelly API 用例必须按 `quote -> 提取 Changelly quoteResultCtx -> build-tx` 执行，不允许直接 build。
3. 当前 Apifox 生成口径以 ChangeHero 成功集为骨架，但 **Tron 相关路由不能直接照搬旧样例地址**：`TRX -> USDT`、`USDT -> TRX`、`DOGE -> TRX` 在 `TPJkcqRHFfuE2xfgVzs6AA6tbJowz9pmH1` 上会命中 `build.code=20010 / 不支持该交易对`；需改用已实探成功的 `TTZMu9v3cxs3dGhoUABBmE672MN8hsNfb8`。
4. 对 Changelly 而言，`Tron` 相关路由当前即使普通 `/swap/v1/quote` 与 `/swap/v1/quote/events` 都能命中 provider 并返回 `quoteResultCtx`，`build` 阶段仍可能因目标链地址口径不同而返回 `20010`。这类问题优先排查 `userAddress / receivingAddress`，不要误判成 provider 或 token pair 不支持。
5. 同链手工用例优先覆盖 `Tron / Solana / TON`：
   - `Tron`：优先保留 `TRX <-> USDT`，Tron 地址默认使用 `TTZMu9v3cxs3dGhoUABBmE672MN8hsNfb8`
   - `Solana`：优先覆盖 `SOL -> USDC`、`USDC -> SOL`、`USDC -> USDT`
   - `TON`：使用 `ton--mainnet`，优先覆盖 `TON -> USDT(TON)`、`USDT(TON) -> TON`
6. 跨链手工用例按当前支持网络清单覆盖 `主币->主币`、`主币->代币`、`代币->主币`、`代币->代币` 四类方向；涉及 `BTC / LTC / BCH / DOGE / Kaspa / Ripple` 等非 EVM 网络时，重点校验地址格式、矿工费或网络费展示、历史记录与实际到账一致性。
7. 因本轮最初是基于用户纠正做镜像生成，除 `Tron` 地址口径外，仍**不要把“Changelly 已逐条实探通过”泛化写入规则或导入说明**。若后续拿到更多 Changelly 客户端成功 curl，再将该镜像集升级为独立实探成功集。
8. 变量表同样从 `swap-network-features.md` 读取；`TON / Litecoin / Bitcoin Cash / Ripple / Kaspa` 的地址基线与项目统一基线保持一致。Changelly collection 额外建议显式保留 `userAddressTronChangelly` 变量，默认值与当前 Tron 基线一致。

### OKX 用例生成加速规则（避免重复调试）

1. OKX 当前按**同链聚合器**处理，provider 固定为 `SwapOKX`；本轮成功集覆盖网络：`Ethereum、Arbitrum、Optimism、BSC、Polygon、Avalanche、Fantom、zkSync Era、Base、Solana、TON、SUI、Sonic、Scroll、Blast、Linea、X Layer`。
2. **询价接口**：OKX 当前走普通 `/swap/v1/quote` JSON 接口，不需要 `/swap/v1/quote/events` SSE。
3. **构建不依赖 `quoteResultCtx`**：build body 只需要 `from/to token`、`from/to amount`、`from/to networkId`、`provider=SwapOKX`、`userAddress`、`receivingAddress`、`slippagePercentage`、`kind`、`walletType`。不要为了对齐其他渠道而伪造 `quoteResultCtx`。
4. 断言口径：
   - `quote.data` 未命中 `SwapOKX` 即判定 failed；
   - 命中 OKX 但条目携带 `errorMessage` 判定 failed；
   - 命中 OKX 且有 `toAmount` 视为有效报价；
   - 非 SUI 路由的 `build` 当前直接断言 `code=0` + `data` 存在；
   - `SUI` 同链三类方向当前都能命中 provider 且进入业务层，但 `build` 稳定返回 `code=20505 / 流动性不足`，因此 `SUI` 路由的 build 断言应接受 `0 / 20505` 两种结果，并把 `20505` 归类为流动性兜底。
5. **金额基线**：稳定币（USDC / USDT / USDB）统一使用 `100`；主币按 `2026-06-04` 实探成功口径近似折算 `~100 USD`：
   - `ETH 系 0.053`
   - `BNB 0.156`
   - `POL 1070`
   - `AVAX 12.1`
   - `FTM 110`
   - `SOL 1.34`
   - `TON 50`
   - `SUI 120`
   - `S 2600`
   - `OKB 1.3`
6. **特殊资产基线**：
   - `Blast` 当前已验证成功的稳定币基线为 `USDB=0x4300000000000000000000000000000000000003`，不要误写成 USDC / USDT；
   - `X Layer` 当前已验证稳定币基线为 `0x74b7f16337b8972027f6196a17a631ac6de26d22`，quote 返回符号为 `USDC`，主币为 `OKB`；
   - `Fantom` 的稳定币对当前使用 `USDC -> fUSDT`（`0x04068...` -> `0x049d68...`），返回符号为 `fUSDT`。
7. 变量表与 token 地址必须从 `swap-network-features.md` 读取；`Blast / X Layer` 这类特殊链不要临时手填老变量名或继承其他渠道的 stable token 表。

### 0x 用例生成加速规则（避免重复调试）

1. 0x 当前按**同链聚合器**处理，provider 固定为 `Swap0x`；本轮成功集覆盖网络：`Ethereum、Arbitrum、Optimism、BSC、Polygon、Avalanche、Base`。
2. **询价接口**：0x 当前走普通 `/swap/v1/quote` JSON 接口，不需要 `/swap/v1/quote/events` SSE。
3. **构建不依赖 `quoteResultCtx`**：build body 只需要 `from/to token`、`from/to amount`、`from/to networkId`、`provider=Swap0x`、`userAddress`、`receivingAddress`、`slippagePercentage`、`kind`、`walletType`。不要为了对齐其他渠道而伪造 `quoteResultCtx`。
4. 断言口径：
   - `quote.data` 未命中 `Swap0x` 即判定 failed；
   - 命中 0x 但条目携带 `errorMessage` 判定 failed；
   - 命中 0x 且有 `toAmount` 视为有效报价；
   - `build` 当前直接断言 `code=0` + `data.tx` 存在。
5. **金额基线**：稳定币统一使用 `100`；主币按 `2026-06-04` 实探成功口径近似折算 `~100 USD`：
   - `ETH 0.055887 ~ 0.056109`
   - `BNB 0.16592`
   - `MATIC 1092.11`
   - `AVAX 12.6775`
6. Apifox Tests 脚本内禁止直接拼 `{{变量}}` 到 `pm.sendRequest`，必须显式读取 collection variables；当前客户端 header 基线收敛为：`6.4.0 / 2026060380 / 13293249 / locale=en / theme=light`。

### 1inch 用例生成加速规则（避免重复调试）

1. 1inch 当前按**同链聚合器**处理，provider 固定为 `Swap1inch`；用户确认支持网络为 `Ethereum、Arbitrum、Optimism、BSC、Polygon、Avalanche、Fantom、zkSync Era、Base`。
2. **询价接口**：1inch 当前走普通 `/swap/v1/quote` JSON 接口，不需要 `/swap/v1/quote/events` SSE。
3. **构建不依赖 `quoteResultCtx`**：build body 只需要 `from/to token`、`from/to amount`、`from/to networkId`、`provider=Swap1inch`、`userAddress`、`receivingAddress`、`slippagePercentage`、`kind`、`walletType`。
4. 断言口径：
   - `quote.data` 未命中 `Swap1inch` 即判定 failed；
   - 命中 1inch 但条目携带 `errorMessage` 判定 failed；
   - 命中 1inch 且有 `toAmount` 视为有效报价；
   - `build` 当前直接断言 `code=0` + `data.tx` 存在。
5. 本轮实探已直接 `build.code=0` 的成功网络为：`Ethereum、Arbitrum、Optimism、BSC、Polygon、Avalanche、zkSync Era、Base`；`Fantom` 虽在支持清单中，但在当前 header + 地址基线下三类常规同链路由都未命中 `Swap1inch`，因此暂不写入 Apifox 成功集，待客户端成功 curl 回填。
6. **金额基线**：稳定币统一使用 `100`；主币按 `2026-06-04` 实探成功口径近似折算 `~100 USD`：
   - `ETH 0.055952 ~ 0.056257`
   - `BNB 0.165929`
   - `MATIC 1095.94`
   - `AVAX 12.6629`
7. Apifox Tests 脚本内禁止直接拼 `{{变量}}` 到 `pm.sendRequest`，必须显式读取 collection variables；当前客户端 header 基线收敛为：`6.4.0 / 2026060380 / 13293249 / locale=en / theme=light`。

### LiquidMesh 用例生成加速规则（避免重复调试）

1. LiquidMesh 当前按**同链聚合器**处理，provider 固定为 `SwapLiquidMesh`；用户声明支持网络为 `Ethereum、BSC、Base、Solana、Tron、Sonic、SUI`。
2. **询价接口**：LiquidMesh 当前走普通 `/swap/v1/quote` JSON 接口，不需要 `/swap/v1/quote/events` SSE。
3. **构建依赖 `quoteResultCtx`**：build body 必须复用 quote 返回的 `quoteResultCtx.liquidMeshQuoteResultCtx`。同一路由若去掉 `quoteResultCtx`，当前会直接落到通用 `500 / 内部服务器错误`，不要按“不需要上下文”的聚合器模板生成。
4. 断言口径：
   - `quote.data` 未命中 `SwapLiquidMesh` 即判定 failed；
   - 命中 LiquidMesh 但条目携带 `errorMessage` 判定 failed；
   - 命中 LiquidMesh 且有 `toAmount`、`quoteResultCtx` 视为有效报价；
   - 已验证成功路由的 `build` 当前直接断言 `code=0` + `data` 存在；
   - Solana 的部分 `USDC -> SOL / USDC -> USDT` 路由虽能命中 `SwapLiquidMesh` 并返回 `quoteResultCtx`，但 build 当前会返回 `20033 / 报价不可用，请刷新后重试`，因此本轮成功集优先保留 `SOL -> USDC` 这条可直接 `code=0` 的路由。
5. **金额基线**：稳定币统一使用 `100`；主币按近 `100 USD` 口径优先探测：
   - `ETH 0.053`
   - `BNB 0.156`
   - `SOL` 当前因项目基线地址余额约束，成功集临时采用 `0.2`（`1.34` 会在 build 阶段命中余额/网络费相关业务错误）
   - 其余网络优先选用稳定币源路由补足三种兑换类型覆盖
6. **当前已验证成功路由**：
   - Ethereum：`ETH -> USDC`、`USDC -> ETH`、`USDC -> USDT`
   - BSC：`BNB -> USDC`、`USDC -> BNB`、`USDC -> USDT`
   - Base：`ETH -> USDC`、`USDC -> ETH`、`USDC -> USDT`
   - Solana：`SOL -> USDC`
   - Sonic：`USDC -> SONIC`
7. **当前未纳入成功集的网络说明**：
   - `Tron`：`TRX -> USDT`、`USDT -> TRX`、`TRX -> USDC`、`USDT -> USDC` 在 `tron--0x2b6653dc` 与旧 `tron--0` 口径下都未命中 `SwapLiquidMesh`
   - `SUI`：`SUI -> USDC`、`SUI -> USDT`、`USDC -> SUI`、`USDC -> USDT` 在 `sui--mainnet` 与旧 `sui--0` 口径下都未命中 `SwapLiquidMesh`
   - 这两条网络先在导入说明中明确标记为“声明支持但现网成功路由待补客户端成功 curl”，不要硬塞进 Apifox 成功集
8. 变量表、用户地址、稳定币地址统一从 `swap-network-features.md` 读取；Tron 使用 `TTZMu9v3cxs3dGhoUABBmE672MN8hsNfb8`，SUI 使用当前项目样例地址，不要临时替换成旧 collection 里的其他地址。

### RocketX 用例生成加速规则（避免重复调试）

1. RocketX 为多链聚合器，**同链 + 跨链均覆盖**，分别维护在 `2026-04-20_Swap-RocketX渠道同链测试.md` 与 `2026-04-20_Swap-RocketX渠道跨链测试.md`。
2. **构建依赖 quoteResultCtx**：每条 RocketX 用例必须按 `quote -> 提取 RocketX quoteResultCtx -> build-tx` 执行，不允许直接 build。
3. 断言口径：
   - `quote.data` 未命中 `SwapRocketX` 即判定 failed；
   - 命中 RocketX 但条目携带 `errorMessage` 判定 failed（见 `shared/knowledge.json` K-095）；
   - 命中 RocketX 但无 `quoteResultCtx` 判定 failed；
   - 失败时输出 `providers=` 与 `rocketxQuote=` 辅助定位（对齐 Exodus 做法）。
4. **网络清单（已确认）**：用例按「Ethereum、BSC、Polygon、Avalanche、Arbitrum、Optimism、Base、Solana、SUI、Tron」覆盖同链 + 跨链组合。
5. 代币<>代币禁止同地址对敲（如 USDC↔USDC）；异构链（Solana/SUI/Tron）按对应地址规则处理。
6. **询价接口**：RocketX API 用例必须调用 `/swap/v1/quote/events` 并按 SSE `data:` 行解析结果；普通 `/swap/v1/quote` 可能返回 `data=[]`，不能据此判定渠道无报价。
7. **SUI 主币参数**：RocketX 的 SUI 主币使用 `sui--mainnet` 和 `0x2::sui::SUI`，否则 Solana -> SUI 等主币路径会出现 `providers=[]`。
8. **当前 Apifox 成功集完全对照 Houdini 参数**：维护 `Swap-RocketX-全网络全类型-Apifox-TestCases.json` 时，以 `Swap-Houdini-全网络全类型-Apifox-TestCases.json` 为模板，仅替换集合/用例展示名中的 Houdini 为 RocketX，并将 provider 从 `SwapHoudi` 改为 `SwapRocketX`；其他请求参数、header、金额、滑点、钱包类型、路由配对保持一模一样。
9. 最低金额基线：跟随 Houdini 当前集合；不要为 RocketX 单独追加 `walletDeviceType=pro`、`X-Onekey-Wallet-Type=hw`、`walletType=hw` 或单路由 `slippagePercentage=1`，除非用户重新给出明确成功口径。

### Houdini 用例生成加速规则（避免重复调试）

1. Houdini 为多链聚合器，**同链 + 跨链均覆盖**，provider 固定为 `SwapHoudi`。
2. 网络清单：
   - 同链：Ethereum、BSC、Polygon、Avalanche、Arbitrum、Optimism、Base、Solana、SUI、Tron
   - 跨链：BTC、Ethereum、BSC、Polygon、Avalanche、Arbitrum、Optimism、Base、Solana、SUI、Tron
3. **构建依赖 quoteResultCtx**：每条 Houdini API 用例必须按 `quote -> 提取 Houdini quoteResultCtx -> build-tx` 执行，不允许直接 build。
4. **询价接口**：Houdini API 用例必须调用 `/swap/v1/quote/events` 并按 SSE `data:` 行解析结果；普通 `/swap/v1/quote` 可能返回 `data=[]`，不能据此判定渠道无报价。
5. **隐私参数**：Houdini 询价请求必须携带 `incognito=true`。
6. **SUI 主币参数**：Houdini 的 SUI 主币使用 `sui--mainnet` 和 `0x2::sui::SUI`，否则 Solana -> SUI 等主币路径会出现 `providers=[]`。
7. **Tron 主网参数**：Houdini 的 Tron 使用 `tron--0x2b6653dc`，否则 Tron 作为源链时可能无法匹配到 Houdini provider。
8. 最低金额基线：源币为主币时 Polygon `2000` MATIC、Solana `10` SOL、Tron `1000` TRX；源币为 USDC / USDT 时统一 `100`。
9. 变量表必须按 Houdini 支持网络从 `swap-network-features.md` 生成，不允许直接继承 Exodus / RocketX / HiFi 等其他渠道变量表。

### HiFi 用例生成加速规则（避免重复调试）

1. HiFi 为新渠道，**同链 + 跨链均覆盖**，分别维护在 `2026-05-15_Swap-HiFi渠道同链测试.md` 与 `2026-05-15_Swap-HiFi渠道跨链测试.md`。
2. 网络清单：
   - 同链：Ethereum、BSC、Polygon、Arbitrum、Base、Solana、Tron
   - 跨链：BTC、Ethereum、BSC、Polygon、Arbitrum、Base、Solana、Tron
3. provider 固定为 `SwapHifiSwap`；生成 API 用例时，请求体和断言均使用该 provider。
4. 支持 BTC 网络的 HiFi 跨链场景必须额外覆盖：
   - BTC 作为目标链：接收地址使用当前钱包派生的新鲜地址，不复用历史已收款地址。
   - BTC 作为源链：构建交易包含找零输出，找零地址属于当前钱包，且不等于渠道收款地址 / 跨链目标地址。
5. HiFiSwap 按中心化换汇服务渠道处理：EVM / Tron 网络不写授权流程，需验证不展示授权入口并直接进入渠道订单确认 / 换汇确认流程。
6. 代币<>代币禁止同地址对敲；Solana 不写授权流程。
7. 最低金额基线：参考 Houdini，源币为主币时 Polygon `2000` MATIC、Solana `10` SOL、Tron `1000` TRX；源币为 USDC / USDT 时统一 `100`；HiFi 支持 BTC 渠道，BTC 源币金额单独使用 `0.1` BTC。
8. BTC 场景需额外核对 UTXO 输入、渠道收款输出、找零输出与矿工费。
9. 变量表必须按 HiFi 支持网络生成，不允许继承其他渠道变量表；HiFi 不支持 Avalanche、Optimism、SUI，API 用例中不得出现 `evm--43114`、`evm--10`、`sui--0` 或对应代币变量。

### Private Send 用例生成规则（避免重复调试）

1. Private Send 归属 **Swap 模块**，但入口位于 **Send 流程**；用例文档单独维护为 `docs/qa/testcases/cases/swap/2026-05-22_Swap-Private-Send测试.md`，不要混入渠道同链/跨链文档。
2. 模式切换规则：
   - 进入 Send 页面默认选中 **Public**；
   - 仅当「OneKey 白名单 ∩ RocketX 当前支持范围」命中**当前网络 + 当前代币**，且全局总开关开启时，显示 `Public / Private` 二选一切换控件；
   - 当前已在 Private 模式时，若切换网络或代币后组合不再支持，必须自动切回 Public，并隐藏切换控件。
3. Private 金额输入页固定校验三个信息字段：
   - `Estimated received`：显示渠道商报价返回的目标币种数量与法币值；
   - `Arrival in`：显示 ETA 结果；
   - `Provider`：当前口径固定为 **RocketX**。
4. `How it works?` 为必测入口：
   - Desktop / Extension / Web 位于金额输入页左下；
   - Mobile 位于 `Preview` 下方；
   - 点击后跳转帮助中心占位 URL，不能停留当前页无反馈。
5. History Details 断言口径：
   - 交易类型为 **Private Send**；
   - Token 区域仅展示 `Send Amount`，不展示目标币种接收数量；
   - `From` 显示当前钱包地址；`To` 显示用户在 Send 流程填写的目标接收地址，而非链上实际收款地址；`Transaction ID` 显示用户付款链上 TxHash；`Provider` 显示 RocketX。
6. 状态机断言口径：
   - 快链：`Submitted -> Pending -> Done`；
   - 慢链：`Submitted -> Submitting -> Pending -> Done`；
   - 任一路径均需覆盖 `Failed` 终态展示与历史详情一致性。
7. Private Send 属于 Send 语义，不按 Swap 语义验收：历史详情中不把目标币种数量当作主展示资产，不新增「收到币种」主卡片。

### HiFi 用例生成加速规则（避免重复调试）

1. HiFi 为新渠道，**同链 + 跨链均覆盖**，分别维护在 `2026-05-15_Swap-HiFi渠道同链测试.md` 与 `2026-05-15_Swap-HiFi渠道跨链测试.md`。
2. 网络清单：
   - 同链：Ethereum、BSC、Polygon、Arbitrum、Base、Solana、Tron
   - 跨链：BTC、Ethereum、BSC、Polygon、Arbitrum、Base、Solana、Tron
3. provider 常量在当前仓库未检索到；生成 API / UI 自动化脚本前必须先从接入实现确认真实枚举，再补入「渠道与 provider 映射表」。手动用例先以渠道展示名 **HiFi** 作为路由、确认页与历史记录断言口径。
4. 支持 BTC 网络的 HiFi 跨链场景必须额外覆盖：
   - BTC 作为目标链：接收地址使用当前钱包派生的新鲜地址，不复用历史已收款地址。
   - BTC 作为源链：构建交易包含找零输出，找零地址属于当前钱包，且不等于渠道收款地址 / 跨链目标地址。
5. HiFiSwap 按中心化换汇服务渠道处理：EVM / Tron 网络不写授权流程，需验证不展示授权入口并直接进入渠道订单确认 / 换汇确认流程。
6. 代币<>代币禁止同地址对敲；Solana 不写授权流程。
7. 金额基线：按 `## 🔄 Swap 模块通用规则 / 金额覆盖测试规则` 的最小/中间/Max 三档覆盖；BTC 场景需额外核对 UTXO 输入、渠道收款输出、找零输出与矿工费。

### Private Send 用例生成规则（避免重复调试）

1. Private Send 归属 **Swap 模块**，但入口位于 **Send 流程**；用例文档单独维护为 `docs/qa/testcases/cases/swap/2026-05-22_Swap-Private-Send测试.md`，不要混入渠道同链/跨链文档。
2. 模式切换规则：
   - 进入 Send 页面默认选中 **Public**；
   - 仅当「OneKey 白名单 ∩ RocketX 当前支持范围」命中**当前网络 + 当前代币**，且全局总开关开启时，显示 `Public / Private` 二选一切换控件；
   - 当前已在 Private 模式时，若切换网络或代币后组合不再支持，必须自动切回 Public，并隐藏切换控件。
3. Private 金额输入页固定校验三个信息字段：
   - `Estimated received`：显示渠道商报价返回的目标币种数量与法币值；
   - `Arrival in`：显示 ETA 结果；
   - `Provider`：当前口径固定为 **RocketX**。
4. `How it works?` 为必测入口：
   - Desktop / Extension / Web 位于金额输入页左下；
   - Mobile 位于 `Preview` 下方；
   - 点击后跳转帮助中心占位 URL，不能停留当前页无反馈。
5. History Details 断言口径：
   - 交易类型为 **Private Send**；
   - Token 区域仅展示 `Send Amount`，不展示目标币种接收数量；
   - `From` 显示当前钱包地址；`To` 显示用户在 Send 流程填写的目标接收地址，而非链上实际收款地址；`Transaction ID` 显示用户付款链上 TxHash；`Provider` 显示 RocketX。
6. 状态机断言口径：
   - 快链：`Submitted -> Pending -> Done`；
   - 慢链：`Submitted -> Submitting -> Pending -> Done`；
   - 任一路径均需覆盖 `Failed` 终态展示与历史详情一致性。
7. Private Send 属于 Send 语义，不按 Swap 语义验收：历史详情中不把目标币种数量当作主展示资产，不新增「收到币种」主卡片。

### 1inch Fusion 用例生成加速规则（避免重复调试）

1. 1inch Fusion **不支持 from 主币**；支持 `ERC20 -> ERC20` 与 `ERC20 -> Native`。不生成主币→代币、主币→主币场景。
2. 同链按多网络覆盖（Ethereum / Arbitrum / Optimism / BSC / Polygon / Avalanche）。
3. 每条 Fusion 用例必须按 `quote -> quoteResultCtx -> build-tx` 流程，缺 `quoteResultCtx` 直接 failed。
4. 生成前先探测 `/swap/v1/quote` 可用性，仅保留稳定命中 Fusion provider 且可 build 的组合。
5. 默认代币金额使用 `100`，若命中不稳定，先做金额阶梯探测再落库（不要先改断言）。

**EVM 兼容链**（Ethereum、BSC、Polygon、Arbitrum、Optimism、Base、Avalanche、zkSync Era、Linea、Mantle、Scroll、Blast、Sonic 等）：
- Gas 费计算（wei 单位）
- ERC20 代币授权流程
- Native token 无需授权
- **特殊规则**：Ethereum USDT → ETH 需要二次授权

**异构链**（Solana、Tron、TON、SUI、Aptos、Near）：
- **Tron 网络**：
  - TRC20 代币需要授权（类似 EVM 的 ERC20 授权流程）
  - Native token（TRX）不需要授权，可以直接 Swap
  - 授权方式：Approve+Swap 捆绑提交 或 Approve、Swap 单独提交
- **其他异构链**（Solana、TON、SUI、Aptos、Near）：
  - **不需要授权**：所有代币（包括主币和代币）都可以直接 Swap
- 交易费用计算单位不同（lamports、sun、octas、MIST、yoctoNEAR 等）
- 各网络使用各自的代币标准（SPL、TRC20、Move 等）
- **特殊规则**：
  - Solana 可能涉及多签交易（跨链 CCTP 路径）
  - Tron TRC20 代币需要授权，Native token（TRX）不需要授权

**UTXO 链**（Bitcoin、Litecoin、Bitcoin Cash、Dogecoin）：
- **不需要授权**：UTXO 模型不涉及代币授权
- 使用 ThorChain/MAYAChain/Chainflip 等渠道
- 交易费用计算方式不同（基于交易大小和费率）
- 地址格式验证（Legacy、SegWit、Native SegWit 等）

### 测试用例组织建议

**按渠道分组**：
- 每个渠道的测试用例独立组织
- 同链和跨链测试分开
- 不同网络的测试用例明确标注网络名称

**按网络分组**：
- 同一网络的不同渠道测试用例可以合并
- 突出显示该网络支持的渠道列表
- 验证渠道选择逻辑

**优先级建议**：
- **P0**：主流网络（Ethereum、BSC、Polygon、Arbitrum）的主流渠道（0x、1inch、OKX）
- **P1**：其他 EVM 兼容链、Solana、跨链场景
- **P2**：特殊链（BTC、UTXO 链、其他非 EVM 链）

---

## 🔄 Swap 模块通用规则

### 金额覆盖测试规则（强制）

所有 Swap 测试用例必须覆盖以下金额场景：

**最小值规则**：
- 定义为代币的最小精度值（根据代币 decimals 确定）
- 例如：USDC（6 decimals）最小值为 0.000001，ETH（18 decimals）最小值为 0.000000000000000001
- 需要验证最小精度值的询价、构建订单、执行流程是否正常

**中间值规则**：
- 选择余额的中间值进行测试（如余额的 50%）
- 确保覆盖正常兑换场景
- 需要验证中间值金额的询价准确性、手续费计算正确性

**最大值规则**：
- 定义为钱包里的当前余额
- 需要验证最大金额兑换时的余额检查、Max 按钮功能

**金额测试覆盖要求**：
- 每个兑换场景（主币→代币、代币→主币、代币→代币）至少覆盖最小值、中间值、最大值
- 最小值测试已覆盖代币精度边界值（如 6 decimals 代币测试 0.000001、18 decimals 代币测试 0.000000000000000001）
- 不同 decimals 的代币需要分别测试精度边界

### 状态机
- 询价→路径→授权(Approve/Permit)→Swap→Pending→Success/Fail→回滚提示

### 资金流
- 授权额度变化、兑换前后余额对账、手续费/滑点/price impact 展示一致

### 链上不确定性
- 报价过期重算、同块抢跑导致滑点失败、nonce 冲突

### 代币兼容
- 通缩/税费币、rebase、黑名单 token、非标准 decimals

### 风控
- 高滑点/高 price impact 强提醒；目标合约风险提示；最小收到保护
- **价值下跌提示（Value Drop Warning）**：
  - 触发条件：高 value drop 报警
  - 视觉：红色 critical 卡片、红色百分比标题、destructive 样式 Continue 按钮
  - 交互：确认复选框 + 5 秒倒计时，倒计时结束后 Continue 可点击
  - 重置：取消/重新勾选复选框时倒计时重置为 5 秒
  - 埋点：`valueDropTipContinue` / `valueDropTipCancel`，含 from/to token 符号、数量、法币值、链 ID、跌幅百分比、勾选状态
- **代币税检测（Token Tax Detection）**：
  - 数据源：GoPlus + OKX；OKX 为第二层检测源
  - 命中规则：任一数据源、任一方向税率大于 0 即命中
  - 合并规则：GoPlus 与 OKX 同时返回税率时取较大值作为生效税率
  - 双向税：from / to 两侧均有税时，以后端返回的生效税率字段作为前端展示和默认滑点叠加依据，前端不自行推导额外规则
  - 降级规则：OKX 失败 / 超时 / 无数据时静默降级为 GoPlus 单源，不阻塞报价流程，不额外报错
  - 展示规则：命中代币税时在交易页底部展示税率提示；未命中不展示新增提示
  - 滑点规则：用户未手动修改时，当前生效滑点 = 原滑点设置 + 生效税率；用户手动修改后以用户值为准，不再被自动覆盖
  - 重算规则：切换代币、切换交易方向后重新检测并重算默认滑点
  - 边界说明：高税率上限与二次确认策略待定义；条件触发型代币税仍可能漏检

### 数据源
- 路由/报价来源标识、刷新倒计时、WS/轮询策略一致

### 可观测
- 失败类型可分类（授权失败/余额不足/滑点/路由不可达/链错误）

### 自定义接收地址（Custom Recipient Address）

Swap 支持将兑换后的代币发送到**自定义接收地址**（而非当前账户地址）。

| 规则项 | 规则描述 |
|-------|---------|
| 入口 | Swap 页面提供"自定义接收地址"开关；开启后进入地址输入流程 |
| **Web 端 Tab 全屏蔽** | **仅 Web 端** Swap 自定义接收地址：**屏蔽「最近」「账户」「地址簿」三个 Tab**，仅保留**手动输入**入口；用户必须手动粘贴/输入地址 |
| 其他端 | Desktop / Extension / iOS / Android 的 Swap 自定义接收地址不在本规则约束范围内，按各端发送流程默认规则执行 |
| 选择方式一致性 | 对于支持选择器的端，用户通过**粘贴 / 扫码 / 账户选择器 / 地址簿**等任一方式选择目标地址后，**地址输入框最终值必须与源地址完全一致**；切换选择方式时，以最后一次选择结果为准，不残留上一次地址片段、标签或格式化脏数据 |
| 联想行为 | Tab 屏蔽只屏蔽**选择入口**（不允许用户从最近/账户/地址簿列表选择），**不屏蔽联想提示**：用户在输入框粘贴/输入地址时，若该地址属于「我的账户」「最近转账」或「地址簿」，仍需展示对应联想标签及名称（等同于常规 Send 的跨 Tab 联想行为）。 |
| 地址校验 | 本规则仅限制数据来源入口，**不影响**地址格式校验、黑名单校验等有效性逻辑 |
| 提交一致性 | 用户进入确认页并提交交易后，确认页、订单构建参数、历史详情中的 `Received address` 必须与用户本次最终确认的目标地址一致 |
| 关联规则 | 账户展示范围见 `wallet-rules.md` §5.05；地址联想规则见 §5.05.1 |

### 账户类型测试规则（强制）

所有 Swap 测试用例必须覆盖以下账户类型：

**支持的账户类型**：
- **软件钱包（HD Wallet）**：支持 Swap 功能，可正常进行询价、授权、兑换
- **硬件钱包（HW Wallet）**：支持 Swap 功能，需要硬件设备确认交易
- **私钥账户（Private Key Account）**：支持 Swap 功能，但需验证账户系列限制
- **外部账户（External Account/Third Party）**：支持 Swap 功能，但需验证账户系列限制

**不支持的账户类型**：
- **观察账户（Watched Only Account）**：不支持 Swap 功能，应提示"观察账户不支持 Swap"或类似错误信息

**账户系列限制**：
- **私钥账户/外部账户**：只能使用同系列账户进行 Swap
- 选择非同系列账户时，应提示"不支持"或"账户类型不匹配"等错误信息
- 例如：EVM 系列账户（Ethereum、BSC、Polygon 等）之间可以互换，但不能与非 EVM 账户（如 Solana、BTC）互换

**账户类型测试覆盖要求**：
- 每个兑换场景（主币→代币、代币→主币、代币→代币）至少覆盖软件钱包和硬件钱包
- 观察账户需要验证不支持提示
- 私钥账户/外部账户需要验证同系列和不同系列的账户选择场景

---

## 📝 规则维护指南

### 如何更新规则

1. **发现规则变更**：
   - 在测试过程中发现规则与文档不一致
   - 收到产品/开发通知规则变更

2. **更新文档**：
   - 直接修改对应测试路线的规则部分
   - 在变更记录中记录更新时间和原因

3. **通知相关方**：
   - 如规则变更影响现有测试用例，需同步更新用例

---

## 📅 变更记录

### 2026-07-16
- 新增风控章节：代币税检测（Token Tax Detection）规则，覆盖 GoPlus + OKX 双源命中、双源税率取大、from / to 双向税、生效滑点自动叠加、用户手动值优先、切代币 / 切方向重算；新增配套需求 `docs/qa/requirements/Swap-代币税检测.md` 与用例 `docs/qa/testcases/cases/swap/2026-07-16_Swap-代币税检测测试.md`
- 补充历史记录规则：细化 Transaction 详情页字段（Status detail、Pay address、Received address、Transaction hash、Network Fee、Provider、Rate、Provider Fee、复制/跳转/清空/Support），并在渠道与 provider 映射表补齐 `Swft -> SwapSwft`；新增配套用例 `docs/qa/testcases/cases/swap/2026-07-16_Swap-历史记录测试.md`
- 补充自定义接收地址规则：新增“选择方式一致性”“提交一致性”口径，要求粘贴 / 扫码 / 账户选择器 / 地址簿等任一方式回填后，地址输入框、确认页与历史详情中的 `Received address` 保持一致；新增配套用例 `docs/qa/testcases/cases/swap/2026-07-16_Swap-自定义接收地址测试.md`
- 新增 Limit 规则与手工用例：Trade 增加 `Limit` 分类，当前固定渠道为 `Cow Limit`，仅支持 `Ethereum / Base / Arbitrum` 同链限价订单；补充 `from` 主币不支持、ERC20 授权、`Limit price`、`Order expires in`、`Partial fill`、订单状态流转与历史追踪要求；新增用例 `docs/qa/testcases/cases/swap/2026-07-16_Swap-Limit测试.md`
- 新增移动端 Pro Mode 规则与手工用例：Pro Mode 在移动端整合 `Market + Limit` 两种订单类型；Market 主流程在 Pro Mode 用例内覆盖，Limit 详细场景直接引用 `docs/qa/testcases/cases/swap/2026-07-16_Swap-Limit测试.md`，不重复展开；补充 token metadata、Global search、K 线跳转、钱包入口、持仓 / Open order / Order history、业务告警等口径；新增用例 `docs/qa/testcases/cases/swap/2026-07-16_Swap-Pro-Mode测试.md`
- 新增 SwapKit 渠道规则与手工用例：统一跨链支持网络为 Ethereum、Avalanche、Base、BSC、BTC、LTC、BCH、DOGE、Arbitrum、Solana；补充 `SwapKit` 不依赖 `quoteResultCtx`、UTXO 网络无需授权、BTC 新鲜接收地址与找零地址专项校验；新增用例 `docs/qa/testcases/cases/swap/2026-07-16_Swap-SwapKit渠道跨链测试.md`
- 更新 Changelly 渠道规则与手工用例：同链支持网络调整为 Tron、Solana、TON；跨链支持网络调整为 BTC、Ethereum、Polygon、Avalanche、Fantom、Arbitrum、Optimism、Solana、Near、ETC、DOGE、LTC、BCH、Ripple、zkSync Era、CFX、Base、Kaspa；补充 Tron 地址口径、TON `ton--mainnet`、跨链四类方向覆盖要求；新增用例 `docs/qa/testcases/cases/swap/2026-07-16_Swap-Changelly渠道同链测试.md` 与 `docs/qa/testcases/cases/swap/2026-07-16_Swap-Changelly渠道跨链测试.md`
- 更新 ChangeHero 渠道规则与手工用例：同链支持网络明确为 Tron、Solana、TON；跨链支持网络更新为 Ethereum、BSC、Polygon、Avalanche、Fantom、Arbitrum、Optimism、Solana、Near、ETC、DOGE、LTC、BCH、Ripple、zkSync Era、CFX、Base、Kaspa、Tron、TON、SUI、Aptos、BTC；补充四类跨链方向、TON `ton--mainnet`、SUI / Aptos / Ripple / Kaspa 等非 EVM 网络回归重点；新增用例 `docs/qa/testcases/cases/swap/2026-07-16_Swap-ChangeHero渠道同链测试.md` 与 `docs/qa/testcases/cases/swap/2026-07-16_Swap-ChangeHero渠道跨链测试.md`

### 2026-07-09
- 新增 Stocks 规则：Trade 下新增 `Stocks` 分类；补充小屏横向滑动分类栏、BNB Chain 维护列表、固定渠道 `1inch Fusion`、Buy / Sell 稳定币默认逻辑、REQ 无滑点设置、股票持仓过滤、维护列表搜索范围、后端交易控制、休市分支、Desktop TradingView + Market Data 口径；新增配套需求 `docs/qa/requirements/Swap-Stocks.md`。

### 2026-05-15
- 新增 HiFi 渠道规则：同链支持 Ethereum、BSC、Polygon、Arbitrum、Base、Solana、Tron；跨链支持 BTC、Ethereum、BSC、Polygon、Arbitrum、Base、Solana、Tron；provider 为 `SwapHifiSwap`；支持 BTC 网络的渠道必须覆盖 BTC 新鲜地址与找零地址专项；HiFiSwap 按中心化换汇服务渠道处理，EVM / Tron 网络不覆盖授权逻辑。

### 2026-06-03
- 新增 Swft 渠道规则：同链支持 `Tron、SUI、TON`，跨链支持 `BTC、Ethereum、BSC、Polygon、Avalanche、Arbitrum、Optimism、Base、SOL、Tron、Near、DOGE、LTC、BCH、APT、TON、SUI`；provider 为 `SwapSwft`；当前按普通 `/swap/v1/quote` + `quoteResultCtx` + `build.code=0` 生成 Apifox 成功集，Aptos 暂不纳入成功路由。
- 补充 Swft build 限频特例：客户端成功 curl 已验证 body 结构可用，但 Apifox 批量连续下单时 `build-tx` 容易返回 `code=20344 / 操作频繁，请稍后再试`；集合断言应将其视为可接受的服务端限频兜底，而不是参数错误。
- 新增 LiFi 渠道规则：provider 为 `SwapLifi`；同链支持网络更新为 Ethereum、BSC、Polygon、Arbitrum、Avalanche、zkSync、Sonic、Scroll、Mantle、Blast、Base、Optimism、Fantom、Solana、HyperEVM、Robinhood，跨链支持网络更新为 Ethereum、BSC、Polygon、Arbitrum、Avalanche、zkSync、Sonic、Scroll、Mantle、Blast、Base、Optimism、Fantom、Solana、HyperEVM；构建强制依赖 `quoteResultCtx`。
- 新增 LiFi Apifox 金额基线：稳定币统一 `100`，主币按 `2026-06-03` 市价近似折算 `~100 USD`，并同步到 LiFi collection 与配套文档。
- 补充 LiFi EVM 地址口径：Arbitrum / Optimism / Mantle / HyperEVM 的稳定币地址在 Apifox 集合中统一改为小写；否则 LiFi 可能返回 `Provider error` 且无 `quoteResultCtx`。
- 升级 LiFi collection 到客户端口径：quote 统一改走 `/swap/v1/quote/events`，header / locale / theme / build-number / jsbundle 对齐桌面端 `6.4.0 / 2026060378 / zh-cn / light / 13236892`。
- 新增 Near 渠道 Apifox 规则：provider 为 `SwapNear`；仅覆盖跨链网络 `XRP、Tron、Ethereum、AVAX、Base、BSC、BTC、DOGE、Near、Solana`；quote 走普通 `/swap/v1/quote`，build 需携带 `quoteResultCtx`，并允许 `code=0 / 20033 / 20699` 作为业务层可达结果。
- 新增 Changelly 渠道规则：按用户确认的“与 ChangeHero 相同网络矩阵”生成；当前 collection 直接镜像 ChangeHero 成功集，仅将 provider / 断言切换为 `SwapChangelly`，暂不额外声称已逐条实探。
- 补充 Changelly Tron 特例：`TRX -> USDT`、`USDT -> TRX`、`DOGE -> TRX` 的 `build` 对 Tron 地址敏感；旧样例 `TPJkcqRHFfuE2xfgVzs6AA6tbJowz9pmH1` 会返回 `code=20010 / 不支持该交易对`，已切换为成功样例 `TTZMu9v3cxs3dGhoUABBmE672MN8hsNfb8`。
- 新增 ChangeHero 渠道规则：provider 为 `SwapChangeHero`；同链成功集覆盖 `Tron / Solana / TON`，跨链成功集覆盖 `Ethereum、BSC、Polygon、Avalanche、Arbitrum、Optimism、Solana、Near、DOGE、LTC、BCH、Base、Tron、TON、SUI、BTC`；quote 走普通 `/swap/v1/quote`，build 依赖 `quoteResultCtx` 且当前成功集可直接断言 `code=0`。
- 补充 ChangeHero 特例：TON networkId 使用 `ton--mainnet`；Tron 同链当前只保留 `TRX <-> USDT`；Aptos 虽在声明支持清单内，但当前 `aptos--1` 路由未命中 `SwapChangeHero`，暂不写入成功集。

### 2026-06-04
- 新增 OKX 同链 Apifox 规则：provider 为 `SwapOKX`；支持网络更新为 `Ethereum、Arbitrum、Optimism、BSC、Polygon、Avalanche、Fantom、zkSync Era、Base、Solana、TON、SUI、Sonic、Scroll、Blast、Linea、X Layer`，并明确当前成功集只维护同链路由。
- 确认 OKX build 不依赖 `quoteResultCtx`：同一批 `Ethereum / Solana / TON` 路由在带与不带 `quoteResultCtx` 时都可返回 `code=0`，因此集合 body 保持无 `quoteResultCtx` 的简洁口径。
- 补充 OKX 特殊链路：`Blast` 同链基线使用 `USDB`，`X Layer` 主币为 `OKB` 且稳定币基线为 `0x74b7f16337b8972027f6196a17a631ac6de26d22`，`Fantom` 的稳定币对使用 `USDC -> fUSDT`。
- 新增 0x 同链 Apifox 规则：`Swap0x` 走普通 `/swap/v1/quote` + 无 `quoteResultCtx` build；当前 7 条同链网络 `Ethereum / Arbitrum / Optimism / BSC / Polygon / Avalanche / Base` 在 `主币 -> USDC / USDC -> 主币 / USDC -> USDT` 三类路由上均可直接 `build.code=0`。
- 新增 1inch 同链 Apifox 规则：`Swap1inch` 走普通 `/swap/v1/quote` + 无 `quoteResultCtx` build；用户支持清单已扩到 `Fantom`，但本轮实探仅 `Ethereum / Arbitrum / Optimism / BSC / Polygon / Avalanche / zkSync Era / Base` 八条网络可直接 `build.code=0`，`Fantom` 暂未命中 provider。
- 补充 OKX SUI 业务层兜底：`SUI -> USDC`、`USDC -> SUI`、`USDC -> USDT` 当前 quote 都能命中 `SwapOKX`，但 build 会稳定返回 `20505 / 流动性不足`；Apifox 成功集需把该返回视为已进入业务层的可接受结果。
- 新增 LiquidMesh 同链 Apifox 规则：provider 为 `SwapLiquidMesh`；声明支持网络为 `Ethereum、BSC、Base、Solana、Tron、Sonic、SUI`；quote 走普通 `/swap/v1/quote`，build 强依赖 `quoteResultCtx.liquidMeshQuoteResultCtx`。
- 补充 LiquidMesh 成功集现状：当前已验证可直接 `build.code=0` 的同链路由集中在 `Ethereum / BSC / Base / Solana / Sonic`；`Tron / SUI` 在常规参数下暂未命中 provider，不写入成功集。
- 补充 LiquidMesh Solana 特例：`SOL -> USDC` 在 `0.2 SOL` 金额上可直接 build 成功；`USDC -> SOL / USDC -> USDT` 虽能命中 provider 并返回 `quoteResultCtx`，但 build 当前返回 `20033 / 报价不可用，请刷新后重试`，因此本轮成功集优先保留前者。

### 2026-05-27
- 修正 Swap API 渠道生成规则：Houdini provider 为 `SwapHoudi`，HiFi provider 为 `SwapHifiSwap`；Houdini / RocketX 询价请求需传 `incognito=true`；API collection 变量表必须按当前渠道支持网络从 `swap-network-features.md` 生成，不允许继承其他渠道变量表。
- 补充 Houdini API 特例：询价使用 `/swap/v1/quote/events` SSE；SUI 主币路径使用 `sui--mainnet` + `0x2::sui::SUI`，普通 `/swap/v1/quote` 或 `sui--0 + 空 native token` 会导致 Solana/SUI 等路径 `providers=[]`。
- 补充 Tron API 网络 ID 口径：Swap API 使用 `tron--0x2b6653dc`，旧值 `tron--0` 会导致 Houdini Tron 源链询价无法命中 provider。
- 补充 Apifox 金额规则：生成 Swap Apifox 用例前必须先确认渠道是否有最低金额限制；RocketX / HiFi 按 Houdini 最低金额口径调整，HiFi BTC 源币金额单独使用 `0.1` BTC。
- 补充 RocketX API 特例：询价使用 `/swap/v1/quote/events` SSE；SUI 主币路径使用 `sui--mainnet` + `0x2::sui::SUI`；硬件钱包 quote 请求需带 `walletDeviceType=pro` 与 `X-Onekey-Wallet-Type=hw`。
- 补充 RocketX 路由级特例：`SUI.USDC → Tron.TRX` 询价当前需使用 `slippagePercentage=1`；生成或维护该用例时，build 也要跟随同一滑点，避免沿用默认 `0.5`。
- 补充 RocketX 选路规则：不要把 Houdini 的主币跨链配对矩阵直接照搬到 RocketX；具体配对要以 RocketX 自己的手工用例、成功 curl 或最新验证结果为准，`Tron → BTC` 等已被 Houdini 淘汰的旧配对不得继续继承。
- 修正 RocketX Apifox 成功集：当前先参考 Houdini 当前矩阵维护跨链配对，`代币<>主币` 的 Tron 场景使用 `Tron.USDT → Ethereum.ETH`，不再保留旧的 `Tron.USDT → BTC.BTC`。

### 2026-05-28
- 修正 RocketX Apifox 生成口径：当前 `Swap-RocketX-全网络全类型-Apifox-TestCases.json` 必须从 Houdini 集合参数级克隆，仅替换展示名和 provider 为 `SwapRocketX`；不得额外保留 RocketX 专属硬件钱包参数、`walletType=hw` 或单路由滑点特例，除非用户重新给出明确成功口径。
- 新增 Swap K 线入口规则：覆盖入口启用/禁用、默认展示代币、稳定币判定、`1H -> 1D -> 1W` fallback、Market 数据复用、仅展示主图与 Volume、空态/失败/重试/loading 状态。

### 2026-05-22
- 新增 Private Send 规则：入口位于 Send 流程，默认 Public，仅在「白名单 ∩ RocketX 支持范围」命中当前网络+代币且总开关开启时显示切换；补充金额输入页字段、帮助中心链接、History Details 字段语义与慢链 `Submitting` 中间态口径；新增配套用例 `2026-05-22_Swap-Private-Send测试.md`。

### 2026-04-20
- 恢复变更记录 `### 2026-04-17`（自定义接收地址 + 联想规则），与正文 § 自定义接收地址 章节对应
- 新增 RocketX 渠道接入骨架：`provider = SwapRocketX`；列入 **需要 quoteResultCtx** 清单（同链 + 跨链均需要先询价再构建）；网络支持采用已确认清单；新增「RocketX 用例生成加速规则」小节，规定 quote→build 闭环、断言口径、失败日志字段、金额基线等；配套用例 `2026-04-20_Swap-RocketX渠道同链测试.md` 与 `2026-04-20_Swap-RocketX渠道跨链测试.md`

### 2026-04-01
- 新增风控章节：价值下跌提示（Value Drop Warning）规则 — 视觉、倒计时、重置、埋点

### 2026-04-17
- 新增「自定义接收地址」规则节：**Web 端** Swap 自定义接收地址屏蔽「最近」「账户」「地址簿」三个 Tab，仅保留手动输入入口；其他端不在本规则约束范围；关联 `wallet-rules.md` §5.05
- 联想行为规则澄清：Tab 屏蔽**仅屏蔽选择入口**，**不屏蔽联想提示**；粘贴属于「我的账户/最近/地址簿」的地址时联想标签仍正常展示

### 2026-01-21
- 清理接口、API、E2E、字段验证相关内容，仅保留功能测试规则
- 移除所有接口路径、参数验证、字段验证等 API 测试相关内容
- 简化规则描述，专注于用户交互和业务流程验证

### 2026-01-06
- 初始版本
- 添加 Swap 模块核心测试路线：报价测试、构建订单测试、手续费测试、历史记录测试
- 添加多链测试覆盖规则：各渠道支持网络矩阵、多链测试覆盖原则、测试用例组织建议
- 添加金额覆盖测试规则：最小值、中间值、最大值、代币精度值测试要求
- 添加账户类型测试规则：软件钱包、硬件钱包、私钥账户、外部账户、观察账户测试要求
- 更新手续费测试规则：不同渠道有不同的返佣比例和收款地址（0x 渠道：0.25%，地址：0x0994e6337a6c69c3ef4c2e2de885c22c4f0cf5b4）
- 明确同链和跨链兑换类型覆盖要求：
  - **同链渠道测试场景**：主币到代币、代币到主币、代币到代币（共 3 种，必须全部覆盖）
  - **跨链渠道测试场景**：主币到主币、主币到代币、代币到主币、代币到代币（共 4 种，必须全部覆盖）
- 添加授权流程测试规则：Approve+Swap 捆绑提交和 Approve、Swap 单独提交两种方式必须全部覆盖
- 更新 Ethereum USDT 二次授权规则：明确仅 USDT → ETH 需要二次授权，USDT → 其他代币不需要二次授权
- 移除历史记录筛选功能测试规则：当前版本不支持筛选功能，已从测试用例和规则文档中移除
- 添加 1inch 渠道返佣信息：返佣比例为 0.25%，返佣地址为 0xeb373e57f59aaaf4e2957bc9920a20255b9aa694
