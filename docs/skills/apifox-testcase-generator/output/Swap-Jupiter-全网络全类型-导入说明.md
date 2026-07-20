# Swap Jupiter - Solana 单网络全类型 - Apifox 导入说明

## 文件

| 文件 | 说明 |
|------|------|
| `Swap-Jupiter-全网络全类型-Apifox-TestCases.json` | Jupiter 渠道 `quote/events -> quoteResultCtx -> build-tx` 集合；实际覆盖 **Solana 单网络同链** |
| `Swap-Jupiter-全网络全类型-导入说明.md` | 本说明 |

## 用例结构

- `01-Jupiter-构建（含 Quote）`
- `Build+Quote - Jupiter - 同链成功集`

## 当前规则口径

- Jupiter **仅支持 Solana 同链**
- quote 使用 `/swap/v1/quote/events` SSE
- Jupiter 构建 **依赖** `quoteResultCtx`
- 每条用例在后置脚本中串行执行：`quote/events -> 提取 Jupiter 条目 -> 提取 quoteResultCtx -> build-tx`
- `build-tx` 的关键断言是 **返回 `data.tx`**
- Solana 主币 `SOL` 在请求里使用**空字符串**作为 `fromTokenAddress` / `toTokenAddress`
- header / locale / theme / build-number 已对齐客户端成功口径：`6.4.0 / 2026060380 / 13293249 / en / light`
- Apifox Tests 脚本里的 `{{变量}}` 不会自动展开到 `pm.sendRequest`，当前版本已改为显式读取 collection 变量

## 当前金额基线

| 场景 | 金额 |
|------|------|
| SOL -> USDC | `0.01` |
| USDC -> SOL | `10` |
| USDC -> USDT | `10` |

## 集合变量

| 变量 | 默认值 |
|------|--------|
| `requestId` | `{{$guid}}` |
| `baseUrl` | `https://swap.onekeytest.com` |
| `userAddressSolana` | `5UCR1u65cKhcJCnuaRxXy9zFYXnRBZ9ArYmGah6sEB52` |
| `token_SOL_sol_101` | 空字符串 |
| `token_USDC_sol_101` | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| `token_USDT_sol_101` | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` |

## 如何维护参数

直接修改 `Swap-Jupiter-全网络全类型-Apifox-TestCases.json`：

1. 打开 `event -> listen: "test" -> script.exec`
2. 修改脚本里的 `CASES` 数组
3. 重点关注以下字段：
   - `fromTokenAddress`
   - `toTokenAddress`
   - `fromTokenAmount`
   - `fromNetworkId`
   - `toNetworkId`
   - `userAddress`
   - `receivingAddress`
   - `provider`
   - `quoteResultCtx`

## 导入步骤

1. Apifox -> 设置 -> 导入数据
2. 选择 **Postman Collection v2**
3. 上传 `Swap-Jupiter-全网络全类型-Apifox-TestCases.json`

## 注意事项

- 文件名保留了“全网络全类型”历史命名，但内容按当前规则只覆盖 **Jupiter / Solana / 同链**
- 若后续 `swap-network-features.md` 中 Solana 地址基线更新，这份集合需要同步更新
- 若后端变更了 Jupiter 构建参数结构，优先回归三条当前金额基线，并确认 `quoteResultCtx` 与 `data.tx` 断言仍成立
- 如果再出现 `providers=[]`，优先排查是否把 `{{token_*}} / {{userAddressSolana}}` 之类的占位符直接拼进了 `pm.sendRequest`
