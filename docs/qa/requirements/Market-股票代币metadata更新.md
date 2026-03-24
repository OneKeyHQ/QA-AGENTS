# Market - 股票代币 metadata 更新需求文档

> **模块**：Market（行情）
> **功能名称**：股票代币 metadata 更新（Tokenized Securities Fundamentals）
> **版本**：
> **测试端**：iOS / Android / Extension / Desktop / Web

---

## 1. 需求背景

当前 Market Token 详情页主要展示链上 metadata（流动性、持有人、交易量等）。对 Ondo 发行的证券化代币（如 GOOGLon、SPYon、TSLAon），用户更关注底层股票/ETF 的基本面信息，因此需要在 Token 详情页增加基本面展示与降级逻辑。

---

## 2. 功能描述

### 2.1 代币到股票映射

| 规则项 | 规则描述 |
|-------|---------|
| 主映射源 | 使用人工维护映射表：`contract_address + network -> stock_ticker` |
| 覆盖范围 | Ondo 已发行的证券化代币 |
| status 字段 | `confirmed`、`auto_verified`、`unverified` |
| 展示条件 | `status` 为 `confirmed` 或 `auto_verified` 时可展示基本面数据 |

### 2.2 自动 fallback 映射

| 规则项 | 规则描述 |
|-------|---------|
| 触发条件 | 主映射表未命中 |
| 发行商识别 | 使用 CoinGecko category（如 `ondo-tokenized-assets`）识别发行商 |
| ticker 解析 | Ondo 命名规则：`{ticker}on`，如 `GOOGLon -> GOOGL` |
| 异常检测 | 代币价格与股票价格偏差超过阈值（建议 10%）时，不匹配并回退默认 metadata |

### 2.3 基本面数据来源与指标

| 规则项 | 规则描述 |
|-------|---------|
| 数据源 | Financial Modeling Prep（FMP）或同类金融数据服务 |
| 指标字段 | Market Cap、Shares、PE Ratio、PB Ratio、24h Volume、Volume(Shares)、Turnover Rate、1y Avg Daily Volume、Dividend Yield、Last Dividend Amount、52W High/Low |
| 缓存策略 | 基本面数据每日更新一次，前端读取后端缓存结果 |

### 2.4 前端展示规则

| 规则项 | 规则描述 |
|-------|---------|
| 证券化代币 | 显示股票基本面模块，替代或补充链上 metadata |
| 非证券化代币 | 保持现有链上 metadata 展示 |
| ETF 兼容 | ETF 场景允许 PE 等字段为空，空字段按占位显示 |

---

## 3. 边缘与降级规则

| 场景 | 规则 |
|------|------|
| 映射未命中且自动匹配失败 | 不展示基本面数据，展示现有链上 metadata |
| 金融数据 API 失败/超时 | 优先展示缓存；无缓存时展示现有链上 metadata |
| API 免费额度耗尽 | 展示缓存并触发告警，不阻断页面 |
| 新代币上线但映射未更新 | fallback 成功则按 `auto_verified` 展示；失败则回退默认 metadata |
| 美股非交易时间 | 基本面模块继续展示 |

---

## 4. 关联资源

- Jira: `OK-50643`
- Figma: `https://www.figma.com/design/Z7xLtKOKlj9EZSxC0fccUr/📈-Market?node-id=22754-23478&t=a5GSBR515dLnX4gp-1`
- CoinGecko Category: `https://www.coingecko.com/en/categories/ondo-tokenized-assets`
- FMP API: `https://site.financialmodelingprep.com/developer/docs`

---

## 5. 变更记录

| 日期 | 变更内容 |
|------|------|
| 2026-03-24 | 新增 Market 股票代币 metadata 更新需求文档（OK-50643） |
