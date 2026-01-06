# DeFi - Borrow 首页测试

## 1. 钱包状态 - 空钱包场景

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P0 | E2E | 1. 已连接钱包<br>2. 钱包内无任何可 supply 资产余额<br>3. 无 supplied 记录<br>4. 无 borrowed 记录 | 1. 进入 DeFi → Borrow 页面<br>2. 观察页面各区域展示 | 1. Net worth 显示 `$0.00`<br>2. Net APY 显示 `-` 或 `--`<br>3. Health factor 区域隐藏不展示<br>4. Platform bonus 显示 `$0.00`<br>5. Rewards 显示 `$0.00`<br>6. 页面顶部显示引导 alert：`Your wallet is empty. Receive, bridge, or buy assets to get started.`<br>7. alert 内显示 `Receive` 和 `Bridge` 按钮 |
| P0 | E2E | 同上 | 1. 观察 My supply 区域 | 1. Supplied balance 显示 `$0.00` 或不显示<br>2. 空状态文案显示：`Nothing supplied yet` |
| P0 | E2E | 同上 | 1. 观察 My borrow 区域 | 1. Borrowed balance 显示 `$0.00` 或不显示<br>2. 空状态文案显示：`Supply assets as collateral before borrowing`（引导用户先存入抵押品） |
| P1 | E2E | 同上 | 1. 观察 Assets to supply 区域 | 1. 列表展示支持的资产（SOL、mSOL、JitoSOL 等）<br>2. Balance 列全部显示 `0` / `$0.00`<br>3. Supply APY 正确显示百分比（如 `5.00%`）<br>4. 可作为抵押品的资产显示 ✓ 标识<br>5. Supply 按钮置灰或隐藏（余额为 0） |
| P1 | E2E | 同上 | 1. 观察 Assets to borrow 区域 | 1. 列表展示可借资产（USDC、USDT、SOL 等）<br>2. Available 列全部显示 `0` / `$0.00`<br>3. Borrow APY 正确显示百分比（如 `5.00%`、`6.00%`）<br>4. 带 Bonus 的资产显示绿色 Bonus 标识（如 USDC `1.0% Bonus`）<br>5. Borrow 按钮置灰或不可点击 |
| P1 | E2E | 同上 | 1. 点击引导 alert 中的 `Receive` 按钮 | 1. 跳转至收款/接收资产页面<br>2. 页面路由参数正确 |
| P1 | E2E | 同上 | 1. 点击引导 alert 中的 `Bridge` 按钮 | 1. 跳转至跨链桥页面<br>2. 页面路由参数正确 |

---

## 2. 钱包状态 - 有余额无存借

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P0 | E2E | 1. 已连接钱包<br>2. 钱包内有可 supply 资产余额（如 SOL: 99）<br>3. 无 supplied 记录<br>4. 无 borrowed 记录 | 1. 进入 DeFi → Borrow 页面<br>2. 观察页面各区域展示 | 1. Net worth 显示 `$0.00`（因无 supplied）<br>2. Net APY 显示 `5.00%` 或当前市场利率<br>3. Health factor 区域隐藏不展示<br>4. 不显示空钱包引导 alert |
| P0 | E2E | 同上 | 1. 观察 My supply 区域 | 1. 空状态文案显示：`Nothing supplied yet`<br>2. 无资产行展示 |
| P0 | E2E | 同上 | 1. 观察 My borrow 区域 | 1. 空状态文案显示：`Supply assets as collateral before borrowing` |
| P0 | E2E | 同上 | 1. 观察 Assets to supply 区域 | 1. 有余额的资产（如 SOL: 99）显示实际余额及对应 USD 价值（如 `$19800.01`）<br>2. Supply 按钮可点击<br>3. 无余额资产的 Supply 按钮置灰或隐藏 |
| P1 | E2E | 同上 | 1. 开启 `Show assets with 0 balance` 开关 | 1. Assets to supply 列表显示所有支持资产（含余额为 0 的）<br>2. 余额为 0 的资产显示 `0` / `$0.00` |
| P1 | E2E | 同上 | 1. 关闭 `Show assets with 0 balance` 开关 | 1. Assets to supply 列表仅显示余额 > 0 的资产<br>2. 余额为 0 的资产被隐藏 |

