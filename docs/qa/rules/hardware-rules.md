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
- 表头使用：`| 优先级 | 场景 | 操作步骤 | 预期结果 |`（与 `docs/qa/qa-rules.md` §7.3 固定 4 列一致）
- 移除「自动化层级」列
- 预期结果中不包含断言语句

---

## 1. 设备管理测试规则

### 1.1 设备列表测试规则

| 规则项 | 规则描述 |
|--------|---------|
| 设备排序 | 与钱包账户选择器排序一致 |
| 设备图片 | 7 款设备图片需正确显示：Pure、Mini、Classic/1S、Touch、Pro 黑款、Pro 白款、Pro2 |
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

### 1.4 危险区域规则（清除设备数据 / 切换比特币专用固件）

| 规则项 | 规则描述 |
|--------|---------|
| 入口 | 设备详情页「危险区域」区块 |
| 适用设备 | Pro2 / Pro / Classic 1S / Pure（Touch / Mini 不显示入口） |
| 清除设备数据 | 重置设备，需在设备上确认；确认后设备数据清除、恢复未初始化状态，App 侧按「同设备重置后再创建钱包规则」处理 |
| 切换到比特币专用固件 | 点击后引导进入固件升级切换流程（BTC only 固件） |

### 1.5 未激活设备激活引导规则

| 规则项 | 规则描述 |
|--------|---------|
| 适用设备（旧流程） | Mini / Classic / Classic 1S / Touch / Pro：连接 → 设备验真（设备确认）→「继续」→ 激活引导页（「创建钱包」/「恢复钱包」按钮）→ 逐设备差异化说明页；「获取帮助」跳转官网帮助中心 |
| Pro2 新流程 | Pro2 未激活不走激活引导页，改为 App 侧「设置您的设备」三步时间线引导：完善基础设置（选语言 + 设备命名）→ 创建 PIN 码 → 设置钱包（创建新钱包：设备上生成助记词 / 恢复钱包：从助记词或 SeedCard 恢复） |
| 步骤推进 | 三步引导由设备端操作驱动：每步在设备上完成后 App 侧打绿色对勾并自动推进；当前步骤底部显示设备图标提示（「请在设备上继续」/「请在设备上选择一个选项」） |
| 入口区分文案 | App 会判断当前入口选择的是「创建钱包」还是「导入（恢复）钱包」，「设置钱包」步骤提示不同文案（具体文案以设计稿为准） |

### 1.6 QR 钱包限制规则

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
| Language | ✓（Pro2 ✗） | "Do you want to change language to [语言]?" |
| Auto Lock | ✓ | "Do you want to change Auto-Lock time to [时长]?" |
| Auto Shutdown | ✓ | "Do you want to change Auto Shutdown time to [时长]?" |
| Brightness | ✗ | 直接滑动调节 |
| Vibration & Haptic | ✓（Pro2 ✗） | "Do you want to open/close Haptic?" |

> **Pro2 例外**：Language / Brightness / Vibration & Haptic 在 App 直接修改，无硬件确认，修改后硬件显示修改成功页面；Auto Lock / Auto Shutdown 仍需硬件确认。

### 2.2 设置值范围规则

| 设置项 | 可选值 |
|--------|-------|
| Language | English, 简体中文, 繁體中文, 日本語, 한국어, Español, Português (Brasil) |
| Auto Lock | 30 seconds, 1 minute, 2 minutes, 5 minutes, 10 minutes |
| Auto Shutdown | 1 minute, 2 minutes, 5 minutes, 10 minutes |
| Brightness | 0-100%（百分比滑动） |

### 2.3 设备型号支持规则

> Pro2 功能支持与 Pro 一致；Language / Brightness / Vibration & Haptic 的修改方式不同（见 2.1 Pro2 例外）。

| 设置项 | Pro2 | Pro | Touch | Classic/1S | Mini | Pure |
|--------|------|-----|-------|------------|------|------|
| Language | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Brightness | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Auto Lock | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Auto Shutdown | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Vibration & Haptic | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |

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

### 3.3 Attach to PIN（关联 PIN）规则

> 需求文档：`docs/qa/requirements/Hardware-Pro2关联PIN.md`

| 规则项 | 规则描述 |
|--------|---------|
| 入口 | Passphrase 开关开启后，Passphrase 页面显示「关联PIN」入口；开关关闭不显示 |
| 主 PIN 前置校验 | 进入设置流程时**任何会话均需输入主 PIN**（主 PIN / Passphrase PIN 解锁均不豁免）。**Passphrase PIN 会话**下需要主 PIN 的场景（含关联流程、核对助记词 / Lite / Keytag / 指纹等验证页）均显示「标准钱包 PIN」副标题，**主 PIN 会话**无副标题。输错主 PIN 提示剩余次数，连续 5 次错误设备重置 |
| PIN 长度 | 最少 6 位；最长 Pro / Pro2 50 位、Classic 1S 9 位 |
| Passphrase 长度 | 1 ~ 50 位字符，空内容不可确认 |
| 新增 / 更新 / 删除分流 | 设置的 PIN 未被使用 → 显示「绑定」；已被使用 → 显示「删除」与「更新」（更新流程与绑定一致）。删除：二次确认页 →「我明白了」→ 删除成功提示页 →「完成」返回 Passphrase 页面 |
| 设备交互差异 | 勾选二次确认页：Pro2 点击「继续」进入 / 右上角关闭按钮取消；1S / Pro 滑动确认进入 /「取消」返回。确认 Passphrase 后：Pro2 弹窗提示（此时已绑定成功，无独立提示页）→「我已了解」→ 成功页；1S / Pro 独立提示页 →「我明白」→ loading → 成功页 |
| 组数上限 | Pro / Pro2 30 组、1S 3 组；达上限新增提示「移除 / 关闭」（Pro2 为「管理 / 关闭」），点击后需输入正确的 Passphrase PIN（主 PIN、错误 PIN 均提示不正确）方可进入删除流程 |
| PIN 唯一性 | 设置 / 修改的 Passphrase PIN 与主 PIN 或其他已存在 PIN 相同 → 提示 PIN 已被使用（设置流程）或提示覆盖（修改 PIN 码流程，可取消） |
| 修改 PIN 覆盖 | 修改 PIN 码时改为已占用值 → 提示覆盖；覆盖后钱包身份跟随发起修改的会话不变，被覆盖 PIN 的原绑定失效 |
| 锁定规则 | 主 PIN 会话删除 / 修改任意 Passphrase PIN 不锁定；Passphrase PIN 会话操作**非当前** PIN 不锁定、操作**当前** PIN 锁定；Passphrase PIN 会话关闭 Passphrase 开关 → 锁定且全部 Passphrase PIN 失效 |
| 安全验证页 | 核对助记词 / Lite / Keytag / 指纹 / 设置 Passphrase PIN 等验证页仅接受主（标准钱包）PIN，Passphrase PIN 无法通过 |
| 防时序侧信道 | 满上限后锁定，主 PIN / 各组 Passphrase PIN / 错误 PIN 解锁耗时无明显区别 |

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
| UI 入口 | 设备详情页「设备连接」区块，中文名「移除设备」（英文 Forget this device） |
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
| Certifications | 认证信息（仅 Pro2/Pro/1S/Pure 有） |

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

