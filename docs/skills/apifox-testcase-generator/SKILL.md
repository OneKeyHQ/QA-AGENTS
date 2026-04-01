# Apifox API 测试用例生成器

> 🔧 通过 Apifox MCP 读取 API 文档，自动生成可直接导入 Apifox 的接口测试用例

---

## 📋 功能概述

本 Skill 提供以下能力：
- 通过 MCP 读取 Apifox 项目的 OpenAPI 文档
- 解析接口定义，自动生成测试用例
- 包含完整的前置条件、变量、断言
- 输出 Postman Collection v2.1 格式（兼容 Apifox 导入）
- 自动生成导入说明

---

## 🎯 指令列表

| 指令 | 说明 | 示例 |
|------|------|------|
| `/api-list` | 列出所有可用的 API 接口 | `/api-list` |
| `/api-read <path>` | 读取指定接口的详细定义 | `/api-read /earn/v1/borrow/markets` |
| `/api-testcase <collection>` | 为指定接口集合生成测试用例 | `/api-testcase 5.19.0 Borrow` |
| `/api-testcase-single <path>` | 为单个接口生成测试用例 | `/api-testcase-single /earn/v1/borrow/markets` |
| `/api-refresh` | 刷新 API 文档缓存 | `/api-refresh` |

---

## 📖 详细指令说明

### `/api-list` - 列出所有 API 接口

**用途**：查看项目中所有可用的 API 接口列表

**操作步骤**：
1. 调用 `mcp_API__read_project_oas_qpu5ak` 获取 OpenAPI 文档
2. 解析 `paths` 字段，提取所有接口路径
3. 按模块分组展示

**输出格式**：
```markdown
## API 接口列表

| 模块 | 接口数 | 接口路径示例 |
|------|--------|-------------|
| Earn | 53 | /earn/v1/borrow/markets |
| Wallet | 47 | /wallet/v1/account/list |
| ... | ... | ... |

总计：XXX 个接口
```

---

### `/api-read <path>` - 读取接口详情

**用途**：查看指定接口的完整定义

**参数**：
- `<path>`: 接口路径，如 `/earn/v1/borrow/markets`

**操作步骤**：
1. 将路径转换为 ref 格式：`/paths/_earn_v1_borrow_markets.json`
2. 调用 `mcp_API__read_project_oas_ref_resources_qpu5ak` 获取接口详情
3. 解析并展示接口信息

**输出格式**：
```markdown
## 接口详情：获取 Market 列表

- **路径**：GET /earn/v1/borrow/markets
- **描述**：获取支持的借贷市场列表

### 请求参数
| 参数名 | 位置 | 必填 | 类型 | 说明 |
|--------|------|------|------|------|
| X-Onekey-Request-ID | header | 是 | string | 请求ID |
| ... | ... | ... | ... | ... |

### 响应结构
...
```

---

### `/api-testcase <collection>` - 生成测试用例集合

**用途**：为指定的接口集合批量生成测试用例

**参数**：
- `<collection>`: 接口集合名称，如 `5.19.0 Borrow`、`Swap`、`Wallet`

**操作步骤**：
1. 根据集合名称匹配相关接口
2. 批量读取接口定义
3. 生成测试用例 JSON 文件
4. 生成导入说明文档

**输出文件**：
```
docs/testcases/api/
├── {collection}-Apifox-TestCases.json    # 测试用例集合（包含所有参数）
└── {collection}-导入说明.md               # 导入指南
```

> ⚠️ **不单独生成环境变量文件**：参数直接在用例中传递，仅接口间传递的动态数据通过脚本自动写入环境变量。

> 💡 **不覆盖响应定义**：生成的用例不会覆盖接口的响应定义（返回响应、响应示例、响应字段说明等），这些是给前端看的参数定义，会完整保留。

