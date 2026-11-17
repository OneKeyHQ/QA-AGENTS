# 硬件通用专项用例补齐

> 依据：2026-11-09用户提供24个Jira Test截图及本轮只读取得的原用例；用户已授权本批再次review通过后同步对应Jira，并修改六个蓝牙/连接状态标题。

## 1. 已确认范围

1. 只有Mini不支持蓝牙；其他当前型号支持。蓝牙用例名称去掉设备型号，适配范围写入前置条件；设备支持蓝牙不代表支持所有第三方钱包、SLIP39或AirGap。
2. 用户确认：Pro2蓝牙不能中断未结束的USB请求；其他支持设备覆盖USB/蓝牙双向中断。
3. 用户确认：Pro需完成初始化后才能蓝牙配对；其他支持蓝牙的型号可在初始化完成前配对。配对完成不等于钱包初始化完成。
4. 继承原Jira的型号差异、工具分组与测试数据引用。发现旧文档矛盾优先采用本轮确认，不把已知异常表现直接写成修复后预期。
5. 助记词/份额只在受控TEST_ONLY测试环境使用，仓库不复制完整种子、份额、PIN或私钥。测试向量必须提供独立参考地址、公钥和路径；工具结果不能自我证明。
6. 仅维护手动用例；不执行设备重置、升级、交易或工具测试，不新增API/UI脚本。

## 2. 仓库核对与复用

本轮生成前检索全部手动用例、需求、规则及共享映射：24个目标没有同主题独立文件或既有映射。部分已有场景范围较窄，下表记录复用来源；本轮补专项差异，已有基础主流程不改写。

