# DeFi Borrow 借贷协议测试规则文档

> 本文档记录 DeFi Borrow 借贷协议的核心测试规则，包括 Supply、Borrow、Withdraw、Repay 功能的测试规则。
> 生成 DeFi Borrow 模块测试用例时，必须参考本文档中的规则。
> 
> **注意**：本文档按渠道组织规则，当前包含 Kamino（Solana 链）的规则。后续如有其他渠道（如 Aave），将在本文档中新增对应渠道的规则章节。

---

## 📋 渠道与链支持

| 渠道 | 支持链 | 状态 |
|------|--------|------|
| Kamino | Solana | ✅ 已记录 |
| Aave | 待补充 | ⏳ 待添加 |

---

## 📋 核心规则速查

### Health Factor 显示规则（通用）

| 功能 | 无 Debt | 有 Debt | < 1.50 警告 |
|------|---------|---------|------------|
| Supply | 不显示 | 显示 | - |
| Borrow | 不显示 | 显示 | 警告+确认对话框 |
| Withdraw | 不显示 | 显示 | 警告+确认对话框 |
| Repay | 显示 | 显示 | - |

---

## 1. Kamino（Solana 链）规则

### 1.1 Supply（供应）功能测试规则

#### 1.1.1 Refundable Fee 显示规则

**规则**：
- **首次 Supply**：显示 "Refundable fee: X.XX SOL ($X.XX)"
- **已有 Supply 头寸**：不显示 Refundable fee

**测试要点**：
- 验证首次 Supply 时 Refundable fee 正确显示
- 验证已有 Supply 头寸时 Refundable fee 不显示
- 验证 Refundable fee 金额计算准确性（SOL 和法币价值）

#### 1.1.2 Health Factor 显示规则

**规则**：
- **无 Debt**：不显示 Health Factor
- **有 Debt**：显示 Health Factor，实时更新（如：1.49 -> 1.60）

**测试要点**：
- 验证无 Debt 时 Health Factor 不显示
- 验证有 Debt 时 Health Factor 显示且实时更新
- 验证 Health Factor 计算准确性

#### 1.1.3 Supply Cap 超出警告

**触发条件**：
- `totalSupply_X >= supplyCap_X * 99.9%`
- `totalSupply_X_daily >= SupplyCap_X_daily * 99.9%`

**显示内容**：
- 黄色 Banner："Supply cap exceeded" 或 "Daily supply cap exceeded"
- 提示："Try reducing the amount or switching to a different reserve."
- **Supply 按钮禁用**

**测试要点**：
- 验证 Supply Cap 阈值判断（99.9%）
- 验证 Daily Supply Cap 阈值判断（99.9%）
- 验证警告 Banner 正确显示
- 验证 Supply 按钮在超出 Cap 时禁用
- 验证提示文案清晰明确

---

### 1.2 Borrow（借贷）功能测试规则

#### 1.2.1 Health Factor 显示规则

**规则**：
- **无当前借款**：不显示 Health Factor
- **已有当前借款**：显示 Health Factor，实时更新（如：1.80 -> 1.60）

**测试要点**：
- 验证无当前借款时 Health Factor 不显示
- 验证已有当前借款时 Health Factor 显示且实时更新
- 验证 Health Factor 计算准确性

#### 1.2.2 Health Factor < 1.50 警告

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

**测试要点**：
- 验证 Health Factor < 1.50 时警告正确显示
- 验证警告文字颜色为橙色
- 验证 Health Factor 显示为红色
- 验证确认对话框正确弹出
- 验证未勾选确认框时 Confirm 按钮禁用
- 验证勾选确认框后 Confirm 按钮可点击
- 验证确认后交易正常提交

#### 1.2.3 Borrow Cap 超出警告

**触发条件**：
- `totalBorrows_Y >= 99% * borrowCap_Y`
- `totalBorrows_Y_daily >= 99% * borrowCap_Y_daily`

**显示内容**：
- 黄色 Banner："Borrow cap exceeded" 或 "Daily borrow cap exceeded"
- 提示："Try reducing the amount or switching to a different reserve."
- **Borrow 按钮禁用**

**测试要点**：
- 验证 Borrow Cap 阈值判断（99%）
- 验证 Daily Borrow Cap 阈值判断（99%）
- 验证警告 Banner 正确显示
- 验证 Borrow 按钮在超出 Cap 时禁用
- 验证提示文案清晰明确

#### 1.2.4 可用流动性不足警告

**显示内容**：
- 黄色 Banner："Large borrows may need to be processed gradually due to insufficient liquidity."
- Borrow 按钮仍可点击（如果其他条件满足）

**测试要点**：
- 验证流动性不足时警告正确显示
- 验证警告不影响 Borrow 按钮状态（其他条件满足时仍可点击）

---

### 1.3 Withdraw（提取）功能测试规则

#### 1.3.1 无 Debt 时的 Withdraw

**规则**：
- 不显示 Health Factor
- 显示 My supply、Available 等信息
- Withdraw 按钮可用

**测试要点**：
- 验证无 Debt 时 Health Factor 不显示
- 验证 My supply、Available 等信息正确显示
- 验证 Withdraw 按钮可用

