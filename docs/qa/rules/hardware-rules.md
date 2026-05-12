# HW & App 模块测试规则

> 本文档定义 HW & App 模块的测试规则，生成硬件钱包相关测试用例时必须参考。

---

## 0. 输出格式规则（强制）

### 0.1 禁止输出自动化相关内容

**核心规则**：硬件相关的测试用例**禁止**输出自动化相关的校验和测试内容。

**禁止输出项**：
- 自动化层级（Unit / API / E2E）
- 自动化断言（如 `断言：xxx`、`assert`、`expect` 等）
- 自动化实施方案章节
- Mock 数据建议
- 关键拦截点说明

**原因**：
- 硬件交互依赖物理设备，无法完全自动化
- 硬件确认操作需要人工在设备上执行
- 测试用例以手工执行为主

**表格格式调整**：
- 表头使用：`| 优先级 | 输入数据 | 操作步骤 | 预期结果 |`
- 移除「自动化层级」列
- 预期结果中不包含断言语句

---

## 1. 设备管理测试规则

### 1.1 设备列表测试规则

| 规则项 | 规则描述 |
|--------|---------|
| 设备排序 | 与钱包账户选择器排序一致 |
| 设备图片 | 6 款设备图片需正确显示：Pure、Mini、Classic/1S、Touch、Pro 黑款、Pro 白款 |
| 设备信息 | 显示设备备注、设备蓝牙名称（无蓝牙设备不显示） |
| 验证状态 | Badge 显示已验证/未验证状态 |
| 固件版本 | 显示当前固件版本，有更新时显示更新提示 |

### 1.2 设备连接测试规则

| 场景 | 标准钱包规则 | QR 钱包规则 |
|------|-------------|------------|
| 同助记词同设备 | QR/标准钱包共用一个设备选项 | QR/标准钱包共用一个设备选项 |
| 设备重置后再连接 | 不创建新设备 | 创建新设备 |
| 不同助记词重置后创建 | 创建新钱包，旧钱包标记不可用 | 创建新钱包，不处理旧钱包 |
| 相同助记词重置后创建 | 不创建新钱包，重新启用旧钱包 | 创建新钱包，不处理旧钱包 |

### 1.3 Onboarding 固件更新规则

| 规则项 | 规则描述 |
|--------|---------|
| 生效阶段 | 硬件钱包 Onboarding 的固件检查/更新步骤 |
| 强制更新判定 | 系统固件或蓝牙固件 major 版本落后，或同 major 版本下 minor 差值大于 2，或同 major + minor 下 patch 差值大于 2 时，隐藏「跳过」按钮，仅保留更新入口 |
| 可跳过判定 | 不满足强制条件时允许跳过；桌面端蓝牙连接升级时提示插入 USB 线 |
| 异常兜底 | 固件检查异常（如设备断开连接）时，显示错误状态，并保留「重试」与「跳过」 |
| 适用设备 | Pro / Touch / Classic / Classic 1S / Classic Pure / Mini |

### 1.4 QR 钱包限制规则

- QR 钱包**无法修改**硬件设置
- QR 钱包**可以修改**设备名称
- 修改设置需连接 USB 或蓝牙
- 同设备创建标准硬件钱包后，设备详情更新为标准硬件钱包样式
- 删除标准硬件钱包后，恢复为 QR 钱包样式

---

## 2. 通用设置测试规则（General Settings）

### 2.1 设置项硬件确认规则

| 设置项 | 需要硬件确认 | 确认文案模板 |
|--------|-------------|-------------|
| Language | ✓ | "Do you want to change language to [语言]?" |
| Auto Lock | ✓ | "Do you want to change Auto-Lock time to [时长]?" |
| Auto Shutdown | ✓ | "Do you want to change Auto Shutdown time to [时长]?" |
| Brightness | ✗ | 直接滑动调节 |
| Vibration & Haptic | ✓ | "Do you want to open/close Haptic?" |

### 2.2 设置值范围规则

| 设置项 | 可选值 |
|--------|-------|
| Language | English, 简体中文, 繁體中文, 日本語, 한국어, Español, Português (Brasil) |
| Auto Lock | 30 seconds, 1 minute, 2 minutes, 5 minutes, 10 minutes |
| Auto Shutdown | 1 minute, 2 minutes, 5 minutes, 10 minutes |
| Brightness | 0-100%（百分比滑动） |

