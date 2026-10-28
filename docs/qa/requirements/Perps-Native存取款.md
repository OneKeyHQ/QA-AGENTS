# Perps - Native 存取款

## 范围与依据

- 对应 Jira Test：[OK-11789](https://onekeyhq.atlassian.net/browse/OK-11789)，保留钱包存款、提现及账户历史的原有范围，重排为四列手动用例。
- 源码基准：2026-10-28，OneKeyHQ/app-monorepo `x@a3c2d6f4e8276733a278289de2c122ffb170fe64`。重点为 `DepositWithdrawModal.tsx`、`DepositTokenSelectionContent.tsx`、`useShowDepositWithdrawModal.ts`、`usePerpDeposit.ts`、`useUsdcWithdrawRouting.ts`、`depositTokenListUtils.ts`、`perp.constants.ts`、`PerpAccountList.tsx`、`AccountRow.tsx`。审查基准及文件哈希见 [源码清单](../../../shared/reports/jira-perps-batch-sync-2026-10-28/source-manifest.json)，可按上述提交在 app-monorepo 中复查。
- Desktop / Web / Extension / Android / iOS 按支持的账户与签名能力执行。观察账户不发起钱包签名交易；不把不支持平台的外部钱包连接作为通用前提。

## 钱包存款

1. 入口先选择存款方式，再进入从钱包转入。链上收款及 Unifold 地址、追踪和详情归独立需求。
2. 列表展示币种、网络、数量、法币价值。无有效当前选择时，先取最高正法币价值资产，再按服务端默认及支持列表回退；不无条件默认 Arbitrum USDC。刷新维持列表稳定，搜索支持币名及网络名。
3. 切换资产清空金额与旧报价；最大值由用户点击填入。主币预留网络费，代币也必须具备对应网络费用。非 EVM 来源使用其所在网络账户地址。
4. 最低存款为折合 5 美元；美元与代币输入单位换算、精度、余额和报价独立校验。
5. Arbitrum 原生 USDC 直接转入官方充值合约，不经过跨链兑换报价；USDC.e 等其他资产走实际可用报价，不因同名而走错通道。
6. 跨链报价依赖当前账户、资产和金额。报价失效可刷新；需要授权时按实际请求签名，硬件确认次数不固定；二维码硬件走扫码签名。
7. 广播提交不等于到账；按哈希、链上结果和账本确认资产，取消、失败、防重复、迟到响应与账户隔离均需覆盖。废弃旧 Jira 的「切币自动 MAX」「固定确认两次」「保证 5 分钟到账」断言。

## 提现

1. 默认 Arbitrum；目标网络取当前配置，覆盖 Ethereum、Avalanche、OP Mainnet、Arbitrum、Base、HyperEVM。
2. CCTP 费用按当前有效报价，HyperEVM 使用对应资产转出通道；强制旧桥配置仅开放 Arbitrum，手续费 1 USDC。不能将旧 Jira 的 0.2 USDC 作为所有网络费用。
3. 最低提现至少 2 USDC；CCTP 还需满足扣除该通道费用后为正。最大值取当前可提现余额，并计入适用的当前账户费用预留，不等于总资产。USDC 最多 6 位小数。
4. 账户、通道、费用、可提现余额等必要数据未就绪时不可提交；签名期间不静默替换已核对的网络、账户或费用条件。取消及失败后解除提交状态，可重试且不重复扣款。

## 账户历史与覆盖归属

- 存款、提现和转账按对应账本显示时间、状态、操作、数量及真实费用；增加为正绿色、减少为负红色。移动端用方向图标，支出金额计入费用，不单独显示桌面费用列。
- 本地待处理存款与远端账本按哈希去重，按时间倒序，切账户回到第一页；无地址、空记录与加载过程不串账户。
- 不延续旧 Jira 对所有其他账本类型一律过滤或所有提现费用固定 1 美元的假设。
- 手动用例：`docs/qa/testcases/cases/perps/2026-10-28_Perps-Native存取款.md`；规则 §14。Unifold 和投资组合既有用例分别覆盖地址收款、入口布局；本次不扩写其已接受场景。
- API / UI 自动化影响：本次交付手动文档与 Jira 描述，不执行或新增真实资金自动化；后续复用时需按通道动态费用、可提现余额和账户隔离断言，不能复用旧固定费用。
