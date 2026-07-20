# Swap 0x - 同链全网络全类型 - Apifox 导入说明

## 文件

| 文件 | 说明 |
|------|------|
| `Swap-0x-全网络全类型-Apifox-TestCases.json` | 0x 渠道 `quote -> build-tx` 同链成功集 |
| `Swap-0x-全网络全类型-导入说明.md` | 本说明 |

## 用例结构

- `01-0x-构建（含 Quote）`
- `Build+Quote - 0x - 主币->代币成功集`
- `Build+Quote - 0x - 代币->主币成功集`
- `Build+Quote - 0x - 代币->代币成功集`

## 当前规则口径

- 0x 当前按**同链聚合器**处理
- quote 使用普通 `/swap/v1/quote` JSON 接口
- build **不需要** `quoteResultCtx`
- 每条用例在后置脚本中串行执行：`quote -> 提取 0x 条目 -> build-tx`
- build 关键断言：`code=0` 且 `data.tx` 存在
- header / locale / theme / build-number 已对齐客户端成功口径：`6.4.0 / 2026060380 / 13293249 / en / light`
- 当前已验证成功网络：`Ethereum、Arbitrum、Optimism、BSC、Polygon、Avalanche、Base`

## 当前金额基线

| 场景 | 金额 |
|------|------|
| Ethereum ETH -> USDC | `0.055887` |
| Arbitrum ETH -> USDC | `0.056032` |
| Optimism ETH -> USDC | `0.056058` |
| BSC BNB -> USDC | `0.16592` |
| Polygon MATIC -> USDC | `1092.11` |
| Avalanche AVAX -> USDC | `12.6775` |
| Base ETH -> USDC | `0.056109` |
| 所有 USDC -> 主币 / USDC -> USDT | `100` |

## 集合变量

- `requestId`：`{{$guid}}`
- `baseUrl`：`https://swap.onekeytest.com`
- `userAddressEvm`：`0x99f2c780ffCF94f6Fb5B8C38c6cFaE7E12b0d0B0`
- 其余 `token_USDC_* / token_USDT_*` 变量默认取自 `docs/qa/rules/swap-network-features.md`

## 导入步骤

1. Apifox -> 设置 -> 导入数据
2. 选择 **Postman Collection v2**
3. 上传 `Swap-0x-全网络全类型-Apifox-TestCases.json`

## 注意事项

- 0x 本轮 7 条同链网络都已实探通过 `quote + build`
- Apifox Tests 脚本里的 `{{变量}}` 不会自动展开到 `pm.sendRequest`，当前版本已改为显式读取 collection 变量
