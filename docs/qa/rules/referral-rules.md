# 返佣模块测试规则

> 本文档定义返佣模块的专项测试规则，生成返佣测试用例时必须参考。

---

## 1. 模块概述

返佣模块包含以下核心功能：
- 返佣绑定与生效
- 返佣累计与结算
- 返佣发放与冻结
- 销售码追踪
- **硬件销售奖励**（新增）
- **链上奖励：合约（On-chain reward: Perps）**（新增）
- 链上奖励：DeFi（后续迭代）

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

---

## 3. 硬件销售奖励功能规则

### 3.1 等级体系

| 规则 ID | 规则描述 | 优先级 |
|---------|----------|--------|
| REF-HW-001 | 注册即获得铜牌（Bronze）等级，返佣比例 10% | P0 |
| REF-HW-002 | 销售额达 $300 升级银牌（Silver），返佣比例 15%，升级立即生效 | P0 |
| REF-HW-003 | 销售额达 $1,000 升级金牌（Gold），返佣比例 18% | P0 |
| REF-HW-004 | 销售额达 $8,000 升级钻石（Diamond），返佣比例 20% | P0 |
| REF-HW-005 | 每月 10 号考核用户销售金额，不达标手动降级 | P0 |
| REF-HW-006 | 后台可手动修改用户等级，修改立即生效 | P1 |

### 3.2 订单状态流转

| 规则 ID | 规则描述 | 优先级 |
|---------|----------|--------|
| REF-HW-010 | 未支付订单不显示在返佣列表中 | P0 |
| REF-HW-011 | 下单成功/收货成功，订单状态为 Pending，返佣待入账 | P0 |
| REF-HW-012 | 下单 30 天后确认，待入账金额转为待分发金额 | P0 |
| REF-HW-013 | 退款订单新增退款记录，返佣金额为负数，待入账金额减少 | P0 |
| REF-HW-014 | 退款订单在列表中显示 Refunded 状态 | P0 |

### 3.3 奖励发放

| 规则 ID | 规则描述 | 优先级 |
|---------|----------|--------|
| REF-HW-020 | 每月 1 号 0 点对待分配奖励金额进行快照 | P0 |
| REF-HW-021 | 发放到用户填写的奖励接收地址，币种为 USDC | P0 |
| REF-HW-022 | 未填写接收地址的用户，奖励进入下个结算周期 | P0 |
| REF-HW-023 | 发放成功后在发放记录中显示 | P1 |

### 3.4 详情页展示

| 规则 ID | 规则描述 | 优先级 |
|---------|----------|--------|
| REF-HW-030 | 详情页提示硬件销售奖励需 30 天确认，点击关闭后下次不显示 | P1 |
| REF-HW-031 | 不关闭提示则每次进入都显示 | P1 |
| REF-HW-032 | 订单按时间倒序排列 | P0 |
| REF-HW-033 | 订单详情显示完整状态时间线（Order History） | P1 |

---

## 4. 链上奖励：合约（Perps）功能规则

### 4.1 Overview 统计区域

| 规则 ID | 规则描述 | 优先级 |
|---------|----------|--------|
| REF-PERPS-001 | Overview 展示 Undistributed reward / Volume / Invited addresses 三个卡片 | P0 |
| REF-PERPS-002 | Undistributed reward 为绿色数字，下方显示 Total: $X.XX | P0 |
| REF-PERPS-003 | Invited addresses 下方显示 From X Wallets | P1 |
| REF-PERPS-004 | Overview 数据不受 Undistributed/Total Tab 切换影响 | P0 |
| REF-PERPS-005 | Overview 数据随时间筛选和邀请码筛选变更而刷新 | P0 |

### 4.2 Details 列表

| 规则 ID | 规则描述 | 优先级 |
|---------|----------|--------|
| REF-PERPS-010 | Undistributed Tab 仅显示 rewards > 0 且未发放的记录 | P0 |
| REF-PERPS-011 | Total Tab 显示所有记录（待发放 + 已发放 + 未产生交易） | P0 |
| REF-PERPS-012 | Total Tab 显示 Hide zero volume 开关，默认开启 | P0 |
| REF-PERPS-013 | Hide zero volume 关闭后显示零交易量记录 | P1 |
| REF-PERPS-014 | 默认排序为 Volume 降序 | P0 |

