# OneKey Desktop TF 主流程 Nightly 巡检报告

- Run ID: `onekey-desktop-tf-checklist-nightly-2026-06-18`
- 运行时间: 2026-06-18 00:37 CST
- 应用版本: OneKey TF `6.5.0` / build `20260617420` / bundle `so.onekey.wallet`
- CDP: `OneKeyWallet/6.5.0 Chrome/142.0.7444.265 Electron/39.8.9`
- Checklist: `desktop-tf` / `Desktop-TF 包`
- Checklist caseIds: 33
- 结果快照: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-18-run-state.json`
- 执行日志: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-18/execution-node22.log`

## 更新与环境

- TestFlight 更新: 未执行安装。TestFlight 进程可启动，但本轮无可见/可访问窗口，无法安全确认候选 build 是否为 6.x；因此保留当前已安装 6.x build，未安装任何 900 开头版本。
- OneKey 启动: 先清理 stale OneKey，再用 `.env` 中 `ONEKEY_BIN=/Applications/OneKey-3.localized/OneKey.app/Contents/MacOS/OneKey` 以 `--remote-debugging-port=9222` 启动。
- 运行时修正: 首次 wrapper 用 `bash -lc` 触发 Node 18，因 `import.meta.dirname` 不支持导致预执行失败；已改用 Node `v22.22.0` 重新执行，预执行失败未计入产品/用例结果。
- 新增知识沉淀: `K-167`，记录 Desktop TF Nightly 必须用 Node 22+，避免 `bash -lc` 触发系统 Node 18。

## Checklist 汇总

| 指标 | 数量 |
| --- | ---: |
| 总数 | 33 |
| 通过 | 30 |
| 失败 | 3 |
| 阻塞 | 0 |

失败 case:

| Case ID | 结果 | 原因 | 结果文件 / 截图 |
| --- | --- | --- | --- |
| `MARKET-CHART-006` | FAIL | TradingView webview 指标操作失败：`GUEST_VIEW_MANAGER_CALL` script execution error；刷新后 `TV chart not ready within 30000ms`，随后 `TV webview not found`。 | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/MARKET-CHART-006.json`; `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/market-chart/MARKET-CHART-006-指标持久化-(刷新验证)-fail.png` |
| `MARKET-FAV-001` | FAIL | 当前账号已有大量自选，未进入严格空状态；推荐区路径无法点击 `ChainLink Token`。 | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/MARKET-FAV-001.json`; `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/market-favorite/MARKET-FAV-001-error.png` |
| `NIGHTLY-PORTFOLIO-001` | FAIL | 已切到 `ran / piggy🐷`，但切换投资组合为所有网络时失败：`portfolio +N network trigger not found`。 | `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/NIGHTLY-PORTFOLIO-001.json`; `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly-portfolio-all-networks-create-address/NIGHTLY-PORTFOLIO-001-切换投资组合为所有网络-fail.png` |

通过模块:

- Universal Search: 6/6 passed (`SEARCH-UTIL-001/002/004/005/006/007`)
- Market Chart: 7/8 passed
- Market Favorite: 6/7 passed
- Market Home: 6/6 passed
- Market Search: 5/5 passed

## 录制主流程覆盖

| 流程 | 结果 | 证据 |
| --- | --- | --- |
| 创建钱包 | PASS | `WALLET-001` 创建助记词钱包成功，最终验证 `Account #1` 可见。结果: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/WALLET-001.json` |
| 导入钱包入口 | PASS | `添加已有钱包` 页可见，`导入助记词或私钥` 入口可点击。截图: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-18-import-probe/add-existing-wallet-page.png` |
| 导入助记词页 | PASS | `导入钱包` 助记词 tab 可见，12 个助记词输入框和确认按钮存在。截图: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-18-import-probe/phrase-or-private-key-import-page.png` |
| 导入私钥页 | PASS | 私钥 tab 可见，`输入您的私钥` textarea 和确认按钮存在。未输入或提交任何私钥。截图: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-18-import-probe/private-key-import-page.png` |

## 页面 UI 巡检

- Wallet: PASS, 非白屏，截图 `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-18-ui-probe/Wallet-ui-probe.png`
- Market: PASS after recovery to `热门`, token rows populated, 截图 `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-18-ui-probe/Market-ui-probe-recovered.png`
- Swap: PASS, 非白屏，截图 `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-18-ui-probe/Swap-ui-probe.png`
- Perps: PASS after recovery, webview/合约交易内容可见，截图 `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-18-ui-probe/Perps-ui-probe-recovered.png`
- DeFi: PASS, 热门资产/收益列表非空，截图 `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-18-ui-probe/DeFi-ui-probe.png`
- Browser: PASS, 书签/热门 dApp 列表非空，截图 `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-18-ui-probe/Browser-ui-probe.png`

UI 巡检 JSON:
- `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-18-ui-probe/ui-probe-summary.json`
- `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-18-ui-probe/ui-probe-recovery-summary.json`

## 投资组合地址流程

- Step 0 通过: 已选择软件钱包 `ran` / 账户 `piggy🐷`。
- 失败点: 未找到 portfolio `+N` all-networks trigger，未能进入全选网络、`创建地址 & 应用`。
- 复制地址列表校验: 未执行到复制地址列表，因此没有可列出的残留 `创建地址` 网络清单；本 case 已按失败处理，未弱化为通过。
