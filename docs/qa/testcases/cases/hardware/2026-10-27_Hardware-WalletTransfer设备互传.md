# Hardware - Wallet Transfer 设备互传

> 规则文档：`docs/qa/rules/hardware-rules.md`（§17 Wallet Transfer）
> 需求文档：`docs/qa/requirements/Hardware-WalletTransfer设备互传.md`
> 测试端：设备端 Pro2 / Neo（导出 + 导入）与 Pro（导出）；App 仅对照账户
> 变更说明：2026-10-27 首版。前三份设计稿为 Pro2/Neo，第四份为 Pro；同文件覆盖

**不支持**：Touch / Mini / Classic / Classic 1S / Pure 作为 Wallet Transfer 源端或接收端（型号不在设计范围内则走 §7 不支持失败）

**HW 型号**：源端 Pro / Pro2 / Neo；接收端 Pro2 / Neo（未设置钱包）

**边界**：SeedCard / Keytag 备份与恢复不在本文件重复

---

## 前置条件与测试数据

1. 源设备已激活且已有钱包；接收设备为未激活、无 PIN、处于初始化 / 恢复流程；固件均为待测且协议互相兼容
2. 准备助记词 **12 / 18 / 24** 位各一套；源端设备 PIN 已知；Passphrase 开/关、Passphrase PIN 有/无各备一组
3. 兼容方向：Pro → Pro2、Pro2 → Pro2（Neo 与 Pro2 同交互）；另备一台固件过旧或不支持协议的设备用于不支持场景
4. 设备语言以设计稿英文文案核对（中文固件对照翻译，语义一致即可）
5. 互传全程两机背靠背贴合，测试中途分开仅用于失败 / 中断场景

| 参数 | 取值 |
| --- | --- |
| 助记词长度 | 12 / 18 / 24 |
| 源端 PIN | 正确 PIN / 错误 PIN |
| Passphrase | 关闭 / 开启（源端已设密语） |
| Passphrase PIN | 无 / 已设置（互传后源端该 PIN 不得被改写） |
| 方向 | Pro → Pro2、Pro2 → Pro2（含 Neo） |

---

## 1. Pro2 / Neo 源端入口与说明

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | 1. Pro2 / Neo 已激活、已有钱包<br>2. 固件已升级到支持 Wallet Transfer 的版本 | 1. 进入设备 `Back Up` 页<br>2. 查看备份方式列表与右上角齿轮 | 1. 列表并列 `SeedCard (Lite)`、`KeyTag`、`Wallet Transfer`<br>2. 右上角显示设置（齿轮）入口<br>3. 页内可见 Backup Settings 相关提示：可在备份设置中选择如何校验备份与 Wallet Transfer |
| P1 | 1. 同型号设备<br>2. 固件尚未包含 Wallet Transfer | 进入 `Back Up` 页 | 列表仅有 SeedCard / KeyTag（或既有备份项），不出现 `Wallet Transfer` |
| ❗️❗️P0❗️❗️ | 1. `Back Up` 页已出现 `Wallet Transfer` | 1. 点击 `Wallet Transfer`<br>2. 阅读说明页文案与按钮 | 1. 标题与正文：`Transfer your wallet to another compatible OneKey device. Your wallet will remain on this device.`<br>2. 底部 `Cancel` / `Continue`<br>3. 不出现「源端钱包将被删除」类文案 |
| P1 | 1. 当前为 Wallet Transfer 说明页 | 点击 `Cancel` | 返回 `Back Up` 列表，未进入 PIN 页 |

---

## 2. Pro2 / Neo 源端导出主流程

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 源端为 Pro2 / Neo，钱包助记词为 12 / 18 / 24 位（各跑一遍）<br>2. 已进入 Wallet Transfer 说明页 | 1. 点击 `Continue`<br>2. 在 `Enter PIN` 输入正确设备 PIN 并确认<br>3. 将接收端按 §3 停在寻找设备<br>4. 两机背靠背贴合直至结束<br>5. 源端点击 `Done` | 1. PIN 通过后进入 `Ready to Transfer`，文案 `Hold both devices back to back and keep them touching.`，底部 `Cancel`<br>2. 贴合后进入 `Transferring...`，文案 `Keep both devices touching until the transfer is complete.`，底部保留 `Cancel`<br>3. 结束后显示 `Wallet Transferred` 绿色对勾，文案 `You can now use your wallet on both devices.`，主按钮 `Done`<br>4. `Done` 回到 `Back Up`<br>5. 源端仍可用原 PIN 解锁原钱包，助记词未抹除 |
| P1 | 1. 当前为 `Enter PIN`<br>2. PIN 输入框为空或部分位数 | 观察对勾 / 确认键 | 未输满前无法进入 `Ready to Transfer` |
| P1 | 1. 当前为 `Enter PIN` | 输入错误 PIN 并确认 | 显示 PIN 错误提示，沿用设备通用 PIN 错误与剩余次数规则；停留在 PIN 页，不进入 `Ready to Transfer` |
| P1 | 1. 当前为 `Ready to Transfer`，尚未贴合 | 点击 `Cancel` | 退出本次导出，回到 `Back Up`（或说明页上一层入口），未开始传输 |
| P1 | 1. 当前为 `Transferring...`，传输尚未结束 | 点击 `Cancel` | 回到 `Ready to Transfer`，不直接落到失败页，也不回到 `Back Up` |

