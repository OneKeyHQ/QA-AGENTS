# 测试用例文件夹（自动落盘）

> **强制规范**：所有生成的测试用例文件必须统一保存到本目录（`docs/testcases/cases/`），并按模块自动分类到对应的子目录。

本目录用于存放生成的结构化测试用例文件。

## 目录结构

```
docs/testcases/
├── cases/                          # 测试用例根目录（允许上传 GitHub）
│   ├── wallet/                     # 钱包模块
│   ├── transfer/                   # 转账模块
│   ├── swap/                       # Swap 模块
│   ├── market/                     # Market 模块
│   ├── defi/                       # DeFi 模块
│   ├── perps/                      # Perps 模块
│   ├── dapp/                       # DApp 模块
│   ├── referral/                   # 返佣模块
│   ├── notification/               # 通知模块
│   ├── security/                   # 风控模块
│   ├── nft/                        # NFT 模块
│   ├── other/                      # 其他未分类模块（兜底）
│   └── README.md                   # 本文件
├── checklist/                      # Checklist 文件（排除 GitHub）
├── performance/                    # 性能报告（排除 GitHub）
└── api/                            # API 测试用例（允许上传 GitHub）
```

## 模块自动分类规则

### 模块名称映射表

| 模块名（文件名中） | 目录名 | 说明 |
|-----------------|--------|------|
| `Wallet` / `钱包` | `wallet/` | 钱包模块 |
| `Transfer` / `转账` | `transfer/` | 转账模块 |
| `Swap` | `swap/` | Swap 模块 |
| `Market` / `市场` | `market/` | Market 模块 |
| `DeFi` / `Defi` | `defi/` | DeFi 模块 |
| `Perps` / `合约` / `Hyperliquid` | `perps/` | Perps 模块 |
| `DApp` / `Dapp` / `dApp` | `dapp/` | DApp 模块 |
| `返佣` / `Referral` | `referral/` | 返佣模块 |
| `通知` / `Notification` | `notification/` | 通知模块 |
| `风控` / `Security` | `security/` | 风控模块 |
| `NFT` | `nft/` | NFT 模块 |
| 其他未匹配 | `other/` | 兜底目录 |

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

## 命名规范

- 文件名格式：`YYYY-MM-DD_<模块>-<测试主题>.md`
- 转账模块特殊规则：软件钱包和硬件钱包分开输出
  - 软件钱包：`YYYY-MM-DD_Wallet-<链名>-软件钱包测试.md`
  - 硬件钱包：`YYYY-MM-DD_Wallet-<链名>-硬件钱包测试.md`

## 内容规范

- 文件内容必须遵守：`docs/qa-rules.md`
- 文件内必须可直接渲染为 Markdown 表格（禁止在最外层包裹 ``` 代码块）
- 表格单元格内多行内容必须使用 `<br>` 分隔

## GitHub 上传规则

- ✅ `docs/testcases/cases/` - 允许上传
- ✅ `docs/testcases/api/` - 允许上传
- ❌ `docs/testcases/checklist/` - 排除上传（内部使用）
- ❌ `docs/testcases/performance/` - 排除上传（内部使用）