> **DeFi · Pendle 专用**：生成或维护 **`provider=pendle`** 的 Earn 用例（如 `stake-protocol/detail`、`asset-list`、`transaction-confirmation`、`/earn/v2/stake` 等）时，**实际请求中的** `vault` 须为 **全小写** hex。Apifox 易将 Params 里裸填的 `0x…` 自动改为 EIP-55 混写，建议在 Collection **根级变量**（如 `pendle_vault_usde`）存小写值，用例里写 **`{{pendle_vault_usde}}`**，使 `url.raw`、`query`、`body.raw` 一致且发送时仍为小写。参考：`docs/qa/rules/defi-rules.md` §2.15、`Pendle-Swap-Quote-BuildTx-Apifox-TestCases.json`。其他 DeFi 协议用例不要求本条。

**测试用例结构**：
```json
{
  "info": {
    "name": "集合名称",
    "description": "描述"
  },
  "variable": [...],  // 集合变量
  "item": [
    {
      "name": "接口名称",
      "event": [
        { "listen": "prerequest", "script": {...} },  // 前置脚本
        { "listen": "test", "script": {...} }         // 测试断言
      ],
      "request": {
        "method": "GET/POST",
        "url": {
          "query": [
            {
              "key": "amount",
              "value": "0.01"
              // 注意：只包含 key 和 value，不包含 description、type、required 等元数据
            }
          ]
        }
      }
    }
  ]
}
```

---

### `/api-testcase-single <path>` - 生成单接口测试用例

**用途**：为单个接口生成测试用例

**参数**：
- `<path>`: 接口路径

**输出**：直接输出测试用例代码块，可复制使用

---

### `/api-refresh` - 刷新 API 文档

**用途**：从服务器重新下载最新的 API 文档

**操作步骤**：
1. 调用 `mcp_API__refresh_project_oas_qpu5ak` 刷新文档
2. 显示更新时间和接口统计

---

## 🔧 测试用例生成规则

### 1. 前置脚本（Pre-request Script）

```javascript
// 标准前置脚本模板
pm.variables.set('requestId', pm.variables.replaceIn('{{$guid}}'));
console.log('开始测试: {接口名称}');

// 依赖检查（如果有前置依赖）
const requiredVar = pm.collectionVariables.get('varName');
if (!requiredVar) {
    console.warn('警告: varName 未设置，请先执行前置接口');
}
```

### 2. 变量设置规则

**原则**：参数直接硬编码在请求中，只有接口间需要传递的动态数据才存入环境变量。

#### 直接传参（硬编码）

| 参数类型 | 示例值 | 说明 |
|----------|--------|------|
| 基础地址 | `https://api.onekey.so` | 直接写在 URL 中 |
| 网络ID | `sol--101` | 直接写在 Query 参数中 |
| 协议 | `kamino` | 直接写在 Query 参数中 |
| 测试金额 | `0.01` | 直接写在请求中 |
| 请求头 | `5.19.0` | 直接写在 Header 中 |

#### 动态传递（环境变量）

仅以下场景使用环境变量：

| 变量 | 来源接口 | 使用接口 | 提取方式 |
|------|---------|---------|---------|
| `marketAddress` | 获取 Market 列表 | 后续所有接口 | `pm.environment.set('marketAddress', data.markets[0].address)` |
| `reserveAddress` | 获取 Reserve 列表 | Reserve 详情、交易构建等 | `pm.environment.set('reserveAddress', data.supply.items[0].reserveAddress)` |
| `orderId` | 交易构建接口 | 交易确认接口 | `pm.environment.set('orderId', data.orderId)` |

### 3. 断言规则

#### 必须包含的断言：
```javascript
// HTTP 状态码
pm.test('响应状态码为 200', function() {
    pm.response.to.have.status(200);
});

// 响应时间
pm.test('响应时间小于 3000ms', function() {
    pm.expect(pm.response.responseTime).to.be.below(3000);
});

// 业务状态码
pm.test('业务状态码为 0', function() {
    pm.expect(jsonData.code).to.eql(0);
});
```

#### 根据响应结构生成的断言：

