# Perps 模块测试规则文档

> 本文档记录 Perps 模块的核心测试规则，包括限价单最优价（BBO）规则、收藏功能规则等。
> 生成 Perps 模块测试用例时，必须参考本文档中的规则。

---

## 📋 核心功能规则

### 1. 限价单最优价（BBO）规则

#### 1.1 BBO 价格选取
- Hyperliquid 的 BBO 订阅只返回买1/卖1价
- 不支持买5/卖5，因此 UI 下拉框仅 2 个选项

#### 1.2 展示（实时计算）
- 启用 BBO 时：订单确认页、多空按钮、强平、保证金信息等，使用选项对应类型取 BBO 数据实时计算

#### 1.3 提交（使用最新值）
- 下单提交时以"最新 BBO 价格"提交，因此实际下单价格可能与展示时有偏差（必须纳入可验证的偏差容忍/提示/记录）

#### 1.4 更新机制
- BBO 更新节流：仅买1/卖1价格更新时触发前端更新；size / n 等字段更新不触发 UI 更新

#### 1.5 不可用兜底
- 启用 BBO 但订阅/数据异常时，两个下单按钮显示 `bbo_unavailable`（需要 i18n）

---

### 2. 收藏功能规则

#### 2.1 功能概述
- **模块**：Perps（合约交易）
- **功能名称**：代币收藏/自选功能
- **支持端**：iOS / Android / Desktop / Extension（全端支持）

#### 2.2 默认推荐代币收藏

**推荐列表规则**：
- 默认推荐 **6 个代币**：BTCUSDC、ETHUSDC、BNBUSDC、SOLUSDC、HYPEUSDC、XRPUSDC
- 推荐列表以**两列网格布局**展示
- 每个代币右侧显示**复选框**，默认**全部勾选**
- 推荐列表底部显示「添加到自选」按钮

**添加规则**：
- 用户可勾选/取消勾选部分代币
- 点击「添加到自选」按钮后，仅**已勾选的代币**添加到自选列表
- 未勾选的代币不添加到自选列表
- 已收藏的代币在推荐列表中仍可勾选（用于重新添加，如之前取消收藏）
- 重复添加已收藏的代币不会产生重复项

**状态管理**：
- 切换其他分类标签（如「PERPS」、「HIP3」）后，推荐列表的勾选状态保持不变
- 刷新页面后，推荐列表恢复默认状态（6 个代币，全部勾选）

#### 2.3 搜索列表收藏/取消收藏

**搜索功能**：
- 支持通过「搜索资产」输入框搜索代币
- 搜索结果列表显示匹配的代币
- 每个代币右侧显示收藏按钮（星形图标）

**收藏按钮状态**：
- **未收藏状态**：空星形图标（☆）
- **已收藏状态**：实心星形图标（★）
- 点击收藏按钮可切换收藏/取消收藏状态

**操作规则**：
- 在搜索结果中点击收藏按钮，代币立即添加到自选列表
- 在搜索结果中点击已收藏代币的收藏按钮，代币立即从自选列表移除
- 支持快速连续点击，需实现防抖处理（仅执行最后一次操作）

**主币收藏**：
- 支持收藏主币（如 BTC、ETH、SOL 等）
- 主币收藏后，在分类列表中显示已收藏标识

#### 2.4 自选列表展示与管理

**列表展示**：
- 点击「自选」标签进入自选列表
- 自选列表显示所有已收藏的代币
- 列表按收藏时间或默认顺序排列
- 每个代币显示完整信息（名称、价格、涨跌幅等）
- 每个代币右侧显示已收藏标识（实心星形图标）

**取消收藏**：
- 在自选列表中点击取消收藏按钮，代币从列表移除
- 取消收藏后，该代币在其他分类列表中显示未收藏状态

**空状态处理**：
- 自选列表为空时，显示空状态文案（如"暂无收藏"或"添加自选代币"）
- 显示引导添加收藏的提示或按钮

**大量数据处理**：
- 自选列表支持滚动加载（如收藏代币数量 > 50）
- 滚动流畅无卡顿（FPS ≥ 30）

#### 2.5 行情页面顶部展示与切换显示模式

**顶部列表展示**：
- 行情页面（交易页面）顶部显示已收藏的代币列表
- 列表横向排列，显示代币图标、名称、价格变化
- 列表支持横向滚动（如收藏代币数量 > 6）
- 点击代币可跳转到该代币的交易视图

**显示模式切换**：
- 页面顶部左侧显示两个切换按钮：「$」（涨跌幅模式）和「%」（百分比模式）
- **默认模式**：百分比模式（「%」激活），显示百分比变化（如"-2.80%"）
- **涨跌幅模式**（「$」激活）：显示绝对数值变化（如"-0.0584"）
- 点击「$」或「%」按钮可切换显示模式
- 显示模式持久化保存（localStorage 或用户偏好），刷新页面后保持

