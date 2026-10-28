# Perps 仓库与 Jira Test 映射核对（2026-10-28）

下文前半为首次只读核对快照；后续已按用户授权完成搜索及本批 6 个 Test 的同步，逐次结果见文末，当前状态以共享映射为准。

## 首次核对范围与结论（同步前快照）

- 仓库 Perps 目录共 19 份 Markdown，其中 18 份为当前用例，1 份条件单历史文档明确已被替代。
- 通过 `project = OK AND issuetype = Test` 加标题搜索 Perps / Hyperliquid / ApproveAgent / 合约 / 交易，共识别 20 份相关 Test，逐份读取描述。18 份可与当前源文件建立一对一关系；另外 2 份尚无完整对应的本地源文件。
- 搜索「交易」额外找到标题拼写为 **Preps - Native 交易** 的 OK-24222，与本地「Perps - 交易」58 条对应，避免只搜 Perps 造成遗漏；本次不修改其远端标题。
- 18 份已映射文件合计本地 **941 条**，Jira 描述中 **904 条**。其中 **13 份表格文字一致，5 份有文字或条数差异**。全部 18 份表格单元格并非逐字格式一致，Jira 多处缺步骤编号和单元格换行。
- “文字一致”比较逐行四列，忽略 Markdown 强调 / 行内代码 / 链接格式、空白，以及源文件步骤编号和换行；这不表示前置条件、章节说明或富文本排版已完全一致，不表示曾完成同步。
- 用户指定的 [Xray 目录](https://onekeyhq.atlassian.net/projects/OK?selectedItem=com.atlassian.plugins.atlassian-connect-plugin:com.xpandit.plugins.xray__testing-board#!page=test-repository&selectedFolder=68a5626fbbafc9ad39593038) 跳转至 Atlassian 登录页，现有连接器无法读取 Xray 目录成员。**本报告不是该目录的完整成员审计**，目录中是否另有非上述标题的 Test、上述 Test 是否全在该目录，待登录后补核。映射将 `membership_verified` 保持为 false。

## 一对一映射

下表为同步前数量，均为 description 中的四列用例行，不代表 Xray 结构化 Manual Steps 数量。

| Jira Test | 仓库源文件 | Jira / 本地条数 | 核对结果 |
| --- | --- | --- | --- |
| [Perps - K 线布局设置](https://onekeyhq.atlassian.net/browse/OK-24511)（OK-24511） | [2026-08-28_Perps-K线布局设置.md](../../docs/qa/testcases/cases/perps/2026-08-28_Perps-K线布局设置.md) | 59 / 59 | 表格文字一致，复制格式有差异 |
| [Perps - TradingView 图表与设置](https://onekeyhq.atlassian.net/browse/OK-42127)（OK-42127） | [2026-01-21_Perps-TV图表功能与设置.md](../../docs/qa/testcases/cases/perps/2026-01-21_Perps-TV图表功能与设置.md) | 61 / 61 | 表格文字一致，复制格式有差异 |
| [Perps - Unifold 充值](https://onekeyhq.atlassian.net/browse/OK-48434)（OK-48434） | [2026-08-03_Perps-Unifold充值.md](../../docs/qa/testcases/cases/perps/2026-08-03_Perps-Unifold充值.md) | 34 / 37 | 表格文字 / 条数有差异 |
| [Perps - 分时/分段委托下单](https://onekeyhq.atlassian.net/browse/OK-55703)（OK-55703） | [2026-06-03_Perps-分时分段委托下单.md](../../docs/qa/testcases/cases/perps/2026-06-03_Perps-分时分段委托下单.md) | 134 / 134 | 表格文字一致，复制格式有差异 |
| [Perps - 加仓与追单](https://onekeyhq.atlassian.net/browse/OK-23819)（OK-23819） | [2026-07-27_Perps-加仓与追单.md](../../docs/qa/testcases/cases/perps/2026-07-27_Perps-加仓与追单.md) | 32 / 32 | 表格文字一致，复制格式有差异 |
| [Perps - 历史成交筛选、详情与分享](https://onekeyhq.atlassian.net/browse/OK-24059)（OK-24059） | [2026-10-27_Perps-历史成交筛选详情与分享.md](../../docs/qa/testcases/cases/perps/2026-10-27_Perps-历史成交筛选详情与分享.md) | 14 / 14 | 表格文字一致，复制格式有差异 |
| [Perps - 反手与持仓按钮设置](https://onekeyhq.atlassian.net/browse/OK-48432)（OK-48432） | [2026-10-27_Perps-反手与持仓按钮设置.md](../../docs/qa/testcases/cases/perps/2026-10-27_Perps-反手与持仓按钮设置.md) | 31 / 31 | 表格文字一致，复制格式有差异 |
| [Perps - 投资组合 & 盈亏 & 资金费](https://onekeyhq.atlassian.net/browse/OK-27264)（OK-27264） | [2026-03-26_Perps-投资组合&盈亏.md](../../docs/qa/testcases/cases/perps/2026-03-26_Perps-投资组合&盈亏.md) | 145 / 146 | 表格文字 / 条数有差异 |
| [Perps - 搜索](https://onekeyhq.atlassian.net/browse/OK-26036)（OK-26036） | [2026-02-03_Perps-搜索功能.md](../../docs/qa/testcases/cases/perps/2026-02-03_Perps-搜索功能.md) | 38 / 73 | 表格文字 / 条数有差异 |
| [Perps - 收藏](https://onekeyhq.atlassian.net/browse/OK-23956)（OK-23956） | [2026-01-20_Perps-收藏功能测试.md](../../docs/qa/testcases/cases/perps/2026-01-20_Perps-收藏功能测试.md) | 48 / 48 | 表格文字一致，复制格式有差异 |
| [Perps - 条件单](https://onekeyhq.atlassian.net/browse/OK-12145)（OK-12145） | [2026-03-20_Perps-条件单模式合并测试.md](../../docs/qa/testcases/cases/perps/2026-03-20_Perps-条件单模式合并测试.md) | 29 / 29 | 表格文字一致，复制格式有差异 |
| [Perps - 现货交易](https://onekeyhq.atlassian.net/browse/OK-24921)（OK-24921） | [2026-04-21_Perps-现货交易.md](../../docs/qa/testcases/cases/perps/2026-04-21_Perps-现货交易.md) | 98 / 98 | 表格文字一致，复制格式有差异 |
| [Perps - 现货碎币自动兑换设置](https://onekeyhq.atlassian.net/browse/OK-24039)（OK-24039） | [2026-10-27_Perps-现货碎币自动兑换.md](../../docs/qa/testcases/cases/perps/2026-10-27_Perps-现货碎币自动兑换.md) | 8 / 8 | 表格文字一致，复制格式有差异 |
| [Perps - 画线下单](https://onekeyhq.atlassian.net/browse/OK-54794)（OK-54794） | [2026-07-01_Perps-画线下单.md](../../docs/qa/testcases/cases/perps/2026-07-01_Perps-画线下单.md) | 38 / 38 | 表格文字一致，复制格式有差异 |
| [Perps - 限价单最优价格](https://onekeyhq.atlassian.net/browse/OK-23787)（OK-23787） | [2026-01-03_Perps-限价单最优价格BBO.md](../../docs/qa/testcases/cases/perps/2026-01-03_Perps-限价单最优价格BBO.md) | 32 / 26 | 表格文字 / 条数有差异 |
| [Perps - 首页底部状态](https://onekeyhq.atlassian.net/browse/OK-23881)（OK-23881） | [2026-03-05_Perps-首页底部状态.md](../../docs/qa/testcases/cases/perps/2026-03-05_Perps-首页底部状态.md) | 27 / 27 | 表格文字一致，复制格式有差异 |
| [Hyperliquid - ApproveAgent 推荐绑定 Checkbox](https://onekeyhq.atlassian.net/browse/OK-24550)（OK-24550） | [2026-01-04_Hyperliquid-ApproveAgent推荐绑定Checkbox.md](../../docs/qa/testcases/cases/perps/2026-01-04_Hyperliquid-ApproveAgent推荐绑定Checkbox.md) | 18 / 22 | 表格文字 / 条数有差异 |
| [Preps - Native 交易](https://onekeyhq.atlassian.net/browse/OK-24222)（OK-24222） | [2026-08-03_Perps-交易.md](../../docs/qa/testcases/cases/perps/2026-08-03_Perps-交易.md) | 58 / 58 | 表格文字一致，复制格式有差异 |

## 需先预览差异的 5 份

| Jira Test | Jira → 本地条数 | 已识别差异 |
| --- | --- | --- |
| [OK-26036 搜索](https://onekeyhq.atlassian.net/browse/OK-26036) | 38 → 73 | 本地已补桌面快捷键、已知缺陷修复预期、非空输入切主 Tab、分类搜索范围、主 Tab 高度等；远端仍为旧版。 |
| [OK-48434 Unifold 充值](https://onekeyhq.atlassian.net/browse/OK-48434) | 34 → 37 | 多行操作 / 预期已调整，存在新增与改写，不能仅追加 3 行。 |
| [OK-27264 投资组合](https://onekeyhq.atlassian.net/browse/OK-27264) | 145 → 146 | 本地新增「钱包首页，合约功能配置已开启，当前 EVM 主网账户可用」入口场景；原有 145 行表格文字可对应。 |
| [OK-23787 限价单最优价格](https://onekeyhq.atlassian.net/browse/OK-23787) | 32 → 26 | 本地场景、步骤和预期已重整精简，应按当前全文替换受管理正文，不能按数量直接删末尾 6 行。 |
| [OK-24550 ApproveAgent 推荐绑定](https://onekeyhq.atlassian.net/browse/OK-24550) | 18 → 22 | 本地条件组合、步骤和预期已有改写与补充；已核实为同一推荐绑定 Checkbox 主题。 |

TWAP（OK-55703，134 条）与反手（OK-48432，31 条）当前表格文字可对应；仍需修复远端编号和换行，且正式同步前重新核对前置条件、章节说明及最新远端内容。不能因本次文字比对通过就声称完全一致。

## 未建立覆盖关系的内容

- [OK-11789 Perps - Native 存取款](https://onekeyhq.atlassian.net/browse/OK-11789)：远端为存款 / 提现 / 账户历史的旧版非四列文档，未找到完整对应的独立源文件。不能用 Unifold 或交易文档直接覆盖。
- [OK-24305 Perps - 分享](https://onekeyhq.atlassian.net/browse/OK-24305)：包含持仓分享、X、保存图片、邀请码与二维码；本地「历史成交筛选详情与分享」只覆盖部分相关能力，已单独对应 OK-24059，不能复用去覆盖这份。
- 本地 `2026-03-12_Perps-条件单.md` 是历史文档；OK-12145 只对应现行 `2026-03-20_Perps-条件单模式合并测试.md`，避免重复更新。

## 已固化的交付流程

1. 按 `docs/qa/qa-rules.md` §7.3 生成 / 更新源文件和可复制 HTML，检查真实复制结果。复制区域只保留前置条件与内容，不带生成时间、文档路径、来源、测试端或变更说明。
2. 按 [共享映射](../../docs/qa/jira-test-mapping.json) 展示本次目标及差异，询问是否更新 Jira。
3. 用户同意本批同步后，直接更新已映射 Test；无映射时询问提供已有编号或确认创建。用户说不用，本批不写 Jira。
4. 写入后回读验证，再记录同步时间；未写、失败或只核对身份时同步时间保留 null。

完整规则见 [Jira 同步规范](../../docs/qa/rules/jira-test-sync-rules.md)。已接入全局 `.claude/CLAUDE.md`（根目录 AGENTS / Cursor 软链）及 Codex、Claude、Cursor 的 Test Designer 入口。核对时仅在本地工作区；本报告与流程规范现一并纳入团队共享 PR。

## 跨线路影响

本次只新增流程、身份映射和核对报告，不修改产品预期、API 用例或 UI 自动化断言；后续同步 Jira 描述不自动改变执行脚本。映射不增加手动用例 ID 列，也不创建每行一个 Test。

## 验证记录

- 已校验 18 个映射的文件存在、issue key / id 唯一、远端类型为 Test、标题一致、源文件与远端读取正文的 SHA-256；18 份现行文件及 1 份历史文件均有归属。
- Codex / Claude / Cursor 新增的手动交付分支逐字一致；根目录 AGENTS.md 与 .cursorrules 仍为指向 .claude/CLAUDE.md 的软链；本报告所有本地链接存在。
- 通用 skill-creator 校验器不支持仓库原有的 `user-invocable` frontmatter 字段；已对照 HEAD 确认该字段不是本次引入，保留原配置。仅在临时校验副本移除此字段后，其余校验通过；不将原文件的通用校验报告为完全通过。
- 本次为规范与映射改动，未运行产品 UI / API 测试，未尝试 Jira 写入。验证详情见 [映射校验结果](jira-perps-mapping-validation-2026-10-28.json)。

## 后续同步：OK-26036 搜索

2026-10-28 用户明确授权同步搜索用例。已仅更新 OK-26036 的 description：38 → 73 条，11 张四列表格。回读 Jira renderedFields.description 后逐格核对 292 个用例单元格、12 个标题、9 段前置条件 / 说明，以及 47 处单元格真实换行，均与源文件和可复制版一致，步骤编号保留，无可见换行标签。标题仍为「Perps - 搜索」。

搜索映射的同步时间和源文件 / 远端正文哈希已更新，其余 17 个映射未写入。当前已映射远端用例行合计 939 条，本地 941 条；表格文字可对应 14 份，另 4 份内容差异仍待处理。完整记录见 [搜索同步验证](jira-search-sync-2026-10-28/verification.json)。Xray 目录成员仍未验证，结构化 Manual Steps 未修改。

## 后续同步：补齐 Native 存取款、分享及四份预览差异

2026-10-28 用户授权补齐两份无独立本地记录的用例并更新 Jira，同时同步先前「需先预览差异」清单中除已完成搜索以外的四份。已按最新 x@a3c2d6f4e8276733a278289de2c122ffb170fe64 核对存取款与分享源代码，并交付独立需求、模块规则、四列手动用例及同内容可复制 HTML。未创建新 Jira issue；只修改以下现有 Test 的 description。

| Jira Test | 本次结果 | 用例行数 |
| --- | --- | --- |
| [OK-11789 Native 存取款](https://onekeyhq.atlassian.net/browse/OK-11789) | 新增本地独立文档，旧列表改为四列，覆盖当前费用、路由、默认选币及签名逻辑 | 40 |
| [OK-24305 分享](https://onekeyhq.atlassian.net/browse/OK-24305) | 新增本地独立文档，覆盖卡片、导出、权限、X 草稿、邀请链接与二维码 | 27 |
| [OK-48434 Unifold 充值](https://onekeyhq.atlassian.net/browse/OK-48434) | 同步本地全文，34 → 37；占位描述改为「所选代币」，避免 Jira 宏解析换行 | 37 |
| [OK-27264 投资组合](https://onekeyhq.atlassian.net/browse/OK-27264) | 同步本地全文，145 → 146；「全部」链接文字与占位符显示分开，保留双连字符空值符号 | 146 |
| [OK-23787 限价单最优价格](https://onekeyhq.atlassian.net/browse/OK-23787) | 按本地重整后的全文同步，32 → 26，不按数量直接截断末尾行 | 26 |
| [OK-24550 推荐绑定 Checkbox](https://onekeyhq.atlassian.net/browse/OK-24550) | 同步本地条件组合及异常补测，18 → 22 | 22 |

- 本批实际回读 298 条、46 张四列表格、1192 个用例单元格和 571 处单元格换行；标题、表头、前置条件及业务说明也逐项相等。更新前核对 issue id / 项目 / Test 类型 / 标题 / 远端更新时间，更新后标题保持不变。
- 修复了真实渲染发现的三种排版问题：去除连接器不接受的网页展示 class；自然语言替换无须作为字面值展示的花括号占位符；用受支持的行内 code 保留可能被 wiki 转为短破折号的 `--`。未放宽校验以掩盖差异。
- 可复制 HTML 的 6 个正文区域与最终写入片段逐字一致；离线执行复制文本序列化并按 TSV 回读，四列、编号及真实单元格换行保持一致。IAB 安全策略拒绝 file: URL，因此本批未实测浏览器复制按钮，也未改用其他路径绕过；此限制不影响 Jira 实际渲染回读。
- 共享映射新增两项，移除对应未映射记录。当前为 20 个活动源文件一对一映射 20 个 Test，合计 1008 条，已发现的未映射 Test 为 0。搜索加本批共 7 个 Test 完成富文本同步；其余 13 个只有表格文字核对通过，远端格式未在本批修改，不能声称全部排版已统一。
- Xray 目录成员仍未验证，结构化 Manual Steps 未修改；本批未执行产品 UI / API 或真实资金交易。新增 Native / 分享需求已写明对后续自动化断言的影响，原历史成交分享与 Unifold 资产收款覆盖分别保留。

交付：[本批可复制版](Perps-Jira同步用例-可复制版-2026-10-28.html)、[逐项同步验证](jira-perps-batch-sync-2026-10-28/verification.json)、[共享映射](../../docs/qa/jira-test-mapping.json)。本地文档、规范及映射一并纳入团队共享 PR；这些同步记录不表示其余 13 份 Test 已重新写入。
