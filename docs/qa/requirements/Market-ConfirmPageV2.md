# Market - Confirm Page V2 需求文档

> 模块：Market（Swap Pro Mode）
> 功能：Market 详情页 Swap 确认页 V2 改版
> 版本：
> 测试端：全端

---

## 需求背景

Market 详情页的 Swap Pro Mode 兑换流程引入新的确认页（Review Order），在用户点击主操作按钮后先拉起确认页展示完整的交易步骤信息，再由用户确认执行链上交易。改版涵盖普通 Swap、Wrap/Unwrap、需授权 / 无需授权、签名链路等多种场景。

---

## 功能描述

### 1. 确认页入口与生命周期
- 点击主操作按钮后拉起 Review Order 确认页，不直接发起链上交易
- Wrap / Unwrap 场景同样拉起确认页，步骤文案匹配 Wrap 场景
- Action loading / allowance checking / approve matching pending 期间，主操作按钮不可重复触发确认页
- 确认页支持 tab 页面与 overlay / modal 两种容器
- 关闭确认页后重新打开，展示当前最新数据（from/to token、数量、quote、slippage），不残留旧状态

### 2. 确认页步骤编排
- 无需授权的普通 Swap：仅展示 Confirm / Sign / Submit 步骤
- 需要授权的普通 Swap：展示 Approve + Swap / Sign 组合步骤
- Wrap / Unwrap：仅展示对应 Wrap 步骤，不混入 Approve / Swap
- 签名链路报价：展示 Sign 或 Sign and Submit
- 步骤标题/文案：Confirm Swap、Sign、Sign and Submit、Approve and Swap、Approve and Sign 等

### 3. 授权判定与费用刷新
- allowance 已满足时不展示 Approve；不足时展示 Approve
- spender / allowanceTarget 变化时以最新有效 spender 重新判定
- Approve 完成后 gas / network fee 刷新为最新值
- approve pending amount 命中时保持正确 pending / 禁点状态
- Approve and Sign 场景下支持 fee 编辑能力

### 4. 异常与状态切换
- 打开失败时展示对应错误文案（标准 Error → 具体文案，非 Error → unknown error）
- 授权失败 / 签名拒绝 / 发送失败后状态正确停留或回退，可重新发起
- 签名链路中断后正确清理上下文
- 关闭 / 取消后主表单与确认页状态隔离

### 5. 表单同步与关联回归
- 修改输入数量 / 切换 token / 切换方向 / 重新 quote 后确认页数据一致
- 自定义 RPC 不可用时按 fallback 逻辑处理
- 普通 Swap 页面原有流程不受回归影响

---

## 业务规则

| 规则 | 描述 |
|------|------|
| 防重复触发 | loading / checking / pending 期间按钮不可点击 |
| 步骤与链路一致 | 步骤标题必须与实际交易链路匹配 |
| 状态隔离 | 确认页与主表单状态隔离，关闭后不污染 |
| 费用刷新 | Approve 完成后 gas / fee 必须刷新 |
| 错误兜底 | 非标准 Error 展示 unknown error |

---

## 变更记录

| 日期 | 版本说明 |
|------|----------|
| 2026-04-01 | 初版：Market Confirm Page V2 需求 |
