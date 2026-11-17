# DeFi - ether.fi Liquid 金库接入

## 1. 来源与确认范围

- 用户指定 [PR #14333](https://github.com/OneKeyHQ/app-monorepo/pull/14333) 及 [ETH Yield 官方页面](https://www.ether.fi/app/cash/earn/liquid/eth-yield?tab=overview)。实时PR尚未合并，目标分支为release/v6.7.0；固定提交 `cdd304038081b1789f3dfa74bf963aaf40d75015`。不采用网页缓存中的旧Draft、旧提交或旧目标分支。
- 需求任务 [OK-64586](https://onekeyhq.atlassian.net/browse/OK-64586) 及 [接入调研文档](https://onekeyhq.atlassian.net/wiki/x/BgCNd)（v4）。调研中标记提案、历史费率及活动商务条款不自动成为测试预期。
- 2026-11-14 用户确认三个金库及以下流程：Ethereum主网；ETH→WETH→授权→存入、直接代币存入、LiquidRefer授权、旧liquidUSD队列授权清零、按份额赎回、逐笔取消、自动到账无需Claim，中断保留已完成步骤、未知广播先核对状态。用户进一步要求用官方与链上规则校验PR，不能以PR本身证明预期。

| 金库 | 可存入资产 | 份额（精度） | 本期取回资产 |
| --- | --- | --- | --- |
| Liquid ETH | ETH / WETH / eETH / weETH / stETH | liquidETH（18） | weETH |
| Liquid USD | USDC / USDT | liquidUSD（6） | USDC / USDT |
| Liquid BTC | WBTC / cbBTC / eBTC | liquidBTC（8） | eBTC |

## 2. 官方规则、链上事实与OneKey边界

- 官方合约目录：[ETH](https://etherfi.gitbook.io/etherfi/products/liquid/live-vaults/liquid-eth-vault)、[USD](https://etherfi.gitbook.io/etherfi/products/liquid/live-vaults/liquid-usd-vault)、[BTC](https://etherfi.gitbook.io/etherfi/products/liquid/live-vaults/liquid-btc-vault)。官方产品还部署Optimism，本期用户确认只覆盖Ethereum，不能把官网所有链一并当作OneKey接入范围。
- [官方存取说明](https://help.ether.fi/en/articles/517109-how-liquid-works)概述自动复投；[份额换算说明](https://help.ether.fi/en/articles/879604-why-are-liquid-assets-not-1-1-with-their-underlying-tokens)明确非rebase，数量不因收益自动增加、份额价值随收益变化，不要求份额与输入/输出1:1。
- [官方赎回时长汇总](https://help.ether.fi/en/articles/269720-typical-liquid-withdrawal-timelines)在本次读取时将三个Liquid金库列为预估最长约3天。用户随后明确差异资产为eBTC，经核实官方将Liquid BTC与eBTC本体赎回分列；三个本期Liquid金库当前均为最长约3天预估，eBTC本体为最长约14天。上述金库值作为当前来源快照，**不固化为永久或保证到账期限**。按“金库＋链＋取回代币＋赎回方式”逐项核对官方实际赎回详情，记录查询时间和估算单位；来源冲突未核清前标记待确认。不要套用eBTC本体的最长14天、sETHFI的13–14天或Unitas7天。
- [官方赎回指引](https://help.ether.fi/en/articles/284654-how-to-withdraw-from-liquid)确认兑付自动到钱包、无需手动Claim。通用指引举例可能列WETH/weETH；本次ETH队列链上只有weETH允许，不能据通用示例要求本期提供WETH赎回。
- 固定链上快照：Ethereum区块 26410726，2026-11-14T04:07:23+00:00。三个Teller的shareLockPeriod均0，三个Queue未暂停；允许的输出资产secondsToMaturity均3600秒、minimumSecondsToDeadline均259200秒、minimumShares均0。最早可兑付1小时不是1小时到账；到期时间是创建时间+成熟等待+请求有效期，3天是有效期下限，不是到账SLA。minimumShares=0不代表页面应允许零金额。
- 通过官方 [BoringOnChainQueue源码](https://github.com/Se7en-Seas/boring-vault/blob/main/src/base/Roles/BoringQueue/BoringOnChainQueue.sol)交叉核对读取布局；保留原始RPC返回本地供核验，不把公共仓库HEAD与已部署字节码等同为完整安全审计。

### 分取回代币的赎回时长

2026-11-14复核：浏览器已能读取ETH Yield概览，点击“提取”出现登录/连接钱包弹窗，尚未读取到分代币赎回详情。此前程序化读取遇到Vercel检查不等于浏览器永久无法访问；本轮没有连接钱包或签名。用户随后指明差异代币为eBTC。复查同一官方时长页：BTC Yield（Liquid BTC）为预估最长3天，另列的eBTC为预估最长14天。两者应按赎回对象区分，不能因为Liquid BTC的取回资产也是eBTC，就将14天套在Liquid金库流程；分资产实际页面显示仍需核实。

| 金库（Ethereum） | 取回代币 | 预估到账时间 | 核验状态 |
| --- | --- | --- | --- |
| Liquid ETH | weETH | 官方当前金库预估最长约3天 | 按金库公布值记录；实际赎回详情执行时复核 |
| Liquid USD | USDC | 官方当前金库预估最长约3天 | 执行时独立核对本次取回资产预估 |
| Liquid USD | USDT | 官方当前金库预估最长约3天 | 执行时独立核对本次取回资产预估 |
| Liquid BTC | eBTC | 官方当前金库预估最长约3天 | liquidBTC份额赎回，终点是收到eBTC；不套用下述eBTC本体14天 |

官方同页另列 **eBTC本体赎回预估最长14天**，不属于本PR已确认的Liquid BTC份额赎回范围。完整区别：`liquidBTC份额 → 收到eBTC` 与 `eBTC → 进一步退出其原生产品`。本期只验证前一段，收到eBTC后不能声称已收到WBTC/cbBTC或原生BTC，也不自动追加第二段退出、Swap或额外等待。该区别来自[官方时长页](https://help.ether.fi/en/articles/269720-typical-liquid-withdrawal-timelines)分别列出的BTC Yield与eBTC，以及本期确认的取回币种；不是仅由PR反推。

同一金库切换取回代币时，预估时间和说明应使用本次所选资产的数据；允许不同，也允许经独立核实后相同，不强制相等或不等。链上成熟时间、请求有效期与实际兑付预估继续分开核对，不能把当前1小时成熟或3天有效期当作任何代币的到账时长。

### 最大/最小存入

官方帮助中心未公布统一固定存入最小值或最大值。此前程序化读取应用页返回Vercel Security Checkpoint；本轮浏览器可读概览，但赎回详情要求登录/连接钱包，尚未取得页面实时金额门槛。

官方 [Teller源码](https://github.com/Se7en-Seas/boring-vault/blob/main/src/base/Roles/TellerWithMultiAssetSupport.sol)检查非零输入、支持资产和最低铸造保护，公开配置中未发现每币固定存入上下限参数；**这不证明整个协议永远无上限**。小数位不是产品最小存入额，最小精度输入也可能因净值换算产生零份额。PR的金额校验还调用服务端 `/earn/v1/check-amount`（ServiceStaking.ts:1789–1858），赎回下限由 `protocolInfo.minUnstakeAmount` 传入表单（Withdraw/index.tsx:400–404）；客户端PR不能确定服务端最终门槛。2026-11-16 用户明确提供三个金库的最小认购值及按代币最小精度赎回的规则，按下表更新，不再登记为未知。各金库额外最大认购限制仍待确认；执行时若出现其他限制，先核实业务依据，不用PR或接口返回自证其正确。

| 金库 | 适用存入资产 | 最小认购金额 | 金额来源 |
| --- | --- | --- | --- |
| Liquid ETH | eETH / weETH / WETH / stETH / ETH | 0.000000000000000003 | 2026-11-16 用户确认，3 个最小精度单位 |
| Liquid BTC | cbBTC / WBTC / eBTC | 0.00000003 | 2026-11-16 用户确认，3 个最小精度单位 |
| Liquid USD | USDC / USDT | 0.000003 | 2026-11-16 用户确认，3 个最小精度单位 |

以上为输入资产的最小数量，不是 liquidETH/liquidBTC 份额或法币金额。边界分别取最小值减一个精度单位、等于最小值、加一个精度单位：ETH 类 0.000000000000000002 / 0.000000000000000003 / 0.000000000000000004；BTC 类 0.00000002 / 0.00000003 / 0.00000004；USD 类 0.000002 / 0.000003 / 0.000004。低于门槛阻止认购；等于或高于门槛在余额、费用及有效报价满足时可继续。继续保留0/空值、份额舍入、余额超限、Max与gas边界，不因输入符合最小值而忽略零份额保护。

### 最小赎回份额

2026-11-16 用户确认赎回最小值按代币最小精度。当前赎回使用份额输入，具体为下表，不沿用各输入资产的认购最低量；此前链上快照 minimumShares=0 不代表页面可以用零份额赎回。

| 金库 | 赎回份额代币 | 小数位 | 最小赎回数量 |
| --- | --- | --- | --- |
| Liquid ETH | liquidETH | 18 | 0.000000000000000001 liquidETH |
| Liquid USD | liquidUSD | 6 | 0.000001 liquidUSD |
| Liquid BTC | liquidBTC | 8 | 0.00000001 liquidBTC |

零值、空值及超过可赎回量不可提交；不足一个精度单位或多余小数位可拒绝或修正，修正成0时不可广播。最低量及高一个精度单位在持仓、费用、有效报价满足时可继续。预估取回量仍按执行规则和份额换算核对，不要求底层数量等于份额。

### 费用与报价

份额到账按执行时兑换率、适用溢价及本次最低铸造保护核对，不能要求旧预览数量在净值变动后仍精确相等；低于已确认最低份额时交易不得成交。赎回输出按申请时锁定的本笔数量核对，不以结算时的新兑换率重算已锁定请求。

- 费率按金库当前有效参数及本次独立报价核对，不固定历史管理费或APY。链上本快照USDT存入sharePremium=10bps（0.10%少铸份额），其余接入资产0；允许的赎回资产当前折价范围0–10bps，本笔使用值需核对申请参数；如变更需重新读链，不把该快照写成永久收费承诺。
- ETH包装为WETH 1:1，包装不等于已存入金库；包装、链上授权、存入各自的交易费和结果分别核对。足额授权跳过重复授权；USDT既有非零额度不足且需重置时，先撤销再重新授权，取消后的额度按链上生效结果核对；Permit是否适用依所选代币当前有效签名方案，不强制所有币种统一签名次数。
- 存入的ERC20授权对象为LiquidRefer；赎回的授权代币为本次份额、授权对象为对应Queue。旧liquidUSD AtomicQueue `0xd45884b592e316eb816199615a95c182f75dea07` 只处理既有额度撤销，不新增授权或作为新交易目标。

## 3. 合约与资产资料

以下13个协议合约存在代码，3个份额核对symbol/decimals；9个输入ERC20另验证合约代码与symbol/decimals。原生ETH不登记伪ERC20地址。LiquidRefer是本次存入入口，不能把份额合约或Teller当成其授权对象。

| 角色（Ethereum） | 地址 |
| --- | --- |
| LiquidRefer | 0x1d536713e681b3679f6201f0ad0f83d79eff3ede |
| liquidETH | 0xf0bb20865277abd641a307ece5ee04e79073416c |
| liquidUSD | 0x08c6f91e2b681faf5e17227f2a44c307b3c1364c |
| liquidBTC | 0x5f46d540b6ed704c3c8789105f30e075aa900726 |
| ETH_Queue | 0x0d2df071207e18ca8638b4f04e98c53155ec2ce0 |
| USD_Queue | 0x38fc1ba73b7ed289955a07d9f11a85b6e388064a |
| BTC_Queue | 0x77a2fd42f8769d8063f2e75061fc200014e41edf |
| ETH_Teller | 0x9aa79c84b79816ab920bbce20f8f74557b514734 |
| USD_Teller | 0x4de413a26fc24c3fc27cc983be70aa9c5c299387 |
| BTC_Teller | 0x8ea0b382d054dbebeb1d0ae47ee4ac433c730353 |
| ETH_Accountant | 0x0d05d94a5f1e76c18fbeb7a13d17c8a314088198 |
| USD_Accountant | 0xc315d6e14ddcdc7407784e2caf815d131bc1d3e7 |
| BTC_Accountant | 0xea23ac6d7d11f6b181d6b98174d334478adae6b0 |

| 资产 | 合约 | 小数位 |
| --- | --- | --- |
| USDC | 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 | 6 |
| USDT | 0xdAC17F958D2ee523a2206206994597C13D831ec7 | 6 |
| WETH | 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 | 18 |
| stETH | 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84 | 18 |
| eETH | 0x35fa164735182de50811e8e2e824cfb9b6118ac2 | 18 |
| weETH | 0xcd5fe23c85820f7b72d0926fc9b05b43e359b7ee | 18 |
| WBTC | 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599 | 8 |
| cbBTC | 0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf | 8 |
| eBTC | 0x657e8c867d8b37dcc18fa4caead9c45eb088c642 | 8 |

## 4. 公开观察地址

仅用于只读持仓、队列和展示核对，不能代替自有HD/HW钱包签名。余额与状态会变化，执行前重新读取。下表固定于区块26410726，金额为份额数，不是底层资产数。

| 地址 | 快照状态 | 数量 | 核验区块 |
| --- | --- | --- | --- |
| 0x006d9f269695ad9eb8f727f042ee380684332916 | liquidETH 持仓 | 0.600299056728245856 | 26410726 |
| 0xe0c823234d3616d587368bc5e7b532143ead0002 | liquidUSD 持仓 | 84.210739 | 26410726 |
| 0xb677618c093993e40fa89ed24164b3965750e0f7 | liquidBTC 持仓 | 0.04992934 | 26410726 |
| 0x006d9f269695ad9eb8f727f042ee380684332916 | Liquid ETH 排队赎回 | 0.839327645818726365 份额 | 26410726 |
| 0xbc2e07a461ef6194545c4bbad0e3f64679331ea9 | Liquid USD 排队赎回 | 4290.104054 份额 | 26410726 |


- Liquid ETH 排队请求：`0x055a81cd7580537488a7d5e3dea65f3e3e422725767905f769f344a91babc52c`；输出资产 `0xcd5fe23c85820f7b72d0926fc9b05b43e359b7ee`；锁定预估到账 0.841664996238628177；创建时间 2026-11-13T05:26:23+00:00。请求ID仍在Queue的getRequestIds返回集合，不只是历史日志曾出现。交易：[链上记录](https://etherscan.io/tx/0x3493bac0350aeb531f4e0ecd438b502a122f92caa69112ada5f2594741b72bc0)。

- Liquid USD 排队请求：`0x6e9b23e059ea77e2208bc8c6e30c4994dade1b726b30d7ddfe01d000f8dd7cee`；输出资产 `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`；锁定预估到账 5094.485693；创建时间 2026-11-13T05:58:11+00:00。请求ID仍在Queue的getRequestIds返回集合，不只是历史日志曾出现。交易：[链上记录](https://etherscan.io/tx/0x4181d8178f25e53082c8a348c7691bf86dbd54707f007f30c137860e1fcf943a)。

BTC队列当前活动请求为0，未找到本快照可用的BTC排队样本；旧liquidUSD授权非零及已过期请求也未取得已核实样本，不伪造。实际取消、过期和到账用例须在自有测试钱包/授权测试环境准备，不能为造数据向旧受限队列新授权。最近9000区块日志用于筛选后再以固定区块余额/活动请求核验；更旧区间的免费RPC请求受限制，未绕过或声称完成全历史扫描。

## 5. 用例与维护边界

用例：`docs/qa/testcases/cases/defi/2026-11-14_DeFi-EtherFi-Liquid金库认购赎回.md`。三个金库通用流程参数化，ETH包装和USD旧授权独立分支，HD与HW分组。动态金额、固定限制待确认项在参数表明示，不沿用其他协议时间或限制。

仅维护Markdown；本轮未连接App/钱包、未签名广播或进行真实资金操作，不改产品代码及API/UI自动化。不承诺PR自测覆盖了真实结算、重启恢复、后端幂等或移动包可用性。OK-64586为需求来源，不是用例同步目标。用户指定并授权同步至Test OK-23865（id 34607，原标题“DeFi - ether.fi stake”），仅更新description并保留标题及其他字段；最终同步状态、时间及哈希以共享映射的回读结果为准。

## 变更记录

- 2026-11-16：补入用户确认的 Liquid ETH 最小 0.000000000000000003、Liquid BTC 最小 0.00000003、Liquid USD 最小 0.000003；覆盖全部指定存入资产和相邻精度边界，赎回最小值为各份额代币一个精度单位。同日按用户“同步”授权已更新至 OK-23865，37 条用例及 14 张表格的富文本与渲染回读一致；业务用例表保持四列，三张辅助数据表按要求精简为三列。原标题和其他字段保持；共享映射记录当前同步时间及指纹。

- 2026-11-14：按最终核对口径记录本期三个Liquid金库当前预估最长约3天，保留分取回资产复核与非保证期限；用户授权同步至OK-23865并保留原标题。

- 2026-11-14：用户明确差异资产为eBTC；核实官方将Liquid BTC预估最长3天与eBTC本体预估最长14天分列，补明两段流程边界。

- 2026-11-14：用户指出分代币赎回时长不一致，撤销统一3天验收口径；增加四个取回资产组合、来源冲突及待核对状态。
- 2026-11-14：按用户确认三个金库及特殊流程；对照官方资料、固定PR和链上快照，补合约/观察地址、时限区分及金额边界，未知固定上下限保留待确认。
