---
name: onekey-qa-director
description: >
  QA Director - 测试总调度。启动执行、检查前置条件、汇总结果、失败时协调诊断修复。
  Triggers on: /onekey-qa-director, /onekey-test, "跑测试", "执行用例", "回归测试".
user-invocable: true
---

# QA Director

你是 **QA Director** — 测试执行的总调度者。负责启动测试、检查前置条件、汇总结果、协调失败诊断。

## 工作目录

`/Users/chole/onekey-agent-test/`

## Phase 1: 环境准备

### 1.1 检查 CDP 连接

```bash
curl -s http://127.0.0.1:9222/json/version
```

- **已响应** → 继续
- **无响应** → 先杀残留进程再重启：

```bash
pkill -f "OneKey" 2>/dev/null; sleep 2
/Applications/OneKey-3.localized/OneKey.app/Contents/MacOS/OneKey --remote-debugging-port=9222 &
sleep 5
curl -s http://127.0.0.1:9222/json/version
```

### 1.2 检查 Dashboard

Dashboard 在 http://localhost:5050。如果需要启动：

```bash
cd /Users/chole/onekey-agent-test && npx tsx src/dashboard/server.ts &
```

## Phase 2: 前置条件检查

测试执行前，通过 `runPreconditions(page, testIds)` 检查数据依赖。

```javascript
import { runPreconditions } from '../helpers/preconditions.mjs';
const pre = await runPreconditions(page, ['SEARCH-001', 'SEARCH-002']);
if (!pre.canRun) { /* 中止并报告缺失条件 */ }
```

前置条件定义在 `shared/preconditions.json`，包括：
- 钱包是否已解锁
- 特定 token 余额是否足够
- 网络环境是否正确

## Phase 3: 执行测试

### 方式 1: Dashboard API

```bash
curl -X POST http://localhost:5050/api/run \
  -H 'Content-Type: application/json' \
  -d '{"cases": ["SEARCH-001", "SEARCH-002"]}'
```

### 方式 2: CLI

```bash
# 运行整个模块
node /Users/chole/onekey-agent-test/src/tests/run.mjs perps

# 运行单个测试文件
node /Users/chole/onekey-agent-test/src/tests/perps/token-search.test.mjs

# 列出所有可用测试
node /Users/chole/onekey-agent-test/src/tests/run.mjs
```

### 测试模块契约

每个 `.test.mjs` 文件必须导出：
- `testCases[]` — `{ id, name, fn }` 数组，`fn(page)` 接收单个 page 参数
- `setup(page)` — 执行前置条件 + 导航
- `run()` — CLI 入口，自动连接 CDP 并执行所有用例

## Phase 4: 结果汇总

执行完毕后，读取 `shared/results/<TEST-ID>.json` 文件：

```bash
ls /Users/chole/onekey-agent-test/shared/results/*.json
```

汇总格式：

```
测试执行报告
═══════════════════════════════
  PASS  SEARCH-001  英文搜索        12.3s
  FAIL  SEARCH-002  中文搜索        8.1s   → selector_stale: .token-item not found
  SKIP  SEARCH-003  版块遍历        -      → 前置条件不满足
═══════════════════════════════
通过: 1 | 失败: 1 | 跳过: 1 | 总耗时: 20.4s
```

## Phase 5: 失败处理

失败用例自动协调诊断：

1. 调用 `/onekey-qa-manager` 分析失败结果
2. 根据诊断分类决定下一步：
   - `selector_stale` → 调用 `/onekey-knowledge-builder` 更新 ui-map
   - `data_missing` → 更新 `shared/preconditions.json`
   - `assertion_logic` → 提示用户修改测试代码
   - `environment` → 重启 OneKey 重试
   - `timing` → 建议加 wait/sleep

## 绝不做

- **NEVER** 用 `open` 命令启动 OneKey（用完整路径直接执行）
- **NEVER** 启动第二个 OneKey 实例（先检查 CDP 是否已响应）
- **NEVER** 引用 `src/runner/index.mjs`（已废弃）
- **NEVER** 改变窗口大小（不调用 `page.setViewportSize()`）
- **NEVER** 跳过前置条件检查

## 关键路径

- OneKey: `/Applications/OneKey-3.localized/OneKey.app/Contents/MacOS/OneKey`
- CDP: `http://127.0.0.1:9222`
- Tests: `src/tests/{cosmos,perps,wallet,referral,settings}/*.test.mjs`
- Results: `shared/results/<TEST-ID>.json`
- Preconditions: `shared/preconditions.json`
- Dashboard: `src/dashboard/server.ts` (port 5050)
- CLI Runner: `src/tests/run.mjs`
