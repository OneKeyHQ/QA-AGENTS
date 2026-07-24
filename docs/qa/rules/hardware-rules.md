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

## 9. 第三方硬件 Ledger App 安装规则索引

- Ledger 第三方硬件新增“安装 App”能力时，需求口径以 `docs/qa/requirements/Hardware-Ledger安装APP.md` 为准。
- 生成手动测试用例时，第三方硬件专项规则以 `docs/qa/rules/hardware-third-party-rules.md` 为准。
- 当前安装能力仅覆盖 `BTC / ETH / TRX / SOL`，并区分“Onboarding / 投资组合批量安装”与“单网络按需安装”两类场景。
- 投资组合勾选网络创建地址时，按连续单网络交互处理；断网、设备空间不足、设备断线需分别给出对应提示。

---

## 10. 硬件转账测试规则

详见 `docs/rules/transfer-chain-rules.md` 中的硬件钱包相关规则。

---

## 11. SeedCard（原 Lite 卡）备份与恢复测试规则

> 适用范围：Pro2 及后续支持 SeedCard 协议的型号。原「OneKey Lite」品类升级后的统一称呼为 **OneKey SeedCard**，旧 Lite 卡兼容写入。
> SeedCard ≠ Keytag；Keytag 为金属抄写卡，SeedCard 为 NFC 加密存储卡，两者在备份入口并列展示。

### 11.1 备份入口与流程规则

| 规则项 | 规则描述 |
|--------|---------|
| 备份入口 | App 端「钱包 → 备份 → OneKey SeedCard」；列表同步显示「OneKey Keytag」 |
| 顶部 Title 开关 | 备份页可开启「Title」，开启后卡片正面附加机型/钱包名印章；关闭仅写裸数据 |
| 备份模式说明 | 开启 Recovery Phrase 模式时备份页显示「Recovery phrase verification is enabled. Change it in Backup Settings.」 |
| 设备 PIN 前置 | 进入识卡前必须 App 端输入 **设备 PIN**；3 次错误后按设备策略锁定（沿用钱包通用规则） |
| 识卡阶段 | 文案顺序：Looking for SeedCard → Keep Holding SeedCard → 显示 SeedCard ID 检查页（Model / ID / Version） |
| SeedCard PIN | 必填，**固定 6 位数字**（最长最短均为 6 位）；Set + Confirm 两次输入；不一致显示「PIN 不一致（PINs don't match）」 |
| 命名步骤 | 备份完成后弹出「Give Your SeedCard a Name」，按钮：Not Now / Continue；Continue 进入命名输入页 |
| 命名再识卡 | 命名输入完成后再次贴卡写入名称，结束页显示「This Is {CardName}」 |
| 末尾配置 | 完成后弹出 Backup Settings 选项：**PIN Only**（默认）/ **Recovery Phrase**；可点 Not Now 跳过 |
| 助记词位数 | 支持 12 / 18 / 24 位助记词写入；超出 24 或非 12/18/24 拒绝 |

### 11.2 错误状态文案规则

| 错误状态 | 触发条件 | 文案 / 行为 |
|---------|---------|-----------|
| Connection Failed | 写入/读取时卡片松动 | 显示「Hold the SeedCard firmly against the back of the device, then try again」 + Back / Try Again |
| This Card already has a backup | 贴入已写入备份的卡 | 显示「If this card is new, please contact OneKey Support at help.onekey.so」+ Got It；同时支持「覆盖」入口 |
| PINs don't match | Set + Confirm 两次 PIN 不一致 | 显示「Make sure both entries are the same」+ Try Again；保留首次输入清空 |
| SeedCard Reset | 连续 10 次错误 PIN（默认 Erase Backup 模式） | 显示「Too many wrong PIN attempts. This SeedCard has been erased to protect your backup」+ Got It |
| Wrong PIN | PIN 错误且未到上限 | 显示「N PIN attempts left before this SeedCard is erased」（红字）+ Got It；N = 10 - 已错次数 |
| No Backup Found | 恢复时贴入空卡 | 显示「Use another SeedCard and try again」+ Go Back |
| SeedCard Unavailable | 卡处于永久禁用状态 | 显示「You can recover using another method or another SeedCard」+ Got It |

