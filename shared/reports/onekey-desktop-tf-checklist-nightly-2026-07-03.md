# OneKey Desktop TF Nightly 巡检报告

- Run ID: `onekey-desktop-tf-checklist-nightly-2026-07-03`
- 执行时间: 2026-07-03 00:40:10 CST +0800 / 2026-07-02T16:40:10Z
- 应用版本: OneKey Desktop TF `6.5.0` (CFBundleVersion `20260702760`; runtime buildNumber `2026070276`)
- Checklist: `Desktop-TF 包` (`desktop-tf`)
- Checklist caseIds (35): `SEARCH-UTIL-001`, `SEARCH-UTIL-002`, `SEARCH-UTIL-004`, `SEARCH-UTIL-005`, `SEARCH-UTIL-006`, `SEARCH-UTIL-007`, `MARKET-CHART-001`, `MARKET-CHART-002`, `MARKET-CHART-003`, `MARKET-CHART-004`, `MARKET-CHART-005`, `MARKET-CHART-006`, `MARKET-CHART-007`, `MARKET-CHART-008`, `MARKET-FAV-001`, `MARKET-FAV-002`, `MARKET-FAV-003`, `MARKET-FAV-004`, `MARKET-FAV-005`, `MARKET-FAV-006`, `MARKET-FAV-007`, `MARKET-HOME-001`, `MARKET-HOME-002`, `MARKET-HOME-003`, `MARKET-HOME-004`, `MARKET-HOME-005`, `MARKET-HOME-006`, `MARKET-SEARCH-001`, `MARKET-SEARCH-002`, `MARKET-SEARCH-004`, `MARKET-SEARCH-005`, `MARKET-SEARCH-003`, `NIGHTLY-PORTFOLIO-001`, `WALLET-IMPORT-001`, `WALLET-IMPORT-002`
- 权威结果快照: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-07-03-run-state.json`
- 汇总 JSON: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/onekey-desktop-tf-checklist-nightly-2026-07-03.json`

## Checklist 结果

- PASS: 29
- FAIL: 4
- BLOCKED: 2
- SKIPPED/PENDING: 0
- TOTAL: 35

| Case | Status | 原因 | 结果文件 |
|---|---:|---|---|
| `MARKET-FAV-003` | FAILED | Token detail did not open after clicking "BTC" | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/MARKET-FAV-003.json` |
| `MARKET-SEARCH-002` | FAILED | No visible results/empty state detected | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/MARKET-SEARCH-002.json` |
| `MARKET-SEARCH-003` | FAILED | No visible results/empty state detected | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/MARKET-SEARCH-003.json` |
| `NIGHTLY-PORTFOLIO-001` | FAILED | Step 0 前置: 回到钱包首页: wallet shell not ready after navigation | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/NIGHTLY-PORTFOLIO-001.json` |
| `WALLET-IMPORT-001` | BLOCKED | Not rerun in this automation after OneKey entered boot recovery and CDP became unavailable. | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/WALLET-IMPORT-001.json` |
| `WALLET-IMPORT-002` | BLOCKED | Not rerun in this automation after OneKey entered boot recovery and CDP became unavailable. | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/WALLET-IMPORT-002.json` |

## 关键额外覆盖

| 流程 | Status | 说明 |
|---|---:|---|
| 创建钱包 `WALLET-001` | BLOCKED | OneKey 在 portfolio 失败后的恢复重启中触发 `Boot fail count: 3` / `Recovery page triggered`，CDP 不可用，未执行。 |
| 导入钱包 `WALLET-IMPORT-001` | BLOCKED in this run | 未在本轮重跑；已有较早结果文件显示 2026-07-02T12:38:47Z 通过，不计入本轮 PASS。 |
| 导入私钥 `WALLET-IMPORT-002` | BLOCKED in this run | 未在本轮重跑；已有较早结果文件显示 2026-07-02T12:39:44Z 通过，不计入本轮 PASS。 |
| 页面 UI 巡检 | BLOCKED | OneKey recovery 后进程退出，无法继续 UI patrol。 |
| 投资组合全网络创建地址 | FAIL | `NIGHTLY-PORTFOLIO-001` 在 Step 0 失败：wallet shell not ready after navigation；复制地址列表未到达。 |

## 断言结论

- 页面不能白屏/空白无数据: 已执行的 Universal Search 与 Market 模块未观察到白屏；UI patrol 因 OneKey boot recovery 未执行。
- 关键流程必须可继续操作: Universal Search、Market 图表/首页主体可继续；Market 收藏详情打开、Market 搜索部分输入、Portfolio 钱包首页前置存在失败。
- 复制地址列表不能残留 `创建地址`: 未到达复制地址列表；无法验证残留网络。
- 残留网络列表: 未采集。

## 主要失败与阻塞

- `MARKET-FAV-003`: Token detail did not open after clicking "BTC". 截图: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/market-favorite/MARKET-FAV-003-error.png`
- `MARKET-SEARCH-002`: No visible results/empty state detected. 截图: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/market-search/MARKET-SEARCH-002-error.png`
- `MARKET-SEARCH-003`: No visible results/empty state detected. 截图: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/market-search/MARKET-SEARCH-003-error.png`
- `NIGHTLY-PORTFOLIO-001`: wallet shell not ready after navigation. 截图: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly-portfolio-all-networks-create-address/NIGHTLY-PORTFOLIO-001-Step-0-前置:-回到钱包首页-fail.png`
- OneKey 环境阻塞: recovery 启动日志 `/tmp/onekey-desktop-tf-nightly-onekey.log`，关键行 `Boot fail count: 3` / `Recovery page triggered`。

## Artifact 路径

- Run state: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-07-03-run-state.json`
- Result JSON: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/onekey-desktop-tf-checklist-nightly-2026-07-03.json`
- Report: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/reports/onekey-desktop-tf-checklist-nightly-2026-07-03.md`
- Universal Search summary: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/universal-search-summary.json`
- Market Chart summary: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/market-chart-desktop-summary.json`
- Market Favorite summary: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/market-favorite-summary.json`
- Market Home summary: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/market-home-summary.json`
- Market Search summary: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/market-search-summary.json`
- Portfolio summary: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly-portfolio-all-networks-create-address-summary.json`
- OneKey launch log: `/tmp/onekey-desktop-tf-nightly-onekey.log`
