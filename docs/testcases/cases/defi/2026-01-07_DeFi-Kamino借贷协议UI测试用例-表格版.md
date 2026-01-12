# Kamino 借贷协议 UI 测试用例（表格版）

> **模块**：DeFi  
> **需求**：接入了 Kamino 的借贷协议  
> **来源**：Borrow 中 UI 部分计算逻辑与操作边界规范.doc  
> **日期**：2026-01-07

---

## 1. Supply（供应）功能测试

### 1.1 Refundable Fee 显示规则

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P1 | E2E | 1. 用户在 market 中未建立任何 supply 头寸<br>2. 钱包有可用余额（如 SOL: 100） | 1. 进入 Supply 页面<br>2. 选择资产（如 SOL）<br>3. 查看页面显示 | 1. 显示 "Refundable fee: 0.01 SOL ($0.01)"<br>2. Supply 按钮初始状态为禁用（金额为 0 时）<br>3. 断言 Refundable fee 字段存在且显示正确金额 |
| P1 | E2E | 1. 用户在 Market 中已经有 Supply 头寸<br>2. 钱包有可用余额 | 1. 进入 Supply 页面<br>2. 选择资产<br>3. 查看页面显示 | 1. 不显示 "Refundable fee" 字段<br>2. 断言 Refundable fee 字段不存在<br>3. 其他信息正常显示（My supply、Supply APY 等） |

---

### 1.2 Health Factor 显示规则

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P1 | E2E | 1. 用户只有 Supply，没有 debt<br>2. 钱包有可用余额 | 1. 进入 Supply 页面<br>2. 选择资产<br>3. 查看页面显示 | 1. 不显示 "Health factor" 字段<br>2. 断言 Health factor 字段不存在<br>3. 显示 "My supply"、"Supply APY" 等信息 |
| P1 | E2E | 1. 用户已有 debt（借款）<br>2. 钱包有可用余额（如 SOL: 100） | 1. 进入 Supply 页面<br>2. 选择资产<br>3. 输入供应金额（如 1 SOL）<br>4. 查看 Health Factor 变化 | 1. 显示 "Health factor: 1.49"（示例值，实际值根据计算）<br>2. 显示提示 "Liquidation at < 1.0"<br>3. 输入金额后，Health Factor 实时更新（如 1.49 -> 1.60）<br>4. My supply 显示变化（如 $200.01 -> $400.01）<br>5. 断言 Health Factor 数值变化符合预期 |

---

### 1.3 Supply Cap 超出警告

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P1 | E2E | 1. 资产触及 Supply cap: `totalSupply_X >= supplyCap_X * 99.9%`<br>2. 钱包有可用余额 | 1. 进入 Supply 页面<br>2. 输入超出 cap 的金额（如 1000）<br>3. 查看警告提示 | 1. 显示黄色警告 Banner："Supply cap exceeded"<br>2. 显示提示："Try reducing the amount or switching to a different reserve."<br>3. Supply 按钮禁用（灰色）<br>4. Overview card 不受影响<br>5. 断言警告 Banner 存在且颜色为黄色 |
| P1 | E2E | 1. 资产触及 Daily supply cap: `totalSupply_X_daily >= SupplyCap_X_daily * 99.9%`<br>2. 钱包有可用余额 | 1. 进入 Supply 页面<br>2. 输入超出 daily cap 的金额<br>3. 查看警告提示 | 1. 显示黄色警告 Banner："Daily supply cap exceeded"<br>2. 显示提示："Try reducing the amount or switching to a different reserve."<br>3. Supply 按钮禁用<br>4. 断言警告 Banner 存在且按钮状态为禁用 |

---

