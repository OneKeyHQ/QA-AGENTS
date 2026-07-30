# Hardware - Pro2 关联 PIN（Attach to PIN）

> App 版本：
> 测试端：Pro2 设备端为主（部分参数含 Classic / 1S 差异，随注注明）
> 规则文档：`docs/qa/rules/hardware-rules.md` §3.3
> 测试用例：`docs/qa/testcases/cases/hardware/HW-Pro2/Pro2-钱包/2026-07-29_Pro2-钱包-AttachToPIN.md`

---

## 1. 需求背景

「关联 PIN」（Attach to PIN）允许用户将一段 Passphrase 绑定到一个独立的 Passphrase PIN（Extra PIN）。锁屏后用该 PIN 解锁即直接进入对应隐藏（密语）钱包，无需再输入 Passphrase。功能覆盖三条主流程：**关联（新增）/ 更新 / 删除**。

入口：Passphrase 开关开启后，「钱包 → Passphrase」页面显示「关联PIN」入口。

## 2. 功能规则

### 2.1 关联（新增）流程

| 环节 | 规则 |
|------|------|
| 入口提示 | 点击「关联PIN」弹出提示说明；确认后进入设置页面，点击「继续」进入主 PIN 校验 |
| 主 PIN 校验 | 任何会话（主 PIN / Passphrase PIN 解锁）进入设置流程均需通过主 PIN 校验。Passphrase PIN 会话下需要主 PIN 的场景均显示「标准钱包 PIN」副标题，主 PIN 会话无副标题。输错主 PIN 提示剩余错误次数，连续输错 5 次设备重置 |
| 设置 Passphrase PIN | 至少 6 位才可点击 ✅；最长 Pro / Pro2 50 位、Classic 1S 9 位 |
| 二次确认 | 两次输入不一致 → 提示不一致，「重试」返回设置页；一致且该 PIN 之前不存在 → 校验 PIN 是否已被使用，未被使用 → 显示「绑定」按钮 |
| 绑定确认 | 点击「绑定」进入勾选二次确认页；确认进入绑定流程（Pro2 点击「继续」，1S / Pro 滑动确认）；取消返回 Passphrase 页面（Pro2 点击右上角关闭按钮，1S / Pro 点击「取消」） |
| 输入 Passphrase | 不输入内容无法点击 ✅；最大 50 位字符；点击 ✅ 进入确认页 |
| 确认 Passphrase | 输入框回显上页输入内容；「编辑」返回上一页；「确认」后按设备分流：**Pro2** 弹窗提示保存 Passphrase（此时已绑定成功，无独立提示页面）→「我已了解」→ 绑定成功页；**1S / Pro** 独立提示页 →「我明白」→ loading → 绑定成功页。成功页提示 Passphrase 绑定至 PIN，「完成」返回 Passphrase 页面 |

### 2.2 更新 / 删除流程

- 进入设置流程输入**已存在**的 Passphrase PIN 并二次确认 → 校验结果为已被使用 → 显示「删除」与「更新」按钮
- 「更新」：后续流程与绑定一致（Passphrase 输入 → 确认 → 提示 → 成功页）
- 「删除」：显示删除二次确认页面 →「我明白了」→ 删除成功提示页面 →「完成」返回 Passphrase 页面；删除后该 Passphrase PIN 无法再解锁设备

### 2.3 绑定生效行为

- 锁屏后使用 Passphrase PIN 解锁成功，进入对应隐藏钱包
- 「我的地址」「连接二维码钱包」均**不需要**输入 Passphrase，直接显示隐藏钱包地址
- 核对助记词 / Lite / Keytag / 指纹 / 设置 Passphrase PIN 等安全验证页要求**标准钱包（主）PIN**，Passphrase PIN 无法通过

### 2.4 修改 PIN 码交互（与 Attach to PIN 联动）

- 修改为未被使用的新 PIN → 直接成功，旧 PIN 失效
- 修改为已被占用的 PIN（含主 PIN 与 Passphrase PIN 互改）→ 提示覆盖、可取消；确认覆盖后操作成功，被覆盖 PIN 的原绑定关系被当前钱包身份取代，钱包身份跟随发起修改的会话不变
- 主 PIN 修改为新值后，原主 PIN 值即释放，可再被 Passphrase PIN 使用

