# 交易解析 API 测试用例导入说明

## 文件信息

| 项目 | 内容 |
|------|------|
| **集合名称** | 交易解析 API 测试用例 |
| **生成日期** | 2026-02-02 |
| **用例数量** | 38 个 |
| **接口路径** | POST /wallet/v1/account/parse-transaction |

## 用例分组结构

```
交易解析 (38)
├── EVM 链 - 首次转账地址 (11)
│   ├── ETH - 主币转账首次转账地址
│   ├── ETH - 代币转账首次转账地址
│   ├── ETH testnet - 代币转账首次转账地址
│   ├── ETH CLASSIC - 主币转账首次转账地址
│   ├── Polygon - 主币转账首次转账地址
│   ├── Polygon - NFT首次转账地址（ERC721）
│   ├── Polygon - NFT首次转账地址（ERC1155）
│   ├── Arbitrum - 主币转账首次转账地址
│   ├── Optimism - 主币转账首次转账地址
│   ├── BSC - 主币转账首次转账地址
│   └── Avalanche - 主币转账首次转账地址
├── UTXO 链 - 首次转账地址 (4)
│   ├── BTC - 首次转账地址
│   ├── LTC - 首次转账地址
│   ├── BCH - 首次转账地址
│   └── Doge - 首次转账地址
├── EVM 链 - 已转账过地址 (5)
│   ├── ETH - 主币转账已转账过地址
│   ├── Polygon - 代币转账已转账过地址
│   ├── Polygon - 主币转账已转账过地址
│   ├── Polygon - NFT已转账过地址（ERC721）
│   └── Polygon - NFT已转账过地址（ERC1155）
├── UTXO 链 - 已转账过地址 (4)
│   ├── BTC - 已转账过地址
│   ├── LTC - 已转账过地址
│   ├── BCH - 已转账过地址
│   └── Doge - 已转账过地址
├── 诈骗地址 (4)
│   ├── ETH - 主币转账诈骗地址
│   ├── Optimism - 主币转账诈骗地址
│   ├── Polygon - 代币转账诈骗地址
│   └── BSC - 主币转账诈骗地址
├── 合约地址 (3)
│   ├── ETH - 转账到合约地址 (USDT)
│   ├── ETH - 转账到合约地址 (Uniswap Router)
│   └── ETH - 合约交互 (1inch Swap)
└── 交易所标签地址 (4)
    ├── ETH - 转账到 Binance 热钱包
    ├── ETH - 转账到 Coinbase 地址
    ├── ETH - 转账到 OKX 地址
    └── ETH - 转账到 Kraken 地址
```

## 测试维度说明

### 1. 地址状态维度

| 状态 | 说明 | 预期结果 |
|------|------|----------|
| 首次转账 | 从未向该地址转账过 | 无 `Transferred` 标签 |
| 已转账过 | 历史有过转账记录 | 显示 `Transferred` 或 `Interacted before` 标签 |

### 2. 风险识别维度

| 类型 | 说明 | 预期结果 |
|------|------|----------|
| 诈骗地址 | 已知的钓鱼/诈骗地址 | `riskLevel > 0`，显示风险警告 |
| 合约地址 | 智能合约地址 | `isContract: true`，显示合约名称 |
| 交易所地址 | 中心化交易所热钱包 | 显示交易所名称标签 |

### 3. 网络覆盖

| 网络类型 | 覆盖链 |
|----------|--------|
| EVM 主网 | ETH, Polygon, Arbitrum, Optimism, BSC, Avalanche |
| EVM 测试网 | Sepolia |
| EVM 其他 | ETH Classic |
| UTXO | BTC, LTC, BCH, Doge |

### 4. 资产类型

| 类型 | 测试场景 |
|------|----------|
| 主币 | ETH, MATIC, BNB 等原生代币转账 |
| 代币 | ERC20 代币转账 (USDT, USDC) |
| NFT | ERC721/ERC1155 转账 |