---

## 3. Pro2 / Neo 接收端导入主流程

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | 1. Pro2 / Neo 未激活、无 PIN、处于初始化 / 恢复流程 | 1. 进入 `Restore Wallet`<br>2. 查看恢复方式 | 1. 标题 `Restore Wallet`，副文案 `Select the way you want to restore.`<br>2. 三个入口：`Recovery Phrase`、`SeedCard(Lite)`、`Wallet Transfer` |
| P1 | 1. 设备已有钱包（已激活） | 查看恢复 / 备份入口 | 不出现「作为接收端」的 `Wallet Transfer` 导入入口；已有钱包设备只走源端 `Back Up` |
| ❗️❗️P0❗️❗️ | 1. 未设置钱包的 Pro2 / Neo<br>2. 源端已按 §2 停在 `Ready to Transfer` | 1. 点击 `Wallet Transfer`<br>2. 阅读两页说明后点 `Continue`<br>3. 与源端背靠背贴合直至结束<br>4. 点击 `Done` | 1. 第一页：`Restore your wallet from another OneKey hardware wallet that supports Wallet Transfer.`，按钮 `Continue`<br>2. 第二页：`Only your recovery phrase will be copied to this device.`；`On the other device, go to Back Up → Wallet Transfer.`；**不出现 Passphrase / 密语输入或说明**<br>3. 进入 `Looking for Device`，文案 `Hold both devices back to back and keep them touching.`，底部 `Cancel`<br>4. 贴合后进入 `Transferring...`（全局 Loading）<br>5. 结束页 `Wallet Is Ready`，文案 `Your wallet has been recovered.`，按钮 `Done`<br>6. `Done` 结束引导，**不再展示**「恢复完成」类附加文案<br>7. 接收端可按新设 PIN 解锁，钱包助记词与源端一致（12 / 18 / 24 与当次源端对应） |
| P1 | 1. 当前为 `Looking for Device` | 点击 `Cancel` | 退出本次搜索，回到 `Restore Wallet` 入口；源端仍停在 `Ready to Transfer`，不自动变成 `Wallet Transferred` |

---

## 4. 两端配合与数据范围

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 方向为 Pro → Pro2 或 Pro2 → Pro2（含 Neo）<br>2. 固件与协议兼容<br>3. 源端已有钱包，接收端未设置钱包 | 1. 接收端先进入 Wallet Transfer 寻找设备<br>2. 源端进入 Back Up → Wallet Transfer（Pro 还需完成助记词核对与 PIN）<br>3. 背靠背贴合至两边结束页 | 1. 源端 `Wallet Transferred`，接收端 `Wallet Is Ready`<br>2. 源端钱包仍可解锁使用<br>3. 接收端解锁后账户派生与源端同一套助记词一致 |
| ❗️❗️P0❗️❗️ | 1. 源端已开启 Passphrase，且已设置 Passphrase PIN<br>2. 完成一次互传 | 1. 按主流程传完<br>2. 分别用主 PIN / Passphrase PIN 解锁源端<br>3. 解锁接收端 | 1. 仅助记词被复制<br>2. 源端 Passphrase 与 Passphrase PIN **未被改写**，仍按互传前规则解锁隐藏钱包<br>3. 接收端不自动带入源端 Passphrase；不出现要求输入源端密语的步骤 |
| P1 | 1. 源端 Passphrase 关闭 | 完成一次互传 | 接收端得到与源端相同的标准钱包助记词；两端均可解锁对应标准钱包 |
| P2 | 1. 源端已完成互传并点 `Done`<br>2. App 已连接该源设备 | 在 App 查看源端账户 | App 侧原钱包仍在，不因互传被删除或标记不可用 |

---

