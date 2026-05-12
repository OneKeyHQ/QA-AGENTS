# Pro2 - SeedCard 恢复钱包

> 规则文档：`docs/qa/rules/hardware-rules.md`（§10.2 / §10.3 / §10.7）
> 测试端：Pro2 设备端 + App（Desktop / Mobile / Extension）
> 变更说明：覆盖恢复入口选择、SeedCard ID 检查、PIN 输入与错误次数显示、备份未找到、不支持的助记词、卡片自毁与永久禁用、跨设备/App 恢复验证

---

## 前置条件与测试数据

1. 准备已写入合法备份的 SeedCard：12 / 18 / 24 位各一张，且各卡 SeedCard PIN 已知
2. 准备空 SeedCard 一张（无任何备份）
3. 准备写入 25 位（非 12/18/24）助记词的 SeedCard 一张，用于 Unsupported Recovery Phrase 场景
4. Pro2 待恢复设备处于「重置后未导入钱包」状态；额外准备 App 端用于验证导入一致性
5. 用例 §5 自毁场景需要单独准备一张测试卡，避免污染其他备份卡

---

## 1. 恢复入口与卡片识别

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | Restore Wallet 入口 | 1. App 端进入「恢复钱包」<br>2. 查看恢复方式选项 | 1. 显示「Recovery Phrase」与「OneKey SeedCard」两个入口<br>2. 文案「Select the way you want to restore.」 |
| ❗️❗️P0❗️❗️ | 选择 OneKey SeedCard 后识卡 | 1. 选择 OneKey SeedCard<br>2. 显示「Looking for SeedCard」<br>3. 贴卡 | 1. 文案切换为「Keep Holding SeedCard」<br>2. 读取完成跳转 SeedCard ID 检查页 |
| ❗️❗️P0❗️❗️ | ID 检查页字段 | 1. 识卡完成进入 ID 检查页 | 1. 显示 Name（卡名称）<br>2. 显示 Model = `OneKey SeedCard`<br>3. 显示 ID（如 `OKLCD1B0000X`）<br>4. 显示 Version<br>5. 显示 Restore Wallet 按钮 |
| ❗️❗️P0❗️❗️ | ID 检查页可继续 | 1. ID 检查页点击 Restore Wallet | 跳转「Enter SeedCard PIN」页 |
| P1 | 识卡过程松动 | 1. 识卡过程中卡片移开 | 显示「Connection Failed」+「Hold the SeedCard firmly against the back of the device, then try again」+ Back / Try Again |

---

## 2. SeedCard PIN 输入

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 输入正确 PIN 恢复 12 位钱包 | 1. 贴入 12 位备份的卡<br>2. Enter SeedCard PIN 输入正确 PIN<br>3. 再次贴卡读取 | 1. 显示「Keep Holding SeedCard」<br>2. 读取完成跳转「Wallet Ready」<br>3. 文案「Your wallet has been recovered」<br>4. 点 Continue 进入 App 钱包页<br>5. 钱包列表新增导入钱包，账户地址与原钱包一致 |
| ❗️❗️P0❗️❗️ | 输入正确 PIN 恢复 18 位钱包 | 1. 贴入 18 位备份的卡<br>2. 输入正确 PIN<br>3. 完成读取 | 同上；新增的钱包对应 18 位助记词原钱包 |
| ❗️❗️P0❗️❗️ | 输入正确 PIN 恢复 24 位钱包 | 1. 贴入 24 位备份的卡<br>2. 输入正确 PIN<br>3. 完成读取 | 同上；新增的钱包对应 24 位助记词原钱包 |

---

## 3. PIN 错误与剩余次数

