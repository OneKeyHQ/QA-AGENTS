# Swap Panora - Aptos 单网络全类型 - Apifox 导入说明

## 文件

| 文件 | 说明 |
|------|------|
| `Swap-Panora-全网络全类型-Apifox-TestCases.json` | Panora 渠道 `quote/events -> quoteResultCtx -> build-tx` 集合；实际覆盖 **Aptos 单网络同链** |
| `Swap-Panora-全网络全类型-导入说明.md` | 本说明 |

## 用例结构

- `01-Panora-构建（含 Quote）`
- `Build+Quote - Panora - 同链成功集`

## 当前规则口径

- Panora **仅支持 Aptos 同链**
- quote 使用 `/swap/v1/quote/events` SSE
- build **依赖** `quoteResultCtx.panoraQuoteResultCtx`
- 每条用例在后置脚本中串行执行：`quote/events -> 提取 Panora 条目 -> 提取 quoteResultCtx -> build-tx`
- `build-tx` 的关键断言是 **返回 `data.tx`**
- `USDC -> APT` 必须显式把 `toTokenAddress` 写成 `0x1::aptos_coin::AptosCoin`
- 客户端成功 curl 走的是 `/swap/v1/quote/events`，当前 collection 已对齐这条链路
- 这次真正导致失败的不是 Panora 路由本身，而是 Tests 脚本里把 `{{token_*}} / {{userAddressAptos}}` 当普通字符串塞进了 `pm.sendRequest`；Apifox 不会自动替换这些脚本内变量，结果服务端收到字面量大括号后只返回空数据。当前版本已改为显式读取 collection 变量
- header / locale / theme / build-number 已对齐客户端成功口径：`6.4.0 / 2026060380 / 13293249 / en / light`

## 当前金额基线

| 场景 | 金额 |
|------|------|
| APT -> USDC | `1` |
| USDC -> APT | `1` |
| USDC -> USDT | `100` |

## 集合变量

| 变量 | 默认值 |
|------|--------|
| `requestId` | `{{$guid}}` |
| `baseUrl` | `https://swap.onekeytest.com` |
| `userAddressAptos` | `0x1b8e3ea235b70deb8317fa5a81b9908873c19619598895291e557564eb71b6cc` |
| `token_APT_aptos_1` | `0x1::aptos_coin::AptosCoin` |
| `token_USDC_aptos_1` | `0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b` |
| `token_USDT_aptos_1` | `0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b` |

## 导入步骤

1. Apifox -> 设置 -> 导入数据
2. 选择 **Postman Collection v2**
3. 上传 `Swap-Panora-全网络全类型-Apifox-TestCases.json`

## 注意事项

- 文件名保留了“全网络全类型”历史命名，但内容按当前规则只覆盖 **Panora / Aptos / 同链**
- Panora 现在不能再按“普通 `/quote` + 无 `quoteResultCtx` build”那套旧口径执行，否则会把成功单测误判成失败
- 如果后续再看到 `providers=[]` 且 `raw={"code":0,"message":"Success","data":[]}`，优先排查脚本里是否又把 `{{...}}` 变量直接拼进了 `pm.sendRequest`
- 当前 collection 对齐的是你提供的桌面端成功 curl；若客户端继续升级，优先回归 `build-number / jsbundle / locale` 这组头部基线
