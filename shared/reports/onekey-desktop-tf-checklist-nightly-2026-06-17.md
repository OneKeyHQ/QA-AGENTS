# OneKey Desktop TF 主流程 Nightly 巡检报告

- 运行时间: 2026-06-17 00:05-00:23 CST
- 应用版本: OneKey 6.5.0 (20260615370)
- CDP UA: OneKeyWallet/6.5.0 Chrome/142.0.7444.265 Electron/39.8.9
- TestFlight 更新: 已尝试检查；TestFlight 进程存在但无可访问窗口，无法读取远端候选版本。本轮继续使用已安装 6.x TF 包，未安装或触发 900.x 版本。
- Checklist: Desktop-TF 包 (`desktop-tf`)
- CaseIds (33): SEARCH-UTIL-001, SEARCH-UTIL-002, SEARCH-UTIL-004, SEARCH-UTIL-005, SEARCH-UTIL-006, SEARCH-UTIL-007, MARKET-CHART-001, MARKET-CHART-002, MARKET-CHART-003, MARKET-CHART-004, MARKET-CHART-005, MARKET-CHART-006, MARKET-CHART-007, MARKET-CHART-008, MARKET-FAV-001, MARKET-FAV-002, MARKET-FAV-003, MARKET-FAV-004, MARKET-FAV-005, MARKET-FAV-006, MARKET-FAV-007, MARKET-HOME-001, MARKET-HOME-002, MARKET-HOME-003, MARKET-HOME-004, MARKET-HOME-005, MARKET-HOME-006, MARKET-SEARCH-001, MARKET-SEARCH-002, MARKET-SEARCH-004, MARKET-SEARCH-005, MARKET-SEARCH-003, NIGHTLY-PORTFOLIO-001
- Checklist 结果: 8 passed / 25 failed / 0 blocked
- 补充 UI 巡检: 4 passed / 1 failed (Wallet, Market, Swap, Browser 通过；Settings sidebar helper 未找到入口)
- 结果快照: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-17-run-state.json`
- UI 巡检快照: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-17-ui-probe.json`

## 通过用例

- MARKET-FAV-004 - 搜索列表收藏/取消收藏通过
- MARKET-FAV-005 - 钱包首页收藏联动流程通过，但子步骤记录为未找到可点击 Market 星标
- MARKET-FAV-007 - USDT 同名多链收藏与快速连点防抖通过
- MARKET-HOME-004 - 合约二级筛选、表头、分类切换和行数据通过
- MARKET-SEARCH-001 - 搜索入口与 Trending/结果行跳转通过
- MARKET-SEARCH-002 - BTC/ETH/SOL/大小写/模糊/USDT 滚动通过
- MARKET-SEARCH-004 - 搜索收藏联动通过，计数 178 -> 179 -> 178
- MARKET-SEARCH-003 - 合约地址、异常输入、超长输入与关闭搜索通过

## 失败归因

### 通用搜索动态 Tab

- 影响用例: SEARCH-UTIL-001, SEARCH-UTIL-002, SEARCH-UTIL-004, SEARCH-UTIL-005, SEARCH-UTIL-006, SEARCH-UTIL-007
- 原因摘要: 搜索弹窗未展示脚本固定断言的 Tab，分别缺少 `账户`、`dApps`、`我的资产`、`合约`、`设置`。这与 2026-06-12 复盘一致：搜索分类是动态展示，脚本期望已过期。
- 截图目录: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-17/`

### Market 现货主 Tab 预期过期

- 影响用例: MARKET-CHART-001~008, MARKET-FAV-002, MARKET-FAV-003, MARKET-FAV-006, MARKET-HOME-001, MARKET-HOME-002, MARKET-HOME-003, MARKET-HOME-005, MARKET-HOME-006
- 原因摘要: 脚本仍点击主 Tab `现货`，当前 UI 主 Tab 为 `自选 / 热门 / 股票 / 合约`，`现货` 不再是主 Tab。
- 额外现象: MARKET-CHART-001 进入了一个详情页，但 TV webview 未就绪，K 线无白屏断言因 `TV webview not found` 失败。
- 关键截图:
  - `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/market-chart/MARKET-CHART-001-进入-Market-现货列表-fail.png`
  - `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/market-chart/MARKET-CHART-001-TV-图表加载-fail.png`
  - `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/market-home/MARKET-HOME-001-首页入口与布局校验-fail.png`

### Market 收藏与搜索单点失败

- MARKET-FAV-001: 推荐代币选择后自选计数仍为 0，未验证到添加成功。
- MARKET-SEARCH-005: ETH 搜索历史流程中无可点击结果，历史区域也未产生新记录。

### 投资组合创建地址未进入核心断言

- 影响用例: NIGHTLY-PORTFOLIO-001
- 失败点: Step 0 前置 `回到钱包首页` 失败，错误为 `selected account name is empty`。
- 已观察动作: 脚本尝试切换到 `ran / piggy🐷` 并输出 `Clicked piggy🐷 for piggy/primary in wallet ran`，但随后账户选择器文本仍为空。
- 结论: 本轮未进入全选网络、`创建地址 & 应用`、复制地址列表校验阶段；因此无法判断是否有网络残留 `创建地址`。本轮没有可列出的残留网络清单。
- 截图: `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly-portfolio-all-networks-create-address/NIGHTLY-PORTFOLIO-001-Step-0-前置:-回到钱包首页-fail.png`

## 页面 UI 巡检

- Wallet: passed, textLen=740, screenshot `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-17-ui-probe/Wallet-ui-probe.png`
- Market: passed, textLen=352, screenshot `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-17-ui-probe/Market-ui-probe.png`
- Swap: passed, textLen=349, screenshot `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-17-ui-probe/Swap-ui-probe.png`
- Browser: passed, textLen=54, screenshot `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-17-ui-probe/Browser-ui-probe.png`
- Settings: failed, helper could not find sidebar tab `Settings`, screenshot `/Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-2026-06-17-ui-probe/Settings-ui-probe-error.png`

## 覆盖缺口

- 创建钱包 / 导入钱包 / 导入私钥主流程: 当前 `desktop-tf` checklist 未绑定对应 caseIds。
- 仓库中仅发现 Desktop 创建助记词钱包自动化 `WALLET-001`，但它未绑定 nightly checklist；未发现 Desktop 导入助记词钱包或导入私钥的可执行 `.test.mjs`。
- 本轮未把这些未绑定流程计入 33 条 checklist 通过/失败统计，避免混淆正式 checklist 结果。

## 执行备注

- Dashboard `/api/run-state` 有 2026-06-16 的 stopped 队列残留，并且 `/api/tests` 对重复 caseId 会把部分 Market Chart 解析到 `web/market/chart.test.mjs`。本轮为保证 Desktop-TF 结果准确，使用显式 desktop module runner 执行 33 个 caseIds。
- 已沉淀知识 `K-158`: Desktop-TF checklist 执行前必须校验 caseId -> file 属于 `desktop/...`，避免 Dashboard registry 重复 ID 误跑 web 模块。