### 2.3 设备型号支持规则

| 设置项 | Pro | Touch | Classic/1S | Mini | Pure |
|--------|-----|-------|------------|------|------|
| Language | ✓ | ✓ | ✓ | ✓ | ✓ |
| Brightness | ✓ | ✓ | ✗ | ✗ | ✗ |
| Auto Lock | ✓ | ✓ | ✓ | ✓ | ✓ |
| Auto Shutdown | ✓ | ✓ | ✓ | ✓ | ✓ |
| Vibration & Haptic | ✓ | ✓ | ✗ | ✗ | ✗ |

---

## 3. Passphrase 测试规则

### 3.1 开启/关闭流程规则

| 操作 | App 弹窗标题 | 硬件确认标题 | 硬件按钮 |
|------|-------------|-------------|---------|
| 开启 | Enable Passphrase | Enable Passphrase | Cancel / Enable |
| 关闭 | Disable Passphrase | Disable Passphrase | Cancel / Disable |

### 3.2 风险提示规则

- 开启时必须提示：If forgotten, funds are permanently lost.
- 关闭时必须提示：
  - Wallets created with a passphrase stay on-chain
  - Need to turn passphrase back on to access them
  - If you forget the passphrase, the funds are permanently lost.

---

## 4. Enter PIN on App 测试规则

| 规则项 | 规则描述 |
|--------|---------|
| 适用设备 | 仅 Mini / Classic / 1S |
| 默认状态 | 开启 |
| 切换确认 | 不需要硬件确认 |
| 关闭后行为 | 锁定再激活设备需在硬件上输入 PIN 码 |

---

## 5. Forget Device 测试规则

### 5.1 功能范围规则

| 操作类型 | 规则描述 |
|---------|---------|
| 删除范围 | 仅删除 App 内记录 |
| 不影响项 | 硬件设备数据、Recovery phrase、资金 |
| 可恢复性 | 可随时重新配对连接 |

### 5.2 弹窗信息规则

弹窗必须包含以下信息：
- **What will happen**:
  - Device will be disconnected
  - Active sessions will stop
- **What stays safe**:
  - Your data remains safe
  - You can reconnect anytime

### 5.3 成功状态规则

- 操作成功后显示 Toast："Wallet removed successfully"
- 设备从列表中移除

---

## 6. About Device 弹窗测试规则

### 6.1 信息字段规则

| 字段 | 显示规则 |
|------|---------|
| Model | 设备型号（如 OneKey Pro） |
| Serial number | 序列号 + 复制按钮 |
| Firmware | 固件版本 |
| Bluetooth | 蓝牙名称（Mini 显示 "--"） |
| Bluetooth firmware | 蓝牙固件版本（Mini 显示 "--"） |
| Bootloader | 引导程序版本 |
| Certifications | 认证信息（仅 Pro/1S/Pure 有） |

### 6.2 序列号复制规则

- 点击序列号旁的复制按钮
- 成功复制到剪贴板
- 显示复制成功提示

---

## 7. Genuine Check Badge 测试规则

### 7.1 状态显示规则

| 验证状态 | Badge 样式 | 文案 |
|---------|-----------|------|
| isVerified: True | 绿色 ✓ | Genuine verified |
| isVerified: False | 红色 ⚠ | Unverified |

### 7.2 交互规则

- 点击 Badge 进入正品验证流程
- 验证成功后 Badge 状态更新

---

## 8. 安全密钥（FIDO / U2F / FIDO2）测试规则

> 适用范围：仅 Pro2 + 后续支持 FIDO 协议的型号；Mini / Classic / Touch 不支持。
> 参考：<https://help.onekey.so/hc/zh-cn/articles/4406015804303>

### 8.1 解锁与硬件确认规则

| 规则项 | 规则描述 |
|--------|---------|
| 解锁前置 | 设备未解锁时**禁止响应任何 FIDO 请求**（注册 / 认证均不弹窗），必须先要求用户解锁 |
| 确认方式 | 解锁后弹出 FIDO 确认弹窗，需要用户在 Pro2 物理按键上点击「确认」才完成 |
| 取消行为 | 用户取消时浏览器侧报失败，设备端 counter 不变 |

### 8.2 Counter 计数器规则