### 8.1 解锁与硬件确认规则（USB 通道）

> 本节为 USB 通道行为；NFC 通道贴靠即响应、不弹确认页，见 §8.8。

| 规则项 | 规则描述 |
|--------|---------|
| 解锁前置 | 设备未解锁时**禁止响应任何 FIDO 请求**（注册 / 认证均不弹窗），必须先要求用户解锁 |
| 确认方式 | 解锁后弹出 FIDO 确认页，需要用户在 Pro2 设备上确认才完成 |
| 取消行为 | 用户取消时浏览器侧报失败，设备端 counter 不变 |

### 8.2 Counter 计数器规则

| 规则项 | 规则描述 |
|--------|---------|
| 适用范围 | 本节递增规则适用于已核实的传统U2F样本；不泛化到所有FIDO2凭证，部分FIDO2请求使用零计数器 |
| 维护双方 | 设备端维护签名计数器，站点按自身策略保存并校验；需用已确认会递增的测试样本观察响应 |
| 校验逻辑 | 站点侧校验设备 counter 是否 ≥ 后台 counter；小于则拒绝（防回放） |
| 设备重置后果 | 设备重置 + 导入相同助记词后 counter 归零，无法通过严格校验的站点验证；需在站点后台移除旧密钥并重新注册 |
| 调试命令 | `trezorctl fido counter get-next`（查询并自增）/ `trezorctl fido counter set <值>`（强制设值） |
| 同设备双机修复闭环 | 同助记词的两台设备本质共享 FIDO 密钥对但 counter 各自维护。在严格校验站点（Binance）换设备登录前，必须用 `trezorctl fido counter set <≥ 后台 counter>` 把目标设备 counter 同步到 ≥ 原设备当前值，否则登录失败 |

### 8.3 站点差异：Binance vs Google

> 以下为既有专用U2F测试样本的站点策略，不由固件代码证明第三方当前策略。执行时核实样本及响应日志；没有后台可见性时不要求读取网站数据库。

| 行为 | Binance | Google |
|------|---------|--------|
| Counter 严格校验 | ✓（counter 不匹配直接登录失败） | ✗（counter 仅用于审计） |
| 同助记词换设备 | ❌ 不可（提示 counter 不匹配） | ✓ 可（弹窗确认后通过） |
| 同账户同助记词第二台设备注册 | ❌ 提示「已注册过」 | ✓ 允许（列表新增独立记录） |
| 重置后再用同助记词 | ❌ 必须在后台移除并重新注册 | ✓ 直接可用（同设备签发同等密钥） |

### 8.4 列表与上限规则

> 设备列表只统计保存在设备内的FIDO2驻留凭证。传统U2F核对网站绑定和认证，不要求设备列表新增；新增计数使用不同测试用户名，避免同用户替换已有条目。

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

### 8.8 NFC 认证规则（OK-64379）

> 适用范围：Pro2。手机通过 NFC 发起安全密钥注册 / 登录，主流程：手机发起请求 → 解锁设备并贴靠 → 设备返回响应 → 手机查看结果。

| 规则项 | 规则描述 |
|--------|---------|
| 响应方式 | 设备已解锁且开关开启时，贴靠期间直接完成注册 / 签名，**不弹确认页、不需要点击**；贴靠本身即用户在场证明 |
| 结果页 | 注册完成显示「注册请求已批准」，登录完成显示「登录请求已签名」，均带应用名称与账户名称，**约 2 秒后自动消失**，无按钮 |
| 手机选账户分支 | 手机请求同一网站多个可发现凭证且由手机选账户时，设备在**全部响应回传完成后**显示「请在手机上继续 / 在手机上选择账户以完成登录」；只显示应用名称，不显示账户名称、账户数量或「登录成功」；页面保留到点击「完成」或自动锁屏，「完成」只关闭提示，不取消手机登录 |
| 禁用条件（最高优先级） | 设备锁定、关机、安全密钥开关关闭、AirGap 开启时立即停止 NFC 认证；正在等待的请求同时终止；解锁或恢复后**不沿用旧请求**，手机必须重新发起 |
| 会话互斥 | NFC 认证、USB 认证、SeedCard 备份读卡一次只处理一个会话；交易确认、PIN 输入、固件升级、蓝牙配对等关键流程期间，新的 NFC 请求不能切走当前界面，手机侧失败或忙碌。监听不等于自动授权 |
| 读卡模式切换 | 只有明确进入备份 / 恢复读卡页时才开启读卡模式，其余状态保持卡模拟监听等待手机贴靠；离开读卡页（返回 / 完成 / 取消 / 超时）后，仅当设备仍解锁且开关开启才恢复卡模拟监听，否则关闭 |
| AirGap | AirGap 开启期间 NFC 认证不可用；关闭 AirGap 后无需重启即恢复 |
| i18n | 新增 4 条文案：注册请求已批准 / 登录请求已签名 / 请在手机上继续 / 在手机上选择账户以完成登录 |

### 8.9 驻留凭证添加Toast

| 规则项 | 规则描述 |
|--------|---------|
| 完成反馈 | FIDO2驻留凭证保存到设备后显示“安全密钥已添加”，设备列表网站及用户与请求一致 |
| 非添加操作 | 仅使用已有凭证认证时不显示添加Toast，列表数量不变；传统U2F网站绑定不要求驻留添加Toast |
| 未完成 | 批准或写入前取消、断连、超时不新增设备记录、不显示添加Toast；重新保存后仅反馈本次添加 |
| 提示消费 | 同一次添加不反复显示；无新添加操作时退出重入不重放旧Toast |

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

## 13. Pro2 指纹测试规则

