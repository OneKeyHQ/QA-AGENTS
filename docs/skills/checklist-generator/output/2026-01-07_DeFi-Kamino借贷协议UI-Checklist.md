# DeFi - Kamino 借贷协议 UI 测试 Checklist

> 生成时间：2026-01-07  
> 来源用例：`docs/requirements/DeFi-Kamino借贷协议UI规范.md`
> 
> **执行模式说明**：
> - `smoke` / `smoke-fast`：只执行 [P0] 标记的核心场景（约 20%）
> - `smoke-full`：执行所有场景（P0/P1/P2）

## 前置条件
- [ ] 浏览器已打开，可访问 DeFi 模块
- [ ] Kamino 借贷协议页面已加载完成
- [ ] 用户钱包已连接，有足够的测试资产
- [ ] 网络连接正常
- [ ] 准备测试场景：无 Debt 账户、有 Debt 账户、接近 Cap 限制的资产

## 操作步骤

### 场景1：Supply（供应）功能测试

#### 1.1 Refundable Fee 显示逻辑
- [P0] (a) 首次进入 Supply 页面（无任何 Supply 头寸），验证显示 "Refundable fee: X.XX SOL ($X.XX)"，费用金额计算正确，显示格式符合规范
- [P0] (b) 已有 Supply 头寸的情况下进入 Supply 页面，验证不显示 Refundable fee，页面布局正常无空白区域

#### 1.2 Health Factor 显示逻辑
- [P0] (a) 无 Debt 状态下进入 Supply 页面，验证不显示 Health Factor，页面布局正常
- [P0] (b) 有 Debt 状态下进入 Supply 页面，验证显示 Health Factor，数值计算正确（如：1.49、1.60），实时更新（输入金额后 HF 值变化）

#### 1.3 Supply Cap 超出警告
- [P0] (a) 当 `totalSupply_X >= supplyCap_X * 99.9%` 时，验证显示黄色 Banner："Supply cap exceeded"，提示文字："Try reducing the amount or switching to a different reserve."，Supply 按钮禁用
- [P0] (b) 当 `totalSupply_X_daily >= SupplyCap_X_daily * 99.9%` 时，验证显示黄色 Banner："Daily supply cap exceeded"，提示文字正确，Supply 按钮禁用
- [P1] (c) 输入金额后接近但未达到 Cap 阈值（如 99.8%），验证不显示警告，Supply 按钮可用
- [P1] (d) 输入金额后刚好达到 Cap 阈值（99.9%），验证显示警告，按钮禁用，减少金额后警告消失，按钮恢复可用

#### 1.4 Supply 实时计算
- [P1] (a) 输入 Supply 金额，验证实时显示预计收益、Health Factor 变化（如有 Debt），计算准确
- [P1] (b) 输入最大可用金额（Max），验证金额填充正确，计算准确，无超出限制
- [P2] (c) 输入极小金额（接近最小值），验证金额接受，计算准确，无精度问题

---

### 场景2：Borrow（借贷）功能测试

#### 2.1 Health Factor 显示逻辑
- [P0] (a) 无当前借款状态下进入 Borrow 页面，验证不显示 Health Factor，页面布局正常
- [P0] (b) 已有当前借款状态下进入 Borrow 页面，验证显示 Health Factor，数值计算正确，实时更新（输入金额后 HF 值变化，如：1.80 -> 1.60）

#### 2.2 Health Factor < 1.50 警告
- [P0] (a) 输入 Borrow 金额后，如果 Health Factor < 1.50，验证显示橙色警告文字："Borrowing this amount will reduce your health factor and increase risk of liquidation."，Health Factor 红色显示（如：1.60 -> 1.49），Borrow 按钮仍可点击
- [P0] (b) 点击 Borrow 按钮后 HF < 1.50，验证弹出确认对话框："Liquidation reminder"，对话框内容完整，必须勾选 "I acknowledge the risks involved" 后 Confirm 按钮才可点击，未勾选时 Confirm 按钮禁用
- [P1] (c) 在确认对话框中勾选确认框，验证 Confirm 按钮变为可用状态，点击 Confirm 后提交交易
- [P1] (d) 在确认对话框中点击取消或关闭，验证对话框关闭，返回 Borrow 页面，未提交交易