| 规则项 | 规则描述 |
|--------|---------|
| 维护双方 | 设备端 + 站点后台各自维护 counter（每次验证自增 1） |
| 校验逻辑 | 站点侧校验设备 counter 是否 ≥ 后台 counter；小于则拒绝（防回放） |
| 设备重置后果 | 设备重置 + 导入相同助记词后 counter 归零，无法通过严格校验的站点验证；需在站点后台移除旧密钥并重新注册 |
| 调试命令 | `trezorctl fido counter get-next`（查询并自增）/ `trezorctl fido counter set <值>`（强制设值） |
| 同设备双机修复闭环 | 同助记词的两台设备本质共享 FIDO 密钥对但 counter 各自维护。在严格校验站点（Binance）换设备登录前，必须用 `trezorctl fido counter set <≥ 后台 counter>` 把目标设备 counter 同步到 ≥ 原设备当前值，否则登录失败 |

### 8.3 站点差异：Binance vs Google

| 行为 | Binance | Google |
|------|---------|--------|
| Counter 严格校验 | ✓（counter 不匹配直接登录失败） | ✗（counter 仅用于审计） |
| 同助记词换设备 | ❌ 不可（提示 counter 不匹配） | ✓ 可（弹窗确认后通过） |
| 同账户同助记词第二台设备注册 | ❌ 提示「已注册过」 | ✓ 允许（列表新增独立记录） |
| 重置后再用同助记词 | ❌ 必须在后台移除并重新注册 | ✓ 直接可用（同设备签发同等密钥） |

### 8.4 列表与上限规则

| 规则项 | 规则描述 |
|--------|---------|
| 空状态 | 无 FIDO 密钥时显示空状态文案与插画 |
| 列表字段 | 每条记录显示「网站 / RP 名称」+「用户名 / 账户名」 |
| 加载提示 | 进入列表时显示加载进度条 |
| 上限值 | 设备最多保存 **60 个** FIDO 密钥 |
| 上限提示 | 第 61 次注册时设备屏幕提示「已达到密钥数量限制」 |
| 删除后排序 | 删除任意条后可继续注册，新密钥**排在列表最后**；其余顺序不变 |

### 8.5 详情与移除规则

| 规则项 | 规则描述 |
|--------|---------|
| 详情字段 | 应用名称（网站）+ 账户名称（用户名）+「移除」按钮 |
| 二次确认 | 点击移除必须弹出二次确认；取消则保留，确定则删除并提示「FIDO 密钥已移除」 |
| 已删除认证 | 移除后该密钥不再响应认证；站点侧验证失败 |

### 8.6 开关规则

| 规则项 | 规则描述 |
|--------|---------|
| 默认状态 | 开启 |
| 切换确认 | 开 ↔ 关均弹出二次确认，告知需要重启设备生效 |
| 生效方式 | 必须**重启设备**后状态才生效，重启取消则保留原状态 |
| 关闭后列表 | 列表内容仍展示，但顶部 / 空态显示「已禁用」文案 |
| 关闭后功能 | 任何 FIDO 注册 / 认证请求设备无响应；浏览器侧超时或失败 |
| 重新开启 | 重启后开关恢复开启；关闭前已注册的密钥可继续使用，无需重新注册 |

### 8.7 测试站点参考

| 站点 | 用途 |
|------|------|
| <https://webauthn.io> | FIDO2 通用测试站，支持自定义 username 反复注册 |
| <https://demo.yubico.com/webauthn-technical/registration> | Yubico 官方 FIDO2 注册 / 认证 demo |
| <https://myaccount.google.com/security> | Google 真实 U2F / FIDO2 |
| Binance 安全中心 | Binance 真实 U2F，counter 严格校验场景 |

---

## 9. 硬件转账测试规则

详见 `docs/rules/transfer-chain-rules.md` 中的硬件钱包相关规则。

---

## 10. SeedCard（原 Lite 卡）备份与恢复测试规则

> 适用范围：Pro2 及后续支持 SeedCard 协议的型号。原「OneKey Lite」品类升级后的统一称呼为 **OneKey SeedCard**，旧 Lite 卡兼容写入。
> SeedCard ≠ Keytag；Keytag 为金属抄写卡，SeedCard 为 NFC 加密存储卡，两者在备份入口并列展示。

### 10.1 备份入口与流程规则

