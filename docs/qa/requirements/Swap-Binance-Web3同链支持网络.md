# Swap-Binance Web3同链支持网络

## 需求背景
Swap 模块新增 **Binance Web3** 渠道，仅提供**同链**兑换。源网络与目标网络必须一致；跨链路由不得命中该渠道。

## 功能描述
在 Swap 页面询价结果命中 Binance Web3（或产品定义的等价展示名）时，同链兑换支持以下网络（口径来自接入映射：`networkId` / `binanceChainId` / `okx`）：

| 展示名 | networkId | binanceChainId | okx |
|--------|-----------|----------------|-----|
| BSC | `evm--56` | `56` | `56` |
| Ethereum | `evm--1` | `1` | `1` |
| Arbitrum | `evm--42161` | `42161` | `42161` |
| Base | `evm--8453` | `8453` | `8453` |
| Polygon | `evm--137` | `137` | `137` |
| Optimism | `evm--10` | `10` | `10` |
| Linea | `evm--59144` | `59144` | `59144` |
| Blast | `evm--81457` | `81457` | `81457` |
| Avalanche | `evm--43114` | `43114` | `43114` |
| Scroll | `evm--534352` | `534352` | `534352` |
| Sonic | `evm--146` | `146` | `146` |
| Katana | `evm--747474` | `747474` | `747474` |
| Monad | `evm--143` | `143` | `143` |
| Solana | `sol--101` | `CT_501` | `501` |
| Tron | `tron--0x2b6653dc` | `CT_195` | `195` |
| Robinhood | `evm--4663` | `4663` | `4663` |

> 接入清单备注 `monda` 对应 `evm--143`，产品展示与用例统一写 **Monad**。

同链兑换类型覆盖：
- 主币 → 代币（Native → Token）
- 代币 → 主币（Token → Native）
- 代币 → 代币（Token → Token，禁止同币对）

## 业务规则
1. **仅同链**：`fromNetworkId` 必须等于 `toNetworkId`。源网络与目标网络不一致时，报价列表不包含 Binance Web3。
2. **渠道类型**：按同链聚合器处理，**不是**中心化换汇豁免渠道。EVM 的 ERC20、Tron 的 TRC20 作为源币时需要授权；Solana 不需要授权。
3. **授权流程覆盖**：ERC20 / TRC20 作为源币时覆盖 `Approve+Swap` 捆绑提交与 `Approve / Swap` 单独提交。Ethereum 上 `USDT → ETH` 按二次授权规则执行。
4. **金额档位**：最小可识别精度 / 中间值 / Max（扣除 Gas 或网络费后的可用上限）。
5. **费用展示**：确认页展示 `Network Fee`（主币 + 法币）；渠道服务费 / 返佣若产品展示，则字段可读取。返佣比例与收款地址以产品配置为准，当前未写入固定值。
6. **历史记录**：提交后生成 `Pending` 记录，可流转至终态；详情 `Provider` 显示 `Binance Web3` 或产品定义的等价文案。
7. **地址与代币基线**：账户地址与代币合约以 `docs/qa/rules/swap-network-features.md` 为准。`Blast` 稳定币基线优先 `USDB`。特殊网络交易对：
   - `Katana`：`USDC = 0x203a662b0bd271a6ed5a60edfbd04bfce608fd36`，`KAT = 0x7f1f4b4b29f5058fa32cc7a97141b8d7e5abdc2d`
   - `Monad`：`USDC = 0x00000000efe302beaa2b3e6e1b18d08d69a9012a`，`USDT = 0xe7cd86e13ac4309349f30b3435a9d337750fc82d`
   - `Robinhood`：`USDG = 0x5fc5360d0400a0fd4f2af552add042d716f1d168`，`USDe = 0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34`
   - 不覆盖 `Mode / Metis / Plasma`
8. **provider 枚举**：app-monorepo 客户端当前未检索到固定 `ESwapProvider` 常量；API / 自动化脚本生成前必须以 `/swap/v1/providers/list` 或 quote 返回的 `provider` 回填 `swap-rules.md` 映射表。手工用例按 UI 展示名断言。
9. **构建上下文**：构建必须依赖询价返回的 `quoteResultCtx`。每条订单按 `quote -> quoteResultCtx -> build` 执行；缺少 `quoteResultCtx` 不得进入有效构建态。

## 已知风险
- `Katana / Monad / Robinhood` 流动性可能不足，报价可能返回业务层错误，需与「渠道不支持」区分。
- Solana、Tron 的 `binanceChainId` 为 `CT_501` / `CT_195`，与 OneKey `networkId` 不同，API 用例不得混用。
- Blast 不得沿用通用 `USDC / USDT` 占位。
- Robinhood 交易对使用 `USDG / USDe`，不得误写成通用 `USDC / USDT`。

## 关联资源
- `docs/qa/rules/swap-rules.md`
- `docs/qa/rules/swap-network-features.md`
- `docs/qa/testcases/cases/swap/2026-09-22_Swap-Binance-Web3渠道同链测试.md`

## 变更记录
| 日期 | 变更说明 |
|------|----------|
| 2026-09-22 | 新增：Binance Web3 仅同链，19 条支持网络与验收口径 |
| 2026-09-22 | 构建改为强制依赖 `quoteResultCtx`；支持矩阵去掉 Mode / Metis / Plasma，保留 Katana / Monad / Robinhood 并回填代币合约 |
