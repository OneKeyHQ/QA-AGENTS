# OneKey QA - 测试用例 + 自动化执行

OneKey 钱包的 QA 工程仓库，包含两大核心能力：

## 能力一览

| 能力 | 说明 | 入口 |
|------|------|------|
| **测试用例生成** | 从 PRD 需求文档生成结构化测试用例 | `docs/qa/requirements/` → `docs/qa/testcases/` |
| **QA 规则库** | 各模块测试规则（Perps、Swap、DeFi、Wallet 等） | `docs/qa/rules/` |
| **API 用例生成** | Apifox 可导入的 API 测试用例 | `docs/skills/apifox-testcase-generator/` |
| **UI 自动化测试** | 多平台（Desktop / Extension / Web / Android）CDP 录制 → 生成脚本 → Dashboard 执行 | `src/tests/` + http://localhost:5050 |
| **冒烟测试 & WS 数据验证** | 快速回归 + WebSocket 数据校验 | `docs/skills/smoke-test/` |
| **E2E Playwright 脚本生成** | Checklist → Playwright spec | `docs/skills/playwright-generator/` |
| **公共定位语义层** | 默认从 `app-monorepo` 的 `origin/x` / `x` 同步 testID，供测试生成/知识维护默认引用 | `shared/ui-semantic-map.json` + `shared/generated/` |
| **Agent 协作** | 12 个专职 Agent 覆盖设计、录制、执行、诊断、修复、审查、报告 | `.claude/skills/` |

## 快速开始

### 环境要求

- Node.js 20+
- OneKey Desktop App 已安装（或浏览器插件 / Web 端 / Android 设备视测试平台而定）
- macOS（其他平台需调整 CDP 启动方式）

### 安装

```bash
npm install
```

### 配置 `.env`

```bash
# OneKey 桌面端可执行文件路径（必填，桌面端测试用）
ONEKEY_BIN=/Applications/OneKey-3.localized/OneKey.app/Contents/MacOS/OneKey

# CDP URL（可选，默认 http://127.0.0.1:9222）
CDP_URL=http://127.0.0.1:9222

# Android 测试需要 AI 视觉模型配置（OpenAI / Anthropic 等）
```

### 测试平台

每次会话首次连接 OneKey 时会询问测试平台（4 选 1）：
1. **桌面端 TF 包**（TestFlight）
2. **桌面端 MAS 包**（Mac App Store）
3. **浏览器插件端**（需 Extension ID + Chrome Profile）
4. **Web 端**（需 Chrome Profile）

Chrome Profile 会自动扫描并列出可选项。

### 1. 生成测试用例（从 PRD）

将 PRD 文档放入 `docs/qa/requirements/`，然后：

```
@<需求文档> 生成测试用例
```

输出到 `docs/qa/testcases/cases/<模块>/`。

### 2. 运行自动化测试

```bash
# 最简单（推荐）：一键启动 OneKey CDP + Dashboard，并引导在面板勾选执行
/qatest 开始执行

# CLI Runner（多平台分层后的路径）
node src/tests/run.mjs                                  # 列出所有可用测试
node src/tests/run.mjs desktop                          # 跑整个 desktop 平台
node src/tests/run.mjs desktop/market                   # 跑 desktop/market 全部用例
node src/tests/run.mjs desktop/market/search.test.mjs   # 跑单文件
node src/tests/desktop/market/search.test.mjs MARKET-SEARCH-002  # 跑单用例
```

### 3. 录制新用例

```bash
# 最简单（推荐）：从用例文件开始录制
@docs/qa/testcases/cases/<module>/<file>.md 开始录制

# 可选：手动启动（CDP 9222 + Recorder 3210）
$ONEKEY_BIN --remote-debugging-port=9222    # 路径来自 .env 的 ONEKEY_BIN
node src/recorder/listen.mjs                # 桌面端
node src/recorder/listen-web.mjs            # Web 端 (port 3211)
node src/recorder/listen-ext.mjs            # 浏览器插件端
```

### 4. 从录制结果生成并写回 `test_cases.json`

录制器默认输出到：

- `shared/results/recording/steps.json`
- `shared/results/recording/generated.json`

推荐流程：

```bash
# 1) review 原始录制步骤
node src/recorder/review.mjs shared/results/recording

# 2) 生成 semantic-aware route + compiled locators
node src/recorder/generate.mjs shared/results/recording

# 3a) 按 scenarioId 更新已有 case
node src/recorder/generate.mjs shared/results/recording \
  --apply \
  --scenario-id create-mnemonic-wallet-with-backup

# 3b) 追加一个新的 draft case
node src/recorder/generate.mjs shared/results/recording \
  --apply \
  --scenario-id wallet-send-token-smoke \
  --title "Wallet Send Token Smoke" \
  --id-prefix DRAFT
```

`generate.mjs` 在生成阶段会参考 `shared/ui-semantic-map.json`，为 step 编译出稳定的 `compiled_locator`；
runner 在执行阶段优先消费 `compiled_locator`，没有时再回退 `ui_element + ui-map`，不会在 runtime 再读取 semantic map。