**实时更新**：
- 添加新代币后，行情页面顶部立即显示新代币（延迟 ≤ 1 秒）
- 取消收藏后，行情页面顶部立即移除该代币（延迟 ≤ 1 秒）
- 价格变化实时更新（百分比或涨跌幅，取决于当前模式）

**切换按钮状态**：
- 激活状态的按钮高亮或选中样式
- 未激活状态的按钮正常样式
- 支持快速连续点击，需实现防抖处理（仅执行最后一次操作）

**顶部收藏条拖动排序**（桌面端 / 插件 / Web 大屏）：
- 顶部收藏条支持拖动代币改变顺序
- 排序结果持久化保存，刷新页面后保持
- 排序与自选列表、底部轮播（当选择「收藏」时）一致

#### 2.6 数据一致性与状态同步

**多入口状态一致性**：
- 推荐列表、自选列表、搜索列表、分类列表、行情页顶部，所有入口的收藏状态必须完全一致
- 在任意入口收藏/取消收藏后，其他入口的状态同步更新（延迟 ≤ 1 秒）

**跨标签页同步**：
- 多标签页打开同一应用时，收藏状态跨标签页同步（延迟 ≤ 5 秒）

**API 请求规则**：
- 收藏 API 请求包含正确的代币标识（symbol/pairId）
- 响应状态码=200，返回收藏成功标识
- 响应数据包含收藏时间戳
- 请求幂等性：重复收藏返回相同结果

#### 2.7 网络异常与容错

**断网处理**：
- 点击收藏按钮后立即断开网络，显示网络错误提示
- 收藏状态回滚到操作前状态
- 提供重试按钮或自动重试机制

**API 错误处理**：
- API 返回 500 错误时，显示错误提示（如"服务异常，请稍后重试"）
- 收藏状态不改变
- 提供重试入口

**弱网环境**：
- 弱网环境下，显示加载状态（按钮显示 loading 或禁用）
- 操作完成后状态正确更新
- 无重复请求

#### 2.8 搜索功能规则

- 模糊匹配 Ticker/别名，多语言（中/英/日等）及规则由服务端配置；中文搜索与界面语言无关（非中文环境也可用中文关键词搜到）。
- 空输入→默认列表或空状态；无结果→空状态/「未找到」；超长、特殊字符按服务端或前端规则处理。

#### 2.9 Token 选择器版块规则

- 版块列表由服务端配置（如贵金属、股票、Pre-IPO），以标签/分组展示；点击版块筛选该版块下代币。未配置或下架的版块不展示。

#### 2.9.1 后台配置规则（分类与多语言标签）

- **分类 Tab**：后台可自定义新增、编辑、排序、下架分类 tab；C 端展示与配置一致。
- **代币归属**：后台可配置代币归属哪个分类；C 端某分类下仅展示该分类下已配置的代币。
- **多语言标签**：后台可自定义配置代币在各语言下的展示标签（中/英/日等）；C 端按界面语言展示对应标签，搜索可命中各语言。

#### 2.10 中文标签规则（仅中文环境）

- 列表项、行情顶等展示**中文标签**（代币中文 Ticker/名称，若有）。**仅当界面语言为中文时显示**；非中文环境不显示；无中文数据不显示。

#### 2.11 边界与异常场景（收藏等）

**收藏数量上限**：
- 收藏数量达到上限（如 100）时，显示上限提示（如"收藏数量已达上限"）
- 收藏操作不执行
- 已收藏的代币仍可正常取消收藏

**快速切换分类**：
- 快速切换多个分类时，收藏状态在所有分类中正确显示
- 无状态丢失或错乱
- 切换流畅无卡顿

**窗口大小变化**：
- 浏览器窗口大小变化时，推荐列表、自选列表、行情页顶部布局自适应
- 所有元素不重叠或溢出

#### 2.12 页面底部连接状态与轮播（桌面端 / 插件 / Web 大屏）

**适用端**：仅桌面端、插件、Web 大屏；移动端可不展示或逻辑可差异。

**连接状态**：
- 显示当前连接状态：连接正常 / 连接失败
- 连接正常：绿色指示（如绿点）+ 文案「连接正常」或等价
- 连接失败：红色指示 + 文案「连接失败」或等价
- 速率显示：与状态同屏展示（如「连接正常 279ms」）

**刷新**：
- 底部有刷新按钮，点击触发接口/数据刷新

**轮播设置**（设置按钮/齿轮入口）：
- **不展示**：不展示底部代币轮播
- **默认**（如 Popular）：展示默认/热门代币轮播，显示代币价格与涨跌幅。**根据当前 `tradingMode` 联动**：合约模式下展示**合约热门代币**；现货模式下展示**现货热门交易对**；模式切换时轮播内容自动切换
- **收藏**（Favorites）：展示收藏代币轮播，与顶部收藏列表及排序完全一致