| 规则项 | 规则描述 |
|--------|---------|
| 备份入口 | App 端「钱包 → 备份 → OneKey SeedCard」；列表同步显示「OneKey Keytag」 |
| 顶部 Title 开关 | 备份页可开启「Title」，开启后卡片正面附加机型/钱包名印章；关闭仅写裸数据 |
| 备份模式说明 | 开启 Recovery Phrase 模式时备份页显示「Recovery phrase verification is enabled. Change it in Backup Settings.」 |
| 设备 PIN 前置 | 进入识卡前必须 App 端输入 **设备 PIN**；3 次错误后按设备策略锁定（沿用钱包通用规则） |
| 识卡阶段 | 文案顺序：Looking for SeedCard → Keep Holding SeedCard → 显示 SeedCard ID 检查页（Model / ID / Version） |
| SeedCard PIN | 必填，4~9 位数字；Set + Confirm 两次输入；不一致显示「PINs don't match」 |
| 命名步骤 | 备份完成后弹出「Give Your SeedCard a Name」，按钮：Not Now / Continue；Continue 进入命名输入页 |
| 命名再识卡 | 命名输入完成后再次贴卡写入名称，结束页显示「This Is {CardName}」 |
| 末尾配置 | 完成后弹出 Backup Settings 选项：**PIN Only**（默认）/ **Recovery Phrase**；可点 Not Now 跳过 |
| 助记词位数 | 支持 12 / 18 / 24 位助记词写入；超出 24 或非 12/18/24 拒绝 |

### 10.2 错误状态文案规则

| 错误状态 | 触发条件 | 文案 / 行为 |
|---------|---------|-----------|
| Connection Failed | 写入/读取时卡片松动 | 显示「Hold the SeedCard firmly against the back of the device, then try again」 + Back / Try Again |
| This Card already has a backup | 贴入已写入备份的卡 | 显示「If this card is new, please contact OneKey Support at help.onekey.so」+ Got It；同时支持「覆盖」入口 |
| PINs don't match | Set + Confirm 两次 PIN 不一致 | 显示「Make sure both entries are the same」+ Try Again；保留首次输入清空 |
| SeedCard Reset | 连续 10 次错误 PIN（默认 Erase Backup 模式） | 显示「Too many wrong PIN attempts. This SeedCard has been erased to protect your backup」+ Got It |
| Wrong PIN | PIN 错误且未到上限 | 显示「N PIN attempts left before this SeedCard is erased」（红字）+ Got It；N = 10 - 已错次数 |
| No Backup Found | 恢复时贴入空卡 | 显示「Use another SeedCard and try again」+ Go Back |
| Unsupported Recovery Phrase | 卡内助记词位数非 12/18/24 | 显示「Device supports only 12, 18, 24-word recovery phrases. This SeedCard cannot be restored here」+ Got It |
| SeedCard Unavailable | 卡处于永久禁用状态 | 显示「You can recover using another method or another SeedCard」+ Got It |

### 10.3 PIN 防护与自毁机制规则

| 规则项 | 规则描述 |
|--------|---------|
| 最大错误次数 | **10 次** PIN 输入错误触发防护动作 |
| 默认防护模式 | **Erase Backup**：仅擦除卡内备份数据，卡片硬件可被重置后重新使用 |
| 可选防护模式 | **Disable SeedCard Permanently**：擦除备份且卡片硬件被永久禁用，**无法重置、恢复或再次写入** |
| 攻击者验证窗口 | 每次错误 PIN 后剩余次数文案红字显示「N PIN attempts left before this SeedCard is erased」 |
| 切换 Protection Mode | 需要设备 PIN 验证 → 再识卡 → 显示「Protection Mode Changed」 |
| Disable Permanently 切换二次确认 | 必须展示警示「PIN attempts: SeedCard will be permanently disabled. It cannot be restored, reset, or used again」 |

### 10.4 Backup Settings（验证模式）规则

