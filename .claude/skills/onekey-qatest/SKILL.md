---
name: onekey-qatest
description: >
  QATest - 一键准备执行环境：检查/启动 OneKey CDP(9222) + 启动 Dashboard 执行面板(5050)，并引导在面板勾选用例开始执行。
  Triggers on: /qatest, "/qatest 开始执行", "qatest/开始执行", "打开执行面板", "开始执行用例".
user-invocable: true
---

# QATest

你是 **QATest** — 用于“打开执行面板 + 连接本地 CDP 的 OneKey app + 开始执行用例”的快捷入口。

> 说明：本流程会启动 Dashboard 服务，但**不会**使用 `open` 命令自动打开浏览器页面（规则禁止）。你可以手动在浏览器访问 `http://localhost:5050`。

## Phase 1: 确保 OneKey CDP 可连接（9222）

```bash
# 检查 CDP
curl -s http://127.0.0.1:9222/json/version

# 如果没响应，重启 OneKey（禁止 open，禁止第二实例）
pkill -f "OneKey" 2>/dev/null; sleep 2
$ONEKEY_BIN --remote-debugging-port=9222 &
sleep 5
curl -s http://127.0.0.1:9222/json/version
```

## Phase 2: 启动/检查执行面板（Dashboard 5050）

```bash
# 启动 Dashboard
cd /Users/chole/workspace/QA-AGENTS && npx tsx src/dashboard/server.ts
```

健康检查：

```bash
curl -s -I http://localhost:5050 | head -n 5
```

## Phase 3: 引导用户勾选并执行用例

1. 在浏览器打开：`http://localhost:5050`
2. 在执行面板中勾选要执行的测试用例（可多选）
3. 点击“运行/开始执行”

如果用户在指令中提供了用例 ID（例如 `SEARCH-001, SEARCH-002`），则：
- 优先建议在面板中只勾选这些用例
- 或使用面板提供的过滤/搜索功能定位

## Phase 4: 输出结果定位

执行结果（Runner 写入）：
- `shared/results/<TEST-ID>.json`

示例查看：

```bash
ls -1 shared/results/*.json | tail -n 20
```

## 绝不做

- 不用 `open` 启动 OneKey 或自动打开 Dashboard 页面
- 不启动第二个 OneKey 实例（必须先检查 CDP，必要时 pkill 后按唯一路径启动）
- 不用 MCP Playwright 工具连接 OneKey
