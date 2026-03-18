# Pendle 协议 - 代币列表 & 询价 & 构建交易 & Fee 验证 导入说明

> 生成日期：2026-03-09<br>
> 更新日期：2026-03-13（6.1.0 补充接口 + 压力/限频测试）<br>
> 关联需求：`docs/qa/requirements/DeFi-Pendle协议.md`<br>
> 规则文档：`docs/qa/rules/defi-rules.md`（第 2 章 Pendle）

---

## 文件说明

| 文件 | 说明 |
|------|------|
| `Pendle-Swap-Quote-BuildTx-Apifox-TestCases.json` | 测试用例集合（Postman Collection v2.1 格式，**44 个用例**，含 6.1.0 补充与压力测试） |
| `Pendle-Swap-Quote-BuildTx-导入说明.md` | 本文件 |

---

## 核心测试逻辑

```
1. 协议代币列表 → 通过 available-assets 获取所有 Pendle 协议代币 + vault 地址
       ↓
2. 询价 + Fee 验证 → 4 网络 × 8 协议代币 × 多种输入代币，内嵌 OneKey Fee 验证
       ↓
3. 构建交易 → Buy (stake) / Sell Early (unstake)
       ↓
4. 到期验证 → 已到期市场不返回 onekey fee（不收佣金）
```

---

## 网络与协议代币覆盖

通过 `GET /earn/v2/available-assets?provider=pendle` 发现 **4 个网络共 102 个 Pendle 资产**。

| 网络 | networkId | 资产数 | 测试覆盖协议 |
|------|-----------|--------|-------------|
| **Ethereum** | evm--1 | 77 | USDe, sUSDe, weETH, wstETH, sENA, uniBTC-scaled18 |
| **Arbitrum** | evm--42161 | 15 | weETH, wstETH, gUSDC |
| **BNB Chain** | evm--56 | 7 | slisBNB, uniBTC-scaled18 |
| **Base** | evm--8453 | 3 | uniBTC-scaled18 |

**多网络代币**：`uniBTC-scaled18` 在 ETH / BNB / Base 三条链均有部署，已分别覆盖测试。

---

## 涉及接口

| # | 接口 | Method | 用途 |
|---|------|--------|------|
| 1 | `/earn/v2/available-assets` | GET | **协议代币列表**：获取所有 Pendle 资产 + vault 地址 + 网络 |
| 2 | `/earn/v2/stake-protocol/detail` | GET | **协议详情**：获取 vault 代币、APY、到期日 |
| 3 | `/earn/v1/asset-list` | GET | **可 swap 代币列表**：获取 vault 支持的 input/output 代币 |
| 4 | `/earn/v1/transaction-confirmation` | GET | **询价 + Fee 验证**：预览交易详情，包含 OneKey Fee 明细 |
| 5 | `/earn/v2/stake` | POST | **Buy 构建交易**：生成购买 PT 的链上交易数据 |
| 6 | `/earn/v2/unstake` | POST | **Sell Early 构建交易**：生成提前出售 PT 的链上交易数据 |
| 7 | `/earn/v1/positions` | POST | 查询 Pendle 仓位 |
| 8 | `/earn/v1/apy/history` | GET | **6.1.0 补充**：Pendle APY 历史图表数据 |
| 9 | `/earn/v2/recommend` | POST | **6.1.0 补充**：推荐资产（返回中含 Pendle 协议） |

---

## 测试分组（9 个分组，44 个用例）

| 分组 | 用例数 | 对应接口 | 关键断言 |
|------|--------|----------|----------|
| 1. 协议详情 + vault 信息 | 2 | `stake-protocol/detail` | "Pendle 代币列表数据获取正常" + 到期日 |
| 2. 可 swap 代币列表 | 5 | `asset-list` | "swap 代币列表数据获取正常" |
| 3. Buy 询价 + OneKey Fee 验证（**4 网络 × 8 协议**） | **16** | `transaction-confirmation` | "onekey fee 验证成功" |
| 4. Buy 构建交易 | 6 | `earn/v2/stake` | "返回 tx 和 orderId" |
| 5. Sell Early 构建交易 | 5 | `earn/v2/unstake` | "返回 tx 和 orderId" |
| 6. 仓位查询 | 2 | `earn/v1/positions` | 响应正常 |
| 7. 边界与异常 | 3 | `earn/v2/stake` | 异常码校验 |
| **8. Pendle 补充接口（6.1.0）** | **2** | `apy/history`、`recommend` | APY 历史数据、推荐资产含 Pendle |
| **9. 压力/限频测试** | **3** | `transaction-confirmation`、`available-assets`、`asset-list` | 单次请求非 429；建议 Runner 20 次迭代观察限频 |

---

## 询价覆盖矩阵（第 3 组详情）

### Ethereum（evm--1）- 9 个用例

