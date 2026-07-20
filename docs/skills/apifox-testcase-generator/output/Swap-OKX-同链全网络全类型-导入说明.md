# Swap OKX - 同链全网络全类型 - Apifox 导入说明

## 文件

| 文件 | 说明 |
|------|------|
| `Swap-OKX-同链全网络全类型-Apifox-TestCases.json` | OKX 同链成功集（quote + build） |
| `Swap-OKX-同链全网络全类型-导入说明.md` | 本说明 |

## 用例结构

- `01-OKX-构建（含 Quote）`
- `Build+Quote - OKX - 主币->代币`
- `Build+Quote - OKX - 代币->主币`
- `Build+Quote - OKX - 代币->代币`

## 当前规则口径

- provider 固定为 `SwapOKX`
- quote 使用普通 `/swap/v1/quote`
- build **不带** `quoteResultCtx`
- 非 SUI 路由当前直接断言 `build.code=0`
- SUI 路由当前接受 `build.code=0 / 20505`，其中 `20505` 代表 `流动性不足` 的业务层兜底
- header / locale / theme / build-number 已对齐客户端口径：`6.4.0 / 2026060378 / zh-cn / light / jsbundle 13236892`

## 金额基线

| 场景类型 | 默认金额 |
|------|------|
| ETH 系 | `0.053` |
| BNB | `0.156` |
| POL | `100`（token->native） |
| AVAX | `100`（token->token） |
| FTM | `100`（token->token） |
| SOL | `1.34` |
| TON | `50` |
| SUI | `120` |
| SONIC | `100`（token->native） |
| OKB | `1.3` |
| USDC / USDT / USDB | `100` |

## 已纳入成功集的同链路由

### 主币 -> 代币

- Ethereum `ETH -> USDC`
- BSC `BNB -> USDC`
- zkSync Era `ETH -> USDC`
- Base `ETH -> USDC`
- Solana `SOL -> USDC`
- TON `TON -> USDT`
- SUI `SUI -> USDC`
- Scroll `ETH -> USDC`
- Blast `ETH -> USDB`
- X Layer `OKB -> USDC`

### 代币 -> 主币

- Arbitrum `USDC -> ETH`
- Polygon `USDC -> POL`
- Sonic `USDC -> SONIC`

### 代币 -> 代币

- Optimism `USDC -> USDT`
- Avalanche `USDC -> USDT`
- Fantom `USDC -> fUSDT`
- Linea `USDC -> USDT`

## 集合变量

| 变量 | 默认值 |
|------|--------|
| `requestId` | `{{$guid}}` |
| `baseUrl` | `https://swap.onekeytest.com` |
| `userAddressEvm` | `0x99f2c780ffCF94f6Fb5B8C38c6cFaE7E12b0d0B0` |
| `userAddressSol` | `5UCR1u65cKhcJCnuaRxXy9zFYXnRBZ9ArYmGah6sEB52` |
| `userAddressTon` | `UQADRchuTBUsiEEtGow4z9Uc33l4dz0nhuNz-7S_8jwCE7oP` |
| `userAddressSui` | `0xe9f30f8341a465e854063ea7ae4d94ad1403164d37b0c72839e952b313d3db29` |
| `token_USDB_evm_81457` | `0x4300000000000000000000000000000000000003` |
| `token_USDC_evm_196` | `0x74b7f16337b8972027f6196a17a631ac6de26d22` |

## 导入步骤

1. Apifox -> 设置 -> 导入数据
2. 选择 **Postman Collection v2**
3. 上传 `Swap-OKX-同链全网络全类型-Apifox-TestCases.json`

## 执行前必看

1. 先确认 `swap-network-features.md` 中地址基线与 collection 变量一致。
2. TON / Solana / SUI 默认填的是项目中的有效样例地址，真正执行前建议替换成你自己的测试钱包地址。
3. OKX 当前成功集只维护同链路由，不在本集合中混入跨链 case。
4. Blast 当前成功稳定币基线是 `USDB`，不要手动改回 `USDC / USDT`。
5. X Layer 当前主币是 `OKB`，稳定币基线为 `0x74b7f16337b8972027f6196a17a631ac6de26d22`，quote 返回符号为 `USDC`。
6. SUI 路由若返回 `20505 / 流动性不足`，说明请求已经进入业务层，当前按可接受兜底处理；不要误判成 `quoteResultCtx` 缺失或 provider 不支持。