**轮播点击切换**：
- 底部轮播中点击某一代币，切换逻辑与顶部收藏条一致：当前选中的代币变为该代币，图表与数据（K 线、盘口、仓位等）切换为对应代币

**底部链接**：
- **合约社区**：点击跳转 TG 频道
- **更多**：下拉含「帮助」「查看教程」「用户协议」「隐私政策」等，点击跳转对应文章/页面

---

### 3. TradingView 图表功能规则

#### 3.1 默认指标规则
- 首次进入图表默认加载**成交量（Volume）指标**
- 成交量指标显示在主图下方子图区域

#### 3.2 指标管理规则
- 添加的指标本地持久化保存（localStorage/IndexedDB）
- 刷新页面、关闭浏览器后指标配置仍保留
- 支持指标收藏，收藏状态本地持久化
- 指标参数配置同步保存

#### 3.3 画图工具规则
- 绘制的图形本地持久化保存
- 不同交易对的画图数据相互隔离
- 刷新页面后画图内容仍保留

#### 3.4 K 线时间周期规则
- 预设时间周期：1分钟、3分钟、5分钟、15分钟、30分钟、1小时、2小时、4小时、8小时、12小时、1天
- 支持自定义时间周期
- 支持收藏常用时间周期（星形标记）
- 时间周期选择本地持久化

#### 3.5 图表叠加显示规则
- **买卖点**：显示开仓/平仓点位标记
- **持仓线**：显示当前持仓的开仓价格线
- **委托挂单线**：显示未成交限价单价格线
- **爆仓线**：显示强制平仓价格线
- 以上内容通过设置项控制显示/隐藏
- 设置项：
  - 「在图表上显示买卖点」开关
  - 「在图表显示仓位和订单」开关（控制持仓线、挂单线、爆仓线）
- 设置状态本地持久化保存

#### 3.6 视图布局规则
- 支持自定义图表视图布局
- 布局配置本地持久化保存
- 「返回默认布局」恢复图表到默认状态
- 恢复默认布局会清除自定义布局配置
- 提供「重置布局」按钮，点击后 K 线主图与指标子图高度恢复默认比例
- 「重置布局」后指标恢复为默认集合，仅保留成交量（Volume）指标
- 「重置布局」结果本地持久化，刷新后保持默认布局与默认指标

---

## 📋 Perps 模块通用规则

### 状态机
- 开仓→加仓→减仓→平仓→反手；挂单/撤单；TP/SL 生效/失效；切币，默认 USDC 法币

### 资金流
- 保证金/可用余额/占用保证金、资金费率结算扣款、强平后残值

### 风控
- 维持保证金率预警、最大杠杆/最大仓位、爆仓保护、价格保护

### 数据源
- 盘口/成交/仓位 WS 更新节流、防跳动；断连重连一致性；接入的 hyperliquid

### 链上/链下
- 撮合与链上交互混合时的"确认口径"、失败回滚解释

### 可观测
- 关键字段必须可断言（entry/mark/liquidation/margin/fee/funding）

---

## 🧾 独立下单类型（市价/限价止盈止损）

> 本章节定义在 Hyperliquid 语义下，Perps 模块覆盖的 4 种触发订单语义（市价止盈、市价止损、限价止盈、限价止损）。
> UI 将创建入口合并为 2 个触发下单模式：`市价止盈止损` 与 `限价止盈止损`，在每个模式内再切换「止盈/止损」。
> 现有「市价单」「限价单」下单逻辑不变；现有 TP/SL 附单能力保留、语义暂不调整。

### 4.1 订单类型定义

触发语义（4 种）：
- 市价止盈（Take Profit Market）
- 市价止损（Stop Loss Market）
- 限价止盈（Take Profit Limit）
- 限价止损（Stop Loss Limit）

UI 下单模式（2 种入口）：
- `市价止盈止损`：对应市价触发语义（isMarket = true），不依赖 executionPrice。
- `限价止盈止损`：对应限价触发语义（isMarket = false），必须提供 executionPrice。

规则：
- 以上 4 种类型仍为**独立订单语义**，拥有独立的订单记录与撤单能力；仅在 UI 创建入口上合并为 2 个触发下单模式。
- 下单逻辑参考 Hyperliquid，对应「触发型订单」，通过触发价格生成实际执行订单。
- TP/SL 附单：
  - 仍通过开仓单上的「附带 TP/SL」链路下发，由服务端封装成对应触发订单。
  - 当前语义和行为不随本功能调整。

### 4.2 isMarket 与 execution price 规则

当前问题：
- 现有 trigger 下单在服务层写死 `isMarket = true`，本质只覆盖了「市价触发」场景（Take Market / Stop Market），无法表达 limit-trigger。

