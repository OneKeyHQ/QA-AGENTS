# Pro2 - 我的地址 Passphrase 钱包与助记词位数

> 规则文档：`docs/qa/rules/hardware-rules.md`（§13 Pro2 我的地址）
> 测试端：Pro2 设备端 + App（Desktop / Mobile / Extension，以产品支持为准）
> 变更说明：覆盖 Passphrase 启用后的输入弹窗、切换 Passphrase 入口、会话保持与锁屏重置、空值等价标准钱包、关闭后入口消失、不同位数助记词（导入 / 创建 12-18-24 位）× 标准钱包 + Passphrase 钱包双验证矩阵

---

## 前置条件与测试数据

1. Pro2 设备已激活，准备测试用助记词：
   - 助记词 A：12 位（可设备创建或外部导入）
   - 助记词 B：18 位
   - 助记词 C：24 位
2. App 端可导入相同助记词，并能输入 Passphrase 连接HW 钱包进行地址核对
3. Passphrase 测试集：`Hello1!` / `onekey` / `12345` / `12` / `18` / `24` / 空字符串
4. 不同位数助记词 × 标准 / Passphrase 矩阵的测试 Account：

| # | 助记词来源 | 位数 | 标准钱包 Account | Passphrase | Passphrase 钱包 Account |
|---|-----------|------|---------------|-----------|----------------------|
| M1 | 导入 | 18 | #188 | `onekey` | #188 |
| M2 | 导入 | 24 | #2024 | `12345` | #2024 |
| M3 | 创建 | 12 | #12 | `12` | #12 |
| M4 | 创建 | 18 | #18 | `18` | #18 |
| M5 | 创建 | 24 | #24 | `24` | #24 |

5. Passphrase 开关入口：设备设置 → Passphrase

---

## 1. Passphrase 启用 → 进入网络弹出输入框

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 启用 Passphrase 后首次进入网络 | 1. 设备设置 → 启用 Passphrase 开关<br>2. 进入「我的地址」选 Account #5<br>3. 点击 Bitcoin | 1. 弹出 Passphrase 输入弹窗<br>2. 输入框可输入字符<br>3. 显示确认按钮 |
| ❗️❗️P0❗️❗️ | 输入 Passphrase 确认后进入地址展示 | 1. 在弹窗输入 `Hello1!`<br>2. 点击确认 | 1. 弹窗关闭<br>2. 跳转 Bitcoin 地址详情页<br>3. 显示该 Passphrase 钱包下 Account #5 的 Bitcoin 地址 |

---

## 2. 切换 Passphrase 入口

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 「选择网络」页右上角切换 Passphrase 入口 | 1. 已启用 Passphrase 且已进入「选择网络」页 | 右上角显示「切换 Passphrase」按钮 |
| ❗️❗️P0❗️❗️ | 切换 Passphrase 输入新值 | 1. 点击「切换 Passphrase」按钮<br>2. 弹窗显示输入框<br>3. 输入新 Passphrase（如从 `Hello1!` 切换到 `onekey`）<br>4. 点击确认<br>5. 选择任一网络查看地址 | 1. 弹窗接受新输入并关闭<br>2. 地址详情页显示已切换为新 Passphrase 钱包的地址<br>3. 显示的地址与原 Passphrase 钱包不同 |
| ❗️❗️P0❗️❗️ | 关闭 Passphrase 后入口消失 | 1. 设备设置 → 关闭 Passphrase 开关<br>2. 进入「我的地址」 | 1. 直接进入「选择网络」页（无 Passphrase 输入弹窗）<br>2. 右上角不显示「切换 Passphrase」按钮<br>3. 进入任一网络直接显示标准钱包地址 |

---

## 3. 同一会话保持 Passphrase

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 切换网络不重复输入 Passphrase | 1. 启用 Passphrase 且首次输入 `Hello1!` 后进入 Bitcoin 地址详情<br>2. 返回「选择网络」页<br>3. 依次点击 Ethereum / Solana / Tron / Kaspa 等其他网络 | 1. 不再弹出 Passphrase 输入框<br>2. 各网络直接显示当前 Passphrase 钱包下的地址<br>3. 地址与该 Passphrase 钱包一一对应 |

---

## 4. 锁屏后重新输入 Passphrase

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 锁屏再解锁后会话重置 | 1. 已输入 `Hello1!` 进入 Bitcoin 地址详情<br>2. 锁屏设备<br>3. 重新解锁并进入「我的地址」<br>4. 点击任一网络 | 1. 重新弹出 Passphrase 输入弹窗<br>2. 必须重新输入 Passphrase 才能进入地址详情<br>3. 之前的会话状态不被记忆 |