---

## 3. 钱包状态 - 有存入无借款

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P0 | E2E | 1. 已连接钱包<br>2. 钱包内有可 supply 资产余额<br>3. 已 supplied 资产（如 SOL: 1, mSOL: 0.1）<br>4. 无 borrowed 记录 | 1. 进入 DeFi → Borrow 页面<br>2. 观察顶部信息区 | 1. Net worth 显示已存入资产的 USD 总价值（如 `$220.01`）<br>2. Net APY 显示当前综合年化（如 `5.00%`）<br>3. Health factor 区域隐藏（无借款时不显示）<br>4. Platform bonus 显示当前奖励（如 `$0.00`）<br>5. Rewards 显示待领取奖励金额 |
| P0 | E2E | 同上 | 1. 观察 My supply 区域 | 1. Supplied balance 显示已存入资产 USD 总价值（如 `$220.01`）<br>2. APY 显示存款综合年化（如 `5.00%`）<br>3. 资产列表显示每个已存入资产行<br>4. 每行显示：Asset 图标+名称、Supplied 数量及 USD 价值、Supply APY、Withdraw 按钮 |
| P0 | E2E | 同上 | 1. 观察 My borrow 区域 | 1. 空状态文案显示：`Nothing borrowed yet`<br>2. 无资产行展示 |
| P0 | E2E | 同上 | 1. 观察 Assets to borrow 区域 | 1. Available 列显示当前可借额度（基于抵押品计算）<br>2. 有可借额度的资产 Borrow 按钮可点击<br>3. USDC 等带 Bonus 的资产显示绿色 Bonus 标识及降低后的 APY（如 `↓ 5.00%`） |
| P1 | Unit | 1. 已存入 SOL: 1（$200.01）<br>2. 已存入 mSOL: 0.1（$20.01） | 1. 计算 Supplied balance | 1. Supplied balance = 200.01 + 20.01 = `$220.02`（允许小数精度误差）<br>2. 断言前端展示值与后端返回值一致 |

---

## 4. 钱包状态 - 有存入有借款（正常健康因子）

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P0 | E2E | 1. 已连接钱包<br>2. 已 supplied 资产（如 SOL: 1）<br>3. 已 borrowed 资产（如 USDC: 10）<br>4. Health factor ≥ 1.5 | 1. 进入 DeFi → Borrow 页面<br>2. 观察顶部信息区 | 1. Net worth 显示资产净值（Supplied - Borrowed）<br>2. Net APY 显示综合年化（存款收益 - 借款利息）<br>3. Health factor 显示且数值 ≥ 1.5（如 `10.01`）<br>4. Health factor 旁显示 `Details` 可点击<br>5. Platform bonus 显示当前平台奖励及 `Details` 入口<br>6. Rewards 显示待领取金额及 `Claim` 按钮 |
| P0 | E2E | 同上 | 1. 观察 My supply 区域 | 1. Supplied balance 显示已存入资产 USD 总价值<br>2. 资产列表显示每个已存入资产，含 Withdraw 按钮 |
| P0 | E2E | 同上 | 1. 观察 My borrow 区域 | 1. Borrowed balance 显示已借入资产 USD 总价值（如 `$10.01`）<br>2. APY 显示借款综合年化（如 `5.00%`）<br>3. 资产列表显示每个已借入资产<br>4. 每行显示：Asset 图标+名称（带 Bonus 标识）、Borrowed 数量及 USD 价值、Borrow APY（如 `↓ 5.00%`）、Repay 按钮 |
| P0 | E2E | 同上 | 1. 点击 Health factor 旁的 `Details` | 1. 弹出 Health factor 详情弹窗/Popover<br>2. 显示健康因子计算公式或组成说明<br>3. 显示清算阈值提示 |
| P0 | E2E | 同上 | 1. 点击 Platform bonus 旁的 `Details` | 1. 弹出平台奖励详情弹窗/Popover<br>2. 显示奖励来源及计算方式 |
| P0 | E2E | 1. Rewards 金额 > 0（如 `<$0.01`） | 1. 点击 `Claim` 按钮 | 1. 弹出 Claim 确认弹窗<br>2. 确认后发起链上交易<br>3. 成功后 Rewards 余额更新 |

