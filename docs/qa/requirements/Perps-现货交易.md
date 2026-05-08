# Perps - 现货交易需求文档

> **来源**：[OneKeyHQ/app-monorepo PR #11183](https://github.com/OneKeyHQ/app-monorepo/pull/11183)
> **作者**：@Minnzen
> **影响平台**：iOS / Android / Desktop / Extension / Web
> **关联模块**：Perps（永续合约）— 现货作为 Perps 的第二种交易模式接入
> **关联规则**：`docs/qa/rules/perps-rules.md` 第 5 章

---

## 1. 需求背景

在 OneKey 原有 Hyperliquid 永续合约能力的基础上，新增**现货交易（Spot Trading）**作为一种新的交易模式。与永续共享底层基础设施（WS 传输层、订阅管理、账户系统），通过 `tradingModeAtom`（值为 `perp` / `spot`）做模式隔离。

---

## 2. 功能描述

### 2.1 交易模式（Trading Mode）

- 新增全局状态 `tradingModeAtom`：`'perp' | 'spot'`，默认 `perp`
- Token Selector 中点击现货 token 进入 `spot` 模式；点击永续 token 回到 `perp` 模式
- 现货交易共用永续模块入口（不是独立页面），通过模式切换复用 K 线、盘口、资金账户等组件

### 2.2 Token Selector Spot Tab

- 在 Favorites / Perps 两个固定 Tab 之外新增 **Spot Tab**，固定显示
- Spot Tab 列表字段：Token / 标记价 / 24h 涨跌% / 24h 名义成交额（dayNtlVlm，单位 USDC）/ **Market Cap**（替代永续的 Open Interest）
- Spot Tab 不显示 Funding Rate 列
- Spot 列表过滤：`dayNtlVlm < SPOT_MIN_VOLUME_STRICT (= 10)` 的 token 不展示。`dayNtlVlm` 是 **24h 名义成交额**（价格 × 数量，非成交数量），单位为报价币种（Hyperliquid spot 绝大多数以 USDC 报价，实际可视为 ≈ $10 USDC）
- Spot Meta 兜底：若 `getSpotMeta()` 返回空，自动调用 `refreshSpotMeta()` 并重新获取；加载中显示 Spinner
- Spot Token 显示名映射（内部名 → 展示名）：UBTC→BTC、UETH→ETH、USOL→SOL、UFART→FARTCOIN、UBONK→BONK、UPUMP→PUMP、UENA→ENA、UXPL→XPL、UZEC→ZEC、UMON→MON、UUUSPX→SPX、UDOGE→DOGE、UMOG→MOG、UWLD→WLD、UMEGA→MEGA、UVIRT→VIRTUAL、USPYX→SPYX、UDZ→DZ、LINK0→LINK、AAVE0→AAVE、AVAX0→AVAX、BNB0→BNB、CFX0→CFX、PEPE0→PEPE、TRX0→TRX、USDT0→USDT、XAUT0→XAUT、HPENGU→PENGU、HPEPE→PEPE、FXRP→XRP、XMR1→XMR、HBNB→BNB、HSEI→SEI
- 现货 pair 显示格式：`<displayBase>/<quoteName>`（例：BTC/USDC）
- 搜索：按 `baseName` / `displayBase` / `pairDisplay` 不区分大小写模糊匹配

### 2.3 现货下单（Place Spot Order）

#### 订单类型
- **市价单（Market）**：`orderType='market'`，使用 `limit + tif='Ioc'` 实现，按 mark price ± slippage 计算执行价
- **限价单（Limit）**：`orderType='limit'`，使用 `limit + tif='Gtc'`，需填写 `limitPx`

#### 方向
- 现货模式下 Buy/Sell 替代永续的 Long/Short（按钮文案切换）
- `isBuy: boolean` 参数，Buy=true / Sell=false

#### 参数与校验
- **必填字段**：`assetId`、`isBuy`、`sz`、`limitPx`、`orderType`
- **assetId 校验**：必须为数字且 `>= SPOT_ASSET_ID_OFFSET (= 10_000)`，否则服务层抛 `OneKeyLocalError`
- **Spot meta 校验**：`assetId === undefined` 或 `!Number.isFinite(assetId)` 时抛 `'Spot asset metadata not loaded. Please try again.'`
- **价格精度**：`MAX_DECIMALS_SPOT = 8`，实际最大小数位 = `8 - szDecimals`
- **有效位数**：`MAX_SIGNIFICANT_FIGURES = 5`；整数部分 `>= 5` 位时禁止小数
- **整数位限制**：`MAX_PRICE_INTEGER_DIGITS = 12`
- **中文句号**：输入 `。` 自动转换为 `.`
- **前导零**：禁止 `00` 以及 `01`（非 `0.` 开头的 0 前缀）
- **杠杆**：现货无杠杆，`leverage` 强制为 1；下单时 `leverageValue: 1` 写入参数
- **条件单/触发单**：现货模式下不支持 `trigger` 模式，尝试下触发单会弹 Toast `'Trigger orders are not supported in spot mode'`
- **TP/SL**：现货下单不附带 TP/SL（附单链路走永续）

#### 滑点
- 市价买入：`adjustedPrice = markPrice × (1 + slippage)`
- 市价卖出：`adjustedPrice = markPrice × (1 − slippage)`
- 调整后价格通过 `formatSpotPriceToValid(price, szDecimals)` 格式化（保留小数后尾零去除，整数尾零保留）

### 2.4 持有币种 Tab（订单信息面板）

- 在订单信息面板（PerpOrderInfoPanel）新增 **持有币种 Tab**（代码标识 `Balances`）
- 列：Asset（资产）/ Balance（余额）/ Available（可用）/ Value（USDC 价值）/ PNL (ROE %) / Contract（合约地址）
- **数据来源**：
  - 现货 token：`useSpotBalancesAtom` 返回的 `balances[]`（来自 `SPOT_STATE` 订阅）
  - 永续 USDC：从 `perpsActiveAccountSummaryAtom.totalRawUsd` 追加一行，`type: 'perps'`
- **稳定币识别**：USDC / USDT / USDB 视为稳定币，不计算 PNL
- **PNL 计算**：`pnl = totalBN × midPrice − entryNtlBN`；`pnlPercent = pnl / entryNtlBN × 100`
- **价格源**：优先使用 USDC 报价对（`quoteName === 'USDC'`）的 `markPx`；否则取任一 quote 的 markPx
- **Available**：`max(total − hold, 0)`
- **排序**：USDC（统一账户合并条目）固定在列表最顶部，不参与价值排序；其他资产按价值（USDC 计价）从高到低排序；值相等时按 `total` 降序兜底
- **零余额过滤**：`total == 0` 的 token 不显示
- **USDC 合并显示（统一账户）**：OneKey 采用统一账户模式，现货 USDC 与合约 USDC 合并为单条 USDC 展示，余额 = 两者之和（不显示双条目）
- **点击行为**：非 USDC 且有 `spotUniverse` 的行可点击，点击后切换到该 token 的现货交易视图（`changeActiveSpotAsset`）。**默认匹配 `<base>/USDC` 交易对**；该代币无 USDC 报价对时回退到任一可用报价对（与价格源回退口径一致）
- **盈亏分享**：非稳定币行盈亏列右侧显示**分享按钮**，点击弹出分享卡片（含代币、持仓数量、盈亏金额 / 百分比、价格、二维码 / 推广链接），可保存图片或一键分享到社交平台
- **合约跳转**：合约列地址右侧依次显示「复制按钮」+「**跳转按钮**」，点击跳转按钮打开区块浏览器（Hyperliquid Explorer 或对应链浏览器）合约页
- **下拉刷新**：支持 pull-to-refresh，触发 `refreshAllPerpsData()`
- **账户切换**：切账户时 `spotBalancesAtom` 重置为 `{ balances: [], isLoaded: false }`，`spotActiveOpenOrdersAtom` 重置；`currentListPage` 回到 1
- **合约地址**：从 `tokenContractMap` 按 baseName 或 displayName 取 `evmContract.address`

### 2.5 现货行情页（Ticker Bar / Market Header）

- **Market Cap 替代 Open Interest**：`marketCap = circulatingSupply × markPrice`
- **合约地址栏**：显示 `0x1234...abcd`（6+4 格式）+ 「复制按钮」（`Copy3Outline` 图标）+「**跳转按钮**」（点击打开区块浏览器合约页）；无合约时显示 `--`，无任何按钮
- **不显示 Funding Rate**：现货模式下 Funding 行整体不渲染
- **不显示 builderFee 提示**：`builderFeeRate === 0` 的提示仅永续模式可见
- **共用字段**：midPrice / markPrice / volume24h / change24hPercent 在两种模式下都显示
- 移动端头部（MobilePerpMarketHeader）额外用 `ETranslations.global_market_cap` / `ETranslations.global_contract` 作为标签

### 2.6 订阅与连接优化

#### 新增订阅类型
- `SPOT_STATE`：现货余额订阅；`spotEnabled` 门控（账户存在时默认开启，用于计算账户总价值）
- `SPOT_ASSET_CTXS`：现货全量行情订阅；仅在 Spot 模式或 Token Selector 打开 Spot Tab 时开启
- `ACTIVE_SPOT_ASSET_CTX`：当前活跃现货 token 详情订阅

#### 首次订阅优化
- 首次 `updateSubscriptions()` 跳过 300ms 防抖（`_hasInitialSubscription` 标志）
- `disconnect()` 时重置标志，iOS 前后台切换重连后立即重新订阅

#### 缓存优化
- `loadTradesHistory` 使用 `CACHE_TIME_QUANTIZE_MS = 10_000`：把 `Date.now()` 量化到 10s 窗口，相近时间的调用共用 memoizee key，消除重复的 345KB `userFillsByTime` 请求
- `usePerpFeatureGuard` 切换到缓存版本：`perp-config` 1h TTL，避免 tab focus 时重复拉取 30KB 配置

#### 并行初始化
- `exchangeService.setup()` 与 `userRole()` 通过 `Promise.all` 并行
- `checkBuilderFeeStatus` 与 `checkInternalRebateBindingStatus` 并行
- `checkAgentStatus` 在两者完成后顺序执行
- `setReferrer` 延后到 `finally` 后触发（fire-and-forget，避免与 `fetchUserAbstraction` 抢带宽）

#### 下线项
- 移除 `600ms DelayedRender` 延迟渲染（2025 年 10 月添加，现已由 `isWebSocketConnected && !isLoading && shouldSyncSubscriptions` 守卫替代）

### 2.7 URL 路由同步

- Perps 页面 URL 形如 `/perps?mode=<perp|spot>&token=<symbol>`
- `mode` 参数：显式指定交易模式（`perp` / `spot`），不靠 token 名隐式判断
- `token` 参数：使用 token 显示名（spot 与 perp 共用一组显示名，如 `HYPE` / `BTC` / `ETH`）；如代币内部名带 dex 前缀时，URL 上保留前缀（如 `token=dex:HYPE`）
- 例：
  - `https://app.onekeytest.com/perps?mode=spot&token=HYPE` → 现货 HYPE 交易
  - `https://app.onekeytest.com/perps?mode=perp&token=BTC` → 永续 BTC 交易
  - `https://app.onekeytest.com/perps?mode=perp&token=dex:HYPE` → DEX 永续 HYPE
- 路由变化触发 `switchTradeInstrument({ mode, coin, spotUniverse })`，spot 模式下根据 `token` 反查 spotUniverse（默认 USDC 报价）

### 2.8 状态隔离与持久化

- `spotActiveAssetAtom`：当前选中的现货 token（`coin/assetId/universe`），**持久化**
- `spotTokenSelectorConfigPersistAtom`：排序/Tab 配置，**持久化**
- `spotTokenFavoritesPersistAtom`：现货收藏列表（独立于永续收藏），**持久化**
- `spotActiveOpenOrdersAtom`：当前账户的现货挂单（按 `accountAddress` 隔离）
- `spotActiveAssetCtxAtom`：当前活跃现货 token 的实时行情
- `spotAssetCtxsMapAtom`：现货全量行情 map（`markPx / prevDayPx / dayNtlVlm / circulatingSupply`）
- `spotBalancesAtom`：当前账户的现货余额列表
- `spotPairDisplayMapAtom`：pair 显示名 map
- **账户切换**：`spotBalancesAtom` / `spotActiveOpenOrdersAtom` 重置为空
- **断连重连**：保留 `spotActiveAssetAtom`（持久化），不清空收藏与配置

### 2.9 订单与历史成交隔离

- `Open Orders`：现货与永续分两个 list 展示（`spotOpenOrders` vs `perpOpenOrders`），按 `activeTradeInstrument.mode` 切换
- `Trades History`：现货与永续共用 `USER_FILLS` 订阅，按 `isSpotInstrument(fill.coin)` 过滤分流
- **撤单**：现货撤单仅作用于现货订单；永续撤单仅作用于永续订单

### 2.10 爆仓/清算信息

- 现货模式下 `useLiquidationPrice()` 直接返回 `null`（现货无爆仓概念）
- TradingView 图表的持仓线/爆仓线开关在现货模式下不展示相关标记

---

## 3. 边界与异常

### 3.1 下单异常
| 场景 | 预期行为 |
|------|---------|
| `assetId < SPOT_ASSET_ID_OFFSET` | 服务层抛 `invalid spot assetId ...` |
| `assetId === undefined` / 非数字 | 抛 `'Spot asset metadata not loaded. Please try again.'` |
| `orderMode === 'trigger'` + spot | Toast `'Trigger orders are not supported in spot mode'`，不提交 |
| Spot meta 加载失败 | Token Selector 不显示 Spot 列表，下单按钮禁用 |
| API 500 / 网络错误 | Toast 报错，余额/挂单状态不变 |

### 3.2 边界值
| 类型 | 规则 |
|------|------|
| 价格最大小数位 | `8 - szDecimals` |
| 价格最大整数位 | 12 |
| 价格最大有效位 | 5 |
| 最小名义成交额过滤 | `dayNtlVlm >= 10`（Token Selector Spot Tab；dayNtlVlm = 价格 × 数量，单位按报价币种，spot 基本为 USDC） |
| 最小下单金额 | 沿用永续规则 $10（对齐 Hyperliquid） |

### 3.3 并发与时序
- 快速切换 perp ↔ spot：订阅管理器 debounce 300ms，首次跳过
- 账户切换时 `spotBalancesAtom.isLoaded` 应短暂为 false（避免陈旧数据闪现）
- iOS 前后台切换：disconnect 重置 `_hasInitialSubscription`，前台恢复后首次订阅跳过 debounce

---

## 4. 已知风险

- **订阅时序**：首次订阅跳 debounce 的优化可能影响账户切换时序，验证点关注无重复订阅、无漏订阅
- **假阳性 assetId**：防御性断言防止永续 assetId 误传入 spot 路径，避免资金错配
- **统一账户合并 USDC**：现货 USDC 与合约 USDC 在持有币种 Tab 合并为一行展示。代码层 `needsSuffix` 字段为历史遗留，UI 实际不再走双条目路径
- **Token 显示映射**：Hyperliquid 上 UBTC / UETH 等 wrapped 代币实际映射到展示名 BTC / ETH，搜索时需两者都能命中
- **模式切换遗留状态**：切 spot 后旧的 perp 持仓、爆仓线、杠杆值不应影响 spot 交易面板

---

## 5. 关联资源

- **源码路径**：
  - `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquid*.ts`
  - `packages/kit-bg/src/states/jotai/atoms/spot.ts`
  - `packages/kit/src/views/Perp/components/OrderInfoPanel/List/SpotBalanceList.tsx`
  - `packages/kit/src/views/Perp/components/TokenSelector/PerpTokenSelector.tsx`
  - `packages/kit/src/views/Perp/hooks/useSpotMetaMaps.ts`
  - `packages/kit/src/views/Perp/utils/subscriptionPlanner.ts`
  - `packages/shared/src/utils/perpsUtils.ts`
  - `packages/shared/types/hyperliquid/perp.constants.ts`
- **常量**：
  - `SPOT_ASSET_ID_OFFSET = 10_000`
  - `MAX_DECIMALS_SPOT = 8`
  - `CACHE_TIME_QUANTIZE_MS = 10_000`
  - `SPOT_MIN_VOLUME_STRICT = 10`

---

## 6. 变更记录

### 2026-04-21（首版）
- 整理 PR #11183 的需求（基于代码）
- 覆盖：交易模式切换、Token Selector Spot Tab、现货下单（市价/限价 Buy/Sell）、持有币种 Tab、现货 Ticker Bar、订阅优化、URL 路由、状态隔离
