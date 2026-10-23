# xStocks Multiplier

> 模块：Wallet / Transfer / Swap
> 功能：xStocks 在 Solana、TON、EVM 的乘数（Multiplier）余额显示与交易金额换算
> 测试端：Android / iOS / Desktop / Extension / Web

## 需求背景

xStocks 的现金股息会自动再投资；股票拆分与反向拆分会改变每个代币代表的权益数量。Solana 与 TON 的链上原始余额不变，钱包须计算可见余额；EVM 的 `balanceOf()` 已返回调整后的余额，不能重复换算。

## 功能规则

| 链 | 原始余额 | 用户可见余额 | 交易构建金额 |
| --- | --- | --- | --- |
| Solana（Token-2022 Scaled UI Amount） | 保持不变 | `raw × multiplier` | `display ÷ multiplier`，用原始最小单位上链 |
| TON（TEP-0526） | 保持不变 | `raw × numerator ÷ denominator`，按协议舍入 | `display × denominator ÷ numerator`，按协议舍入后上链 |
| EVM | 内部 share units 不直接展示 | 直接使用 `balanceOf()` | 直接使用用户输入的可见余额 |

- Solana 从 Token-2022 mint 的 Scaled UI Amount 扩展读取乘数；TON 从 Jetton Master 的 `get_display_multiplier()` 读取分子与分母。
- 客户端轮询 `GET /api/v1/token/{SYMBOL}/multiplier?network={NETWORK}`，保存 pending 值与生效时间；到点切换并刷新缓存。历史使用 `/multiplierUpdates`。
- Solana / TON xStocks 在乘数生效前后各 15 分钟暂停转账、MAX、Swap 的构建和提交；EVM xStocks 与非 xStocks 不受影响。
- 钱包、资产详情、转账、确认页、历史与 Swap 报价必须采用同一有效乘数。

## 参考资料

- https://docs.xstocks.fi/developers/multipliers
- https://solana.com/docs/tokens/extensions/scaled-ui-amount
- https://github.com/ton-blockchain/TEPs/blob/master/text/0526-scaled-ui-jettons.md
- https://api.backed.fi/api/v1/token/{SYMBOL}/multiplier?network={NETWORK}

