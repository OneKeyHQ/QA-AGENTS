# OneKey Agent Test - Project Instructions

## Project Overview
Three-layer multi-agent UI automation testing system for OneKey wallet.
Connected via CDP (`http://127.0.0.1:9222`) using Playwright `connectOverCDP`.

## OneKey Desktop App
- **唯一可执行路径**: `/Applications/OneKey-3.localized/OneKey.app/Contents/MacOS/OneKey`
- **Launch command**: `/Applications/OneKey-3.localized/OneKey.app/Contents/MacOS/OneKey --remote-debugging-port=9222`
- **CDP URL**: `http://127.0.0.1:9222`
- **严禁**使用其他路径（如 `OneKey 3.app`、`OneKey.app` 等），只用上面这个

## CDP & 连接规则（严格执行）
- **NEVER** use MCP Playwright (`browser_navigate`, `browser_snapshot`, etc.) to connect to OneKey. It's a separate browser instance, not the OneKey app.
- **ALWAYS** connect via CDP using `playwright-core`'s `chromium.connectOverCDP('http://127.0.0.1:9222')` in Node.js.
- **ALWAYS** auto-launch OneKey with `--remote-debugging-port=9222` before any test/recording session. Don't ask the user if CDP is ready.
- Wait ~5s after launch for the app to initialize before connecting.
- **NEVER** call `page.setViewportSize()` — 不要改变视图/窗口大小，使用用户当前的窗口尺寸。
- **CDP 无响应时必须重启指定的 OneKey app**：如果 `curl http://127.0.0.1:9222/json/version` 无响应，必须 `pkill -f "OneKey"` 后用上面的唯一路径重新启动，**严禁**连接其他浏览器或 app 实例，**严禁** spawn 第二个 OneKey 进程。
- **NEVER** use `open` command to open URLs — 不要用 `open` 打开浏览器页面，用户会自己刷新已有的标签页。

## Architecture (Three Layers)

### Decision Layer
- `/onekey-qa-director` — **唯一入口**，总协调者。渐进式技能加载（LOAD_SKILL），节流（max N=2），回滚（patch.json），审批门禁。

### Intelligence Layer (串行固定顺序)
1. `/onekey-test-designer` — BDD → intent-only JSON（无 selector）
2. `/onekey-knowledge-builder` — 唯一知识写入者（三阶段记忆管线）
3. `/onekey-qa-manager` — 诊断 only（不改代码、不写知识）

### Execution Layer
- `/onekey-runner` — 纯函数 `run_case(test_id, platform)`
- `/onekey-recorder` — 探索工具（非生产）
- `/onekey-reporter` — 报告 + 趋势仪表盘

## Shared State Files (Exclusive Write Permissions)
| File | Writer | Description |
|------|--------|-------------|
| `shared/test_cases.json` | Test Designer | Intent-only test cases |
| `shared/preconditions.json` | — | 公共前置条件数据库 |
| `shared/knowledge.json` | Knowledge Builder | Curated patterns |
| `shared/ui-map.json` | Knowledge Builder | Selector mappings |
| `shared/mem_cells.json` | Knowledge Builder | Raw memory events |
| `shared/mem_scenes.json` | Knowledge Builder | Clustered scenes |
| `shared/profile.json` | Knowledge Builder | Agent capability profile |
| `shared/diagnosis.json` | QA Manager | Failure diagnosis |
| `shared/results/<id>.json` | Runner | Execution results |
| `shared/reports/*.md` | Reporter | Quality reports |

## Key Libraries
- `src/knowledge/memory-pipeline.mjs` — Three-phase memory pipeline (MemCells → MemScenes → Recall)
- `src/runner/index.mjs` — Runner with state recovery + multi-strategy selectors
- `src/recorder/index.mjs` — DOM snapshot capture via CDP
- `src/schemas/*.schema.json` — JSON Schema for all shared state files
- `src/tests/helpers/preconditions.mjs` — 通用前置条件检查框架
- `src/dashboard/server.ts` — 测试执行面板（http://localhost:5050）

## Conventions
- Test case IDs: `<FEATURE>-<NNN>` (e.g., COSMOS-001)
- Result files: `shared/results/<id>.json`
- Selector strategy: ui-map primary → fallbacks → JS evaluate emergency
- Bug fixes require user approval — only diagnosis + repair proposal

## Default Workflow（写新用例时必须遵循，不要再问）
1. 启动 OneKey 桌面端（CDP）
2. 启动录制器 `node src/recorder/listen.mjs`（有 Web 监控 UI http://localhost:3210）
3. 用户在 app 上操作，录制器自动捕获
4. 用户说"录制完了" → 停止录制，列出操作清单让用户确认
5. 确认后 → 生成测试用例 + 更新 ui-map + 写测试脚本
- 正确流程：**Record → Update test cases → Update scripts**（不是反过来）

## Recording Rules（严格执行）
- **录制脚本后，必须将所有点击操作按顺序列出**，交给用户确认顺序是否正确、是否有遗漏。
- 未经用户确认的录制结果，不得直接用于生成测试用例或更新 ui-map。
- 列出格式示例：
  ```
  录制步骤确认：
  1. 点击 [元素描述] — selector: ...
  2. 点击 [元素描述] — selector: ...
  3. 输入 [内容] 到 [元素描述] — selector: ...
  ...
  请确认以上步骤顺序和完整性。
  ```

## Test Script Rules（严格执行）
- **脚本必须连贯执行**：一个用例对应录制中的一段连贯操作流程，不得把连续动作拆成多个孤立用例。
  - 正确：搜索 BT → 保持搜索词切 tab → 每个 tab 验证结果 → 清空搜索（一个用例）
  - 错误：搜索 BT 单独一个用例、切 tab 单独一个用例、搜索+过滤又一个用例
- **断言判定规则**：版块/tab 下无代币但显示空状态提示（"未找到"/"暂无代币"）属于**正常**，不应标记为 failed。只有既没有代币列表也没有空状态提示才算异常。
- **fn(page) 签名兼容**：所有 testCases 的 fn 只接收 `page` 一个参数（dashboard executor 兼容），前置条件用模块级缓存 `_preReport`。
- **setup() 包含前置条件检查**：前置条件在 `setup(page)` 中运行并缓存，不在每个 fn 中重复运行，避免用例间卡顿。
- **截图只在失败时**：正常通过的步骤不截图，只有断言失败或 catch 到异常时才截图。截图会严重拖慢执行速度。
- **Token 正则需兼容数字**：代币名可能包含数字（如 XYZ100），正则用 `/^[A-Z][A-Z0-9]{1,9}$/` 而非 `/^[A-Z]{2,10}$/`。
- **DOM 选择器要限定区域**：顶部行情栏的选择器必须加 `r.y < 100` 位置过滤，避免匹配到页面其他区域的同名元素。

## Task Status Flow
pending → in_progress → completed | failed | blocked
