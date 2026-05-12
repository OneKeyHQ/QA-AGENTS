# Pro2 - SeedCard 管理与防护

> 规则文档：`docs/qa/rules/hardware-rules.md`（§10.3 / §10.4 / §10.5 / §10.6）
> 测试端：Pro2 设备端 + App（Desktop / Mobile / Extension）
> 变更说明：覆盖 Manage SeedCard 全流程（Set Name / Title / Change PIN / Reset）、Protection Mode 双模式、Backup Settings 切换（PIN Only ↔ Recovery Phrase）、Recovery Phrase 验证流程

---

## 前置条件与测试数据

1. 准备已写入合法备份且 PIN 已知的 SeedCard ≥ 3 张，覆盖 Erase Backup（默认）与 Disable Permanently 两种 Protection Mode 测试
2. 当前钱包的助记词副本已记录，供 Recovery Phrase 验证使用；同时准备另一组合法但不属于当前钱包的助记词（用于 Wrong Recovery Phrase 场景）
3. 设备 PIN 已知；测试用新 SeedCard PIN 数据集：`1234`（4 位下限）、`123456789`（9 位上限）、`5678`（中间值）
4. App 端账户已登录，可正常连接 Pro2

---

## 1. 管理入口与卡片识别

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 进入 Manage SeedCard | 1. App 端「钱包 → 备份 → OneKey SeedCard」<br>2. 选择 Manage 入口<br>3. 贴卡识别 | 1. 进入 ID 检查页<br>2. 显示 Name / Model / ID / Version<br>3. 显示 Manage SeedCard 按钮 |
| ❗️❗️P0❗️❗️ | Unlock to Manage（含已耗损 PIN 次数） | 1. 卡片已累计部分 PIN 错误<br>2. 触发 Manage 流程贴卡 | 1. ID 检查页顶部显示红色「N PIN attempts left before this SeedCard is erased」<br>2. 按钮为 Unlock to Manage<br>3. 点击进入 Enter SeedCard PIN 页 |
| ❗️❗️P0❗️❗️ | Manage Your Card 入口列表 | 1. 输入正确 PIN 进入 Manage Your Card 页 | 顺序展示四项：<br>1. Set Name<br>2. Title 开关<br>3. Protection Mode<br>4. Reset |

---

## 2. Set Name 与 Title

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 修改卡片名称 | 1. Manage Your Card 点击 Set Name<br>2. 清空原名称输入 `OneKey Pro 2`<br>3. 点击对勾<br>4. 贴卡完成写入 | 1. 键盘页可输入文本<br>2. Looking for SeedCard → Keep Holding SeedCard<br>3. 写入完成显示「This Is OneKey Pro 2」<br>4. 返回 Manage 页名称字段更新 |
| P1 | Set Name 输入空字符串 | 1. Set Name 清空名称<br>2. 点击对勾 | 对勾按钮不可点击，或提示名称不可为空 |
| P1 | Set Name 输入 Emoji / Unicode | 1. 输入 `测试🚀` | 1. 显示完整字符<br>2. 写入完成后卡片名称包含 Emoji |
| P1 | Set Name 取消 | 1. 输入名称后点击 Cancel | 名称未更新，返回 Manage 页 |
| ❗️❗️P0❗️❗️ | Title 开关切换 | 1. Title 开关从关闭切换为开启<br>2. 贴卡写入 | 1. 弹出贴卡识卡<br>2. 写入完成 Title 状态保持开启<br>3. 卡片正面附加机型 / 钱包名印章 |
| P1 | Title 开关再关闭 | 1. Title 开关切回关闭<br>2. 贴卡写入 | 写入完成 Title 状态关闭 |

---

## 3. Change SeedCard PIN

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | Change PIN 入口与文案 | 1. Manage Your Card 中触发 Change PIN（如果作为 Set Name / Reset 之外的独立项展示） | 1. 显示「Change SeedCard PIN」<br>2. 文案「Choose a new PIN between 4 and 9 digits」<br>3. 按钮：Cancel / Continue |
| ❗️❗️P0❗️❗️ | 修改 PIN 成功 | 1. 点击 Continue<br>2. Enter New PIN 输入 `5678`<br>3. Enter PIN Again 输入 `5678`<br>4. 贴卡完成写入 | 1. 两次 PIN 一致<br>2. Looking for SeedCard → Keep Holding SeedCard<br>3. 写入完成显示「PIN Changed」<br>4. 文案「Your PIN has been changed」<br>5. 点击 Done 返回 Manage 页 |
| ❗️❗️P0❗️❗️ | 新 PIN 两次不一致 | 1. Enter New PIN 输入 `5678`<br>2. Enter PIN Again 输入 `1234`<br>3. 点击对勾 | 1. 显示「PINs don't match」<br>2. 点 Try Again 返回 Enter New PIN，输入清空 |
| ❗️❗️P0❗️❗️ | 新 PIN 设置生效 | 1. PIN 已修改为 `5678`<br>2. 触发 Manage 或恢复贴卡<br>3. 输入旧 PIN `1234` | 显示 Wrong PIN + 剩余次数文案；改输入新 PIN `5678` 才可继续 |
| P1 | Change PIN 写卡阶段断开 | 1. Looking for SeedCard 阶段移开卡<br>2. 观察提示 | 显示 Connection Failed + Back / Try Again；PIN 未变更，旧 PIN 仍可用 |
| P1 | Change PIN 取消 | 1. Enter New PIN 页点击 Cancel | 回到 Manage Your Card 页；PIN 保持不变 |

