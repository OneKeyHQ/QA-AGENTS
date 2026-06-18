# OneKey Desktop TF 主流程 Nightly 巡检补充报告

- 运行时间：2026-06-17 19:00 CST
- 应用版本：OneKeyWallet 6.5.0 / build 20260617420
- Checklist：`desktop-tf` / `Desktop-TF 包`
- Checklist 绑定 caseIds：`SEARCH-UTIL-001`, `SEARCH-UTIL-002`, `SEARCH-UTIL-004`, `SEARCH-UTIL-005`, `SEARCH-UTIL-006`, `SEARCH-UTIL-007`, `MARKET-CHART-001`, `MARKET-CHART-002`, `MARKET-CHART-003`, `MARKET-CHART-004`, `MARKET-CHART-005`, `MARKET-CHART-006`, `MARKET-CHART-007`, `MARKET-CHART-008`, `MARKET-FAV-001`, `MARKET-FAV-002`, `MARKET-FAV-003`, `MARKET-FAV-004`, `MARKET-FAV-005`, `MARKET-FAV-006`, `MARKET-FAV-007`, `MARKET-HOME-001`, `MARKET-HOME-002`, `MARKET-HOME-003`, `MARKET-HOME-004`, `MARKET-HOME-005`, `MARKET-HOME-006`, `MARKET-SEARCH-001`, `MARKET-SEARCH-002`, `MARKET-SEARCH-004`, `MARKET-SEARCH-005`, `MARKET-SEARCH-003`, `NIGHTLY-PORTFOLIO-001`

## 本轮修改

- 创建钱包：按当前 TF 流程改为 `创建新钱包` 卡片真实鼠标点击 -> `onboarding-create-new-wallet-seed-phrase-btn` -> 完成页 `进入钱包`，不再强制旧 `OneKey KeyTag` 备份链路。
- 派生地址前置：先切回配置软件钱包 `ran / piggy🐷`，再切网络；账户选择器改为当前视口内钱包/账户行坐标点击。
- 通用搜索：Tab 改为动态断言；`代币/Tokens` 独立 Tab 已移除，不再固定断言。
- Market：主 Tab 按当前设计断言 `自选 / 热门 / 股票 / 合约`；`现货` 仅作为自选页二级 Tab。

## 聚焦验证结果

| 用例 | 结果 | 说明 | 结果文件 |
|---|---|---|---|
| `WALLET-001` | PASS | 创建助记词钱包流程已跑通，最终验证 `Account #1` 可见 | `shared/results/WALLET-001.json` |
| `SEARCH-UTIL-001` | PASS | 动态 Tab 隐藏时记录为子步骤 skip，不判失败 | `shared/results/SEARCH-UTIL-001.json` |
| `MARKET-HOME-001` | PASS | 主 Tab 切换为 `热门 -> 股票 -> 合约 -> 自选` | `shared/results/MARKET-HOME-001.json` |
| `MARKET-CHART-001` | FAIL | 点击热门列表首个 Token 后详情页未打开，TV webview 未出现；非 Market Tab 旧断言问题 | `shared/results/MARKET-CHART-001.json` |
| `NIGHTLY-PORTFOLIO-001` | FAIL | 已正确切到 `ran / piggy🐷`，但应用所有网络后首页仍为 `Arbitrum`，未进入 all-networks portfolio mode | `shared/results/NIGHTLY-PORTFOLIO-001.json` |

自动化用例聚焦复跑：通过 3 / 失败 2 / 阻塞 0。
单元验证：`node --test src/tests/shared/utility/universal-search.dynamic-tabs.test.mjs src/tests/shared/market/market-tabs.test.mjs src/tests/desktop/utility/nightly-portfolio-account-text.test.mjs` 通过 8 / 失败 0。

## 失败与阻塞说明

- `NIGHTLY-PORTFOLIO-001`：流程顺序已修正为软件钱包 `ran / piggy🐷` -> 打开网络选择器 -> 所有网络 -> 全选/应用。失败点是应用后首页网络仍显示 `Arbitrum`，状态为 `hasSingleNetworkTrigger=true`，没有切成 all-networks。复制地址列表未执行到，因此本轮无法列出残留 `创建地址` 的网络；该检查未被弱化为通过。
- `MARKET-CHART-001`：当前失败在详情页未打开与 TV webview 缺失；Market 主 Tab 新设计断言已在 `MARKET-HOME-001` 和单测中验证通过。

## 截图与证据路径

- 创建钱包截图目录：`shared/results/wallet-create/`
- 投资组合截图目录：`shared/results/nightly-portfolio-all-networks-create-address/`
- 投资组合失败截图：`shared/results/nightly-portfolio-all-networks-create-address/NIGHTLY-PORTFOLIO-001-切换投资组合为所有网络-fail.png`

## 代码与知识沉淀

- 新增/更新知识：`K-163`（创建钱包新流程）、`K-164`（账户选择器当前视口行点击）。
- 相关修复文件：`src/tests/shared/wallet/create-mnemonic.mjs`, `src/tests/helpers/accounts.mjs`, `src/tests/desktop/utility/nightly-portfolio-all-networks-create-address.test.mjs`, `src/tests/shared/utility/universal-search.mjs`, `src/tests/shared/market/*`。

## 20:03 CST 补充

- `MARKET-CHART-001` 已修复并复跑通过：Market 列表打开和点击 Token 前都会再次解锁；若解锁回到 Wallet，会重新进入 `Market -> 热门`。结果：10 个可见 token，点击 `SPACEMOON0xf255...7777` 进入详情页，TV 图表 7 个 canvas，K 线 canvas 非白屏（hash `920242726`）。结果文件：`shared/results/MARKET-CHART-001.json`。
- `NIGHTLY-PORTFOLIO-001` 已确认进入正确的 unified all-networks 流程，但点击完成后产品运行时报 `Cannot access 'Vault' before initialization`，首页仍停在单网络 `Cardano`，没有进入 all-networks。脚本已保留该错误并判失败；不能继续执行“创建地址 & 应用”和复制地址列表残留校验。
- 新增知识：`K-165`（统一网络选择器被锁屏层覆盖时只剩 header）、`K-166`（Market 列表 DOM 可见但点击被锁屏层拦截）。
- 最新聚焦结果：`MARKET-CHART-001` PASS，`NIGHTLY-PORTFOLIO-001` FAIL（产品 runtime 阻断），相关单测 8/8 PASS。