| 规则项 | 规则描述 |
|--------|---------|
| 入口 | 备份页右上角齿轮图标 → 「Backup Settings」弹窗 |
| 默认值 | **PIN Only**（备份/迁移仅需 PIN） |
| 可选值 | **Recovery Phrase**（备份/迁移前必须验证完整助记词） |
| 切换 PIN Only → Recovery Phrase | 弹出「Require Recovery Phrase」二次确认；文案「Future backups and migrations will require recovery phrase verification」+ Cancel / Confirm |
| 切换 Recovery Phrase → PIN Only | 弹出「Verify Recovery Phrase」二次确认；文案「To switch to PIN only, verify your recovery phrase first」+ Cancel / Confirm；点 Confirm 进入助记词验证流程，成功后才落地切换 |
| 持久化 | 配置存储在钱包/账户维度，不绑定单张 SeedCard |

### 10.5 Recovery Phrase 验证流程规则

> 适用场景：①Backup Settings = Recovery Phrase 时的备份前置 ②切换 Recovery Phrase → PIN Only 时的解锁

| 规则项 | 规则描述 |
|--------|---------|
| 选择位数 | 「Check Recovery Phrase」页提供 12 / 18 / 24 Words 三个入口；选错位数后续输入会被判定为 Invalid 或 Wrong |
| 录入页 | 「Enter Recovery Phrase」逐词输入，顶部显示 `Word N / 总数`，键盘联想 |
| Invalid Recovery Phrase | 单词拼写/顺序错误 → 「This recovery phrase is not valid. Check the words, order, and spelling」+ Try Again |
| Wrong Recovery Phrase | 助记词合法但与当前钱包不匹配 → 「This phrase is valid, but it belongs to a different wallet」+ Try Again |
| Exit Backup 二次确认 | 输入过程中点取消触发「Exit Backup? Your progress will not be saved. You'll need to verify your recovery phrase again next time」+ Stay / Exit |

### 10.6 卡片管理（Manage SeedCard）规则

| 规则项 | 规则描述 |
|--------|---------|
| 入口 | App 端「钱包 → 备份 → OneKey SeedCard → Manage」；首屏先贴卡识别 ID |
| Unlock to Manage | 若卡片处于错误 PIN 次数已耗损状态，先显示「N PIN attempts left」红色提示 + 「Unlock to Manage」 |
| 管理项 | Set Name / Title 开关 / Protection Mode / Reset SeedCard（顺序固定） |
| Set Name | 任意 Unicode，长度上限按设备硬限制（默认建议 ≤ 32 字符）；命名后再贴卡写入；写入完成显示「This Is {CardName}」 |
| Title 开关 | 与备份页 Title 同义，控制卡片正面印章；切换时弹出贴卡写入 |
| Change SeedCard PIN | 「Choose a new PIN between 4 and 9 digits」→ Enter New PIN → Enter PIN Again → 识卡写入 → 「PIN Changed」 |
| Reset SeedCard | 二次确认文案：「All data on this SeedCard will be erased and cannot be recovered.」→ Reset → 识卡 → 「Reset complete. This card has been erased」 |

### 10.7 恢复流程（Restore use SeedCard）规则

| 规则项 | 规则描述 |
|--------|---------|
| 恢复入口 | App「恢复钱包」页选择「OneKey SeedCard」（与「Recovery Phrase」并列） |
| 识卡顺序 | Looking → Keep Holding → 显示 ID 检查页 → 输入 SeedCard PIN |
| PIN 错误 | 显示剩余次数红色提示；累计 10 次按当前卡 Protection Mode 处理（默认擦除备份） |
| 成功结束 | 「Wallet Ready. Your wallet has been recovered」+ Continue；进入 App 钱包列表，新增对应钱包记录 |
| 跨设备验证 | Pro2 备份的卡可导入到 App、其他 Pro2、Pro 等支持 SeedCard 的设备；导入后地址与原钱包一致 |

### 10.8 AirGap 模式拦截规则

| 规则项 | 规则描述 |
|--------|---------|
| 拦截范围 | 设备开启 AirGap（仅二维码通信）模式时，**SeedCard 备份 / 恢复 / 管理** 全部入口置灰或显示「在 AirGap 模式下不可用」 |
| 提示文案 | 备份页 SeedCard 项展示拦截文案；点击不进入任何识卡流程 |
| Keytag 影响 | 不受 AirGap 拦截，仍可用 |

---

## 11. Keytag（金属抄写卡）备份测试规则

> 适用范围：Pro2 及后续支持 Keytag 备份的型号。Keytag 是金属冷存储抄写卡，备份流程不依赖 NFC 读写；最终输出为 **点阵图**，用户按图打孔/雕刻金属卡完成物理备份。

