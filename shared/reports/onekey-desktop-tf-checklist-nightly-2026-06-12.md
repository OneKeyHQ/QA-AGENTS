# OneKey Desktop TF 主流程 Nightly 巡检报告

- 运行时间: 2026-06-12 00:29 CST
- 应用版本: OneKey 6.4.0 (20260611230)
- CDP UA: OneKeyWallet/6.4.0 Chrome/142.0.7444.265 Electron/39.8.9
- TestFlight 更新: 未执行更新。TestFlight 进程可启动，但无可访问窗口，无法读取远端版本；本轮继续使用已安装 6.x TF 包，未安装/触发 900.x。
- 2026-06-12 用户复盘修正: 本轮部分失败属于脚本前置/产品结构预期过期，不应直接判定为产品缺陷；详见下方“复盘修正”。
- Checklist: Desktop-TF 包 (desktop-tf)
- CaseIds (45): COSMOS-001, COSMOS-002, COSMOS-003, COSMOS-004, COSMOS-005, COSMOS-006, COSMOS-007, COSMOS-008, COSMOS-009, COSMOS-010, COSMOS-011, COSMOS-012, SEARCH-UTIL-001, SEARCH-UTIL-002, SEARCH-UTIL-004, SEARCH-UTIL-005, SEARCH-UTIL-006, SEARCH-UTIL-007, MARKET-CHART-001, MARKET-CHART-002, MARKET-CHART-003, MARKET-CHART-004, MARKET-CHART-005, MARKET-CHART-006, MARKET-CHART-007, MARKET-CHART-008, MARKET-FAV-001, MARKET-FAV-002, MARKET-FAV-003, MARKET-FAV-004, MARKET-FAV-005, MARKET-FAV-006, MARKET-FAV-007, MARKET-HOME-001, MARKET-HOME-002, MARKET-HOME-003, MARKET-HOME-004, MARKET-HOME-005, MARKET-HOME-006, MARKET-SEARCH-001, MARKET-SEARCH-002, MARKET-SEARCH-004, MARKET-SEARCH-005, MARKET-SEARCH-003, NIGHTLY-PORTFOLIO-001
- 结果: 12 passed / 33 failed / 0 blocked-or-skipped
- 结果快照: /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-run-state-2026-06-12.json

## 通过用例

- MARKET-CHART-002 — Market-图表-时间区间切换与OHLC对照
- MARKET-CHART-003 — Market-图表-默认周期与K线类型
- MARKET-CHART-004 — Market-图表-下方时间范围
- MARKET-CHART-005 — Market-图表-基础交互与缩放平移
- MARKET-FAV-004 — Market-收藏-搜索列表收藏取消
- MARKET-FAV-005 — Market-收藏-钱包首页收藏联动
- MARKET-FAV-007 — Market-收藏-同名多链与快速连点防抖
- MARKET-SEARCH-001 — Market-搜索-入口与Trending跳转
- MARKET-SEARCH-002 — Market-搜索-Symbol搜索与滚动加载
- MARKET-SEARCH-004 — Market-搜索-收藏联动（自选Tab）
- MARKET-SEARCH-005 — Market-搜索-历史与建议
- MARKET-SEARCH-003 — Market-搜索-合约地址与异常输入

## 失败归因

### Cosmos 转账前置阻塞