新增要求：
- 市价止盈 / 市价止损：
  - `isMarket = true`
  - 由系统按市价成交，不需要也不依赖 `executionPrice` 字段。
- 限价止盈 / 限价止损：
  - `isMarket = false`
  - 必须提供 `executionPrice` 字段，表示触发后挂出的限价执行价格。

参数校验：
- 当 `isMarket = true`：
  - 不展示执行价格输入框，或即便传入 `executionPrice` 也由服务端忽略。
- 当 `isMarket = false`：
  - `executionPrice` 必填，必须通过价格区间与精度校验（与普通限价单一致）。

可观测点：
- 触发订单详情中可查看：
  - 触发价格（trigger price）
  - 执行价格（execution price，仅限价类）
  - `isMarket` 标记（可通过 API 或调试信息验证）

### 4.3 触发条件与方向

抽象规则（对标合约常规 TP/SL 逻辑，需与服务端实现对齐）：
- 对多仓：
  - 止盈：标记价 ≥ 触发价 → 触发卖出订单（市价/限价取决于类型）。
  - 止损：标记价 ≤ 触发价 → 触发卖出订单。
- 对空仓：
  - 止盈：标记价 ≤ 触发价 → 触发买入订单。
  - 止损：标记价 ≥ 触发价 → 触发买入订单。

校验重点：
- 不同方向（多/空）下 4 种订单类型的触发条件是否正确。
- 极端行情下，价格跨越触发价时，订单仍按正确方向触发。

### 4.3.1 表单提交校验规则（条件单）

> 以下规则适用于市价止盈止损、限价止盈止损的下单表单，对齐 Hyperliquid 行为。

**方向不限制**：
- Buy / Sell 方向与止盈/止损类型**不互相限制**，用户可自由组合任意方向 + 任意止盈止损类型。
- 触发价格**不受方向约束**，也无偏离 mark price 的范围限制，任何触发价均可提交。
- mark price 对下单方向没有影响，不会导致按钮不可点击或方向错误提示。

**输入框实时限制（inline）**：
- 非法字符、负数、超出精度、数量为 0 → 由输入框实时限制，无法输入非法内容（如非数字字符被拦截、超出精度自动截断）。
- 不是报错提示，是输入层面直接阻止。不影响下单按钮状态。

**点击下单后的校验顺序**：
1. **最小下单金额校验**（优先）：下单金额低于 $10 时，提示「最小下单金额 10」，不创建条件单。
2. **HL 执行价 95% 偏离校验**（仅限价类）：限价止盈止损的执行价偏离现价超过 95% 时报错。此校验需下单金额满足最小要求后才会触发（金额不足时先被最小下单金额校验拦截）。
3. 触发价格本身无偏离限制。

### 4.4 UI 与列表展示

- 下单面板：
  -  在现有下单模式（市价单 / 限价单）旁新增 2 种触发下单模式入口：`市价止盈止损` 与 `限价止盈止损`。
  - 切换触发下单模式时：
    - 表单字段联动（是否展示执行价格、字段校验状态等）。
    - 不影响原有市价单 / 限价单默认行为。
  - 在触发下单模式内，通过「止盈/止损」切换触发语义（市价止盈/市价止损 或 限价止盈/限价止损）。
- 订单列表：
  - 在「触发订单」/「条件单」列表中展示 4 种类型，需有清晰类型文案：
    - 市价止盈 / 市价止损 / 限价止盈 / 限价止损。
  - 列表列包括：类型、方向、触发价、执行价（仅限价）、数量、状态。
- 历史记录：
  - 历史触发记录中可区分触发订单类型，并可查看最终成交均价与状态（全部成交 / 部分成交 / 仅挂单未成交等）。

### 4.5 边界与异常

- 价格极端波动场景：
  - 触发价被瞬间跨越（gap）时，订单仍按 Hyperliquid 语义处理：
    - 市价类：在可成交价位尽快撮合。
    - 限价类：按 `executionPrice` 挂单，可能立即成交也可能仅挂单。
- 参数异常：
  - 触发价或执行价越界、精度不合法时，前端需拦截并给出明确错误提示。
  - 服务端需兜底校验，返回业务错误码。
- 与附单 TP/SL 共存：
  - 同一仓位同时存在附带 TP/SL 与独立 TP/SL 订单时，需要明确处理优先级与冲突行为（由后续规则补充）。
  - 测试需关注「重复触发」与「互相撤销」等边界场景。

---

## 5. 现货交易规则（Spot Trading）