| 响应类型 | 断言模板 |
|----------|---------|
| 数组 | `pm.expect(jsonData.data.xxx).to.be.an('array')` |
| 对象 | `pm.expect(jsonData.data).to.have.property('xxx')` |
| 字符串 | `pm.expect(jsonData.data.xxx).to.be.a('string')` |
| 数值 | `pm.expect(jsonData.data.xxx).to.be.a('number')` |
| 布尔 | `pm.expect(jsonData.data.xxx).to.be.a('boolean')` |
| 非空 | `pm.expect(jsonData.data.xxx.length).to.be.above(0)` |

### 3.1 标签断言规则（交易解析类接口）

交易解析接口使用 **前置脚本 + 统一后置脚本** 的断言方式，通过变量控制验证逻辑。

#### 规则 1：前置脚本设置验证变量

在前置脚本中设置期望验证的标签类型：

```javascript
/**
 * 前置脚本：设置验证变量
 */
pm.variables.set("EXPECT_FIRST_TRANSFER", true);   // 是否验证首次转账标签
pm.variables.set("EXPECT_CONTRACT_TAG", false);    // 是否严格验证合约标签
```

#### 规则 2：统一后置断言脚本

所有交易解析用例共用一套后置断言脚本，根据实际返回数据自动识别场景（CEX/合约/诈骗）并执行对应验证：

```javascript
/**
 * 交易解析统一断言脚本
 */

/* ---------- 配置白名单 ---------- */
const EXCHANGE_WHITELIST = [
  "binance", "okx", "bybit", "coinbase", "kraken", 
  "bitget", "kucoin", "gate", "htx", "novadax"
];
const CONTRACT_TAGS = ["合约", "Contract", "Smart Contract"];
const SCAM_TAGS = ["诈骗", "诈骗地址", "Scam", "Phishing", "Fraud"];
const FIRST_TRANSFER_TAGS = ["首次转账", "Initial Transfer"];

/* ---------- 工具函数 ---------- */
function getToComp(res) {
  return (res?.data?.display?.components || []).find(
    c => c?.type === "address" && (c?.label === "至" || c?.label === "To")
  );
}

function getTagValues(comp) {
  return (comp?.tags || []).map(t => t?.value).filter(Boolean);
}

function hitAny(actual, expectedList) {
  const expectedLower = expectedList.map(e => String(e).toLowerCase());
  return (actual || []).some(v => expectedLower.includes(String(v).toLowerCase()));
}

/* ---------- 主逻辑 ---------- */
const res = pm.response.json();
const toComp = getToComp(res);
const tags = getTagValues(toComp);
const tagsText = tags.length ? tags.join(",") : "(empty)";
console.log("To address tags =>", tagsText);

/* ---------- 场景识别 ---------- */
const isCex = hitAny(tags, EXCHANGE_WHITELIST) || 
              (res?.data?.parsedTx?.to?.labels || []).includes("cex");
const isContractParsed = res?.data?.parsedTx?.to?.isContract === true;
const isContractTag = hitAny(tags, CONTRACT_TAGS);
const isContract = isContractParsed || isContractTag;
const isScam = hitAny(tags, SCAM_TAGS);

/* ---------- CEX 规则 ---------- */
if (isCex) {
  pm.test(`【CEX】To 地址命中交易所 | tags=${tagsText}`, function () {
    pm.expect(hitAny(tags, EXCHANGE_WHITELIST)).to.be.true;
  });
  const expectFirst = pm.variables.get("EXPECT_FIRST_TRANSFER");
  if (expectFirst === true || expectFirst === "true") {
    pm.test(`【CEX】首次转账标签校验 | tags=${tagsText}`, function () {
      pm.expect(hitAny(tags, FIRST_TRANSFER_TAGS)).to.be.true;
    });
  }
}

/* ---------- 合约规则 ---------- */
if (isContract) {
  pm.test(`【合约】parsedTx.isContract 或 tags 命中合约 | tags=${tagsText}`, function () {
    pm.expect(isContractParsed || isContractTag).to.be.true;
  });
  const expectContractTag = pm.variables.get("EXPECT_CONTRACT_TAG");
  if (expectContractTag === true || expectContractTag === "true") {
    pm.test(`【合约-严格】UI tags 必须包含合约标签 | tags=${tagsText}`, function () {
      pm.expect(isContractTag).to.be.true;
    });
  }
}

/* ---------- 诈骗规则 ---------- */
if (isScam) {
  pm.test(`【诈骗】To 地址包含诈骗标签 | tags=${tagsText}`, function () {
    pm.expect(hitAny(tags, SCAM_TAGS)).to.be.true;
  });
}

/* ---------- 兜底 ---------- */
if (!isCex && !isContract && !isScam) {
  pm.test(`【普通地址】未命中特殊规则 | tags=${tagsText}`, function () {
    pm.expect(true).to.be.true;
  });
}
```

