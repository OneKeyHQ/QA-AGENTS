# QA Review — DeFi Morpho Steakhouse stake（Katana / vbUSDC）

> 审查对象：`docs/qa/testcases/cases/defi/2026-08-27_DeFi-Morpho-Steakhouse-stake.md`（新增，未跟踪）
> 审查日期：2026-08-28
> 依据：`docs/qa/qa-rules.md` §7.3 / §7.3.2 / §7.3.3、`docs/qa/rules/defi-rules.md` 核心规则速查、app-monorepo `x` 分支源码

## 范围摘要

- 变更文件：1 个（testcases: 1）
- 涉及模块：defi
- 已加载：`defi-rules.md`（无 Morpho 章节）、`cases/defi/` 同类用例（Spark / Bitway / Native / Lista）、app-monorepo：`earnUtils.ts`、`addresses.ts`、`earnProvider.constants.ts`、`useEarnPermitApprove.ts`、`ApproveBaseStake/index.tsx`、`ProtocolRewards.tsx`、`useHandleClaim.ts`、`PortfolioSection.tsx`、`staking.ts`、PR #12982（Katana integration）

## Phase 2 安全审查：通过 ✓

- 无私钥 / 助记词 / API key / JWT
- 文件含 2 个主网格式地址（vbUSDC 合约 `0x203A…FD36`、观察地址 `0x92bA…5178`），均为用户提供的测试数据，源码 `addresses.ts` 中 `KatanaVbUSDC` 与合约地址一致 ✓

## Phase 4 用例审查

### A. 准确性（源码对齐）— block

| # | 位置 | 问题 | 源码依据 | 建议 |
|---|---|---|---|---|
| A1 | §5 P0 首行、§9 P0 首行、§4 多处「授权」按钮 | **授权流程写错**。用例写成「授权交易真实签名广播 → 按钮切为认购 → 再点认购」两笔链上交易。Katana 上 Morpho 走 **Permit 签名授权**：点击单个按钮（文案 `earn_approve_deposit`，"授权并认购"类）→ 弹出 **EIP-712 typed data 签名**（不广播、不耗 gas）→ 签名后自动发起认购交易。没有独立的授权 tx，也没有第二次点击。 | `earnUtils.ts` L174-181：Permit 时 spender = `MorphoKatanaBundlerContract`；`useEarnPermitApprove.ts`：`EMessageTypesEth.TYPED_DATA_V4` + spender 校验；`ApproveBaseStake/index.tsx` L371-382 按钮文案分支、L713-760 签名后直接 `onSubmit()` | 重写 §5/§9 主流程：1 次 typed-data 签名 + 1 笔认购交易；签名弹窗断言 spender = `0x916aa175c36e845db45ff6ddb886ae437d403b61`（Morpho GeneralAdapter），不是 vbUSDC 合约 |
| A2 | §5 P2「授权后中断」 | 机制描述错：不是"链上已授权额度"，而是 **Permit 签名本地缓存 24h**，缓存 key 含 `accountId/networkId/tokenAddress/amount`——**金额变了必须重签** | `ApproveBaseStake/index.tsx` L717-740 `getPermitCache` / `updatePermitCache(expiredAt = 24h)` | 改为：同金额 24h 内再次认购不再弹签名；改金额后重新弹签名；提升为 P1 |
| A3 | §7 全章 | 奖励领取 UI 与源码不一致：<br>① 源码是详情页「协议奖励」区块（`protocolRewardsSection`），**每个奖励代币一行 + 各自 Claim 按钮**（`isMorphoClaim` + `claimTokenAddress`）——用例"各自独立领取"方向对，但把入口写成持仓行，位置错<br>② `claimableNow = 0` 时按钮**置灰**（不是隐藏）；整个区块仅当任一代币 `claimableNow` 或 `claimableNext` > 0 时显示<br>③ 缺 **「未来可领取 X」（claimableNext）** 字段用例<br>④ 缺 info icon 弹窗（`earn_claim_rewards_morpho_desc`，含更新频率 `updateFrequency`）用例 | `ProtocolRewards.tsx` L120-137 按钮 disabled 逻辑、L139-160 claimableNext、L178-186 区块显示条件、L225-243 popover | 入口改为详情页「协议奖励」区块；补 claimableNext 与 info 弹窗两条；「隐藏或置灰」改为精确口径 |
| A4 | §6「累计收益」相关 4 条 | **需求与 dev 代码冲突**：需求说"有累计收益字段，从 Morpho 获取"，但 `PortfolioSection.tsx` L456-460 中 `totalRewardAmount` 的渲染代码目前**被注释掉**，详情页持仓区未渲染累计收益。按项目规则不把代码行为写成需求变更，**需与产品/开发确认**该字段的实际展示位置（详情页持仓区 / Portfolio 列表 / 管理弹窗） | `staking.ts` L1734-1735 `earnings24h` / `totalRewardAmount`；`PortfolioSection.tsx` L374 `_totalRewardAmount` 未使用 | 用例保留，头部标注「累计收益展示位置待确认」；确认后回填 |
| A5 | §2 P1「当前网络非 Katana → 自动切链」 | 场景不存在。Earn 按协议绑定 networkId 取对应网络账户，没有"当前网络"概念，不会出现错链签名 | `earnProvider.constants.ts` `earnMainnetNetworkIds` 含 katana；Earn 详情页按 `networkId` 取账户 | 删除；改为真实边界：**HD 钱包在 Katana 尚未创建地址** → 进入详情页/认购时提示创建地址 |
| A6 | §7 P1「领取代币接入」 | 断言"MORPHO / KAT 在 Katana 资产列表正确识别"未核实：earn token 网络表中 `MORPHO: [eth]`，Katana 上的 MORPHO / KAT 是否有内置 token 信息未知；`ProtocolRewards` 在缺 `rewardAssets[addr].info.symbol/logoURI` 时**整行不渲染**（`console.warn` + return null） | `ProtocolRewards.tsx` L44-48 | 改为 P0：验证协议奖励区 MORPHO / KAT 两行均渲染（缺 token 元数据会整行消失，是真实回归点）；资产列表识别降 P1 |

