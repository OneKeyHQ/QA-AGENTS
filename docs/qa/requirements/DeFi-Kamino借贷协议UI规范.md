# Kamino 借贷协议 UI 计算逻辑与操作边界规范

> **模块**：DeFi  
> **需求**：接入了 Kamino 的借贷协议  
> **日期**：2026-01-07

---

## 核心规则速查

### Health Factor 显示规则

| 功能 | 无 Debt | 有 Debt | < 1.50 警告 |
|------|---------|---------|------------|
| Supply | 不显示 | 显示 | - |
| Borrow | 不显示 | 显示 | 警告+确认对话框 |
| Withdraw | 不显示 | 显示 | 警告+确认对话框 |
| Repay | 显示 | 显示 | - |

---

## 1. Supply（供应）功能

### 1.1 Refundable Fee 显示

**规则**：
- **首次 Supply**：显示 "Refundable fee: X.XX SOL ($X.XX)"
- **已有 Supply 头寸**：不显示 Refundable fee

### 1.2 Health Factor 显示

**规则**：
- **无 Debt**：不显示 Health Factor
- **有 Debt**：显示 Health Factor，实时更新（如：1.49 -> 1.60）

### 1.3 Supply Cap 超出警告

**触发条件**：
- `totalSupply_X >= supplyCap_X * 99.9%`
- `totalSupply_X_daily >= SupplyCap_X_daily * 99.9%`

**显示内容**：
- 黄色 Banner："Supply cap exceeded" 或 "Daily supply cap exceeded"
- 提示："Try reducing the amount or switching to a different reserve."
- **Supply 按钮禁用**

---

## 2. Borrow（借贷）功能

### 2.1 Health Factor 显示

**规则**：
- **无当前借款**：不显示 Health Factor
- **已有当前借款**：显示 Health Factor，实时更新（如：1.80 -> 1.60）

### 2.2 Health Factor < 1.50 警告

**触发条件**：
- Borrow 后 Health Factor < 1.50

**显示内容**：
- 橙色警告文字："Borrowing this amount will reduce your health factor and increase risk of liquidation."
- Health Factor 红色显示（如：1.60 -> 1.49）

**交互流程**：
1. 点击 Borrow 按钮
2. 弹出确认对话框："Liquidation reminder"
3. 必须勾选 "I acknowledge the risks involved"
4. Confirm 按钮才可点击

### 2.3 Borrow Cap 超出警告

**触发条件**：
- `totalBorrows_Y >= 99% * borrowCap_Y`
- `totalBorrows_Y_daily >= 99% * borrowCap_Y_daily`

**显示内容**：
- 黄色 Banner："Borrow cap exceeded" 或 "Daily borrow cap exceeded"
- 提示："Try reducing the amount or switching to a different reserve."
- **Borrow 按钮禁用**

### 2.4 可用流动性不足警告

**显示内容**：
- 黄色 Banner："Large borrows may need to be processed gradually due to insufficient liquidity."
- Borrow 按钮仍可点击（如果其他条件满足）

---

## 3. Withdraw（提取）功能

### 3.1 无 Debt 时的 Withdraw

**规则**：
- 不显示 Health Factor
- 显示 My supply、Available 等信息
- Withdraw 按钮可用

### 3.2 有 Debt 时的 Withdraw

**规则**：
- 显示 Health Factor
- 实时更新（如：1.60 -> 1.50）

### 3.3 Health Factor < 1.50 警告

**触发条件**：
- Withdraw 后 Health Factor < 1.50

**显示内容**：
- 橙色警告文字："Withdrawing this amount will reduce your health factor and increase risk of liquidation."
- Health Factor 红色显示（如：1.60 -> 1.49）

**交互流程**：
1. 点击 Withdraw 按钮
2. 弹出确认对话框："Liquidation reminder"
3. 必须勾选 "I acknowledge the risks involved"
4. Confirm 按钮才可点击

### 3.4 Withdraw Cap 超出警告

**触发条件**：
- `totalWithdraw_Y >= 99% * withdrawCap_Y`
- `totalWithdraw_Y_daily >= 99% * withdrawCap_Y_daily`

**显示内容**：
- 黄色 Banner："Withdraw cap exceeded" 或 "Daily withdraw cap exceeded"
- 提示："Try reducing the amount or switching to a different reserve."
- **Withdraw 按钮禁用**

---

## 4. Repay（还款）功能

### 4.1 使用 Wallet Balance 还款

**显示内容**：
- "From wallet balance" 标识
- 显示可用余额、Health Factor、My borrow
- 实时计算更新

**警告**：
- 余额不足时显示红色警告："Repay with current balance is not enough..."

### 4.2 使用 Collateral 还款

**显示内容**：
- "With Collateral" 标识
- 还款资产输入 + 抵押资产输入
- 显示可用抵押资产

**高 Slippage 警告**：
- 警告文字："Repay with collateral is enabled, high slippage may worsen your health factor..."
- Health Factor 可能下降（如：1.50 -> 1.29）