#### 2.3 Borrow Cap 超出警告
- [P0] (a) 当 `totalBorrows_Y >= 99% * borrowCap_Y` 时，验证显示黄色 Banner："Borrow cap exceeded"，提示文字："Try reducing the amount or switching to a different reserve."，Borrow 按钮禁用
- [P0] (b) 当 `totalBorrows_Y_daily >= 99% * borrowCap_Y_daily` 时，验证显示黄色 Banner："Daily borrow cap exceeded"，提示文字正确，Borrow 按钮禁用
- [P1] (c) 输入金额后接近但未达到 Cap 阈值（如 98.9%），验证不显示警告，Borrow 按钮可用
- [P1] (d) 输入金额后刚好达到 Cap 阈值（99%），验证显示警告，按钮禁用，减少金额后警告消失，按钮恢复可用

#### 2.4 可用流动性不足警告
- [P1] (a) 当可用流动性不足时，验证显示黄色 Banner："Large borrows may need to be processed gradually due to insufficient liquidity."，Borrow 按钮仍可点击（如果其他条件满足），警告不影响正常操作流程

#### 2.5 Borrow 实时计算
- [P1] (a) 输入 Borrow 金额，验证实时显示预计利息、Health Factor 变化，计算准确
- [P1] (b) 输入最大可借金额（Max），验证金额填充正确，计算准确，无超出限制
- [P2] (c) 输入极小金额（接近最小值），验证金额接受，计算准确，无精度问题

---

### 场景3：Withdraw（提取）功能测试

#### 3.1 无 Debt 时的 Withdraw
- [P0] (a) 无 Debt 状态下进入 Withdraw 页面，验证不显示 Health Factor，显示 My supply、Available 等信息，Withdraw 按钮可用

#### 3.2 有 Debt 时的 Withdraw
- [P0] (a) 有 Debt 状态下进入 Withdraw 页面，验证显示 Health Factor，数值计算正确，实时更新（输入金额后 HF 值变化，如：1.60 -> 1.50）

#### 3.3 Health Factor < 1.50 警告
- [P0] (a) 输入 Withdraw 金额后，如果 Health Factor < 1.50，验证显示橙色警告文字："Withdrawing this amount will reduce your health factor and increase risk of liquidation."，Health Factor 红色显示（如：1.60 -> 1.49），Withdraw 按钮仍可点击
- [P0] (b) 点击 Withdraw 按钮后 HF < 1.50，验证弹出确认对话框："Liquidation reminder"，对话框内容完整，必须勾选 "I acknowledge the risks involved" 后 Confirm 按钮才可点击，未勾选时 Confirm 按钮禁用
- [P1] (c) 在确认对话框中勾选确认框，验证 Confirm 按钮变为可用状态，点击 Confirm 后提交交易
- [P1] (d) 在确认对话框中点击取消或关闭，验证对话框关闭，返回 Withdraw 页面，未提交交易

#### 3.4 Withdraw Cap 超出警告
- [P0] (a) 当 `totalWithdraw_Y >= 99% * withdrawCap_Y` 时，验证显示黄色 Banner："Withdraw cap exceeded"，提示文字："Try reducing the amount or switching to a different reserve."，Withdraw 按钮禁用
- [P0] (b) 当 `totalWithdraw_Y_daily >= 99% * withdrawCap_Y_daily` 时，验证显示黄色 Banner："Daily withdraw cap exceeded"，提示文字正确，Withdraw 按钮禁用
- [P1] (c) 输入金额后接近但未达到 Cap 阈值（如 98.9%），验证不显示警告，Withdraw 按钮可用
- [P1] (d) 输入金额后刚好达到 Cap 阈值（99%），验证显示警告，按钮禁用，减少金额后警告消失，按钮恢复可用

#### 3.5 Withdraw 实时计算
- [P1] (a) 输入 Withdraw 金额，验证实时显示预计提取金额、Health Factor 变化（如有 Debt），计算准确
- [P1] (b) 输入最大可用金额（Max），验证金额填充正确，计算准确，无超出限制
- [P2] (c) 输入极小金额（接近最小值），验证金额接受，计算准确，无精度问题

