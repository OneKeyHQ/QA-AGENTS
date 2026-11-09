# Pro2 专项用例补齐

> 范围：2026-11-09 用户截图中实际可见的 37 个 Jira Test；均已读取原用例核实身份，完成本批 review；用户授权后已更新 36 项，通用设置核对 Jira 已有新版并合并回仓库，无需重复写入。

## 1. 维护原则与已确认口径

1. 新增 28 份专项，复用 9 份同主题文件。已有通用设置 OK-55000 复用原文件，回读时合并 Jira 已有的中部右滑与磁场位置示例；其余复用文件在原路径整理为四列、编号换行及中文可观察预期。
2. OK-55001 按 Pro2 编写；用户确认 review 后将 Jira 标题改为「Pro2 - 设置 - 睡眠/唤醒」。其他 Jira 标题不修改。
3. 用户确认导入断电以「钱包已就绪」为激活分界：该页出现前未激活，从该页起已激活。创建断电采用原用例相同分界。
4. 需求以用户及原 Test 为主，本轮未进行固件代码审计，不将实现差异直接当作正确预期。系统升级、断电、重置、交易与 PIN 错误均未实际执行。
5. 仅维护手动用例；复用共享通用规则，不推定第三方钱包或通道的额外支持。仅签名工具组验签，转账/Swap 组必须真实签名、广播并对账。

## 2. 仓库核对与本批对应关系

同主题以设备、入口和验证目的核对，不能只按文件名匹配。初始化通用主流程、既有通用专项、关联 PIN、收款及指纹等只作基础复用，不重复新建它们已覆盖的专项。

