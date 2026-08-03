# Perps 最小下单金额快捷填入（Minimum Order Guidance）

> **模块**：Perps 合约交易  
> **App 版本**：  
> **日期**：2026-08-03  
> **来源**：app-monorepo PR #12720（feat: improve Perps minimum order guidance and mobile trading UI，2026-08-02 合并）  

---

## 📋 需求背景

### 需求简介
下单金额低于最小名义价值（$10）时，报错提示从固定文案升级为**可操作引导**：
1. Toast 标题展示**按当前输入单位换算后的具体最小金额**（不再固定显示 $10）
2. 桌面端 Toast 内新增「填入最小金额」按钮，点击后一键把最小金额填入仓位输入框
3. 移动端改为自动聚焦输入框 + 键盘附件条展示可点击的「最小 {金额}」快捷填入项

### 影响范围
- **测试端**：iOS / Android / Extension / Desktop / Web（全端，桌面端与移动端交互不同）
- **数据源**：Hyperliquid
- **范围**：仅主下单面板（PerpTradingPanel）；加仓弹窗等其他入口的最小金额 Toast 不带该按钮

---

## 🎯 功能描述

### 功能点 1：动态最小金额提示

触发条件（点击 买入/做多 或 卖出/做空 按钮时）：
- 仓位输入为空，或
- 名义金额（数量 × 价格）< $10 最小名义价值

Toast 标题：`仓位大小必须至少 {amount}`（i18n key `perp.order_size_small`），原副标题描述文案已移除。

`{amount}` 按当前仓位输入单位换算（均**向上取整**，保证填入后能通过校验）：
| 输入单位 | 换算 | 展示格式 |
| --- | --- | --- |
| 币种数量（token） | $10 ÷ 当前价格，按 szDecimals 向上取整 | `{数量} {币种}` |
| USD | 上述 token 数量 × 价格，2 位小数向上取整 | `$X`（≈$10） |
| 成本/保证金（margin） | 名义 ÷ 杠杆，2 位小数向上取整 | `$X`（≈$10/杠杆，如 20x 下 $0.51） |

回退：无有效价格 / 滑杆模式下不生成建议值 → Toast 金额回退显示 **$10**，且无快捷填入入口。

### 功能点 2：桌面端 Toast 快捷填入按钮（Desktop / Web / Extension）

- Toast 左对齐显示主样式小按钮「填入最小金额」（i18n key `fill_minimum_amount__action`，testID `perp-minimum-order-toast-action`）
- 点击后：按当前单位把最小金额填入仓位输入框（等同手动输入，联动成本/滑杆等展示）
- 桌面端不自动聚焦输入框

### 功能点 3：移动端键盘附件条快捷填入（iOS / Android）

- Toast **不带**按钮
- 触发校验失败后自动聚焦仓位输入框并弹出键盘
- 键盘附件条左侧显示可点击文本「最小 {amount}」（i18n key `perp.size_least`，testID `perp-size-input-minimum-action`）
- 点击后填入最小金额且**不收起键盘**；右侧「完成」按钮收起键盘

### 边界说明

- 保证金不足（金额 ≥ $10 但超过可用余额）是**另一类** Toast，不带填入按钮——本功能只针对低于最小下单金额
- 现货标准限价单（非 BBO）不适用最小金额守卫（既有 `shouldApplyMinimumOrderGuard` 规则）
- 建议值随币种价格、精度（szDecimals）、杠杆实时计算

---

## 📅 变更记录

| 日期 | 内容 |
| --- | --- |
| 2026-08-03 | 首版，来源 PR #12720 |
