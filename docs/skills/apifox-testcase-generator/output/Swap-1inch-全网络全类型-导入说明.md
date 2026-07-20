# Swap 1inch - 同链全网络全类型 - Apifox 导入说明

## 文件

| 文件 | 说明 |
|------|------|
| `Swap-1inch-全网络全类型-Apifox-TestCases.json` | 1inch 渠道 `quote -> build-tx` 同链成功集 |
| `Swap-1inch-全网络全类型-导入说明.md` | 本说明 |

## 用例结构

- `01-1inch-构建（含 Quote）`
- `Build+Quote - 1inch - 主币->代币成功集`
- `Build+Quote - 1inch - 代币->主币成功集`
- `Build+Quote - 1inch - 代币->代币成功集`

## 当前规则口径

- 1inch 当前按**同链聚合器**处理
- quote 使用普通 `/swap/v1/quote` JSON 接口
- build **不需要** `quoteResultCtx`
- 每条用例在后置脚本中串行执行：`quote -> 提取 1inch 条目 -> build-tx`
- build 关键断言：`code=0` 且 `data.tx` 存在
- header / locale / theme / build-number 已对齐客户端成功口径：`6.4.0 / 2026060380 / 13293249 / en / light`
- 当前已验证成功网络：`Ethereum、Arbitrum、Optimism、BSC、Polygon、Avalanche、zkSync Era、Base`
- `Fantom` 虽在用户支持清单中，但本轮在当前 header + 地址基线下未命中 `Swap1inch`，因此暂不纳入成功集

## 当前金额基线

| 场景 | 金额 |
|------|------|
| Ethereum ETH -> USDC | `0.055953` |
| Arbitrum ETH -> USDC | `0.056032` |
| Optimism ETH -> USDC | `0.05608` |
| BSC BNB -> USDC | `0.165929` |
| Polygon MATIC -> USDC | `1095.94` |
| Avalanche AVAX -> USDC | `12.6629` |
| zkSync Era ETH -> USDC | `0.056257` |
| Base ETH -> USDC | `0.055952` |
| 所有 USDC -> 主币 / USDC -> USDT | `100` |

## 集合变量

- `requestId`：`{{$guid}}`
- `baseUrl`：`https://swap.onekeytest.com`
- `userAddressEvm`：`0x99f2c780ffCF94f6Fb5B8C38c6cFaE7E12b0d0B0`
- 其余 `token_USDC_* / token_USDT_*` 变量默认取自 `docs/qa/rules/swap-network-features.md`

## 导入步骤

1. Apifox -> 设置 -> 导入数据
2. 选择 **Postman Collection v2**
3. 上传 `Swap-1inch-全网络全类型-Apifox-TestCases.json`

## 注意事项

- 文件名保留了“全网络全类型”历史命名，但当前成功集**不包含 Fantom**
- 如果后续客户端在 Fantom 上有成功 curl，请先回填成功参数再扩进 collection
- Apifox Tests 脚本里的 `{{变量}}` 不会自动展开到 `pm.sendRequest`，当前版本已改为显式读取 collection 变量
