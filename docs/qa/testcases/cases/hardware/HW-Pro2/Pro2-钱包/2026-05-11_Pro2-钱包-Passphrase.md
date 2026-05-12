# Pro2 - 钱包 Passphrase

> 规则文档：`docs/qa/rules/hardware-rules.md`（§3 Passphrase）+ `docs/qa/rules/account-rules.md`（§6.4 / §6.7）
> 测试端：Pro2 设备端 + App（Desktop / Mobile / Extension，以产品支持为准）
> 变更说明：首版——覆盖 Passphrase 开关启用/禁用完整流程、Attach to PIN 入口联动、App 连接创建钱包分流、设备端 Passphrase 输入边界值

---

## 前置条件与测试数据

1. Pro2 设备已完成初始化（已创建标准钱包种子）
2. Pro2 已通过 USB / 蓝牙连接 App
3. App 端账户为已登录状态，可正常进入设备「钱包」设置页
4. 准备 bip39 离线推导工具（如 <https://iancoleman.io/bip39>）用于 EVM 地址核对
5. 测试 Passphrase 文本数据集（含空格 / 边界长度）：
   - 空（不输入，0 字符）
   - 1 个字符：`a`
   - 含空格中等长度（14 字符）：`my secret pass`
   - 50 个字符（最大值边界，大小写+数字混排）：`abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV12`

---

## 1. Passphrase 开启完整流程

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 默认关闭状态 | 1. App 连接 Pro2 后进入「钱包 → Passphrase」 | 1. Passphrase 开关默认处于**关闭**状态<br>2. 页面**不展示**「Attach to PIN」入口 |
| ❗️❗️P0❗️❗️ | 启用确认弹窗与风险提示 | 1. 点击 Passphrase 开关切换至开启 | 1. App 弹出 **Enable Passphrase** 确认页<br>2. 风险提示：**If forgotten, funds are permanently lost.**<br>3. Pro2 屏幕同步弹出 **Enable Passphrase** 确认，按键为 Cancel / Enable |
| ❗️❗️P0❗️❗️ | App 端取消启用 | 1. App 启用确认页点击「取消」 | 1. App 确认页关闭<br>2. Pro2 屏幕同步关闭确认<br>3. 开关保持**关闭**，不展示「Attach to PIN」入口 |
| ❗️❗️P0❗️❗️ | 硬件端取消启用 | 1. 再次点击 Passphrase 开关至开启<br>2. Pro2 屏幕按下 **Cancel** | 1. Pro2 与 App 确认页同步关闭<br>2. 开关保持**关闭**，不展示「Attach to PIN」入口 |
| ❗️❗️P0❗️❗️ | 启用确认 + 创建密语钱包 | 1. 再次点击 Passphrase 开关至开启<br>2. App 启用确认页点击「启用」<br>3. Pro2 屏幕按下 **Enable** 完成硬件确认<br>4. 进入 App 钱包选择器 → 添加钱包 → 选择 Pro2<br>5. 按引导完成 Passphrase 输入 | 1. 开关切换为**开启**，页面**展示**「Attach to PIN」入口<br>2. App 进入隐藏（密语）钱包创建路径<br>3. Passphrase 输入完成后创建成功<br>4. 钱包列表新增一条密语钱包记录 |

---

## 2. Passphrase 关闭完整流程

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 禁用确认弹窗与风险提示 | 1. Passphrase 已开启<br>2. 点击 Passphrase 开关切换至关闭 | 1. App 弹出 **Disable Passphrase** 确认页<br>2. 风险提示包含三条文案：<br>　• Wallets created with a passphrase stay on-chain<br>　• Need to turn passphrase back on to access them<br>　• If you forget the passphrase, the funds are permanently lost.<br>3. Pro2 屏幕同步弹出 **Disable Passphrase** 确认，按键为 Cancel / Disable |
| ❗️❗️P0❗️❗️ | App 端取消禁用 | 1. App 禁用确认页点击「取消」 | 1. App 与 Pro2 确认页同步关闭<br>2. 开关保持**开启**，「Attach to PIN」入口仍展示 |
| ❗️❗️P0❗️❗️ | 硬件端取消禁用 | 1. 再次点击 Passphrase 开关至关闭<br>2. Pro2 屏幕按下 **Cancel** | 1. App 与 Pro2 确认页同步关闭<br>2. 开关保持**开启**，「Attach to PIN」入口仍展示 |
| ❗️❗️P0❗️❗️ | 禁用确认 + 仅可创建标准钱包 | 1. 再次点击 Passphrase 开关至关闭<br>2. App 禁用确认页点击「禁用」<br>3. Pro2 屏幕按下 **Disable** 完成硬件确认<br>4. App 钱包选择器 → 添加钱包 → 选择 Pro2 | 1. 开关切换为**关闭**，页面**不展示**「Attach to PIN」入口<br>2. App **不**显示 Passphrase / 隐藏钱包选项<br>3. 直接进入标准钱包创建流程，创建成功 |

---

## 3. 设备端输入 Passphrase 边界值（开关已开启）

> 前置：Passphrase 开关已开启；App 连接 Pro2 创建钱包时选择「**在设备上输入 Passphrase**」。
> 每条用例完成后均需在 App 端核对生成的密语钱包 EVM 地址，与 bip39 工具（相同助记词 + 相同 Passphrase）推导地址一致。

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 设备上不输入（空 Passphrase，0 字符） | 1. 进入设备 Passphrase 输入界面<br>2. 不输入任何字符直接点击对勾<br>3. 设备屏幕显示 Passphrase 内容预览为空<br>4. 在设备端按确认键完成创建<br>5. 在 App 端点击「确定」完成钱包创建 | 1. 密语钱包创建成功<br>2. 生成的 EVM 地址 **与标准钱包地址一致**（空 Passphrase = 标准钱包）<br>3. 与 bip39 工具（空 Passphrase）推导地址一致 |
| ❗️❗️P0❗️❗️ | 设备上输入 1 个字符 | 1. 在设备上输入 `a`<br>2. 点击对勾<br>3. 设备屏幕预览显示 `a`<br>4. 在设备端按确认键完成创建<br>5. 在 App 端点击「确定」完成钱包创建 | 1. 密语钱包创建成功<br>2. EVM 地址与 bip39 工具（相同助记词 + Passphrase `a`）推导地址一致 |
| ❗️❗️P0❗️❗️ | 设备上输入含空格（14 字符） | 1. 在设备上输入 `my secret pass`<br>2. 点击对勾<br>3. 设备屏幕预览完整显示包含两个空格<br>4. 在设备端按确认键完成创建<br>5. 在 App 端点击「确定」完成钱包创建 | 1. 密语钱包创建成功，空格保留不被压缩<br>2. EVM 地址与 bip39 工具推导地址一致 |
| ❗️❗️P0❗️❗️ | 设备上输入 50 个字符（最大值边界） | 1. 在设备上输入 50 个字符 `abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV12`<br>2. 点击对勾<br>3. 设备屏幕预览完整显示 50 个字符不被截断<br>4. 在设备端按确认键完成创建<br>5. 在 App 端点击「确定」完成钱包创建 | 1. 密语钱包创建成功<br>2. EVM 地址与 bip39 工具推导地址一致 |
