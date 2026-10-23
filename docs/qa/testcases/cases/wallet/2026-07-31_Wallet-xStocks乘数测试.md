# Wallet - xStocks 乘数测试

> 需求文档：`docs/qa/requirements/Wallet-xStocksMultiplier.md`
> 规则文档：`docs/qa/rules/wallet-rules.md`、`docs/qa/rules/transfer-chain-rules.md`、`docs/qa/rules/swap-rules.md`
> 测试端：Android / iOS / Desktop / Extension / Web（以产品支持为准）
> 说明：乘数为 1.0 时无法有效覆盖本需求；分红/拆股用例使用可控链上 fixture 或 multiplier API mock。

## 前置条件与测试数据

1. 已准备有余额和 Gas 的 HD 钱包账户 A、账户 B；Solana、TON、EVM 均可正常访问。
2. 测试环境可注入 raw balance、current/pending multiplier 与 activation timestamp；钱包可读取链上 metadata / 合约状态。
3. AAPL 示例资产（执行前通过 Backed Assets API 校验 symbol 与 network，不能仅凭 ticker 或地址推断）：Solana mint `XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp`；EVM contract `0x9d275685dc284c8eb1c79f6aba7a63dc75ec890a`。TON 使用支持 TEP-0526 的测试 Jetton。

| 参数组 | 链与 raw balance | 当前乘数 | 待生效乘数 | 覆盖目的 |
| --- | --- | --- | --- | --- |
| A | Solana / TON：10 | 1.00 | 无 | 基线 |
| B | Solana / TON：10 | 1.10 | 无 | 分红后显示 11；显示转出 5.5 时上链 raw 5 |
| C | Solana / TON：10 | 1.10 | 4.40 | 4:1 拆分，生效后显示 44 |
| D | Solana / TON：10 | 4.40 | 2.20 | 1:2 反向拆分，生效后显示 22 |
| E | Solana / TON：1 | 1.10 | 无 | 非整除、最小精度与舍入 |

## 1. 链上数据识别与余额展示

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. Solana / TON xStocks 使用参数组 B<br>2. 链上 raw balance 为 10 | 1. 打开钱包首页、资产详情与发送页<br>2. 查询 Solana mint 扩展 / TON `get_display_multiplier`<br>3. 对比各页面余额 | 1. 三处均显示 11 个代币或等价格式<br>2. 链上 raw balance 仍为 10<br>3. 显示金额等于 raw × multiplier，页面之间无数量差异 |
| P1 | 1. EVM xStocks 的 `balanceOf()` 为 11<br>2. 合约当前 multiplier 为 1.10 | 1. 打开 EVM xStocks 资产详情<br>2. 对比钱包余额与 `balanceOf()` | 1. 钱包显示 11<br>2. 不将 `balanceOf()` 再乘 1.10，不显示为 12.1 |
| P1 | 1. Solana 代币不含 Scaled UI Amount 扩展 / TON Jetton 不支持 TEP-0526 | 1. 打开普通代币资产详情<br>2. 查看余额与发送页 | 1. 按普通代币 raw amount 显示<br>2. 不请求或套用其他 xStocks 的 multiplier |
| P1 | 1. 参数组 E<br>2. decimals 与链上配置一致 | 1. 打开资产详情<br>2. 切换法币显示并查看余额 | 1. 显示值按链精度与舍入规则计算<br>2. 不出现科学计数法、尾数放大或可见余额超过可转余额 |

## 2. 公司行为与乘数切换

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. Solana / TON 使用参数组 C<br>2. 当前时间从 activation 前推进至 activation 后 | 1. 生效前记录 raw balance、显示余额、资产总值<br>2. 到点后触发轮询或前台刷新<br>3. 刷新首页、资产详情和持仓列表 | 1. raw balance 保持 10<br>2. 显示余额从 11 切换为 44，资产总值按新权益数量更新<br>3. 缓存被刷新，不出现拆分导致的 -75% 假跌幅 |
| ❗️❗️P0❗️❗️ | 1. Solana / TON 使用参数组 D<br>2. 已到 activation timestamp | 1. 刷新余额与资产总值<br>2. 查看价格涨跌与持仓数量 | 1. 显示余额从 44 切换为 22<br>2. raw balance 不变<br>3. 不将反向拆分显示为余额丢失或异常转出 |
| P1 | 1. API 返回 pending value 和未来 activation timestamp | 1. 完成一次轮询<br>2. 重启 App 或后台切回<br>3. activation 前刷新页面 | 1. pending value 与时间被保存<br>2. activation 前继续使用当前 multiplier，不提前改变余额<br>3. 返回前台后仍可在到点时切换 |
| P1 | 1. API 超时、500、字段缺失或返回非法 0 / 负值 | 1. 触发轮询<br>2. 打开资产和发送页 | 1. 保留上一次已验证的有效 multiplier<br>2. 不将余额归零、不使用非法乘数构建交易<br>3. 显示刷新失败状态或按产品策略重试 |
| P2 | 1. 可访问 `/multiplierUpdates` 历史数据 | 1. 查询当前资产的乘数历史<br>2. 与已生效值比较 | 1. 当前生效值与最新已生效历史记录一致<br>2. 未来记录不作为当前余额乘数 |