### 1.4 Supply 基础功能

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P1 | E2E | 1. 钱包有可用余额（如 SOL: 100.01） | 1. 进入 Supply 页面<br>2. 金额输入为 0.0<br>3. 输入金额 1<br>4. 点击 Max 按钮 | 1. 金额为 0 时，Supply 按钮禁用<br>2. 输入有效金额后，Supply 按钮启用（蓝色）<br>3. Max 按钮显示可用余额（如 "100.01 Max"）<br>4. 点击 Max 后，金额自动填充为最大可用值<br>5. 断言按钮状态变化正确 |
| P1 | E2E | 1. 钱包有可用余额<br>2. 支持多种资产（SOL、USDC 等） | 1. 进入 Supply 页面<br>2. 点击资产选择器<br>3. 查看资产列表<br>4. 选择不同资产 | 1. 显示资产选择弹窗<br>2. 列表显示：资产名称、Wallet Balance、Supplied、Supply APY<br>3. 可以切换不同资产<br>4. 选择资产后，页面信息更新<br>5. 断言资产列表数据正确 |
| P2 | E2E | 1. 钱包有可用余额 | 1. 进入 Supply 页面<br>2. 查看 "Use as collateral" 选项<br>3. 切换开关状态 | 1. 显示 "Use as collateral" 复选框<br>2. 默认状态为 "Enabled"（已勾选）<br>3. 可以切换启用/禁用状态<br>4. 断言开关状态可正确切换 |

---

## 2. Borrow（借贷）功能测试

### 2.1 Health Factor 显示规则

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P1 | E2E | 1. 用户无当前借款<br>2. 有可用的抵押品 | 1. 进入 Borrow 页面<br>2. 查看页面显示 | 1. 不显示 "Health factor" 字段<br>2. 断言 Health factor 字段不存在<br>3. 显示其他 Borrow 相关信息 |
| P1 | E2E | 1. 用户已有当前借款<br>2. 有可用的抵押品 | 1. 进入 Borrow 页面<br>2. 输入借贷金额（如 10 USDC）<br>3. 查看 Health Factor 显示 | 1. 显示 "Health factor: 1.60"（示例值）<br>2. 显示提示 "Liquidation at < 1.0"<br>3. 输入金额后，Health Factor 实时更新（如 1.80 -> 1.60）<br>4. My borrow 显示变化（如 $20.01 -> $30.01）<br>5. 断言 Health Factor 数值变化符合预期 |

---

### 2.2 Health Factor < 1.50 警告

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P1 | E2E | 1. 用户已有借款<br>2. Borrow 后 Health Factor >= 1.50 | 1. 进入 Borrow 页面<br>2. 输入借贷金额（如 10 USDC）<br>3. 查看 Health Factor 变化 | 1. Health Factor 显示变化（如 1.80 -> 1.60）<br>2. 不显示警告信息<br>3. Borrow 按钮可正常点击<br>4. 断言 Health Factor >= 1.50 且无警告 |
| P1 | E2E | 1. 用户已有借款<br>2. Borrow 后 Health Factor < 1.50 | 1. 进入 Borrow 页面<br>2. 输入借贷金额（如 50 USDC），使 Health Factor < 1.50<br>3. 查看警告提示<br>4. 点击 Borrow 按钮 | 1. 显示橙色警告文字："Borrowing this amount will reduce your health factor and increase risk of liquidation."<br>2. Health Factor 显示变化（如 1.60 -> 1.49，红色显示）<br>3. My borrow 显示变化（如 $10.01 -> $60.01）<br>4. 点击 Borrow 后，弹出确认对话框<br>5. 断言警告文字存在且颜色为橙色 |
| P1 | E2E | 1. 触发 Health Factor < 1.50 警告 | 1. 触发 Health Factor < 1.50 警告<br>2. 点击 Borrow 按钮<br>3. 查看确认对话框<br>4. 不勾选确认框，点击 Confirm | 1. 弹出 "Liquidation reminder" 对话框<br>2. 显示警告文字："Borrowing this amount will reduce your health factor and increase risk of liquidation."<br>3. 显示复选框："I acknowledge the risks involved"（未勾选）<br>4. Confirm 按钮禁用（灰色）<br>5. Cancel 按钮可用<br>6. 断言 Confirm 按钮状态为禁用 |
| P1 | E2E | 1. 触发 Health Factor < 1.50 警告 | 1. 触发 Health Factor < 1.50 警告<br>2. 点击 Borrow 按钮<br>3. 勾选确认框<br>4. 点击 Confirm | 1. 复选框已勾选<br>2. Confirm 按钮启用（深色/蓝色）<br>3. 可以点击 Confirm 提交交易<br>4. 断言 Confirm 按钮状态为启用 |

