# QA Review — DeFi Morpho（Steakhouse + Gauntlet）第二轮

> 审查对象：`cases/defi/2026-08-27_DeFi-Morpho-Steakhouse-stake.md`（回填后）、`cases/defi/2026-08-28_DeFi-Morpho-Gauntlet-stake.md`（新增）、`rules/defi-rules.md` 第 7 章、`requirements/DeFi-Morpho协议.md`
> 审查日期：2026-08-28

## 范围摘要
- 变更文件：4 个（rules 1 / requirements 1 / testcases 2）+ 上一轮审查报告
- 涉及模块：defi

## Phase 2 安全审查：通过 ✓
无私钥 / 助记词 / API key / JWT；地址均为用户提供的测试数据或源码内置合约地址。

## Phase 3 规则文档：通过 ✓
- 一级标题唯一、有变更记录、第 7 章无模糊词
- 规则变更有对应用例变更（3.4）✓；需求文档存在（3.5）✓；`qa-rules.md` 引用 defi-rules ✓

## Phase 4 用例文档（两份）：block 0，warn 5

自动扫描全部通过：文件名/首行标题/4 列表头（各 9 张表列数无异常）/P0 标记/多行编号/预期结果禁用词 0/P0 排序 0/无备注章节/无观察账户描述/前置条件 3 行/规则与需求引用路径有效/跨文件地址一致（vbUSDC、USDC、gtokenusdc、两个 spender、观察地址各处一致）。

| # | 级别 | 文件:位置 | 问题 | 建议 |
|---|---|---|---|---|
| W1 | warn | Gauntlet §6 L113 | 跨渠道分组用例需要同一账户另有 Steakhouse（Katana）持仓，前置条件未列 | 前置条件加一行（3 → 4 行，仍 ≤ 5） |
| W2 | warn | Gauntlet §2 L58 | 「赚币列表 USDC 卡片显示网络与渠道数」——多网络同名代币卡片的展示字段未在源码核实 | 弱化为「显示 APY」，网络标识断言保留在渠道列表行 |
| W3 | warn | 两份 §5 / §7 / §8 | 「签名请求弹窗」（Permit 消息签名）与「签名弹窗」（交易签名）是有意区分，但未说明，执行者可能当作同一弹窗 | §5 章头注释一句：Permit 为消息签名弹窗，认购/赎回/领取为交易签名弹窗 |
| W4 | warn | `defi-rules.md` L1041 | 章节标题「7. Morpho Steakhouse（Katana / vbUSDC）」已含 7.7 Gauntlet，标题范围偏窄 | 改为「7. Morpho（Steakhouse / Gauntlet）」，两份用例头部引用同步 |
| W5 | warn | `DeFi-Morpho协议.md` L1 | 标题「Morpho Steakhouse 协议（Katana / vbUSDC）」已含第 7 节 Gauntlet | 改为「Morpho 协议（Steakhouse / Gauntlet）」 |

## 内容核对（人工）
- Gauntlet 用例与规则 7.7 差异表逐项一致：Base / USDC / spender 0xb98c…746a / 无奖励 / 凭证代币 gtokenusdc 0xefa4…b6ef / USDC 0x8335…2913 ✓
- Steakhouse 用例与产品确认 7 项逐项一致（APY 扣业绩费、1 小时刷新、收益代币分列、预估年收益三行、创建地址引导、按钮文案、奖励停发不显示）✓
- 两份用例结构对齐（9 章同序），差异仅在 §3 APY 组成 / §7 奖励 / §6 跨渠道分组 ✓
- 优先级分布：Steakhouse P0 25 / P1 23 / P2 3；Gauntlet P0 23 / P1 17 / P2 2，交易类核心流程均标注 HD 钱包真实执行 ✓

## 结论
**通过（无 block）**，5 项 warn 建议顺手修，其中 W2 需实测或产品确认卡片字段。

## 修订结果（2026-08-28）
- W1 已修：Gauntlet 前置条件加第 4 行（Steakhouse 持仓）
- W2 产品确认：卡片显示 APY、网络、渠道数——两份用例 §2 断言写明，规则第 7 章 / 需求文档同步
- W3 已修：两份用例 §5 章头加弹窗术语说明
- W4 已修：规则章节标题改「7. Morpho（Steakhouse / Gauntlet）」，两份用例头部引用同步
- W5 已修：需求文档标题改「Morpho 协议（Steakhouse / Gauntlet）」
复检：前置条件 4 / 3 行，禁用词 0。**通过。**
