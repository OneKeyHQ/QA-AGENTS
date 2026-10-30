# Hardware - 第三方硬件 - KeyStone 连接与设备交互

> 规则文档：`docs/qa/rules/hardware-third-party-rules.md` 第 4 节
> 测试端：Desktop、插件端、iOS、Android
> 需求文档：`docs/qa/requirements/Account-KeyStone连接与设备交互.md`
> 关联需求：`/Users/bixin/Downloads/SC/KeyStone接入.txt`

> 代码与需求一致性检查：`app-monorepo` `x` 分支提供 Desktop WebUSB、插件端 USB bridge，以及 iOS/Android QR-only connector；BTC、EVM、SOL、TRON 均存在 KeyStone 适配。以下场景按附件需求作为正式验收口径。

## 基本信息

| 项目 | 内容 |
|------|------|
| 模块 | HW & App |
| 测试主题 | KeyStone USB、二维码连接与账户交互 |
| 测试端 | Desktop、插件端、iOS、Android |
| 关联需求 | `docs/qa/requirements/Account-KeyStone连接与设备交互.md` |
| 关联规则 | `docs/qa/rules/hardware-third-party-rules.md` 第 4 节 |
| 创建日期 | 2026-10-30 |
| 更新日期 | 2026-10-30 |

---

## 前置条件

- 已安装 OneKey 6.7.0 Desktop、插件端、iOS 和 Android 待测包，测试账号具备新增 wallet/account 权限。
- 准备 1 台可通过 USB 连接的 KeyStone 设备，并准备可切换的 wallet A、wallet B。
- 准备支持 KeyStone QR 交互的移动端钱包应用、扫码权限和二维码展示/扫描环境；准备同一 wallet 的 USB 与二维码导出数据，以及与当前 wallet 不匹配的 wallet 数据。
- 准备 BTC 账户 0、BTC 账户 1、EVM、SOL、TRON 的账户创建环境；SOL/EVM 使用 Ledger Live 派生路径；准备二维码批量创建 20 个和 21 个地址的测试数据。

---

## 1. 连接方式与 wallet 复用

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|----------|----------|
| ❗️❗️P0❗️❗️ | Desktop / 插件端 KeyStone USB 连接 | 1. 在 Desktop 或插件端进入第三方硬件连接流程<br>2. 选择 KeyStone USB 入口<br>3. 选择已连接的 KeyStone 设备 | 1. 显示 KeyStone USB 设备<br>2. 进入 KeyStone wallet/account 创建流程<br>3. 连接状态显示为当前选中的 KeyStone |
| ❗️❗️P0❗️❗️ | 四端 KeyStone 二维码交互入口 | 1. 分别在 Desktop、插件端、iOS、Android 进入 KeyStone 连接或交互流程<br>2. 选择二维码交互<br>3. 展示或扫描二维码 | 1. 四端均显示二维码交互入口<br>2. 二维码展示或扫描页面可操作<br>3. 页面停留在 KeyStone 二维码交互流程 |
| P1 | 同一 wallet 切换 USB 与二维码 | 1. 使用 USB 为 wallet A 创建或打开 KeyStone wallet<br>2. 退出当前硬件交互<br>3. 使用二维码导出数据进入 wallet A 交互<br>4. 再次切回 USB 交互 | 1. USB 与二维码均定位到 wallet A<br>2. 钱包列表中仅保留一份对应 wallet 记录<br>3. 切换通道后已创建账户信息保持一致 |
| P1 | USB 设备未连接时进入交互 | 1. 在 Desktop 或插件端进入 KeyStone 账户交互<br>2. 断开 KeyStone USB 设备<br>3. 发起地址创建或签名 | 1. 显示二维码交互入口<br>2. 不显示 USB 已连接状态<br>3. 用户可进入二维码扫描或展示流程 |