| Jira Test | 原标题 | 本地专项 | 既有相近覆盖 | 本地条数 |
| --- | --- | --- | --- | --- |
| OK-8355 | onekey+electrum | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-Electrum连接与多签.md` | 未检索到同主题用例 | 6 |
| OK-18199 | onekey+sparrow | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-Sparrow连接与Taproot地址.md` | 未检索到同主题用例 | 3 |
| OK-8265 | 小狐狸连接onekey使用 | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-MetaMask连接与交易.md` | 未检索到同主题用例 | 4 |
| OK-27684 | 新旧版本兼容测试 | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-新旧版本兼容测试.md` | `docs/qa/testcases/cases/hardware/2026-07-31_Hardware-创建硬件钱包主流程.md` | 4 |
| OK-19779 | 创建钱包时间对比 | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-创建钱包时间对比.md` | `docs/qa/testcases/cases/hardware/2026-07-31_Hardware-创建硬件钱包主流程.md` | 3 |
| OK-24442 | 硬件初始化流程-非断电中断测试 | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-初始化流程非断电中断.md` | `docs/qa/testcases/cases/hardware/2026-07-31_Hardware-创建硬件钱包主流程.md` | 5 |
| OK-24651 | 设备初始化阶段连接测试 | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-初始化阶段连接.md` | `docs/qa/testcases/cases/hardware/2026-07-31_Hardware-创建硬件钱包主流程.md` | 4 |
| OK-9513 | 中断-锁定中断/中断恢复 | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-锁定中断与恢复.md` | 未检索到同主题用例 | 3 |
| OK-24214 | 中断-本地事务被中断 | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-本地事务被外部请求打断.md` | `docs/qa/testcases/cases/hardware/HW-Pro2/Pro2-设置/2026-11-07_Pro2-设置-通用.md` | 4 |
| OK-24216 | 中断-蓝牙USB相互中断（mini不测） | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-蓝牙与USB交互中断.md` | 未检索到同主题用例 | 4 |
| OK-24607 | 自动化-bip39导入助记词数据测试 | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-BIP39导入助记词数据测试.md` | `docs/qa/testcases/cases/hardware/2026-07-31_Hardware-创建硬件钱包主流程.md` | 4 |
| OK-20152 | 地址二维码CHECK - 中文 | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-中文地址二维码核对.md` | `docs/qa/testcases/cases/hardware/HW-Pro2/Pro2-我的地址/2026-05-14_Pro2-我的地址-地址展示与派生路径.md` | 3 |
| OK-25676 | 自动化-Protobuf测试 | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-Protobuf接口回归.md` | 未检索到同主题用例 | 3 |
| OK-23918 | 自动化-切换语言地址测试 | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-切换语言地址一致性.md` | `docs/qa/testcases/cases/hardware/HW-Pro2/Pro2-我的地址/2026-05-14_Pro2-我的地址-地址展示与派生路径.md` | 3 |
| OK-26844 | 自动化-创建钱包助记词派生验证 | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-创建钱包助记词派生验证.md` | `docs/qa/testcases/cases/hardware/2026-07-31_Hardware-创建硬件钱包主流程.md` | 3 |
| OK-26845 | 自动化-盲签安全检查 | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-盲签安全检查.md` | 未检索到同主题用例 | 4 |
| OK-24756 | 自动化-passphrase session测试 | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-Passphrase会话切换.md` | `docs/qa/testcases/cases/hardware/HW-Pro2/Pro2-钱包/2026-05-11_Pro2-钱包-Passphrase.md` | 6 |
| OK-54830 | 自动化 - slip39 创建钱包主流程 | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-SLIP39创建钱包主流程.md` | 未检索到同主题用例 | 5 |
| OK-54832 | 自动化 - slip39 导入钱包主流程 | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-SLIP39导入钱包主流程.md` | 未检索到同主题用例 | 7 |
| OK-24610 | Touch/Classic连接蓝牙配对 - 设备未激活 | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-蓝牙配对-设备未激活.md` | `docs/qa/testcases/cases/hardware/2026-07-31_Hardware-创建硬件钱包主流程.md` | 4 |
| OK-24611 | Touch/Classic连接蓝牙配对 - 设备已激活 | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-蓝牙配对-设备已激活.md` | `docs/qa/testcases/cases/hardware/2026-07-31_Hardware-创建硬件钱包主流程.md` | 5 |
| OK-24612 | Touch/Classic连接蓝牙配对 - 异常配对 | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-蓝牙配对-异常配对.md` | 未检索到同主题用例 | 5 |
| OK-24614 | Touch/Classic连接蓝牙配对 - 性能测试 | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-蓝牙配对-性能测试.md` | 未检索到同主题用例 | 3 |
| OK-20154 | Classic/Touch/Pro设备状态检查 | `docs/qa/testcases/cases/hardware/HW-通用/2026-11-09_Hardware-设备连接状态检查.md` | `docs/qa/testcases/cases/hardware/HW-Pro2/Pro2-AirGap/2026-05-08_Pro2-AirGap-AirGap开启连接禁用.md`、`docs/qa/testcases/cases/hardware/2026-01-16_Hardware-设备管理5.20.0改版测试.md` | 6 |

## 3. 旧用例的维护边界

1. Electrum、Sparrow、MetaMask与OKX仅执行各自已验证兼容的设备；原Jira排除Pro2的第三方钱包范围不因蓝牙支持而自动扩展。
2. Pro/Pro2不输入蓝牙配对码；错误码测试仅用于需要配对码的旧型号。Boot不完成蓝牙配对，返回固件模式再验证。
3. 初始化教程中Pro/Touch需完成教程再添加钱包，旧型号与Pro2新引导分开核对；Neo未明确的旧教程页面不按其他型号强推。
4. 用户确认创建钱包耗时沿用旧Classic指标：原Classic 3.0.0上下文中，USB、蓝牙V4约12–17秒，V5约20秒。保留原版本分组和近似含义，不自行改为精确超时上限；其他型号仅记录耗时与失败次数，不套用Classic指标。蓝牙性能用例保留连续取消重配及双手机连接排他。
5. Protobuf保留固件normal/all范围，Boot全量不执行；首轮失败和复测分别记录，不把重复失败掩盖为通过。清除设备只使用专用设备并核对主PIN。
6. Passphrase session按工具预设取消子项及逐钱包独立地址核对，不将关联PIN组数或工具内部count解释为所有固件统一缓存上限。
7. SLIP39创建沿用Pro范围与单份20词、多份2/2、8/8、16/2；恢复保留原Jira全部五组。33词3份/阈值2以正文“任意2份恢复”为准，消除旧表“2-3”记法歧义。
8. 二维码及语言用例以网络、地址类型、路径、索引清单逐项核对；Pro2现有同页布局及AirGap细节使用已有专项，不重写现有业务规则。

## 4. 已确认的标题变更

| Jira Test | 目标标题 |
| --- | --- |
| OK-24216 | 中断 - 蓝牙与USB交互中断 |
| OK-24610 | 蓝牙配对 - 设备未激活 |
| OK-24611 | 蓝牙配对 - 设备已激活 |
| OK-24612 | 蓝牙配对 - 异常配对 |
| OK-24614 | 蓝牙配对 - 性能测试 |
| OK-20154 | 设备连接状态检查 |

## 5. 交付与同步

1. 每个目标对应一份四列Markdown；聚合可复制HTML仅本地保存、不提交Git或PR，按编号分成独立复制区，只复制前置条件及用例内容。
2. 用户已授权本批review通过后同步24个目标的description，并修改上表六个标题。每项写入并严格回读通过后才记录last_synced_at；未通过项保留待处理。
3. Jira原标题作为历史来源保留在本文件；仅上表六个目标修改标题。保留负责人、状态、标签、附件及其他字段；不修改Xray Steps或目录。
4. OK-54832原SLIP39测试数据表作为Jira专用参考附录保留，不复制种子或份额到仓库。用户确认现已不依赖Bridge，OK-25676不再保留旧安装包，移除安装与403版本排查前置；Electrum原录像附件继续保留。逐块核对管理正文与可复制版一致，并单独核对原数据/录像未丢失。

## 变更记录

- 2026-11-09：按截图核对24个硬件专项Test，补齐本地稿与可复制版，记录相近覆盖及用户确认的蓝牙/初始化差异，等待review后同步。

- 2026-11-09：用户确认创建钱包耗时沿用旧Classic的V4/V5指标，其他型号只记录；同步修改用例与可复制版，Jira仍待review。

- 2026-11-09：再次review补齐升级首次配对后的交易、Touch/Classic蓝牙打断不回首页及Classic三项TypedData排除，保留benchmark来源和Jira专用原始测试数据/图片；按用户授权review通过后同步。

- 2026-11-09：用户修正当前已无Bridge，删除安装及403版本排查前置，不再保留Protobuf旧安装包；Electrum原录像继续保留。

- 2026-11-09：本批24份101条通过再次review并完成Jira描述同步及六项标题修改；原SLIP39数据表与Electrum录像保留，旧Bridge安装包按用户决定不再保留；各目标已回读验证并记录同步哈希。
