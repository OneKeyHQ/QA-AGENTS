# Swap Jupiter - Solana 单网络全类型 - Apifox 导入说明

## 文件

| 文件 | 说明 |
|------|------|
| `Swap-Jupiter-全网络全类型-Apifox-TestCases.json` | Jupiter 渠道 `quote -> quoteResultCtx -> build-tx` 集合；实际覆盖 **Solana 单网络同链** |
| `Swap-Jupiter-全网络全类型-导入说明.md` | 本说明 |

## 用例结构

- **01-Jupiter-构建（含 Quote）**（3 条）
  - `Build+Quote - Jupiter - 主币<>代币 (SOL → USDC)`
  - `Build+Quote - Jupiter - 代币<>主币 (USDC → SOL)`
  - `Build+Quote - Jupiter - 代币<>代币 (USDC → USDT)`

## 当前规则口径

- Jupiter **仅支持 Solana 同链**
- Jupiter 构建 **依赖 `quoteResultCtx`**
- 每条用例在后置脚本中串行执行：`quote -> 提取 Jupiter 条目 -> 提取 quoteResultCtx -> build-tx`
- `build-tx` 的关键断言是 **返回 `data.tx`**
- Solana 主币 `SOL` 在请求里使用**空字符串**作为 `fromTokenAddress` / `toTokenAddress`
- 代币地址与账户地址基线来自 `docs/qa/rules/swap-network-features.md`

## 集合变量

| 变量 | 默认值 |
|------|--------|
| `requestId` | `{{$guid}}` |
| `baseUrl` | `https://swap.onekeytest.com` |
| `userAddressSolana` | `5UCR1u65cKhcJCnuaRxXy9zFYXnRBZ9ArYmGah6sEB52` |

## 如何维护参数

直接修改 `Swap-Jupiter-全网络全类型-Apifox-TestCases.json`：

1. 打开对应请求项
2. 改 `event` -> `listen: "test"` -> `script.exec` 里的 `testCases` 数组
3. 重点关注以下字段：
   - `quoteParams`
   - `buildBase`
   - `fromTokenAddress`
   - `toTokenAddress`
   - `fromTokenAmount`
   - `fromNetworkId`
   - `toNetworkId`
   - `userAddress`
   - `receivingAddress`
   - `provider`

## 导入步骤

1. Apifox → 设置 → 导入数据
2. 选择 **Postman Collection v2**
3. 上传 `Swap-Jupiter-全网络全类型-Apifox-TestCases.json`

## 注意事项

- 文件名保留了“全网络全类型”历史命名，但内容按当前规则只覆盖 **Jupiter / Solana / 同链**
- 若后续 `swap-network-features.md` 中 Solana 地址基线更新，这份集合需要同步更新
- 若后端变更了 Jupiter 构建参数结构，优先回归 `Build+Quote - Jupiter -*` 三条，并确认 `quoteResultCtx` 与 `data.tx` 断言仍成立
