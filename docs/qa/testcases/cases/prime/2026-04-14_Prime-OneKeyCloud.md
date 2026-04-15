# Prime - OneKey Cloud 测试用例

> 需求文档：`docs/qa/requirements/Prime-OneKeyCloud.md`  
> 规则文档：`docs/qa/rules/prime-rules.md` 第 `4.3` 节  
> 测试端：iOS / Android / Desktop / Extension / Web  
> 更新日期：2026-04-16

## 前置条件

1. 准备未创建 Keyless Wallet、已创建 Keyless Wallet、已开启同步三类测试账号或设备状态
2. 准备 A 端与 B 端两台可同时在线的测试设备
3. 已登录可访问 OneKey Cloud 的测试账号

---

## 1. 页面状态与入口迁移

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | 1. 当前设备不存在 Keyless Wallet<br>2. 用户未使用过 OneKeyID 同步<br>3. OneKey Cloud 同步关闭 | 1. 进入 OneKey Cloud 页面 | 1. 页面显示插图与说明文案<br>2. 页面仅显示启用 Keyless 同步入口（`Create and enable syncing` 按钮）<br>3. 页面不显示 OneKeyID 同步相关提示 |
| P1 | 1. 当前设备不存在 Keyless Wallet<br>2. 用户曾使用过 OneKeyID 同步 | 1. 进入 OneKey Cloud 页面 | 1. 页面显示切换为 Keyless 同步的提示<br>2. 页面引导用户从 OneKeyID 同步迁移到 Keyless 同步 |
| P1 | 1. 用户当前已启用 OneKeyID 同步（生效中） | 1. 进入 OneKey Cloud 页面 | 1. 已启用的 OneKeyID 同步功能不受影响<br>2. 同步入口与页面展示保持原状态 |
| ❗️❗️P0❗️❗️ | 1. 当前设备已存在 Keyless Wallet<br>2. OneKey Cloud 同步关闭 | 1. 进入 OneKey Cloud 页面 | 1. 页面显示 OneKey Cloud 开关<br>2. 开关状态为 OFF |
| ❗️❗️P0❗️❗️ | 1. 当前设备已开启 Keyless Sync | 1. 进入 OneKey Cloud 页面 | 1. 页面显示开关状态为 ON<br>2. 页面显示 Keyless Wallet 信息行<br>3. 页面显示 `Sync now` |

---

## 2. 自动开通与开关切换

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前设备不存在 Keyless Wallet<br>2. 从 OneKey Cloud 页面进入创建流程 | 1. 点击 `Create and enable syncing`<br>2. 完成 Keyless Wallet 创建 | 1. Keyless Wallet 创建完成后自动开启同步<br>2. 页面进入 `Keyless Sync 已开启` 状态 |
| P1 | 1. 当前设备不存在 Keyless Wallet<br>2. 从 Onboarding 创建 Keyless Wallet | 1. 完成 Keyless Wallet 创建<br>2. 返回 OneKey Cloud 页面 | 1. OneKey Cloud 同步状态已自动开启 |
| P1 | 1. 当前设备不存在 Keyless Wallet | 1. 进入 OneKey Cloud 页面<br>2. 点击 `Create and enable syncing`<br>3. 在创建流程中取消 | 1. 页面保持创建前状态<br>2. 同步状态不自动开启 |
| ❗️❗️P0❗️❗️ | 1. 当前设备已存在 Keyless Wallet<br>2. OneKey Cloud 同步关闭 | 1. 进入 OneKey Cloud 页面确认开关为 OFF<br>2. 打开同步开关<br>3. 关闭同步开关 | 1. 进入页面后开关状态为 OFF<br>2. 打开后页面进入 `Keyless Sync 已开启` 状态<br>3. 关闭后页面开关恢复为 OFF，显示同步关闭状态 |
| P1 | 1. 当前设备原为 `Keyless Sync 已开启` 状态<br>2. 用户已手动关闭 OneKey Cloud 同步 | 1. 退出 App<br>2. 重新进入 OneKey Cloud 页面 | 1. 页面开关仍为 OFF<br>2. 状态不自动恢复为 ON<br>3. 页面不显示 `Sync now` |

