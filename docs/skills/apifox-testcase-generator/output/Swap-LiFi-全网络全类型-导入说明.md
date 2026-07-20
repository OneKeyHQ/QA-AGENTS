# Swap LiFi - 全网络全类型 - Apifox 导入说明

## 文件

| 文件 | 说明 |
|------|------|
| `Swap-LiFi-全网络全类型-Apifox-TestCases.json` | LiFi 渠道 `quote -> quoteResultCtx -> build-tx` 集合 |
| `Swap-LiFi-全网络全类型-导入说明.md` | 本说明 |

## 用例结构

- `01-LiFi-构建（含 Quote）`
  - `Build+Quote - LiFi - 同链全网络全类型`
  - `Build+Quote - LiFi - 跨链全网络全类型`

## 当前规则口径

- provider 固定为 `SwapLifi`
- LiFi 构建依赖 `quoteResultCtx`
- quote 已统一切到 `/swap/v1/quote/events`，并按 SSE `data:` 事件流解析 `SwapLifi` 条目
- 稳定币金额统一 `100`
- 主币按 `2026-06-03` 市价近似折算 `~100 USD`
- header / locale / theme / build-number 已对齐客户端口径：`6.4.0 / 2026060378 / zh-cn / light / jsbundle 13236892`
- collection 可见主请求 header 也已同步到同一客户端基线，便于在 Apifox 界面直接对照

## 集合变量

| 变量 | 默认值 |
|------|--------|
| `requestId` | `{{$guid}}` |
| `baseUrl` | `https://swap.onekeytest.com` |
| `userAddressEvm` | `0x99f2c780ffCF94f6Fb5B8C38c6cFaE7E12b0d0B0` |
| `userAddressSol` | `5UCR1u65cKhcJCnuaRxXy9zFYXnRBZ9ArYmGah6sEB52` |
| `token_USDC_evm_999` | `0xb88339cb7199b77e23db6e890353e22632ba630f` |
| `token_USDT_evm_999` | `0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb` |

## 导入步骤

1. Apifox → 设置 → 导入数据
2. 选择 **Postman Collection v2**
3. 上传 `Swap-LiFi-全网络全类型-Apifox-TestCases.json`

## 执行前必看

1. 先确认 `swap-network-features.md` 中地址基线与 collection 变量一致
2. LiFi collection 中所有 EVM 默认代币地址都按**全小写**维护；如果你手工覆盖变量，也请保持小写，尤其是 Arbitrum / Optimism / Mantle / HyperEVM，否则 LiFi 可能返回 `Provider error` 且不带 `quoteResultCtx`
3. quote 的请求头已贴近客户端；若后续客户端版本升级，优先同步 `build-number / jsbundle / locale / theme`
4. 如果执行日价格波动较大，可按同一原则微调主币金额，但不要把 LiFi 改回其他渠道的旧金额表
