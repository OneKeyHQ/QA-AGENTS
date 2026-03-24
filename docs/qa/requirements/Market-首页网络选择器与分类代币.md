# Market - 首页网络选择器与分类代币需求文档

> **模块**：Market（行情）
> **功能名称**：首页网络选择器与分类代币
> **版本**：
> **测试端**：Desktop / Mobile

---

## 1. 需求背景

Market 首页需要优化筛选效率与榜单浏览体验。本次改动聚焦首页交互：网络选择器位置与显示逻辑、时间区间选择方式、分类榜单展示方式。

---

## 2. 功能描述

### 2.1 网络选择器优化

| 规则项 | 规则描述 |
|-------|---------|
| 位置 | 网络选择器移动到右上角 |
| 显示条件 | 仅在「现货」Tab 下显示 |
| 默认值 | 默认选中「全部」 |
| 快捷项 | 显示 5 个快捷项：All Network / BSC / Solana / Base / Ethereum |
| 更多网络 | 支持展开完整网络列表选择 |

### 2.2 时间区间选择器

| 规则项 | 规则描述 |
|-------|---------|
| 交互方式 | 下拉菜单（Dropdown） |
| 可选项 | 5 分钟 / 1 小时 / 4 小时 / 24 小时 |
| 默认值 | 1 小时 |
| 联动要求 | 选择值需同步作用于榜单数据请求 |

### 2.3 列表分类改造（榜单 Tab）

| 分类 | 数据来源 | 说明 |
|------|---------|------|
| Trending（默认） | 热门代币接口 `hot-token` | `rankingType=4` |
| X Mentioned | 热门代币接口 `hot-token` | `rankingType=5` |
| 其他分类（如 AI / Stocks / Precious metal） | Dashboard 配置数据 | 按配置下发 |

### 2.4 平台适配

| 规则项 | 规则描述 |
|-------|---------|
| 适配范围 | Desktop 与 Mobile 首页均需适配 |
| 改动范围 | 本次仅首页改动，其他页面不在本需求范围 |

---

## 3. 接口与参数口径

### 3.1 代币榜单接口（toplist）

| 参数 | 规则 |
|------|------|
| `chains` | 必填；「全部」时传支持链集合 |
| `sortBy` | 支持交易量/市值等排序 |
| `timeFrame` | `1`=5m, `2`=1h, `3`=4h, `4`=24h |

### 3.2 热门代币接口（hot-token）

| 参数 | 规则 |
|------|------|
| `rankingType` | `4`=Trending, `5`=X Mentioned |
| `chainIndex` | 选填；「全部」可不传 |
| `rankingTimeFrame` | 与时间区间选择器联动 |

---

## 4. 实现注意事项

| 场景 | 规则 |
|------|------|
| 非现货 Tab | 不显示网络选择器 |
| 全部网络 | `toplist` 需要显式传全部链 |
| 全部网络（hot-token） | 可不传 `chainIndex` |
| 列表上限 | 每次最多返回 100 条 |

---

## 5. 关联资源

- `OK-51256`
- `OK-51690`
- `https://www.figma.com/design/Z7xLtKOKlj9EZSxC0fccUr/📈-Market?node-id=23269-28665&t=a5GSBR515dLnX4gp-1`
- `https://web3.okx.com/zh-hans/onchainos/dev-docs/market/market-token-ranking`
- `https://web3.okx.com/zh-hans/onchainos/dev-docs/market/market-token-advanced-info`

---

## 6. 变更记录

| 日期 | 变更内容 |
|------|------|
| 2026-03-24 | 新增需求文档：首页网络选择器与分类代币（来源：OK-51256/OK-51690） |