#### 1.3.2 有 Debt 时的 Withdraw

**规则**：
- 显示 Health Factor
- 实时更新（如：1.60 -> 1.50）

**测试要点**：
- 验证有 Debt 时 Health Factor 显示且实时更新
- 验证 Health Factor 计算准确性

#### 1.3.3 Health Factor < 1.50 警告

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

**测试要点**：
- 验证 Health Factor < 1.50 时警告正确显示
- 验证警告文字颜色为橙色
- 验证 Health Factor 显示为红色
- 验证确认对话框正确弹出
- 验证未勾选确认框时 Confirm 按钮禁用
- 验证勾选确认框后 Confirm 按钮可点击
- 验证确认后交易正常提交

#### 1.3.4 Withdraw Cap 超出警告

**触发条件**：
- `totalWithdraw_Y >= 99% * withdrawCap_Y`
- `totalWithdraw_Y_daily >= 99% * withdrawCap_Y_daily`

**显示内容**：
- 黄色 Banner："Withdraw cap exceeded" 或 "Daily withdraw cap exceeded"
- 提示："Try reducing the amount or switching to a different reserve."
- **Withdraw 按钮禁用**

**测试要点**：
- 验证 Withdraw Cap 阈值判断（99%）
- 验证 Daily Withdraw Cap 阈值判断（99%）
- 验证警告 Banner 正确显示
- 验证 Withdraw 按钮在超出 Cap 时禁用
- 验证提示文案清晰明确

---

### 1.4 Repay（还款）功能测试规则

#### 1.4.1 使用 Wallet Balance 还款

**显示内容**：
- "From wallet balance" 标识
- 显示可用余额、Health Factor、My borrow
- 实时计算更新

**警告**：
- 余额不足时显示红色警告："Repay with current balance is not enough..."

**测试要点**：
- 验证 "From wallet balance" 标识正确显示
- 验证可用余额、Health Factor、My borrow 正确显示
- 验证实时计算更新准确性
- 验证余额不足时红色警告正确显示

#### 1.4.2 使用 Collateral 还款

**显示内容**：
- "With Collateral" 标识
- 还款资产输入 + 抵押资产输入
- 显示可用抵押资产

**高 Slippage 警告**：
- 警告文字："Repay with collateral is enabled, high slippage may worsen your health factor..."
- Health Factor 可能下降（如：1.50 -> 1.29）

**拒绝规则**：
- 如果使用抵押品偿还债务导致 Health Factor **上升**时，拒绝兑换

**测试要点**：
- 验证 "With Collateral" 标识正确显示
- 验证还款资产和抵押资产输入正确
- 验证可用抵押资产正确显示
- 验证高 Slippage 时警告正确显示
- 验证 Health Factor 下降时警告正确显示
- 验证 Health Factor 上升时拒绝兑换逻辑正确

#### 1.4.3 使用剩余 Collateral

**功能**：
- 提供 "Use remaining collateral" 复选框
- 勾选后使用所有剩余抵押资产

**测试要点**：
- 验证 "Use remaining collateral" 复选框存在
- 验证勾选后自动填充所有剩余抵押资产
- 验证金额计算准确性

---

### 1.5 Kamino 通用规则

#### 1.5.1 Cap 判断阈值

| Cap 类型 | 阈值 | 公式 |
|---------|------|------|
| Supply Cap | 99.9% | `totalSupply_X >= supplyCap_X * 99.9%` |
| Daily Supply Cap | 99.9% | `totalSupply_X_daily >= SupplyCap_X_daily * 99.9%` |
| Borrow Cap | 99% | `totalBorrows_Y >= 99% * borrowCap_Y` |
| Daily Borrow Cap | 99% | `totalBorrows_Y_daily >= 99% * borrowCap_Y_daily` |
| Withdraw Cap | 99% | `totalWithdraw_Y >= 99% * withdrawCap_Y` |
| Daily Withdraw Cap | 99% | `totalWithdraw_Y_daily >= 99% * withdrawCap_Y_daily` |

**测试要点**：
- 验证各 Cap 阈值判断准确性
- 验证边界值（99.9% / 99%）处理正确
- 验证 Daily Cap 和 Total Cap 分别判断

#### 1.5.2 按钮状态规则

| 场景 | 按钮状态 |
|------|---------|
| 金额为 0 | 禁用 |
| 有效金额输入 | 启用 |
| 超出 Cap | 禁用 |
| Health Factor < 1.50（Borrow/Withdraw） | 启用（需确认对话框） |

**测试要点**：
- 验证金额为 0 时按钮禁用
- 验证有效金额输入时按钮启用
- 验证超出 Cap 时按钮禁用
- 验证 Health Factor < 1.50 时按钮启用但需确认

#### 1.5.3 警告 Banner 颜色

| 警告类型 | 颜色 | 场景 |
|---------|------|------|
| Cap 超出 | 黄色 | Supply/Borrow/Withdraw Cap 超出 |
| Health Factor < 1.50 | 橙色 | Borrow/Withdraw 导致 HF < 1.50 |
| 余额不足 | 红色 | Wallet Balance 不足 |
| 高 Slippage | 警告文字 | Repay 使用 Collateral 时高滑点 |