---

## 4. Reset SeedCard

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | Reset 二次确认 | 1. Manage Your Card 点击 Reset<br>2. 查看弹窗内容 | 1. 标题「Reset SeedCard」<br>2. 文案「All data on this SeedCard will be erased and cannot be recovered.」<br>3. 按钮：Cancel / Reset（Reset 红色高亮） |
| ❗️❗️P0❗️❗️ | Reset 取消 | 1. 二次确认弹窗点击 Cancel | 关闭弹窗回到 Manage 页；卡片数据保持不变 |
| ❗️❗️P0❗️❗️ | Reset 执行 | 1. 点击 Reset<br>2. 贴卡完成擦除 | 1. Looking for SeedCard → Keep Holding SeedCard<br>2. 完成显示「Reset complete. This card has been erased.」<br>3. 显示 Done 按钮<br>4. 后续贴卡识别为空卡（可重新备份） |

---

## 5. Protection Mode（PIN 防护策略）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | Protection Mode 默认值 | 1. 新写入备份的卡进入 Manage Your Card<br>2. 点击 Protection Mode | 1. 弹窗文案「Choose what happens after 10 wrong PIN attempts.」<br>2. Erase Backup 默认选中<br>3. Disable SeedCard Permanently 未选中<br>4. Confirm 按钮置灰 |
| ❗️❗️P0❗️❗️ | 切换到 Disable Permanently 二次确认 | 1. 选择 Disable SeedCard Permanently<br>2. 点击 Confirm | 1. 弹出二次警告「Permanently Disable SeedCard」<br>2. 文案「PIN attempts: SeedCard will be permanently disabled. It cannot be restored, reset, or used again.」<br>3. 按钮：Cancel / Continue |
| ❗️❗️P0❗️❗️ | 切换到 Disable Permanently 落地 | 1. 二次警告点击 Continue<br>2. Enter Device PIN 输入正确设备 PIN<br>3. 贴卡完成写入 | 1. Looking for SeedCard → Keep Holding SeedCard<br>2. 完成显示「Protection Mode Changed」<br>3. 文案「You have successfully changed protection mode.」<br>4. 点 Done 返回 |
| ❗️❗️P0❗️❗️ | Disable Permanently 模式下连续 10 次错误 PIN | 1. 卡片 Protection Mode = Disable Permanently<br>2. 在恢复 / 管理流程连续输入错误 PIN 10 次 | 1. 第 10 次后卡片被永久禁用<br>2. 显示「SeedCard Unavailable」<br>3. 文案「You can recover using another method or another SeedCard」<br>4. 后续任何贴卡操作不可识别为可写入 / 可恢复，**无法 Reset、无法重新备份** |
| ❗️❗️P0❗️❗️ | Erase Backup 模式下连续 10 次错误 PIN | 1. 卡片 Protection Mode = Erase Backup（默认）<br>2. 连续输入错误 PIN 10 次 | 1. 第 10 次后显示「SeedCard Reset」<br>2. 卡内备份数据被擦除<br>3. 卡片可作为空卡重新备份 |
| ❗️❗️P0❗️❗️ | 切回 Erase Backup | 1. 当前模式为 Disable Permanently<br>2. Protection Mode 弹窗选择 Erase Backup<br>3. 点击 Confirm → 输入设备 PIN → 贴卡 | 1. 不再弹出二次警告<br>2. 写入完成显示 Protection Mode Changed<br>3. 模式落地为 Erase Backup |
| P1 | Protection Mode 取消 | 1. Protection Mode 弹窗点击 Cancel | 关闭弹窗；模式保持当前值不变 |
| P1 | Permanently Disable 二次警告取消 | 1. Disable Permanently 二次警告页点击 Cancel | 回到 Protection Mode 弹窗；选项仍可调整 |

---

## 6. Backup Settings（验证模式切换）