---

### 场景4：Repay（还款）功能测试

#### 4.1 使用 Wallet Balance 还款
- [P0] (a) 选择使用 Wallet Balance 还款，验证显示 "From wallet balance" 标识，显示可用余额、Health Factor、My borrow，实时计算更新
- [P0] (b) 输入还款金额，验证实时显示还款后剩余债务、Health Factor 变化，计算准确
- [P0] (c) 当余额不足时，验证显示红色警告："Repay with current balance is not enough..."，警告文字清晰，Repay 按钮禁用或显示不可用状态
- [P1] (d) 输入最大可用余额（Max），验证金额填充正确，计算准确，无超出限制
- [P1] (e) 输入部分还款金额，验证计算正确，显示剩余债务，Health Factor 提升（如适用）

#### 4.2 使用 Collateral 还款
- [P0] (a) 选择使用 Collateral 还款，验证显示 "With Collateral" 标识，显示还款资产输入框和抵押资产输入框，显示可用抵押资产列表
- [P0] (b) 选择抵押资产并输入金额，验证实时计算还款金额、Health Factor 变化，计算准确
- [P1] (c) 当存在高 Slippage 时，验证显示警告文字："Repay with collateral is enabled, high slippage may worsen your health factor..."，Health Factor 可能下降（如：1.50 -> 1.29），警告显示正确
- [P1] (d) 如果使用抵押品偿还债务导致 Health Factor 上升，验证拒绝兑换，显示相应提示，操作不执行
- [P2] (e) 测试不同抵押资产组合，验证计算准确，警告显示正确，操作流程正常

#### 4.3 使用剩余 Collateral
- [P1] (a) 验证提供 "Use remaining collateral" 复选框，勾选后自动填充所有剩余抵押资产，金额计算正确
- [P1] (b) 勾选 "Use remaining collateral" 后，验证显示预计还款金额、Health Factor 变化，计算准确
- [P2] (c) 勾选后取消勾选，验证金额清空或恢复，计算重置正确

#### 4.4 Repay 实时计算
- [P1] (a) 切换还款方式（Wallet Balance / Collateral），验证界面切换正确，计算重置，显示相应信息
- [P1] (b) 输入还款金额，验证实时显示还款后状态，计算准确
- [P2] (c) 测试边界值（最小还款金额、最大可用金额），验证计算准确，无精度问题

---

### 场景5：通用规则测试

#### 5.1 按钮状态规则
- [P0] (a) 金额为 0 时，验证所有操作按钮（Supply/Borrow/Withdraw/Repay）禁用，按钮状态正确
- [P0] (b) 输入有效金额后，验证按钮变为可用状态，可点击
- [P0] (c) 超出 Cap 限制时，验证相应按钮禁用，状态正确
- [P1] (d) Health Factor < 1.50 时（Borrow/Withdraw），验证按钮仍可用，但需确认对话框，状态正确

#### 5.2 警告 Banner 颜色
- [P0] (a) Cap 超出警告（Supply/Borrow/Withdraw），验证显示黄色 Banner，颜色符合规范
- [P0] (b) Health Factor < 1.50 警告（Borrow/Withdraw），验证显示橙色警告文字，颜色符合规范
- [P0] (c) 余额不足警告（Repay），验证显示红色警告，颜色符合规范
- [P1] (d) 高 Slippage 警告（Repay with Collateral），验证显示警告文字，样式符合规范

#### 5.3 Cap 判断阈值准确性
- [P1] (a) 测试 Supply Cap 阈值（99.9%），验证在 99.9% 时触发警告，99.8% 时不触发，阈值判断准确
- [P1] (b) 测试 Daily Supply Cap 阈值（99.9%），验证阈值判断准确
- [P1] (c) 测试 Borrow Cap 阈值（99%），验证在 99% 时触发警告，98.9% 时不触发，阈值判断准确
- [P1] (d) 测试 Daily Borrow Cap 阈值（99%），验证阈值判断准确
- [P1] (e) 测试 Withdraw Cap 阈值（99%），验证阈值判断准确
- [P1] (f) 测试 Daily Withdraw Cap 阈值（99%），验证阈值判断准确