常用参数：

- `--apply`：把 `generated.json` 的 step 结果写回 `test_cases.json`
- `--scenario-id`：按 `scenarioId` 更新已有 case；不存在时用于新 draft case 的 `scenarioId`
- `--case-id`：按 `id` 精确更新已有 case
- `--title`：新 draft case 标题
- `--platform`：新 draft case 平台，默认 `desktop`
- `--priority`：新 draft case 优先级，默认 `P1`
- `--id-prefix`：新 draft case 编号前缀，默认 `DRAFT`
- `--test-cases-file`：指定目标文件，适合先写临时副本验证

安全建议：

```bash
# 先写到临时文件验证，再决定是否覆盖正式 shared/test_cases.json
cp shared/test_cases.json /tmp/test_cases.json
node src/recorder/generate.mjs shared/results/recording \
  --apply \
  --scenario-id create-mnemonic-wallet-with-backup \
  --test-cases-file /tmp/test_cases.json
```

## 项目结构

```
├── docs/
│   ├── qa/
│   │   ├── requirements/           # PRD 需求文档
│   │   ├── testcases/cases/        # 手工测试用例（按模块分类）
│   │   │                           # account/ browser/ defi/ hardware/ market/ perps/
│   │   │                           # prime/ referral/ swap/ transfer/ utility/ wallet/
│   │   ├── rules/                  # QA 规则库（14 个模块规则文件）
│   │   ├── qa-rules.md             # 规则总览
│   │   └── 用例生成链路介绍.md       # 用例生成流程说明
│   ├── skills/                     # 辅助技能
│   │   ├── apifox-testcase-generator/  #   API 用例生成
│   │   ├── checklist-generator/    #   Checklist 生成
│   │   ├── smoke-test/             #   冒烟测试 + WS 数据验证
│   │   ├── playwright-generator/   #   E2E Playwright 脚本生成
│   │   ├── android-recorder/       #   Android 录制
│   │   └── app-checklist-issue/    #   APP 回归 checklist
│   └── plans/                      # 实施计划
├── src/
│   ├── tests/                      # 自动化测试脚本（按平台分层）
│   │   ├── run.mjs                 #   CLI Runner 入口（统一）
│   │   ├── desktop/                #   桌面端（TF/MAS 包）
│   │   │   ├── market/             #     Market 行情
│   │   │   ├── perps/              #     Perps 合约
│   │   │   ├── swap/               #     Swap 兑换
│   │   │   ├── transfer/           #     Transfer 转账
│   │   │   ├── wallet/             #     Wallet 钱包
│   │   │   ├── settings/           #     Settings 设置
│   │   │   ├── referral/           #     Referral 推荐
│   │   │   └── utility/            #     地址簿等通用工具
│   │   ├── extension/              #   浏览器插件端
│   │   ├── web/                    #   Web 端（app.onekey.so）
│   │   ├── mobile/                 #   Mobile（部分通用）
│   │   ├── android/                #   Android（Midscene + UIAutomator）
│   │   └── helpers/                #   公共工具（CDP 连接、导航、断言、转账、运行时配置）
│   ├── dashboard/                  # 测试执行面板 (port 5050)
│   ├── recorder/                   # 录制器：桌面 (3210) / Web (3211) / Extension / Android
│   ├── knowledge/                  # 三阶段记忆管线（MemCells → MemScenes → Recall）
│   ├── cli/                        # CLI 命令（status/init/preflight/report 等）
│   ├── converters/                 # 数据格式转换
│   ├── core/                       # 核心逻辑
│   ├── schemas/                    # JSON Schema 定义
│   ├── types/                      # TypeScript 类型
│   └── utils/                      # 通用工具
├── shared/
│   ├── test_cases.json             # 测试用例定义（Test Designer 写入）
│   ├── preconditions.json          # 前置条件数据库
│   ├── ui-map.json                 # 执行期选择器映射（三层：primary/fallback/emergency）
│   ├── ui-semantic-map.json        # 公共语义定位层（生成/维护优先引用）
│   ├── knowledge.json              # 经验沉淀（K-NNN 编号）
│   ├── mem_cells.json              # 记忆单元（原始事件）
│   ├── mem_scenes.json             # 聚类场景
│   ├── profile.json                # Agent 能力画像
│   ├── diagnosis.json              # QA Manager 失败诊断
│   ├── runtime-config.json         # Dashboard 钱包账户配置（gitignored，每人本地配）
│   ├── checklists.json             # Dashboard 回归 Checklist 集合
│   ├── tasks.json                  # 任务队列
│   ├── generated/                  # app-monorepo x 分支同步产物（testID 索引等）
│   ├── results/                    # 执行结果（<TEST-ID>.json）
│   └── reports/                    # Reporter 输出报告 + Review 报告
├── scripts/
│   ├── clean.mjs                   # 项目产物清理（npm run clean）
│   ├── build-locator-map.mjs       # 构建定位器映射
│   ├── sync-app-monorepo-selectors.mjs  # 同步 app-monorepo testID
│   └── start-chrome-debug.sh       # 带 CDP 启动 Chrome
├── .claude/
│   ├── CLAUDE.md                   # Claude Code 项目规则（**唯一真源**）
│   └── skills/                     # 12 个 Agent 技能定义
├── AGENTS.md                       # → symlink → .claude/CLAUDE.md（Codex/Zed/通用 agent 入口）
└── .cursorrules                    # → symlink → .claude/CLAUDE.md（Cursor AI 入口）
```