---

## 3. 同步操作、触发类型与策略

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前为 `Keyless Sync 已开启` 状态<br>2. 内存密码仍有效 | 1. 点击 `Sync now` | 1. 页面直接进入同步 loading<br>2. 同步完成后显示 toast |
| ❗️❗️P0❗️❗️ | 1. 当前为 `Keyless Sync 已开启` 状态<br>2. 内存密码已失效 | 1. 点击 `Sync now`<br>2. 完成密码验证 | 1. 页面先进入密码验证流程<br>2. 密码验证通过后进入同步 loading<br>3. 同步完成后显示 toast |
| P1 | 1. 当前为 `Keyless Sync 已开启` 状态<br>2. 内存密码已失效 | 1. 在本地修改某同步范围内字段（如 HD 账户名或自定义代币） | 1. 修改仍按即时同步规则立即上传云端<br>2. 其他在线端通过 WS 收到并应用最新修改<br>3. 内存密码失效不阻断修改即时同步（与「手动同步」需先验证密码区分） |
| ❗️❗️P0❗️❗️ | 1. A 端与 B 端均已开启 Keyless Sync<br>2. A 端在线，B 端在线 | 1. 在 A 端修改 HD / HW / QR / 隐藏钱包账户名 | 1. A 端将最新名称立即上传云端<br>2. B 端通过 WS 收到最新名称并更新展示<br>3. 旧名称进入名称历史 |
| P1 | 1. A 端与 B 端均已开启 Keyless Sync<br>2. A 端在线，B 端在线 | 1. 在 A 端新增或修改自定义代币、网络、RPC、浏览器书签、市场观察列表、地址簿<br>2. 在 A 端调整浏览器书签排序或切换自定义 RPC 开关 | 1. 每次修改后立即上传云端<br>2. B 端通过 WS 收到并应用最新修改 |
| P1 | 1. A 端与 B 端均已开启 Keyless Sync | 1. 在 A 端修改私钥账户、公钥账户或观察账户名称 | 1. 仅对应账户名称被同步到 B 端 |
| P1 | 1. 当前设备已开启 Keyless Sync | 1. 依次打开账户选择器、地址簿、管理 Token、网络选择器、浏览器首页、Market 首页 | 1. 对应入口按异步触发规则执行云端补拉<br>2. 补拉间隔为 5 分钟 |
| P1 | 1. 当前设备已开启 Keyless Sync | 1. 分别执行同步开关切换、断线重连、重新激活 Prime | 1. 每类操作都按立即触发规则发起同步 |
| P1 | 1. 当前设备已开启 Keyless Sync | 1. 进入 Auto Lock 设置页<br>2. 查看自动锁定选项 | 1. `4 小时` 与 `永不` 选项可见并可选择 |

---

## 4. 冲突与异常恢复

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. A 端已开启 Keyless Sync 并在线<br>2. B 端同步关闭或离线 | 1. 验证场景一：A 端先修改同一同步字段，B 端后修改；B 端恢复在线并开启同步<br>2. 验证场景二：B 端先修改同一同步字段，A 端后修改；B 端恢复在线并开启同步 | 1. 场景一最终以 B 端最后一次修改结果生效<br>2. 场景二最终以 A 端最后一次修改结果生效<br>3. 无论最后修改发生在在线端还是离线/关闭端，最终都按最后一次修改结果生效 |
| P1 | 1. 当前设备已开启 Keyless Sync | 1. 删除对应 Keyless Wallet<br>2. 再次进入 OneKey Cloud 页面 | 1. 页面进入 `Syncing Paused` 状态<br>2. 页面显示恢复按钮 |
| P1 | 1. 当前设备处于 `Syncing Paused` 状态 | 1. 点击 `Sync now` | 1. 页面显示错误 toast |
| P1 | 1. 当前设备处于 `Syncing Paused` 状态 | 1. 点击恢复按钮 | 1. 页面进入 Keyless Wallet 创建或恢复流程 |
| P1 | 1. 当前设备存在任一页面状态 | 1. 首次进入 OneKey Cloud 页面 | 1. 页面首屏直接显示目标状态<br>2. 页面不先显示错误状态再切换 |