### 11.3 PIN 防护与自毁机制规则

| 规则项 | 规则描述 |
|--------|---------|
| 最大错误次数 | **10 次** PIN 输入错误触发防护动作 |
| 默认防护模式 | **Erase Backup**：仅擦除卡内备份数据，卡片硬件可被重置后重新使用 |
| 可选防护模式 | **Disable SeedCard Permanently**：擦除备份且卡片硬件被永久禁用，**无法重置、恢复或再次写入** |
| 攻击者验证窗口 | 每次错误 PIN 后剩余次数文案红字显示「N PIN attempts left before this SeedCard is erased」 |
| 切换 Protection Mode | 需要设备 PIN 验证 → 再识卡 → 显示「Protection Mode Changed」 |
| Disable Permanently 切换二次确认 | 必须展示警示「PIN attempts: SeedCard will be permanently disabled. It cannot be restored, reset, or used again」 |

### 11.4 Backup Settings（验证模式）规则

| 规则项 | 规则描述 |
|--------|---------|
| 入口 | 备份页右上角齿轮图标 → 「Backup Settings」弹窗 |
| 默认值 | **PIN Only**（备份/迁移仅需 PIN） |
| 可选值 | **Recovery Phrase**（备份/迁移前必须验证完整助记词） |
| 切换 PIN Only → Recovery Phrase | 弹出「Require Recovery Phrase」二次确认；文案「Future backups and migrations will require recovery phrase verification」+ Cancel / Confirm |
| 切换 Recovery Phrase → PIN Only | 弹出「Verify Recovery Phrase」二次确认；文案「To switch to PIN only, verify your recovery phrase first」+ Cancel / Confirm；点 Confirm 进入助记词验证流程，成功后才落地切换 |
| 持久化 | 配置存储在钱包/账户维度，不绑定单张 SeedCard |

### 11.5 Recovery Phrase 验证流程规则

> 适用场景：①Backup Settings = Recovery Phrase 时的备份前置 ②切换 Recovery Phrase → PIN Only 时的解锁

| 规则项 | 规则描述 |
|--------|---------|
| 选择位数 | 「Check Recovery Phrase」页提供 12 / 18 / 24 Words 三个入口；选错位数后续输入会被判定为 Invalid 或 Wrong |
| 录入页 | 「Enter Recovery Phrase」逐词输入，顶部显示 `Word N / 总数`，键盘联想 |
| Invalid Recovery Phrase | 单词拼写/顺序错误 → 「This recovery phrase is not valid. Check the words, order, and spelling」+ Try Again |
| Wrong Recovery Phrase | 助记词合法但与当前钱包不匹配 → 「This phrase is valid, but it belongs to a different wallet」+ Try Again |
| Exit Backup 二次确认 | 输入过程中点取消触发「Exit Backup? Your progress will not be saved. You'll need to verify your recovery phrase again next time」+ Stay / Exit |

### 11.6 卡片管理（Manage SeedCard）规则

| 规则项 | 规则描述 |
|--------|---------|
| 入口 | App 端「钱包 → 备份 → OneKey SeedCard → Manage」；首屏先贴卡识别 ID |
| Unlock to Manage | 若卡片处于错误 PIN 次数已耗损状态，先显示「N PIN attempts left」红色提示 + 「Unlock to Manage」 |
| 管理项 | Set Name / Change PIN / Protection Mode / Reset（顺序固定）；Title 开关位于备份页顶部，不在管理页内 |
| Set Name | 任意 Unicode，长度上限按设备硬限制（默认建议 ≤ 32 字符）；命名后再贴卡写入；写入完成显示「This Is {CardName}」 |
| Title 开关 | 与备份页 Title 同义，控制卡片正面印章；切换时弹出贴卡写入 |
| Change SeedCard PIN | 「请设置新的 6 位数字 PIN」→ 输入新 PIN → 再次输入 PIN → 识卡写入 → 「PIN 已更改」 |
| Reset SeedCard | 二次确认文案：「All data on this SeedCard will be erased and cannot be recovered.」→ Reset → 识卡 → 「Reset complete. This card has been erased」 |

