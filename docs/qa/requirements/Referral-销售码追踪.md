# Referral - 销售码追踪

> 版本：5.20.0（待确认）
> 测试端：iOS / Android / Extension / Desktop / Web
> 创建日期：2026-01-16
> 设计稿：https://www.figma.com/design/Cc61bCbsQIQ6y0u75UbI4o/%F0%9F%91%91-Prime?node-id=15478-20732&t=6hkcZdSKnp56yzmW-4

---

## 需求背景

这是一个内部需求：我们在 Dashboard 中创建一个新的页面，用来做两件事情：
1. 创建和管理内部员工所对应的一个销售码
2. 根据这些销售码所绑定的 OneKey ID 及其返佣情况，展示一个 Dashboard 报告

### 销售的主要工作模式
- 拉 KOL，督促 KOL 在 APP 内部填入兑换码
- 在兑换过程中，KOL 会获得白银级别（Silver Tier）体验
- 同时，后台会将该销售与该 KOL 对应的业绩进行绑定

---

## 功能模块

### 1. Dashboard 端（内部管理后台）

#### 1.1 创建和管理销售码

页面字段：
| 字段 | 说明 |
|------|------|
| 员工的邮箱 | 绑定员工身份 |
| 对应的销售码 | 可以创建多个 |
| 客户 KOL 数量 | 统计绑定的 KOL 数量 |
| 总销售订单数 | 核心数据 |
| 总绑定钱包 | 核心数据 |
| 总累计奖励 | 核心数据 |
| 操作 | 启用/禁用 |

#### 1.2 业绩 Overview
- 待定

---

### 2. 客户端 - 兑换中心

#### 2.1 入口
- 位置：菜单 → 更多 → 兑换（票券图标）
- 与 BTC 兑换码共用同一入口（兑换中心 Modal）

#### 2.2 销售码兑换福利
- 会把当前返佣账号直接升级到黄金级别

#### 2.3 码类型路由（v6.3.0+）
- 兑换中心 Modal 不强制要求登录即可输入兑换码
- 输入码后由前端识别格式：
  - 命中 BTC 兑换码格式（`XXXX-XXXX-XXXX-XXXX`，4 段 × 4 字符大写字母数字）→ 进入 BTC 兑换流程（详见 `Referral-BTC兑换码.md`）
  - 其他格式或不存在 → 走原销售码流程（弹出 OneKey ID 登录 Dialog → 登录后校验销售码）

#### 2.4 销售码兑换前提条件
| 条件 | 说明 |
|------|------|
| a. 销售码必须是有效的 | 码必须存在且未被禁用 |
| b. 用户必须登录 OneKey ID | 未登录时弹出登录弹窗 |
| c. 对应的返佣账号没有任何返佣记录 | 新用户专属 |
| d. 对应的返佣账号没有使用过同类福利 | 防止重复领取 |

---

## 边缘情况与产品逻辑

### 1️⃣ 登录状态校验

| 场景 | 处理方式 |
|------|----------|
| 未登录用户点击「兑换中心」 | 要求用户登录（弹出登录 Dialog） |

### 2️⃣ 兑换码验证逻辑

| 场景 | 处理方式 |
|------|----------|
| 空输入点击兑换 | 按钮置灰不可点击 |
| 无效/不存在的兑换码 | 提示 `redemption::invalid_code_error`（Whoops! Invalid redemption code） |
| 网络请求超时 | 显示加载失败，提供重试按钮 |

### 3️⃣ 业务前置条件校验

| 场景 | 处理方式 |
|------|----------|
| 用户已有返佣记录 | 提示 `redemption::error_old_account`（Redemption code is for new OneKey ID only） |
| 用户已是黄金或更高级别 | 提示 `redemption::error_not_eligible`（Your account isn't eligible for this code） |
| 用户已使用过销售码 | 提示 `redemption::error_already_reedem`（You've already redeemed a similar reward） |

### 4️⃣ 兑换历史记录

**状态定义：**
- ✅ 兑换成功（Success）
- ⏳ 等待中（Pending）- 本期没有

**展示规则：**
- 按日期倒序排列（最新在前）

**边缘情况：**

| 场景 | 处理方式 |
|------|----------|
| 无历史记录 | 显示空状态 `redemption::no_redemptions_yet`（No redemptions yet） |
| 历史记录数量过多 | 分页加载或设置上限（建议显示最近 50 条），暂时不用考虑 |

---

## UI 文案定义

| Keyname | Value |
|---------|-------|
| global:redeem | Redeem |
| redemption:history_title | History |
| redemption:center_title | Redemption center |
| redemption:center_description | Enter code to claim exclusive rewards |
| redemption:enter_code_placeholder | Enter the Code |
| redemption:invalid_code_error | Whoops! Invalid redemption code |
| redemption:redeem_button | Redeem |
| redemption:success_title | Redemption successful |
| redemption:received_message | You've received: |
| redemption:commission_upgrade | Commission level upgrade |
| redemption:done_button | Done |
| redemption:status_success | Success |
| redemption:status_pending | Pending |
| redemption:no_redemptions_yet | No redemptions yet |
| redemption:no_redemptions_message | Once you redeem a reward, it'll show up here |

---

## 关联资源

- **设计稿**：https://www.figma.com/design/Cc61bCbsQIQ6y0u75UbI4o/%F0%9F%91%91-Prime?node-id=15478-20732&t=6hkcZdSKnp56yzmW-4
- **Dashboard 参考**：https://claude.ai/public/artifacts/39f6e949-e6a7-46b0-b11f-8186e3a17870

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-01-16 | v1.0 | 初始版本，包含客户端兑换中心功能 |
| 2026-04-30 | v2.0 | 入口改名「兑换」（票券图标）；与 BTC 兑换码共用入口，按格式路由；不再在入口强制登录 |