> 适用本轮 Pro2 设备端指纹用例；其他型号的支持范围不据此扩大。最新口径见 docs/qa/requirements/Hardware-Pro2指纹.md，2026-11-07 用户已确认。

### 13.1 录入入口

1. 初始化设置 PIN 后显示“指纹解锁”，说明“使用指纹更快解锁您的设备。您仍可随时使用 PIN。”，按钮为“添加”“暂不”。此时无需重复验证刚设置的 PIN。
2. 设备设置→安全→指纹需正确 PIN 验证；错误 PIN 停留验证页。跳过录入只表示没有指纹及解锁能力，不表示关闭“解锁设备”开关。

### 13.2 分段采集与完成

1. 初始“轻触电源键”“将手指轻放在电源键上。”；第一段随进度提示保持静止、采集指尖。中途“调整握持姿势”“继续操作，采集指纹边缘。”，继续第二段直至完成。旧中心/尖端/左/右四个固定阶段不再作为验收流程。
2. 每次有效采样后抬起再轻触；有效采样图形进度增加，持续按住不重复累计。采集期间显示指纹图形和扫描反馈，不要求固定旧加载文案。
3. 完成页显示“指纹已添加”“指纹数据受安全芯片保护。”；勾选动画播放一次并停在末帧，随后显示“完成”。初始化入口继续初始化，设置入口返回指纹列表。

### 13.3 录入异常与重试

1. 移动过快、低质量或需换位置：“抬起手指，换个位置重试。”；覆盖不足或过度施压对应覆盖错误：“让手指覆盖更多传感器区域。”；清洁错误：“清洁电源键后重试。”；静止提示：“保持手指静止。”。
2. 按下电源键：“轻触电源键。不要按压。”；调整后继续，已完成采样保留。实际错误提示按对应采样错误核对，不把一次湿润或移动等同于必然命中某个底层错误。
3. 已录入手指重复录入：“此指纹已录入，调整您的手指位置后重试。”，当前采集重新开始，已有指纹保留，不新增重复条目；区别于同一区域反复采集的质量提示。
4. 超时结果页：“指纹超时”“我们无法检测到您的手指，调整您的手指位置后重试。”；失败结果页：“添加指纹失败”“调整您的手指位置后重试。”。点击“重试”从头录入，不续接旧进度；关闭返回相应入口，不写入未完成指纹。

### 13.4 数量与列表

1. 最多两个指纹；未满显示“添加”，满两个隐藏，移除后恢复。
2. 点击条目显示“重命名”“移除”；移除确认显示“移除指纹？”“此指纹将无法再用于解锁您的设备。”及“取消”“移除”。取消后保留指纹及能力，已通过管理入口验证后不逐项重复要求 PIN。
3. 采集中途退出不写入条目、不能解锁，原有指纹保持可用。

### 13.5 解锁设备开关

1. 默认开启；是否具备指纹解锁能力还取决于已有指纹及当前安全验证条件。
2. 关闭后列表保留，锁屏不显示指纹标识且必须 PIN；再次开启恢复原指纹解锁能力。

### 13.6 识别与失败计数

1. 有效指纹单次解锁响应小于2秒；两个已录入指纹均可使用。不匹配显示“指纹不匹配，请重试。”。
2. 连续五次失败显示“尝试次数过多，请输入 PIN 解锁。”，隐藏指纹标识且必须 PIN。锁屏与 PIN 输入页计数互通，PIN 解锁后重置。
3. 保留解锁时输错四次 PIN 后使用有效指纹解锁会重置 PIN 错误次数的既有要求。

### 13.7 重启加载性能

1. 保留用户选定的仓库基准：一个指纹≤2秒，两个指纹≤4秒；不采用旧 Jira 两个也≤2秒的冲突值。
2. 重启首次先 PIN 解锁；指纹加载画面出现到消失为加载计时范围。完成后再锁屏验证指纹能力，不把加载完成等同于可跳过首次 PIN。

### 13.8 必须 PIN 的场景

1. 设备重启首次解锁、更改 PIN、指纹录入/管理、关机弹窗取消后锁屏唤醒。
2. SeedCard、Keytag 备份、核对助记词，以及 PIN 解锁后进入敏感操作的二次验证页。不能用日常锁屏指纹资格替代敏感操作 PIN 验证。

### 13.9 电源键提示

1. 锁屏连续按下两次电源键，均显示“使用指纹或点击解锁”，不触发关机等其他动作。

### 13.10 USB 兼容

1. 已开启 USB 锁时，锁屏插拔 USB 后指纹仍可解锁；不因插拔解除锁屏。

### 13.11 录入或移除中断

1. 在零个/一个指纹基础上新增或在一个/两个指纹基础上移除，断电后目标仅可为完整旧态或完整新态，不出现条目与可用能力不一致；其他已录入指纹保留。
2. 重启先 PIN 解锁，再重新锁屏核对各条目；仅在已备份的专用测试设备执行。

### 13.12 中文文案维护

1. 以当前页面实际引用的简体中文资源为准，场景及步骤用中文描述；不保留大段英文提示，不根据旧翻译键残留继续验收已移除页面。
2. UI 原文中的“尝试次数”等是准确提示文案，不能为了机械禁词扫描改写；不把“尝试”作为模糊操作预期。PIN、USB、OneKey 等必要名词保留。
3. 对仍为英文的内部异常兜底，报告实现文案差异，不虚构已上线中文提示。

---

## 14. Pro2 收款（原我的地址）测试规则

> 适用范围：Pro2。2026-11-07用户确认新版列表、同页二维码、路径弹层及BTC新鲜地址预期。

### 14.1 入口与网络列表

| 规则项 | 规则描述 |
|--------|---------|
| 入口 | 应用菜单 → 收款；顶部Account默认#1，点击进入账户选择 |
| 列表 | 网络纵向排列，可上下滚动；不保留旧Title开关 |
| 进出详情 | 点击网络查看同页地址和二维码，点击“完成”返回网络列表；同会话Account不变 |

### 14.2 网络清单与顺序

1. 共21个：Bitcoin、Ethereum、Solana、Tron、TON、Kaspa、SUI、Dogecoin、Cardano、XRP Ledger、Aptos、Algorand、Bitcoin Cash、Conflux、Cosmos、Filecoin、Litecoin、NEAR、Nostr、Polkadot，另增加Zcash；原有20个网络相对顺序保留，不预设Zcash新增位置。
2. 不支持Cosmos/Polkadot子链；不显示已移除的Alephium、Benfen、Nervos、Neo N3、Neurai、Nexa、SCDO。