### 11.7 恢复流程（Restore use SeedCard）规则

| 规则项 | 规则描述 |
|--------|---------|
| 恢复入口 | App「恢复钱包」页选择「OneKey SeedCard」（与「Recovery Phrase」并列） |
| 识卡顺序 | Looking → Keep Holding → 显示 ID 检查页 → 输入 SeedCard PIN |
| PIN 错误 | 显示剩余次数红色提示；累计 10 次按当前卡 Protection Mode 处理（默认擦除备份） |
| 成功结束 | 「Wallet Ready. Your wallet has been recovered」+ Continue；进入 App 钱包列表，新增对应钱包记录 |
| 跨设备验证 | Pro2 备份的卡可导入到 App、其他 Pro2、Pro 等支持 SeedCard 的设备；导入后地址与原钱包一致 |

### 11.8 AirGap 模式拦截规则

| 规则项 | 规则描述 |
|--------|---------|
| 拦截范围 | 设备开启 AirGap（仅二维码通信）模式时，**SeedCard 备份 / 恢复 / 管理** 全部入口置灰或显示「在 AirGap 模式下不可用」 |
| 提示文案 | 备份页 SeedCard 项展示拦截文案；点击不进入任何识卡流程 |
| Keytag 影响 | 不受 AirGap 拦截，仍可用 |

---

## 12. Keytag（金属抄写卡）备份测试规则

> 适用范围：Pro2 及后续支持 Keytag 备份的型号。Keytag 是金属冷存储抄写卡，备份流程不依赖 NFC 读写；最终输出为 **点阵图**，用户按图打孔/雕刻金属卡完成物理备份。

### 12.1 备份流程规则

| 规则项 | 规则描述 |
|--------|---------|
| 入口 | App 端「钱包 → 备份 → OneKey Keytag」，与「OneKey SeedCard」并列 |
| Recovery Phrase 必走 | Keytag 备份**始终要求用户重新输入助记词**完成验证（不依赖 Backup Settings 配置） |
| 设备 PIN 前置 | 进入位数选择前必须输入正确的设备 PIN（错误沿用钱包通用 PIN 规则） |
| 位数选择 | 「Ready to Check!」页提供 12 / 18 / 24 Words 三个入口 |
| 助记词录入 | 「Enter Recovery Phrase」说明页 → Continue 进入 Word N / 总数 键盘录入页；逐词输入，键盘联想 |
| AirGap 兼容 | Keytag 备份不受 AirGap 拦截，开启 AirGap 时仍可用 |

### 12.2 校验与异常文案规则

| 错误状态 | 触发条件 | 文案 / 行为 |
|---------|---------|-----------|
| Invalid Recovery Phrase | 输入助记词拼写错误、顺序错误或不在 BIP39 词表中 | 「The recovery phrase you entered is invalid. Check your backup and try again.」+ Try Again |
| PIN Doesn't Match（实为 Phrase Doesn't Match） | 输入的助记词合法但与当前设备种子不一致 | 「The entered recovery phrase is valid but does not match the one in the device.」+ Try Again |
| Exit Backup 二次确认 | 录入过程点取消 | 「Exit Backup? Your progress will not be saved. You'll need to verify your recovery phrase again next time.」+ Stay / Exit |

> 标题文案「PIN Doesn't Match」与文本描述不一致（描述是助记词不匹配），用例中需同时核对标题与描述文案。

### 12.3 点阵图输出规则

