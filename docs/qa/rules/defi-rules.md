# DeFi 协议测试规则文档

> 本文档记录 DeFi 模块下各协议的核心测试规则，包括借贷（Kamino）与固定收益（Pendle）等。
> 生成 DeFi 模块测试用例时，必须参考本文档中对应渠道的规则。
> 
> **注意**：本文档按渠道组织规则。Kamino 为借贷协议；Pendle 为固定收益/收益交易协议。

---

## 📋 渠道与链支持

| 渠道 | 类型 | 支持链 | 状态 |
|------|------|--------|------|
| Kamino | 借贷 | Solana | ✅ 已记录 |
| Pendle | 固定收益 | Ethereum 等 | ✅ 已记录 |
| Aave | 借贷 | 待补充 | ⏳ 待添加 |

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

## 2. Pendle（固定收益协议）

> Pendle 为收益交易协议，将生息资产拆分为 PT（Principal Token）与 YT（Yield Token）。OneKey 集成后用户可查看固定 APY、购买/提前出售 PT、在投资组合中管理仓位。生成 Pendle 相关测试用例时须遵守以下规则。

### 2.1 首页所有资产与固定 APY

| 规则 | 说明 |
|------|------|
| 固定 APY 列 | 所有资产列表展示 APR/APY 列；Pendle 资产需展示固定 APY 数值（如 5.00%） |
| 固定 APY 筛选 | 提供「固定 APY」或等价筛选标签，选中后仅展示 Pendle 协议下资产 |
| 资产与网络 | 列表展示资产名称、网络（如 Ethereum）；点击进入对应代币详情 |

**测试要点**：验证固定 APY 列存在且 Pendle 资产有值；验证筛选后仅显示 Pendle 资产；验证排序/空状态。

### 2.2 交易币种与网络/到期

| 规则 | 说明 |
|------|------|
| 支付/接收币种 | Buy：选择支付币种（如 sUSDe、USDT）与接收 PT；Sell early：选择卖出的 PT 与接收币种（如 USDe、sUSDe） |
| 网络 | 代币详情/交易区展示 Network（如 Ethereum） |
| 到期日 Maturity | 每个市场对应唯一到期日；展示格式如「09 Apr 2026 00:00 (21d 10h)」；不同到期为不同市场 |

**测试要点**：验证币种选择器可选且切换后报价更新；验证到期日展示与选择（若有多个到期）一致。

### 2.3 代币详情页与收益图表

| 规则 | 说明 |
|------|------|
| Fixed APY / Effective fixed APY | 详情页与交易区展示市场固定 APY（如 5.00%）；交易区展示基于当前报价的 Effective fixed APY |
| 收益图表 | Chart 支持时间范围（1H/1D/1W/Max）；可选「Show underlying APY」展示 Underlying APY 曲线 |
| PT 价格走势 | 展示 PT 价格随时间向到期价值（如 1 USDe）收敛的图示 |
| Intro | Underlying asset、Network、Liquidity、24h volume、Yield source 等 |
| Rule | Maturity、Redemption 规则（如 1 PT sUSDe → sUSDe worth 1 USDe） |

**测试要点**：验证图表切换时间范围与勾选 Underlying APY 后数据/曲线更新；验证赎回规则文案与资产类型一致（Rebasing vs Interest-bearing）。

### 2.4 购买与提前出售（Swap）

| 规则 | 说明 |
|------|------|
| Buy / Sell early | 选项卡切换；Amount 与 Receive 输入与实时估算 |
| 流程 | 1. Approve → 2. Swap（必要时 3. Unstake 等）；按钮状态：金额为 0 时禁用 |
| 提前出售提示 | 展示「At maturity you get」与「Selling now you get」及差异（如 -0.71%）；文案「Selling early may result in a lower value than holding to maturity」 |
| Route selection | 若存在多路由（如 Ethena unstake vs Swap now），弹窗选择并展示到账时间与汇率差异 |
| 交易详情 | 展示 Min. received、Fee（含 OneKey 手续费，**费率为动态**）、Market reference APY 等；Fee details 中区分 Provider fee（Pendle）、Swap fee（OneKey） |
| 默认币对选择 | Buy 与 Sell early 场景下，除当前资产本身外，系统会**自动选择当前账户余额最大的资产**作为 Swap 对手币种，作为默认交易币对；当账户资产分布变化时，下次进入时默认对手币种随之更新 |
| Token 列表排序 | 代币选择列表按 **Token 法币价值（余额 × 单价）从高到低排序**，而非按 Token 名称；当余额或价格变化时，排序结果随最新法币价值动态更新 |

