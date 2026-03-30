# Perps - 投资组合与盈亏（Portfolio & PnL）（入口改造 + 图表/统计/风险）

> 需求来源：Perps 存款入口逻辑改造（显示投资组合与盈亏/Portfolio & PnL）
>  
> 覆盖端：桌面端 / Web 端 / iOS / Android（全端）  
> App 版本：  
> 生成时间：2026-03-26

## 1. 需求背景

- Perps 原“存款/Deposit”入口改造为“投资组合与盈亏（Portfolio & PnL）”入口（展示投资组合分析）。
- 不同端的入口形态不同：桌面端为弹窗浮层，移动端为全屏页面。
- 空账户/无可展示资产时，入口行为与展示逻辑有差异（桌面端空账户走充值引导弹窗）。

## 2. 功能范围

### 2.1 入口与路由

- 桌面端：点击 Perps 顶部的钱包徽标（或账户余额按钮）打开投资组合与盈亏弹窗浮层（双列布局）。
- 桌面端（空账户）：点击钱包徽标不打开分析弹窗，改为打开充值引导弹窗。
- 移动端：点击 Perps 顶部的钱包徽标跳转至 MobilePortfolioPage（全屏页面），不展示桌面端弹窗样式。
- 桌面端：账户面板图表入口可打开投资组合与盈亏，内容与顶部入口一致。
- 从不同入口进入，默认图表类型与默认时间维度一致。
- 页面/弹窗关闭、返回、重复进入后状态可重建；不出现白屏、遮罩残留、重复实例。

### 2.2 图表与时间维度

- 图表类型：
  - 账户价值/净值（Account Value）：展示历史净值/账户价值（折线/面积）。
  - 盈亏（PnL）：展示基线（baseline）数据，0 轴以上为绿色、0 轴以下为红色。
- 图表类型切换时：图表、标题、单位、提示框（tooltip）数据随之切换。
- 时间维度：1D / 1W / 1M / All。
  - 切换时间维度时：请求参数、图表数据、X 轴范围同步更新。
  - 快速切换时：最终展示与最后一次选择一致。
- 边界数据：
  - 无数据、单点数据、极小波动、大幅波动：图表可显示，不闪退。
  - 不同端格式化/价格刻度/边距（formatter/priceScale/margins）表现一致（不截断、不压缩、标签不重叠）。
- 切换账户/切换币对/重新进入投资组合与盈亏后：图表数据刷新，不复用上一个账户的缓存数据。
- LightweightChart 新增基线/价格边距/自定义格式化（baseline/priceScaleMargins/custom formatter）后：Perps 其他图表使用场景不受影响。

### 2.3 PnL 与统计数据

- Total P&L 口径与 Hyperliquid 官方一致，包含 fees 与 funding。
- API 返回 pnlHistory 与 net deposits 后：净值、PnL、累计收益口径联动。
- 交易统计（Trading stats）展示字段（示例）：胜率（Win Rate）、盈亏因子（Profit Factor）、平均盈利（Avg Win）、平均亏损（Avg Loss）、手续费（Fees）、最常交易（Most Traded）。
- 统计计算覆盖：
  - 仅盈利成交、仅亏损成交、盈亏混合成交。
  - 无任何成交：Trading stats 为空态/默认态；Win Rate 条形图为灰色。
  - 仅充值提现、无交易记录：PnL 与统计展示不误算为交易收益。
- 性能：历史成交较多时加载不明显卡顿；避免重复请求。
- 异常兜底：服务端返回异常值、null、空数组、缺字段时不出现 NaN/Infinity。

### 2.4 账户健康与风险色

- Gauge：Leverage、Margin Used、Maintenance Margin、MMR 半圆仪表盘显示数值、单位、刻度与颜色。
- MMR 颜色阈值：
  - ≤ 40%：绿色
  - 40% ~ 70%：黄色
  - > 70%：红色
- 上述 MMR 颜色规则在以下模块保持一致：
  - Portfolio gauge
  - PerpAccountPanel
  - Mobile Ticker
- 边界：40%、70% 附近无错档、抖动或不一致。
- 极低风险、极高风险、无保证金数据：仪表盘可展示或兜底展示。

### 2.5 资金动作与返回

- Portfolio 内 Deposit/Withdraw 按钮可进入对应流程；目标 tab/路由正确。
- Mobile withdraw 场景 actionType 传递正确，进入后默认落在 withdraw tab。
- 从 Deposit/Withdraw 返回 Portfolio：状态恢复，不丢失当前账户上下文。
- DepositWithdrawModal 在 Desktop/Mobile 两端打开、关闭、切换 tab 行为不回归。

### 2.6 DashText 与提示组件

- Desktop：DashText 展示 Tooltip（hover/click 交互）。
- Mobile：DashText 展示 Popover（点击触发、关闭、遮罩、定位）。
- 多语言、深浅色、长文案、滚动、横竖屏切换下，Tooltip/Popover 不错位、不残留。

### 2.7 多端与回归

- Desktop 大屏：弹窗双列布局不重叠；小窗口：可滚动/自适应不遮挡操作区。
- Mobile：全屏纵向布局自然，不溢出。
- Web / iOS / Android / Desktop：同一账户数据下字段与关键数值一致。
- 语言切换：标题/按钮/统计项/tooltip 文案 key 不缺失、不泄漏。
- Perps Header 右侧入口、手续费弹层、账户面板、其他 LightweightChart 场景不回归。

## 3. 已知风险点（用于测试聚焦）

- 入口与空账户分支：Deposit 引导与 Portfolio 弹窗切换逻辑。
- 图表 formatter 与 margins：多端一致性与标签重叠/截断。
- 统计计算：0/空数组/null/缺字段，避免 NaN/Infinity。
- 风险阈值边界：40%/70% 颜色切换与抖动。
- 频繁切换筛选/账户：缓存复用与竞态导致的旧数据残留。

## 4. 变更记录

- 2026-03-26：新增 Perps Portfolio & PnL 入口改造需求文档；补充图表、统计、风险阈值与回归范围。

