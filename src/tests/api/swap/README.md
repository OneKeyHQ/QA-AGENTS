# Swap API automation (local / Jenkins)

Node runner for Swap quote + build-tx. This is **not** an Apifox import collection.

## Coverage (v1)

| Case | API | Notes |
|------|-----|-------|
| 0x / 1inch / OKX same-chain | `GET /swap/v1/quote` then `POST /swap/v1/build-tx` | JSON quote; build without `quoteResultCtx` |
| CowSwap | `GET /swap/v1/quote` only | JSON quote; **no** `build-tx` |
| LiquidMesh / Swft / Changelly / ChangeHero / Binance Web3 (`SwapBstock`) | `GET /swap/v1/quote` then `POST /swap/v1/build-tx` | JSON quote; build **requires** `quoteResultCtx`. |
| HiFi | `GET /swap/v1/quote` then `POST /swap/v1/build-tx` | JSON quote; build 带 `quoteResultCtx.hifiSwapQuoteResultCtx` + `tradeSource/binded*/rebateAddress`。HiFi 是换汇单，**不要求** `data.tx`，有 `data` 即通过。 |
| 1inch Fusion | `GET /swap/v1/quote/events` only | SSE quote; **no** `build-tx`. Fusion does not cover native→token. |
| Jupiter / LiFi / RocketX / Panora | `GET /swap/v1/quote/events` then `POST /swap/v1/build-tx` | SSE quote; build **requires** `quoteResultCtx`. |
| Houdini | `GET /swap/v1/quote/events` then `POST /swap/v1/build-tx` | SSE + `incognito=true`；build 带 `quoteResultCtx.houdiQuoteResultCtx.quoteId` + `tradeSource/binded*/rebateAddress`；ETH 主币金额 `0.014`。 |

`--suite smoke` only runs 0x/1inch/OKX ETH native→USDC. Other channels are in Dashboard / `--suite full` / `--channel <key>`.

Addresses and token contracts come from `docs/qa/rules/swap-network-features.md`.

Quote SKIP: HTTP 502/503/504, timeout, empty `data`，以及 **询不到价**（未命中目标 provider、条目 `errorMessage`、缺少 toAmount/fromAmount）。SKIP 原因写 `没有支持的报价结果`，不算失败，不进入 build。命中 provider 但缺 `quoteResultCtx`（依赖上下文的渠道）仍 **FAIL**。

询价命中后若 **from 法币价值 < to 法币价值**，不再调用 `build-tx`，整单记 SKIP，日志为 `跳过 build：from 法币价值 < to 法币价值`（附 fromFiat/toFiat）。法币优先读报价字段，否则用 `GET /swap/v1/tokens` 的 `price` × amount。读不到价格则不因此跳过，继续 build。

## Dashboard（详细执行面板）

1. 启动 `npm run dashboard`（`http://localhost:5050`）
2. 顶栏切到 **接口**
3. 左侧按渠道分组（0x / 1inch / OKX / Jupiter / Fusion / Cow / LiFi / LiquidMesh / RocketX / Houdini / HiFi / Swft / Changelly / ChangeHero / Panora / Binance Web3）
4. 可用 **交易对**、**网络** 过滤后再勾选执行
5. 右侧实时步骤：询价 → 命中渠道 → 构建（含 HTTP / toAmount / SKIP 原因）

接口用例 **不连 CDP**。后续加渠道、网络、交易对只改数据，面板会自动出现新用例。

## 扩展流程（加渠道 / 网络 / token）

规则真源先改文档，再改脚本数据，不要只改一边：

| 真源 | 路径 |
|------|------|
| 渠道 provider、是否 SSE、是否要 `quoteResultCtx`、支持网络 | `docs/qa/rules/swap-rules.md` |
| 账户地址、代币合约、`networkId` | `docs/qa/rules/swap-network-features.md` |

跑用例的代码都在 `src/tests/api/swap/`。改完后 **重启 Dashboard** 或刷新接口列表再执行。

### 1. 加渠道商（例如 LiFi / Binance Web3）

1. `docs/qa/rules/swap-rules.md`：补 provider 名、询价接口（`/quote` 还是 `/quote/events`）、构建是否要 `quoteResultCtx`、支持网络。
2. `data/channels.mjs` → `CHANNELS` 增加一项：

```js
lifi: {
  provider: 'SwapLifi',          // 必须与接口返回的 info.provider 一致
  quoteMode: 'sse',              // json = GET /swap/v1/quote ；sse = /quote/events
  needsQuoteResultCtx: true,     // 查 swap-rules 构建依赖表
  skipBuild: true,               // 可选：只询价，不调 build-tx（1inch Fusion / CowSwap）
  extraBuildFields: ({ params }) => ({ tradeSource: 'swapBridge', ... }), // 可选：对齐客户端 build 体
  networks: ['ethereum', 'solana'],
},
```

3. 该渠道用到的网络 / 代币如果 `data/fixtures.mjs` 里还没有，先按下面「加网络 / 加 token」补。
4. 新建 `src/tests/api/swap/<key>.test.mjs`（照抄 `0x.test.mjs`，只改 key）：

```js
import { createChannelTestModule } from './create-channel-module.mjs';
const mod = createChannelTestModule('lifi');
export const platform = mod.platform;
export const categoryTitle = mod.categoryTitle;
export const displayName = mod.displayName;
export const testCases = mod.testCases;
```