| 规则项 | 规则描述 |
|--------|---------|
| 触发时机 | 助记词验证通过后显示 Backup 入口；点击 Backup 进入点阵图页 |
| 12 位 | 单页显示 `Front (#1-12)`，无翻页 |
| 18 位 | 单页显示 `Front (#1-18)`，无翻页 |
| 24 位 | 分两页：第一页 `Front (#1-12)`、第二页 `Front (#13-24)`，提供 ← / → 翻页按钮 |
| 点阵图含义 | 每个单词对应 BIP39 索引（0~2047），在 Keytag 卡面对应位置打孔/雕刻 |
| 退出与重看 | 退出点阵图页不保留状态，再次查看需重新输入设备 PIN + 助记词验证 |

### 12.4 App 端核对一致性规则

| 规则项 | 规则描述 |
|--------|---------|
| 核对路径 | App 端使用「Keytag 备份」功能输入相同助记词 → 同位数下生成相同点阵图 |
| 一致性判定 | 设备端与 App 端点阵图**逐点完全一致**（同一 BIP39 索引在卡面同一位置） |
| 重置后再生成 | 设备重置后用相同助记词重新备份 Keytag，点阵图与重置前一致 |

---

## 13. Pro2 指纹（Fingerprint）测试规则

> 适用范围：仅 Pro2 及后续支持指纹解锁的型号；Mini / Classic / Classic 1S / Touch / Pure 不支持。

### 13.1 录入入口规则

| 入口 | 触发条件 | PIN 前置 |
|------|---------|---------|
| Onboarding 引导页 | 设置 PIN 完成后弹出「Fingerprint Unlock」引导页 | 不需要（PIN 刚设置完） |
| Settings → 指纹 | 设备已初始化后从安全设置进入 | 需要输入正确设备 PIN |

**Onboarding 引导页文案与按钮**：
- 标题：`Fingerprint Unlock`
- 描述：`Use your fingerprint to unlock OneKey Pro 2 faster. You can still use your PIN anytime.`
- 按钮：`Add Fingerprint` / `Not Now`

### 13.2 录入分步流程规则

完整录入按顺序完成下列子步骤（任一步骤失败/中断需重做）：

| 序号 | 步骤 | 提示文案 |
|------|------|---------|
| 1 | 中心录入 | `Place your finger on the power button and hold still` |
| 2 | 尖端录入 | `Place the tip of your finger on the power button` |
| 3 | 左边缘录入 | `Place the Left edge of your finger on the power button` |
| 4 | 右边缘录入 | `Place the Right edge of your finger on the power button` |
| 5 | 完成 | `Fingerprint Added` + `Fingerprint actions protected by security chips` + Done 按钮 |

> 步骤 1~4 期间显示 `Adding fingerprint...` loading；中心录入与边缘录入合称为「内圈」与「外圈」步骤。

### 13.3 录入异常文案规则

| 触发条件 | 文案 / 行为 |
|---------|-----------|
| 录入中按下电源键 | 弹出提示，需要重新对准并继续录入 |
| 手指移动太快 | `Lift your finger adjust its position, then try again` |
| 手指边缘碰触 / 湿润导致覆盖不足 | `Cover more of the sensor` |
| 重复区域录制（同位置反复采样） | 提示已录制此区域，需移动手指至未录入位置 |
| 传感器脏污 | `Clean the power button, then try again` |
| 手指未保持静止 | `Hold your finger still` / `Place your finger on the power button and hold still` |
| 按压过重 | `Touch the power button lightly. Do not press` |
| 长时间未检测到手指 | 弹窗 `Fingerprint Timeout` + 描述 `We couldn't detect your finger. Adjust your finger position and try again.` + `Try Again` |
| 累计采样失败达上限 | 弹窗 `Failed to Add Fingerprint` + 描述 `Adjust your finger position and try again.` + `Try Again` |

### 13.4 指纹数量与列表规则

