# Perps - 分屏图表

> Jira Test [OK-23930](https://onekeyhq.atlassian.net/browse/OK-23930) · 需求与验收参考 [OK-67388](https://onekeyhq.atlassian.net/browse/OK-67388) · [OK-67509](https://onekeyhq.atlassian.net/browse/OK-67509) · [OK-67439](https://onekeyhq.atlassian.net/browse/OK-67439)

## 布局和操作

1. Perps 大屏桌面布局的原生图表支持单图、左右两图、上下两图、左一右二及 2×2。支持拖动分隔线，按布局恢复尺寸及各图配置。窄屏、iOS、Android 和旧版 TradingView 使用单图。
2. 点击任一图表将其设为当前交易图，绿色边框标记选中项。共享主控栏作用于当前图表。各图保留各自的周期和指标，切换时保留面板位置。非选中图的账户相关叠加只读。
3. 各图显示对应资产的 K 线、指标、价格、24 小时涨跌幅及当前周期。面板内通过简易搜索选择永续或现货标的，通过简易下拉切换周期，通过快捷按钮放大当前单图，退出后恢复原分屏。见 [OK-67554](https://onekeyhq.atlassian.net/browse/OK-67554)、[OK-67555](https://onekeyhq.atlassian.net/browse/OK-67555)、[OK-67781](https://onekeyhq.atlassian.net/browse/OK-67781)、[OK-67782](https://onekeyhq.atlassian.net/browse/OK-67782)、[OK-67785](https://onekeyhq.atlassian.net/browse/OK-67785) 和 [OK-67787](https://onekeyhq.atlassian.net/browse/OK-67787)。

## 五项同步

| 开关 | 开启后的预期 |
| --- | --- |
| 资产 | 统一为当前交易标的，从任一图换币时全体更新。关闭后各图恢复独立资产。 |
| 时间间隔 | 开启时采用当前选中图表的周期。之后在任一图切换周期时，其他支持该周期的图表跟随。见 [OK-67844](https://onekeyhq.atlassian.net/browse/OK-67844)。 |
| 十字线 | 按同一时间定位其他图表各自周期的 K 线并显示对应图例。价格横线只在同资产且价格可见时同步。 |
| 时间 | 其他图表跟随最后实际移动的图表对齐时间轴，各自保留缩放比例。 |
| 日期范围 | 选择日期或区间、拖动或缩放时，其他图表对齐可见起止时间。对齐受标的历史范围与缩放限制。 |

五项默认关闭，分别控制并随布局保存。已出现的抖动、闪烁和快速换币加载缺陷对照 [OK-67840](https://onekeyhq.atlassian.net/browse/OK-67840)、[OK-67845](https://onekeyhq.atlassian.net/browse/OK-67845) 和 [OK-67539](https://onekeyhq.atlassian.net/browse/OK-67539) 验收。调整副图指标后仍可拖动高度。见 [OK-67794](https://onekeyhq.atlassian.net/browse/OK-67794)。

## 绘图

绘图工具随选中图表切换。同一页面内，同资产的图表共享绘图对象、撤销重做和保存状态。绘图按资产保存并恢复。快捷键优先作用于鼠标所在图表，否则作用于焦点图表，一次按键只执行一次。Extension 的弹窗、侧栏和独立标签分别加载绘图，各自页面内实时共享。工具行为沿用原生图表规则。见 [OK-67439](https://onekeyhq.atlassian.net/browse/OK-67439)。

## 参考版本

- 布局 [PR #14550](https://github.com/OneKeyHQ/app-monorepo/pull/14550) · `e0d23db0fd` → `3a348e78fb`
- 绘图 [PR #14569](https://github.com/OneKeyHQ/app-monorepo/pull/14569) · `f4f453766b` → `5004c77579`
- 五项同步 [PR #14599](https://github.com/OneKeyHQ/app-monorepo/pull/14599) · `e169df6a90` → `4cef0c3b38`
- 主控与行情更新 [PR #14629](https://github.com/OneKeyHQ/app-monorepo/pull/14629) · 本轮核对 `x` / `06699cf30a490199ac5c65d62d1d8b41747ca7a0`