---

### 2.3 Borrow Cap 超出警告

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P1 | E2E | 1. 资产触及 Borrow cap: `totalBorrows_Y >= 99% * borrowCap_Y`<br>2. 有可用的抵押品 | 1. 进入 Borrow 页面<br>2. 输入超出 cap 的金额（如 1000 USDC）<br>3. 查看警告提示 | 1. 显示黄色警告 Banner："Borrow cap exceeded"<br>2. 显示提示："Try reducing the amount or switching to a different reserve."<br>3. Borrow 按钮禁用（灰色）<br>4. 断言警告 Banner 存在且按钮状态为禁用 |
| P1 | E2E | 1. 资产触及 Daily borrow cap: `Borrow cap total Borrows_Y_daily >= 99% * borrowCap_Y_daily`<br>2. 有可用的抵押品 | 1. 进入 Borrow 页面<br>2. 输入超出 daily cap 的金额<br>3. 查看警告提示 | 1. 显示黄色警告 Banner："Daily borrow cap exceeded"<br>2. 显示提示："Try reducing the amount or switching to a different reserve."<br>3. Borrow 按钮禁用<br>4. 断言警告 Banner 存在 |
| P1 | E2E | 1. 同时触及 Daily borrow cap 和 Borrow cap<br>2. 有可用的抵押品 | 1. 进入 Borrow 页面<br>2. 输入超出金额<br>3. 查看警告提示 | 1. 显示黄色警告 Banner："Daily borrow cap & borrow cap exceeded"<br>2. 显示提示："Try reducing the amount or switching to a different reserve."<br>3. Borrow 按钮禁用<br>4. 断言警告 Banner 包含两个 cap 信息 |
| P1 | E2E | 1. 可用流动性不足 | 1. 进入 Borrow 页面<br>2. 输入大额借贷金额（如 1000 USDC）<br>3. 查看警告提示 | 1. 显示黄色警告 Banner："Large borrows may need to be processed gradually due to insufficient liquidity."<br>2. Borrow 按钮仍可点击（如果其他条件满足）<br>3. 断言警告 Banner 存在 |

---

### 2.4 Borrow 基础功能

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P2 | E2E | 1. 有可用的抵押品 | 1. 进入 Borrow 页面<br>2. 查看信息显示顺序 | 1. 信息按重要性排序显示：<br>   1. 资产信息<br>   2. Borrow cap (changeable)<br>   3. 仓位和其他信息<br>   4. Health factor (changeable)<br>2. 断言信息顺序符合规范 |
| P1 | E2E | 1. 有可用的抵押品<br>2. 支持多种资产（USDC、USDT 等） | 1. 进入 Borrow 页面<br>2. 点击资产选择器<br>3. 查看资产列表<br>4. 选择不同资产 | 1. 显示资产选择弹窗<br>2. 列表显示：资产名称、Available、Borrowed、Borrow APY<br>3. 可以切换不同资产<br>4. 选择资产后，页面信息更新<br>5. 断言资产列表数据正确 |

---

## 3. Withdraw（提取）功能测试

### 3.1 无 Debt 时的 Withdraw

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P1 | E2E | 1. 用户只有 Supply，没有 debt<br>2. 有已存入的资产（如 SOL: 1） | 1. 进入 Withdraw 页面<br>2. 查看页面显示 | 1. 不显示 "Health factor" 字段<br>2. 显示 "My supply" 信息<br>3. 显示 "Available X.XX Safe max"<br>4. Withdraw 按钮可用<br>5. 断言 Health factor 字段不存在 |
| P1 | E2E | 1. 用户只有 Supply，没有 debt<br>2. 有已存入的资产（如 SOL: 1） | 1. 进入 Withdraw 页面<br>2. 输入提取金额（如 0.5 SOL）<br>3. 查看 My supply 变化<br>4. 点击 Withdraw 按钮 | 1. My supply 显示变化（如 $200.01 -> $100.01，0.5 SOL）<br>2. Withdraw 按钮可用<br>3. 可以正常提交交易<br>4. 断言 My supply 数值变化正确 |