#### 规则 3：用例必须使用实际入参

生成用例时**必须使用实际可用的请求参数**，不能使用占位符或虚假数据：

| 链类型 | 正确示例 | 错误示例 |
|--------|---------|---------|
| EVM | `0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B` | `0x1234...` |
| BTC | `bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq` | `bc1q123...` |
| LTC | `LVg2kJoFNg45Nbpy53h7Fe1wKyeXVRhMH9` | `ltc1q123...` |

> **重要**：生成用例前先通过 `/api-read` 获取接口示例数据，使用示例中的实际参数。

#### 规则 4：常见标签映射

| 场景 | 标签 value | displayType |
|------|-----------|-------------|
| 首次转账 | `Initial Transfer` | `warning` |
| 已转账过 | `Transferred` / `Interacted before` | `info` |
| 交易所地址 | `Binance` / `Coinbase` / `OKX` / `Kraken` | `default` |
| 诈骗地址 | `Scam` / `Phishing` / `Malicious` | `warning` |
| 合约地址 | `Contract` / 合约名称 | `warning` |

#### 规则 5：用例结构统一

| 组成部分 | 必须 | 说明 |
|----------|------|------|
| 前置脚本 | 是 | 设置 `EXPECT_FIRST_TRANSFER` 等验证变量 |
| 统一后置脚本 | 是 | 使用上述统一断言脚本 |
| 实际入参 | 是 | 使用真实可用的请求参数 |
| 日志输出 | 推荐 | `console.log` 记录标签便于调试 |

### 4. 边界测试用例规则

自动生成以下边界测试：

| 测试类型 | 说明 |
|----------|------|
| 缺失必填参数 | 移除每个必填参数，验证返回错误 |
| 无效参数值 | 传入无效格式的参数值 |
| 边界值 | 数值类型测试 0、负数、超大值 |
| 空值 | 传入空字符串或 null |

### 5. Swap 模块 API 测试规则

生成 **Swap 相关**接口（询价、构建等）的 Apifox 用例时，必须遵守以下规则。**来源**：`docs/qa/rules/swap-rules.md`、`docs/qa/rules/swap-network-features.md`。

#### 5.1 生成前必读

- **必须先阅读** `docs/qa/rules/swap-rules.md` 中的：**渠道与网络支持矩阵**、**兑换类型覆盖**、**多链测试覆盖原则**、**代币合约地址规则（不同网络维护的 USDC/USDT 等合约地址表）**。
- **网络特性与地址来源（强制）**：生成 Swap 用例时必须先读取 `docs/qa/rules/swap-network-features.md`；代币合约地址与账户地址以该文档为唯一维护来源（source of truth）。
- 历史 JS 脚本中维护的代币地址、网络 ID（如 `scripts/swap-quote-sse/CHANNEL_CONFIG.js`）仅作**辅参考**，**以 `swap-rules.md` / `swap-network-features.md` 为最终准则**。

#### 5.2 询价接口（GET /swap/v1/quote）

| 规则 | 说明 |
|------|------|
| **Query 必须完整** | 请求必须带齐所有服务端要求的 Query 参数；缺参会导致 422 无效参数。 |
| **Apifox 使用 url.query** | 除 `url.raw` 外，必须显式写 `url.query` 数组（每项 `key`、`value`），保证 Apifox 的「Query 参数」面板有默认参数，避免 Params 为空报错。 |
| **必含参数** | fromTokenAddress、toTokenAddress、fromTokenAmount、fromNetworkId、toNetworkId、protocol、userAddress、slippagePercentage、autoSlippage、receivingAddress、kind、toTokenAmount、**denySingleSwapProvider**（可为 `""`）。 |
| **protocol** | 与现有 Swap 用例保持一致（如小写 `swap`）。 |
| **断言** | HTTP 200；业务码 `code === 0`；`data` 中含对应渠道报价（如 0x 用例需含 provider 含 `0x`）。询价/构建的 **provider 断言**与下方 5.5 写法一致。 |