## 请求体格式

```json
{
  "networkId": "evm--1",
  "accountAddress": "0x...",
  "encodedTx": {
    "to": "0x...",
    "data": "0x...",
    "value": "0x..."
  }
}
```

## 网络 ID 对照表

| 网络 | networkId |
|------|-----------|
| Ethereum | `evm--1` |
| Polygon | `evm--137` |
| Arbitrum | `evm--42161` |
| Optimism | `evm--10` |
| BSC | `evm--56` |
| Avalanche | `evm--43114` |
| ETH Classic | `evm--61` |
| Sepolia | `evm--11155111` |
| BTC | `btc--0` |
| LTC | `ltc--0` |
| BCH | `bch--0` |
| Doge | `doge--0` |

## 测试地址说明

### 交易所地址

| 交易所 | 地址 |
|--------|------|
| Binance | `0x28C6c06298d514Db089934071355E5743bf21d60` |
| Coinbase | `0x71660c4005BA85c37ccec55d0C4493E66Fe775d3` |
| OKX | `0x6cC5F688a315f3dC28A7781717a9A798a59fDA7b` |
| Kraken | `0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2` |

### 合约地址

| 合约 | 地址 |
|------|------|
| USDT (ETH) | `0xdac17f958d2ee523a2206206994597c13d831ec7` |
| Uniswap Router V2 | `0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D` |
| 1inch Router | `0x1111111254eeb25477b68fb85ed929f73a960582` |
| OpenSea (Polygon) | `0x2953399124F0cBB46d2CbACD8A89cF0599974963` |

### 诈骗地址示例

| 用途 | 地址 |
|------|------|
| 已知诈骗地址 | `0x00000000A991C429eE2Ec6df19d40fe0c80088B8` |

## 断言验证点

### 通用断言

- HTTP 状态码 200
- 响应时间 < 3000ms
- 业务状态码 `code = 0`

### 地址状态断言

| 场景 | 验证点 |
|------|--------|
| 首次转账 | `tags` 包含 `Initial Transfer` 标签 |
| 已转账过 | `tags` 包含 `Transferred` 或 `Interacted before` 标签 |
| 交易所地址 | `tags` 包含交易所名称标签（如 `Binance`、`Coinbase`、`OKX`、`Kraken`） |

### 多标签场景

一个请求可能触发多个条件，返回多个标签。例如：
- 首次转账到交易所地址 → 同时显示 `Initial Transfer` + `Binance` 标签
- 已转账过的交易所地址 → 同时显示 `Transferred` + `Coinbase` 标签

断言中使用 `console.log('All tags:', JSON.stringify(addressComp.tags))` 记录所有返回的标签，便于调试和验证。

### 风险识别断言

| 场景 | 验证点 |
|------|--------|
| 诈骗地址 | `parsedTx.to.riskLevel > 0` |
| 合约地址 | `parsedTx.to.isContract = true` |
| 交易所地址 | `tags` 包含交易所名称 |

## 导入步骤

### 方式一：导入到 Apifox

1. 打开 Apifox → 选择目标项目
2. 点击 **设置** → **导入数据**
3. 选择 **Postman** 格式
4. 上传 `Transaction-Parse-Apifox-TestCases.json`
5. 确认导入

### 方式二：导入到 Postman

1. 打开 Postman
2. 点击 **Import**
3. 选择 JSON 文件
4. 确认导入

## 执行建议

1. **按分组执行**：首次转账 → 已转账过 → 诈骗地址 → 合约地址 → 交易所标签
2. **多链验证**：确保 EVM 和 UTXO 链都能正常解析
3. **关注风险提示**：重点验证诈骗地址的风险等级和警告信息
4. **标签识别**：验证交易所、合约名称等标签是否正确显示

## 相关文档

- [交易解析 API 文档](https://api.onekey.so/docs)
- [EIP-712 签名解析](./Transaction-Parse-EIP712.md)