5. 可选：`data/channels.mjs` 的 `SMOKE_CHANNELS`（默认 `0x,1inch,okx`）。新渠道默认只进 full / Dashboard。
6. 重启 Dashboard → 顶栏「接口」会出现新分组。

### 2. 加网络（例如已有 0x，再覆盖 Linea）

1. `swap-network-features.md` 补账户地址、`networkId`、USDC/USDT（或该链稳定币）。
2. `data/fixtures.mjs`：
   - `NETWORKS` 加一行：`linea: { id: 'evm--59144', symbol: 'ETH', native: '', usdc: '...', usdt: '...', account: 'evm' }`
   - 新链账户类型不是 evm/sol 时，还要加 `ACCOUNTS`
   - `NATIVE_AMOUNT['evm--59144']` 写主币 from 金额（约 100U+，过小会询价失败）
3. `data/channels.mjs`：把 `'linea'` 推进该渠道的 `networks` 数组。
4. 重启 Dashboard。每个渠道会自动展开 3 条：`native→USDC`、`USDC→native`、`USDC→USDT`。

### 3. 加 token / 新交易对（例如 Katana 用 USDC/KAT，不是 USDT）

当前默认交易对写死在 `data/channels.mjs` 的 `pairCases()`：

- `native-usdc`
- `usdc-native`
- `usdc-usdt`（读 `network.usdt`）

要加新币种：

1. `swap-network-features.md` 写下合约地址。
2. `data/fixtures.mjs` 的对应 `NETWORKS` 行加字段，例如 `kat: '0x7f1f...'`。
3. `pairCases()` 里 `cases.push` 一条新 `pair`（如 `usdc-kat`），`quoteParams` 填 from/to。
4. 面板交易对 chip 用通用名（`native token → token` / `token → native token` / `token → token` / `native token → native token`），不要写死 USDC/USDT；同语义 pair 会合并成一颗。新 pair 只要在 `API_PAIR_FAMILY` 里归类即可。
5. 重启 Dashboard。

只改金额、不改币种：只动 `fixtures.mjs` 的 `NATIVE_AMOUNT` / `STABLE_AMOUNT`。

### 4. 加跨链（同链矩阵不够）

跨链必须 `fromNetworkId !== toNetworkId`，`userAddress` 用源链、`receivingAddress` 用目标链。四类 pair：

- `x-native-native`（主币→主币，同链禁止、跨链必有）
- `x-native-usdc`
- `x-usdc-native`
- `x-usdc-usdc`

当前第一批：LiFi / RocketX / Houdini，路由写在 `CROSS_EVM_SOL`（`ethereum↔arbitrum` / `ethereum↔bsc` / `ethereum↔solana`）。**不含 BTC**（地址需钱包派生）。

加路由：把 `['from','to']` 推进该渠道 `crossRoutes`。Smoke 不含跨链。面板用「跨链 …」chip 过滤。

0x / 1inch / Fusion / Cow / Jupiter / Panora / Binance Web3 / OKX **不要**加 `crossRoutes`。

### 5. 改环境域名

`src/tests/api/swap/lib/config.mjs` → `DEFAULT_BASE_URL`  
或运行时 `SWAP_API_BASE` / `--baseUrl`。当前默认 `https://swap.onekeytest.com`。

生产域名有 Cloudflare Bot Management：无 `__cf_bm` 时 Node / curl 都会立刻 `403` HTML，和 JSON/SSE、Fusion 参数无关。浏览器能询价是因为带了 cookie。把完整 `Cookie` 头放到 `.env` 的 `SWAP_API_COOKIE=`（仅本地）。测试环境 `https://swap.onekeytest.com` 不需要这步。

### 不用改的文件

询价 / 构建 / SKIP 逻辑在 `lib/`、`cases/quote-build.mjs`，加渠道一般不用动。  
`create-channel-module.mjs` 会从 `CHANNELS` 自动生成 Dashboard `testCases`。

## Run locally

```bash
# smoke: 0x/1inch/OKX ETH native->USDC
node src/tests/api/swap/run.mjs --suite smoke

# full: native->USDC, USDC->native, USDC->USDT on each channel network
node src/tests/api/swap/run.mjs --suite full

# one channel
node src/tests/api/swap/run.mjs --suite smoke --channel 0x
```

Env:

| Variable | Default |
|----------|---------|
| `SWAP_API_BASE` | `https://swap.onekeytest.com` |
| `SWAP_API_COOKIE` | 空。生产站 Cloudflare 会 403；从浏览器可询价请求里复制 `Cookie`（含 `__cf_bm=`）写入 `.env`，不要提交 git |
| `SWAP_SUITE` | `smoke` |
| `SWAP_CHANNEL` | all keys in `CHANNELS`（smoke 默认只要 `0x,1inch,okx`） |
| `SWAP_TIMEOUT_MS` | `45000` |
| `SWAP_JUNIT` | `shared/results/api/swap-junit.xml` |
| `SWAP_FAIL_ON_SKIP` | unset (SKIP does not fail the job) |

## Jenkins

```groovy
pipeline {
  agent any
  stages {
    stage('Swap API') {
      steps {
        sh 'node src/tests/api/swap/run.mjs --suite smoke --junit shared/results/api/swap-junit.xml'
      }
    }
  }
  post {
    always {
      junit 'shared/results/api/swap-junit.xml'
    }
  }
}
```

Process exit `1` only when a case **failed**. SKIP is reported in JUnit as `<skipped/>`.