**拒绝规则**：
- 如果使用抵押品偿还债务导致 Health Factor **上升**时，拒绝兑换

### 4.3 使用剩余 Collateral

**功能**：
- 提供 "Use remaining collateral" 复选框
- 勾选后使用所有剩余抵押资产

---

## 5. 通用规则

### 5.1 Cap 判断阈值

| Cap 类型 | 阈值 | 公式 |
|---------|------|------|
| Supply Cap | 99.9% | `totalSupply_X >= supplyCap_X * 99.9%` |
| Daily Supply Cap | 99.9% | `totalSupply_X_daily >= SupplyCap_X_daily * 99.9%` |
| Borrow Cap | 99% | `totalBorrows_Y >= 99% * borrowCap_Y` |
| Daily Borrow Cap | 99% | `totalBorrows_Y_daily >= 99% * borrowCap_Y_daily` |
| Withdraw Cap | 99% | `totalWithdraw_Y >= 99% * withdrawCap_Y` |
| Daily Withdraw Cap | 99% | `totalWithdraw_Y_daily >= 99% * withdrawCap_Y_daily` |

### 5.2 按钮状态规则

| 场景 | 按钮状态 |
|------|---------|
| 金额为 0 | 禁用 |
| 有效金额输入 | 启用 |
| 超出 Cap | 禁用 |
| Health Factor < 1.50（Borrow/Withdraw） | 启用（需确认对话框） |

### 5.3 警告 Banner 颜色

| 警告类型 | 颜色 | 场景 |
|---------|------|------|
| Cap 超出 | 黄色 | Supply/Borrow/Withdraw Cap 超出 |
| Health Factor < 1.50 | 橙色 | Borrow/Withdraw 导致 HF < 1.50 |
| 余额不足 | 红色 | Wallet Balance 不足 |
| 高 Slippage | 警告文字 | Repay 使用 Collateral 时高滑点 |

### 5.4 平台差异

**Desktop**：
- 标准布局
- 所有功能正常显示

**iOS**：
- 移动端样式调整
- 显示 "View reserve details" 链接（iOS 特有）
- 其他功能与 Desktop 一致

---

## 6. 关键计算公式

### Health Factor 计算
```
Health Factor = (Total Collateral Value * Collateral Factor) / Total Borrow Value
```

**阈值说明**：
- HF < 1.0：可能被清算
- HF < 1.50：高风险警告
- HF >= 1.50：相对安全

---

## 7. 交互流程

### Supply 流程
```
进入页面 → 判断是否有 Supply 头寸（显示/隐藏 Refundable fee）
        → 判断是否有 debt（显示/隐藏 Health Factor）
        → 用户输入金额 → 实时计算
        → 判断是否超出 Cap → 显示警告/禁用按钮
        → 点击 Supply → 提交交易
```

### Borrow 流程
```
进入页面 → 判断是否有当前借款（显示/隐藏 Health Factor）
        → 用户输入金额 → 实时计算
        → 判断 HF < 1.50？ → 显示警告
        → 判断是否超出 Cap → 显示警告/禁用按钮
        → 点击 Borrow → HF < 1.50？弹出确认对话框
        → 勾选确认框 → 点击 Confirm → 提交交易
```

### Withdraw 流程
```
进入页面 → 判断是否有 debt（显示/隐藏 Health Factor）
        → 用户输入金额 → 实时计算
        → 判断 HF < 1.50？ → 显示警告
        → 判断是否超出 Cap → 显示警告/禁用按钮
        → 点击 Withdraw → HF < 1.50？弹出确认对话框
        → 勾选确认框 → 点击 Confirm → 提交交易
```

### Repay 流程
```
进入页面 → 选择还款方式（Wallet Balance / Collateral）
        → 用户输入金额 → 实时计算
        → 判断高 Slippage？ → 显示警告
        → 判断余额不足？ → 显示警告
        → 点击 Repay → 提交交易
```

---

## 8. 测试要点

### 功能测试
- Refundable Fee 显示/隐藏逻辑
- Health Factor 显示/隐藏逻辑
- Cap 超出判断和警告
- 按钮启用/禁用逻辑
- 确认对话框交互
- 实时计算准确性

### 边界测试
- Cap 阈值边界（99.9% / 99%）
- Health Factor 临界值（1.50）
- 金额边界值（最小/最大）

### 兼容性测试
- Desktop 平台显示
- iOS 平台显示

---

## 附录

### 术语表

| 术语 | 说明 |
|------|------|
| Health Factor | 健康因子，< 1.0 时可能被清算 |
| Refundable Fee | 可退款手续费，首次 Supply 时收取 |
| Supply Cap | 资产供应总量上限 |
| Borrow Cap | 资产借贷总量上限 |
| Withdraw Cap | 资产提取总量上限 |
| Slippage | 滑点，交易执行价格与预期价格的偏差 |

---

**文档版本**：v1.0  
**最后更新**：2026-01-07