### 14.3 账户选择器

| 规则项 | 规则描述 |
|--------|---------|
| 默认值 | 首次进入、退出收款或锁屏后重新进入均为Account #1 |
| 翻页 | 每页5个账户，编号连续；首页上一页及尾页下一页不可点击 |
| 选中 | 点击账户即返回网络列表，显示所选编号；浏览翻页后取消不改变原选择 |
| 会话保持 | 同一次收款会话切换网络、路径或地址索引不改变Account账户编号 |

### 14.4 输入账户编号

| 规则项 | 规则描述 |
|--------|---------|
| 入口 | 账户页右上角“前往账户”，显示数字键盘与输入预览 |
| 范围 | 1至1,000,000,000，含端点；提交后网络页显示所选Account |
| 无效值 | 0或大于1,000,000,000：提示“无效的账户”、清空输入，停留键盘，不替换原Account |
| 空值/取消 | 空输入不能确认；取消返回选择流程，不改变账户 |

### 14.5 地址详情同页布局

| 规则项 | 规则描述 |
|--------|---------|
| 展示 | 网络名称、二维码及中央网络图标、Account、完整分段地址同页，底部“完成” |
| 路径入口 | 顶部入口打开选项弹层；取消不改变路径、地址或二维码 |
| 旧布局 | 不再依赖QR Code按钮及独立二维码弹页，不强制旧EVM说明卡 |
| 变更一致性 | 切换网络、账户、路径或BTC地址索引后，地址、扫码结果及当前身份对应，不能显示上一选择内容 |

### 14.6 派生路径选项

| 链 | 可选路径 |
|----|---------|
| BTC | Nested Segwit / Taproot / Native Segwit / Legacy |
| ETH、SOL | BIP44 Standard / Ledger Live |
| LTC | Nested Segwit / Native Segwit / Legacy |
| Kaspa | OneKey Extended / Kaspa Official |
| Zcash | 公开 / 隐私 / 旧隐私地址，默认公开 |
| 其他链 | 不显示路径切换入口 |

选中标记唯一，选择后关闭弹层并更新同页地址和二维码；不从旧用例推断未经确认的默认路径。

Zcash为设备端三种地址路径，App只支持公开、隐私两种。默认公开地址，与App同钱包同账户核对；旧隐私地址与已核验的同钱包同账户离线参考核对，二维码用独立工具解码。不因App缺少旧隐私路径缩减硬件覆盖，也不把App的隐私同步要求作为设备端展示地址的前置。三种路径切换不改变Account或解锁钱包身份，隐藏钱包按各自身份核对。

### 14.7 二维码

二维码直接与地址同页，中央图标对应当前网络；扫码解析内容与完整地址逐字符一致。地址分段及语言切换不改变实际内容。

### 14.8 BTC新鲜地址

1. 在BTC地址页点击Account，显示当前账户可选地址序号及完整派生路径；当前选中项唯一。
2. 选择另一条后地址、二维码及路径对应新索引，切回恢复原地址；取消不改变原选择。
3. 地址索引与Account账户编号分开，选择新鲜地址不更换账户或解锁钱包身份，不污染其他网络。
4. 四种BTC类型均覆盖，与App或只使用测试种子的离线工具按相同钱包、账户、路径、地址索引核对。
5. 使用包含该功能的受测固件，不预设分页数量、序号上限或重启保留规则。当前main尚未提供可点击Account入口不改变用户要求的正式预期。

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

## 15. Pro2 Apple Find My 测试规则

> 适用范围：Pro2。需求来源：Apple Find My 自认证 R1.7（`FindMy_测试执行手册.docx`）+ Find My 设计稿（2026-07 正式方案）。

### 15.1 入口规则

| 规则项 | 规则描述 |
|--------|---------|
| 入口数量 | **2 个**，行为完全一致 |
| 入口 1 | 设备根目录（应用菜单）→ `Find My` 独立桌面图标 |
| 入口 2 | Settings → `Apple Find My`（列表项位于 Genuine Check 与 About Device 之间） |
| 页面标题 | `Apple Find My` |
| 返回行为 | 从哪个入口进入就返回哪里（桌面图标 → 根目录；Settings 项 → Settings 页） |
| 快捷入口 | 关机页（Slide to power off）与开机 Hello 页显示 `Apple Find My` 入口（仅 Find My 开关开启时），跳转交互两处一致；快捷页含 `View Serial Number` / `Disable Find My` 两个按钮；Find My 禁用后关机页不再显示该入口 |

### 15.2 开关与状态页规则

| 规则项 | 规则描述 |
|--------|---------|
| 开关默认状态 | **关闭**（已产品确认 2026-07-27） |
| 开启行为 | 开启后展示「配对状态」区块，**直接进入配对流程**（可被 iPhone 查找 App 发现） |
| 未绑定自动关闭 | 开关开启后 **10 分钟内未完成绑定 → 开关自动关闭，无任何提示**（无弹窗 / toast）；10 分钟内完成绑定则不触发自动关闭（已产品确认 2026-07-27） |
| 关闭状态页面 | 仅展示「Apple Find My」开关一项 + 文案 `Turn on Find My to pair your device and locate it with Apple Find My.` |
| 快捷禁用 | 关机页 Apple Find My 页点击 `Disable Find My` → 跳转「Find My Disabled」提示页（`Find My is turned off. You can enable it again in Settings.`）→ `Got it` 返回关机页且入口消失；Settings 开关同步为关闭，配对关系保持，重新开启后恢复 |
| 低电量关机提示 | 电量 <20% 时关机页显示文案 `Low battery (<20%). To keep the battery healthy, please ensure the device is fully charged before long-term storage.` |
| 未配对状态页 | `Status: Not Paired` + 文案 `Open Apple Find My on your iPhone or iPad to add this device.` + `How to Pair or Unpair?` 链接（跳转 Tips 提示页） |
| 已配对状态页 | `Status: Paired` + 文案 `Your OneKey Pro 2 is paired with Apple Find My.` + `How to Pair or Unpair?` 链接 + `View Serial Number` / `Reset Find My` 两个操作项 |
| 关闭行为 | 已配对状态下关闭开关 = 物理禁用广播，iPhone 端不可定位、不可播声；重新开启后恢复 |
| 开关持久化 | 开关状态断电重启后保持 |

### 15.3 View Serial Number 规则