- 影响用例: COSMOS-001, COSMOS-002, COSMOS-003, COSMOS-004, COSMOS-005, COSMOS-006, COSMOS-007, COSMOS-008, COSMOS-009, COSMOS-010, COSMOS-011, COSMOS-012
- 原因摘要: 复盘后确认主因是执行时当前钱包账户为“观察钱包”，脚本没有先切换到 HD/软件钱包；观察钱包上下文下 Cosmos 系网络不可搜索，且不会展示可用于转账的本钱包账户信息。runtime-config 缺值是后续暴露的问题，但不是 Cosmos 网络不可见的唯一根因。
- 示例错误:
  - COSMOS-001: 切换到 Akash 网络: Network "Akash" not found in selector after search via [data-testid="nav-header-search-chain-selector-search-bar"]. Visible text: Network "Akash" not found in chain selector; 切换到 piggy 账户: Runtime config incomplete. Missing: primary.walletName, primary.accountName, secondary.walletName, secondary.accountName. Open the Dashboard (http://localhos
  - COSMOS-002: 切换到 Cosmos 网络: Network "Cosmos" not found in selector after search via [data-testid="nav-header-search-chain-selector-search-bar"]. Visible text: Network "Cosmos" not found in chain selector; 切换到 piggy 账户: Runtime config incomplete. Missing: primary.walletName, primary.accountName, secondary.walletName, secondary.accountName. Open the Dashboard (http://local
  - COSMOS-003: 切换到 Cronos POS Chain 网络: Network "Cronos POS Chain" not found in selector after search via [data-testid="nav-header-search-chain-selector-search-bar"]. Visible text: Network "Cronos POS Chain" not found in chain selector; 切换到 piggy 账户: Runtime config incomplete. Missing: primary.walletName, primary.accountName, secondary.walletName, secondary.accountName. Op

### 通用搜索 Tab 缺失

- 影响用例: SEARCH-UTIL-001, SEARCH-UTIL-002, SEARCH-UTIL-004, SEARCH-UTIL-005, SEARCH-UTIL-006, SEARCH-UTIL-007
- 原因摘要: 复盘后确认通用搜索已变为动态搜索：某个搜索词在某些 tab 下没有结果时，该 tab 不展示。脚本仍按固定 tab 存在断言，预期已过期。
- 示例错误:
  - SEARCH-UTIL-001: Tab "账户" not found in search modal
  - SEARCH-UTIL-002: Tab "账户" not found in search modal
  - SEARCH-UTIL-004: Tab "dApps" not found in search modal

### Market 现货主 Tab 不可点击

- 影响用例: MARKET-CHART-001, MARKET-CHART-007, MARKET-CHART-008, MARKET-FAV-002, MARKET-FAV-003, MARKET-FAV-006, MARKET-HOME-002, MARKET-HOME-003, MARKET-HOME-005, MARKET-HOME-006
- 原因摘要: 复盘后确认 Market tab 结构已变更：主 tab 现在是“自选 / 热门 / 股票 / 合约”，不再有主 tab“现货”；“现货”位于“自选”的子 tab（全部 / 现货 / 合约）中。脚本仍按旧结构点击主 tab“现货”，预期已过期。
- 示例错误:
  - MARKET-CHART-001: 进入 Market 现货列表: Cannot click main tab: 现货
  - MARKET-CHART-007: Cannot click main tab: 现货
  - MARKET-CHART-008: Cannot click main tab: 现货

### Market TV webview 探测失败

- 影响用例: MARKET-CHART-006
- 原因摘要: TV webview page.evaluate / GUEST_VIEW_MANAGER_CALL 失败，MACD/布林带/布局重置/持久化验证未通过。
- 示例错误:
  - MARKET-CHART-006: 重置布局到默认状态: page.evaluate: Error: Error invoking remote method 'GUEST_VIEW_MANAGER_CALL': Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.; 添加 MACD 指标: page.evaluate: Error: Error invoking remote method 'GUEST_VIEW_MANAGER_CALL': Error: Script failed to execute, this normally means an error wa

### Market 首页可见性与筛选异常

- 影响用例: MARKET-FAV-001, MARKET-HOME-001, MARKET-HOME-004
- 原因摘要: 首页 hot cards 不足、搜索弹窗未接收输入、合约筛选项缺失或推荐 token 不可点击。
- 示例错误:
  - MARKET-FAV-001: Cannot click recommended token "ChainLink Token"
  - MARKET-HOME-001: 首页入口与布局校验: Hot cards not visible enough: none; 搜索框打开输入并关闭: Search modal did not receive value btc; 主标签现货->合约->自选切换: Cannot click main tab: 现货
  - MARKET-HOME-004: 合约二级筛选项完整: Missing filters: 加密货币, 贵金属, 指数, 大宗商品, 外汇, 预上市

### Portfolio 创建地址阻塞

- 影响用例: NIGHTLY-PORTFOLIO-001
- 原因摘要: 前置 Step 0 回到钱包首页失败：selected account name is empty。复盘后确认脚本没有先创建新钱包，也没有先切换到 HD/软件钱包；它原设计是在“当前已选账户所在钱包”下执行全选网络、添加账户/创建地址。由于当前处在观察钱包上下文，Step 0 读不到有效账户名后直接退出，未覆盖全选网络、创建地址 & 应用、复制地址列表强断言。
- 示例错误:
  - NIGHTLY-PORTFOLIO-001: Step 0 前置: 回到钱包首页: selected account name is empty

## 关键覆盖结论

- 页面白屏/空白: Market 搜索、图表、收藏的多个子流程有非空数据和 canvas 渲染证据；Market 首页 hot cards 不足，部分主 tab 不可点击。
- 关键流程可继续操作: Market 搜索和部分收藏流程可继续；Cosmos 转账受账户配置和网络搜索前置阻塞。
- 创建钱包 / 导入钱包 / 导入私钥 / 页面 UI 巡检: 本轮 checklist 未绑定对应自动化 caseIds，未被 Dashboard 执行覆盖。
- 投资组合地址流程: NIGHTLY-PORTFOLIO-001 在 Step 0 阻塞，未进入全选网络、创建地址 & 应用、复制地址列表；因此无法验证是否残留「创建地址」。这不是“创建地址后失败”，而是根本没有执行到创建地址步骤。

## 复盘修正

- Cosmos 12 条：应先切换到 HD/软件钱包，再搜索 Cosmos 系网络；观察钱包上下文下网络和可转账账户信息不满足用例前置。
- 通用搜索：搜索 tab 是动态展示，不应断言固定 tab 一定存在；应按当前搜索词实际命中类型验证。
- Market：主 tab 已调整为“自选 / 热门 / 股票 / 合约”；“现货”是“自选”下的子 tab，不再是主 tab。
- NIGHTLY-PORTFOLIO-001：脚本没有创建新钱包；脚本设计是复用当前钱包新增地址/账户。因当前是观察钱包，Step 0 账户名为空后直接退出，未执行全选网络和创建地址。

## 证据路径

- Run state JSON: /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/nightly/onekey-desktop-tf-checklist-nightly-run-state-2026-06-12.json
- Cosmos failure screenshots dir: /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots (46 files modified in this run)
- Market chart screenshots dir: /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/market-chart (4 files modified in this run)
- 本轮未发现 Dashboard 为 SEARCH/MARKET-HOME/NIGHTLY-PORTFOLIO 额外生成截图文件。

## 截图清单

- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-001-切换到-Akash-网络-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-001-切换到-piggy-账户-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-001-切换到-vault-账户-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-001-发送-AKT-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-001-回到钱包首页-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-002-切换到-Cosmos-网络-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-002-切换到-piggy-账户-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-002-切换到-vault-账户-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-002-发送-ATOM-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-002-回到钱包首页-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-003-切换到-Cronos-POS-Chain-网络-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-003-切换到-piggy-账户-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-003-切换到-vault-账户-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-003-发送-CRO-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-003-回到钱包首页-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-004-切换到-Fetch.ai-网络-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-004-切换到-piggy-账户-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-004-切换到-vault-账户-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-004-回到钱包首页-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-005-切换到-Juno-网络-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-005-切换到-piggy-账户-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-005-切换到-vault-账户-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-006-切换到-Osmosis-网络-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-006-切换到-piggy-账户-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-006-切换到-vault-账户-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-007-切换到-Osmosis-网络-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-007-切换到-piggy-账户-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-007-切换到-vault-账户-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-008-切换到-Secret-Network-网络-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-008-切换到-piggy-账户-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-008-切换到-vault-账户-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-009-切换到-Celestia-网络-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-009-切换到-piggy-账户-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-009-切换到-vault-账户-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-010-切换到-Babylon-Genesis-网络-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-010-切换到-piggy-账户-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-010-切换到-vault-账户-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-011-切换到-Noble-网络-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-011-切换到-piggy-账户-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-011-切换到-vault-账户-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-012-备注超-512-字节-→-禁止提交-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-012-特殊字符备注-→-可进入下一步-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-012-负数无法输入-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-012-超余额显示资金不足-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-012-金额-0-显示错误提示-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/cosmos-screenshots/COSMOS-012-非法金额测试准备-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/market-chart/MARKET-CHART-001-进入-Market-现货列表-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/market-chart/MARKET-CHART-006-添加-MACD-指标-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/market-chart/MARKET-CHART-006-添加布林带指标-fail.png
- /Users/chole/workspace/codex-workspace/QA-AGENTS/shared/results/market-chart/MARKET-CHART-006-重置布局到默认状态-fail.png