---

### 3.2 有 Debt 时的 Withdraw

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P1 | E2E | 1. 用户已有 debt<br>2. Withdraw 后 Health Factor >= 1.50<br>3. 有已存入的资产 | 1. 进入 Withdraw 页面<br>2. 输入提取金额（如 0.5 SOL）<br>3. 查看 Health Factor 变化 | 1. 显示 Health Factor（如 1.60）<br>2. Health Factor 显示变化（如 1.60 -> 1.50）<br>3. 不显示警告信息<br>4. Withdraw 按钮可正常点击<br>5. 断言 Health Factor >= 1.50 且无警告 |
| P1 | E2E | 1. 用户已有 debt<br>2. Withdraw 后 Health Factor < 1.50<br>3. 有已存入的资产 | 1. 进入 Withdraw 页面<br>2. 输入提取金额（如 1 SOL），使 Health Factor < 1.50<br>3. 查看警告提示<br>4. 点击 Withdraw 按钮 | 1. 显示橙色警告文字："Withdrawing this amount will reduce your health factor and increase risk of liquidation."<br>2. Health Factor 显示变化（如 1.60 -> 1.49，红色显示）<br>3. My supply 显示变化（如 $200.01 -> $100.01，0.5 SOL）<br>4. 点击 Withdraw 后，弹出确认对话框<br>5. 断言警告文字存在且颜色为橙色 |
| P1 | E2E | 1. 触发 Health Factor < 1.50 警告 | 1. 触发 Health Factor < 1.50 警告<br>2. 点击 Withdraw 按钮<br>3. 查看确认对话框<br>4. 勾选确认框，点击 Confirm | 1. 弹出 "Liquidation reminder" 对话框<br>2. 显示警告文字："Withdrawing this amount will reduce your health factor and increase risk of liquidation."<br>3. 显示复选框："I acknowledge the risks involved"<br>4. 未勾选时，Confirm 按钮禁用<br>5. 勾选后，Confirm 按钮启用<br>6. 断言按钮状态变化正确 |

---

### 3.3 Withdraw Cap 超出警告

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P1 | E2E | 1. 资产触及 Withdraw cap: `totalWithdraw_Y >= 99% * withdrawCap_Y`<br>2. 有已存入的资产 | 1. 进入 Withdraw 页面<br>2. 输入超出 cap 的金额（如 0.5 SOL）<br>3. 查看警告提示 | 1. 显示黄色警告 Banner："Withdraw cap exceeded"<br>2. 显示提示："Try reducing the amount or switching to a different reserve."<br>3. Withdraw 按钮禁用（灰色）<br>4. 断言警告 Banner 存在且按钮状态为禁用 |
| P1 | E2E | 1. 资产触及 Daily withdraw cap: `totalWithdraw_Y_daily >= 99% * withdrawCap_Y_daily`<br>2. 有已存入的资产 | 1. 进入 Withdraw 页面<br>2. 输入超出 daily cap 的金额<br>3. 查看警告提示 | 1. 显示黄色警告 Banner："Daily withdraw cap exceeded"<br>2. 显示提示："Try reducing the amount or switching to a different reserve."<br>3. Withdraw 按钮禁用<br>4. 断言警告 Banner 存在 |
| P1 | E2E | 1. 同时触及 Daily withdraw cap 和 Withdraw cap<br>2. 有已存入的资产 | 1. 进入 Withdraw 页面<br>2. 输入超出金额<br>3. 查看警告提示 | 1. 显示黄色警告 Banner："Daily withdraw cap exceeded & withdraw cap exceeded"<br>2. 显示提示："Try reducing the amount or switching to a different reserve."<br>3. Withdraw 按钮禁用<br>4. 断言警告 Banner 包含两个 cap 信息 |
| P1 | E2E | 1. 可用流动性不足<br>2. 有已存入的资产 | 1. 进入 Withdraw 页面<br>2. 输入大额提取金额<br>3. 查看警告提示 | 1. 显示黄色警告 Banner："Large withdrawals may need to be processed gradually due to insufficient liquidity."<br>2. Withdraw 按钮仍可点击（如果其他条件满足）<br>3. 断言警告 Banner 存在 |

