# Swap - BTC 交易 Live Activity（灵动岛）

> 模块：Swap  
> 功能：原生 BTC Swap / Bridge 订单的 iOS Live Activity（灵动岛 + 锁屏）  
> 版本：App 6.8.0  
> 测试端：iOS（iOS 16.1+；灵动岛仅 iPhone 14 Pro 及以上；Android / 其他端不实现）  
> 需求：[OK-60951](https://onekeyhq.atlassian.net/browse/OK-60951)  
> 视觉：[OK-60950](https://onekeyhq.atlassian.net/browse/OK-60950)；正式设计稿 Frame 34328（双币方案）

---

## 需求背景

原生 BTC 的 Swap / Bridge 订单普遍要等比特币网络确认，用户下单后往往会离开 App。当前进度只能回到 Swap 历史查看。本需求在 iOS 上为这类订单增加 Live Activity，在灵动岛和锁屏展示等待进度。

---

## 功能描述

### 1. 触发

| 规则 | 描述 |
|------|------|
| 币种 | 转出为 Bitcoin 主网原生 BTC 的 Swap / Bridge 订单 |
| 创建时机 | 转出交易（deposit tx）广播成功后立即创建；广播失败不创建 |
| 系统 | iOS 16.1+ 支持 Live Activity；iPhone 14 Pro 及以上显示灵动岛，其他机型显示锁屏 / 通知中心 |
| Android 及其他端 | 不实现 |
| 权限 | 系统设置关闭 OneKey「实时活动」时不创建，不做弹窗引导 |
| 数量 | 一单一 Activity；多笔同时进行时默认展示最新一笔 |

### 2. 三种系统样式

布局按 Apple 建议，展开后与紧凑态保持一致。

**紧凑态（Compact，灵动岛默认）**

- 左侧：转出币种 icon + 转入币种 icon 叠放
- 右侧：Activity 出现以及每次状态更新后，先显示 ETA（如 `24 min`），**3 秒**后切换为不定量进度环
- 用户点按紧凑态：在进度环与剩余时间之间切换（正式设计稿）
- 用户长按：展开
- 进行中进度环为进行色；refund 进行中进度为红色
- 终态右侧换成结果图标：完成显示绿色 ✓；失败 / 退款显示红色 ❗

**展开态（Expanded，长按灵动岛）**

- 第一行：转出 / 转入币种 icon，右上角 OneKey logo
- 第二行：`BTC ▶▶▶ USDC`（转出 ticker、动效箭头、转入 ticker），右侧 ETA（`≈24 min`）或终态文案（`Done` / `Failed` / `Refunded`）
- 第三行：进度条
- 第四行：当前步骤文案（如 `Confirming on Bitcoin network`）；部分终态不显示该行，灵动岛高度缩小
- refund 进行中：目标币种 50% 透明度；箭头方向为资金退回方向（朝转出）
- 完成 / 已退款：箭头停止移动

**最小态（Minimal，多个 Live Activity 并存）**

- 圆环内显示转出币种 icon

### 3. ETA 与进度条

- 后端在订单创建时下发预估总时长（分钟，历史中位数）；前端以 Live Activity 创建时刻为起点倒计时
- 整单一个倒计时，不按步骤拆分，不随订单状态重新校准；步骤变化只更新文案和进度条，不影响 ETA 数字
- 只显示分钟，不显示秒；分钟向上取整（剩余 4 分 20 秒显示 `≈5 min`）；展开态格式 `≈24 min`
- 本地 iOS timer 走时
- 剩余时间 &lt; 10s：ETA 区域切换为 `Almost done`，之后不再显示数字，直到终态
- 订单提前完成：直接切 `Done`，倒计时作废
- 失败 / 退款：切 `Swap failed · Refund initiated` / `Refunded`，倒计时停止
- 进度条按「已用时间 / 预估总时长」线性推进，最多 95%；`Almost done` 后停在 95% 保持动效；订单完成补到 100%
- 后端未下发预估时长或值为 0：前端兜底 10 分钟

### 4. 状态（Jira 正文未附状态表，按正式设计稿 + 需求文案）

| 阶段 | 紧凑态右侧 | 展开态右侧 | 第四行 | 进度 / 箭头 |
|------|------------|------------|--------|-------------|
| 源链确认中 | ETA → 进度环 | `≈N min` | 显示如 `Confirming on Bitcoin network` | 正向箭头循环，绿色进度 |
| 失败已发起退款 | 红色进度 | `Failed` | 显示 `Swap failed · Refund initiated` | 反向箭头，红色进度，目标币 50% 透明 |
| 已退款 | 红色 ❗ | `Refunded` | 不显示，高度缩小 | 反向箭头停止 |
| 完成 | 绿色 ✓ | `Done` | 不显示，高度缩小 | 正向箭头停止，进度 100% |
| 用户取消订单 | — | `Order canceled` | — | Activity 结束 |

### 5. 通用与边缘

- Ticker 最多 6 个字符，超出显示 `ABCDEF…`
- 币种 icon、ticker、网络名称取订单数据
- 点按任意形态进入该笔 Swap 历史详情（设计任务 [OK-60950](https://onekeyhq.atlassian.net/browse/OK-60950)）
- 用户在系统里划掉 Live Activity：不重新创建；终态也不再展示
- 创建失败（权限关闭、系统数量上限等）：静默失败，不影响下单
- 单活动最长 8 小时；终态展示数分钟后结束
- 锁屏适配深/浅外观，或固定深色底；灵动岛恒为黑底
- 金额数量不做展示要求（设计可只展示币对）

### 6. 与设计稿差异（以 OK-60951 正文为准处）

- 紧凑态自动切换时长：需求正文为 **3 秒**；正式设计稿标注 1 秒。用例按 **3 秒**。
- 箭头 / 进度条逐帧自定义动画：需求注明须与 ActivityKit 可实现范围对齐，用例只验收方向、停止、颜色、是否显示第四行。

---

## 源码实现参考

订单状态枚举见 `packages/shared/types/swap/types.ts` 的 `ESwapTxHistoryStatus` / `ESwapCrossChainStatus` / `ESwapExtraStatus`。不并入需求正文。

---

## 变更记录

| 日期 | 版本说明 |
|------|----------|
| 2026-11-24 | 初版：按 OK-60951 正文与正式设计稿 Frame 34328 整理 |
