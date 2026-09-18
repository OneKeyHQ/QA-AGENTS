# Hyperliquid - ApproveAgent 推荐绑定 Checkbox
> 生成时间：2026-01-04
> 规则文档：docs/qa/rules/perps-rules.md
> 测试端：iOS / Android / Desktop / Extension / Web（Hyperliquid 网页版签名弹窗）
> 变更说明：2026-09-18 按 app x 分支（4b038c2）实际行为修正：只在 Hyperliquid 网页版签名 ApproveAgent 时显示 Checkbox，内置「启用交易」无 Checkbox 直接绑定；删除余额为 0 条件；Checkbox 文案「使用 OneKey 邀请码，Hyperliquid 手续费立减 4%」，不显示 1KREF；取消勾选后 2 周内默认未选中；HW 拒绝只在绑定签名被拒时记录；新增 §6 其他场景<br>2026-09-18 二轮精简：全文去英文标识符、合并重复验证点

## 前置条件

- 触发路径：在 Hyperliquid 网页版（app.hyperliquid.xyz）发起 ApproveAgent 签名时，签名确认弹窗底部显示 Checkbox；内置 Perps「启用交易」流程不显示 Checkbox，签名后自动绑定邀请码
- 显示条件：HD / HW / 导入钱包账户，Hyperliquid 普通账户（非金库 / 子账户），未绑定推荐人；不检查余额
- 取消勾选后按账户记录 2 周，期间默认未选中；重新勾选立即清除记录
- Checkbox 文案「使用 OneKey 邀请码，Hyperliquid 手续费立减 4%」，界面不显示邀请码 1KREF
- 勾选并确认后，先签 ApproveAgent，再签一次邀请码绑定

## 1. Checkbox 显示条件（主流程）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 已登录 HD 钱包<br>2. 未绑定推荐人 | 1. 在 Hyperliquid 网页版发起 ApproveAgent 签名 | 1. Checkbox 显示<br>2. Checkbox 选中<br>3. 文案为「使用 OneKey 邀请码，Hyperliquid 手续费立减 4%」，不显示「1KREF」 |
| ❗️❗️P0❗️❗️ | 1. 已登录<br>2. 已绑定推荐人 | 1. 在 Hyperliquid 网页版发起 ApproveAgent 签名 | 1. Checkbox 不显示<br>2. 推荐绑定文案不显示 |
| ❗️❗️P0❗️❗️ | 1. 已登录<br>2. 未绑定推荐人 | 1. 在 Hyperliquid 网页版发起非 ApproveAgent 签名（下单等） | 1. Checkbox 不显示<br>2. 推荐绑定文案不显示 |
| ❗️❗️P0❗️❗️ | 1. 观察钱包<br>2. 未绑定推荐人 | 1. 切换到观察钱包，发起 ApproveAgent 签名 | 1. Checkbox 不显示<br>2. 推荐绑定文案不显示 |
| ❗️❗️P0❗️❗️ | 1. 账户余额与可提金额均为 0<br>2. 其余显示条件满足 | 1. 切换到余额为 0 的账户，发起 ApproveAgent 签名 | 1. Checkbox 显示且选中<br>2. 勾选确认后发起邀请码绑定签名 |

---

## 2. Checkbox 默认状态与交互

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 满足显示条件<br>2. 首次进入 | 1. 进入 ApproveAgent 签名页面 | 1. Checkbox 显示<br>2. Checkbox 选中 |
| ❗️❗️P0❗️❗️ | 1. 满足显示条件<br>2. Checkbox 已显示 | 1. 取消勾选后关闭页面<br>2. 再次进入 ApproveAgent 签名页面<br>3. 重新勾选后关闭，再次进入 | 1. 步骤 2：Checkbox 未选中，2 周内每次进入均未选中，2 周后恢复选中<br>2. 步骤 3：Checkbox 选中 |
| ❗️❗️P0❗️❗️ | 1. 满足显示条件<br>2. HW 钱包 | 1. 保持默认勾选，点击确认，HW 上确认 ApproveAgent 签名<br>2. HW 上拒绝随后的邀请码绑定签名<br>3. 再次进入 ApproveAgent 签名页面 | 1. ApproveAgent 签名结果返回网页，网页流程继续<br>2. 再次进入时 Checkbox 未选中<br>3. 若在步骤 1 拒绝的是 ApproveAgent 签名本身，不记录取消，下次进入仍选中 |
| P1 | 1. 满足显示条件<br>2. Checkbox 选中 | 1. 点击「确认」完成 ApproveAgent 签名<br>2. 完成邀请码绑定签名 | 1. 签名结果返回网页<br>2. 绑定请求包含邀请码「1KREF」，绑定后推荐人显示为已绑定 |

