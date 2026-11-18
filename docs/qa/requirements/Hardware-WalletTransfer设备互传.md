# Hardware - Wallet Transfer 设备互传

> App 版本：
> 测试端：硬件设备端（Pro2 / Neo / Pro）；App 侧仅作账户对照，本功能主流程在设备屏
> 变更记录：
> - 2026-10-27 首版，依据 Pro2/Neo 导出 / 导入 / 失败态设计稿与 Pro 导出设计稿

## 1. 能力定义

Wallet Transfer（设备互传）通过设备背靠背触碰（近场）把**源设备上的助记词**复制到**另一台兼容的 OneKey 硬件设备**。源设备钱包保留，不抹除。

- **仅复制助记词**（recovery phrase）。不复制 Passphrase、不覆盖源设备 Passphrase / Passphrase PIN。
- 每次互传需覆盖助记词长度 **12 / 18 / 24**、设备 PIN、Passphrase、Passphrase PIN 组合；Passphrase PIN 本身不因互传改写。
- 适用方向（协议与固件兼容前提下）：**Pro → Pro2**、**Pro2 → Pro2**（含 Neo，与 Pro2 同套交互）。型号 / 固件 / 协议不兼容时失败并给出原因，不进入写入。

## 2. Pro2 / Neo — 已有钱包（导出 / 源端）

入口：已激活设备 `Back Up` 页。固件升级后列表出现 `Wallet Transfer`，与 `SeedCard (Lite)`、`KeyTag` 并列。右上角齿轮进入 Backup Settings，可配置备份与 Wallet Transfer 的验证方式。

流程：

1. 选择 Wallet Transfer → 说明页：`Transfer your wallet to another compatible OneKey device. Your wallet will remain on this device.`，按钮 `Cancel` / `Continue`
2. `Enter PIN`：校验已有设备 PIN
3. `Ready to Transfer`：`Hold both devices back to back and keep them touching.`，底部 `Cancel`
4. 触碰后进入 `Transferring...`：`Keep both devices touching until the transfer is complete.`。此页点 `Cancel` 回到 `Ready to Transfer`，不结束整段流程
5. 完成后 `Wallet Transferred`：绿色对勾，`You can now use your wallet on both devices.`，`Done` 回到 `Back Up`

## 3. Pro2 / Neo — 未设置钱包（导入 / 接收端）

仅未激活、尚未创建 PIN、仍在初始化 / 恢复流程中的设备展示该入口。已有钱包的设备不走导入。

入口：`Restore Wallet` → `Select the way you want to restore.`，选项 `Recovery Phrase` / `SeedCard(Lite)` / `Wallet Transfer`。

流程：

1. 选择 Wallet Transfer → 说明：`Restore your wallet from another OneKey hardware wallet that supports Wallet Transfer.`，`Continue`
2. 开始指导：`Only your recovery phrase will be copied to this device.`；`On the other device, go to Back Up → Wallet Transfer.` **不展示 Passphrase 相关文案**，不引导输入 Passphrase
3. `Looking for Device`：`Hold both devices back to back and keep them touching.`，`Cancel` 退出本次搜索，回到导入入口
4. `Transferring...`：全局 Loading（设计：200×200，距底约 80px，约 10.8s 量级）
5. `Wallet Is Ready`：`Your wallet has been recovered.`，`Done` 结束，**不再展示**「恢复完成」类额外文案

## 4. 通用失败态（两端按角色展示）

| 状态 | 触发 | 标题 / 文案 | 按钮 |
|------|------|-------------|------|
| Transfer Failed | 未能建立连接 | Make sure both devices are ready for OneKey Transfer, then hold them back to back and try again. | Cancel 回入口；Try Again 重新连接 |
| Transfer Timeout | 等待连接超时 | Hold both devices back to back and try again. | Cancel 回入口；Try Again 仍停留在等待连接 |
| Transfer Interrupted | 传输中途分开设备 | Keep both devices back to back and restart the transfer. | Close 回入口；Try Again 重新连接 |
| Wallet Setup Failed | **仅接收端写入失败** | An error occurred during wallet setup. Restart to reset this device and try again. | 仅 Restart（重置本机，无 Close / Cancel）。结束页不追加多余文案 |

### 4.1 不画进稿但需覆盖的边界

- **接收端未确认**：接收端可能仍停在恢复引导；源端不得自行进入「已传出确认」。提示去找另一台设备，**不引导源端重试写入**
- **取消**：源端取消、接收端取消、两端同时取消，与工程约定一致（见用例对应行）
- **不支持**：型号 / 固件 / 协议不支持、接收端已有钱包、助记词位数不支持 — 分别 Toast 并展示失败原因，不写入接收端

## 5. Pro — 已有钱包（导出 / 源端）

入口：`Settings / Security` → `Back Up`。副文案：`Select the way you want to back up. After verifying the recovery phrase, we will use the phrase you entered for backup.` 列表：`OneKey Keytag` / `OneKey SeedCard (Lite)` / `Wallet Transfer`。

与 Pro2/Neo 差异：

1. 在 `Ready to Transfer` 之前插入 **确认助记词（Check Recovery Phrase / LINK）** 流程；Backup Settings 为助记词验证时必须先核对助记词
2. 说明页同样：`Transfer your wallet to another compatible OneKey device. Your wallet will remain on this device.`，`Cancel` / `Continue`
3. `Ready to Transfer` → `Transferring...` → `Wallet Transferred`（`Done` 为绿色主按钮）
4. 失败态覆盖 Transfer Failed / Transfer Timeout / Transfer Interrupted（源端无 Wallet Setup Failed）

## 6. 源码实现参考

待对照 app-monorepo / 固件协议实现后补路径。当前以设计稿为需求主体。