#### 5.3 兑换类型维度

- **同链**：主币<>代币、代币<>主币、代币<>代币（3 种必须覆盖）。
- **跨链**：主币<>主币、主币<>代币、代币<>主币、代币<>代币（4 种）。
- 按渠道生成时，每个渠道至少覆盖上述兑换类型；按「类型」维度生成时，每种类型下用变量（如 testCases 数组）覆盖多网络。
- **例外：1inch Fusion** 仅支持 ERC20<>ERC20，同链只生成「代币<>代币」用例（主币<>代币、代币<>主币不生成 Fusion 用例）。

#### 5.4 渠道与网络

- 按 `swap-rules.md` 的**渠道与网络支持矩阵**生成用例（0x、1inch、1inch Fusion、Jupiter、CowSwap、OKX、Panora 等各支持网络不同）。
- 网络 ID 格式：EVM 为 `evm--<chainId>`（如 `evm--1`、`evm--43114`），其他链见 swap-network-features.md。
- 各网络使用该渠道支持的代币地址（主币填空字符串 `""`）。

#### 5.5 构建接口（POST /swap/v1/build-tx）与 provider 写法

- **路径**：`POST /swap/v1/build-tx`（不是 `/swap/v1/build`）。
- Body 为 JSON，需包含：fromTokenAddress、toTokenAddress、fromTokenAmount、**toTokenAmount**（必填，可为预估收到数量或任意值如 `"1"`）、fromNetworkId、toNetworkId、protocol、**provider**、userAddress、receivingAddress、**slippagePercentage**（**必须为 number**，如 `0.5`，不能为字符串 `"0.5"`）、kind（如 `"sell"`）、**walletType**（如 `hd`）。**不要**传 `autoSlippage`（构建接口不需要）。
- **provider 统一写法**（每个渠道一致）：首字母大写 `Swap` + 渠道名，如 `Swap0x`、`Swap1inch`、`SwapJupiter`、`CowSwap`、`SwapOKX`、`SwapPanora`。构建请求与询价断言中的 provider 均按此规范。
- 断言：HTTP 200；业务码 `code === 0`；**`data.tx` 存在且非空**（响应结构为 `data.tx`，不是 `data.result`）。

#### 5.6 集合组织方式

- **按渠道与兑换类型**：每个渠道下 3 条（主币<>代币、代币<>主币、代币<>代币），每条为单请求 + 单次断言。
- **按兑换类型 + 多网络**：每条用例为一种兑换类型，用例内用脚本循环多网络（testCases 数组 + runCase），请求 URL 与脚本中 params 保持一致（含 denySingleSwapProvider），且主请求的 `url.query` 填默认参数。

#### 5.7 渠道生成前探测（强制）

- 生成渠道用例前，必须先用目标参数调用 `/swap/v1/quote` 做可用性探测，再落地用例。
- **Exodus**：仅保留命中 `SwapExodusBridge` 且返回 `quoteResultCtx` 的组合。
- **1inch Fusion**：仅保留命中 `Swap1inchFusion` 且返回 `quoteResultCtx` 的组合；仅生成 ERC20<>ERC20。
- **Jupiter**：仅保留 Solana 网络组合，且 build 阶段必须验证返回 `data.tx`。
- 探测失败（空路由/缺关键上下文）的组合，单独归档为预期失败，不混入成功用例。

---

## 📁 输出文件格式

### 测试用例 JSON 格式

遵循 Postman Collection v2.1 规范：