| 规则项 | 规则描述 |
|--------|---------|
| 最大数量 | **2 个** |
| 满上限行为 | 指纹列表不显示 `Add Fingerprint` 入口；列表显示已录入的 2 个指纹条目 |
| 删除可恢复 | 删除任一指纹后 `Add Fingerprint` 入口恢复，可再次录入 |
| 已退出录入的中间态 | 内/外圈步骤回退退出，未完成录入的指纹**不记入列表**且不能解锁；之前已完成录入的指纹不受影响 |

### 13.5 unlock device 开关规则

| 规则项 | 规则描述 |
|--------|---------|
| 入口 | Settings → 指纹页面 |
| 默认状态 | **开启** |
| 关闭行为 | 关闭后指纹不能用于解锁设备（锁屏后必须 PIN）；已录入指纹不被删除，重新打开开关即恢复指纹解锁能力 |

### 13.6 指纹识别与失败计数规则

| 规则项 | 规则描述 |
|--------|---------|
| 识别响应时间 | < 2s |
| 无效指纹提示 | `指纹无效，请重试` |
| 连续失败上限 | **5 次** |
| 失败上限文案 | `累计错误次数已达上限，请输入 PIN 码` |
| 失败上限后 | 指纹解锁标识不显示，指纹不再响应；必须 PIN 解锁 |
| 计数重置时机 | PIN 成功解锁后失败计数重置为 0 |
| PIN 错误次数互通 | 解锁时输错 4 次 PIN 后用指纹解锁成功，PIN 错误次数同步重置 |
| 锁屏页路径独立计数 | 主屏幕 / PIN 输入页两个路径下 5 次失败均触发同一上限提示，且计数互通 |

### 13.7 重启 loading 时间规则

| 已录入指纹数 | 重启后 loading 时间上限 |
|------------|---------------------|
| 1 个 | ≤ 2s |
| 2 个 | ≤ 4s |

### 13.8 必须 PIN 的安全场景（指纹无感应）

下列场景指纹解锁不响应，必须使用 PIN：

| 场景 |
|------|
| 设备重启后首次解锁 |
| 更改 PIN 码 |
| 进入指纹录入 / 管理页面 |
| 关机弹窗点击「取消」后再次锁屏唤醒 |
| SeedCard（Lite 卡）备份流程 |
| Keytag 备份流程 |
| 核对助记词流程 |
| 锁屏后使用 PIN 解锁，再进入其他解锁页（如签名授权）时尝试指纹 |

### 13.9 双击解锁键规则

- 连续按下 2 次「解锁键 / 电源键」时屏幕提示均为：`轻触屏幕或指纹解锁`

### 13.10 USB 锁与指纹兼容规则

- 已开启 USB 锁的设备，插拔 USB 数据线不影响指纹解锁能力

### 13.11 录入 / 删除中断断电规则

| 操作 | 中断时机 | 期望结果 |
|------|---------|---------|
| 录入第 1 个指纹 | 录入 loading 期间断电 | 重启后指纹要么未录入，要么录入成功可解锁；不出现损坏中间态 |
| 录入第 2 个指纹 | 录入 loading 期间断电 | 重启后第 2 个指纹要么未录入，要么录入成功可解锁；**不影响第 1 个指纹**正常解锁 |
| 删除单指纹（设备仅有 1 个） | 删除 loading 期间断电 | 重启后该指纹要么删除成功，要么未删除可继续解锁 |
| 删除第 2 个指纹（设备有 2 个） | 删除 loading 期间断电 | 重启后第 2 个指纹要么删除成功，要么未删除可解锁；**不影响第 1 个指纹** |

---

## 14. Pro2 我的地址（My Address）测试规则

> 适用范围：Pro2 及后续支持 My Address 功能的型号。

### 14.1 入口与「选择网络」页布局规则