> Backup Settings 入口位于备份页右上角齿轮图标，控制后续备份 / 迁移是否需要 Recovery Phrase 验证。配置绑定钱包/账户，不绑定单张 SeedCard。

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 入口与默认值 | 1. 备份页点击齿轮图标 | 1. 弹出 Backup Settings 弹窗<br>2. 文案「Choose how to verify future backups and migrations.」<br>3. PIN Only 默认选中<br>4. Recovery Phrase 未选中<br>5. 按钮：Cancel / Confirm |
| ❗️❗️P0❗️❗️ | PIN Only → Recovery Phrase（开启 Recovery Phrase 验证） | 1. 选择 Recovery Phrase<br>2. 点击 Confirm | 1. 弹出二次确认「Require Recovery Phrase」<br>2. 文案「Future backups and migrations will require recovery phrase verification.」<br>3. 按钮：Cancel / Confirm |
| ❗️❗️P0❗️❗️ | Require Recovery Phrase 确认落地 | 1. 二次确认点击 Confirm | 1. 设置保存为 Recovery Phrase<br>2. 备份页顶部显示「Recovery phrase verification is enabled. Change it in Backup Settings.」<br>3. 下次发起备份时进入 Recovery Phrase 验证前置流程 |
| ❗️❗️P0❗️❗️ | Recovery Phrase → PIN Only（解除验证） | 1. 当前配置为 Recovery Phrase<br>2. 备份设置选择 PIN Only<br>3. 点击 Confirm | 1. 弹出二次确认「Verify Recovery Phrase」<br>2. 文案「To switch to PIN only, verify your recovery phrase first.」<br>3. 按钮：Cancel / Confirm |
| ❗️❗️P0❗️❗️ | Verify Recovery Phrase 通过后落地 | 1. 二次确认点击 Confirm 进入助记词验证<br>2. 选择正确位数<br>3. 逐词输入正确助记词<br>4. 点击 Continue | 1. 助记词验证通过<br>2. 设置切换为 PIN Only<br>3. 备份页 Recovery Phrase 验证提示消失 |
| P1 | Backup Settings 取消 | 1. Backup Settings 弹窗点击 Cancel | 关闭弹窗；配置保持当前值不变 |
| P1 | Require Recovery Phrase 二次确认取消 | 1. 二次确认弹窗点击 Cancel | 1. 关闭弹窗<br>2. 配置未变更<br>3. 备份页仍为原状态 |

---

## 7. Recovery Phrase 验证流程

> 触发场景：①Backup Settings = Recovery Phrase 时发起备份的前置 ②切换 Recovery Phrase → PIN Only 时的解锁 ③其他需要助记词验证的迁移场景

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 进入 Check Recovery Phrase | 1. 触发验证流程<br>2. 经识卡 Looking / Keep Holding 后进入助记词入口 | 1. 显示「Check Recovery Phrase」<br>2. 文案「Select the number of words in your recovery phrase.」<br>3. 提供 12 Words / 18 Words / 24 Words 三个入口 |
| ❗️❗️P0❗️❗️ | 选择正确位数并完整录入 | 1. 当前钱包为 12 位<br>2. 选择 12 Words<br>3. Enter Recovery Phrase 逐词输入正确助记词<br>4. 点击 Continue | 1. 顶部显示 `Word N / 12` 进度<br>2. 全部输入正确后 Continue 可点<br>3. 进入下一步流程（备份继续 / 切换 PIN Only） |
| ❗️❗️P0❗️❗️ | Invalid Recovery Phrase | 1. 录入过程中输入拼写错误 / 顺序错误的助记词<br>2. 点击 Continue | 1. 显示「Invalid Recovery Phrase」红色叉<br>2. 文案「This recovery phrase is not valid. Check the words, order, and spelling.」<br>3. 点 Try Again 回到 Enter Recovery Phrase 页 |
| ❗️❗️P0❗️❗️ | Wrong Recovery Phrase（属于其他钱包） | 1. 录入一组合法但不属于当前钱包的助记词<br>2. 点击 Continue | 1. 显示「Wrong Recovery Phrase」红色叉<br>2. 文案「This phrase is valid, but it belongs to a different wallet.」<br>3. 点 Try Again 回到 Enter Recovery Phrase 页 |
| ❗️❗️P0❗️❗️ | 选错位数 | 1. 当前钱包 12 位<br>2. 选择 24 Words<br>3. 录入 24 词后点击 Continue | 校验失败显示 Invalid 或 Wrong Recovery Phrase（按词内容而定） |
| ❗️❗️P0❗️❗️ | Exit Backup 二次确认 | 1. Enter Recovery Phrase 页点击取消 | 1. 弹出「Exit Backup?」<br>2. 文案「Your progress will not be saved. You'll need to verify your recovery phrase again next time.」<br>3. 按钮：Stay / Exit |
| ❗️❗️P0❗️❗️ | Exit Backup — Stay | 1. 二次确认点击 Stay | 关闭弹窗，停留在 Enter Recovery Phrase 页，已输入的词保留 |
| ❗️❗️P0❗️❗️ | Exit Backup — Exit | 1. 二次确认点击 Exit | 退出验证流程，已输入的词不保留；下次进入需要重新验证 |
| P1 | 18 / 24 位助记词验证 | 1. 钱包分别为 18 / 24 位<br>2. 重复完整录入流程 | 验证成功并继续后续流程 |