---

### 3.4 Withdraw 基础功能

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P1 | E2E | 1. 有已存入的资产<br>2. 支持多种资产 | 1. 进入 Withdraw 页面<br>2. 点击资产选择器<br>3. 查看资产列表<br>4. 选择不同资产 | 1. 显示资产选择弹窗<br>2. 列表显示：资产名称、Supplied 数量<br>3. 可以切换不同资产<br>4. 选择资产后，页面信息更新<br>5. 断言资产列表数据正确 |

---

## 4. Repay（还款）功能测试

### 4.1 使用 Wallet Balance 还款

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P1 | E2E | 1. 用户已有借款（如 USDC: 10）<br>2. 钱包有可用余额（如 USDC: 10.01） | 1. 进入 Repay 页面<br>2. 选择 "From wallet balance"<br>3. 查看页面显示 | 1. 显示 "From wallet balance" 标识<br>2. 显示 "Amount" 输入框（初始为 0.0）<br>3. 显示资产选择器（如 USDC）<br>4. 显示可用余额（如 "$10.01"）<br>5. 显示 Health Factor（如 1.50）<br>6. 显示 My borrow（如 $10.01）<br>7. Repay 按钮可用<br>8. 断言所有字段显示正确 |
| P1 | E2E | 1. 用户已有借款（如 USDC: 10）<br>2. 钱包有可用余额（如 USDC: 10.01） | 1. 进入 Repay 页面<br>2. 选择 "From wallet balance"<br>3. 输入还款金额（如 5 USDC）<br>4. 查看 Health Factor 和 My borrow 变化 | 1. Health Factor 显示变化（如 1.50 -> 1.60）<br>2. My borrow 显示变化（如 $10.01 -> $5.01）<br>3. Repay 按钮可用<br>4. 断言数值变化正确 |
| P1 | E2E | 1. 用户已有借款（如 USDC: 10）<br>2. 钱包有可用余额（如 USDC: 10.01） | 1. 进入 Repay 页面<br>2. 选择 "From wallet balance"<br>3. 输入全额还款金额（如 10 USDC）<br>4. 查看 Health Factor 和 My borrow 变化 | 1. Health Factor 显示变化（如 1.50 -> 100）<br>2. My borrow 显示变化（如 $10.01 -> $0.01）<br>3. Repay 按钮可用<br>4. 断言 Health Factor 接近或等于 100 |
| P1 | E2E | 1. 用户已有借款<br>2. 点击 Max 后，还款金额不足以开仓 | 1. 进入 Repay 页面<br>2. 选择 "From wallet balance"<br>3. 点击 Max 按钮<br>4. 查看警告提示 | 1. 显示红色警告文字："Repay with current balance is not enough. Repaying with your current balance will not be enough to open a position."<br>2. Repay 按钮仍可用（但交易可能失败）<br>3. 断言警告文字存在且颜色为红色 |

---

