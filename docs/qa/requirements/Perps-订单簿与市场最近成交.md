# Perps - 订单簿与市场最近成交

> 需求 [OK-66567](https://onekeyhq.atlassian.net/browse/OK-66567) · Jira Test [OK-5968](https://onekeyhq.atlassian.net/browse/OK-5968)
> 实现范围 [#14666](https://github.com/OneKeyHQ/app-monorepo/pull/14666) · [#14671](https://github.com/OneKeyHQ/app-monorepo/pull/14671) · [#14694](https://github.com/OneKeyHQ/app-monorepo/pull/14694)

## 订单簿

1. 按当前市场和价格档位展示公开买卖盘口。核对价格、数量、两侧排序、累计量及价差。数量变化和价格变化均可刷新相应盘口。
2. 按市场保存档位选择。切换档位或市场时隔离行情数据，保留布局。Android 全页行情切档后仍可滚动到订单簿。旧版回归见 [OK-67026](https://onekeyhq.atlassian.net/browse/OK-67026)、[OK-59102](https://onekeyhq.atlassian.net/browse/OK-59102)。
3. 在可点价的交易面板中，点击实时档位将价格带入限价表单。缓存或过时盘口仅供查看。BBO 及布局重置沿用各自专项用例。

## 市场最近成交

1. Desktop / Web 从市场面板切换「订单簿」和「最近交易」。iOS / Android 从全页 K 线下方切换。移动端交易页的紧凑盘口及现货盘口沿用原入口。
2. 「最近交易」展示当前永续市场的公开成交，保留最多 50 条。合并首屏快照和实时推送，按成交时间从新到旧排序，同一时间与成交 ID 的记录合并，切换市场后隔离旧请求及推送。
3. 每行核对成交价格、数量、买卖方向和时间。价格可补末尾零，保留实际成交精度。数量列显示当前资产单位。时间列旁的图标打开 Hyperliquid 浏览器，零哈希记录沿用浏览器的 TWAP 或清算说明页。
4. 首屏区分加载、暂无数据和失败。断线时保留当前市场的有效记录并显示连线状态，重连后恢复订阅与刷新增量。失败可重试。
5. Desktop / Web 首次打开「最近交易」后订阅，切回订单簿保留 30 秒。移动端全页行情内切换保留订阅，离开页面或退至后台时释放，返回后恢复。