## 2. 网络与批量创建边界

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|----------|----------|
| ❗️❗️P0❗️❗️ | KeyStone BTC 账户 0 | 1. 连接 KeyStone<br>2. 选择 BTC 网络<br>3. 创建账户 0 地址 | 1. 显示 BTC 账户 0 创建流程<br>2. 生成 BTC 账户 0 地址<br>3. 地址归属当前 KeyStone wallet |
| P1 | KeyStone BTC 账户 1 及以上 | 1. 连接 KeyStone<br>2. 选择 BTC 网络<br>3. 进入账户 1 或更高账户序号创建入口 | 1. 账户 1 及以上不出现在 KeyStone BTC 默认可用账户范围<br>2. 不生成超出账户 0 范围的 BTC 地址<br>3. 页面保留返回或切换网络入口 |
| P1 | EVM、SOL、TRON 账户交互 | 1. 分别选择 EVM、SOL、TRON<br>2. 连接 KeyStone USB 或进入二维码交互<br>3. 创建对应网络地址并发起一次签名 | 1. 三个网络均进入对应地址创建流程<br>2. 页面展示对应网络地址<br>3. 签名请求进入 KeyStone 交互流程 |
| ❗️❗️P0❗️❗️ | QR 模式批量创建 20 个 SOL/EVM Ledger Live 地址 | 1. 选择 SOL 或 EVM Ledger Live 派生路径<br>2. 切换到二维码交互<br>3. 设置批量创建数量为 20<br>4. 执行地址创建 | 1. 批量数量显示为 20<br>2. 二维码交互继续执行<br>3. 生成 20 个对应网络地址 |
| P1 | Desktop / 插件端 QR 模式批量创建 21 个地址 | 1. 在 Desktop 或插件端选择 SOL/EVM Ledger Live 派生路径<br>2. 切换到二维码交互<br>3. 设置批量创建数量为 21<br>4. 提交地址创建 | 1. 显示切换 USB 交互提示<br>2. 不进入超出 20 个的二维码创建流程<br>3. 页面提供返回或切换 USB 入口 |
| P1 | iOS / Android QR 模式批量创建 21 个地址 | 1. 在 iOS 或 Android 选择 SOL/EVM Ledger Live 派生路径<br>2. 设置批量创建数量为 21<br>3. 提交地址创建 | 1. 显示减少创建数量提示<br>2. 不进入超出 20 个的二维码创建流程<br>3. 页面保留修改批量数量入口 |

## 3. wallet 解锁与二维码匹配

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|----------|----------|
| P1 | 同设备切换不同 wallet 解锁 | 1. 连接 KeyStone 设备并选择 wallet A<br>2. 在设备端切换到 wallet B<br>3. 在 App 继续发起地址创建、核对地址或签名 | 1. 显示“解锁钱包错误”语义提示<br>2. 当前交互停止<br>3. 不生成地址、不产生签名结果 |
| P1 | 二维码使用不同物理设备但 wallet 信息匹配 | 1. 在设备 A 导出 wallet A 二维码数据<br>2. 使用设备 B 扫描或导入 wallet A 数据<br>3. 继续账户交互 | 1. 不校验设备唯一 ID<br>2. wallet 信息匹配后进入交互流程<br>3. 当前账户地址与 wallet A 匹配 |
| P1 | 二维码取消或数据无效 | 1. 进入 KeyStone 二维码扫描流程<br>2. 取消扫描，或导入无效二维码数据<br>3. 返回当前页面 | 1. 当前二维码交互停止<br>2. 显示取消或二维码数据无效提示<br>3. 不写入未完成的账户记录<br>4. 页面提供重新发起入口 |

## 4. 地址展示与核对

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|--------|------|----------|----------|
| P1 | KeyStone 核对地址 | 1. 进入 KeyStone 账户详情<br>2. 点击核对地址<br>3. 查看地址展示页 | 1. 展示待核对地址<br>2. 显示提示用户自行确认地址的文案<br>3. 页面不显示设备已核对或硬件确认完成状态 |
| P1 | 核对地址后继续交互 | 1. 在地址展示页确认地址内容<br>2. 返回账户详情<br>3. 发起一次签名 | 1. 地址展示页关闭<br>2. 账户详情显示当前地址<br>3. 签名流程继续进入 KeyStone 交互 |

---

## 5. 备注

- 本文档覆盖 KeyStone USB、二维码、网络范围、批量地址上限、wallet 解锁和地址核对需求。
- Ledger 桌面端蓝牙场景见 `2026-05-18_Hardware-第三方硬件-Ledger连接匹配与App安装.md` 第 1.9 节。
- 本轮仅生成手动测试用例与可复制版，不生成 UI 自动化脚本。
