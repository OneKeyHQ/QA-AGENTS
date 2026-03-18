# Swap 0x - 按兑换类型（网络为变量）- Apifox 导入说明

## 文件

| 文件 | 说明 |
|------|------|
| `Swap-0x-全网络全类型-Apifox-TestCases.json` | 0x 询价 + 构建，按兑换类型 3+3 条，网络在脚本内 testCases 维护 |
| `Swap-0x-全网络全类型-导入说明.md` | 本说明 |

## 用例结构（以兑换类型为维度）

- **01-0x-询价**（3 条）
  - `Quote - 0x - 主币<>代币`：脚本内 `testCases` 覆盖 Ethereum、Avalanche、BSC、Base、Polygon、Arbitrum、Optimism
  - `Quote - 0x - 代币<>主币`
  - `Quote - 0x - 代币<>代币`
- **02-0x-构建**（3 条）
  - `Build - 0x - 主币<>代币` / 代币<>主币 / 代币<>代币（同上，每条内多网络循环）

每条用例的 **Test 脚本** 里包含 `const testCases = [ ... ]`，执行时按顺序对每个网络发请求并断言。

## 如何维护网络与 token 地址

**直接改用例 JSON，无需单独脚本。**

1. 用 Apifox/编辑器打开 `Swap-0x-全网络全类型-Apifox-TestCases.json`
2. 找到对应用例（如 `Quote - 0x - 主币<>代币`）的 `event` → `listen: "test"` → `script.exec` 数组
3. 第一行即 `const testCases = [ ... ];`，编辑该数组：
   - **增删网络**：增删数组中的 `{ "name": "网络名.主币 数量 → 代币", "params": { ... } }`
   - **改 token 地址/数量**：改对应项的 `params` 里 `fromTokenAddress`、`toTokenAddress`、`fromTokenAmount`、`fromNetworkId`、`toNetworkId` 等

保存后重新导入或刷新即可。

## 集合变量

| 变量 | 默认值 |
|------|--------|
| `requestId` | `{{$guid}}` |
| `baseUrl` | `https://swap.onekeytest.com` |
| `userAddress` | `0x4EF880525383ab4E3d94b7689e3146bF899A296e` |

## 导入步骤

1. Apifox → 设置 → 导入数据  
2. 选择 **Postman Collection v2**  
3. 上传 `Swap-0x-全网络全类型-Apifox-TestCases.json`
