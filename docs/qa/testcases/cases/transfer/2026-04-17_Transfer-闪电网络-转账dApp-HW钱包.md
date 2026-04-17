# Transfer - 闪电网络 - 转账/dApp-HW钱包

> 不支持功能：❌ 代币转账（闪电网络无代币概念，仅主币 sats）
> HW 型号：Mini / Classic / Classic 1S / Touch / Pro（所有型号需回归测试）
> 边界：接收、连接授权、Withdraw、账户与 App UI 见 HD 用例，不在本文件覆盖

---

## 前置条件与测试数据

1. 已连接 HW 钱包，闪电账户 1 / 2 创建并完成通道建立；账户 1 有足够 sats 余额（含通道储备）
2. 测试发票：**指定金额发票**（含最小合法金额一条，≤ 余额 × 99%）、**未指定金额发票**各一
3. 闪电网络地址：`shortmen02@walletofsatoshi.com`、LNURL `lnurl1dp68gurn8ghj7ampd3kx2ar0veekzar0wd5xjtnrdakj7tnhv4kxctttdehhwm30d3h82unvwqhhx6r0wf6x6etwxqeq3p2554`
4. dApp：LNBlackjack（`https://www.lnblackjack.com`）、LNMarkets（`https://lnmarkets.com/en/`）

### HW 签名屏核对

| 型号 | 发送 / Deposit 签名屏字段 | LNURL 授权签名屏字段 |
| --- | --- | --- |
| Mini | 1. 发送方地址<br>2. 消息内容（创建时间 / 过期时间 / 发票码 / 发票描述） | 1. 标题 = `LNURL 授权`<br>2. 域名<br>3. 展示数据（k1 / action / host） |
| Classic / Classic 1S | 1. 标题 = `签署 Bitcoin 消息`<br>2. 发送方地址<br>3. 消息内容（创建时间 / 过期时间 / 发票码 / 发票描述） | 1. 标题 = `批准 LNURL 授权`<br>2. 域名<br>3. 展示数据（k1 / action / host） |
| Touch / Pro | 1. 标题 = `签署 Bitcoin 消息`<br>2. 消息内容（创建时间 / 过期时间 / 发票码 / 发票描述）<br>3. 发送方地址 | 1. 展示消息数据（k1 / action / host）<br>2. 域名 |

---

## 1. 参数化发送（发票 / LN Address / LNURL）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 指定金额发票 · 最小额 | 1. 粘贴最小合法金额指定金额发票 → 点击确认<br>2. 在硬件上逐步确认字段显示 | 1. 金额 = 发票载明金额（整数 sats）<br>2. 签名屏字段按上方型号表核对<br>3. 确认后上链成功；发送方余额扣除对应 sats |
| ❗️❗️P0❗️❗️ | 未指定金额发票 · Max | 1. 粘贴未指定金额发票 → 点「最大值」→ 点击确认<br>2. 在硬件上逐步确认字段显示 | 1. 金额 = 当前可用余额<br>2. 签名屏字段按上方型号表核对<br>3. 确认后上链成功；发送方余额扣除对应 sats |
| ❗️❗️P0❗️❗️ | LN Address · 中间值<br>`shortmen02@walletofsatoshi.com` | 1. 粘贴地址 → 输入中间值金额 →（可选填描述 ≤ 40 字符）→ 点击确认<br>2. 在硬件上逐步确认字段显示 | 1. 接收方 = LN Address；发票描述 = 填写内容（若有）<br>2. 签名屏字段按上方型号表核对<br>3. 确认后上链成功；发送方余额扣除对应 sats |
| ❗️❗️P0❗️❗️ | LNURL · 中间值<br>`lnurl1dp68gurn8ghj7ampd3kx2ar0veekzar0wd5xjtnrdakj7tnhv4kxctttdehhwm30d3h82unvwqhhx6r0wf6x6etwxqeq3p2554` | 1. 粘贴地址 → 输入金额 → 点击确认<br>2. 在硬件上逐步确认字段显示 | 1. 接收方 = LNURL 解析结果<br>2. 签名屏字段按上方型号表核对<br>3. 确认后上链成功；发送方余额扣除对应 sats |

---

## 2. dApp 支付（LNBlackjack Deposit）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | Deposit · 中间值（10,000 sats） | 1. 站点已连接 HW 钱包，选择「Deposit」<br>2. 输入金额（1 - 10,000,000 sats）→「Generate invoice」→「Open in wallet」<br>3. 在硬件上逐步确认字段显示 | 1. 发票描述 = `LNBlackjack.com`；金额 = 发票金额（整数 sats）<br>2. 签名屏字段按上方型号表核对<br>3. 确认后上链成功；dApp 到账；发送方余额扣除 |

---

## 3. LNURL-auth 授权登录（LNMarkets）

> 站点：`https://lnmarkets.com/en/`

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | 首次 Alby 登录 | 1. 浏览器打开 LNMarkets → 选择 Alby 登录<br>2. App 弹出授权页 → 点击「登录」<br>3. 在硬件上逐步确认字段显示 | 1. 域名 = `api.lnmarkets.com`<br>2. 签名屏字段按上方型号表核对<br>3. 确认后 App 授权弹窗关闭；站点显示「已登录」 |

---

## 4. 拒签与异常恢复

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 签名前 HW 断开 | 1. HW 已弹出签名请求<br>2. 确认前拔 USB / 断开蓝牙 | 1. App 显示「设备已断开」<br>2. 发送类余额未扣除；LNURL 场景站点保持未登录<br>3. 重连 HW 后可重试 |
| P1 | HW 拒绝签名 | 1. 发起发送 / Deposit / LNURL 登录至 HW 签名页<br>2. HW 点击「拒绝」 | 1. 发送 / Deposit：App 显示「交易已取消」；余额未扣除<br>2. LNURL 登录：App 显示「授权已取消」；站点显示「登录失败」<br>3. 可重新发起 |
| P1 | 签名后、App 广播前断网 | 1. HW 已按「确认」返回签名<br>2. App 广播前切断网络 | 1. App 显示「转账失败」<br>2. 恢复网络后重试：显示「转账成功」 |