### 11.1 备份流程规则

| 规则项 | 规则描述 |
|--------|---------|
| 入口 | App 端「钱包 → 备份 → OneKey Keytag」，与「OneKey SeedCard」并列 |
| Recovery Phrase 必走 | Keytag 备份**始终要求用户重新输入助记词**完成验证（不依赖 Backup Settings 配置） |
| 设备 PIN 前置 | 进入位数选择前必须输入正确的设备 PIN（错误沿用钱包通用 PIN 规则） |
| 位数选择 | 「Ready to Check!」页提供 12 / 18 / 24 Words 三个入口 |
| 助记词录入 | 「Enter Recovery Phrase」说明页 → Continue 进入 Word N / 总数 键盘录入页；逐词输入，键盘联想 |
| AirGap 兼容 | Keytag 备份不受 AirGap 拦截，开启 AirGap 时仍可用 |

### 11.2 校验与异常文案规则

| 错误状态 | 触发条件 | 文案 / 行为 |
|---------|---------|-----------|
| Invalid Recovery Phrase | 输入助记词拼写错误、顺序错误或不在 BIP39 词表中 | 「The recovery phrase you entered is invalid. Check your backup and try again.」+ Try Again |
| PIN Doesn't Match（实为 Phrase Doesn't Match） | 输入的助记词合法但与当前设备种子不一致 | 「The entered recovery phrase is valid but does not match the one in the device.」+ Try Again |
| Exit Backup 二次确认 | 录入过程点取消 | 「Exit Backup? Your progress will not be saved. You'll need to verify your recovery phrase again next time.」+ Stay / Exit |

> 标题文案「PIN Doesn't Match」与文本描述不一致（描述是助记词不匹配），用例中需同时核对标题与描述文案。

### 11.3 点阵图输出规则

| 规则项 | 规则描述 |
|--------|---------|
| 触发时机 | 助记词验证通过后显示 Backup 入口；点击 Backup 进入点阵图页 |
| 12 位 | 单页显示 `Front (#1-12)`，无翻页 |
| 18 位 | 单页显示 `Front (#1-18)`，无翻页 |
| 24 位 | 分两页：第一页 `Front (#1-12)`、第二页 `Front (#13-24)`，提供 ← / → 翻页按钮 |
| 点阵图含义 | 每个单词对应 BIP39 索引（0~2047），在 Keytag 卡面对应位置打孔/雕刻 |
| 退出与重看 | 退出点阵图页不保留状态，再次查看需重新输入设备 PIN + 助记词验证 |

### 11.4 App 端核对一致性规则

| 规则项 | 规则描述 |
|--------|---------|
| 核对路径 | App 端使用「Keytag 备份」功能输入相同助记词 → 同位数下生成相同点阵图 |
| 一致性判定 | 设备端与 App 端点阵图**逐点完全一致**（同一 BIP39 索引在卡面同一位置） |
| 重置后再生成 | 设备重置后用相同助记词重新备份 Keytag，点阵图与重置前一致 |

---

## 变更记录

| 日期 | 变更内容 |
|------|---------|
| 2026-05-11 | 新增「Keytag（金属抄写卡）备份测试规则」章节：入口与 SeedCard 并列、Recovery Phrase 始终必走、Invalid / Phrase Doesn't Match 文案、12/18/24 位点阵图分页规则、App 端核对一致性 |
| 2026-05-11 | 新增「SeedCard（原 Lite 卡）备份与恢复测试规则」章节：备份/恢复/管理/Backup Settings/Protection Mode/Recovery Phrase 验证/PIN 自毁机制/AirGap 拦截，覆盖 Pro2 SeedCard 改版新增功能 |
| 2026-05-11 | 新增「安全密钥（FIDO/U2F/FIDO2）」章节：解锁前置、Counter 机制、Binance vs Google 差异、列表上限 60、开关重启生效、测试站点参考 |
| 2026-04-14 | 根据 OK-51595 补充硬件钱包 Onboarding 固件更新规则：major 落后、同 major 下 minor 差值大于 2、或同 major + minor 下 patch 差值大于 2 时强制更新且不可跳过；异常场景保留重试与跳过入口 |
| 2026-01-16 | 初始化文档，整合 5.20.0 设备管理改版规则 |