### 4.2 使用 Collateral 还款

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P1 | E2E | 1. 用户已有借款（如 USDC: 10）<br>2. 有可用抵押资产（如 SOL: 1.23） | 1. 进入 Repay 页面<br>2. 选择 "With Collateral"<br>3. 查看页面显示 | 1. 显示 "With Collateral" 标识<br>2. 显示还款资产输入（如 USDC，初始为 0.0）<br>3. 显示抵押资产输入（如 SOL，初始为 0.0）<br>4. 显示可用抵押资产（如 "1.23 SOL"）<br>5. 显示 Health Factor<br>6. 显示 My borrow<br>7. Repay 按钮可用<br>8. 断言所有字段显示正确 |
| P1 | E2E | 1. 用户已有借款（如 USDC: 10）<br>2. 有可用抵押资产（如 SOL: 1.23） | 1. 进入 Repay 页面<br>2. 选择 "With Collateral"<br>3. 输入还款金额（如 5 USDC）<br>4. 输入抵押资产金额（如 0.025 SOL）<br>5. 查看 Health Factor 和 My borrow 变化 | 1. Health Factor 显示变化（如 1.50 -> 1.60）<br>2. My borrow 显示变化（如 $10.01 -> $5.01）<br>3. Repay 按钮可用<br>4. 断言数值变化正确 |
| P1 | E2E | 1. 使用 Collateral 还款时，slippage 较大，导致 Health Factor 下降 | 1. 进入 Repay 页面<br>2. 选择 "With Collateral"<br>3. 输入还款金额和抵押资产金额<br>4. 查看警告提示 | 1. 显示警告文字："Repay with collateral is enabled, high slippage may worsen your health factor. Try to adjust the amount or switch to collateral type."<br>2. Health Factor 显示下降（如 1.50 -> 1.29）<br>3. Repay 按钮仍可用（但需用户确认风险）<br>4. 断言警告文字存在且 Health Factor 下降 |
| P2 | E2E | 1. 用户已有借款<br>2. 有可用抵押资产 | 1. 进入 Repay 页面<br>2. 选择 "With Collateral"<br>3. 输入还款金额和抵押资产金额<br>4. 勾选 "Use remaining collateral" 复选框<br>5. 查看页面变化 | 1. 显示 "Use remaining collateral" 复选框<br>2. 勾选后，使用所有剩余抵押资产<br>3. Health Factor 和 My borrow 相应更新<br>4. 断言复选框功能正常 |

---

### 4.3 Repay 基础功能

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P1 | E2E | 1. 用户已有借款<br>2. 支持多种资产（USDC、SOL、ETH、WBTC 等） | 1. 进入 Repay 页面<br>2. 点击资产选择器<br>3. 查看资产列表<br>4. 选择不同资产 | 1. 显示资产选择弹窗<br>2. 列表显示：USDC、SOL、ETH、WBTC 等资产<br>3. 显示资产百分比（如 "100%"）<br>4. 可以切换不同资产<br>5. 选择资产后，页面信息更新<br>6. 断言资产列表数据正确 |
| P1 | E2E | 1. 用户已有借款 | 1. 进入 Repay 页面<br>2. 在 "From wallet balance" 和 "With Collateral" 之间切换<br>3. 查看页面变化 | 1. 可以切换还款方式<br>2. 切换后，输入框和显示信息相应更新<br>3. 金额输入重置<br>4. 断言切换功能正常 |

---

## 5. 跨功能测试

### 5.1 平台兼容性

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P1 | E2E | 1. Desktop 平台<br>2. 有可用余额或已存入资产 | 1. 在 Desktop 平台打开 Supply/Borrow/Withdraw/Repay 页面<br>2. 检查所有功能显示 | 1. 所有功能正常显示<br>2. 布局适配 Desktop 屏幕<br>3. 交互操作正常<br>4. 断言页面布局正确 |
| P1 | E2E | 1. iOS 平台<br>2. 有可用余额或已存入资产 | 1. 在 iOS 平台打开 Supply/Borrow/Withdraw/Repay 页面<br>2. 检查所有功能显示 | 1. 所有功能正常显示<br>2. 布局适配 iOS 屏幕<br>3. 字体大小和 padding 符合移动端规范<br>4. 显示 "View reserve details" 链接（iOS 特有）<br>5. 交互操作正常<br>6. 断言页面布局和样式符合移动端规范 |

---

### 5.2 数据实时更新

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P1 | E2E | 1. 有可用余额或已存入资产<br>2. 有借款记录 | 1. 进入任意操作页面（Supply/Borrow/Withdraw/Repay）<br>2. 输入金额<br>3. 观察相关数据变化 | 1. Health Factor 实时更新<br>2. My supply/My borrow 实时更新<br>3. 所有计算字段实时响应输入变化<br>4. 断言更新延迟 < 100ms |

---