| 规则项 | 规则描述 |
|--------|---------|
| 触发弹窗 | 标题 `View Serial Number`，文案 `Open the Find My app on your Apple device to view your serial number. Expires in 5 minutes`，按钮 `Got it` |
| 有效期 | 进入序列号读取状态后 **5 分钟**内 iPhone 查找 App 可读取序列号；过期后不可读，需重新触发 |
| 点击反馈 | 点击查看 SN 按钮后当前页面 toast 提示 |
| 一致性 | iPhone 端 / 找回网页显示的序列号必须与设备 About Device 序列号及机身印刷序列号一致 |

### 15.4 Reset Find My（设备端解绑）规则

| 规则项 | 规则描述 |
|--------|---------|
| 二次确认弹窗 | 标题 `Reset Apple Find My?`，文案 `This device will no longer be locatable with Apple Find My.`，按钮 `Cancel` / `Reset` |
| Cancel 行为 | 弹窗消失，配对状态不变 |
| Reset 成功 | 提示 `Removed from Find My.`，页面跳转「Find My 未配对状态页」，开关保持**开启** |
| 排他保护 | 设备端 Reset / 恢复出厂设置**不解除 iCloud 账户绑定**；原所有者未在 iPhone「查找」App「移除物品」前，其他 Apple ID 无法重新配对（防转卖 / 防盗，Apple 规范 TCP004）。**已产品确认（2026-07-27）** |

### 15.5 声音与时序规则

| 规则项 | 规则描述 |
|--------|---------|
| 播放声音表现 | **蜂鸣**（buzzer） |
| 被定位提示页 | 设备被 iPhone 定位 / 搜索时，设备端全屏显示「查找我的设备」提示页（文案见 §15.6「被定位提示页」），点击 `OK` 或右滑返回可关闭；搜索期间设备保持唤醒（wake lock） |
| 配对超时行为 | 已产品确认：开启后 10 分钟未绑定 → **Find My 开关自动关闭、无提示**（见 §15.2）；计时器实现在蓝牙子模块固件（主固件 firmware-pro2 中无此逻辑，仅同步开关状态） |
| 开关默认值（代码疑点） | 产品确认默认**关闭**；但 dev 分支 `storage_manager.c` 中 `findmy_enabled` 存储默认值为 `true`，与产品定义不符——**疑似固件缺陷，建议向固件侧报缺陷核实**（回归时重点验证恢复出厂后首次进入页面的开关状态） |
| Nearby → Separated | 与所有者设备蓝牙断开约 15 分钟后进入「分离」状态，可被 Find My 网络中继定位 |
| 关机行为 | 关机后停止 Find My 广播，iPhone 端提示物品无法访问；位置停留在最后已知位置 |

### 15.6 界面文案中英对照

> 中文列为**固件真源译文**（firmware-pro2 dev 分支 `utils/resource/input/translations/zh_CN.json`，2026-07-27 校准）。固件译文更新后需回改本表及用例文档。

| 位置 | 英文原文 | 固件中文译文（zh_CN） |
|------|---------|---------------------|
| 开关关闭状态说明 | `Turn on Find My to pair your device and locate it with Apple Find My.` | 开启“查找”以配对您的设备，并通过 Apple “查找”进行定位。 |
| 未配对状态 | `Status` / `Not Paired` | 状态 / 未配对 |
| 未配对引导文案 | `Open Apple Find My on your iPhone or iPad to add this device.` | 在您的 iPhone 或 iPad 上打开 Apple “查找”以添加此设备。 |
| 配对/解绑帮助链接 | `How to Pair or Unpair?` | 如何配对或取消配对？ |
| 已配对状态 | `Status` / `Paired` | 状态 / 已配对 |
| 已配对说明文案 | `Your OneKey Pro 2 is paired with Apple Find My.` | 您的 OneKey Pro 2 已与 Apple “查找”配对。 |
| 查看序列号弹窗 | `View Serial Number` / `Open the Find My app on your Apple device to view your serial number. Expires in 5 minutes` / `Got it` | 在“查找” App 中查看序列号 / 在您的 Apple 设备上打开“查找” App 以查看序列号。5 分钟后过期 |
| 重置二次确认弹窗 | `Reset Apple Find My?` / `This device will no longer be locatable with Apple Find My.` / `Cancel` / `Reset` | 重置 Apple “查找”？/ 此设备将无法再通过 Apple “查找”进行定位。 |
| 解绑完成提示 | `Removed from Find My.` / `Find My reset.` | 已从“查找”中移除。/ Apple “查找”已重置。 |
| 快捷禁用完成页 | `Find My Disabled` / `Find My is turned off. You can enable it again in Settings.` / `Disable Find My` | Apple “查找”已禁用 / Apple “查找”已关闭。您可以在设置中重新启用它。/ 禁用 Apple “查找” |
| 低电量关机提示 | `Low battery (<20%). To keep the battery healthy, please ensure the device is fully charged before long-term storage.` | 电量偏低（<20%）。为保持电池健康，长期存放前请确保设备已充满电。 |
| 被定位提示页 | `Find My Device` / `Searching for your device. Please keep it nearby until the search completes.` | 查找我的设备 / 正在搜索您的设备。请将其保持在附近，直到搜索完成。 |
| 绑定状态系统提示 | `Find My Device Bound` / `Find My Device Unbound` / `Responding to a Find My request.` | 查找我的设备已绑定 / 查找我的设备未绑定 / 正在响应“查找”请求。 |

---

## 16. Pro2 Portfolio（资产组合）测试规则

> 适用范围：Pro2（配合 OneKey App iOS / Android / Desktop）。需求来源：产品口述（2026-09-09）+ app-monorepo `x` 分支源码（`ServiceHardwarePortfolioSync.ts` / `TokenListBlock.tsx`，PR #13107 / #13133 / #13175 / #13207）。用例：`hardware/HW-Pro2/Pro2-Portfolio/2026-07-27_Pro2-Portfolio-功能测试.md`。

### 16.1 数据链路规则

| 规则项 | 规则描述 |
|--------|---------|
| 数据来源 | App 汇总当前账户代币列表（数量、法币价值）→ 提交服务端 → 服务端校验、归一化、补全代币元数据（图标、颜色）并打包签名 → App 传输给硬件 |
| 硬件职责 | 只做展示，不做汇率计算；图标 / 颜色 / 排序等展示信息以服务端下发为准 |
| 账户名 | 显示 App 账户名；无自定义名称时显示 `Account #N`（N = 索引账户序号 + 1） |
| 同步时间 | 按 App 本地时区显示，格式 MM-DD HH:mm |
| 显示币种 | 跟随 App 设置币种 |
| 服务端不可用 | 同步失败，硬件数据与同步时间不变，不留半截数据 |