#### 5.4 Health Factor 计算准确性
- [P0] (a) 验证 Health Factor 计算公式正确：`Health Factor = (Total Collateral Value * Collateral Factor) / Total Borrow Value`
- [P0] (b) 测试不同场景下的 Health Factor 计算（Supply/Borrow/Withdraw/Repay），验证计算准确，实时更新正确
- [P1] (c) 测试 Health Factor 临界值（1.50），验证在 1.50 时不显示警告，< 1.50 时显示警告，阈值判断准确
- [P1] (d) 测试 Health Factor < 1.0 的情况，验证显示相应警告或提示

---

### 场景6：平台差异测试

#### 6.1 Desktop 平台
- [P1] (a) 在 Desktop 平台测试所有功能，验证标准布局正常，所有功能正常显示，交互流畅
- [P2] (b) 测试不同屏幕尺寸（1920x1080、2560x1440），验证布局自适应，显示正常

#### 6.2 iOS 平台
- [P1] (a) 在 iOS 平台测试所有功能，验证移动端样式调整正确，显示 "View reserve details" 链接（iOS 特有），其他功能与 Desktop 一致
- [P1] (b) 测试 iOS 手势操作（如适用），验证手势响应正常，交互流畅
- [P2] (c) 测试不同 iOS 设备尺寸（iPhone、iPad），验证布局自适应，显示正常

---

### 场景7：交互流程完整性测试

#### 7.1 Supply 流程
- [P0] (a) 完整执行 Supply 流程：进入页面 → 判断是否有 Supply 头寸（显示/隐藏 Refundable fee）→ 判断是否有 debt（显示/隐藏 Health Factor）→ 用户输入金额 → 实时计算 → 判断是否超出 Cap → 显示警告/禁用按钮 → 点击 Supply → 提交交易，验证流程完整，无遗漏步骤
- [P1] (b) 测试流程中断场景（如网络断开、用户取消），验证状态恢复正确，无数据丢失

#### 7.2 Borrow 流程
- [P0] (a) 完整执行 Borrow 流程：进入页面 → 判断是否有当前借款（显示/隐藏 Health Factor）→ 用户输入金额 → 实时计算 → 判断 HF < 1.50？→ 显示警告 → 判断是否超出 Cap → 显示警告/禁用按钮 → 点击 Borrow → HF < 1.50？弹出确认对话框 → 勾选确认框 → 点击 Confirm → 提交交易，验证流程完整，无遗漏步骤
- [P1] (b) 测试流程中断场景，验证状态恢复正确，确认对话框正确处理

#### 7.3 Withdraw 流程
- [P0] (a) 完整执行 Withdraw 流程：进入页面 → 判断是否有 debt（显示/隐藏 Health Factor）→ 用户输入金额 → 实时计算 → 判断 HF < 1.50？→ 显示警告 → 判断是否超出 Cap → 显示警告/禁用按钮 → 点击 Withdraw → HF < 1.50？弹出确认对话框 → 勾选确认框 → 点击 Confirm → 提交交易，验证流程完整，无遗漏步骤
- [P1] (b) 测试流程中断场景，验证状态恢复正确，确认对话框正确处理

#### 7.4 Repay 流程
- [P0] (a) 完整执行 Repay 流程（Wallet Balance）：进入页面 → 选择还款方式 → 用户输入金额 → 实时计算 → 判断余额不足？→ 显示警告 → 点击 Repay → 提交交易，验证流程完整，无遗漏步骤
- [P0] (b) 完整执行 Repay 流程（Collateral）：进入页面 → 选择还款方式（Collateral）→ 选择抵押资产 → 用户输入金额 → 实时计算 → 判断高 Slippage？→ 显示警告 → 点击 Repay → 提交交易，验证流程完整，无遗漏步骤
- [P1] (c) 测试流程中断场景，验证状态恢复正确，切换还款方式时状态重置正确

---

### 场景8：边界与异常场景测试