| 规则项 | 规则描述 |
|--------|---------|
| 入口路径 | 应用菜单 → 我的地址 |
| 顶部账户选择器 | 显示当前选中账户（默认 `Account #1`），可点击进入「选择账户」页 |
| 网络列表 | 横向滚动展示所有支持网络 |
| Title 开关 | 列表底部存在 Title 开关，控制账户标题展示 |

### 14.2 网络列表清单（一期支持，共 20 个）

| 序号 | 网络名 | 序号 | 网络名 | 序号 | 网络名 |
|------|--------|------|--------|------|--------|
| 1 | Bitcoin | 8 | Dogecoin | 15 | Cosmos |
| 2 | Ethereum | 9 | Cardano | 16 | Filecoin |
| 3 | Solana | 10 | Ripple | 17 | NEAR |
| 4 | Tron | 11 | Aptos | 18 | Nostr |
| 5 | TON | 12 | Algorand | 19 | Polkadot |
| 6 | Kaspa | 13 | Bitcoin Cash | 20 | Litecoin |
| 7 | Sui | 14 | Conflux | | |

> 一期暂不支持 Cosmos / Polkadot 的子链。
> 2026-07-24 确认移除 7 个网络：Alephium / Benfen / Nervos / Neo N3 / Neurai / Nexa / SCDO（原清单 27 个 → 20 个），列表中出现上述网络视为 bug。

### 14.3 账户选择器规则

| 规则项 | 规则描述 |
|--------|---------|
| 默认选中 | 首次进入 / 重新进入 / 退出回归默认值均为 `Account #1` |
| 每页展示数 | 5 个 Account |
| 翻页按钮 | 「上一页」/「下一页」；首页「上一页」置灰；尾页「下一页」置灰 |
| 选中后返回 | 选中 Account → 点击「返回」回到「选择网络」页，账户选择器显示选中值 |
| 选中持久性 | 同一会话内切换网络 / QR 等不丢失选中；**退出「我的地址」或锁屏后清空，回归 `Account #1`** |

### 14.4 数字键盘输入规则（Go To Account）

| 规则项 | 规则描述 |
|--------|---------|
| 入口 | 「选择账户」页右上角「前往账户」按钮 |
| 键盘布局 | 数字 0-9 + `X`（退出）+ `✓`（提交） |
| 退出行为 | 点击 `X` 关闭键盘并返回「选择账户」页，不修改选中状态 |
| 有效输入范围 | `1 ~ 1,000,000,000`（闭区间） |
| 非法输入 | `0` 或 `> 1,000,000,000` 提交后清空输入并提示「输入格式错误」，停留在数字键盘页 |
| 边界翻页置灰 | 提交 `1` 后跳转 Account #1，「上一页」置灰；提交 `1,000,000,000` 后跳转 Account #1000000000，「下一页」置灰 |

### 14.5 地址详情页布局规则

| 字段 | 显示规则 |
|------|---------|
| 顶部标题 | `<Network> Address`（如 `Bitcoin Address`） |
| 派生路径选项 | 仅 BTC / ETH / SOL / LTC 显示，点击进入「Select Derivation Path」全屏页 |
| Account 标识 | 显示当前选中 Account（如 `Account #1`） |
| 地址展示 | 分段显示（按链格式约定） |
| EVM 多链提示卡 | 仅 Ethereum（及其他 EVM 兼容链）显示：`Your address is an EVM network address. You can use it to manage your assets across other EVM-compatible networks (such as Ethereum, BNB Chain).` |
| QR Code 按钮 | 底部固定按钮，点击弹出二维码 |

### 14.6 派生路径规则

| 链 | 可选派生路径 |
|----|-------------|
| BTC | Nested Segwit / Taproot / Native Segwit / Legacy |
| ETH | BIP44 Standard（默认）及该链支持的其他路径 |
| SOL | Ledger Live（默认）及该链支持的其他路径 |
| LTC | OneKey Extended（默认）及该链支持的其他路径 |
| 其他链 | 不显示派生路径切换入口 |