### 16.2 图标回退规则

| 规则项 | 规则描述 |
|--------|---------|
| 内置代币 | 显示内置官方图标 |
| 未内置代币 | 显示该代币 Symbol **首字母**的占位 icon |
| 内置 EVM 网络 | 代币图标右下角显示对应网络角标 |
| 未内置 EVM 网络 | 网络角标显示**通用网络 icon** |
| 回退不影响统计 | 图标回退的代币在首页 +N、详情页排序与占比中正常参与 |

### 16.3 自动同步规则

| 规则项 | 规则描述 |
|--------|---------|
| 触发视图 | 仅 App 首页「**所有网络**」视图（资产变化 / 列表刷新完成后）；**单链视图无自动同步** |
| 防抖 | 1s 内多次刷新只传最后一次 |
| 冷却 | 两次自动同步间隔 **60s**；冷却期内的变化在冷却结束后**自动补传最后一次快照** |
| 设备状态 | 仅设备**亮屏且未锁定**时传输；锁屏 / 熄屏期间不传输，被跳过的最新快照在设备解锁 / 完成一次交互式硬件操作后自动补传 |
| 传输方式 | 仅 **USB** 静默传输。手机蓝牙：静默同步挂起、保留最新快照，待下一次交互式硬件操作后补传。桌面蓝牙：交互操作后 30s 空闲、150s 复用窗口内补传，两次蓝牙传输间隔 5 分钟 |
| 通道忙 | 设备处理其他指令时不传输，空闲后 1s 内重试，只上传一次 |
| 开关关闭 | Portfolio 开关关闭时同步照常进行，仅不展示；开启后直接展示最后一次同步数据 |
| 多设备 | 每台设备独立记录最近同步哈希与冷却计时 |

### 16.4 自动锁定不受同步影响规则（固件侧）

| 规则项 | 规则描述 |
|--------|---------|
| 核心规则 | App 同步逻辑不变；硬件需将自动锁定计时与 Portfolio 传输**错开**：传输**不重置、不延后**设备自动锁定计时 |
| 传输中锁定 | 设备到达设定的自动锁定时间时，即使 Portfolio 数据正在传输，也照常触发自动锁定 |
| 锁定后数据 | 传输中止或忽略，硬件不留半截数据（显示旧数据或完整新数据）；解锁后由 App 补传 |
| 计时来源 | 只有用户触摸 / 解锁操作重置自动锁定计时 |

### 16.5 手动同步规则

| 规则项 | 规则描述 |
|--------|---------|
| 入口 | App 首页代币列表区域「同步到设备 / Sync to Device」按钮：桌面端位于代币总值旁，移动端位于头部操作区 |
| 可见性 | 仅 **Pro2 等 Protocol V2 HW 钱包标准账户**显示；HD 钱包、QR 钱包、Passphrase 隐藏钱包（OK-62192）、非 Protocol V2 硬件不显示 |
| 触发视图 | 「所有网络」与单链视图均可点击 |
| 流程 | 先刷新代币列表再上传，走标准硬件处理流程；需设备**解锁唤起**（锁屏时要求输入 PIN）；不要求已建立连接（未连接时进入连接 / 搜索流程） |
| 按钮状态 | 同步中 / Syncing → 已同步 / Synced → 恢复常态；同步中、固件升级中、其他硬件操作进行中置灰 |
| 冷却与去重 | **不受 60s 冷却限制、无内容去重**：数据未变化也重新传输 |
| 单链数据 | 硬件展示该链资产，总金额为该链合计；**排除零余额默认代币**（OK-62181）。所有网络视图同步时零余额主币保留，与 App 首页一致 |
| 部分链失败 | 所有网络视图下部分链加载失败，超时后仍上传当前已加载快照 |

---

## 17. Pro2 设备端签名手势

1. 入口为设备端「设置 → 钱包 → 签名手势」，仅包含滑动签名、长按签名、点击签名，默认仅滑动签名选中。
2. 修改手势后，后续交易签名页使用当前所选方式；滑动需完成滑动，长按需持续按住至确认，点击通过一次点击确认。
3. 震动开启时，长按过程显示绿色边框动画并有震动反馈；短按或中途松开不确认，中途松开停止震动并回退进度，重新按住从起始进度开始。
4. 退出设置、锁屏解锁、重启保留所选手势；取消重置也保留。完成设备重置并重新初始化后恢复默认滑动签名。
5. 三种手势均需在交易签名页验证，同一请求仅确认一次；重置场景最后使用已备份的专用测试设备执行。
6. 本节依据 2026-11-07 用户需求与其对应的未完成手势、取消重置边界整理，适用于 Pro2 设备端；不套用 §2 App 设备管理设置的确认方式。关闭通用震动后，三种签名仍可完成、长按绿色边框仍显示，签名过程无震动；重新开启后恢复反馈。

## 18. Pro2 设备端通用设置