> 默认 Protection Mode = Erase Backup。10 次错误后仅擦除备份数据，卡片硬件仍可重置后重新写入。

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 第 1 次 PIN 错误 | 1. Enter SeedCard PIN 输入错误 PIN<br>2. 点击对勾 | 1. 显示「Wrong PIN」红色叉<br>2. 文案「9 PIN attempts left before this SeedCard is erased」（红字）<br>3. 显示 Got It |
| ❗️❗️P0❗️❗️ | ID 检查页同步显示剩余次数 | 1. 错误 1 次后点 Got It 重试<br>2. 重新识卡进入 ID 检查页 | ID 检查页顶部显示「N PIN attempts left before this SeedCard is erased」红色提示 |
| ❗️❗️P0❗️❗️ | 错误次数累计（4 次后） | 1. 累计错误 6 次<br>2. 再次进入 ID 检查页 | 剩余次数文案显示「4 PIN attempts left before this SeedCard is erased」 |
| ❗️❗️P0❗️❗️ | 第 10 次错误触发自毁（Erase Backup 模式） | 1. 已累计错误 9 次<br>2. 第 10 次仍输入错误 PIN | 1. 显示「SeedCard Reset」红色叉<br>2. 文案「Too many wrong PIN attempts. This SeedCard has been erased to protect your backup」<br>3. 显示 Got It<br>4. 后续贴卡识别为空卡（可重新备份） |

---

## 4. 卡片状态异常

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 贴入空卡 | 1. 恢复流程贴入未写入备份的空卡 | 1. 显示「No Backup Found」红色叉<br>2. 文案「Use another SeedCard and try again」<br>3. 显示 Go Back 按钮 |
| ❗️❗️P0❗️❗️ | 贴入不支持位数的卡 | 1. 恢复流程贴入写入 25 位助记词的卡 | 1. 显示「Unsupported Recovery Phrase」红色叉<br>2. 文案「Device supports only 12, 18, 24-word recovery phrases. This SeedCard cannot be restored here」<br>3. 显示 Got It 按钮 |
| ❗️❗️P0❗️❗️ | 永久禁用卡恢复尝试 | 1. 贴入 Protection Mode = Disable Permanently 模式下已自毁的卡 | 1. 显示「SeedCard Unavailable」<br>2. 文案「You can recover using another method or another SeedCard」<br>3. 显示 Got It；卡片不可重置不可恢复 |
| P1 | Connection Failed 重试 | 1. 识卡过程卡片移开导致失败<br>2. 点击 Try Again<br>3. 稳定贴卡 | 重新识卡成功，继续后续流程 |
| P1 | No Backup Found 返回 | 1. No Backup Found 页点击 Go Back | 回到「恢复方式」选择页 |

---

## 5. 跨设备 / App 恢复验证

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | Pro2 备份卡导入到 App | 1. 在 Pro2 上用空卡完成钱包备份<br>2. App 端选择「使用 SeedCard 恢复」<br>3. 贴卡 + 输入 PIN 完成导入<br>4. 在 App 端打开备份功能查看助记词 | 1. 钱包成功导入 App<br>2. 助记词与原硬件钱包助记词一致<br>3. 地址逐链核对一致 |
| ❗️❗️P0❗️❗️ | Pro2 备份卡导入到另一台 Pro2 | 1. 在原 Pro2 完成 SeedCard 备份<br>2. 在另一台 Pro2 上选择恢复 → OneKey SeedCard<br>3. 贴卡 + 输入 PIN 完成<br>4. 连接 App 查看导入钱包地址 | 1. 新 Pro2 上钱包恢复成功<br>2. 地址与原 Pro2 上钱包逐链一致 |
| ❗️❗️P0❗️❗️ | 原 Pro2 重置后再导入 | 1. 原 Pro2 已备份到 SeedCard<br>2. 重置原 Pro2 设备<br>3. 重置后用相同 SeedCard 恢复钱包 | 1. 钱包恢复成功<br>2. 连接 App 查看地址与重置前一致 |
| P1 | 18 / 24 位卡的跨设备导入 | 1. 重复以上三条场景，分别使用 18 / 24 位备份卡 | 1. 三种位数均能导入成功<br>2. 助记词与地址逐链核对一致 |

---

## 6. 回退路径

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | Looking for SeedCard 取消 | 1. 识卡阶段点击 Cancel | 回到「恢复方式」选择页 |
| P1 | ID 检查页返回 | 1. ID 检查页点击左上角返回 | 回到「恢复方式」选择页 |
| P1 | Enter SeedCard PIN 取消 | 1. PIN 输入页点击 ×（取消） | 回到「恢复方式」选择页；本次错误计数不变 |
| P1 | Keep Holding SeedCard 取消 | 1. 识卡读取页点击 Cancel | 回到 Enter SeedCard PIN 页，可重新读取 |