## 5. 失败 / 超时 / 中断 / 写入失败

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | 1. 任一侧未进入对应就绪页（源端未到 Ready to Transfer，或接收端未到 Looking for Device）<br>2. 或贴合无法建立连接 | 触发连接失败 | 1. 显示 `Transfer Failed` 红叉<br>2. 文案 `Make sure both devices are ready for OneKey Transfer, then hold them back to back and try again.`<br>3. `Try Again` 重新进入连接；`Cancel` 回到本端入口（源端 Back Up / 接收端 Restore Wallet） |
| P1 | 1. 当前为 `Transfer Timeout` | 1. 等待连接超时后查看页面<br>2. 点击 `Try Again`<br>3. 另一次超时后点 `Cancel` | 1. 黄钟图标，标题 `Transfer Timeout`，文案 `Hold both devices back to back and try again.`<br>2. `Try Again` 仍停留在等待连接，不直接回入口<br>3. `Cancel` 回到本端入口 |
| ❗️❗️P0❗️❗️ | 1. 传输已开始（`Transferring...`）<br>2. 中途分开两台设备 | 观察中断页后分别点 `Try Again` 与 `Close` | 1. 显示 `Transfer Interrupted` 红叉<br>2. 文案 `Keep both devices back to back and restart the transfer.`<br>3. `Try Again` 重新连接；`Close` 回到本端入口 |
| ❗️❗️P0❗️❗️ | 1. 接收端已开始写入钱包<br>2. 写入失败（非连接类错误） | 查看接收端页面并点击 `Restart` | 1. 仅接收端显示 `Wallet Setup Failed`<br>2. 文案 `An error occurred during wallet setup. Restart to reset this device and try again.`<br>3. **只有** `Restart`，无 Close / Cancel，结束页无额外文案<br>4. `Restart` 重置本机后可重新走恢复流程<br>5. 源端不把本次当作已传出确认 |
| P1 | 1. 源端点 `Cancel`（说明页 / Ready / Transferring）<br>2. 或接收端在 Looking for Device 点 `Cancel`<br>3. 或两端同时取消 | 分别构造三种取消 | 1. 本端退出当前步骤，回到对应入口或 Ready to Transfer（与 §2 / §3 各页 Cancel 规则一致）<br>2. 对端不误显示 `Wallet Transferred` / `Wallet Is Ready`<br>3. 两端同时取消时两边都未写入新钱包状态 |
| P1 | 1. 接收端仍停在恢复说明或寻找设备，**尚未确认接收**<br>2. 源端已 Ready to Transfer | 观察源端，不要在源端点完成 | 1. 源端**不进入** `Wallet Transferred`<br>2. 提示去寻找 / 确认另一台设备<br>3. **不**引导源端「重试写入」 |

---

## 6. Pro 源端导出（含助记词核对）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | 1. Pro 已激活、已有钱包<br>2. 固件支持 Wallet Transfer | 1. 进入 `Settings / Security` → `Back Up`<br>2. 查看列表后点击 `Wallet Transfer` | 1. 标题 `Back Up`，副文案含 `Select the way you want to back up. After verifying the recovery phrase, we will use the phrase you entered for backup.`<br>2. 列表：`OneKey Keytag`、`OneKey SeedCard (Lite)`、`Wallet Transfer`<br>3. 进入互传后先出现确认助记词流程（Check Recovery Phrase / LINK），再进入说明页或 PIN / Ready to Transfer |
| P1 | 1. Backup Settings 为助记词验证 | 从 `Wallet Transfer` 进入 | 必须先完成助记词核对，核对通过后才到 `Ready to Transfer` |
| P1 | 1. 当前为 Pro 的 Wallet Transfer 说明页 | 查看文案后点 `Cancel` 或 `Continue` | 1. 文案与 Pro2 源端相同：`Transfer your wallet to another compatible OneKey device. Your wallet will remain on this device.`<br>2. `Cancel` 退出；`Continue` 进入后续 PIN / 就绪流程 |
| ❗️❗️P0❗️❗️ | 1. Pro 为源端，Pro2 / Neo 为未设置钱包的接收端<br>2. 助记词 12 / 18 / 24 位各跑一遍 | 1. 完成助记词核对与 PIN<br>2. 接收端停在 Looking for Device<br>3. 背靠背至结束<br>4. 源端点绿色 `Done` | 1. `Ready to Transfer` → `Transferring...` 文案与 Pro2 源端一致<br>2. 结束页 `Wallet Transferred`，`You can now use your wallet on both devices.`，`Done` 为主色按钮<br>3. Pro 原钱包仍可解锁；接收端 `Wallet Is Ready` 且助记词与 Pro 一致 |
| P1 | 1. Pro 源端连接失败 / 超时 / 传输中断 | 分别构造三种失败 | 1. `Transfer Failed` / `Transfer Timeout` / `Transfer Interrupted` 文案与按钮同 §5（Failed、Timeout 为 Cancel + Try Again；Interrupted 为 Close + Try Again）<br>2. **不出现** `Wallet Setup Failed`（该页只在接收端写入失败时出现） |

---

## 7. 兼容与不支持

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 型号、固件或协议任一不支持 Wallet Transfer<br>2. 或接收端**已经有钱包**<br>3. 或助记词位数不被互传协议支持 | 1. 仍按入口发起互传并贴合<br>2. 观察提示 | 1. 不把钱包写入接收端<br>2. 以 Toast（或失败页）给出对应原因：型号不支持 / 固件不支持 / 协议不支持 / 接收端已有钱包 / 助记词位数不支持<br>3. 源端钱包保持原状 |
| P1 | 1. 使用设计范围外的 Touch / Mini / Classic 等作为其中一端 | 查找 Wallet Transfer 入口或强行贴合 | 无入口或走「型号不支持」失败，不写入对端 |
| P2 | 1. 兼容方向仅验证 Pro → Pro2、Pro2 → Pro2 | 对照矩阵执行 §4 主路径各 1 次 | 两种方向均可完成导出 + 导入；Neo 与 Pro2 交互一致 |
