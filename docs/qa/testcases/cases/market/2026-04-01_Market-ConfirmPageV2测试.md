# Market - Confirm Page V2 测试

> 生成时间：2026-04-01
> 规则文档：`docs/qa/rules/market-rules.md` §9
> 需求文档：`docs/qa/requirements/Market-ConfirmPageV2.md`
> 测试端：iOS / Android / Desktop / Extension / Web

## 测试范围说明

**功能范围**：Market 详情页 Swap Pro Mode 确认页 V2（Review Order）
**覆盖场景**：普通 Swap（无需授权 / 需授权）、Wrap / Unwrap、签名链路（Sign / Sign and Submit）、Approve and Sign
**覆盖验证**：入口与生命周期、步骤编排、授权判定与费用刷新、异常与状态切换、表单同步与关联回归

---

## 前置条件

- 已登录 HD 钱包；Market 详情页可进入 Swap Pro Mode；账户有可兑换余额。
- 已备齐可测路径：原生↔USDC（无需授权）、USDC→ETH（未授权需 Approve）、ETH↔WETH Wrap/Unwrap、1inch 等签名链路各至少一条。

---

## 1. 入口与弹层生命周期

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. Market 详情页普通 Swap 场景<br>2. 已输入有效金额并获取报价 | 1. 点击主操作按钮 | 1. 拉起 Review Order 确认页<br>2. 不直接发起链上交易<br>3. 确认页展示 from/to token、数量、报价信息 |
| ❗️❗️P0❗️❗️ | 1. Market 详情页 Wrap / Unwrap 场景<br>2. 已输入有效金额 | 1. 点击主操作按钮 | 1. 拉起 Review Order 确认页<br>2. 步骤文案与 Wrap / Unwrap 场景匹配<br>3. 不直接发起链上交易 |
| ❗️❗️P0❗️❗️ | 1. 主操作按钮处于以下任一状态：<br>- Action loading<br>- Allowance checking<br>- Approve matching pending | 1. 点击主操作按钮 | 1. 不重复拉起确认页<br>2. 按钮状态=禁用或显示 loading |
| ❗️❗️P0❗️❗️ | 1. 确认页已打开（分别在 tab 页面和 overlay / modal 页面两种容器下验证） | 1. 关闭确认页<br>2. 检查页面状态 | 1. 确认页正常关闭<br>2. 关闭后页面状态恢复正常<br>3. 主表单数据不丢失 |
| ❗️❗️P0❗️❗️ | 1. 已打开并关闭过一次确认页<br>2. 修改了 from/to token 或数量或 slippage 并重新获取 quote | 1. 再次点击主操作按钮打开确认页 | 1. 确认页展示当前最新的 from/to token<br>2. 数量与最新输入一致<br>3. quote 与最新报价一致<br>4. slippage 与当前设置一致<br>5. 不残留上一次确认页状态 |

---

## 2. 确认页步骤编排

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 无需授权的普通 Swap（源币为原生币或已授权 Token） | 1. 点击主操作按钮打开确认页<br>2. 查看步骤列表 | 1. 仅展示 Confirm / Sign / Submit 等实际需要的步骤<br>2. 不额外出现 Approve 步骤 |
| ❗️❗️P0❗️❗️ | 1. 需要授权的普通 Swap（源币为未授权 ERC20 Token） | 1. 点击主操作按钮打开确认页<br>2. 查看步骤列表 | 1. 展示 Approve + Swap / Sign 组合步骤<br>2. Approve 步骤排在 Swap / Sign 步骤之前<br>3. 按钮文案与步骤顺序正确 |
| ❗️❗️P0❗️❗️ | 1. Wrap 或 Unwrap 路径 | 1. 点击主操作按钮打开确认页<br>2. 查看步骤列表 | 1. 仅展示对应的 Wrap / Unwrap 交易步骤<br>2. 不混入普通 Swap 的 Approve / Swap 步骤 |
| ❗️❗️P0❗️❗️ | 1. 存在签名链路的报价（如聚合器 Sign 链路） | 1. 点击主操作按钮打开确认页<br>2. 查看步骤列表 | 1. 展示 Sign 或 Sign and Submit 步骤<br>2. 完成签名后可继续后续提交流程 |
| ❗️❗️P0❗️❗️ | 1. 分别在以下链路场景打开确认页：<br>- 无需授权 Swap<br>- 需授权 Swap<br>- Wrap / Unwrap<br>- Sign 链路<br>- Approve and Sign 链路 | 1. 逐一检查确认页步骤标题与按钮文案 | 1. Confirm Swap / Sign / Sign and Submit / Approve and Swap / Approve and Sign 等标题与实际链路一致<br>2. 按钮文案与当前步骤匹配 |

---

## 3. 授权判定与费用刷新

