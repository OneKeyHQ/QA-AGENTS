# Swap - Private Send

> **模块**：Swap  
> **功能名称**：Private Send  
> **版本**：（待填写 App 版本）  
> **测试端**：Android / iOS / Desktop / Extension / Web

---

## 1. 需求背景

Private Send 是 Send 流程内新增的隐私发送模式。用户仍从 Send 入口发起转账，但在支持的「代币 + 网络」组合下，可切换到 Private 模式，通过渠道商 RocketX 的固定汇率完成发送。

---

## 2. 前置条件

| 条件 | 说明 |
|------|------|
| 账户 | 已登录可发送资产的 HD 钱包 / HW 钱包 |
| 配置 | 后端已提供 Private Send 全局开关与支持组合白名单 |
| 渠道 | RocketX 当前可返回可用性、报价、ETA、订单状态 |
| 网络 | 默认联网；慢链场景需准备可复现 `Submitting` 的链路 |

---

## 3. 功能描述

### 3.1 入口与模式切换

| 项 | 说明 |
|----|------|
| 入口 | 位于现有 Send 流程内 |
| 默认模式 | 进入 Send 页面默认选中 Public |
| 切换控件 | 页面右上角（移动端在金额上方）显示 `Public / Private` 二选一 |
| 可见性 | 仅当当前网络 + 当前代币支持 Private Send 时显示；不支持时隐藏 |
| 回退 | 用户切换网络或代币后若新组合不支持 Private Send，自动切回 Public 并隐藏切换控件 |

### 3.2 Private 模式金额输入页

| 项 | 说明 |
|----|------|
| Estimated received | 显示 RocketX 报价返回的目标币种数量与法币价值 |
| Arrival in | 显示 ETA 结果 |
| Provider | 当前展示 RocketX |
| How it works? | 位于金额输入页左下角；移动端位于 Preview 下方；点击后跳转帮助中心文章 |

### 3.3 History Details

| 项 | 说明 |
|----|------|
| 交易类型 | 新增 `Private Send` |
| Token 区域 | 仅展示 `Send Amount`，不展示收到的目标币种 |
| 状态条 | `Submitted`、`Pending`、`Done`；慢链在 `Submitted` 与 `Pending` 之间增加 `Submitting` |
| From | 当前钱包地址 |
| To | 用户在 Send 流程填写的目标接收地址，不等同于链上实际收款地址 |
| Transaction ID | 用户付款链上 TxHash |
| Provider | 渠道商名称，如 RocketX |

### 3.4 配置与后端能力

| 项 | 说明 |
|----|------|
| 可用性接口 | 进入 Send 页面、切换网络、切换代币时调用 |
| 可用列表 | 后端按「OneKey 白名单 ∩ RocketX 支持范围」实时计算 |
| Dashboard 配置 | 支持全局总开关与「代币 + 网络」白名单维护 |
| 订单状态机 | 合并渠道订单状态与链上交易状态，输出 `Submitted / Submitting / Pending / Done / Failed` |
| History 接口 | 新增 Private Send 交易类型字段，包含 Provider、实际成交 Rate、用户填写的目标接收地址等 |

---

## 4. 业务规则

| 规则项 | 描述 |
|--------|------|
| UI 兜底 | 不支持 Private Send 的组合下，Send 页面与原有 Public 流程保持一致 |
| 语义口径 | 虽然底层经过渠道兑换，前端仍按发送语义展示，不把目标币种作为主资产展示 |
| 慢链处理中 | BTC 等慢链可长时间停留在 `Submitting`，前端不能把该状态误渲染为失败 |
| 帮助中心 | 帮助中心链接先使用占位 URL，待运营提供正式链接后替换 |

---

## 5. 已知风险

| 风险点 | 说明 |
|--------|------|
| 可用性瞬时变化 | 白名单与 RocketX 实时支持范围交集变化会导致切换控件显示状态变化 |
| 语义地址不一致 | History 详情展示的 `To` 与链上实际收款地址可能不同，容易误用链上数据替换 UI 语义地址 |
| 慢链状态滞留 | `Submitting` 可能持续较长时间，容易被前端超时逻辑误判 |

---

## 6. 关联资源

- `docs/qa/rules/swap-rules.md`
- `docs/qa/testcases/cases/swap/2026-05-22_Swap-Private-Send测试.md`
- 设计稿：https://www.figma.com/design/S2GLhYwpGWI9Z5BFXvbPgX/%E2%9A%96%EF%B8%8F-Swap?node-id=23751-31512&t=G2dwlvnFCuO95dDk-1

---

## 7. 变更记录

| 日期 | 变更内容 |
|------|----------|
| 2026-05-22 | 初版：补充 Private Send 的入口与模式切换、金额输入页字段、History Details、配置与状态机规则 |
