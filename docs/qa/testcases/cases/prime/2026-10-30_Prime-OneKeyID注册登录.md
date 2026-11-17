# Prime - OneKey ID 注册登录测试用例

> 需求文档：`docs/qa/requirements/Prime-OneKeyID注册登录.md`
> 规则文档：`docs/qa/rules/prime-rules.md` §4.6
> 测试端：iOS / Android / Desktop / Extension / Web
> 更新日期：2026-10-30

## 前置条件

1. 准备未注册邮箱、已注册邮箱、已绑定 Google / Apple 邮箱和未绑定邮箱。
2. 准备可完成 CAPTCHA、CAPTCHA 加载失败和超时的网络环境。
3. 准备已关联 OneKey ID 的 Keyless Wallet，以及可执行主动/被动退出的环境。

## 1. 登录与注册方式

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 未注册邮箱<br>2. Google 或 Apple 账号可用 | 1. 选择 Google / Apple 登录<br>2. 使用未注册邮箱完成认证 | 1. 创建 OneKey ID<br>2. 进入 OneKey ID 体系 |
| ❗️❗️P0❗️❗️ | 1. 已注册 OneKey ID 邮箱<br>2. Google / Apple 使用相同邮箱 | 1. 选择对应 Google / Apple 登录 | 自动绑定已有 OneKey ID，不创建重复账号 |
| ❗️❗️P0❗️❗️ | 1. 已注册 OneKey ID 邮箱 | 1. 打开邮箱 OTP 入口<br>2. 完成 CAPTCHA<br>3. 输入正确 OTP | 登录已有 OneKey ID |
| P1 | 1. 未注册邮箱 | 1. 打开邮箱 OTP 登录入口<br>2. 完成 CAPTCHA 并输入 OTP | 不通过邮箱 OTP 创建新账号；引导使用 Google / Apple 注册 |
| P1 | 已进入登录页 | 1. 观察默认页面 | 邮箱 OTP 入口默认折叠，不直接展示 |

## 2. CAPTCHA 与 OTP 异常

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 已注册邮箱，邮箱格式有效 | 1. 展开邮箱 OTP 登录<br>2. 未完成 CAPTCHA 时点击发送 OTP | 不发送 OTP，继续要求完成 CAPTCHA |
| P1 | CAPTCHA 加载失败 | 1. 展开邮箱 OTP 登录<br>2. 等待 CAPTCHA 返回失败 | 显示错误提示；移动端显示网络诊断入口 |
| P1 | CAPTCHA 长时间未完成 | 1. 保持页面不操作至超时 | 显示超时错误，不发送 OTP |
| P1 | OTP 已发送 | 1. 等待 60 秒<br>2. 点击重发 | 60 秒后允许重新发送 OTP |
| P1 | OTP 错误/过期 | 1. 输入错误或过期 OTP | 显示验证码错误提示，不完成登录 |

## 3. Keyless Wallet 关联

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | Keyless Wallet 已关联 OneKey ID | 1. 先登录 Keyless Wallet | 自动登录关联 OneKey ID |
| P1 | 先登录 OneKey ID | 1. 登录 OneKey ID<br>2. 查看 Keyless Wallet | 不自动创建对应 Keyless Wallet，不能登录其他 Keyless Wallet |
| P1 | 主动退出/删除关联关系 | 1. 删除 Keyless Wallet 或主动退出 OneKey ID | 关联另一方同步退出或删除 |
| P1 | 被其他设备移除 OneKey ID | 1. 在另一设备移除 OneKey ID<br>2. 查看本地 Keyless Wallet | OneKey ID 被动退出时不删除本地 Keyless Wallet |

## 4. 多端与重复登录

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | 同一邮箱多端登录 | 1. 在 iOS / Android / Desktop / Extension / Web 分别登录 | 各端允许同时登录，Prime 状态按同一 OneKey ID 同步 |
| P1 | 已退出账号 | 1. 退出 OneKey ID<br>2. 再次进入登录流程 | 可重新接收 OTP 并完成登录 |
