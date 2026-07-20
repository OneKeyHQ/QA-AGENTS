# Swap Swft - 全网络全类型 - Apifox 导入说明

## 文件

| 文件 | 说明 |
|------|------|
| `Swap-Swft-全网络全类型-Apifox-TestCases.json` | Swft 渠道 `quote -> quoteResultCtx -> build-tx` 成功集 |
| `Swap-Swft-全网络全类型-导入说明.md` | 本说明 |

## 用例结构

- `01-Swft-构建（含 Quote）`
  - `Build+Quote - Swft - 全网络全类型`

## 当前规则口径

- provider 固定为 `SwapSwft`
- quote 使用普通 `/swap/v1/quote`
- build 必带 `quoteResultCtx`
- 当前成功集 build 断言分两档：`code=0` 视为下单成功；`code=20344` 视为命中服务端限频兜底（参数已到业务层，不再按参数错误判失败）
- 稳定币金额统一 `100`
- 主币按 `2026-06-03` 市价近似折算 `~100 USD`
- header / locale / theme / build-number 已对齐客户端口径：`6.4.0 / 2026060378 / zh-cn / light / jsbundle 13236892`

## 金额基线

| 场景类型 | 默认金额 |
|------|------|
| ETH 系 | `0.053` |
| POL | `1070` |
| AVAX | `12.1` |
| SOL | `1.34` |
| NEAR | `38` |
| DOGE | `1000` |
| LTC | `2.07` |
| BCH | `0.4` |
| TON | `50` |
| SUI | `120` |
| TRX | `300` |
| BTC | `0.0015` |
| USDC / USDT | `100` |

## 已纳入成功集的路由

### 同链

- Tron `TRX -> USDT`
- Tron `USDT -> TRX`
- TON `TON -> USDT`
- TON `USDT -> TON`
- SUI `SUI -> USDC`
- SUI `USDC -> SUI`

### 跨链

- Ethereum -> BSC `ETH -> BNB`
- Polygon -> Ethereum `POL -> USDC`
- Avalanche -> Ethereum `AVAX -> USDC`
- Arbitrum -> Optimism `USDC -> ETH`
- BSC -> Avalanche `USDT -> USDC`
- Solana -> Ethereum `SOL -> USDC`
- Near -> BSC `NEAR -> USDT`
- DOGE -> Tron `DOGE -> TRX`
- LTC -> Ethereum `LTC -> ETH`
- BCH -> Base `BCH -> USDC`
- TON -> Ethereum `TON -> ETH`
- SUI -> Ethereum `SUI -> ETH`
- BTC -> Ethereum `BTC -> ETH`

## 集合变量

| 变量 | 默认值 |
|------|--------|
| `requestId` | `{{$guid}}` |
| `baseUrl` | `https://swap.onekeytest.com` |
| `userAddressTon` | `UQADRchuTBUsiEEtGow4z9Uc33l4dz0nhuNz-7S_8jwCE7oP` |
| `userAddressNear` | `d7be27229b157122eae4e1329fabe67272dcb4ba186378f5f788f245cc1c10d2` |
| `userAddressDoge` | `D5UJ81u33vJBco3fMZxpaHrSrbwCyMejcY` |
| `userAddressLtc` | `MBoxoVnga39ghJfLRQEXewjCWxLE6LemMX` |
| `userAddressBch` | `bitcoincash:qzlelz2un33x98kda026zt882msk3xz9sq0e778p7z` |
| `token_USDT_ton_mainnet` | `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs` |
| `token_USDC_sui_0` | `0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC` |

## 导入步骤

1. Apifox -> 设置 -> 导入数据
2. 选择 **Postman Collection v2**
3. 上传 `Swap-Swft-全网络全类型-Apifox-TestCases.json`

## 执行前必看

1. 先确认 `swap-network-features.md` 中地址基线与 collection 变量一致。
2. `TON / Near / DOGE / LTC / BCH` 默认填的是项目中的有效样例地址，真正执行前建议替换成你自己的测试钱包地址。
3. TON 的 `networkId` 必须使用 `ton--mainnet`；`ton--0 / ton--1 / ton--239` 当前不会稳定命中 `SwapSwft`。
4. SUI 主币路径当前按 `sui--mainnet + 0x2::sui::SUI` 生成；SUI 同链 `USDC -> USDT` 虽可返回 provider 元信息，但当前不返回有效 `toAmount / quoteResultCtx`，不要混入成功集。
5. Swft 的 `build-tx` 在 Apifox 批量连续跑时容易触发服务端限频，返回 `code=20344 / 操作频繁，请稍后再试`。这并不表示 `quoteResultCtx` 或 body 错误，而是下单过快；本集合已将其视为可接受的限频兜底结果。
6. 用户提供的客户端成功 curl 已验证：`SwapSwft` 的 build body 结构本身是对的，`quoteResultCtx` 只需携带 `swftQuoteResultCtx.quoteFromAmount / quoteToAmount` 即可；如果你想手动验证 `code=0`，建议单独执行 1 条路由，不要在同一轮里连续批量下单。
7. Aptos 虽在渠道声明支持清单内，但 `2026-06-03` 对 `Aptos -> Ethereum APT -> ETH` 与 `Ethereum -> Aptos ETH -> APT` 两组路由实探均未命中 `SwapSwft`，因此当前 collection **不包含 Aptos 成功用例**。如果后续拿到客户端成功 curl，再单独回填。
