# Hyperliquid - ApproveAgent 推荐绑定 Checkbox
> 生成时间：2026-01-04

## 测试场景列表

### 1. Checkbox 显示条件（主流程）

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
| --- | --- | --- | --- | --- |
| P0 | E2E | 已登录<br>data.referredBy 为空<br>账户类型=可签名账户<br>accountValue > 0<br>withdrawable > 0<br>操作类型=ApproveAgent | 1. 进入 Hyperliquid 交易页面<br>2. 执行 ApproveAgent 操作<br>3. 检查页面是否存在 Checkbox 元素 | 1. Checkbox 元素存在（visible=true）<br>2. Checkbox 默认状态为勾选（checked=true）<br>3. Checkbox 文案包含 i18n key：wallet::use_onekey_hl_discount 对应的本地化文本<br>4. 邀请码文案显示"1KREF"或对应 i18n 文本 |
| P0 | E2E | 已登录<br>data.referredBy 不为空<br>其他条件同上 | 1. 进入 Hyperliquid 交易页面<br>2. 执行 ApproveAgent 操作<br>3. 检查页面是否存在 Checkbox 元素 | 1. Checkbox 元素不存在（visible=false 或 DOM 中不存在）<br>2. 页面不展示推荐绑定相关文案 |
| P0 | E2E | 已登录<br>data.referredBy 为空<br>操作类型=非 ApproveAgent（如普通交易、转账等） | 1. 进入 Hyperliquid 交易页面<br>2. 执行非 ApproveAgent 操作<br>3. 检查页面是否存在 Checkbox 元素 | 1. Checkbox 元素不存在（visible=false 或 DOM 中不存在）<br>2. 页面不展示推荐绑定相关文案 |
| P0 | E2E | 已登录<br>data.referredBy 为空<br>账户类型=Watch-only 账户 | 1. 切换到 Watch-only 账户<br>2. 进入 Hyperliquid 交易页面<br>3. 执行 ApproveAgent 操作<br>4. 检查页面是否存在 Checkbox 元素 | 1. Checkbox 元素不存在（visible=false 或 DOM 中不存在）<br>2. 页面不展示推荐绑定相关文案 |
| P0 | E2E | 已登录<br>data.referredBy 为空<br>accountValue = 0 或 withdrawable = 0 | 1. 切换到余额为 0 的账户<br>2. 进入 Hyperliquid 交易页面<br>3. 执行 ApproveAgent 操作<br>4. 检查页面是否存在 Checkbox 元素 | 1. Checkbox 元素不存在（visible=false 或 DOM 中不存在）<br>2. 页面不展示推荐绑定相关文案 |

### 2. Checkbox 默认状态与交互

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
| --- | --- | --- | --- | --- |
| P0 | E2E | 已登录<br>data.referredBy 为空<br>满足显示条件<br>首次进入 ApproveAgent 操作 | 1. 进入 Hyperliquid 交易页面<br>2. 执行 ApproveAgent 操作<br>3. 读取 Checkbox 的 checked 属性 | 1. Checkbox checked 属性值为 true<br>2. Checkbox 视觉状态为勾选状态（可通过 CSS 类或 aria-checked 验证） |
| P0 | E2E | 已登录<br>data.referredBy 为空<br>满足显示条件<br>用户主动取消勾选 | 1. 进入 ApproveAgent 操作页面<br>2. 点击 Checkbox 取消勾选<br>3. 关闭页面或取消操作<br>4. 再次进入 ApproveAgent 操作页面<br>5. 读取 Checkbox 的 checked 属性 | 1. 首次取消勾选后，checked 属性值为 false<br>2. 再次进入时，Checkbox 不再自动勾选（checked=false）<br>3. 前端已记录用户取消状态（可通过 localStorage 或状态管理验证） |
| P0 | E2E | 已登录<br>data.referredBy 为空<br>满足显示条件<br>硬件钱包拒绝二次签名 | 1. 进入 ApproveAgent 操作页面<br>2. Checkbox 默认勾选<br>3. 点击确认，硬件钱包拒绝签名<br>4. 再次进入 ApproveAgent 操作页面<br>5. 读取 Checkbox 的 checked 属性 | 1. 硬件拒绝后，前端记录状态<br>2. 再次进入时，Checkbox 不再自动勾选（checked=false）<br>3. 前端已记录硬件拒绝状态（可通过状态管理验证） |
| P1 | E2E | 已登录<br>data.referredBy 为空<br>满足显示条件<br>用户勾选后提交成功 | 1. 进入 ApproveAgent 操作页面<br>2. Checkbox 默认勾选<br>3. 点击确认并完成签名<br>4. 检查提交的 payload 或 API 请求 | 1. 提交的 payload 中包含推荐绑定相关字段<br>2. 字段值为邀请码"1KREF"或对应标识<br>3. API 请求成功（status=200 或业务状态码=0） |