> 关联 PR：[OneKeyHQ/app-monorepo#11183](https://github.com/OneKeyHQ/app-monorepo/pull/11183)
> 关联需求：`docs/qa/requirements/Perps-现货交易.md`

### 5.0 HW 钱包参与点（重要边界）

Hyperliquid 采用 **Agent Wallet** 模式：

- HW 钱包**仅在「启用交易（Approve Agent）」流程中签名授权一次**，由 `docs/qa/testcases/cases/perps/2026-01-04_Hyperliquid-ApproveAgent推荐绑定Checkbox.md` 覆盖
- 后续所有现货 / 永续**下单 / 撤单 / TP/SL / 触发单**均由 Agent 代签，**HW 不参与每笔交易**
- 提币（Withdraw）等链上交互场景仍需 HW 签名，按 Hardware 模块规则单独覆盖

**规则约束（强制）**：
- 生成 Perps / 现货模块用例时，**禁止**为下单 / 撤单 / 修改 TP/SL 等高频交易流程添加 HW 签名屏字段核对类用例
- 仅 Approve Agent / Withdraw 等"链上动作"才需要 HW 用例
- 其他流程的 HW 验证已在 Approve Agent 用例中完成，不重复覆盖

### 5.1 交易模式（tradingMode）

- 全局状态 `tradingModeAtom`：`'perp' | 'spot'`，默认 `perp`
- 现货交易复用永续模块入口（同一页面），通过模式切换 UI 元素（按钮文案、杠杆控件、订单面板列）
- 模式由选中的 token 类型决定：永续 token → perp；现货 token（名称以 `@` 开头或含 `/`）→ spot

### 5.2 Token Selector Spot Tab

- 在 Favorites / Perps 两个固定 Tab 外追加 **Spot Tab**，固定位置
- 列字段：Token（含显示名映射）/ Mark Price / 24h Change% / 24h Volume / **Market Cap**（替代 Open Interest）
- **不显示** Funding Rate 列
- 最小名义成交额过滤：`dayNtlVlm >= SPOT_MIN_VOLUME_STRICT (= 10)`。`dayNtlVlm` 为 24h **名义成交额**（价格 × 数量，非成交数量），单位按报价币种；Hyperliquid spot 绝大多数以 USDC 报价，实际阈值可视为 ≈ $10 USDC。低于该阈值的 token 从列表过滤（含 `ctx` 为空导致 `dayNtlVlm=0` 的 token）
- Spot Meta 兜底：`getSpotMeta()` 返回空时自动 `refreshSpotMeta()` 重新获取
- 加载中显示 Spinner
- 搜索：按 `baseName` / `displayBase` / `pairDisplay` 不区分大小写模糊匹配

### 5.3 Token 显示名映射

| 内部名 | 展示名 | 内部名 | 展示名 |
|-------|--------|-------|--------|
| UBTC | BTC | LINK0 | LINK |
| UETH | ETH | AAVE0 | AAVE |
| USOL | SOL | AVAX0 | AVAX |
| UFART | FARTCOIN | BNB0 | BNB |
| UBONK | BONK | CFX0 | CFX |
| UPUMP | PUMP | PEPE0 | PEPE |
| UENA | ENA | TRX0 | TRX |
| UXPL | XPL | USDT0 | USDT |
| UZEC | ZEC | XAUT0 | XAUT |
| UMON | MON | HPENGU | PENGU |
| UUUSPX | SPX | HPEPE | PEPE |
| UDOGE | DOGE | FXRP | XRP |
| UMOG | MOG | XMR1 | XMR |
| UWLD | WLD | HBNB | BNB |
| UMEGA | MEGA | HSEI | SEI |
| UVIRT | VIRTUAL | USPYX | SPYX |
| UDZ | DZ | | |

- Pair 显示格式：`<displayBase>/<quoteName>`（例：BTC/USDC）
- 未映射的 token 使用原始名称

### 5.4 现货下单

#### 订单类型
- **市价单**（`orderType='market'`）：底层用 `limit + tif='Ioc'`，价格 = `markPrice × (1 ± slippage)`（Buy 加、Sell 减）
- **限价单**（`orderType='limit'`）：底层用 `limit + tif='Gtc'`，需填 `limitPx`

#### 方向与文案
- 现货模式下 TradeSideToggle 按钮文案切换：Long → **Buy**、Short → **Sell**
- `isBuy: true` 对应 `side='long'`；`isBuy: false` 对应 `side='short'`

#### 参数校验
- **assetId 断言**：必须为数字且 `>= SPOT_ASSET_ID_OFFSET (= 10_000)`
  - `< SPOT_ASSET_ID_OFFSET` → 服务层抛 `invalid spot assetId ${assetId}, must be >= 10000`
  - `undefined` / `!Number.isFinite` → 抛 `'Spot asset metadata not loaded. Please try again.'`
- **Trigger 拦截**：现货模式下 `orderMode === 'trigger'` 时弹 Toast `'Trigger orders are not supported in spot mode'`，不提交
- **TP/SL**：现货下单不附带 TP/SL
- **杠杆**：强制为 1（`leverageValue: 1`），计算 size 时不使用 formData.leverage

#### 价格精度
- `MAX_DECIMALS_SPOT = 8`；最大小数位 = `max(0, 8 - szDecimals)`
- `MAX_SIGNIFICANT_FIGURES = 5`
- `MAX_PRICE_INTEGER_DIGITS = 12`
- 整数部分 >= 5 位时禁止输入小数
- 中文句号 `。` 自动转为 `.`
- 前导零规则：`0.` 合法，`00` / `01` 等非法
- `formatSpotPriceToValid`：保留整数尾零，去除小数点后尾零（`60.100` → `60.1`；`60000` 保持 `60000`）

### 5.5 持有币种 Tab（订单信息面板）

#### Tab 可见性
- 在 `PerpOrderInfoPanel` 中增加**持有币种 Tab**（代码 tab name 标识为 `Balances`）
- 与 Positions / Open Orders / Trades History / Account 并列

#### 列定义
| 列 | 含义 | 备注 |
|----|------|------|
| Asset | 资产名（已做显示名映射） | OneKey 统一账户模式：USDC 等同币种不区分 spot/perps，UI 合并为单条展示 |
| Balance | `total`（现货 raw total / 永续 totalRawUsd） | |
| Available | `max(total − hold, 0)` / `withdrawable`（永续） | |
| Value | USDC 价值（按 markPx 换算） | 稳定币直接等于 total |
| PNL (ROE %) | `total × midPrice − entryNtl` | 稳定币不计算 PNL；非稳定币行右侧显示**分享按钮**（点击触发分享卡片） |
| Contract | EVM 合约地址（从 `tokenContractMap`） | 显示 6+4 格式 + **复制按钮** + **跳转按钮**（跳转区块浏览器） |

#### 数据规则
- **稳定币**：USDC / USDT / USDB 不计 PNL，`pnl=undefined`
- **价格源优先级**：①同 token 的 USDC 报价对 `markPx` → ②任一 quote 的 `markPx`
- **零余额过滤**：`total == 0` 不显示
- **排序**：USDC 固定在列表最顶部（不参与价值排序）；其他资产按价值（USDC 计价）从高到低；值相等时按 `total` 降序兜底
- **USDC 合并显示（统一账户）**：OneKey 采用统一账户模式，现货 USDC 与合约 USDC 在持有币种 Tab 中**合并为一行展示**，余额 = 现货 USDC + 合约 USDC。代码层 `SpotBalanceList` 中保留的 `needsSuffix` 字段为历史遗留，UI 实际不再展示双条目

#### 交互
- **行点击**：非 USDC 且有 `spotUniverse` 的行 `isAssetClickable=true`，点击调用 `changeActiveSpotAsset` 切换到该 token 现货交易视图。**默认匹配 `<base>/USDC` 交易对**；若该代币无 USDC 报价对则回退到任一可用报价对（与价格源回退口径一致：①优先 USDC ②任一 quote）
- **盈亏分享**：非稳定币行盈亏列右侧显示分享按钮，点击弹出分享卡片（含代币、持仓数量、盈亏金额 / 百分比、价格、二维码 / 推广链接），可保存图片或一键分享到社交平台
- **合约跳转**：合约列地址右侧显示跳转按钮，点击打开区块浏览器（Hyperliquid Explorer 或对应链浏览器）合约页
- **下拉刷新**：触发 `refreshAllPerpsData()`
- **账户切换**：`currentListPage` 回到 1；`spotBalancesAtom` 重置为空
- **Loading 条件**：`currentUser?.accountAddress && !isLoaded` 时显示 loading
- **空态文案**：`global_no_data` + `perp_trade_history_empty_desc`

### 5.6 现货行情页（Ticker Bar / Market Header）

#### 字段切换（perp vs spot）
| 字段 | Perp | Spot |
|------|------|------|
| Open Interest | ✅ 显示 | ❌ 替换为 Market Cap |
| Market Cap | ❌ | ✅ `circulatingSupply × markPrice` |
| Funding Rate | ✅ | ❌ 不显示 |
| Contract | ❌ | ✅ `0x1234...abcd` + 复制按钮 + **跳转按钮**（区块浏览器） |
| Oracle Price | ✅ | ❌ 不显示 |
| builderFee 提示 | ✅（`builderFeeRate===0` 时） | ❌ 不显示 |

#### 合约地址显示
- 格式：`<前 6 位>...<后 4 位>`（例：`0x0000...c0de`）
- 无合约时显示 `--`，无复制 / 跳转按钮
- 右侧依次显示「**复制按钮**」+「**跳转按钮**」
- 复制按钮：点击复制完整地址到剪贴板
- 跳转按钮：点击打开区块浏览器（Hyperliquid Explorer 或对应链浏览器）合约页

### 5.7 订阅与连接优化

#### 订阅类型
- `SPOT_STATE`：现货余额订阅；`spotEnabled` 门控（账户存在时默认开启）
- `SPOT_ASSET_CTXS`：现货全量行情；仅在 Spot 模式或 Token Selector Spot Tab 打开时开启
- `ACTIVE_SPOT_ASSET_CTX`：当前活跃现货 token 详情订阅

#### 订阅计划（planTradeSubscriptions）
- `spotEnabled = hasAccount`
- `spotAssetCtxsEnabled = isSpot || (tokenSelectorOpen && tokenSelectorTab === 'spot')`
- `shouldSyncSubscriptions`：
  - Spot 模式：`Boolean(instrumentCoin)` 且路由 focused
  - Perp 模式：`Boolean(instrumentCoin) && orderBookOptions?.coin === instrumentCoin` 且路由 focused
- `enableLedgerUpdates = hasAccount && infoPanelTab === 'Account'`（单向开关，一旦开启不再关）

#### 首次订阅优化
- `_hasInitialSubscription` 标志：首次 `updateSubscriptions()` 跳过 300ms 防抖，立即执行
- `disconnect()` 重置标志，iOS 前后台重连后首次订阅仍跳 debounce

#### 缓存优化
- `loadTradesHistory`：`CACHE_TIME_QUANTIZE_MS = 10_000` 把 `Date.now()` 量化到 10s 窗口，消除重复 `userFillsByTime` 请求（约 345KB）
- `usePerpFeatureGuard`：切换到缓存版本，`perp-config` 1h TTL

#### 并行化
- `exchangeService.setup()` + `userRole()` 通过 `Promise.all` 并行
- `checkBuilderFeeStatus` + `checkInternalRebateBindingStatus` 并行
- `checkAgentStatus` 顺序执行于两者之后
- `setReferrer` 延后到 `finally` 后 fire-and-forget

### 5.8 URL 路由同步

- 格式：`/perps?mode=<perp|spot>&token=<symbol>`（query string 路由，非 hash 路由）
- **`mode` 参数显式区分模式**：`perp` / `spot`，不依赖 token 名隐式判断
- **`token` 参数使用显示名**：spot 与 perp 共用一组显示名（HYPE / BTC / ETH 等）；DEX 前缀代币保留前缀（`token=dex:HYPE`）
- 示例：
  - `/perps?mode=spot&token=HYPE` → 现货 HYPE/USDC（spot 默认 USDC 报价，根据 token 反查 spotUniverse）
  - `/perps?mode=perp&token=BTC` → 永续 BTC
  - `/perps?mode=perp&token=dex:HYPE` → DEX 永续 HYPE
- URL 变化触发 `switchTradeInstrument({ mode, coin, spotUniverse })`
- 浏览器前进/后退与 tab 页之间保持模式与 token 同步

### 5.9 状态隔离与持久化

| Atom | 类型 | 持久化 | 说明 |
|------|------|-------|------|
| `tradingModeAtom` | global | ❌ | 当前交易模式 |
| `spotActiveAssetAtom` | global | ✅ | 当前选中的现货 token |
| `spotActiveAssetCtxAtom` | global | ❌ | 当前现货 token 行情 |
| `spotBalancesAtom` | global | ❌ | 当前账户现货余额 |
| `spotActiveOpenOrdersAtom` | global | ❌ | 当前账户现货挂单（按 address 隔离） |
| `spotTokenSelectorConfigPersistAtom` | global | ✅ | 现货排序/Tab 配置 |
| `spotTokenFavoritesPersistAtom` | global | ✅ | 现货收藏（独立于永续） |
| `spotPairDisplayMapAtom` | global | ❌ | pair 显示名 map |
| `spotAssetCtxsMapAtom` | global | ❌ | 现货全量行情 map |

#### 账户切换重置
- `spotBalancesAtom` → `{ balances: [], isLoaded: false }`
- `spotActiveOpenOrdersAtom` → `{ accountAddress: undefined, openOrders: [] }`
- `currentListPage` 回到 1

### 5.10 订单与历史成交

- **Open Orders**：现货与永续分两个 list（`spotOpenOrders` vs `perpOpenOrders`），按 `activeTradeInstrument.mode` 切换展示
- **Trades History**：现货与永续共用 `USER_FILLS` 订阅，按 `isSpotInstrument(fill.coin)` 分流过滤
- **撤单作用域**：现货撤单只作用于现货订单；永续撤单只作用于永续订单

### 5.11 爆仓/清算隔离

- 现货模式下 `useLiquidationPrice()` 返回 `null`
- TradingView 图表的持仓线/爆仓线在现货模式不显示相关标记

### 5.12 常量汇总

| 常量 | 值 | 用途 |
|------|-----|-----|
| `SPOT_ASSET_ID_OFFSET` | 10_000 | 现货 assetId 起始偏移 |
| `MAX_DECIMALS_SPOT` | 8 | 现货价格最大小数位基准 |
| `CACHE_TIME_QUANTIZE_MS` | 10_000 | Trades History 缓存量化窗口 |
| `SPOT_MIN_VOLUME_STRICT` | 10 | Spot Tab 最小名义成交额过滤阈值（`dayNtlVlm`，单位按报价币种，spot 基本为 USDC） |
| `MAX_SIGNIFICANT_FIGURES` | 5 | 价格有效位数上限 |
| `MAX_PRICE_INTEGER_DIGITS` | 12 | 价格整数位上限 |

---

## 📝 规则维护指南

### 如何更新规则

1. **发现规则变更**：
   - 在测试过程中发现规则与文档不一致
   - 收到产品/开发通知规则变更
   - API 接口变更或新增字段

2. **更新文档**：
   - 直接修改对应功能的规则部分
   - 在变更记录中记录更新时间和原因

3. **通知相关方**：
   - 如规则变更影响现有测试用例，需同步更新用例

---

## 📅 变更记录

### 2026-03-24
- 3.6：新增「重置布局」按钮规则：
  - K 线与指标高度恢复默认比例
  - 指标恢复默认（仅成交量）
  - 重置状态刷新后保持

### 2026-03-05
- 2.5：增加顶部收藏条拖动排序规则（桌面/插件/Web 大屏）
- 2.12：新增页面底部连接状态与轮播规则（连接状态、速率、刷新、轮播设置、合约社区、更多）；补充轮播点击代币切换逻辑与顶部收藏一致

### 2026-02-03
- 添加搜索规则（2.8）、版块规则（2.9）、后台配置规则（2.9.1）、中文标签规则（2.10）；精简表述

### 2026-01-21
- 添加 TradingView 图表功能规则：
  - 默认指标规则（成交量）
  - 指标管理规则（添加、收藏、本地持久化）
  - 画图工具规则（本地持久化、数据隔离）
  - K 线时间周期规则（预设、自定义、收藏）
  - 图表叠加显示规则（买卖点、持仓线、挂单线、爆仓线、设置项）
  - 视图布局规则（自定义、恢复默认）

### 2026-01-12
- 初始版本
- 添加限价单最优价（BBO）规则（从 qa-rules.md 移入）
- 添加收藏功能规则：
  - 默认推荐代币收藏规则
  - 搜索列表收藏/取消收藏规则
  - 自选列表展示与管理规则
  - 行情页面顶部展示与切换显示模式规则
  - 数据一致性与状态同步规则
  - 网络异常与容错规则
  - 边界与异常场景规则
  - 移动端不支持验证规则

### 2026-03-12
 - 新增独立下单类型规则（市价止盈、市价止损、限价止盈、限价止损），定义 isMarket / executionPrice 行为与触发方向规则。

### 2026-04-16
- 4.3.1 新增表单提交校验规则（条件单）：方向不限制、输入框实时限制、最小下单金额 $10 校验、HL 执行价 95% 偏离校验

### 2026-03-20
- 将下单入口合并为 2 个触发下单模式（市价止盈止损、限价止盈止损），模式内切换止盈/止损以覆盖 4 种触发语义。

### 2026-04-21
- 新增第 5 章「现货交易规则（Spot Trading）」，覆盖 PR #11183：
  - 5.1 交易模式（tradingModeAtom: 'perp' | 'spot'）
  - 5.2 Token Selector Spot Tab（列字段、`dayNtlVlm >= 10` 名义成交额过滤、meta 兜底）
  - 5.3 Token 显示名映射（UBTC→BTC、FXRP→XRP、HPEPE→PEPE 等）
  - 5.4 现货下单（市价/限价 Buy/Sell、assetId 断言、trigger 拦截、杠杆强制 1）
  - 5.5 持有币种 Tab（现货 + 永续 USDC 同屏、PNL 计算、稳定币识别）
  - 5.6 现货 Ticker Bar（Market Cap 替代 Open Interest、合约地址、无 Funding）
  - 5.7 订阅与连接优化（SPOT_STATE/SPOT_ASSET_CTXS 门控、首次跳 debounce、缓存量化）
  - 5.8 URL 路由同步（`@N` / `X/Y` → spot）
  - 5.9 状态隔离与持久化
  - 5.10 订单与历史成交分流
  - 5.11 爆仓/清算隔离（现货 useLiquidationPrice 返回 null）
  - 5.12 常量汇总

### 2026-04-22
- 新增 5.0「HW 钱包参与点（重要边界）」：明确 Hyperliquid Agent Wallet 模式下 HW 仅在 Approve Agent 时签名一次，禁止为下单 / 撤单等高频流程添加 HW 用例。沉淀来自实际生成现货用例时的误加 HW 签名屏校对章节经验
