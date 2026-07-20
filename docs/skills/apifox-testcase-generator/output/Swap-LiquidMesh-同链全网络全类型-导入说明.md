# Swap LiquidMesh - 同链全网络全类型 - Apifox 导入说明

## 文件

| 文件 | 说明 |
|------|------|
| `Swap-LiquidMesh-同链全网络全类型-Apifox-TestCases.json` | LiquidMesh 同链成功集（quote + build） |
| `Swap-LiquidMesh-同链全网络全类型-导入说明.md` | 本说明 |

## 用例结构

- `01-LiquidMesh-构建（含 Quote）`
- `Build+Quote - LiquidMesh - 同链成功集`

## 当前规则口径

- provider 固定为 `SwapLiquidMesh`
- quote 使用普通 `/swap/v1/quote`
- build **必须带** `quoteResultCtx.liquidMeshQuoteResultCtx`
- 当前成功集 build 直接断言 `code=0`
- header / locale / theme / build-number 已对齐客户端口径：`6.4.0 / 2026060378 / zh-cn / light / jsbundle 13236892`

## 金额基线

| 场景类型 | 默认金额 |
|------|------|
| ETH | `0.053` |
| BNB / SONIC | `100`（代币源路由） |
| SOL | `0.2` |
| USDC / USDT | `100` |

## 已纳入成功集的同链路由

- Ethereum `ETH -> USDC`
- BSC `USDC -> BNB`
- Base `USDC -> USDT`
- Solana `SOL -> USDC`
- Sonic `USDC -> SONIC`

## 声明支持但当前未纳入成功集的网络

- Tron：当前实探 `TRX -> USDT`、`USDT -> TRX`、`TRX -> USDC`、`USDT -> USDC` 都未命中 `SwapLiquidMesh`
- SUI：当前实探 `SUI -> USDC`、`SUI -> USDT`、`USDC -> SUI`、`USDC -> USDT` 都未命中 `SwapLiquidMesh`

## 集合变量

| 变量 | 默认值 |
|------|--------|
| `requestId` | `{{$guid}}` |
| `baseUrl` | `https://swap.onekeytest.com` |
| `userAddressEvm` | `0x99f2c780ffCF94f6Fb5B8C38c6cFaE7E12b0d0B0` |
| `userAddressSol` | `5UCR1u65cKhcJCnuaRxXy9zFYXnRBZ9ArYmGah6sEB52` |
| `userAddressTron` | `TTZMu9v3cxs3dGhoUABBmE672MN8hsNfb8` |
| `userAddressSui` | `0xe9f30f8341a465e854063ea7ae4d94ad1403164d37b0c72839e952b313d3db29` |

## 导入步骤

1. Apifox -> 设置 -> 导入数据
2. 选择 **Postman Collection v2**
3. 上传 `Swap-LiquidMesh-同链全网络全类型-Apifox-TestCases.json`

## 执行前必看

1. 地址和 token 基线统一以 `swap-network-features.md` 为准。
2. 当前 collection 是**已验证成功集**，不是按声明支持矩阵硬铺开的全排列。
3. LiquidMesh 的 build 当前明显依赖 quote 上下文；如果你把 `quoteResultCtx` 去掉，现网会直接回 `500 / 内部服务器错误`。
4. Solana 当前成功集使用 `0.2 SOL -> USDC`。同一地址下 `USDC -> SOL`、`USDC -> USDT` 虽能命中 provider，但 build 当前返回 `20033 / 报价不可用，请刷新后重试`，所以没有混入成功集。
5. 若后续拿到 Tron / SUI 的客户端成功 curl，建议直接按本集合模板补到同一个 CASES 数组里，而不是新起一套 header/body 口径。