#### 8.1 金额边界值
- [P1] (a) 测试最小金额输入，验证金额接受，计算准确，无精度问题
- [P1] (b) 测试最大金额输入（Max），验证金额填充正确，计算准确，无超出限制
- [P2] (c) 测试极端大金额输入，验证显示相应警告或限制，操作不执行
- [P2] (d) 测试负数金额输入，验证不接受或显示错误提示

#### 8.2 Health Factor 边界值
- [P1] (a) 测试 Health Factor 刚好等于 1.50，验证不显示警告，操作正常
- [P1] (b) 测试 Health Factor 刚好等于 1.49，验证显示警告，弹出确认对话框
- [P2] (c) 测试 Health Factor < 1.0，验证显示相应警告或提示，操作可能被限制
- [P2] (d) 测试 Health Factor 极高值（如 > 10），验证显示正常，计算准确

#### 8.3 Cap 边界值
- [P1] (a) 测试刚好达到 Cap 阈值（99.9% / 99%），验证显示警告，按钮禁用
- [P1] (b) 测试刚好低于 Cap 阈值（99.8% / 98.9%），验证不显示警告，按钮可用
- [P2] (c) 测试超过 Cap 限制，验证显示警告，按钮禁用，操作不执行

#### 8.4 网络异常与容错
- [P1] (a) 点击操作按钮后立即断开网络，验证显示网络错误提示，状态回滚到操作前状态，提供重试按钮或自动重试机制
- [P2] (b) 断开网络后点击操作按钮，验证显示网络错误提示，操作不执行，恢复网络后可正常操作
- [P2] (c) Mock API 返回 500 错误，执行操作，验证显示错误提示，状态不改变，提供重试入口
- [P2] (d) 模拟弱网环境（延迟 > 3s），执行操作，验证显示加载状态，操作完成后状态正确更新，无重复请求

#### 8.5 并发操作
- [P2] (a) 快速连续点击操作按钮，验证防抖生效，仅执行最后一次操作，无重复提交
- [P2] (b) 同时打开多个标签页，在一个标签页执行操作，验证其他标签页状态同步（如适用）

---

## 关键断言点
- [ ] [场景1完成后] Supply 功能正常，Refundable Fee 显示逻辑正确，Health Factor 显示逻辑正确，Cap 超出警告正确，实时计算准确
- [ ] [场景2完成后] Borrow 功能正常，Health Factor 显示逻辑正确，HF < 1.50 警告和确认对话框正常，Cap 超出警告正确，实时计算准确
- [ ] [场景3完成后] Withdraw 功能正常，无 Debt/有 Debt 状态显示正确，HF < 1.50 警告和确认对话框正常，Cap 超出警告正确，实时计算准确
- [ ] [场景4完成后] Repay 功能正常，Wallet Balance 还款正常，Collateral 还款正常，高 Slippage 警告正确，实时计算准确
- [ ] [场景5完成后] 通用规则正确，按钮状态规则正确，警告 Banner 颜色符合规范，Cap 判断阈值准确，Health Factor 计算准确
- [ ] [场景6完成后] 平台差异处理正确，Desktop 和 iOS 平台显示正常
- [ ] [场景7完成后] 交互流程完整，无遗漏步骤，流程中断场景处理正确
- [ ] [场景8完成后] 边界场景处理正确，异常情况有适当提示，状态不丢失，网络异常处理正确

---

## 优先级统计

| 优先级 | 场景数 | 占比 | 执行模式 |
|--------|--------|------|----------|
| P0 | 25 | 25% | smoke / smoke-fast / smoke-full |
| P1 | 45 | 45% | smoke-full |
| P2 | 30 | 30% | smoke-full |
| **总计** | **100** | **100%** | - |

**快速模式（smoke）执行范围**：
- 场景1.1(a,b)、场景1.2(a,b)、场景1.3(a,b)
- 场景2.1(a,b)、场景2.2(a,b)、场景2.3(a,b)
- 场景3.1(a)、场景3.2(a)、场景3.3(a,b)、场景3.4(a,b)
- 场景4.1(a,b,c)、场景4.2(a,b,c)、场景4.3(a)
- 场景5.1(a,b,c)、场景5.2(a,b,c)、场景5.4(a,b)
- 场景7.1(a)、场景7.2(a)、场景7.3(a)、场景7.4(a,b)