---

## 5. 风控场景 - Health factor 低于阈值

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P0 | E2E | 1. 已连接钱包<br>2. 已 supplied 资产<br>3. 已 borrowed 资产<br>4. Health factor < 1.5（如 1.49） | 1. 进入 DeFi → Borrow 页面 | 1. Health factor 显示警告色（如黄色/橙色）<br>2. 页面顶部显示风险警告 banner：`Be careful — you are very close to liquidation`<br>3. banner 副文案：`Consider supplying more collateral or paying down some of your borrowed positions.` |
| P0 | E2E | 同上 | 1. 观察风险警告 banner 样式 | 1. banner 背景为警告色（黄色/橙色）<br>2. banner 位于顶部信息区下方、My supply 区域上方<br>3. banner 无关闭按钮（强制展示） |
| P1 | E2E | 同上 | 1. 尝试继续借款 | 1. 借款操作应有额外风险提示<br>2. 或借款额度受限 |

---

## 6. 列表交互 - 展开收起

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P1 | E2E | 1. 已有 supplied 和 borrowed 资产 | 1. 点击 My supply 区域的收起箭头 | 1. My supply 资产列表收起隐藏<br>2. 仅显示标题栏和 Supplied balance 概览<br>3. 箭头方向变化（向下 → 向右/向上） |
| P1 | E2E | 同上 | 1. 点击已收起的 My supply 区域展开 | 1. My supply 资产列表展开显示<br>2. 显示完整资产行 |
| P1 | E2E | 同上 | 1. 点击 My borrow 区域的收起箭头 | 1. My borrow 资产列表收起隐藏 |
| P1 | E2E | 同上 | 1. 点击 Assets to supply 区域的收起箭头 | 1. Assets to supply 资产列表收起隐藏 |
| P1 | E2E | 同上 | 1. 点击 Assets to borrow 区域的收起箭头 | 1. Assets to borrow 资产列表收起隐藏 |
| P2 | E2E | 同上 | 1. 收起所有列表<br>2. 退出页面再进入 | 1. 验证列表展开/收起状态是否持久化（或恢复默认展开） |

---

## 7. 历史记录

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P0 | E2E | 1. 已有历史操作记录（Supply, Borrow, Repay, Claim, Withdraw） | 1. 点击 `History` 按钮 | 1. 打开历史记录页面/弹窗<br>2. 显示历史记录列表 |
| P0 | E2E | 同上 | 1. 观察历史记录列表 | 1. 按日期分组展示（如 `2025/12/15`）<br>2. 每条记录显示：操作类型图标、操作类型（Claim/Repay/Request withdrawal/Borrow/Supply）、时间、来源（如 Kamino）、金额变化（正数绿色如 `+0.001 KMNO`，负数红色如 `-50 USDC`） |
| P1 | E2E | 同上 | 1. 观察历史记录筛选 | 1. 支持按类型筛选（如 All 下拉选择）<br>2. 筛选后列表正确过滤 |
| P1 | E2E | 1. 无历史记录 | 1. 点击 `History` 按钮 | 1. 显示空状态文案或空列表 |

---

## 8. 资产行操作菜单

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P1 | E2E | 1. Assets to supply 列表有资产 | 1. 点击资产行右侧的更多菜单（三点图标） | 1. 弹出操作菜单 Popover<br>2. 菜单选项包含：Swap、Bridge、Send、Receive |
| P1 | E2E | 同上 | 1. 点击菜单中的 `Swap` | 1. 跳转至 Swap 页面<br>2. 预填当前资产为源币种 |
| P1 | E2E | 同上 | 1. 点击菜单中的 `Bridge` | 1. 跳转至 Bridge 页面<br>2. 预填当前资产 |
| P1 | E2E | 同上 | 1. 点击菜单中的 `Send` | 1. 跳转至 Send 页面<br>2. 预填当前资产 |
| P1 | E2E | 同上 | 1. 点击菜单中的 `Receive` | 1. 跳转至 Receive 页面或显示收款地址 |
| P2 | E2E | 同上 | 1. 点击菜单外区域 | 1. 菜单关闭 |