**测试要点**：验证金额 0 时按钮禁用；验证 Approve/Swap 顺序与状态；验证提前出售差异与提示；验证 Fee 为动态费率（非固定比例），与产品规则一致。

### 2.5 OneKey 手续费（双渠道与收取条件）

#### 2.5.1 收取逻辑（二选一）

| 条件 | 渠道 | OneKey 手续费展示 |
|------|------|-------------------|
| 用户购买金额**到期收益 > 手续费** | 走 **OneKey Swap** 渠道 | OneKey 收取 Swap 手续费，在 Fee / Fee details 中展示 |
| 用户购买金额**到期收益无法覆盖手续费** | 走 **Pendle Swap** 渠道 | OneKey **不收取**，手续费显示为 **0** |

**前提**：**仅当用户到期后收益能覆盖手续费时，OneKey 才收取**；否则不收取，手续费显示为 0。

#### 2.5.2 计算公式（示例）

- **到期收益**（购买或提前出售均适用）：  
  `到期收益 = 金额 × 年化收益率 × (到期剩余天数 / 365)`  
  例：金额 10u × 5% × (100 / 365) = 到期后收益。
- **OneKey 佣金**：  
  `收取的佣金 = 金额 × OneKey fee 百分比`  
  例：金额 10u × OneKey fee% = 佣金。
- **约束**：**收取的佣金 < 到期后的收益** 时才走 OneKey Swap 并收取；否则走 Pendle Swap，手续费为 0。

#### 2.5.3 动态费率与币种

- 不同币种对应的 OneKey 手续费**比例可不同**，为**动态计算规则**。
- 是否收取仍以「到期收益是否覆盖手续费」为前提；覆盖则按该币种费率收取，不覆盖则显示 0。

#### 2.5.4 已到期市场

- **接口**：市场已到期时，接口**不再返回 onekey fee 字段**，不再收取佣金。
- **前端**：已到期场景下不展示 OneKey 手续费或展示为 0；仅支持赎回等非 Swap 流程。

**测试要点**：验证「到期收益 > 手续费」时走 OneKey 渠道且 Fee 展示一致；验证「到期收益 ≤ 手续费」时走 Pendle 渠道且手续费为 0；验证公式中佣金 < 到期收益；验证不同币种费率差异（若有）；验证已到期时接口无 onekey fee、前端不收取。

### 2.6 滑点与 MEV

| 规则 | 说明 |
|------|------|
| Slippage tolerance | 支持 Auto / Custom；Custom 可输入或选 0.1%、0.5%、1% 等；保存后生效 |
| MEV protection | 设置或说明中提及交易发送至 Anti-MEV 节点以降低 MEV 风险 |

**测试要点**：验证 Auto/Custom 切换与自定义输入；验证保存后后续交易使用已选滑点；验证 MEV 说明存在。

### 2.7 投资组合与仓位管理

| 规则 | 说明 |
|------|------|
| Positions 入口 | 从详情页或 DeFi 首页进入 Positions / 投资组合 |
| 仓位展示 | 按协议（如 Pendle、Morpho）分组；展示资产、到期、剩余天数、数量、价值（如 1,000.01 PT USDe、100.01 USDe） |
| 管理能力 | Manage：进入购买/出售/赎回等操作；View protocol：跳转协议；Redeem / Roll over：到期赎回或展期 |

**测试要点**：验证购买后仓位出现在列表且数量/价值正确；验证 Manage 可进入交易/赎回流程；验证到期与赎回规则展示一致。

### 2.8 边界与状态

| 场景 | 预期 |
|------|------|
| 余额为 0 | 支付金额不可超过 0；或显示余额不足 |
| 金额输入 0 | Buy / Sell early 按钮禁用 |
| 网络异常 | 报价/列表加载失败有明确提示 |
| 已到期市场 | 仅支持赎回，不展示 Buy 或展示不可用；接口不返回 onekey fee，手续费为 0 |

**测试要点**：金额边界（0、负、超余额、极小精度）；空状态与错误态；到期后仅赎回可操作。

