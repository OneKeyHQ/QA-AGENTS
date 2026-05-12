# Pro2 - SeedCard 备份流程

> 规则文档：`docs/qa/rules/hardware-rules.md`（§10 SeedCard 备份与恢复）
> 测试端：Pro2 设备端 + App（Desktop / Mobile / Extension，以产品支持为准）
> 变更说明：原 OneKey Lite 卡升级为 OneKey SeedCard，新增 SeedCard 命名、Title 印章、Backup Settings（PIN Only / Recovery Phrase）、10 次错误 PIN 自毁、SeedCard ID 显示等流程

---

## 前置条件与测试数据

1. Pro2 设备已激活，固件为待测版本，存量钱包包含 **12 / 18 / 24** 位三种助记词各一个
2. 准备测试卡：≥ 2 张空 SeedCard、1 张已写入旧备份的 SeedCard、1 张写入 25 位（非标准位数）助记词的 SeedCard 用于异常场景
3. App 端账户已登录、可通过 USB / 蓝牙正常连接 Pro2
4. 设备 PIN 已知；测试用 SeedCard PIN 数据集：`1234`（4 位下限）、`123456789`（9 位上限）、`12345`（中间值）
5. AirGap 模式验证场景需提前在 Pro2 设置中可切换 AirGap 开关

---

## 1. 备份入口与卡片识别

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 默认 PIN Only 模式进入备份页 | 1. App 端进入「钱包 → 备份」<br>2. 查看页面元素 | 1. 显示「OneKey SeedCard (Lite)」与「OneKey Keytag」两项<br>2. 顶部显示 Title 开关（默认关闭）<br>3. 右上角显示设置（齿轮）入口<br>4. 不显示 Recovery phrase verification 启用提示 |
| ❗️❗️P0❗️❗️ | Recovery Phrase 模式进入备份页 | 1. Backup Settings 已切换为 Recovery Phrase<br>2. 进入备份页 | 显示提示「Recovery phrase verification is enabled. Change it in Backup Settings.」 |
| ❗️❗️P0❗️❗️ | SeedCard 识别成功 | 1. 点击 OneKey SeedCard<br>2. 设备提示「Looking for SeedCard」<br>3. 将空卡贴近 Pro2 背面并保持 | 1. 文案切换为「Keep Holding SeedCard」<br>2. 读取完成后跳转「Enter Device PIN」页 |
| ❗️❗️P0❗️❗️ | 识卡过程松动导致失败 | 1. 触发识卡<br>2. 卡片在 Keep Holding 阶段移开 | 1. 显示「Connection Failed」<br>2. 文案「Hold the SeedCard firmly against the back of the device, then try again」<br>3. 显示 Back / Try Again 按钮 |
| P1 | Try Again 重试可用 | 1. 当前为 Connection Failed 页<br>2. 点击 Try Again<br>3. 重新贴卡 | 重新进入识卡流程，识别成功后继续后续步骤 |
| P1 | Back 返回 | 1. Connection Failed 页点击 Back | 回到备份选择页（OneKey SeedCard / Keytag 列表） |

---

## 2. 设备 PIN 与 SeedCard PIN 设置

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 设备 PIN 错误 | 1. 识卡完成进入 Enter Device PIN<br>2. 输入错误 PIN 并确认 | 显示 PIN 错误提示，沿用钱包通用 PIN 错误规则；不进入下一页 |
| ❗️❗️P0❗️❗️ | 设备 PIN 正确进入 SeedCard PIN 设置 | 1. 输入正确设备 PIN | 跳转「Set SeedCard PIN」页，标题与子标题显示 |
| ❗️❗️P0❗️❗️ | 设置 SeedCard PIN — 下限 4 位 | 1. Set SeedCard PIN 输入 `1234`<br>2. 点击对勾<br>3. Confirm SeedCard PIN 再次输入 `1234` | 1. 两次 PIN 一致<br>2. 进入「Create your back up / Keep Holding SeedCard」识卡页 |
| ❗️❗️P0❗️❗️ | 设置 SeedCard PIN — 上限 9 位 | 1. Set 输入 `123456789`<br>2. Confirm 输入 `123456789` | 两次一致，进入识卡页 |
| ❗️❗️P0❗️❗️ | 两次 PIN 不一致 | 1. Set 输入 `1234`<br>2. Confirm 输入 `5678`<br>3. 点击对勾 | 1. 显示「PINs don't match」<br>2. 文案「Make sure both entries are the same」<br>3. 点击 Try Again 返回 Set 页面，输入清空 |
| P1 | 输入 PIN 中途取消 | 1. Set SeedCard PIN 页点击 Cancel | 跳转「退出备份流程？」二次确认；确认退出回到备份选择页 |

---

