# OneKey Desktop TF 主流程 Nightly 巡检报告

- Run ID: `onekey-desktop-tf-checklist-nightly-2026-06-23`
- 运行时间: 2026/6/23 10:08:14 CST
- 应用版本: "CFBundleIdentifier" => "so.onekey.wallet";   "CFBundleShortVersionString" => "6.5.0";   "CFBundleVersion" => "20260621500"
- CDP: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) OneKeyWallet/6.5.0 Chrome/142.0.7444.265 Electron/39.8.9 Safari/537.36`
- Checklist: `desktop-tf` / `Desktop-TF 包`
- Checklist caseIds: 33
- 结果快照: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-23-run-state.json`
- 执行日志: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-23/execution.log`

## Checklist 汇总

| 指标 | 数量 |
| --- | ---: |
| 总数 | 33 |
| 通过 | 21 |
| 失败 | 12 |
| 阻塞 | 0 |

## 失败 Case

| Case ID | 结果 | 原因 | 结果文件 / 截图 |
| --- | --- | --- | --- |
| `MARKET-CHART-002` | FAILED | 获取可用时间周期列表: No time intervals found | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/MARKET-CHART-002.json` |
| `MARKET-CHART-003` | FAILED | K 线类型按钮存在: K线图 button not found | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/MARKET-CHART-003.json` |
| `MARKET-CHART-005` | FAILED | 切换 15 分钟 加载时间: page.evaluate: Error: Error invoking remote method 'GUEST_VIEW_MANAGER_CALL': Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error. | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/MARKET-CHART-005.json` |
| `MARKET-CHART-006` | FAILED | 重置布局到默认状态: page.evaluate: Error: Error invoking remote method 'GUEST_VIEW_MANAGER_CALL': Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error. | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/MARKET-CHART-006.json` |
| `MARKET-CHART-007` | FAILED | Cannot click main tab: 热门 | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/MARKET-CHART-007.json` |
| `MARKET-CHART-008` | FAILED | 实时数据更新观察: page.evaluate: Error: Error invoking remote method 'GUEST_VIEW_MANAGER_CALL': Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error. | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/MARKET-CHART-008.json` |
| `MARKET-FAV-001` | FAILED | Cannot click recommended token "ChainLink Token" | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/MARKET-FAV-001.json` |
| `MARKET-HOME-001` | FAILED | 首页入口与布局校验: Unexpected search placeholder: 搜尋任何內容 | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/MARKET-HOME-001.json` |
| `MARKET-HOME-003` | FAILED | 热门榜单筛选点击后列表保持可见: Trending list state not confirmed | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/MARKET-HOME-003.json` |
| `MARKET-HOME-004` | FAILED | 合约二级筛选项完整: Missing filters: 加密货币, 指数, 外汇, 预上市 | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/MARKET-HOME-004.json` |
| `MARKET-HOME-005` | FAILED | 热门代币表头字段校验: Trending token headers insufficient: 市值 | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/MARKET-HOME-005.json` |
| `NIGHTLY-PORTFOLIO-001` | FAILED | 切换到所有网络: all-networks +N network trigger not found | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/NIGHTLY-PORTFOLIO-001.json` |

## 录制主流程覆盖

| 流程 | 结果 | 证据 |
| --- | --- | --- |
| 创建钱包 | FAIL | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/WALLET-001.json` |
| 导入钱包入口 | BLOCKED | Account selector 可打开，但当前状态未出现 `account-add-account`，未进入导入入口。截图目录：`/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-23-import-probe` |
| 导入助记词页 | BLOCKED | 未能进入导入入口；未输入任何助记词。 |
| 导入私钥页 | BLOCKED | 未能进入导入入口；未输入任何私钥。 |

## 页面 UI 巡检

- Wallet: PASSED, textLen=1904, screenshot `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-23-ui-probe/Wallet-ui-probe.png`
- Market: PASSED, textLen=8794, screenshot `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-23-ui-probe/Market-ui-probe.png`
- Swap: PASSED, textLen=355, screenshot `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-23-ui-probe/Swap-ui-probe.png`
- Perps: PASSED, textLen=591, screenshot `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-23-ui-probe/Perps-ui-probe.png`
- DeFi: PASSED, textLen=351, screenshot `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-23-ui-probe/DeFi-ui-probe.png`
- Browser: PASSED, textLen=386, screenshot `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-23-ui-probe/Browser-ui-probe.png`

## 所有网络地址流程

- Step 0 PASS: 已选择软件钱包 `ran / piggy🐷`。
- 失败点: `all-networks +N network trigger not found`，未能进入全选网络与 `创建地址 & 应用`。
- 复制地址列表校验: 未执行到复制地址列表；因此没有可列出的残留 `创建地址` 网络清单，本 case 按失败计。

## 本轮维护

- 修复运行时 sidebar selector：`shared/ui-map.json` 中 Wallet/Market/Swap/Perps/DeFi/Browser 改为优先使用 sidebar `data-testid`。
- 增加 Market tab 繁体中文别名支持，并用 `node --test src/tests/shared/market/market-tabs.test.mjs src/tests/desktop/utility/nightly-portfolio-account-text.test.mjs` 验证通过。
- 知识沉淀：`K-168`（sidebar testid 优先）、`K-169`（Market 繁体别名）。