---

## 3. 多账户切换场景

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| ❗️❗️P0❗️❗️ | 1. 账户 A：未绑定推荐人<br>2. 账户 B：已绑定推荐人 | 1. 账户 A 进入 ApproveAgent 签名页面<br>2. 切换到账户 B 进入 | 1. 账户 A：Checkbox 显示<br>2. 账户 B：Checkbox 不显示 |
| ❗️❗️P0❗️❗️ | 1. 账户 A：未绑定推荐人，已取消勾选<br>2. 账户 B：未绑定推荐人，未操作过 | 1. 账户 A 取消勾选 Checkbox<br>2. 切换到账户 B 进入 ApproveAgent 签名页面 | 1. 账户 A：Checkbox 未选中<br>2. 账户 B：Checkbox 选中 |
| P1 | 1. 多个账户，部分满足显示条件 | 1. 依次切换到每个账户发起 ApproveAgent 签名 | 1. 满足条件的账户：Checkbox 显示<br>2. 不满足的账户：Checkbox 不显示 |

---

## 4. 文案验证

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| P1 | 1. 满足显示条件<br>2. 语言=中文 | 1. 进入 ApproveAgent 签名页面 | 1. Checkbox 文案为「使用 OneKey 邀请码，Hyperliquid 手续费立减 4%」 |
| P1 | 1. 满足显示条件<br>2. 语言=英文 | 1. 进入 ApproveAgent 签名页面 | 1. Checkbox 文案为「Get 4% off Hyperliquid fees with OneKey's code」 |
| P1 | 1. 满足显示条件 | 1. 进入 ApproveAgent 签名页面 | 1. 不显示「1KREF」<br>2. Checkbox 位于底部操作栏上方，与风险确认 Checkbox 同一区域 |

---

## 5. 边界与异常场景

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| P1 | 1. 满足显示条件<br>2. 频繁操作 | 1. 连续进入 ApproveAgent 签名页面 5 次 | 1. 每次进入 Checkbox 显示<br>2. 未取消过：每次选中<br>3. 取消过：每次未选中 |
| P2 | 1. 满足显示条件<br>2. 网络异常 | 1. 进入 ApproveAgent 签名页面，Checkbox 已显示<br>2. 断开网络<br>3. 恢复网络 | 1. 断网后 Checkbox 仍显示<br>2. 恢复后状态不变 |
| P2 | 1. 满足显示条件<br>2. 页面刷新 | 1. 取消勾选 Checkbox<br>2. 刷新页面后再次进入 | 1. Checkbox 未选中 |

---

## 6. 其他场景

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|---------|---------|
| P1 | 内置「启用交易」流程 | 1. 在内置 Perps 页面点击「启用交易」并完成签名 | 1. 全程不显示 Checkbox<br>2. 签名后自动绑定 1KREF 并自动完成手续费授权 |
| P2 | 离线进入签名页面 | 1. 断网后发起 ApproveAgent 签名 | 1. Checkbox 不显示 |
| P2 | 推荐人信息接口异常 | 1. 推荐人信息接口异常、账户信息接口可用时发起 ApproveAgent 签名 | 1. Checkbox 显示 |
| P2 | 绑定失败不影响签名 | 1. 勾选确认后邀请码绑定请求失败 | 1. 网页收到签名结果，签名流程不中断<br>2. 无绑定失败提示 |
