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

## Phase 0: 询问测试平台（每次会话首次必须询问）

**不论 `.env` 是否已配置，每次会话首次都必须询问：**

```
请选择要测试的平台：
1. 桌面端 TF 包（TestFlight）— /Applications/OneKey-3.localized/OneKey.app
2. 桌面端 MAS 包（Mac App Store）— 请提供路径
3. 浏览器插件端 — 请提供插件 ID（Extension ID）+ Chrome 用户目录（User Data Dir）
4. Web 端 — 请提供要使用的 Chrome 用户目录（User Data Dir）
```

- 桌面端：写入 `.env` 的 `ONEKEY_BIN=`，按下方 Phase 1 启动
- 插件端/Web 端：**自动扫描** Chrome Profile，只有 1 个直接用，多个才列出让选择。插件端还需额外询问 Extension ID

**Chrome Profile 自动扫描逻辑：**
1. 扫描 `~/Library/Application Support/Google/Chrome/` 下所有 Profile
2. **1 个 → 直接使用**，**多个 → 列出让选**
```bash
for dir in ~/Library/Application\ Support/Google/Chrome/Profile* ~/Library/Application\ Support/Google/Chrome/Default; do
  [ -d "$dir" ] && python3 -c "
import json, os
prefs = json.load(open(os.path.join('$dir', 'Preferences')))
print(f'$(basename \"$dir\")  →  {prefs.get(\"profile\",{}).get(\"name\",\"unnamed\")}')
" 2>/dev/null
done
```

Launch command: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --remote-debugging-port=9222 --user-data-dir="$HOME/Library/Application Support/Google/Chrome" --profile-directory="<Profile>"`

## Phase 1: 根据平台确保 CDP 可连接（9222）

```bash
# 桌面端：
curl -s http://127.0.0.1:9222/json/version
# 如果没响应，重启 OneKey（禁止 open，禁止第二实例）
pkill -f "OneKey" 2>/dev/null; sleep 2
$ONEKEY_BIN --remote-debugging-port=9222 &
sleep 5
curl -s http://127.0.0.1:9222/json/version

# 插件端/Web 端：
# google-chrome --remote-debugging-port=9222 [--user-data-dir=<path>] [--load-extension=<path>]
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
