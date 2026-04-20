# Swap-0x同链支持网络

## 需求背景
Swap 模块通过 0x 聚合器在同链场景提供兑换能力，需要明确支持网络与关键验收点，用于功能自动化回归。

## 功能描述
在 Swap 页面选择渠道为 0x（或系统自动路由到 0x）时，同链兑换支持以下 EVM 网络：
- Ethereum
- Polygon
- Arbitrum
- Avalanche
- BSC
- Optimism
- Base

同链兑换类型覆盖：
- 主币 → 代币（Native → ERC20），示例：ETH → USDC
- 代币 → 主币（ERC20 → Native），示例：USDC → ETH
- 代币 → 代币（ERC20 → ERC20），示例：USDC → USDT（禁止同币对）

## 业务规则
1. **网络范围**：0x 同链仅在上述 7 个网络可用。
2. **授权规则（EVM）**：
   - ERC20 作为源币时，需要授权（Approve）后才可兑换。
   - Native token 作为源币时，不需要授权。
3. **授权流程覆盖要求**：
   - Approve+Swap 捆绑提交
   - Approve、Swap 单独提交
4. **金额档位覆盖要求**：最小可识别精度 / 中间值 / Max（Max 需扣除 Gas）。
5. **费用展示**：
   - Network Fee 显示为 native token 与法币价值
   - 0x 渠道返佣/服务费展示并可对账（规则来源：`docs/qa/rules/swap-rules.md`）
6. **报价有效期与刷新**：报价过期后可触发重新询价，展示倒计时或刷新入口（以产品实际为准）。
7. **历史记录**：提交后生成 Pending 记录，状态可更新为 Success/Failed；记录中渠道商名称为 0x（以产品文案为准）。

## 已知风险
- 报价波动导致断言不稳定（需断言字段存在性、精度与币种一致性，避免断言固定价格）。
- Approve/Swap 弹窗交互、链上确认时序不稳定（需有 Pending → 终态的可观测断言口径）。
- Max 逻辑在不同网络 Gas 变化下易出现边界问题（余额刚好不足/刚好够）。

## 关联资源
- `docs/qa/rules/swap-rules.md`
- `docs/qa/rules/swap-network-features.md`

## 变更记录
| 日期 | 变更说明 |
|------|----------|
| 2026-03-30 | 新增：0x 同链支持网络需求与测试基线 |