---

## 9. 数值展示与精度

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P0 | Unit | 1. 已存入资产价值 $200.01<br>2. 已存入资产价值 $20.01 | 1. 计算 Supplied balance 总和 | 1. 返回值为 220.02<br>2. 精度保留 2 位小数 |
| P0 | API | 1. 后端返回 APY 数据 | 1. 获取 Supply APY 和 Borrow APY | 1. APY 显示格式为 `X.XX%`<br>2. 前端展示值与后端返回值一致 |
| P1 | E2E | 1. 资产价值极小（如 < $0.01） | 1. 观察 Rewards 展示 | 1. 显示 `<$0.01` 而非 `$0.00`<br>2. 或显示具体小数值 |
| P1 | Unit | 1. 资产价值极大（如 > $1,000,000） | 1. 观察数值展示 | 1. 正确显示大数值，不使用科学计数法<br>2. 千分位格式正确（如 `$1,000,000.00`） |
| P2 | E2E | 1. 资产数量为小数（如 0.00000001） | 1. 观察资产数量展示 | 1. 精度符合该资产 decimals 规范<br>2. 不丢失精度或显示 0 |

---

## 10. 网络与异常

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P1 | E2E | 1. 网络正常 → 断开 | 1. 进入 Borrow 首页<br>2. 断开网络连接 | 1. 页面不崩溃<br>2. 显示网络异常提示或 loading 状态<br>3. 数据保持断网前的缓存状态 |
| P1 | E2E | 1. 断网状态 | 1. 恢复网络连接 | 1. 页面自动刷新数据<br>2. 或显示刷新按钮供用户手动刷新 |
| P1 | API | 1. 后端返回 500 错误 | 1. Mock API 返回 500<br>2. 进入 Borrow 首页 | 1. 页面显示错误提示<br>2. 不展示错误的数据<br>3. 提供重试入口 |
| P2 | E2E | 1. 弱网环境（延迟 > 3s） | 1. 进入 Borrow 首页 | 1. 显示 loading 状态<br>2. 加载完成后正确展示数据<br>3. 无重复请求 |

---

## 11. 多端适配

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
|--------|-----------|---------|---------|------------------------|
| P1 | E2E | 1. App 端（iOS/Android） | 1. 进入 DeFi → Borrow 页面 | 1. 页面布局适配移动端<br>2. 侧边栏收起，底部显示 Tab 导航<br>3. 搜索栏显示在顶部<br>4. 所有功能可正常操作 |
| P1 | E2E | 1. Desktop 端 | 1. 进入 DeFi → Borrow 页面 | 1. 页面布局适配桌面端<br>2. 侧边栏展开显示导航菜单<br>3. My supply 和 My borrow 并排显示<br>4. Assets to supply 和 Assets to borrow 并排显示 |
| P2 | E2E | 1. 小屏设备（宽度 < 375px） | 1. 进入 Borrow 首页 | 1. 表格内容不溢出<br>2. 文字正常截断或换行<br>3. 按钮可正常点击 |

---

## 自动化实施方案

### 1. 单元测试（Unit）重点
- **Supplied balance 计算**：验证多资产 USD 价值求和逻辑，精度处理
- **Net APY 计算**：验证存款收益与借款利息的综合年化计算公式
- **Health factor 阈值判断**：验证 < 1.5 时触发警告逻辑
- **可借额度计算**：基于抵押品价值和 LTV 比率计算 Available 额度

### 2. 端到端（E2E/API）重点
- **Mock 核心数据**：
  - 钱包资产余额（模拟空钱包、有余额、已存入、已借款等状态）
  - APY/APR 数据接口
  - Health factor 数据（模拟正常值和低于阈值场景）
  - 历史记录列表数据
- **关键拦截点**：
  - Claim 奖励交易请求
  - Supply/Withdraw/Borrow/Repay 操作请求
  - History 列表查询请求