### 3. 多账户切换场景

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
| --- | --- | --- | --- | --- |
| P0 | E2E | 已登录<br>账户A：data.referredBy 为空，满足显示条件<br>账户B：data.referredBy 不为空 | 1. 使用账户A进入 ApproveAgent 操作页面<br>2. 记录 Checkbox 显示状态 S1<br>3. 切换到账户B<br>4. 进入 ApproveAgent 操作页面<br>5. 记录 Checkbox 显示状态 S2 | 1. S1=true（Checkbox 显示）<br>2. S2=false（Checkbox 不显示）<br>3. 每个账户独立判断，状态互不影响 |
| P0 | E2E | 已登录<br>账户A：data.referredBy 为空，用户已取消勾选<br>账户B：data.referredBy 为空，未操作过 | 1. 使用账户A进入 ApproveAgent 操作页面<br>2. 取消勾选 Checkbox<br>3. 切换到账户B<br>4. 进入 ApproveAgent 操作页面<br>5. 读取 Checkbox 的 checked 属性 | 1. 账户A的 Checkbox 状态为未勾选（checked=false）<br>2. 账户B的 Checkbox 状态为默认勾选（checked=true）<br>3. 每个账户的取消状态独立存储 |
| P1 | E2E | 已登录<br>多个账户：部分满足显示条件，部分不满足 | 1. 依次切换到每个账户<br>2. 对每个账户执行 ApproveAgent 操作<br>3. 记录每个账户的 Checkbox 显示状态 | 1. 满足条件的账户显示 Checkbox（visible=true）<br>2. 不满足条件的账户不显示 Checkbox（visible=false）<br>3. 状态判断逻辑独立，无相互影响 |

### 4. i18n 与文案验证

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
| --- | --- | --- | --- | --- |
| P1 | Unit | i18n 资源可访问 | 1. 检查 i18n 资源文件<br>2. 查找 key：wallet::use_onekey_hl_discount | 1. i18n key 在至少中/英文资源中存在<br>2. 对应的值非空字符串<br>3. 值包含可读的文案内容 |
| P1 | E2E | 已登录<br>满足显示条件<br>语言=中文 | 1. 切换语言为中文<br>2. 进入 ApproveAgent 操作页面<br>3. 读取 Checkbox 文案内容 | 1. Checkbox 文案为中文<br>2. 文案内容与 i18n key wallet::use_onekey_hl_discount 的中文值一致 |
| P1 | E2E | 已登录<br>满足显示条件<br>语言=英文 | 1. 切换语言为英文<br>2. 进入 ApproveAgent 操作页面<br>3. 读取 Checkbox 文案内容 | 1. Checkbox 文案为英文<br>2. 文案内容与 i18n key wallet::use_onekey_hl_discount 的英文值一致 |
| P1 | E2E | 已登录<br>满足显示条件<br>邀请码文案 | 1. 进入 ApproveAgent 操作页面<br>2. 查找页面中显示邀请码的元素 | 1. 邀请码元素存在<br>2. 邀请码文本为"1KREF"或对应 i18n 文本<br>3. 邀请码文案与 Checkbox 在同一区域或相关位置 |

### 5. 边界与异常场景

| 优先级 | 自动化层级 | 输入数据 | 操作步骤 | 预期结果 (含自动化断言) |
| --- | --- | --- | --- | --- |
| P1 | E2E | 已登录<br>data.referredBy 为空<br>满足显示条件<br>频繁进入 ApproveAgent 操作 | 1. 连续多次进入 ApproveAgent 操作页面（5次）<br>2. 每次记录 Checkbox 显示状态和勾选状态 | 1. 每次进入时 Checkbox 都显示（visible=true）<br>2. 首次进入时默认勾选（checked=true）<br>3. 如果用户未取消过，后续进入仍默认勾选<br>4. 如果用户已取消过，后续进入不再自动勾选 |
| P2 | E2E | 已登录<br>data.referredBy 为空<br>满足显示条件<br>网络异常 | 1. 进入 ApproveAgent 操作页面<br>2. 模拟网络断开<br>3. 检查 Checkbox 显示状态 | 1. Checkbox 显示状态不受网络影响（仍显示或根据本地状态判断）<br>2. 网络恢复后状态保持一致 |
| P2 | E2E | 已登录<br>data.referredBy 为空<br>满足显示条件<br>页面刷新 | 1. 进入 ApproveAgent 操作页面<br>2. 取消勾选 Checkbox<br>3. 刷新页面<br>4. 再次进入 ApproveAgent 操作页面<br>5. 读取 Checkbox 的 checked 属性 | 1. 刷新后，用户取消状态仍被记录（checked=false）<br>2. 状态持久化到 localStorage 或状态管理 |

---

## 自动化实施方案（P0/P1）

### 1. 单元测试（Unit）重点
- Checkbox 显示条件判断逻辑：data.referredBy 为空、账户类型、余额判断（accountValue > 0 & withdrawable > 0）、操作类型判断
- 默认勾选状态管理：首次显示默认勾选，用户取消后不再自动勾选的状态记录逻辑
- 多账户状态隔离：每个账户独立的状态存储和读取逻辑
- i18n 文本获取：wallet::use_onekey_hl_discount key 的文本获取和渲染逻辑

### 2. 端到端（E2E/API）重点
- 需要 Mock：data.referredBy 字段、账户余额（accountValue、withdrawable）、账户类型（可签名/Watch-only）、操作类型（ApproveAgent/其他）
- 关键拦截点：
  - Checkbox 元素存在性验证（DOM 查询或 visibility 检查）
  - Checkbox checked 属性验证（首次默认勾选、取消后不再自动勾选）
  - 提交 payload 验证（勾选状态下是否包含推荐绑定字段和邀请码）
  - 多账户切换时状态隔离验证
  - i18n 文本内容验证（中英文切换）
- UI 断言点：
  - Checkbox 显示/隐藏状态
  - Checkbox 默认勾选状态
  - 邀请码文案显示（"1KREF"）
  - i18n 文案正确性
  - 多账户切换后状态独立性