### 3.1 授权判定规则

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 源币为 ERC20 Token<br>2. 当前最新 allowance 已满足兑换金额 | 1. 打开确认页<br>2. 查看步骤列表 | 1. 不展示 Approve 步骤<br>2. 仅展示 Swap / Sign 相关步骤 |
| ❗️❗️P0❗️❗️ | 1. 源币为 ERC20 Token<br>2. 当前最新 allowance 不足以覆盖兑换金额 | 1. 打开确认页<br>2. 查看步骤列表 | 1. 展示 Approve 步骤<br>2. Approve 步骤排在 Swap / Sign 之前 |
| ❗️❗️P0❗️❗️ | 1. 源币为 ERC20 Token<br>2. spender / allowanceTarget 相比旧报价发生变化（如切换聚合器路由） | 1. 重新获取报价<br>2. 打开确认页<br>3. 查看步骤列表 | 1. 以最新有效 spender 重新判定是否需要 Approve<br>2. 不沿用旧报价的授权状态 |

---

### 3.2 费用刷新与 Pending 状态

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 确认页首次打开需要 Approve<br>2. Approve 已完成 | 1. 完成 Approve 步骤<br>2. 查看后续 Swap / Sign 步骤的费用信息 | 1. gas / network fee 刷新为最新值<br>2. 费用不沿用 Approve 前的旧值 |
| ❗️❗️P0❗️❗️ | 1. 存在 approve pending amount 命中场景 | 1. 打开确认页<br>2. 查看步骤状态 | 1. 确认页保持正确的 pending 状态<br>2. 相关按钮状态=禁用<br>3. 不误判为可重复授权 |
| P1 | 1. Approve and Sign 场景<br>2. 确认页已展示 | 1. 点击 fee 编辑入口<br>2. 修改 fee 参数 | 1. 确认页可正常展示 fee 编辑能力<br>2. 费用语义与实际步骤一致<br>3. 修改后费用值正确更新 |

---

## 4. 异常与状态切换

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 打开确认页失败<br>2. 返回标准 Error 对象 | 1. 触发打开确认页 | 1. 展示对应的错误文案<br>2. 错误文案与返回的 Error 信息匹配 |
| ❗️❗️P0❗️❗️ | 1. 打开确认页失败<br>2. 返回非 Error 值（非标准错误） | 1. 触发打开确认页 | 1. 展示通用 unknown error 文案 |
| ❗️❗️P0❗️❗️ | 1. 确认页已打开<br>2. 分别触发以下失败场景：<br>- 授权失败<br>- 签名拒绝<br>- 发送失败 | 1. 在确认页内触发授权 / 签名 / 发送操作<br>2. 操作失败后检查确认页状态 | 1. 确认页状态正确停留或回退到失败前步骤<br>2. 可重新发起操作<br>3. 不出现卡死<br>4. 不出现重复提交<br>5. 不出现步骤错乱 |
| ❗️❗️P0❗️❗️ | 1. 使用 1inch / 聚合器签名链路<br>2. 签名过程中断或关闭确认页 | 1. 中断签名流程或关闭确认页<br>2. 重新进入 Market Swap 打开确认页 | 1. 当前确认上下文被正确清理<br>2. 重新进入时不复用旧签名上下文<br>3. 展示全新的确认流程 |
| ❗️❗️P0❗️❗️ | 1. 确认页已打开 | 1. 关闭确认页<br>2. 中途取消操作<br>3. 重新进入 Market Swap | 1. 主表单与确认页状态隔离<br>2. 不污染其他 Swap 页面<br>3. 不污染其他确认流程 |

---

## 5. 表单同步与关联回归

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. Market 详情页 Swap 表单已有输入<br>2. 在主表单做以下任一修改：<br>- 修改输入数量<br>- 切换 from / to token<br>- 切换买卖方向<br>- 重新获取 quote | 1. 完成修改并等待新报价<br>2. 打开确认页 | 1. 确认页数据与主表单保持一致<br>2. from / to token 与主表单一致<br>3. 数量与主表单一致<br>4. quote 与最新报价一致 |
| P1 | 1. 自定义 RPC 不可用或命中 fallback 条件的网络 | 1. 在该网络下进入 Market Swap<br>2. 获取报价后打开确认页 | 1. 可正常进入确认页<br>2. 按 fallback 逻辑完成后续流程，或给出正确提示 |
| ❗️❗️P0❗️❗️ | 1. Market 详情页新确认页已上线<br>2. 进入普通 Swap 页面（非 Market 详情页） | 1. 在普通 Swap 页面执行完整兑换流程：<br>- 选择 Token 对<br>- 获取报价<br>- 进入 Review / Pre-swap 确认<br>- 完成授权（如需要）<br>- 完成发送 | 1. 普通 Swap 页面原有 review / pre-swap 流程正常<br>2. 授权链路正常<br>3. 发送链路正常<br>4. 不受 Market Confirm Page V2 回归影响 |

---

## 变更记录

| 日期 | 版本说明 |
|------|----------|
| 2026-04-01 | 初版：Market Confirm Page V2 测试，覆盖入口生命周期、步骤编排、授权判定与费用刷新、异常状态切换、表单同步与关联回归 |
| 2026-04-20 | 规范头部（规则文档/测试端）、压缩前置条件为 2 行、术语 HD 钱包 |