### 4.3 筛选联动

| 规则 ID | 规则描述 | 优先级 |
|---------|----------|--------|
| REF-PERPS-020 | 时间筛选变更 → 刷新 Overview + 刷新列表 | P0 |
| REF-PERPS-021 | 邀请码筛选变更 → 刷新 Overview + 刷新列表 + Filter 图标变实心 | P0 |
| REF-PERPS-022 | Tab 切换 → 仅刷新列表，Overview 不变 | P0 |
| REF-PERPS-023 | Hide zero volume 切换 → 仅影响 Total Tab 列表 | P1 |

### 4.4 导出

| 规则 ID | 规则描述 | 优先级 |
|---------|----------|--------|
| REF-PERPS-030 | 导出当前筛选条件下的数据 | P0 |
| REF-PERPS-031 | 导出文件名包含日期范围和 Tab 类型 | P1 |
| REF-PERPS-032 | 导出字段：Address, Invited Time, Referral Code, Referral Code Remark, First Trade, Volume, Fee, Reward | P0 |
| REF-PERPS-033 | 导出不隐藏零交易量记录 | P1 |

### 4.5 返佣计算

| 规则 ID | 规则描述 | 优先级 |
|---------|----------|--------|
| REF-PERPS-040 | 开仓返佣 = 仓位金额 × builder fee × 10% | P0 |
| REF-PERPS-041 | 平仓返佣 = 仓位金额 × builder fee × 10% | P0 |
| REF-PERPS-042 | 限价单返佣 = 仓位金额 × builder fee × 10% | P0 |
| REF-PERPS-043 | 绑定前下单的金额不计入返佣 | P0 |

### 4.6 空状态

| 规则 ID | 规则描述 | 优先级 |
|---------|----------|--------|
| REF-PERPS-050 | 无邀请记录显示空状态：Start Earning Today + Copy & share link | P1 |
| REF-PERPS-051 | 筛选结果为空显示：No data for selected filters | P1 |

### 4.7 移动端交互

| 规则 ID | 规则描述 | 优先级 |
|---------|----------|--------|
| REF-PERPS-060 | 列表项点击展开/收起，同时只能展开一个 | P1 |
| REF-PERPS-061 | 支持下拉刷新 | P1 |
| REF-PERPS-062 | 支持上拉加载更多（分页） | P1 |

---

## 5. 通用详情页 Header 规则

### 5.1 时间选择器

| 规则 ID | 规则描述 | 优先级 |
|---------|----------|--------|
| REF-HDR-001 | 默认选择"全部时间"（2024-01-01 至今） | P0 |
| REF-HDR-002 | 支持快捷选项：今天、本周、昨日、本月、近30天、全部时间 | P1 |
| REF-HDR-003 | 未来日期置灰且不可选 | P1 |
| REF-HDR-004 | 今日日期用高亮边框标识，选中范围用黑色背景标识 | P2 |

### 5.2 排序

| 规则 ID | 规则描述 | 优先级 |
|---------|----------|--------|
| REF-HDR-010 | 排序切换顺序：默认 → 升序 → 降序 → 默认 | P1 |
| REF-HDR-011 | 排序图标：⇅（默认）/ ↑（升序）/ ↓（降序） | P2 |

---

## 6. 测试数据准备

### 6.1 返佣账户

| 账户 | 用途 |
|------|------|
| 自动升级 test-9228@privy.io（验证码 485414） | 有返佣数据的账户 |
| 手动升级 test-1352@privy.io（验证码 363555） | 后台手动升级等级的账户 |
| 空状态 test-2710@privy.io（验证码 045343） | 无返佣记录的账户 |
| ziying@bit668.com | 返佣主账户测试 |

### 6.2 钱包地址

| 地址 | 用途 |
|------|------|
| 0x4EF880525383ab4E3d94b7689e3146bF899A296e | 邀请人地址 |
| 0x13b30304dAa2129a21e42df663e8f49C49b276e8 | 被邀请人地址 |

---

## 7. 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-01-16 | v1.0 | 新增销售码追踪功能测试规则 |
| 2026-02-09 | v2.0 | 新增硬件销售奖励、链上奖励：合约（Perps）、通用 Header 规则 |
| 2026-02-09 | v2.1 | 更新硬件等级返佣比例：铜 10%、银 15%、金 18%、钻 20% |