1. 适用入口为 Pro2 设备端「设置 → 通用」，与 §2 App 设备管理通用设置区分。中文/English 切换应用于设置及其子页面。
2. 动画默认开启；开关只改变页面过渡效果，不禁用手势。动画开启与关闭均验证一级菜单/设备App首页的Home Bar，以及普通页面的底部上滑退出、左边缘/页面中部向右侧滑返回、列表中部滚动。
3. Home Bar仅从主屏进入一级菜单或设备App首页时显示2秒后隐藏；进入通用及其他子菜单不显示、不重复计时。普通子页面没有Home Bar仍可上滑退出；签名、PIN、备份、授权等受保护流程保留既有退出限制。
4. 震动默认开启，覆盖键盘输入/删除、按钮/开关、滑动签名开始/未完成/完成、长按签名开始/取消/完成；操作结束后无残留震动。关闭时上述操作无震动，签名功能与长按绿色边框保留，重新开启恢复反馈。
5. 双击唤醒默认开启；开启时单击不唤醒、双击唤醒，关闭时触摸不唤醒，电源键仍可唤醒。
6. 亮度范围为 10%～100%，最低亮度下可辨识页面；型号名称与蓝牙 ID 默认开启，锁屏显示随开关变化。
7. 自动锁定选项为 30 秒、1/2/5/10/30 分钟、永不；自动关机选项为 1/2/5/10 分钟、永不。默认 1 分钟锁定加锁定后 5 分钟关机；原 Jira 的计时预期保留，不以源码的睡眠计时替换。
8. 磁吸检测默认关闭；开启后合盖熄屏/开盖亮屏，关闭后不联动，无线充电磁场不造成反复闪屏。持续磁场干扰（如笔记本电脑触控板侧边）被屏蔽后可手动亮屏，移开磁场、恢复检测后保护壳联动恢复；不写死旧 3 秒时限。
9. 声音默认开启，开启显示音量滑条及交易/二维码子开关，关闭隐藏并停止相应提示音；拖动音量后松手播放试听。交易与扫码完整识别分别遵循各自开关，两声完成提示沿用原 Jira；Turbo 也遵循交易提示开关。
10. 通用设置逐项覆盖退出重入及常规重启后保留；每项核对所选值，并执行相应操作。Portfolio 使用已有专用用例。
11. 动画章节按受测固件的全部菜单/App及可达普通子页清单逐页点击、上滑退出和重入，核对无半程卡住、闪烁、残影、叠页、触摸失效、闪退或设备重启；不能只抽查设置页后声称全页面覆盖。
12. 普通页面手势滑到一半时，App地址核对或签名请求接入并打断原动画，结束旧触摸，呈松开还原状态。未完成导航还原，已完成导航保持完整终态；新请求独立展示，不继承旧触摸确认/取消。覆盖临界松手及刚完成时机，处理后可重新交互；动画开/关均覆盖。
13. 亮度/音量拖动、列表滚动被新请求打断时，同样结束按住、拖动或滚动状态，不残留中间页面位移。还原触摸状态不要求撤销已生效的设置数值；不得将导航完成误写成交易签名获批。

## 19. 硬件通用专项与蓝牙适配

1. 当前只有Mini不支持蓝牙；Classic、Classic 1S、Classic Pure（Pure）、Touch、Pro、Pro2、Neo支持蓝牙。型号写在用例内容中，蓝牙配对、连接状态及蓝牙/USB中断用例标题不带支持设备列表。
2. 蓝牙能力与第三方钱包、AirGap、SLIP39、配对码、教程页面能力分别判断，不能由支持蓝牙推定其他能力。
3. Pro需完成初始化后才能配对；其他支持蓝牙的设备可在初始化完成前配对。配对完成不等于钱包就绪，钱包添加仍遵循实际初始化进度。
4. Pro2的蓝牙请求不能中断未结束的USB请求；其他支持设备覆盖双向中断。被中断请求不继承后续触摸确认，重发必须重新明确确认。
5. Pro/Pro2无需输入蓝牙配对码；错误配对码只用于要求输入配对码的旧型号。型号差异与手机系统差异均需记录。
6. 本轮24个Test按先生成并review、经用户授权再同步的流程维护；已核实映射不代表未来永久写入授权。写入后须回读正文、换行及授权修改的标题，保留原附件；完整范围与相近覆盖见 `docs/qa/requirements/Hardware-通用专项用例补齐.md`。
7. 创建钱包耗时沿用用户确认的旧Classic指标：Classic 3.0.0原V4分组在USB、蓝牙约12–17秒，原V5分组约20秒；不把近似值改成精确超时上限。其他型号只记录本轮耗时和失败次数。
8. 当前本批硬件测试工具不依赖Bridge；Protobuf用例不要求安装旧Bridge，也不保留“403先排查Bridge版本”的判定。用户确认旧安装包不再保留，其他原附件仍需保留。

## 20. Pro2 初始化提交与专项维护

1. 创建/导入过程中，显示「钱包已就绪」之前重启或断电仍为未激活；从该页起及后续阶段重启为已激活。导入旧 Jira OK-54255 末尾的“含该页仍未激活”与步骤冲突，本轮用户确认以此分界统一。
2. OK-55001 按 Pro2 设备维护；用户确认 review 后同步时将原标题「Pro - 设置 - 睡眠/唤醒」改为「Pro2 - 设置 - 睡眠/唤醒」。已于 2026-11-09 按本批授权同步。
3. 设备进入签名确认页后没有 AirGap 开关入口，不编写“签名确认页中开启/关闭 AirGap”步骤；空闲时切换连接状态与签名拒绝分别验证。
4. 第三方钱包出现 Trezor 升级提示只验证取消，再回 OneKey 官方入口升级；内部异型号包的拒绝校验独立覆盖，不把取消提示当作固件拒绝证据。
5. 本批 37 个 Test 的复用/新增关系及原文差异见 `docs/qa/requirements/Hardware-Pro2专项用例补齐.md`。Lite 卡按 §11 已确认的 SeedCard 名称与恢复规则复用，不重复生成旧交互，也不构造无法写入的 15/21 词卡。

## 变更记录

- 2026-11-07：按用户确认维护 Pro2 指纹新版分段录入、从头重试、重复指纹及管理确认；统一中文文案并保留1个≤2秒/2个≤4秒与首次 PIN 要求。