## 3. 备份执行与命名

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 空卡备份 12 位助记词成功 | 1. 当前钱包助记词为 12 位<br>2. 完成 PIN 设置后再次贴卡<br>3. 等待写入完成 | 1. 「Keep Holding SeedCard」识卡完成<br>2. 显示「Backup Completed」绿色对勾<br>3. 文案「You can recover your wallet using this card and PIN at all times.」<br>4. 显示 Got It 按钮 |
| ❗️❗️P0❗️❗️ | 空卡备份 18 位助记词成功 | 1. 当前钱包助记词为 18 位<br>2. 重复 §1-§3 流程 | 备份完成页同上；卡内写入 18 位助记词 |
| ❗️❗️P0❗️❗️ | 空卡备份 24 位助记词成功 | 1. 当前钱包助记词为 24 位<br>2. 重复 §1-§3 流程 | 备份完成页同上；卡内写入 24 位助记词 |
| ❗️❗️P0❗️❗️ | 命名弹窗 — Continue 命名 | 1. Backup Completed 页点击 Got It<br>2. 弹出「Give Your SeedCard a Name」<br>3. 点击 Continue<br>4. 输入名称 `OneKey Pro 2`<br>5. 点击对勾<br>6. 再次贴卡 | 1. 进入 Set Name 键盘页<br>2. 名称写入卡片<br>3. 写入完成显示「This Is {CardName}」<br>4. 卡片信息与输入名称一致<br>5. 点击 Continue 进入末尾配置 |
| ❗️❗️P0❗️❗️ | 命名弹窗 — Not Now 跳过 | 1. Give SeedCard a Name 弹窗点击 Not Now | 跳过命名，直接进入末尾 Backup Settings 配置弹窗 |
| ❗️❗️P0❗️❗️ | 末尾配置 — 默认选中 PIN Only | 1. 备份完成后进入 Backup Settings 弹窗<br>2. 查看选项默认状态 | 1. 文案「You can back up this wallet to a new device or backup card in the future.」<br>2. PIN Only 选项默认选中<br>3. Recovery Phrase 选项未选中<br>4. 提供 Confirm 按钮 |
| ❗️❗️P0❗️❗️ | 末尾配置 — 选择 Recovery Phrase | 1. Backup Settings 弹窗选择 Recovery Phrase<br>2. 点击 Confirm | 1. 弹出「Require Recovery Phrase」二次确认<br>2. 文案「Future backups and migrations will require recovery phrase verification.」<br>3. 点击 Confirm 后落地配置<br>4. 备份页顶部显示 Recovery phrase verification 启用提示 |
| P1 | 末尾配置直接确认 PIN Only | 1. Backup Settings 弹窗保持 PIN Only<br>2. 点击 Confirm | 1. 不弹出二次确认<br>2. 配置落地为 PIN Only<br>3. 返回备份页或钱包页 |

---

## 4. 覆盖已有备份的卡

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 贴入已有备份的卡 | 1. 备份流程贴入已写入旧备份的卡 | 1. 显示「This Card already has a backup」红色叉<br>2. 文案「If this card is new, please contact OneKey Support at help.onekey.so」<br>3. 显示 Got It 按钮 |
| ❗️❗️P0❗️❗️ | 输入旧卡 PIN 后覆盖备份 | 1. 已备份卡触发覆盖入口<br>2. Enter SeedCard PIN 输入正确 PIN<br>3. 显示是否覆盖警告<br>4. 勾选确认后点击「覆盖」<br>5. 再次贴卡完成写入 | 1. PIN 正确进入覆盖二次确认<br>2. 必须显式勾选警告才可点覆盖<br>3. 写入完成显示 Backup Completed<br>4. 新备份替换旧数据 |
| P1 | 旧卡 PIN 错误 | 1. 覆盖流程输入错误 PIN | 1. 显示 Wrong PIN 红色提示<br>2. 文案「N PIN attempts left before this SeedCard is erased」（N=9..1 递减）<br>3. 不进入写入步骤 |
| P1 | 旧卡 PIN 连续错误 10 次 | 1. 覆盖流程连续输入错误 PIN 10 次<br>2. 每次错误后点击 Got It 继续 | 1. 第 10 次错误后显示「SeedCard Reset」<br>2. 文案「Too many wrong PIN attempts. This SeedCard has been erased to protect your backup」<br>3. 卡内数据被擦除，可作为空卡重新备份（前提：默认 Erase Backup 模式） |

---

## 5. AirGap 模式拦截

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | AirGap 模式下进入备份页 | 1. Pro2 启用 AirGap 模式<br>2. App 端进入备份页 | 1. OneKey SeedCard 项置灰或显示「在 AirGap 模式下不可用」<br>2. 点击不进入识卡流程<br>3. OneKey Keytag 仍可正常使用 |
| P1 | 关闭 AirGap 后恢复可用 | 1. 关闭 AirGap 模式<br>2. 再次进入备份页 | OneKey SeedCard 项恢复可点，备份流程可正常进入 |

---

## 6. 回退与取消路径

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | Looking for SeedCard 取消 | 1. 触发识卡<br>2. 点击 Cancel | 回到备份选择页 |
| P1 | Set SeedCard PIN 取消 | 1. Set SeedCard PIN 页点击 Cancel | 弹出退出备份流程确认；确认后回到备份选择页 |
| P1 | Create your back up 阶段取消 | 1. Create your back up / Keep Holding SeedCard 识卡页点击 Cancel | 回到「Create your back up」前置页或备份选择页 |
| P1 | Give SeedCard a Name 取消 | 1. 命名页点击 Cancel | 显示「退出备份流程？」二次确认；点 Stay 返回，点 Exit 跳过命名直接进入末尾 Backup Settings |
| P1 | 末尾配置取消 | 1. Backup Settings 弹窗点击 Cancel | 关闭弹窗，本次不写入备份模式偏好；备份数据已写卡，钱包仍可恢复 |
| P2 | 备份完成页直接返回 | 1. Backup Completed 页点击设备返回手势 | 仍停留在 Backup Completed 页（防误退）；只有 Got It 可继续 |