### 2.5 数量上限与移除

- 绑定组数上限：Pro / Pro2 30 组、1S 3 组
- 已达上限时输入已存在 Passphrase PIN → 正常进入更新 / 删除流程
- 已达上限时新增 → 提示达到上限，提供「移除」/「关闭」（Pro2 为「管理」/「关闭」）；点击后需输入正确的 Passphrase PIN（输入主 PIN 或错误 PIN 均提示 PIN 不正确）方可进入删除流程

### 2.6 锁定规则

| 操作会话 | 操作 | 设备是否锁定 |
|---------|------|------------|
| 主 PIN 解锁 | 删除 / 修改任意 Passphrase PIN | 不锁定 |
| Passphrase PIN 解锁 | 删除 / 修改**非当前** Passphrase PIN | 不锁定 |
| Passphrase PIN 解锁 | 删除 / 修改**当前** Passphrase PIN | 锁定 |
| Passphrase PIN 解锁 | 关闭 Passphrase 开关 | 锁定，且所有 Passphrase PIN 失效，仅主 PIN 可解锁 |

### 2.7 安全特性

- 设置 / 修改的 Passphrase PIN 与主 PIN 相同 → 提示 PIN 已被使用
- 满上限后锁定设备，使用主 PIN / 任意组 Passphrase PIN / 错误 PIN 解锁，解锁耗时无明显区别（防时序侧信道）

### 2.8 设备差异对照表（Classic 1S / Pro / Pro2）

| 差异项 | Classic 1S | Pro | Pro2 |
| --- | --- | --- | --- |
| Passphrase PIN 最长位数 | 9 位 | 50 位 | 50 位 |
| Passphrase PIN 组数上限 | 3 组 | 30 组 | 30 组 |
| 勾选二次确认页进入绑定 | 滑动确认 | 滑动确认 | 点击「继续」 |
| 勾选二次确认页取消 | 点击「取消」 | 点击「取消」 | 点击右上角关闭按钮 |
| 确认 Passphrase 后链路 | 独立提示页 →「我明白」→ loading → 成功页 | 同 1S | 无独立提示页：弹窗提示（已绑定成功）→「我已了解」→ 成功页 |
| 达上限提示按钮 | 「移除 / 关闭」 | 「移除 / 关闭」 | 「管理 / 关闭」 |
| 修改 PIN 后钱包身份核对 | 在 App 核对 | 设备「我的地址」核对 | 设备「我的地址」核对 |

## 3. 关联资源

- 规则文档：`docs/qa/rules/hardware-rules.md` §3（Passphrase）、§3.3（Attach to PIN）、§14.9（我的地址 Extra PIN 联动）
- Passphrase 开关用例：`docs/qa/testcases/cases/hardware/HW-Pro2/Pro2-钱包/2026-05-11_Pro2-钱包-Passphrase.md`

## 变更记录

| 日期 | 变更内容 |
|------|---------|
| 2026-07-29 | 产品确认：达上限提示按钮为设备差异——Pro2「管理 / 关闭」，1S / Pro「移除 / 关闭」（§2.5 / §2.8 同步） |
| 2026-07-29 | 需求补充：新增 §2.8 设备差异对照表（1S / Pro / Pro2）；绑定确认与确认 Passphrase 链路按设备分流（Pro2 点击继续 / 关闭按钮 / 弹窗提示替代独立提示页）；删除流程补全二次确认页与删除成功提示页 |
| 2026-07-29 | 产品确认：进入关联流程时任何会话均需主 PIN 校验（原「主 PIN 会话免验证」描述作废）；Passphrase PIN 会话下需要主 PIN 的场景显示「标准钱包 PIN」副标题，主 PIN 会话无副标题 |
| 2026-07-29 | 初始化文档：整理 Attach to PIN 关联 / 更新 / 删除三条主流程、修改 PIN 码覆盖矩阵、组数上限（Pro 30 / 1S 3）、锁定规则与防时序侧信道要求 |