### 2.9 询价与刷新机制

| 规则 | 说明 |
|------|------|
| 输入金额询价 | 用户输入金额后，系统**实时询价**并更新对应 Receive/费用等展示 |
| 刷新按钮 | 点击刷新按钮后，**5 秒后**再次触发一次自动刷新 |
| 自动轮询 | 系统每 **15 秒**自动刷新一次（列表/报价等） |
| 手动干预节流 | 用户**手动刷新后**，需**等待 5 秒**才能再次触发刷新（防连点） |

**测试要点**：验证输入金额后 Receive 与 Fee 随询价结果更新；验证点击刷新后 5 秒内有一次自动刷新；验证无手动操作时约每 15 秒自动刷新；验证手动刷新后 5 秒内再次点击刷新不触发或提示需等待。

### 2.10 PT-sUSDe 兑换 USDe（ETH 主网）解质押选项

> 仅适用于 **ETH 主网**下将 **PT-sUSDe 兑换为 USDe** 的场景。用户可在两种解质押方式间选择。

| 规则 | 说明 |
|------|------|
| 默认选项 | **Ethena 解质押**：默认选中；需 **约 7 天** 才能提现；展示「约 7 天内提现」或等价文案；通常标注「最优汇率」 |
| 可选选项 | **Swap 渠道**：用户可**手动切换**；**立即到账**；汇率相对有**一定损耗**（到账 USDe 可能略低于 Ethena 方式） |
| 操作步骤（Ethena 解质押） | **三步**：1. 授权 → 2. 兑换 → 3. 解质押；页面展示「1. 授权 → 2. 兑换 → 3. 解质押」 |
| 操作步骤（立即兑换 / Swap） | **两步**：1. 授权 → 2. 兑换；选择 Swap 渠道后仅展示「1. 授权 → 2. 兑换」 |

**测试要点**：验证默认选中 Ethena 解质押且展示约 7 天提现与最优汇率；验证可切换为 Swap 渠道且展示立即到账与汇率损耗；验证 Ethena 流程为三步、Swap 流程为两步；验证步骤文案与当前所选渠道一致。

### 2.11 观察地址与测试数据

> 以下地址用于 Pendle 持仓/到期相关测试（导入为观察账户或切换账户后验证列表与详情）。

| 用途 | 地址 | 说明 |
|------|------|------|
| 到期/临近到期 | `0xed81f8ba2941c3979de2265c295748a6b6956567` | 用于测试已到期或临近到期市场的展示、赎回、Buy 不可用等 |
| 到期/临近到期 | `0xfaa8f05d068716dce1cf53b32dbb0c9ae4d0c685` | 同上 |
| 当前持仓 | `0x81b76ff3fed28ba0b4a5d4c76bd5c13bd0641d86` | 用于测试 Positions 列表、仓位数量/价值、Manage/Redeem 等 |
| 当前持仓 | `0x9458e2007c1f3caeccd68f80fd36241bb915b657` | 同上 |

**测试要点**：使用到期地址验证到期市场仅赎回、无 Buy/无 onekey fee；使用当前持仓地址验证仓位展示、数量与价值、Manage 流程。

### 2.12 Swap 法币价值边界

| 规则 | 说明 |
|------|------|
| 最大法币价值 | 单笔 Swap 最大法币价值为 **$10,000,000**；超过时需提示或禁用提交 |
| 最小法币价值 | 单笔 Swap 最小法币价值为 **$0.01**；低于时需提示或禁用提交 |
| 边界验证 | 需测试刚好等于最大值、刚好超过最大值、刚好等于最小值、刚好低于最小值的四个边界 |

**测试要点**：验证输入金额折算法币价值 ≥ $10,000,000 时提示或禁用；验证输入金额折算法币价值 < $0.01 时提示或禁用；验证刚好等于边界值时的行为。

### 2.13 Ethena 解质押投资组合展示

> 通过 Ethena 解质押 USDe 的流程发起后，投资组合/Positions 页面需展示解质押进行中的状态信息。

