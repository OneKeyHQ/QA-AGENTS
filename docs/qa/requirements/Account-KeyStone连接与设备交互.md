# Account - KeyStone 第三方硬件钱包接入与设备交互

> 模块：Account
> 来源：`/Users/bixin/Downloads/SC/KeyStone接入.txt` 与 `OneKeyHQ/app-monorepo` `x` 分支源码核对
> App 版本：6.7.0
> 日期：2026-10-30
> 测试端：Desktop、插件端、iOS、Android

---

## 1. 需求背景

本次接入为 OneKey 增加 KeyStone 第三方硬件钱包能力。KeyStone 同时支持 USB 和二维码两种交互，但两种方式的可用端不同；二维码模式还存在网络、批量创建数量和设备匹配边界。需求目标是明确连接入口、账户范围、二维码回退和地址核对口径，避免把 KeyStone 当作具备完整硬件地址核对能力的设备处理。

---

## 2. 功能范围

| 项目 | 说明 |
|------|------|
| USB 连接 | Desktop、插件端支持 USB 连接 |
| 二维码交互 | Desktop、插件端、iOS、Android 均支持二维码交互 |
| 支持网络 | BTC（仅账户 0）、EVM、SOL、TRON |
| 多通道 | 同一个 wallet 可以使用 USB，也可以使用二维码交互 |
| 地址核对 | KeyStone 不支持设备侧核对；App 仅展示地址并提示用户确认 |

源码参考：桌面端使用 KeyStone WebUSB connector，插件端使用 USB bridge；iOS/Android 的 KeyStone USB connector 明确不可用，使用 air-gapped QR flow。

---

## 3. 连接与交互需求

### 3.1 USB 连接

1. Desktop 和插件端提供 KeyStone USB 连接入口。
2. USB 连接成功后，可以继续执行 wallet/account 创建和支持网络的账户交互。
3. 同一个 wallet 不因先后使用 USB、二维码而重复创建；两种方式均应定位到同一 wallet 业务上下文。
4. USB 设备未连接或当前连接不可用时，Desktop/插件端交互流程提供二维码入口。

### 3.2 二维码交互

1. 所有支持端提供 KeyStone 二维码扫描/展示交互。
2. 二维码交互不限制必须使用原先的物理 KeyStone 设备；助记词或导出信息匹配时即可继续交互。
3. 二维码取消、扫码失败或数据无效时，当前交互结束并允许用户重新发起，不写入不完整账户。

### 3.3 同设备不同 wallet 解锁

同一台 KeyStone 设备切换到与当前 wallet 不一致的钱包时，App 必须提示“解锁钱包错误”语义并终止当前交互，不能继续创建地址、核对地址或签名。

---

## 4. 网络与批量创建规则

| 场景 | 需求 |
|------|------|
| BTC | 仅支持账户 0；账户 1 及以上不纳入 KeyStone 默认创建范围 |
| EVM / SOL / TRON | 支持 KeyStone wallet/account 创建及账户交互 |
| SOL / EVM Ledger Live 派生路径，二维码模式 | 批量创建地址最多 20 个 |
| Desktop / 插件端超过 20 个 | 提示用户切换 USB 交互，不继续执行超限二维码创建 |
| iOS / Android 超过 20 个 | 提示用户减少创建数量，不继续执行超限二维码创建 |

“20 个”是二维码模式下 SOL/EVM Ledger Live 批量创建地址的上限；单地址或非该派生路径的范围按对应网络现有能力执行。

---

## 5. 地址核对需求

1. KeyStone 设备不提供硬件侧地址核对能力。
2. App 执行“核对地址”时，仅展示待核对地址并提示用户自行确认。
3. 页面结果不得显示为“设备已核对”或其他硬件确认成功状态。

---

## 6. 验收标准（Definition of Done）

1. Desktop、插件端可以通过 USB 连接 KeyStone；四端均可进入二维码交互。
2. 同一个 wallet 可以在 USB 与二维码两种方式之间切换，不产生错误的重复 wallet。
3. BTC 仅允许账户 0；EVM、SOL、TRON 可完成 KeyStone 账户主流程。
4. SOL/EVM Ledger Live 路径二维码批量创建 20 个可执行，21 个按端提示切换 USB 或减少数量。
5. 同设备不同 wallet 解锁时显示解锁钱包错误并停止交互。
6. 二维码交互只按助记词/导出信息匹配，不绑定特定物理设备。
7. 核对地址只展示地址并提示用户确认，不声称完成硬件核对。

---

## 7. 关联资源

- 规则文档：`docs/qa/rules/hardware-third-party-rules.md` 第 4 节
- 关联需求：`docs/qa/requirements/Account-Ledger设备识别与匹配规则.md`、`docs/qa/requirements/Account-Trezor连接与设备交互.md`
- 建议用例目录：`docs/qa/testcases/cases/hardware/`
- 源码参考：`packages/shared/src/hardware/connector-loader/keystone.ts`、`keystone.native.ts`、`keystone.ext-bg-v3.ts`、`packages/kit-bg/src/services/ServiceHardware/adapters/KeystoneAdapter.ts`

---

## 8. 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-10-30 | v1.0 | 首次整理 KeyStone USB/二维码接入、四端能力、网络与批量地址上限、钱包解锁错误及地址核对规则；暂不生成测试用例 |