### 5.3 边界值测试

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P1 | E2E | 1. 有可用余额或已存入资产 | 1. 进入任意操作页面<br>2. 点击 Max 按钮<br>3. 查看金额填充和按钮状态 | 1. 金额自动填充为最大可用值<br>2. 按钮状态正确（根据 cap 等条件）<br>3. 相关数据正确计算<br>4. 断言金额填充正确 |
| P2 | E2E | 1. 有可用余额或已存入资产 | 1. 进入任意操作页面<br>2. 输入最小有效金额（如 0.000001）<br>3. 查看按钮状态和计算 | 1. 按钮状态正确<br>2. 数据计算正确<br>3. 无异常错误<br>4. 断言最小金额处理正确 |

---

### 5.4 错误处理

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P2 | E2E | 1. 网络连接断开 | 1. 断开网络连接<br>2. 进入任意操作页面<br>3. 尝试进行操作 | 1. 显示网络错误提示<br>2. 按钮禁用或显示错误状态<br>3. 不会导致应用崩溃<br>4. 断言错误提示存在 |
| P2 | E2E | 1. API 返回错误 | 1. 模拟 API 返回错误<br>2. 进入任意操作页面<br>3. 查看错误处理 | 1. 显示友好的错误提示<br>2. 提供重试机制<br>3. 不会导致应用崩溃<br>4. 断言错误处理正确 |

---

## 6. 性能测试

### 6.1 响应速度

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P2 | E2E | 1. 正常网络环境 | 1. 打开 Supply/Borrow/Withdraw/Repay 页面<br>2. 记录加载时间 | 1. 页面加载时间 < 2 秒<br>2. 数据加载时间 < 3 秒<br>3. 断言加载时间符合性能要求 |
| P2 | E2E | 1. 正常网络环境 | 1. 进入任意操作页面<br>2. 快速输入金额<br>3. 观察计算响应速度 | 1. 计算响应时间 < 100ms<br>2. 无卡顿现象<br>3. 断言响应时间符合性能要求 |

---

## 7. 自动化实施方案

### 7.1 单元测试（Unit）重点

1. **Health Factor 计算公式**
   - 测试公式：`Health Factor = (Total Collateral Value * Collateral Factor) / Total Borrow Value`
   - 测试边界值：HF < 1.0、HF < 1.50、HF >= 1.50
   - 测试精度：小数位数处理

2. **Cap 判断逻辑**
   - Supply Cap: `totalSupply_X >= supplyCap_X * 99.9%`
   - Borrow Cap: `totalBorrows_Y >= 99% * borrowCap_Y`
   - Withdraw Cap: `totalWithdraw_Y >= 99% * withdrawCap_Y`
   - 测试阈值边界（99.9% vs 99%）

3. **金额计算和格式化**
   - 最大可用金额计算
   - 金额精度处理
   - 实时计算节流（防抖）

### 7.2 端到端测试（E2E/API）重点

1. **需要 Mock 的核心数据**
   - WebSocket 实时价格更新
   - Health Factor 计算 API
   - Cap 状态查询 API
   - 资产余额查询 API

2. **关键拦截点**
   - Request Payload：金额、资产类型、操作类型
   - Response：Health Factor、Cap 状态、警告信息
   - 确认对话框交互流程

3. **测试数据准备**
   - 各种 Cap 场景的测试数据
   - 不同 Health Factor 状态的账户
   - 多资产组合场景

---

## 8. 测试数据准备

### 8.1 测试账户要求
- 账户有足够的测试资产（SOL、USDC 等）
- 账户可以创建 Supply 头寸
- 账户可以创建 Borrow 头寸
- 账户可以测试各种 Health Factor 场景

### 8.2 测试环境要求
- 测试网络：Kamino 测试网或主网
- 测试工具：浏览器开发者工具、网络抓包工具
- 测试数据：准备各种 Cap 场景的测试数据

---

## 9. 已知问题和风险

### 9.1 已知问题
- 待补充

### 9.2 风险提示
- Health Factor 计算精度问题
- Cap 判断的 99.9% 阈值可能因数据更新延迟导致不一致
- 实时价格波动可能影响计算结果

---

**文档版本**：v2.0（表格版）  
**最后更新**：2026-01-07  
**维护人员**：QA Team