| # | 协议代币 | 输入代币 | Vault 地址 | 到期日 |
|---|---------|---------|-----------|--------|
| 3.1 | USDe | ETH | `0xA3336f...` | 07 May 2026 |
| 3.2 | USDe | USDT (dec=6) | `0xA3336f...` | 07 May 2026 |
| 3.3 | USDe | DAI (dec=18) | `0xA3336f...` | 07 May 2026 |
| 3.4 | sUSDe | USDC (dec=6) | `0x8dAe8E...` | 07 May 2026 |
| 3.5 | sUSDe | LINK | `0x8dAe8E...` | 07 May 2026 |
| 3.6 | **weETH** | ETH | `0x95a950...` | 25 Jun 2026 |
| 3.7 | **wstETH** | ETH | `0x342808...` | 30 Dec 2027 |
| 3.8 | **sENA** | ETH | `0xeab7b7...` | 30 Apr 2026 |
| 3.9 | **uniBTC-scaled18** | ETH | `0xd62552...` | 25 Jun 2026 |

### Arbitrum（evm--42161）- 3 个用例

| # | 协议代币 | 输入代币 | Vault 地址 | 到期日 |
|---|---------|---------|-----------|--------|
| 3.10 | **weETH** | ETH | `0x46d62a...` | 25 Jun 2026 |
| 3.11 | **wstETH** | ETH | `0xf78452...` | 25 Jun 2026 |
| 3.12 | **gUSDC** | USDC (ARB) | `0x0934e5...` | 25 Jun 2026 |

### BNB Chain（evm--56）- 2 个用例

| # | 协议代币 | 输入代币 | Vault 地址 | 到期日 |
|---|---------|---------|-----------|--------|
| 3.13 | **slisBNB** | BNB | `0x3c1a3d...` | 25 Jun 2026 |
| 3.14 | **uniBTC-scaled18** | BNB | `0x215580...` | 25 Jun 2026 |

### Base（evm--8453）- 1 个用例

| # | 协议代币 | 输入代币 | Vault 地址 | 到期日 |
|---|---------|---------|-----------|--------|
| 3.15 | **uniBTC-scaled18** | ETH | `0xb2ba97...` | 25 Jun 2026 |

### 到期验证 - 1 个用例

| # | 说明 |
|---|------|
| 3.16 | 已到期市场 - 验证不返回 onekey fee（到期后不收佣金） |

---

## OneKey Fee 验证逻辑

Fee 数据来源：`transaction-confirmation` 响应的 `transactionDetails.data.transactionDetails` 中 `title.text === "费用"` 的项目。

```
费用明细路径: transactionDetails.data.transactionDetails[].button.data.items[]
  - "总费用": "0.13%"
  - "服务商费用 (Pendle) 0.01%": "0.01%"
  - "兑换手续费 (OneKey) 0.12%": "0.12%"
```

**验证规则（已内嵌在第 3 组询价用例中）：**
- 找到 OneKey fee 百分比
- 如果 OneKey fee > 0：到期收益率必须 > fee（佣金 < 收益 → 走 OneKey 渠道）
- 如果 OneKey fee = 0：走 Pendle 渠道，不收取佣金
- **已到期市场**：接口不返回 onekey fee 字段，或 fee = 0（不收佣金）

**注意事项：**
- **inputToken/outputToken 合约地址必须全小写**，混合大小写（ERC-55 checksum）会导致 API 返回 "Token not found"
- **vault 地址需保持原始大小写**（与 `available-assets` 返回的一致），部分 vault 地址为混合大小写

---

## PT 地址获取方式

询价时的 `outputTokenAddress` 为 Pendle 的 PT（Principal Token）合约地址，获取方式：

1. 调用 Pendle 公开 API：`https://api-v2.pendle.finance/core/v1/{chainId}/markets/active?limit=200`
2. 从响应的 `markets[]` 数组中，按 `address` 字段匹配 OneKey 的 vault 地址
3. 匹配到的 market 对象中 `pt` 字段格式为 `"chainId-0xPTAddress"`，取 `-` 后半段即为 PT 地址

**PT 地址不可从 `stake-protocol/detail` 或 `asset-list` 获取**，这些接口返回的是底层协议代币地址而非 PT 地址。

---

## 压力/限频测试说明（第 9 组）

目的：验证**询价**与**获取资产列表**在短时间多次请求下是否触发限频（429）。

| 用例 | 接口 | 操作建议 |
|------|------|----------|
| 9.1 询价接口 | `GET /earn/v1/transaction-confirmation` | Collection Runner 中对该用例设置 **20 次迭代**，运行后查看是否有任意一次返回 429 |
| 9.2 获取资产列表 | `GET /earn/v2/available-assets?provider=pendle` | 同上，20 次迭代 |
| 9.3 可 swap 代币列表 | `GET /earn/v1/asset-list`（USDe vault） | 同上，20 次迭代 |

- 若 20 次均返回 200 且业务码 0，则当前未触发限频。
- 若出现 429，需记录触发次数与迭代顺序，便于后端调整限频策略。

---

## 导入步骤

1. 打开 Apifox → 项目设置 → 导入数据
2. 选择 **Postman Collection v2** 格式
3. 上传 `Pendle-Swap-Quote-BuildTx-Apifox-TestCases.json`
4. 导入后在「测试用例」中查看分组
5. 运行前确认集合变量 `baseUrl` 指向正确环境
6. Header 使用 Apifox 全局 Header（**X-Onekey-Request-Version: 6.1.0**）
