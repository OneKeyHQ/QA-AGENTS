# Hyperliquid - ApproveAgent 推荐绑定 Checkbox
> 生成时间：2026-01-04

## 1. Checkbox 显示条件（主流程）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 已登录<br>2. data.referredBy 为空<br>3. 可签名账户<br>4. accountValue > 0<br>5. withdrawable > 0 | 1. 进入 Hyperliquid 交易页面<br>2. 执行 ApproveAgent 操作 | 1. Checkbox 显示<br>2. Checkbox 状态=选中<br>3. 显示邀请码文案「1KREF」 |
| ❗️❗️P0❗️❗️ | 1. 已登录<br>2. data.referredBy 不为空（已绑定推荐人） | 1. 进入 Hyperliquid 交易页面<br>2. 执行 ApproveAgent 操作 | 1. Checkbox 不显示<br>2. 推荐绑定相关文案不显示 |
| ❗️❗️P0❗️❗️ | 1. 已登录<br>2. data.referredBy 为空<br>3. 执行非 ApproveAgent 操作（普通交易、转账等） | 1. 进入 Hyperliquid 交易页面<br>2. 执行普通交易操作 | 1. Checkbox 不显示<br>2. 推荐绑定相关文案不显示 |
| ❗️❗️P0❗️❗️ | 1. 已登录<br>2. Watch-only 账户<br>3. data.referredBy 为空 | 1. 切换到 Watch-only 账户<br>2. 执行 ApproveAgent 操作 | 1. Checkbox 不显示<br>2. 推荐绑定相关文案不显示 |
| ❗️❗️P0❗️❗️ | 1. 已登录<br>2. accountValue = 0 或 withdrawable = 0 | 1. 切换到余额为 0 的账户<br>2. 执行 ApproveAgent 操作 | 1. Checkbox 不显示<br>2. 推荐绑定相关文案不显示 |

---

## 2. Checkbox 默认状态与交互

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 满足显示条件<br>2. 首次进入 ApproveAgent 操作 | 1. 进入 ApproveAgent 操作页面 | 1. Checkbox 显示<br>2. Checkbox 状态=选中 |
| ❗️❗️P0❗️❗️ | 1. 满足显示条件<br>2. Checkbox 已显示 | 1. 点击 Checkbox 取消勾选<br>2. 关闭页面<br>3. 再次进入 ApproveAgent 操作页面 | 1. Checkbox 状态=未选中<br>2. 不再自动勾选 |
| ❗️❗️P0❗️❗️ | 1. 满足显示条件<br>2. 硬件钱包场景 | 1. Checkbox 默认勾选<br>2. 点击确认<br>3. 硬件钱包拒绝签名<br>4. 再次进入 ApproveAgent 操作页面 | 1. Checkbox 状态=未选中<br>2. 不再自动勾选 |
| P1 | 1. 满足显示条件<br>2. Checkbox 勾选状态 | 1. 点击「确认」并完成签名 | 1. 交易提交<br>2. 推荐绑定字段包含邀请码「1KREF」 |

---

## 3. 多账户切换场景

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 账户A：data.referredBy 为空，满足显示条件<br>2. 账户B：data.referredBy 不为空 | 1. 使用账户A进入 ApproveAgent 操作页面<br>2. 切换到账户B<br>3. 进入 ApproveAgent 操作页面 | 1. 账户A：Checkbox 显示<br>2. 账户B：Checkbox 不显示<br>3. 每个账户独立判断 |
| ❗️❗️P0❗️❗️ | 1. 账户A：data.referredBy 为空，用户已取消勾选<br>2. 账户B：data.referredBy 为空，未操作过 | 1. 使用账户A取消勾选 Checkbox<br>2. 切换到账户B<br>3. 进入 ApproveAgent 操作页面 | 1. 账户A：Checkbox 状态=未选中<br>2. 账户B：Checkbox 状态=选中<br>3. 每个账户取消状态独立存储 |
| P1 | 1. 多个账户：部分满足显示条件，部分不满足 | 1. 依次切换到每个账户<br>2. 执行 ApproveAgent 操作 | 1. 满足条件的账户：Checkbox 显示<br>2. 不满足条件的账户：Checkbox 不显示<br>3. 状态判断逻辑独立 |

---

## 4. i18n 与文案验证

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| P1 | 1. 满足显示条件<br>2. 语言=中文 | 1. 切换语言为中文<br>2. 进入 ApproveAgent 操作页面 | 1. Checkbox 文案显示中文<br>2. 文案内容与 i18n key wallet::use_onekey_hl_discount 一致 |
| P1 | 1. 满足显示条件<br>2. 语言=英文 | 1. 切换语言为英文<br>2. 进入 ApproveAgent 操作页面 | 1. Checkbox 文案显示英文<br>2. 文案内容与 i18n key wallet::use_onekey_hl_discount 一致 |
| P1 | 1. 满足显示条件 | 1. 进入 ApproveAgent 操作页面<br>2. 查看邀请码显示 | 1. 邀请码元素存在<br>2. 邀请码文本=「1KREF」<br>3. 邀请码文案与 Checkbox 在同一区域 |

---

## 5. 边界与异常场景

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| P1 | 1. 满足显示条件<br>2. 频繁操作 | 1. 连续多次进入 ApproveAgent 操作页面（5次） | 1. 每次进入时 Checkbox 显示<br>2. 首次进入状态=选中<br>3. 用户未取消过则保持选中<br>4. 用户已取消过则保持未选中 |
| P2 | 1. 满足显示条件<br>2. 网络异常 | 1. 进入 ApproveAgent 操作页面<br>2. 模拟网络断开 | 1. Checkbox 显示状态不受网络影响<br>2. 网络恢复后状态保持一致 |
| P2 | 1. 满足显示条件<br>2. 页面刷新 | 1. 取消勾选 Checkbox<br>2. 刷新页面<br>3. 再次进入 ApproveAgent 操作页面 | 1. 用户取消状态仍被记录<br>2. Checkbox 状态=未选中 |
