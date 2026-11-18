# Market 内置图表自动化对比方案

> 生成时间：2026-07-16
> 关联规则：`docs/qa/rules/market-rules.md`
> 关联需求：`docs/qa/requirements/Market-图表.md`
> 现有基础：`src/tests/helpers/market-chart.mjs`、`src/tests/shared/market/chart.mjs`

## 目标

为下个版本的 Market 内置图表建立一套可持续的自动化对比方案，核心目标不是“截图尽量像 TradingView”，而是验证：

1. 同一标的、同一周期、同一时区下，K 线数据与指标结果正确
2. 与 TradingView 的交互语义一致
3. 在必要时用局部视觉比对补充发现渲染异常

## 当前仓库可复用能力

仓库中已经具备一部分图表自动化能力：

- `src/tests/helpers/market-chart.mjs`
  - 等待图表 ready
  - 切换时间周期
  - 读取 OHLC
  - 读取指标标签
  - 基础 OHLC compare helper
- `src/tests/shared/market/chart.mjs`
  - Desktop / Web / Extension 三端图表测试骨架
  - TradingView iframe / webview 穿透逻辑
- `docs/qa/rules/market-rules.md`
  - 已定义图表功能、数据一致性、性能要求
- `docs/qa/testcases/cases/market/2026-03-26_Market-图表.md`
  - 已有完整测试维度，可直接映射到自动化分层

结论：不需要重写整套测试框架，建议在现有 `market-chart` helper 之上新增“对比层”。

## 总体策略

建议采用三层模型：

### 第一层：数据对比（主断言层）

这是最重要的一层，优先级最高。

验证项：

- `time / open / high / low / close / volume`
- 已收盘 bar 的准确性
- 指标序列准确性：EMA / MACD / RSI / BOLL / VOL
- visible range 内最后 N 根 bar 的连续性

基本原则：

- 只比较“已收盘 bar”，不比较正在形成中的最新一根
- 统一 `symbol / resolution / timezone / session`
- 对比用统一 reference，避免一边用 BTCUSD、一边用 BTCUSDT 造成伪差异
- 指标不仅比最后 1 个点，至少比最近 20 个点的序列

### 第二层：语义对比（交互正确性）

TradingView 在这里作为参考实现。

验证项：

- 时间周期切换后，选中状态与加载结果一致
- 十字光标停在同一根 bar 时，tooltip 展示的时间、OHLC、Volume 一致
- 缩放 / 平移后，可视时间范围一致
- 添加 / 移除指标后，图例和副图变化一致
- 价格 / 市值切换、蜡烛 / 折线等图形模式切换行为一致

这一层关注的是“行为和语义是否一致”，不是像素是否一模一样。

### 第三层：视觉对比（补充层）

截图 diff 只做补充，不做主判定。

适合发现的问题：

- K 线颜色反了
- MACD 柱体层级错乱
- 布林带轨道断裂
- 副图区域高度异常
- 十字光标 / 网格 / watermark 遮挡内容

不建议做全图 raw pixel diff，建议做：

- 主图区局部截图
- MACD 区局部截图
- OBV / RSI 区局部截图
- 使用 SSIM 或 perceptual diff
- 屏蔽动态区域：当前价格线、hover、实时倒计时、系统字体差异

## 为什么不建议“只拿 TradingView 截图硬比”

如果直接拿现网 TradingView 页面和内置图表做整图对比，会有大量假失败：

- 数据源可能不同
- 交易所不同
- 时间片边界不同
- 时区不同
- 最新未收盘 bar 波动不同
- canvas 抗锯齿 / 字体 / DPR 不同
- TradingView 与内置图表的布局边距不同

因此 TradingView 更适合做“参考 oracle”，而不是唯一断言源。

## 推荐实施架构

### 1. 双适配器模型

在现有 helper 基础上抽象两个 adapter：

- `BuiltInChartAdapter`
- `TradingViewChartAdapter`

两边暴露统一方法：

```js
getVisibleBars()
getVisibleRange()
getSelectedResolution()
setResolution(resolution)
moveCrosshairToBar(index)
getCrosshairSnapshot()
addIndicator(name, params)
removeIndicator(name)
getIndicatorSeries(name)
captureChartRegion(region)
```

这样断言逻辑只写一套，不会绑死在 TradingView DOM 结构上。

### 2. 固定对照 Harness 页面

推荐做一个专用对照页：

- 左：内置图表
- 右：TradingView

两边强制使用同一组输入：

- symbol
- resolution
- timezone=`UTC`
- chart type
- indicator params
- viewport size

用途：

- 本地调试方便
- 自动化稳定
- 便于对齐“同一时刻、同一 bar”

### 3. Fixture / Replay 数据源

长期最稳的方案不是直接对现网，而是：

- 抓一份标准 bars fixture
- 用这份 fixture 喂内置图表
- 同时生成 TradingView 参考结果

推荐维护：

- `BTC-USDT 15m`
- `BTC-USDT 1h`
- `ETH-USDT 15m`
- `SOL-USDT 1h`

每份 fixture 至少覆盖：

- 平稳行情
- 剧烈波动
- 长上影 / 长下影
- 低成交量区间
- 缺口 / 异常点过滤场景

