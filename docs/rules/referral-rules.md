# 返佣模块测试规则

> 本文档定义返佣模块的专项测试规则，生成返佣测试用例时必须参考。

---

## 1. 模块概述

返佣模块包含以下核心功能：
- 返佣绑定与生效
- 返佣累计与结算
- 返佣发放与冻结
- **销售码追踪**（新增）

---

## 2. 销售码追踪功能规则

### 2.1 兑换中心测试规则

#### 2.1.1 入口与登录

| 规则 ID | 规则描述 | 优先级 |
|---------|----------|--------|
| REF-001 | 未登录用户点击「兑换中心」必须弹出登录弹窗 | P0 |
| REF-002 | 登录成功后自动跳转到兑换中心页面 | P0 |
| REF-003 | 兑换中心入口位置：Menu → More → Redeem | P1 |

#### 2.1.2 兑换码输入与验证

| 规则 ID | 规则描述 | 优先级 |
|---------|----------|--------|
| REF-010 | 输入框为空时，Redeem 按钮必须置灰不可点击 | P0 |
| REF-011 | 输入框有内容时，Redeem 按钮可点击 | P0 |
| REF-012 | 无效/不存在的兑换码提示 `Whoops! Invalid redemption code` | P0 |
| REF-013 | 网络请求超时显示加载失败，提供重试按钮 | P1 |
| REF-014 | 输入框支持粘贴兑换码 | P1 |
| REF-015 | 输入框前后空格自动 Trim | P2 |

#### 2.1.3 业务前置条件校验

| 规则 ID | 规则描述 | 优先级 |
|---------|----------|--------|
| REF-020 | 用户已有返佣记录提示 `Redemption code is for new OneKey ID only` | P0 |
| REF-021 | 用户已是黄金或更高级别提示 `Your account isn't eligible for this code` | P0 |
| REF-022 | 用户已使用过销售码提示 `You've already redeemed a similar reward` | P0 |

#### 2.1.4 兑换成功流程

| 规则 ID | 规则描述 | 优先级 |
|---------|----------|--------|
| REF-030 | 兑换成功显示成功页面，展示 `Redemption successful` | P0 |
| REF-031 | 成功页面显示获得的奖励 `Commission level upgrade` | P0 |
| REF-032 | 成功页面显示升级前后级别变化（如 From Bronze to Silver） | P0 |
| REF-033 | 点击 Done 按钮关闭成功页面 | P1 |
| REF-034 | 点击 View Changes 跳转到返佣等级页面 | P1 |

#### 2.1.5 兑换历史记录

| 规则 ID | 规则描述 | 优先级 |
|---------|----------|--------|
| REF-040 | 兑换历史按日期倒序排列（最新在前） | P0 |
| REF-041 | 无历史记录显示空状态 `No redemptions yet` | P1 |
| REF-042 | 历史记录显示兑换状态（Success/Pending） | P1 |
| REF-043 | 历史记录显示兑换时间 | P1 |
| REF-044 | 历史记录显示兑换内容（Commission level upgrade） | P1 |

---

## 3. 错误码映射表

| 错误码 Key | 用户提示文案 | 触发场景 |
|------------|--------------|----------|
| redemption::invalid_code_error | Whoops! Invalid redemption code | 无效/不存在的兑换码 |
| redemption::error_old_account | Redemption code is for new OneKey ID only | 用户已有返佣记录 |
| redemption::error_not_eligible | Your account isn't eligible for this code | 用户已是黄金或更高级别 |
| redemption::error_already_reedem | You've already redeemed a similar reward | 用户已使用过销售码 |

---

## 4. 测试数据准备

### 4.1 账户类型

| 账户类型 | 说明 | 用途 |
|----------|------|------|
| 新注册账户 | 无返佣记录，未使用过销售码 | 正向流程测试 |
| 已有返佣记录账户 | 有返佣历史 | 验证 `error_old_account` |
| 黄金及以上级别账户 | 已是高级别 | 验证 `error_not_eligible` |
| 已使用过销售码账户 | 已兑换过同类福利 | 验证 `error_already_reedem` |

### 4.2 兑换码类型

| 兑换码类型 | 说明 | 用途 |
|------------|------|------|
| 有效兑换码 | 未被禁用、未过期 | 正向流程测试 |
| 无效兑换码 | 不存在的码 | 验证 `invalid_code_error` |
| 已禁用兑换码 | 被后台禁用的码 | 验证 `invalid_code_error` |

---

## 5. 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-01-16 | v1.0 | 新增销售码追踪功能测试规则 |