**测试要点**：
- 验证各警告类型颜色正确
- 验证警告文案清晰明确
- 验证警告显示时机正确

#### 1.5.4 平台差异

**Desktop**：
- 标准布局
- 所有功能正常显示

**iOS**：
- 移动端样式调整
- 显示 "View reserve details" 链接（iOS 特有）
- 其他功能与 Desktop 一致

**测试要点**：
- 验证 Desktop 平台功能正常
- 验证 iOS 平台功能正常
- 验证 iOS 特有功能（如 "View reserve details"）正确显示

---

### 1.6 Kamino 关键计算公式

#### Health Factor 计算

```
Health Factor = (Total Collateral Value * Collateral Factor) / Total Borrow Value
```

**阈值说明**：
- HF < 1.0：可能被清算
- HF < 1.50：高风险警告
- HF >= 1.50：相对安全

**测试要点**：
- 验证 Health Factor 计算公式准确性
- 验证各阈值判断正确（1.0、1.50）
- 验证实时计算更新及时性

---

### 1.7 Kamino 交互流程测试规则

#### Supply 流程

```
进入页面 → 判断是否有 Supply 头寸（显示/隐藏 Refundable fee）
        → 判断是否有 debt（显示/隐藏 Health Factor）
        → 用户输入金额 → 实时计算
        → 判断是否超出 Cap → 显示警告/禁用按钮
        → 点击 Supply → 提交交易
```

**测试要点**：
- 验证流程各步骤正确执行
- 验证状态判断准确性
- 验证实时计算及时性
- 验证 Cap 判断准确性
- 验证交易提交成功

#### Borrow 流程

```
进入页面 → 判断是否有当前借款（显示/隐藏 Health Factor）
        → 用户输入金额 → 实时计算
        → 判断 HF < 1.50？ → 显示警告
        → 判断是否超出 Cap → 显示警告/禁用按钮
        → 点击 Borrow → HF < 1.50？弹出确认对话框
        → 勾选确认框 → 点击 Confirm → 提交交易
```

**测试要点**：
- 验证流程各步骤正确执行
- 验证 Health Factor 判断准确性
- 验证警告显示时机正确
- 验证确认对话框交互正确
- 验证交易提交成功

#### Withdraw 流程

```
进入页面 → 判断是否有 debt（显示/隐藏 Health Factor）
        → 用户输入金额 → 实时计算
        → 判断 HF < 1.50？ → 显示警告
        → 判断是否超出 Cap → 显示警告/禁用按钮
        → 点击 Withdraw → HF < 1.50？弹出确认对话框
        → 勾选确认框 → 点击 Confirm → 提交交易
```

**测试要点**：
- 验证流程各步骤正确执行
- 验证 Health Factor 判断准确性
- 验证警告显示时机正确
- 验证确认对话框交互正确
- 验证交易提交成功

#### Repay 流程

```
进入页面 → 选择还款方式（Wallet Balance / Collateral）
        → 用户输入金额 → 实时计算
        → 判断高 Slippage？ → 显示警告
        → 判断余额不足？ → 显示警告
        → 点击 Repay → 提交交易
```

**测试要点**：
- 验证流程各步骤正确执行
- 验证还款方式选择正确
- 验证实时计算及时性
- 验证警告显示时机正确
- 验证交易提交成功

---

## 2. Aave（待补充）

> 待添加 Aave 渠道的规则...

---

## 📝 规则维护指南

### 如何添加新渠道规则

1. **收集规则信息**：
   - 渠道支持的链
   - Supply、Borrow、Withdraw、Repay 功能规则
   - Health Factor 计算规则
   - Cap 判断规则
   - 平台差异
   - 其他特殊规则

2. **格式要求**：
   - 在文档中新增渠道章节（如 "2. Aave"）
   - 使用清晰的标题和子标题
   - 使用表格展示对比信息
   - 使用代码块展示示例
   - 标注支持/不支持状态（✅/❌）

3. **更新渠道支持表**：
   - 在文档开头的"渠道与链支持"表格中添加新渠道信息

4. **验证规则**：
   - 规则必须经过实际测试验证
   - 如有疑问，标注"待验证"或"需确认"

### 如何更新现有规则

1. **发现规则变更**：
   - 在测试过程中发现规则与文档不一致
   - 收到产品/开发通知规则变更
   - API 接口变更或新增字段

2. **更新文档**：
   - 直接修改对应渠道的规则部分
   - 在变更记录中记录更新时间和原因

3. **通知相关方**：
   - 如规则变更影响现有测试用例，需同步更新用例

---

## 📅 变更记录

### 2026-01-07
- 初始版本
- 添加 Kamino（Solana 链）DeFi 借贷协议核心测试规则：Supply、Borrow、Withdraw、Repay 功能规则
- 添加 Health Factor 显示规则、Cap 判断规则、按钮状态规则、警告 Banner 规则
- 添加交互流程测试规则和计算公式
- 明确 Kamino 仅在 Solana 链上支持