| 规则 | 说明 |
|------|------|
| Unstaking 分组 | Positions 页面显示「Unstaking via Ethena」分组 |
| 解质押金额 | 展示解质押中的金额与法币价值（如「100 USDe ($100.01) Unstaking」）；旁边显示信息图标（ⓘ） |
| Popover 信息 | 点击信息图标弹出 Popover，展示：解质押总金额（如「500.11 USDe」）、剩余倒计时天数（如「7 days left」） |
| Popover 提示文案 | Popover 中展示提示：「Ethena unbonding can only be withdrawn in full, and any new unbonding resets the unlock time.」 |
| 倒计时更新 | 剩余天数随时间递减，归零后状态变为可提取 |

**测试要点**：验证发起 Ethena 解质押后 Positions 出现 Unstaking via Ethena 分组；验证金额与法币价值展示正确；验证点击信息图标弹出 Popover 且内容包含总金额、倒计时天数、提示文案；验证倒计时天数随时间递减。

### 2.14 购买/售出金额与授权（主币 vs 代币）

| 规则 | 说明 |
|------|------|
| 主币（Native） | 使用链主币（如 ETH）作为支付/接收时，**不需要 Approve**；流程仅包含 Swap（及必要时 Unstake）；主币金额以链最小单位处理，展示与扣款一致 |
| 代币（ERC20） | 使用代币（如 USDT、sUSDe）作为支付/接收时，**必须先 Approve** 再 Swap；未授权时仅展示 Approve 步骤，授权成功后展示 Swap；代币金额按该代币 **decimals** 处理 |
| 金额精度 | 不同代币有不同 **decimals**（如 6、8、18）；输入与展示需按该代币精度；协议/前端可能有最小可交易量，低于则不可提交或提示 |
| 最大值 | 需测试 **Max** 或「全部余额」：主币需预留 Gas，代币为余额全部；提交后余额与链上一致，无多扣或少扣 |
| 最小值 | 需测试 **最小有效金额**：按代币精度与协议最小单位；过小金额显示错误或禁用提交；边界值（刚好最小、小于最小）需覆盖 |

**测试要点**：验证主币支付时无 Approve 步骤、代币支付时必有 Approve 且顺序正确；验证不同 decimals 代币输入与展示精度；验证 Max 扣款与余额一致；验证最小金额边界与错误提示。

---

## 3. Aave（待补充）

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

### 2026-03-10
- **补充** 2.12 Swap 法币价值边界：最大法币价值 $10,000,000、最小法币价值 $0.01，超出或低于时需提示或禁用
- **补充** 2.13 Ethena 解质押投资组合展示：Unstaking via Ethena 分组、解质押金额与法币价值、Popover 展示总金额与倒计时天数及提示文案

### 2026-03-05
- **补充** 2.11 Pendle 观察地址与测试数据：到期地址 2 个、当前持仓地址 2 个，用于持仓/到期测试
- **补充** 2.14 购买/售出金额与授权：主币不需 Approve、代币需先 Approve；不同代币 decimals、最大值（Max/预留 Gas）、最小值（精度与协议最小量）须覆盖测试

### 2026-03-03
- 新增 Pendle（固定收益协议）规则章节：首页固定 APY 列与筛选、交易币种与网络/到期、代币详情与收益图表、购买/提前出售与 Swap、OneKey 手续费、滑点与 MEV、投资组合与仓位管理、边界与状态、询价与刷新机制
- 文档标题调整为「DeFi 协议测试规则文档」；渠道支持表增加 Pendle
- **补充** OneKey 手续费双渠道规则：到期收益 > 手续费走 OneKey Swap 并收取，否则走 Pendle Swap 且手续费为 0；补充公式（到期收益、佣金、约束）、动态费率与币种、已到期不返回 onekey fee；补充 2.9 询价与刷新机制（输入金额实时询价、刷新按钮 5 秒后再刷新、自动轮询 15 秒、手动刷新后 5 秒内不可再次触发）
- **补充** 2.10 PT-sUSDe 兑换 USDe（ETH 主网）：默认 Ethena 解质押（约 7 天提现、最优汇率），可切换 Swap 渠道（立即到账、汇率有损耗）；Ethena 为三步（授权→兑换→解质押），立即兑换为两步（授权→兑换）

### 2026-01-07
- 初始版本
- 添加 Kamino（Solana 链）DeFi 借贷协议核心测试规则：Supply、Borrow、Withdraw、Repay 功能规则
- 添加 Health Factor 显示规则、Cap 判断规则、按钮状态规则、警告 Banner 规则
- 添加交互流程测试规则和计算公式
- 明确 Kamino 仅在 Solana 链上支持
