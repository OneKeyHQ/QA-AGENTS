# OneKey Desktop TF Nightly 巡检报告

- Run ID: `onekey-desktop-tf-checklist-nightly-2026-07-02`
- 应用版本: OneKey Desktop TF `6.5.0` (build `20260701730`)
- Checklist: `Desktop-TF 包` (`desktop-tf`)
- Checklist caseIds (33): `SEARCH-UTIL-001`, `SEARCH-UTIL-002`, `SEARCH-UTIL-004`, `SEARCH-UTIL-005`, `SEARCH-UTIL-006`, `SEARCH-UTIL-007`, `MARKET-CHART-001`, `MARKET-CHART-002`, `MARKET-CHART-003`, `MARKET-CHART-004`, `MARKET-CHART-005`, `MARKET-CHART-006`, `MARKET-CHART-007`, `MARKET-CHART-008`, `MARKET-FAV-001`, `MARKET-FAV-002`, `MARKET-FAV-003`, `MARKET-FAV-004`, `MARKET-FAV-005`, `MARKET-FAV-006`, `MARKET-FAV-007`, `MARKET-HOME-001`, `MARKET-HOME-002`, `MARKET-HOME-003`, `MARKET-HOME-004`, `MARKET-HOME-005`, `MARKET-HOME-006`, `MARKET-SEARCH-001`, `MARKET-SEARCH-002`, `MARKET-SEARCH-004`, `MARKET-SEARCH-005`, `MARKET-SEARCH-003`, `NIGHTLY-PORTFOLIO-001`
- 权威结果快照: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-07-02-run-state.json`
- 汇总 JSON: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/onekey-desktop-tf-checklist-nightly-2026-07-02.json`

## Checklist 结果

- PASS: 29
- FAIL: 4
- BLOCKED: 0
- SKIPPED/PENDING: 0
- TOTAL: 33

| Case | Status | 失败原因 | 失败步骤 |
|---|---:|---|---|
| `MARKET-CHART-006` | FAIL | 默认 Volume 指标显示: Volume not found. Labels: ["EMA交叉","MACD1226close9EMAEMA","康纳相对强弱指数(CRSI)"] | 默认 Volume 指标显示 |
| `MARKET-FAV-003` | FAIL | Token detail did not open after clicking "BTC" | - |
| `MARKET-SEARCH-002` | FAIL | No visible results/empty state detected | - |
| `MARKET-SEARCH-003` | FAIL | No visible results/empty state detected | - |

## 关键额外覆盖

| 流程 | Status | 说明 |
|---|---:|---|
| 创建钱包 `WALLET-001` | PASS | account: "Account #39" |
| 导入钱包入口 | BLOCKED | 能进入新增钱包页，但点击添加已有钱包后回到钱包首页，未进入导入助记词或私钥页 |
| 导入私钥页 | BLOCKED | 受导入入口阻塞，未到达私钥 tab |
| 页面 UI 巡检 | PASS | Wallet/Market/Swap/Perps/DeFi/Browser 均非白屏 |
| 投资组合全网络创建地址 | PASS | beforeMax=38; selected=Account #39; afterMax=39; network selector create-address apply clicked; missingBefore=64; legacy:取消全选; 6/6 required address groups; remediation=none; copyTargets=32 |

## 导入探针步骤

| 步骤 | Status | 详情 |
|---|---:|---|
| 回到钱包首页 | PASS | wallet home visible |
| 打开账户选择器 | PASS | AccountSelectorTriggerBase |
| 进入新增钱包页 | PASS | 添加已有钱包入口可见 |
| 导入探针异常 | BLOCKED | import phrase/private-key entry not visible: 钱包 市场 交易 合约 DeFi 推荐 浏览器 ⌘ K 78 Account #39 +62 $0.00 充值以开始使用。可随时取回。 充值 现货 DeFi NFT 历史记录 代币 · $0.00 DeFi 代币 BTC Bitcoin 0 $0.00 $60,115.00 +3.29% 兑换 USDT Tether 0 $0.00 $0.999  |

## UI 巡检截图

| 页面 | Status | 内容长度 | 截图 |
|---|---:|---:|---|
| Wallet | PASS | textLen=709 | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-07-02-ui-probe/Wallet-ui-probe.png` |
| Market | PASS | textLen=321 | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-07-02-ui-probe/Market-ui-probe.png` |
| Swap | PASS | textLen=370 | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-07-02-ui-probe/Swap-ui-probe.png` |
| Perps | PASS | textLen=553 | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-07-02-ui-probe/Perps-ui-probe.png` |
| DeFi | PASS | textLen=356 | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-07-02-ui-probe/DeFi-ui-probe.png` |
| Browser | PASS | textLen=328 | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-07-02-ui-probe/Browser-ui-probe.png` |

## 断言结论

- 页面白屏/空白无数据: UI patrol passed on Wallet, Market, Swap, Perps, DeFi, Browser; no blank/white-screen page observed.
- 关键流程可继续操作: Checklist 主体完成；创建钱包通过；导入钱包/私钥入口本轮 blocked。
- 复制地址列表残留 `创建地址`: NIGHTLY-PORTFOLIO-001 passed. 6/6 required address groups; remediation=none; copyTargets=32. No residual 创建地址 networks reported.
- 残留网络列表: 无

## 主要失败

- `MARKET-CHART-006`: 默认 Volume 指标显示: Volume not found. Labels: ["EMA交叉","MACD1226close9EMAEMA","康纳相对强弱指数(CRSI)"]
- `MARKET-FAV-003`: Token detail did not open after clicking "BTC"
- `MARKET-SEARCH-002`: No visible results/empty state detected
- `MARKET-SEARCH-003`: No visible results/empty state detected

## Artifact 路径

- Checklist run-state: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-07-02-run-state.json`
- Wallet create run-state: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-07-02-wallet-create-run-state.json`
- Import probe summary: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-07-02-import-probe/import-probe-summary.json`
- UI probe summary: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-07-02-ui-probe/ui-probe-summary.json`
- Report: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/reports/onekey-desktop-tf-checklist-nightly-2026-07-02.md`
- Result JSON: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/onekey-desktop-tf-checklist-nightly-2026-07-02.json`
