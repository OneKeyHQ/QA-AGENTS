# OneKey QA - 测试用例 + 自动化执行

OneKey 钱包的 QA 工程仓库，包含两大核心能力：

## 能力一览

| 能力 | 说明 | 入口 |
|------|------|------|
| **测试用例生成** | 从 PRD 需求文档生成结构化测试用例 | `docs/qa/requirements/` → `docs/qa/testcases/` |
| **QA 规则库** | 各模块测试规则（Perps、Swap、DeFi 等） | `docs/qa/rules/` |
| **API 用例生成** | Apifox 可导入的 API 测试用例 | `docs/skills/apifox-testcase-generator/` |
| **UI 自动化测试** | CDP 录制 → 生成脚本 → Dashboard 执行 | `src/tests/` + http://localhost:5050 |
| **公共定位语义层** | 默认从 `app-monorepo` 的 `origin/x` / `x` 同步 testID，供测试生成/知识维护默认引用 | `shared/ui-semantic-map.json` + `shared/generated/` |
| **Agent 协作** | 7 个专职 Agent 覆盖设计、执行、诊断、修复 | `.claude/skills/` |

## 快速开始

### 环境要求

- Node.js 20+
- OneKey Desktop App 已安装

### 安装

```bash
npm install
```

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

# 可选：直接 CLI 跑脚本
node src/tests/desktop/market/search.test.mjs
node src/tests/desktop/market/search.test.mjs MARKET-SEARCH-002
```

### 3. 录制新用例

```bash
# 最简单（推荐）：从用例文件开始录制
@docs/qa/testcases/cases/<module>/<file>.md 开始录制

# 可选：手动启动（CDP 9222 + Recorder 3210）
/Applications/OneKey-3.localized/OneKey.app/Contents/MacOS/OneKey --remote-debugging-port=9222
node src/recorder/listen.mjs
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
│   │   ├── rules/                  # QA 规则库
│   │   └── qa-rules.md             # 规则总览
│   ├── skills/                     # 辅助技能（Apifox 生成器、Checklist 等）
│   └── plans/                      # 实施计划
├── src/
│   ├── tests/                      # 自动化测试脚本
│   │   ├── cosmos/                 #   Cosmos 转账测试
│   │   ├── perps/                  #   合约页测试（收藏、搜索）
│   │   ├── wallet/                 #   钱包创建测试
│   │   ├── referral/               #   推荐绑定测试
│   │   ├── settings/               #   设置测试
│   │   ├── android/                #   Android 测试
│   │   └── helpers/                #   公共工具（CDP 连接、导航、断言）
│   ├── dashboard/                  # 测试执行面板 (port 5050)
│   ├── recorder/                   # 录制器 (port 3210)
│   └── knowledge/                  # 记忆管线
├── shared/
│   ├── test_cases.json             # 测试用例定义
│   ├── preconditions.json          # 前置条件数据库
│   ├── ui-map.json                 # 现有执行选择器映射
│   ├── ui-semantic-map.json        # 新增公共语义定位层（生成/维护默认优先引用）
│   ├── generated/                  # app-monorepo x 分支同步产物
│   └── results/                    # 执行结果
├── .claude/
│   ├── CLAUDE.md                   # Claude Code 项目规则
│   └── skills/                     # Agent 技能定义
├── AGENTS.md                       # 通用 Agent 行为指南
└── .cursorrules                    # Cursor 规则
```

## Agent 协作

| Agent | 职责 |
|-------|------|
| **QA Director** | 总调度 — 启动执行、检查前置条件、汇总结果 |
| **Test Designer** | 用例设计 — PRD 分析 → 引导录制 → 生成脚本 |
| **Knowledge Builder** | 知识维护 — 选择器修复、ui-map 更新、前置条件管理 |
| **QA Manager** | 失败诊断 — 根因分类、修复建议（不改代码） |
| **Runner** | 执行器 — Dashboard 或 CLI 执行测试 |
| **Recorder** | 录制器 — CDP 捕获用户操作 |
| **Reporter** | 报告 — 结果汇总、趋势分析 |

### 协作流程

```
新功能测试：PRD → Test Designer 引导录制 → 生成 .test.mjs → Knowledge Builder 更新 ui-map
日常回归：  QA Director → Runner 执行 → Reporter 生成报告
失败修复：  QA Manager 诊断 → Knowledge Builder 修选择器 → 重跑验证
```

## QA 规则库

| 模块 | 规则文件 | 用例数 |
|------|---------|--------|
| Perps 合约 | `docs/qa/rules/perps-rules.md` | 8+ |
| Swap 兑换 | `docs/qa/rules/swap-rules.md` | 6+ |
| DeFi | `docs/qa/rules/defi-rules.md` | 4+ |
| Market 行情 | `docs/qa/rules/market-rules.md` | 5+ |
| Transfer 转账 | `docs/qa/rules/transfer-chain-rules.md` | 9+ |
| Wallet 钱包 | `docs/qa/rules/wallet-rules.md` | 2+ |
| Referral 推荐 | `docs/qa/rules/referral-rules.md` | 3+ |

## 测试工具

| 工具 | 说明 | 路径 |
|------|------|------|
| 助记词 OCR | SLIP39 助记词图片识别 | `html-test/Mnemonic OCR.html` |
| Chrome 调试启动 | 带 CDP 端口启动 Chrome | `scripts/start-chrome-debug.sh` |
| Apifox 用例生成 | API 测试用例 → Postman Collection | `docs/skills/apifox-testcase-generator/` |