| Jira Test | 原 Jira 标题 | 仓库处理 | 源文件 | 条数 |
| --- | --- | --- | --- | --- |
| [OK-54248](https://onekeyhq.atlassian.net/browse/OK-54248) | Pro2 - 创建钱包回退测试 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-创建钱包回退测试.md](../testcases/cases/hardware/HW-Pro2/Pro2-初始化/2026-11-09_Pro2-创建钱包回退测试.md) | 4 |
| [OK-54249](https://onekeyhq.atlassian.net/browse/OK-54249) | Pro2 - 创建钱包主流程 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-创建钱包主流程.md](../testcases/cases/hardware/HW-Pro2/Pro2-初始化/2026-11-09_Pro2-创建钱包主流程.md) | 4 |
| [OK-54250](https://onekeyhq.atlassian.net/browse/OK-54250) | Pro2 - 导入钱包回退测试 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-导入钱包回退测试.md](../testcases/cases/hardware/HW-Pro2/Pro2-初始化/2026-11-09_Pro2-导入钱包回退测试.md) | 3 |
| [OK-54252](https://onekeyhq.atlassian.net/browse/OK-54252) | Pro2 - 导入钱包验证流程 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-导入钱包验证流程.md](../testcases/cases/hardware/HW-Pro2/Pro2-初始化/2026-11-09_Pro2-导入钱包验证流程.md) | 4 |
| [OK-54253](https://onekeyhq.atlassian.net/browse/OK-54253) | Pro2 - 导入钱包主流程 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-导入钱包主流程.md](../testcases/cases/hardware/HW-Pro2/Pro2-初始化/2026-11-09_Pro2-导入钱包主流程.md) | 2 |
| [OK-54254](https://onekeyhq.atlassian.net/browse/OK-54254) | Pro2 - 导入恢复钱包（Lite 卡） | 已有同主题：复用并规范化 | [2026-05-11_Pro2-SeedCard-恢复钱包.md](../testcases/cases/hardware/HW-Pro2/Pro2-SeedCard备份/2026-05-11_Pro2-SeedCard-恢复钱包.md) | 21 |
| [OK-54255](https://onekeyhq.atlassian.net/browse/OK-54255) | Pro2 - 导入过程中断/断电 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-导入过程中断断电.md](../testcases/cases/hardware/HW-Pro2/Pro2-初始化/2026-11-09_Pro2-导入过程中断断电.md) | 3 |
| [OK-54256](https://onekeyhq.atlassian.net/browse/OK-54256) | Pro2 - 创建过程中断/断电 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-创建过程中断断电.md](../testcases/cases/hardware/HW-Pro2/Pro2-初始化/2026-11-09_Pro2-创建过程中断断电.md) | 3 |
| [OK-54257](https://onekeyhq.atlassian.net/browse/OK-54257) | Pro2 - 修改PIN | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-修改PIN.md](../testcases/cases/hardware/HW-Pro2/Pro2-PIN/2026-11-09_Pro2-修改PIN.md) | 5 |
| [OK-54258](https://onekeyhq.atlassian.net/browse/OK-54258) | Pro2 - PIN错误次数测试 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-PIN错误次数测试.md](../testcases/cases/hardware/HW-Pro2/Pro2-PIN/2026-11-09_Pro2-PIN错误次数测试.md) | 5 |
| [OK-54259](https://onekeyhq.atlassian.net/browse/OK-54259) | Pro2 - PIN5次错误重置 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-PIN5次错误重置.md](../testcases/cases/hardware/HW-Pro2/Pro2-PIN/2026-11-09_Pro2-PIN5次错误重置.md) | 3 |
| [OK-27609](https://onekeyhq.atlassian.net/browse/OK-27609) | Pro2 - AirGap 多账户交叉交易 | 已有同主题：复用并规范化 | [2026-05-08_Pro2-AirGap-多账户交叉交易.md](../testcases/cases/hardware/HW-Pro2/Pro2-AirGap/2026-05-08_Pro2-AirGap-多账户交叉交易.md) | 17 |
| [OK-27199](https://onekeyhq.atlassian.net/browse/OK-27199) | Pro2 - AirGap 固件升级限制 | 已有同主题：复用并规范化 | [2026-05-08_Pro2-AirGap-固件升级限制.md](../testcases/cases/hardware/HW-Pro2/Pro2-AirGap/2026-05-08_Pro2-AirGap-固件升级限制.md) | 7 |
| [OK-27867](https://onekeyhq.atlassian.net/browse/OK-27867) | Pro2 - AirGap 签名拒绝中断 | 已有同主题：复用并规范化 | [2026-05-08_Pro2-AirGap-签名拒绝中断.md](../testcases/cases/hardware/HW-Pro2/Pro2-AirGap/2026-05-08_Pro2-AirGap-签名拒绝中断.md) | 4 |
| [OK-54289](https://onekeyhq.atlassian.net/browse/OK-54289) | Pro2 - AirGap 扫码异常 | 已有同主题：复用并规范化 | [2026-05-08_Pro2-AirGap-扫码异常与闪光灯.md](../testcases/cases/hardware/HW-Pro2/Pro2-AirGap/2026-05-08_Pro2-AirGap-扫码异常与闪光灯.md) | 11 |
| [OK-27330](https://onekeyhq.atlassian.net/browse/OK-27330) | Pro2 - AirGap 关闭时「连接 App 钱包」 | 已有同主题：复用并规范化 | [2026-05-08_Pro2-AirGap-AirGap关闭连接教程.md](../testcases/cases/hardware/HW-Pro2/Pro2-AirGap/2026-05-08_Pro2-AirGap-AirGap关闭连接教程.md) | 8 |
| [OK-54290](https://onekeyhq.atlassian.net/browse/OK-54290) | Pro2 - AirGap 开启时「连接 App 钱包」 | 已有同主题：复用并规范化 | [2026-05-08_Pro2-AirGap-AirGap开启连接禁用.md](../testcases/cases/hardware/HW-Pro2/Pro2-AirGap/2026-05-08_Pro2-AirGap-AirGap开启连接禁用.md) | 6 |
| [OK-54504](https://onekeyhq.atlassian.net/browse/OK-54504) | Pro2 - 钱包核对助记词 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-钱包核对助记词.md](../testcases/cases/hardware/HW-Pro2/Pro2-钱包/2026-11-09_Pro2-钱包核对助记词.md) | 3 |
| [OK-54500](https://onekeyhq.atlassian.net/browse/OK-54500) | Pro2 - Turbo 模式 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-Turbo模式.md](../testcases/cases/hardware/HW-Pro2/Pro2-钱包/2026-11-09_Pro2-Turbo模式.md) | 8 |
| [OK-54501](https://onekeyhq.atlassian.net/browse/OK-54501) | Pro2 - 钱包更换助记词 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-钱包更换助记词.md](../testcases/cases/hardware/HW-Pro2/Pro2-钱包/2026-11-09_Pro2-钱包更换助记词.md) | 2 |
| [OK-54502](https://onekeyhq.atlassian.net/browse/OK-54502) | Pro2 - 钱包 Passphrase | 已有同主题：复用并规范化 | [2026-05-11_Pro2-钱包-Passphrase.md](../testcases/cases/hardware/HW-Pro2/Pro2-钱包/2026-05-11_Pro2-钱包-Passphrase.md) | 13 |
| [OK-54503](https://onekeyhq.atlassian.net/browse/OK-54503) | Pro2 - 钱包重置 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-钱包重置.md](../testcases/cases/hardware/HW-Pro2/Pro2-钱包/2026-11-09_Pro2-钱包重置.md) | 3 |
| [OK-54833](https://onekeyhq.atlassian.net/browse/OK-54833) | Pro2 - slip39 创建新备份&自动化 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-SLIP39创建新备份.md](../testcases/cases/hardware/HW-Pro2/Pro2-SLIP39/2026-11-09_Pro2-SLIP39创建新备份.md) | 6 |
| [OK-54834](https://onekeyhq.atlassian.net/browse/OK-54834) | Pro2 - slip39 交互测试 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-SLIP39交互测试.md](../testcases/cases/hardware/HW-Pro2/Pro2-SLIP39/2026-11-09_Pro2-SLIP39交互测试.md) | 4 |
| [OK-54835](https://onekeyhq.atlassian.net/browse/OK-54835) | Pro2 - Slip39 核对助记词 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-SLIP39核对助记词.md](../testcases/cases/hardware/HW-Pro2/Pro2-SLIP39/2026-11-09_Pro2-SLIP39核对助记词.md) | 3 |
| [OK-55009](https://onekeyhq.atlassian.net/browse/OK-55009) | Pro2 -  web 固件升级 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-Web固件升级.md](../testcases/cases/hardware/HW-Pro2/Pro2-固件升级/2026-11-09_Pro2-Web固件升级.md) | 5 |
| [OK-55010](https://onekeyhq.atlassian.net/browse/OK-55010) | Pro2 - 移动端固件升级 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-移动端固件升级.md](../testcases/cases/hardware/HW-Pro2/Pro2-固件升级/2026-11-09_Pro2-移动端固件升级.md) | 7 |
| [OK-55011](https://onekeyhq.atlassian.net/browse/OK-55011) | Pro2 - Desktop/Ext 固件升级 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-Desktop-Extension固件升级.md](../testcases/cases/hardware/HW-Pro2/Pro2-固件升级/2026-11-09_Pro2-Desktop-Extension固件升级.md) | 6 |
| [OK-55005](https://onekeyhq.atlassian.net/browse/OK-55005) | Pro2 - 设置 - 安全 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-设置-安全.md](../testcases/cases/hardware/HW-Pro2/Pro2-设置/2026-11-09_Pro2-设置-安全.md) | 3 |
| [OK-55004](https://onekeyhq.atlassian.net/browse/OK-55004) | Pro2 - 键盘防误触 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-键盘防误触.md](../testcases/cases/hardware/HW-Pro2/Pro2-设置/2026-11-09_Pro2-键盘防误触.md) | 4 |
| [OK-55003](https://onekeyhq.atlassian.net/browse/OK-55003) | Pro2 - 主屏幕 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-主屏幕.md](../testcases/cases/hardware/HW-Pro2/Pro2-设置/2026-11-09_Pro2-主屏幕.md) | 3 |
| [OK-55002](https://onekeyhq.atlassian.net/browse/OK-55002) | Pro2 - 设置 - 锁定解锁 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-设置-锁定解锁.md](../testcases/cases/hardware/HW-Pro2/Pro2-设置/2026-11-09_Pro2-设置-锁定解锁.md) | 3 |
| [OK-55001](https://onekeyhq.atlassian.net/browse/OK-55001) | Pro - 设置 - 睡眠/唤醒 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-设置-睡眠唤醒.md](../testcases/cases/hardware/HW-Pro2/Pro2-设置/2026-11-09_Pro2-设置-睡眠唤醒.md) | 4 |
| [OK-55000](https://onekeyhq.atlassian.net/browse/OK-55000) | Pro2 - 设置 - 通用 | 已有同主题：合并 Jira 既有补充并核对（不重写 Jira） | [2026-11-07_Pro2-设置-通用.md](../testcases/cases/hardware/HW-Pro2/Pro2-设置/2026-11-07_Pro2-设置-通用.md) | 31 |
| [OK-54999](https://onekeyhq.atlassian.net/browse/OK-54999) | Pro2 - 设置 - 关机 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-设置-关机.md](../testcases/cases/hardware/HW-Pro2/Pro2-设置/2026-11-09_Pro2-设置-关机.md) | 4 |
| [OK-54997](https://onekeyhq.atlassian.net/browse/OK-54997) | Pro2 - 设备 - 关于设备 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-设备-关于设备.md](../testcases/cases/hardware/HW-Pro2/Pro2-设置/2026-11-09_Pro2-设备-关于设备.md) | 4 |
| [OK-54996](https://onekeyhq.atlassian.net/browse/OK-54996) | Pro2 - 设置 - 安全检查 | 新增专项（基础流程按已有规则复用） | [2026-11-09_Pro2-设置-安全检查.md](../testcases/cases/hardware/HW-Pro2/Pro2-设置/2026-11-09_Pro2-设置-安全检查.md) | 3 |

## 3. 复用边界与原文修正

1. OK-54254「Lite 卡」已由 SeedCard 恢复钱包覆盖，原文件复用；12/18/24 词与跨设备恢复按等价参数执行，不新增旧版重复稿。已知无法构造的 15/21 词卡不加回。卡片 PIN 最多 10 次，不能与设备主 PIN 最多 5 次混用。
2. OK-54257 只维护修改主 PIN；关联 PIN 的覆盖、组数、会话身份沿用已有 Attach to PIN 专项。OK-54258 维护未达上限的计数、复位与防误触；OK-54259 维护第 5 次错误触发清除及清除中断。
3. 安全设置只维护随机键盘、USB 锁及入口；指纹、安全密钥、安全检查分别复用独立 Test。锁定解锁用例侧重认证入口，时长配置复用 OK-55000；睡眠唤醒侧重熄屏、唤醒及临界重新计时。键盘防误触不重复双击唤醒与第 3 次错误 PIN 门槛。
4. 已有 AirGap 6 份文件直接复用；原 5 列表格合并场景字段为 4 列，保留交易/消息差异。标准/密语钱包是相同路径、不同种子下的地址，修正旧文档的“不同派生路径”表述。当前无 Bridge，不再要求安装它。
5. OK-54289 的本地 assets 图片原本不存在；改用明确的非 UR、合法但不支持的 UR 类型、签名地址与路径不匹配输入说明。原 Jira 附件 57543/57542/57551 留在远端，后续同步必须无损保留，不能用失效路径代替原图片。
6. OK-27867 的“二维码超时”原写 TBD 且允许两种相反页面结果；本轮不把它作为可执行验收行。不预设超时阈值，若后续定义再补；主动拒绝、拒绝重发及连续拒绝保留。
7. SLIP39 创建新备份沿用份额/阈值 1/1、2/2、3/2、8/3、16/16；8/3 必须至少 3 份，修正旧表“任意 2 份”的笔误。不把完整份额、助记词或私钥写入仓库；同步时原 Jira 专用测试向量附录须保留。
8. Web、移动、Desktop/Extension 升级按不同入口分别维护，公共验收一致：目标版本可读取、原钱包地址不变、中断可重新安装。AirGap/Boot 特殊限制复用已有专项；用户确认第三方 Trezor 升级提示只取消并回官方入口升级；内部异型号包独立验证拒绝，不混作同一个分支。
9. 通用设置使用已确认 10% 亮度下限、主菜单/设备 App 首页 Home Bar 显示 2 秒、子菜单不重复显示、关闭动画不禁用手势；不加入尚未提供的屏幕布局排序。

10. 本轮 review 恢复修改单词后的自动提交/立即验证，补齐键盘字母/数字/符号字符放大提示；AirGap 的断连提示与入口状态分别在 App/设备端核对。用户确认签名页没有 AirGap 设置入口，删除“签名确认页内开关 AirGap”不可执行步骤，保留空闲连接切换及请求拒绝用例。

## 4. 交付、同步与自动化影响

1. 每份 Test 对应一个 Markdown 源文件；聚合可复制版仅本地保存、不提交 Git 或 PR，按编号定位及独立复制，正文只含前置条件与用例内容，保留四列及真实单元格换行。
2. 共享映射新增 36 个已核实 Test 身份，均已写入后回读验证并记录同步时间与哈希。OK-55000 回读后核对既有新版，不无意义重写 Jira；仅按实核内容更新本地文件与验证记录。
3. 本批已按用户授权在 review 后同步；除 OK-55001 已获准的标题变更外，仅更新映射的 description。保留原附件、测试数据附录、执行记录、目录归属；本批不更新 Xray Steps。
4. 本轮未新增或修改 API/UI 自动化。对现有脚本检索相关编号、标题及源文件引用；没有需要随本批替换的直接断言。后续可基于确认后的手动用例生成硬件执行脚本，不能把文档条数算作自动化覆盖。

## 变更记录

- 2026-11-09：核对 37 个 Test，补齐 28 份专项、复用 9 份；review 修正后共 229 条。36 项已更新，通用设置合并 Jira 既有新版并核对；保留二维码原附件与两份原测试数据附录。