### B. 规范格式 — block

| # | 位置 | 问题 | 规则 |
|---|---|---|---|
| B1 | L164 `## 备注` | 禁止单列「备注」章节；执行要点内联到用例行，待确认项移到规则/需求文档 | qa-rules §7.3.2 |
| B2 | 前置条件第 4 条、§1 第 2 行（P0）、§6「观察地址只读」（P0） | 用例文档不写观察账户相关描述，观察地址仅在测试数据表列出 | qa-rules §7.3.3、defi-rules 账户类型使用规则 |
| B3 | 预期结果列禁用词：L53「正常展示」、L93「交易成功」、L110「正常展示」、L111「属正常」、L147「不成功」；L92 / L157「认购成功」（产品文案引用，Spark 用例同写法） | 出现即 block；「认购成功」建议改为「显示认购完成提示」或保留引号文案并统一 | qa-rules §7.5 禁止词表 |
| B4 | §6 末行 P0「点击管理」排在 4 条 P1 之后 | 无依赖的 P0 必须排表顶 | qa-rules §7.3 |

### C. 质量 — warn

| # | 位置 | 问题 | 建议 |
|---|---|---|---|
| C1 | L63 APY 弹窗 | 多行用 ①②③，规则要求 `1. 2. 3.` 编号 | 改编号 |
| C2 | §4「最小金额边界」与「精度边界」 | 同一截断逻辑写了两次（0.0000009 与 10.1234567） | 合并为一条：最小 = 1 个精度单位，第 7 位截断，截断为 0 时置灰 |
| C3 | §1 P1「赚币列表 vbUSDC 卡片」与 §2 入口 | 重叠 | 并入 §2 |
| C4 | §6「累计收益与奖励分离」 | 与「累计收益准确性」第 3 点重复 | 删除 |
| C5 | §3 APY 弹窗「三项之和 ≈ 综合 APY」 | 未核实 Morpho APY 组成是否含业绩费扣减；`ProtocolApyRewards.tsx` 用 `rewardAssets` 渲染，条目数取决于接口 | 改为「各行之和 ≈ 综合 APY」，不预设 3 行 |
| C6 | 头部 | 无需求文档 `docs/qa/requirements/DeFi-Morpho协议.md`；`defi-rules.md` 无 Morpho 章节；参数表按规则应登记在规则文档渠道章节 | 先建需求 + 规则章节（含 Permit 授权、协议奖励区、参数表），再回填用例引用 |
| C7 | §8 全额赎回「到账 ≈ 本金 + 累计收益」 | 与 A4 联动：累计收益字段位置未定，断言暂以"到账 ≥ 本金"为口径 | 待 A4 确认 |
| C8 | 优先级分布 P0 29 / P1 25 / P2 5 | 合理；§1 观察地址 P0 移除后 P0 = 27 | — |

### D. 通过项

- 文件名 / 路径 / 首行标题 / 4 列表头 / `❗️❗️P0❗️❗️` 标记 ✓
- 头部含规则文档引用、测试端、变更说明；前置条件 4 行 ✓
- 术语：HD 钱包 / HW 钱包统一 ✓
- 参数表：vbUSDC 合约地址与源码 `KatanaVbUSDC` 一致 ✓；最小 0.000001 / 6 位 / 无上限与需求一致 ✓
- 交易类核心流程均写明 HD 钱包真实执行 ✓
- Morpho claim 走 `claimTokenAddress` 指定代币（`useHandleClaim.ts` L58-62），与"分开领取"需求一致 ✓

## 结论

**不通过（block 10 项：A1-A6、B1-B4）**。最关键是 A1（授权机制）和 A3（奖励领取 UI），这两处按现用例执行会直接判错；A4 需先与产品确认累计收益展示位置。

## 修订结果（2026-08-28）

用户确认 A4：**累计收益在投资组合展示**（源码 `PortfolioTabContent.tsx`：预计 24 小时收益列第二行 `asset.totalReward` + `earn_referral_total_earned` 标签）。

| 项 | 状态 | 处理 |
|---|---|---|
| A1 / A2 | 已修 | §5 重写为 Permit 签名 → 1 笔认购 tx；spender 断言；缓存 24h / 改金额重签用例 |
| A3 | 已修 | §7 重写：详情页「协议奖励」区块 + 投资组合「可领取协议奖励」区；每代币独立领取；补 claimableNext、info 弹窗、置灰/隐藏精确口径 |
| A4 | 已修 | §6 改为投资组合列结构 + 累计收益位置；跨入口用例明确详情页/管理弹窗不展示 |
| A5 | 已修 | 删除切链场景，改为「HD 钱包未创建 Katana 地址」P0 |
| A6 | 已修 | §7 首条 P0 断言两行数量 = 2 |
| B1-B4 | 已修 | 移除备注章节；观察地址仅留测试数据表；禁用词清零；P0 排序修正 |
| C1-C5 | 已修 | 编号统一；合并重复用例；APY 弹窗改「各行之和」 |
| C6 | 已修 | 新增 `docs/qa/requirements/DeFi-Morpho协议.md`；`defi-rules.md` 新增第 7 章 Morpho Steakhouse + 渠道支持表 + 变更记录 |

复检：预期结果列禁用词 0；P0 乱序 0；P0 25 / P1 22 / P2 3。**通过。**