---

## 5. Passphrase 钱包内地址与功能核对

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | Passphrase 钱包各网络地址核对 | 1. 输入 `Hello1!` 进入 Passphrase 钱包<br>2. 选 Account #5<br>3. 依次查看所有 27 个网络地址<br>4. App 端连接HW 钱包同 Passphrase 后核对 | 1. 各网络地址分段显示<br>2. 与 App 端连接HW 钱包后地址逐一一致 |
| ❗️❗️P0❗️❗️ | Passphrase 钱包派生路径切换 | 1. Passphrase 钱包内分别进入 Bitcoin / Ethereum / Solana / Litecoin 地址详情<br>2. 依次切换可选派生路径<br>3. App 端连接HW 钱包后核对 | 1. 显示派生路径切换入口<br>2. 切换后地址与 App 端 Passphrase 钱包对应路径地址一致<br>3. 同链不同路径地址不同 |
| ❗️❗️P0❗️❗️ | Passphrase 钱包二维码扫描 | 1. 在地址详情页点击 `QR Code`<br>2. 扫描二维码 | 1. 二维码中央显示对应网络 icon<br>2. 扫描解析地址与设备屏幕显示地址逐字符一致 |

---

## 6. Passphrase 空值等价标准钱包

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 空 Passphrase 等价标准钱包 | 1. 启用 Passphrase 后进入「我的地址」<br>2. 选 Account #5<br>3. 点击 Bitcoin<br>4. 在 Passphrase 输入框留空，直接点击确认<br>5. 关闭 Passphrase 开关后再次查看 Account #5 Bitcoin 地址 | 1. 进入 Bitcoin 地址详情页<br>2. 空 Passphrase 钱包显示的地址与关闭 Passphrase 后标准钱包 Account #5 Bitcoin 地址逐字符一致 |

---

## 7. 不同位数助记词矩阵（标准 + Passphrase 双验证）

> 测试方法：每个矩阵分支独立执行；每个分支步骤一致 — 重置设备 → 导入或创建对应位数助记词 → 验证标准钱包指定 Account → 启用 Passphrase 后验证 Passphrase 钱包同 Account。所有地址核对均与 App 端导入相同助记词 + Passphrase 后比对。

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | M1：18 位导入 → Account #188 | 1. 重置设备<br>2. 导入 18 位助记词<br>3. 进入「我的地址」输入 `188` 跳转 Account #188<br>4. 依次查看各网络标准钱包地址<br>5. 启用 Passphrase 输入 `onekey` 后选 Account #188<br>6. 依次查看 Passphrase 钱包各网络地址<br>7. App 端导入相同 18 位助记词 + Passphrase `onekey` 核对 | 1. 标准钱包 Account #188 各链地址与 App 端一致<br>2. Passphrase 钱包 Account #188 各链地址与 App 端 Passphrase `onekey` 钱包一致<br>3. 标准与 Passphrase 钱包地址不同 |
| P1 | M2：24 位导入 → Account #2024 | 1. 重置设备 → 导入 24 位助记词<br>2. 输入 `2024` 跳转 Account #2024<br>3. 验证标准钱包<br>4. 启用 Passphrase 输入 `12345` 验证 Passphrase 钱包<br>5. App 端核对 | 同 M1 模式：标准 + Passphrase 钱包各链地址均与 App 端一致 |
| P1 | M3：12 位创建 → Account #12 | 1. 重置设备 → 设备创建 12 位助记词<br>2. 输入 `12` 跳转 Account #12<br>3. 验证标准钱包<br>4. 启用 Passphrase 输入 `12` 验证 Passphrase 钱包<br>5. App 端导入助记词后核对 | 同 M1 模式 |
| P1 | M4：18 位创建 → Account #18 | 1. 重置设备 → 设备创建 18 位助记词<br>2. 输入 `18` 跳转 Account #18<br>3. 验证标准钱包<br>4. 启用 Passphrase 输入 `18` 验证 Passphrase 钱包<br>5. App 端核对 | 同 M1 模式 |
| P1 | M5：24 位创建 → Account #24 | 1. 重置设备 → 设备创建 24 位助记词<br>2. 输入 `24` 跳转 Account #24<br>3. 验证标准钱包<br>4. 启用 Passphrase 输入 `24` 验证 Passphrase 钱包<br>5. App 端核对 | 同 M1 模式 |