```json
{
  "info": {
    "name": "集合名称",
    "description": "集合描述",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "变量名",
      "value": "默认值",
      "type": "string",
      "description": "变量说明"
    }
  ],
  "item": [
    {
      "name": "分组名称",
      "item": [
        {
          "name": "用例名称",
          "event": [
            {
              "listen": "prerequest",
              "script": {
                "type": "text/javascript",
                "exec": ["// 前置脚本代码"]
              }
            },
            {
              "listen": "test",
              "script": {
                "type": "text/javascript",
                "exec": ["// 断言脚本代码"]
              }
            }
          ],
          "request": {
            "method": "GET/POST",
            "header": [...],
            "url": {
              "raw": "https://api.onekey.so/earn/v1/borrow/check-amount?amount=0.01",
              "query": [
                {
                  "key": "amount",
                  "value": "0.01"
                  // 注意：只包含 key 和 value，不包含 description、type、required 等元数据
                }
              ]
            },
            "body": {
              "mode": "raw",
              "raw": "{\"amount\": \"0.01\"}"
            }
          }
        }
      ]
    }
  ]
}
```

---

## 🚀 使用示例

### 示例 1：生成 Borrow 模块测试用例

```
用户: /api-testcase 5.19.0 Borrow

AI: 正在为 5.19.0 Borrow 接口集合生成测试用例...

✅ 已生成以下文件：
- docs/testcases/api/5.19.0-Borrow-Apifox-TestCases.json (24 个用例)
- docs/testcases/api/5.19.0-Borrow-导入说明.md

导入步骤：
1. 打开 Apifox → 设置 → 导入数据
2. 选择 Postman Collection v2 格式
3. 上传 TestCases.json 文件
```

### 示例 2：查看单个接口详情

```
用户: /api-read /earn/v1/borrow/markets

AI: ## 接口详情：获取 Market 列表

- **路径**：GET /earn/v1/borrow/markets
- **描述**：获取支持的借贷市场列表
...
```

### 示例 3：为单个接口生成用例

```
用户: /api-testcase-single /earn/v1/borrow/check-amount

AI: 为 check-amount 接口生成的测试用例：

{
  "name": "金额校验",
  "event": [...],
  "request": {...}
}
```

---

## ⚙️ 配置项

### 默认配置

在生成测试用例时使用的默认值：

```yaml
# 基础配置
baseUrl: https://api.onekey.so
responseTimeout: 3000  # 响应超时时间 (ms)

# Solana 网络默认值
networkId: sol--101
provider: kamino
marketAddress: 7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF

# 请求头默认值
X-Onekey-Request-Currency: usd
X-Onekey-Request-Locale: en
X-Onekey-Request-Theme: light
X-Onekey-Request-Platform: android-apk
X-Onekey-Request-Version: 5.19.0
X-Onekey-Request-Build-Number: 2000000000
```

### 自定义配置

可通过指令参数覆盖默认配置：

```
/api-testcase 5.19.0 Borrow --network=eth--1 --version=5.20.0
```

---

## 📚 相关资源

- [Apifox 导入文档](https://apifox.com/help/api-docs/import)
- [Postman Collection 格式](https://schema.postman.com/)
- [项目 QA 规则](../../qa-rules.md)
- [Swap 模块测试规则](../../qa/rules/swap-rules.md)（生成 Swap API 用例前必读）
- [Swap 网络特性](../../qa/rules/swap-network-features.md)

---

## 🔄 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| 1.3.0 | 2026-02-28 | 新增 5. Swap 模块 API 测试规则：询价必含 query/denySingleSwapProvider、url.query 显式、兑换类型与渠道网络矩阵、构建接口 body、集合组织方式 |
| 1.2.0 | 2026-02-02 | 重构断言方案：前置脚本+统一后置脚本，支持 CEX/合约/诈骗场景自动识别 |
| 1.1.1 | 2026-02-02 | 修正 displayType 映射（warning/default），精简代码示例 |
| 1.1.0 | 2026-02-02 | 新增 3.1 标签断言规则，规范交易解析类接口的标签验证 |
| 1.0.0 | 2026-01-05 | 初始版本，支持基础测试用例生成 |
