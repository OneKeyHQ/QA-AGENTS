# 测试用例文件夹（自动落盘）

> **强制规范**：所有生成的测试用例文件必须统一保存到本目录（`docs/qa/testcases/cases/`），并按模块自动分类到对应的子目录。
>
> **权威来源**：目录映射规则以 `docs/qa/qa-rules.md` 第 7.0 节为准。

本目录用于存放生成的结构化测试用例文件。

## 目录结构

```
docs/qa/testcases/
├── cases/                          # 测试用例根目录（允许上传 GitHub）
│   ├── account/                    # 账户模型（HD钱包、硬件钱包、观察账户、派生、备份）
│   ├── wallet/                     # Wallet 模块（转账、首页、Token、NFT、历史、法币）
│   ├── swap/                       # Swap 模块
│   ├── market/                     # Market 模块（行情、Swap Pro Mode）
│   ├── perps/                      # Perps 合约模块
│   ├── prime/                      # Prime 模块
│   ├── referral/                   # 返佣模块
│   ├── defi/                       # DeFi 模块（借贷、质押）
│   ├── browser/                    # Browser/DApp 模块
│   ├── utility/                    # 通用业务（设置、地址簿、通知、扫码、升级）
│   ├── hardware/                   # 硬件钱包交互（硬件转账、Swap、派生、设备功能）
│   ├── other/                      # 其他未分类模块（兜底）
│   └── README.md                   # 本文件
├── checklist/                      # Checklist 文件（排除 GitHub）
├── performance/                    # 性能报告（排除 GitHub）
└── api/                            # API 测试用例（允许上传 GitHub）
```

## 模块自动分类规则

### 模块名称映射表

> **说明**：与 `docs/qa/qa-rules.md` 第 7.0 节保持一致

| 一级模块 | 模块名（文件名中） | 目录名 | 包含功能/说明 |
|---------|-----------------|--------|-------------|
| **账户模型** | `Account` / `账户` / `AccountModel` | `account/` | 硬件钱包与软件钱包、观察账户与外部账户、私钥/公钥与账户派生、钱包账户管理、软件钱包备份 |
| **Wallet** | `Wallet` / `钱包` / `Transfer` / `转账` | `wallet/` | 转账规则（所有链）、钱包首页、Network、Token、历史记录、NFT、法币出入金、授权、BTC UTXO 管理 |
| **Swap** | `Swap` | `swap/` | Swap 兑换功能 |
| **Market** | `Market` / `市场` / `Swap-Pro-Mode` | `market/` | 行情功能、Swap Pro Mode（Token 详情页快捷兑换） |
| **Perps** | `Perps` / `合约` / `Hyperliquid` | `perps/` | Perps 合约功能 |
| **Prime** | `Prime` | `prime/` | Prime 功能 |
| **返佣** | `Referral` / `返佣` / `推荐` | `referral/` | 返佣/推荐功能 |
| **DeFi** | `DeFi` / `Defi` | `defi/` | DeFi 功能（含借贷、质押等） |
| **Browser** | `Browser` / `DApp` / `Dapp` / `dApp` / `浏览器` | `browser/` | 浏览器/DApp 功能 |
| **通用业务** | `Utility` / `通用` / `Setting` / `设置` / `Notification` / `通知` | `utility/` | 设置、地址簿、通知、网络选择器、App 升级、通用搜索、扫码、手势、AppTable、快捷键 |
| **HW & App** | `HW` / `Hardware` / `硬件` / `HWApp` | `hardware/` | 硬件转账、硬件 Swap、硬件派生、硬件设备功能 |
| 其他未匹配 | - | `other/` | 兜底目录 |

### 二级功能自动归类规则

| 二级功能关键词 | 自动归类到 |
|--------------|-----------|
| `派生` / `Derive` / `备份` / `Backup` / `助记词` / `Mnemonic` / `私钥` / `PrivateKey` | `account/` |
| `NFT` / `UTXO` / `历史` / `History` / `授权` / `Approval` / `法币` / `Fiat` | `wallet/` |
| `地址簿` / `AddressBook` / `扫码` / `Scan` / `升级` / `Upgrade` | `utility/` |

### 自动识别规则

1. 从文件名中提取模块名
   - 文件名格式：`YYYY-MM-DD_<模块>-<主题>.md`
   - 提取第一个 `-` 之前的内容作为模块名
2. 匹配规则：
   - 模块名匹配不区分大小写（`Wallet` = `wallet` = `WALLET`）
   - 优先匹配英文模块名，如果匹配不到再匹配中文模块名
   - 中文模块名需要完整匹配（"钱包"匹配，但"钱包管理"不匹配）
3. 如果无法识别模块，使用 `other/` 目录作为兜底

### 示例

- `2026-01-07_Wallet-Stellar (XLM)-软件钱包测试.md` → `wallet/`
- `2026-01-04_Market-Token收藏取消收藏.md` → `market/`
- `2025-12-31_DeFi-Borrow首页测试.md` → `defi/`
- `2026-01-03_Perps-限价单最优价格BBO.md` → `perps/`
- `2026-01-04_Hyperliquid-ApproveAgent推荐绑定.md` → `perps/`
- `2026-01-16_Hardware-设备管理5.20.0改版测试.md` → `hardware/`
- `2026-01-07_Account-助记词备份测试.md` → `account/`

## 命名规范

- 文件名格式：`YYYY-MM-DD_<模块>-<测试主题>.md`
- 转账模块特殊规则：软件钱包和硬件钱包分开输出
  - 软件钱包：`YYYY-MM-DD_Transfer-<链名>-软件钱包测试.md` → `wallet/`
  - 硬件钱包：`YYYY-MM-DD_Hardware-<链名>-硬件钱包测试.md` → `hardware/`

## 内容规范

- 文件内容必须遵守：`docs/qa/qa-rules.md`
- 文件内必须可直接渲染为 Markdown 表格（禁止在最外层包裹 ``` 代码块）
- 表格单元格内多行内容必须使用 `<br>` 分隔

## GitHub 上传规则

- ✅ `docs/qa/testcases/cases/` - 允许上传
- ✅ `docs/qa/testcases/api/` - 允许上传
- ❌ `docs/qa/testcases/checklist/` - 排除上传（内部使用）
- ❌ `docs/qa/testcases/performance/` - 排除上传（内部使用）