| 日期 | 变更内容 |
|------|---------|
| 2026-11-09 | 用户确认 Pro2 导入以钱包已就绪为激活分界；OK-55001 按 Pro2 编写并在 review 后改名，同批 37 个专项先本地交付 |
| 2026-11-09 | 用户确认当前Mini无蓝牙、其他型号支持；名称移除设备列表，保留Pro初始化配对与Pro2 USB优先差异，补齐24个专项待review稿 |
| 2026-11-07 | 用户确认移除未实现的屏幕布局调整及重启/升级保留布局两条用例，同步清理§18当前验收规则、需求、可复制版及OK-55000描述；此前纳入布局的记录仅作历史 |
| 2026-11-07 | 用户修正§18 Home Bar仅一级菜单/App首页显示2秒、子页不重复；补充逐页点击退出及App请求打断半程/临界手势和控件拖动，禁止半程滞留、闪烁及旧触摸误确认 |
| 2026-11-07 | 用户补充§14收款Zcash：网络清单增至21，设备支持公开/隐私/旧隐私三种路径且默认公开；App仅两种，旧隐私使用独立参考及解码核对 |
| 2026-11-07 | 用户确认§8.9驻留凭证添加Toast及U2F区分；§14收款改纵向列表、同页地址二维码、五链路径弹层、选账户即返回及BTC Account新鲜地址索引，修正旧Title/EVM/独立QR/LTC/Kaspa规则 |
| 2026-11-07 | 用户确认 §18 Pro2 设备端通用设置：亮度下限 10%、震动范围、新版磁吸及设置保留；要求补回屏幕布局，动画章节纳入 Home Bar 2 秒隐藏与导航手势，动画关闭不禁用手势；同步完善 §17 震动关闭边界 |
| 2026-11-07 | 根据用户明确需求新增 §17 Pro2 设备端签名手势：三种模式、长按绿色边框与震动、未完成不确认、锁屏/重启保留及设备重置恢复默认；对应 OK-25300 |
| 2026-10-19 | §8 新增 8.8「NFC 认证规则」（OK-64379）：贴靠即响应不弹确认页、结果页 2 秒消失、手机选账户分支、锁定/关机/关闭开关/AirGap 禁用并终止等待中请求、NFC/USB/读卡会话互斥、读卡模式与卡模拟监听切换；8.1 标注为 USB 通道行为。用例 `Pro2-安全密钥/2026-10-15_Pro2-安全密钥-NFC安全密钥.md` |
| 2026-09-09 | 新增 §16「Pro2 Portfolio（资产组合）」规则：数据链路（服务端打包签名、硬件只展示）、图标回退（未内置代币首字母 / 未内置 EVM 网络通用 icon）、自动同步（仅所有网络、1s 防抖、60s 冷却后补传、亮屏未锁定、仅 USB 静默、蓝牙挂起待交互后补传）、固件侧自动锁定不受同步影响、手动同步（按钮入口 / 可见性 / 解锁唤起 / 无冷却无去重 / 单链排除零余额默认代币）。用例 `Pro2-Portfolio/2026-07-27_Pro2-Portfolio-功能测试.md` 同步改版 |
| 2026-07-31 | 新增 §1.5「未激活设备激活引导规则」：旧流程（Mini / Classic / Classic 1S / Touch / Pro 激活引导页 + 逐设备说明页）与 Pro2 新流程（「设置您的设备」三步时间线引导：完善基础设置 → 创建 PIN 码 → 设置钱包，设备端驱动步骤推进、按创建 / 导入入口区分文案）；原 QR 钱包限制顺延为 §1.6。配套需求文档 `Hardware-创建硬件钱包主流程.md` 与用例 `hardware/2026-07-31_Hardware-创建硬件钱包主流程.md` |
| 2026-07-30 | 设备管理 5.20.0 用例改版同步：§1.1 设备图片增至 7 款（新增 Pro2）；§2.1/§2.3 新增 Pro2 列与「Pro2 例外」（语言 / 亮度 / 振动反馈 App 直接修改、硬件显示「修改成功」页面，无硬件确认）；新增 §1.4 危险区域规则（清除设备数据 / 切换比特币专用固件，仅 Pro2 / Pro / 1S / Pure），原 QR 钱包限制顺延为 §1.5；§5.1 补 Forget Device UI 入口「设备连接 > 移除设备」；§6.1 Certifications 适用型号补 Pro2；§0.1 表头对齐 qa-rules §7.3 固定 4 列（场景列） |
| 2026-07-29 | §3.3 组数上限行修订（产品确认）：达上限提示按钮为设备差异——Pro2「管理 / 关闭」，1S / Pro「移除 / 关闭」；用例与需求文档同步 |
| 2026-07-29 | §3.3 补充设备差异（需求更新）：PIN 最长位数与组数上限明确 Pro / Pro2 与 1S 取值；新增「设备交互差异」行（Pro2 点击继续 / 关闭按钮 / 弹窗提示替代独立提示页）；删除流程补全二次确认页与成功提示页。需求文档新增 §2.8 设备差异对照表，用例同步 |
| 2026-07-29 | §3.3 主 PIN 前置校验修订（产品确认）：任何会话进入关联流程均需主 PIN 校验，删除「主 PIN 会话免输」描述；副标题规则明确为——Passphrase PIN 会话下需要主 PIN 的场景显示「标准钱包 PIN」，主 PIN 会话无副标题；用例与需求文档同步更新 |
| 2026-07-29 | 新增 §3.3「Attach to PIN（关联 PIN）」规则：主 PIN 前置校验（Passphrase PIN 会话需验主 PIN / 输错 5 次重置）、PIN 长度（6 ~ Pro 50 / Classic 9 位）、新增/更新/删除分流、组数上限（Pro 30 / 1S 3）、修改 PIN 覆盖与钱包身份、锁定规则（当前 PIN 操作锁定 / 非当前不锁定 / Passphrase PIN 会话关开关锁定）、安全验证页仅主 PIN、防时序侧信道。配套需求文档 `Hardware-Pro2关联PIN.md` 与用例 `Pro2-钱包/2026-07-29_Pro2-钱包-AttachToPIN.md` |
| 2026-07-27 | 产品三项确认：①Reset Find My 不解除 iCloud 绑定（§15.4）②开关默认关闭（§15.2/15.5，dev 代码默认值 true 与定义不符，疑似固件缺陷待报）③开启后 10 分钟未绑定开关自动关闭且无提示、已绑定不触发（§15.2 新增「未绑定自动关闭」规则，用例 §2 超时用例升 P1 并新增已绑定不超时 P2） |
| 2026-07-27 | 确认 Find My 开关**默认关闭**（一度按用户口述改为默认开启，复核设计稿后回改）；按「Disable Find My」设计稿补充：关机页 / 开机 Hello 页 `Apple Find My` 快捷入口（§15.1）、`Disable Find My` 快捷禁用与「Find My Disabled」提示页、低电量长期存放提示（§15.2、§15.6）；用例新增 §8 关机页快捷入口与禁用，原 §8~§10 顺延为 §9~§11 |
| 2026-07-27 | 新增「Pro2 Apple Find My」章节（§15）：双入口（桌面 Find My 图标 + Settings → Apple Find My）、开关默认开启 / 未配对时直接处于配对流程、未配对 / 已配对状态页文案、View Serial Number 5 分钟有效期、Reset Find My 二次确认与解绑成功提示、设备端 Reset 不解除 iCloud 绑定（排他保护）、播放声音为蜂鸣、配对模式 10 分钟超时、Nearby→Separated 约 15 分钟。配套日常回归用例：`Pro2-FindMy/2026-07-27_Pro2-FindMy-日常回归.md`。同日 review 修订：用例移除认证映射附录、预期结果按允许词表改写、前置条件压缩至 5 行；新增 §15.6 界面文案中英对照表，用例提示文案改用中文译文 |
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