## 3. Solana / TON 转账与 MAX

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. Solana / TON 使用参数组 B<br>2. A 向 B 转出显示量 5.5 | 1. 在发送页输入 5.5<br>2. 打开确认页并签名提交<br>3. 查询链上交易和 A、B 余额 | 1. 发送页与确认页显示 5.5<br>2. 链上转账 raw amount 为 5<br>3. A、B 均按 1.10 显示，转出与收款显示量各变化 5.5 |
| ❗️❗️P0❗️❗️ | 1. Solana / TON 使用参数组 B<br>2. A 显示余额为 11 | 1. 在发送页点击 MAX<br>2. 打开确认页并提交<br>3. 查询 raw balance 和收款显示余额 | 1. MAX 填入可发送的显示余额 11<br>2. 链上使用 raw 10，不因显示量直接上链而超额<br>3. 网络费预留、最终余额与确认页一致 |
| P1 | 1. Solana / TON 使用参数组 E<br>2. 输入值不能被最小单位精确表达 | 1. 输入最小精度附近的显示金额<br>2. 查看确认页与构建交易 | 1. 按链规定的最小单位和舍入策略处理<br>2. 显示最终可转显示量或阻止不可表达金额<br>3. 不静默多转，确认页与链上 raw amount 可对账 |
| P1 | 1. 输入 0、负数、仅空格、超过显示余额、超长小数 | 1. 在 Solana / TON xStocks 发送页分别输入各值 | 1. 无效值不可进入确认页<br>2. 超过显示余额时提示余额不足<br>3. 输入校验以显示量为口径 |
| P1 | 1. Solana / TON xStocks 的 activation 前后 15 分钟内 | 1. 在窗口内打开发送页并输入金额<br>2. 尝试点击 MAX、预览和提交 | 1. 该 xStocks 交易被暂停，MAX 不生成可提交交易<br>2. 页面说明暂停原因和恢复时间或等待提示<br>3. 不发送按旧 multiplier 换算的交易 |
| P2 | 1. 同一钱包含普通 SPL / Jetton 和 EVM xStocks | 1. 在保护窗口内分别发起普通代币与 EVM xStocks 发送 | 1. 非目标 Solana / TON xStocks 不被误拦截<br>2. EVM xStocks 不受本地换算保护影响 |

## 4. Swap、报价与跨页面一致性

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. Solana / TON xStocks 使用参数组 B<br>2. 该代币支持 Swap | 1. 以显示量 5.5 作为 From 输入获取报价<br>2. 查看 Review Order<br>3. 签名提交并核对链上交易 | 1. 输入、报价、预计收到和确认页以显示量 5.5 表达<br>2. 构建交易中的 From raw amount 为 5<br>3. 成交后钱包余额、Swap 历史和链上金额换算一致 |
| P1 | 1. 以 xStocks 为 To 买入<br>2. 当前 multiplier 为 1.10 | 1. 使用稳定币买入显示量 1 xStocks<br>2. 完成交易并刷新余额 | 1. 报价与确认页显示收到 1 xStocks 或按实际报价展示<br>2. 链上收到约 0.909 raw amount<br>3. 钱包余额按 1.10 显示为 1，不少显示为 0.909 |
| P1 | 1. xStocks multiplier 保护窗口内 | 1. 以该 xStocks 为 From 或 To 请求报价并尝试 Review Order | 1. 相关交易不可构建或提交<br>2. 不显示可执行的旧报价，按钮状态和提示一致 |
| P1 | 1. 已在 Swap 输入 xStocks 金额<br>2. 确认前 multiplier 到点生效 | 1. 到达 activation timestamp 后返回 Swap<br>2. 尝试继续 Review Order 或提交 | 1. 旧报价失效并要求刷新<br>2. 不按旧 multiplier 提交<br>3. 刷新后金额以新 multiplier 计算或因保护窗口不可交易 |
| P2 | 1. Solana / TON / EVM 分别持有同一标的 xStocks | 1. 在 Wallet、Market、Stocks 持仓、Swap 选择器中查看余额 | 1. Solana / TON 使用各自当前 multiplier<br>2. EVM 显示与 `balanceOf()` 一致<br>3. 同一链各入口无旧缓存或双重换算 |

## 5. 刷新与兼容性

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | 1. pending multiplier 已缓存<br>2. App 在生效时后台或已重启 | 1. 到点后启动或回到前台<br>2. 打开相关资产页面 | 1. 首次可用刷新后采用已生效 multiplier<br>2. 不长期显示旧余额或资产总值 |
| P1 | 1. 两个 xStocks 使用不同 multiplier<br>2. 多账户持有不同 raw balance | 1. 切换资产、网络和账户<br>2. 对比每个余额 | 1. multiplier 按 token + network 隔离<br>2. 不将 A 代币或账户的 multiplier 复用给 B 代币或其他网络 |
| P2 | 1. 切换中文/英文、深色/浅色与窄屏布局 | 1. 查看余额、暂停提示、确认页和小数金额 | 1. 关键数值、单位、时间和错误提示完整可读<br>2. 不因布局或本地化导致截断、错位或金额单位缺失 |

## 变更记录

| 日期 | 版本说明 |
| --- | --- |
| 2026-07-31 | 初版：覆盖 Solana Token-2022、TON TEP-0526 与 EVM xStocks 的 multiplier 显示、转账、MAX、Swap、激活保护和缓存刷新。 |
