# Swap Near - 全网络全类型 - Apifox 导入说明

## 文件

| 文件 | 说明 |
|------|------|
| `Swap-Near-全网络全类型-Apifox-TestCases.json` | Near 渠道 `quote -> quoteResultCtx -> build-tx` 跨链集合 |
| `Swap-Near-全网络全类型-导入说明.md` | 本说明 |

## 用例结构

- `01-Near-构建（含 Quote）`
  - `Build+Quote - Near - 跨链全网络全类型`

## 当前规则口径

- provider 固定为 `SwapNear`
- Near 当前只覆盖跨链
- quote 使用普通 `/swap/v1/quote`
- build 依赖 `quoteResultCtx`
- 稳定币金额统一 `100`
- 主币按 `2026-06-03` 市价近似折算 `~100 USD`
- header / locale / theme / build-number 已对齐客户端口径：`6.4.0 / 2026060378 / zh-cn / light / jsbundle 13236892`

## 金额基线

| 场景类型 | 默认金额 |
|------|------|
| ETH | `0.053` |
| BTC | `0.001` |
| NEAR | `38` |
| DOGE | `500` |
| XRP | `45` |
| SOL | `1.34` |
| TRX | `370` |
| USDC / USDT | `100` |

## 集合变量

| 变量 | 默认值 |
|------|--------|
| `requestId` | `{{$guid}}` |
| `baseUrl` | `https://swap.onekeytest.com` |
| `userAddressNear` | `d7be27229b157122eae4e1329fabe67272dcb4ba186378f5f788f245cc1c10d2` |
| `userAddressXrp` | `r9D1JTDPkWTZ9qfezpALSi2aiTytQ58Zy6` |
| `userAddressDoge` | `D5UJ81u33vJBco3fMZxpaHrSrbwCyMejcY` |

## 导入步骤

1. Apifox -> 设置 -> 导入数据
2. 选择 **Postman Collection v2**
3. 上传 `Swap-Near-全网络全类型-Apifox-TestCases.json`

## 执行前必看

1. 先确认 `swap-network-features.md` 中地址基线与 collection 变量一致
2. `Near / XRP / DOGE` 默认填的是项目中已有的有效样例地址，真正执行前建议替换成你自己的测试钱包地址
3. Near 的 build 阶段如果缺少 `quoteResultCtx`，很容易直接落到通用 `500`；不要把它当成 provider 不支持
4. 当前 collection 将 `build.code=0 / 20033 / 20699` 视为“已到业务层”的可接受结果：
   - `0`：构建成功
   - `20033`：报价不可用，请刷新后重试
   - `20699`：余额不足以支付网络费用
5. 如果后续拿到客户端成功 curl，优先再按真实请求口径升级 Near collection
