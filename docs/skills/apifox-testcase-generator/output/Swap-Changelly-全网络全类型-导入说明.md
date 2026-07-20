# Swap Changelly - 全网络全类型 - Apifox 导入说明

## 文件

| 文件 | 说明 |
|------|------|
| `Swap-Changelly-全网络全类型-Apifox-TestCases.json` | Changelly 渠道 `quote -> quoteResultCtx -> build-tx` 成功集 |
| `Swap-Changelly-全网络全类型-导入说明.md` | 本说明 |

## 用例结构

- `01-Changelly-构建（含 Quote）`
  - `Build+Quote - Changelly - 全网络全类型`

## 当前规则口径

- provider 固定为 `SwapChangelly`
- quote 使用普通 `/swap/v1/quote`
- build 必带 `quoteResultCtx`
- 当前成功集 build 直接断言 `code=0`
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
| NEAR | `34` |
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
- Solana `SOL -> USDC`
- Solana `USDC -> SOL`
- Solana `USDC -> USDT`
- TON `TON -> USDT`
- TON `USDT -> TON`

### 跨链

- Ethereum -> BSC `ETH -> BNB`
- Polygon -> Ethereum `POL -> USDC`
- Avalanche -> Ethereum `AVAX -> USDC`
- Arbitrum -> Optimism `USDC -> ETH`
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
| `userAddressTronChangelly` | `TTZMu9v3cxs3dGhoUABBmE672MN8hsNfb8` |
| `userAddressTon` | `UQADRchuTBUsiEEtGow4z9Uc33l4dz0nhuNz-7S_8jwCE7oP` |
| `userAddressNear` | `d7be27229b157122eae4e1329fabe67272dcb4ba186378f5f788f245cc1c10d2` |
| `userAddressDoge` | `D5UJ81u33vJBco3fMZxpaHrSrbwCyMejcY` |
| `userAddressLtc` | `MBoxoVnga39ghJfLRQEXewjCWxLE6LemMX` |
| `userAddressBch` | `bitcoincash:qzlelz2un33x98kda026zt882msk3xz9sq0e778p7z` |
| `token_USDT_ton_mainnet` | `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs` |

## 导入步骤

1. Apifox -> 设置 -> 导入数据
2. 选择 **Postman Collection v2**
3. 上传 `Swap-Changelly-全网络全类型-Apifox-TestCases.json`

## 执行前必看

1. 先确认 `swap-network-features.md` 中地址基线与 collection 变量一致。
2. `TON / Near / DOGE / LTC / BCH` 默认填的是项目中的有效样例地址，真正执行前建议替换成你自己的测试钱包地址。
3. TON 相关路由当前沿用 ChangeHero 成功集口径，使用 `networkId=ton--mainnet`。
4. Changelly 的 `Tron` 目标链 build 当前对地址敏感：项目旧样例地址 `TPJkcqRHFfuE2xfgVzs6AA6tbJowz9pmH1` 在 `TRX -> USDT`、`USDT -> TRX`、`DOGE -> TRX` 三条路由上会返回 `code=20010 / 不支持该交易对`；本集合已改为默认使用实探可过的 `userAddressTronChangelly=TTZMu9v3cxs3dGhoUABBmE672MN8hsNfb8`。
5. Tron 同链当前沿用 ChangeHero 成功集口径，只保留 `TRX <-> USDT`；不要把 `TRX <-> USDC`、`USDT -> USDC`、`USDC -> TRX` 直接加回成功集。
6. 这版 Changelly collection 除 Tron 地址口径外，其他路由仍按用户确认镜像 ChangeHero 成功集；Aptos 继续沿用“暂不写入成功用例”的口径。若后续拿到更多 Changelly 客户端成功 curl，再单独回填。
