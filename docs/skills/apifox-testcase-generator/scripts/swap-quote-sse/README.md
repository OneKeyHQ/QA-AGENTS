# Swap 各渠道 SSE 询价测试脚本

按 `docs/qa/rules/swap-rules.md` 渠道网络支持矩阵生成的 SSE 询价测试脚本。

## 文件说明

| 文件 | 渠道 | 支持网络 | 用例数 |
|------|------|----------|--------|
| `0x.js` | 0x | Ethereum、Polygon、Arbitrum、Avalanche、BSC、Optimism、Base | 7 |
| `1inch.js` | 1inch | 同上 + zkSync Era | 8 |
| `jupiter.js` | Jupiter | Solana | 1 |
| `cowswap.js` | CowSwap | Ethereum、Arbitrum、Base | 3 |
| `okx.js` | OKX | Ethereum、Polygon、Arbitrum、BSC、Base、Solana | 6 |
| `panora.js` | Panora | Aptos | 1 |

## 使用方式

1. 在 Postman 或 Apifox 中新建一个 **GET** 请求，URL 可随意（脚本会自行构建）
2. 打开 **Tests** 标签
3. 将对应渠道的 `.js` 文件内容**完整复制**粘贴到 Tests 脚本中
4. 发送请求（或使用 Collection Runner 批量执行）

## 接口说明

- **端点**：`https://swap.onekeytest.com/swap/v1/quote/events`
- **协议**：SSE（Server-Sent Events）
- **断言**：每个用例会校验 HTTP 200，以及 SSE 流中是否存在 `info.provider` 匹配该渠道

## Provider 断言值

若 API 返回的 `info.provider` 格式与脚本中 `PROVIDER_ASSERT` 不一致，请修改各脚本顶部的常量：

| 渠道 | 默认断言值（统一写法） | 备选 |
|------|------------------------|------|
| 0x | Swap0x | 0x |
| 1inch | Swap1inch | 1inch |
| Jupiter | SwapJupiter | Jupiter, jupiter |
| CowSwap | CowSwap | CoWSwap, cowswap |
| OKX | SwapOKX | OKX, okx |
| Panora | SwapPanora | Panora, panora |

**规则**：provider 统一为「Swap + 渠道名」首字母大写，如 Swap0x、Swap1inch、SwapJupiter、CowSwap、SwapOKX、SwapPanora。

脚本内 `matchProvider` 已支持大小写不敏感的子串匹配，通常无需修改。

## 环境变量（可选）

- 可将 `BASE_URL` 改为环境变量，如 `pm.environment.get("swap_base_url") || "https://swap.onekeytest.com/swap/v1/quote/events"`