> 「Select Derivation Path」页每个路径下方有 description 简短说明；切换后地址详情页同步更新派生路径标签。

### 14.7 二维码规则

| 规则项 | 规则描述 |
|--------|---------|
| 入口 | 地址详情页底部 QR Code 按钮 |
| 内容 | 二维码本体 + 中央网络 icon |
| 关闭按钮 | 右上角 `X`，关闭后返回地址详情页 |
| 扫码一致性 | 扫描解析的地址与设备屏幕显示的地址逐字符一致 |

### 14.8 BTC 新鲜地址规则

| 规则项 | 规则描述 |
|--------|---------|
| 入口 | Bitcoin 地址详情页选择任意账户后显示新鲜地址切换按钮 |
| 输入编号 | 输入指定编号跳转到对应新鲜地址 |
| 派生路径覆盖 | 四种 BTC 路径（Nested Segwit / Taproot / Native Segwit / Legacy）均支持新鲜地址 |
| 跨工具核对 | 与 `https://bip39.onekey.so/index.html` 输入相同助记词 + 编号 + 路径生成的地址一致；Taproot 额外用 App 端导入助记词后核对 |

### 14.9 Passphrase 规则（Extra PIN 联动，2026-07-24 逻辑变更）

| 规则项 | 规则描述 |
|--------|---------|
| 无输入弹窗 | 「我的地址」全流程**不再弹出** Passphrase 输入框；主 PIN 解锁时出现该弹窗视为 bug（需禁止） |
| 主 PIN 解锁 | 无论 Passphrase 开关开启或关闭，主 PIN 解锁后进入「我的地址」都只能看到主（标准）钱包地址 |
| Extra PIN 解锁 | 仅当使用「Attach to PIN」绑定了 Passphrase 的 Extra PIN 解锁设备时，「我的地址」显示该 Passphrase 对应隐藏（密语）钱包的地址 |
| 钱包切换方式 | 唯一切换方式为锁屏后改用其他 PIN 解锁：主 PIN → 主钱包，不同 Extra PIN → 各自密语钱包；「选择网络」页不再提供「切换 Passphrase」按钮 |
| 会话一致性 | 同一解锁会话内切换网络 / 账户，钱包身份保持不变（由解锁所用 PIN 决定） |
| 关闭后行为 | 关闭 Passphrase 开关后，主 PIN 解锁进入「我的地址」显示主钱包地址，与开启状态下主 PIN 所见地址一致 |

> 历史规则（已废弃，2026-07-24 前）：进入网络前弹 Passphrase 输入框、右上角「切换 Passphrase」按钮、锁屏重置后重新输入、空值等价标准钱包 —— 因输入弹窗整体移除，上述场景均不再存在。

### 14.10 助记词位数支持规则

| 位数 | 支持来源 |
|------|---------|
| 12 | 设备创建 / 助记词导入 |
| 18 | 设备创建 / 助记词导入 |
| 24 | 设备创建 / 助记词导入 |

> 每种位数下标准钱包 + Passphrase 钱包地址均需与 App 端核对一致。

### 14.11 多语言一致性规则

- 设备语言切换（English / 简体中文 / 繁體中文 / 日本語 / 한국어 / Español / Português (Brasil)）只影响 UI 文案
- 同一 Account 同一网络同一派生路径下，各语言显示的地址字符内容完全一致
- 二维码扫描解析地址不随语言变化

---

## 变更记录