## Agent 协作

三层架构：决策层 → 智能层（串行）→ 执行层。

| Agent | 触发指令 | 职责 |
|-------|---------|------|
| **QA Director** | `/onekey-qa-director`、`跑测试`、`/onekey-test` | 总调度 — 启动执行、前置检查、汇总结果、失败路由 |
| **QATest** | `/qatest`、`开始执行` | 一键准备执行环境（CDP + Dashboard） |
| **Test Designer** | `/onekey-test-designer`、`写用例` | 用例设计 — PRD 分析 → BDD intent-only |
| **Recorder** | `/onekey-recorder`、`录制` | CDP 捕获用户操作（桌面/Web/Extension） |
| **Record From File** | `/onekey-record-from-file`、`发文件开始录制` | 用例文件 → 场景重编排 → 引导录制 → 生成脚本 |
| **Record to Test (Android)** | `/onekey-record-to-test` | Android 录制 → 操作清单确认 → Midscene 脚本 |
| **Knowledge Builder** | `/onekey-knowledge-builder`、`更新选择器` | 唯一知识写入者 — ui-map / preconditions / 三阶段记忆 |
| **QA Manager** | `/onekey-qa-manager`、`诊断失败` | 失败诊断 — 根因分类、修复建议（不改代码） |
| **QA Review** | `/qa-review`、`/onekey-qa-review`、`审查提交` | 提交前审查 — 用例 / 规则 / 脚本 / Skill 规范性 |
| **Runner** | `/onekey-runner`、`执行测试` | 执行器 — Dashboard 或 CLI 执行（`src/tests/run.mjs`） |
| **Reporter** | `/onekey-reporter`、`生成报告` | 报告 — 结果汇总、趋势分析 |
| **App Checklist Issue** | `app-checklist-issue` | APP 回归 Test Execution 快速生成器 |

### 协作流程

```
新功能用例：PRD → Test Designer 设计 → Record From File 录制 → 生成 .test.mjs
            → Knowledge Builder 更新 ui-map + knowledge → /qa-review 审查 → 提交
日常回归：  /qatest → 勾选用例 → Dashboard 执行 → Reporter 报告
失败修复：  QA Manager 诊断 → 根因路由 → Knowledge Builder 修选择器 → 重跑验证
```

## QA 规则库

| 模块 | 规则文件 |
|------|---------|
| Account 账户 | `docs/qa/rules/account-rules.md` |
| Browser / DApp | `docs/qa/rules/browser-rules.md` |
| DeFi | `docs/qa/rules/defi-rules.md` |
| Hardware 硬件钱包 | `docs/qa/rules/hardware-rules.md` |
| Market 行情 | `docs/qa/rules/market-rules.md` |
| Perps 合约 | `docs/qa/rules/perps-rules.md` |
| Prime | `docs/qa/rules/prime-rules.md` |
| Referral 推荐 | `docs/qa/rules/referral-rules.md` |
| Swap 兑换 | `docs/qa/rules/swap-rules.md` + `swap-network-features.md` |
| Transfer 转账（链规则） | `docs/qa/rules/transfer-chain-rules.md` |
| Utility / 设置 | `docs/qa/rules/utility-rules.md` |
| Wallet 钱包 | `docs/qa/rules/wallet-rules.md` |
| QA 工作流（三线闭环） | `docs/qa/rules/qa-workflow-rules.md` |

## npm Scripts

```bash
npm run dashboard       # 启动测试执行面板 (port 5050)
npm run test            # CLI 入口
npm run status          # 查看状态
npm run preflight       # 前置检查
npm run report          # 生成报告
npm run sync:selectors  # 从 app-monorepo 同步 testID
npm run build:locators  # 构建定位器映射
npm run clean           # 清理产物（dist + 录制截图 + Android session + DS_Store）
```

## 测试工具

| 工具 | 说明 | 路径 |
|------|------|------|
| 助记词 OCR | SLIP39 助记词图片识别 | `html-test/Mnemonic OCR.html` |
| Chrome 调试启动 | 带 CDP 端口启动 Chrome | `scripts/start-chrome-debug.sh` |
| Apifox 用例生成 | API 测试用例 → Postman Collection | `docs/skills/apifox-testcase-generator/` |
| Playwright E2E 生成 | Checklist → `e2e/tests/*.spec.ts` | `docs/skills/playwright-generator/` |
| 冒烟测试 | 快速 P0 / 完整模式 | `docs/skills/smoke-test/` |
| 项目清理 | 释放录制/编译产物 | `npm run clean` |