## 对比断言设计

### P0：Bar Parity

比较最近 50 根已收盘 bar：

- `timestamp`
- `open`
- `high`
- `low`
- `close`
- `volume`

建议阈值：

- 价格：`<= 0.1%`
- Volume：`<= 1%` 或按产品定义

### P0：Crosshair Parity

在同一张图上取 5 个固定 bar：

- 最左
- 25%
- 50%
- 75%
- 最右已收盘 bar

对比：

- 时间
- O/H/L/C
- Volume
- 当前选中指标值

### P0：Indicator Parity

固定参数：

- EMA(9)
- EMA(26)
- MACD(12,26,9)
- RSI(14)
- BOLL(20,2)

比较最近 20 个点的序列，而不是只比最后一个点。

### P1：Visible Range Parity

缩放 / 平移后，对比：

- start time
- end time
- 当前屏幕可见 bar 数量

### P1：Axis / Label Sanity

对比：

- Y 轴价格方向正确
- X 轴时间顺序正确
- 价格 / 市值模式切换后 label 口径正确

### P2：Visual Diff

只做局部截图：

- 主图区
- 指标区

并对以下区域做 mask：

- 当前价标签
- 十字光标
- watermark
- 右侧实时数值标签

## 必须提前向研发要的测试 Hook

如果内置图表不给测试 hook，自动化会变脆。

强烈建议预埋：

```js
window.__chartTest = {
  getBars,
  getVisibleRange,
  getIndicators,
  moveCrosshairToBar,
  setResolution,
  addIndicator,
  removeIndicator,
}
```

最低必须有这 4 个：

- `getBars()`
- `getVisibleRange()`
- `getIndicators()`
- `moveCrosshairToBar(index|timestamp)`

有这些 hook 后，自动化将从“猜 DOM / 猜 canvas”升级到“直接验证图表状态”。

## 与现有仓库结构的对接建议

建议新增：

- `src/tests/helpers/chart-parity.mjs`
  - 通用对比断言
- `src/tests/helpers/chart-adapters/builtin.mjs`
  - 内置图表 adapter
- `src/tests/helpers/chart-adapters/tradingview.mjs`
  - TradingView adapter
- `src/tests/shared/market/chart-parity.mjs`
  - Market 图表 parity 共享逻辑
- `src/tests/web/market/chart-parity.test.mjs`
  - Web parity wrapper
- `src/tests/desktop/market/chart-parity.test.mjs`
  - Desktop parity wrapper
- `shared/fixtures/chart/*.json`
  - bars fixtures

现有可直接复用：

- `waitForChartReady`
- `getOHLCFromChart`
- `compareOHLC`
- Desktop / Web / Extension 连接与导航 wrapper

## MVP 建议

第一版 PoC 不要追求全功能，建议只做一条最有价值的链路：

### PoC-1

- 标的：`BTCUSDT`
- 周期：`15m`
- 指标：`MACD`
- 端：`Web`
- 断言：
  - 最近 20 根已收盘 bar 的 OHLC
  - 最近 20 个 MACD 点
  - 3 个 crosshair 采样点

PoC 成功后再扩展：

### PoC-2

- 加 `1h`
- 加 `EMA / RSI`
- 加 Desktop

### PoC-3

- 加 screenshot diff
- 加缩放 / 平移
- 加断网恢复

## 风险与注意事项

### 1. Symbol 映射

必须先统一：

- 内置图表 symbol
- TradingView symbol
- 数据源交易所

例如 `BTCUSD`、`BTCUSDT`、`BITSTAMP:BTCUSD`、`BINANCE:BTCUSDT` 不是一回事。

### 2. 时区与 session

必须固定为统一时区，建议 `UTC`。

若 bar 边界按本地时区切，会导致 D / W / M 周期持续假失败。

### 3. 未收盘 bar

不要把最后一根正在形成的 bar 作为主断言对象。

### 4. 指标算法口径

要和研发确认：

- EMA seed 规则
- RSI smoothing
- MACD rounding
- BOLL 标准差与 sample window

否则看起来“只差一点”，实际会整段序列都偏。

### 5. 视觉对比的期望管理

视觉 diff 的目标是发现重大渲染问题，不适合做严格数值真相判断。

## 推荐结论

最优方案不是“拿现网 TradingView 整页截图直接和内置图表硬比”，而是：

1. 先做同周期、同数据源、同已收盘 bar 的数据对比
2. 再做 crosshair / indicator / visible range 的语义对比
3. 最后用局部截图 diff 兜底发现渲染异常

对你们当前仓库来说，最省成本、最稳的切入点是：

- 复用现有 `market-chart` helper
- 新增 adapter + parity helper
- 先落一个 `BTCUSDT 15m + MACD` 的 PoC

## 下一步建议

建议按这个顺序推进：

1. 和研发确认 symbol / source / timezone / indicator 口径
2. 为内置图表补 `window.__chartTest` debug hook
3. 新增 `chart-parity.mjs` 通用对比 helper
4. 先做 `BTCUSDT 15m + MACD` PoC
5. 跑通后再扩到 Desktop、多指标、截图 diff