| 日期 | 变更内容 |
|------|---------|
| 2026-07-24 | 「我的地址」Passphrase 逻辑变更（§14.9）：Passphrase 输入弹窗整体移除；无论 Passphrase 开关开启或关闭，主 PIN 解锁只显示主钱包地址且禁止弹出输入框；隐藏（密语）钱包仅可通过「Attach to PIN」绑定的 Extra PIN 解锁进入；「切换 Passphrase」按钮、锁屏重置重输、空值等价等旧规则废弃。网络清单变更（§14.2）：确认移除 Alephium / Benfen / Nervos / Neo N3 / Neurai / Nexa / SCDO 共 7 个网络，27 个 → 20 个。用例重组：撤销《Pro2-我的地址-Passphrase与助记词位数》独立用例——主 PIN 负向验证并入《入口与账户选择》§6，Extra PIN 隐藏钱包与助记词位数矩阵并入《地址展示与派生路径》§8/§9；需求文档 Hardware-Pro2我的地址.md 同步更新 |
| 2026-07-13 | 按实机截图更正 Manage Your Card 管理项：Set Name / Change PIN / Protection Mode / Reset（原误写含 Title 开关）；Title 开关实际位于备份页顶部；同步更新 Pro2-SeedCard-管理与防护 用例文档。Keytag 备份用例删除「粘贴整段助记词」场景 —— 设备端输入无法粘贴，场景不可构造；用例界面文案中文化 |
| 2026-07-11 | SeedCard PIN 长度更正为**固定 6 位**（最长最短均为 6 位）；删除「Unsupported Recovery Phrase」错误状态规则 —— SeedCard 只能写入 12/18/24 位助记词，25 位卡场景不可构造；同步更新 Pro2-SeedCard备份 用例文档 |
| 2026-07-10 | 修正 SeedCard PIN 长度上限：4~9 位 → 4~6 位（已由 2026-07-11 进一步更正为固定 6 位）；同步更新 Pro2-SeedCard备份 三个用例文档（PIN 上限 + 界面提示文案中文化） |
| 2026-05-14 | 新增「Pro2 我的地址（My Address）」章节：入口与「选择网络」页布局、网络清单（27 个）、账户选择器（每页 5 个 / 翻页置灰 / 退出回归默认）、Go To Account 数字键盘（有效范围 1 ~ 1,000,000,000）、地址详情页字段（派生路径 / EVM 多链提示 / QR Code）、派生路径矩阵、二维码规则、BTC 新鲜地址、Passphrase 会话保持 / 锁屏重置 / 空值等价 / 切换入口、助记词 12/18/24 位、多语言地址一致性 |
| 2026-05-14 | 新增「Pro2 指纹（Fingerprint）」章节：录入入口（Onboarding / Settings）、分步流程（中心 / 尖端 / 左 / 右）、异常文案（Timeout / Failed / 移动太快 / 覆盖不足 / 重复区域 / 按压过重等）、列表上限 2 个、unlock device 开关、连续 5 次失败计数与 PIN 计数互通、重启 loading 时间（1指纹≤2s/2指纹≤4s）、必须 PIN 安全场景、双击解锁键、USB 锁兼容、录入/删除中断断电恢复 |
| 2026-05-11 | 新增「Keytag（金属抄写卡）备份测试规则」章节：入口与 SeedCard 并列、Recovery Phrase 始终必走、Invalid / Phrase Doesn't Match 文案、12/18/24 位点阵图分页规则、App 端核对一致性 |
| 2026-05-11 | 新增「SeedCard（原 Lite 卡）备份与恢复测试规则」章节：备份/恢复/管理/Backup Settings/Protection Mode/Recovery Phrase 验证/PIN 自毁机制/AirGap 拦截，覆盖 Pro2 SeedCard 改版新增功能 |
| 2026-05-11 | 新增「安全密钥（FIDO/U2F/FIDO2）」章节：解锁前置、Counter 机制、Binance vs Google 差异、列表上限 60、开关重启生效、测试站点参考 |
| 2026-04-14 | 根据 OK-51595 补充硬件钱包 Onboarding 固件更新规则：major 落后、同 major 下 minor 差值大于 2、或同 major + minor 下 patch 差值大于 2 时强制更新且不可跳过；异常场景保留重试与跳过入口 |
| 2026-01-16 | 初始化文档，整合 5.20.0 设备管理改版规则 |
