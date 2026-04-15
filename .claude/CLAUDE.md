# OneKey Agent Test - Project Instructions

## Project Overview
Three-layer multi-agent UI automation testing system for OneKey wallet.
Connected via CDP (`http://127.0.0.1:9222`) using Playwright `connectOverCDP`.

## OneKey Desktop App
- **可执行路径可配置**：通过环境变量 `ONEKEY_BIN` 指定，默认 `/Applications/OneKey-3.localized/OneKey.app/Contents/MacOS/OneKey`
- **CDP URL 可配置**：通过环境变量 `CDP_URL` 指定，默认 `http://127.0.0.1:9222`
- **Launch command**: `$ONEKEY_BIN --remote-debugging-port=9222`
- 配置方式：在 `.env` 文件中设置 `ONEKEY_BIN=/your/path/to/OneKey`

### 测试平台选择规则（每次会话必须询问）
- **每次会话首次需要连接 OneKey 时，必须询问用户要测试的平台**，不论 `.env` 是否已配置：
  ```
  请选择要测试的平台：
  1. 桌面端 TF 包（TestFlight）— /Applications/OneKey-3.localized/OneKey.app
  2. 桌面端 MAS 包（Mac App Store）— 请提供路径
  3. 浏览器插件端 — 请提供插件 ID（Extension ID）+ Chrome 用户目录（User Data Dir）
  4. Web 端 — 请提供要使用的 Chrome 用户目录（User Data Dir）
  ```
- **桌面端（选项 1/2）**：用户选择后，将对应路径的 `Contents/MacOS/OneKey` 写入 `.env` 的 `ONEKEY_BIN=`，通过 CDP 连接
- **插件端（选项 3）**：需要两个信息 — ①Extension ID ②Chrome Profile。自动扫描 `~/Library/Application Support/Google/Chrome/` 下的 Profile 目录，列出可选 profile 让用户选择（显示 profile 名称），然后再询问 Extension ID。Launch command: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --remote-debugging-port=9222 --user-data-dir=<Chrome根目录> --profile-directory=<Profile N>`
- **Web 端（选项 4）**：自动扫描并列出可用 Chrome Profile 让用户选择，无需手动输入路径。Launch command: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --remote-debugging-port=9222 --user-data-dir=<Chrome根目录> --profile-directory=<Profile N>`
- **Chrome Profile 自动扫描与选择逻辑**：
  1. 扫描 `~/Library/Application Support/Google/Chrome/` 下的所有 Profile 目录（Default、Profile N）
  2. 读取每个 Profile 的 `Preferences` 文件获取显示名称
  3. **只有 1 个 profile → 直接使用，不询问**
  4. **多个 profile → 列出编号让用户选择**：
     ```
     检测到以下 Chrome Profile：
     1. Default → 个人
     2. Profile 2 → 用户2
     3. Profile 3 → 工作
     请选择要使用的 Profile（输入编号）：
     ```
  ```bash
  # 扫描脚本
  for dir in ~/Library/Application\ Support/Google/Chrome/Profile* ~/Library/Application\ Support/Google/Chrome/Default; do
    [ -d "$dir" ] && python3 -c "
  import json, os
  prefs = json.load(open(os.path.join('$dir', 'Preferences')))
  print(f'$(basename "$dir")  →  {prefs.get(\"profile\",{}).get(\"name\",\"unnamed\")}')
  " 2>/dev/null
  done
  ```
- 用户选择后记住本次会话的平台选择，同一会话内不重复询问

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
| `shared/ui-map.json` | Knowledge Builder | Current execution selector mappings |
| `shared/ui-semantic-map.json` | Knowledge Builder | Additive semantic locator registry for generation/maintenance |
| `shared/generated/app-monorepo-testid-index.json` | Knowledge Builder | Synced app-monorepo testID index |
| `shared/mem_cells.json` | Knowledge Builder | Raw memory events |
| `shared/mem_scenes.json` | Knowledge Builder | Clustered scenes |
| `shared/profile.json` | Knowledge Builder | Agent capability profile |
| `shared/diagnosis.json` | QA Manager | Failure diagnosis |
| `shared/results/<id>.json` | Runner | Execution results |
| `shared/reports/*.md` | Reporter | Quality reports |
| `shared/reports/review-*.md` | QA Reviewer | Pre-commit review reports |

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
- Selector strategy (current execution path): ui-map primary → fallbacks → JS evaluate emergency
- Selector reference order for new test generation / maintenance: `shared/ui-semantic-map.json` → `shared/generated/app-monorepo-testid-index.json` → `shared/ui-map.json` → runtime exploration
- Bug fixes require user approval — only diagnosis + repair proposal
- **自动积累经验（强制 · 不等用户提醒）**：录制、测试、调试过程中遇到的坑（如选择器失效、CDP 断连、弹窗拦截、时序问题等），**每次发现后立即追加**到 `shared/knowledge.json`，无需用户额外指令。ID 递增（K-NNN），category 用 `recording` / `quirk` / `locator` / `timing` / `assertion` / `process` 等分类。
  - **必须触发**的场景：①用户指出脚本/用例有错 ②修复了一个非显而易见的 bug ③发现 DOM 结构与预期不同 ④找到原本 testid/选择器失效的规避方案 ⑤手动操作和自动化行为不一致
  - **触发时机**：修复动作完成的同一轮对话内沉淀，不要堆到最后，不要等用户说「沉淀一下」
  - **验证**：每次提交前执行 `git diff shared/knowledge.json`，如果本次对话修了 bug 但 knowledge.json 没变更，说明漏了沉淀，必须补上
- **规则双写**：修改 `.claude/CLAUDE.md` 或 `.cursorrules` 中的规则时，必须同步更新另一个文件中的对应部分，保持两边一致。无需用户额外确认
- **QA 三线闭环流程（强制）**：项目包含三条 QA 线（①手动用例 ②API 自动化 ③UI 自动化），各有独立的规范入口和闭环流程，详见 `docs/qa/rules/qa-workflow-rules.md`。**核心规则**：操作前必须先读取对应线路的规范文件（不可凭记忆替代）；操作后必须将新发现沉淀到项目文档（不存 AI 私有记忆）；修改一条线时必须检查对其他两条线的影响。
- **用户纠正自动沉淀（强制）**：当用户纠正了 AI 生成的用例/脚本/规则内容时，AI 必须在任务完成后主动执行：①列出被纠正的具体内容 ②检查是否已写入对应规范文件（qa-rules.md / module-rules.md / CLAUDE.md 等）③对未覆盖的纠正点，**主动询问用户是否写入规范**。详见 `docs/qa/rules/qa-workflow-rules.md` 「用户纠正自动沉淀机制」章节。
- **提交前 QA 审查**：commit / PR 前自动执行 `/onekey-qa-review`，检查用例、规则、脚本、Skill 的规范性、一致性和安全性。安全问题硬拦截（不可跳过），其他 block 问题软拦截（可确认跳过）。审查报告保存到 `shared/reports/review-*.md`

## Default Workflow（写新用例时必须遵循，不要再问）
0. **录制/生成前必读 `shared/knowledge.json`**，并优先查看 `shared/ui-semantic-map.json` 与 `shared/generated/app-monorepo-testid-index.json` — 避免重复犯错，也避免重复探索已有定位
1. 启动 OneKey 桌面端（CDP）
2. 启动录制器 `node src/recorder/listen.mjs`（有 Web 监控 UI http://localhost:3210）
3. 用户在 app 上操作，录制器自动捕获
4. 用户说"录制完了" → 停止录制，列出操作清单让用户确认
5. 确认后 → 生成测试用例 + 必要时更新 ui-semantic-map / ui-map + 写测试脚本
6. **录制/测试过程中遇到新问题，自动追加到 `shared/knowledge.json`**（无需用户指令）
- 正确流程：**Read knowledge → Record → Update test cases → Update scripts → Write knowledge**

### 连续录制多个用例的注意事项
- 录完一个用例后，在 Monitor UI (http://localhost:3210) 点 **"New Session"** 清空步骤再录下一个
- 如果 CDP 断连，点 **"Reconnect"** 而不是重启录制器进程
- 不需要每次都重启 `listen.mjs`，录制器支持断线自动重连

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

### 1:1 用例对照（最重要的规则）
- **生成脚本前必须先读取对应的测试用例文档**（`docs/qa/testcases/cases/<module>/`），逐条对照"预期结果"列编写断言
- **生成 Swap 用例前必须先读取** `docs/qa/rules/swap-network-features.md`，其中代币合约地址与账户地址为唯一维护来源（source of truth）
- **禁止使用笼统的软断言**，如 `assertHasSomeTableLikeContent(page)`（只检查"有东西"）。必须验证具体内容：
  - 用例要求"显示价格" → 断言找到价格元素且格式正确（如 `$1,234.56` 或 `¥1,234.56`）
  - 用例要求"地址格式 0x1234...abcd" → 断言正则匹配 `/^0x[\da-f]{4,6}\.{3}[\da-f]{4}$/i`
  - 用例要求"收藏后数量+1" → 断言 `afterCount === beforeCount + 1`，而非 `afterCount !== beforeCount`
  - 用例要求"状态同步" → 在所有指定入口点验证状态一致，不能只查一个
- **每个断言必须有明确的 passed/failed 判定**，不允许"软校验"（如 `skip: no stable clickable row detected` 就标 passed）

### 用例粒度规则（严格执行）
- **一个 testCase 对应用例文档的一个大标题（一级编号）**，不要把每个测试点拆成独立用例
- 例如用例文档有 8 个大标题（1. 默认指标 / 2. 指标管理 / 3. 画图工具 / ...），脚本就生成 **8 个 testCase**，不是 31 个
- 每个 testCase 内部用多个 `safeStep` / `_ssStep` 覆盖该标题下的所有子测试点
- 无法自动化的子测试点在 testCase 内部标记 `t.add(name, 'passed', 'SKIP: 原因')`，不要拆成独立的 SKIP 用例
- ID 编号以文档大标题顺序为准：`<MODULE>-<FEATURE>-001` 到 `<MODULE>-<FEATURE>-00N`

### 用例编排与序号映射（录制前必须输出）
读取用例文档后，先输出 **编排计划** 再引导录制：

1. **列出所有用例序号和测试点**（从用例文档提取）
2. **分析哪些用例可以合并为一段连续录制流**（操作连贯、前置条件相同、UI 上下文不切换的用例才可合并）
3. **输出编排结果**，格式如下：
   ```
   用例编排计划（共 10 个用例 → 6 段录制流）：

   录制 1 → 用例 #1「打开 Market 页面」
     测试点：页面加载、Tab 默认选中、列表展示

   录制 2 → 用例 #2+#3+#4「搜索功能」（合并原因：连续搜索操作，无需切换页面）
     #2 测试点：输入 BTC → 显示结果、价格格式、地址格式
     #3 测试点：模糊搜索 bt → 匹配结果包含 BTC
     #4 测试点：清空搜索 → 恢复默认列表

   录制 3 → 用例 #5「异常输入」
     测试点：空字符串、特殊字符、超长输入 → 各自预期行为

   录制 4 → 用例 #6+#7+#8「收藏功能」（合并原因：收藏→验证→取消收藏是连续流程）
     #6 测试点：点击收藏 → 数量+1、星标高亮
     #7 测试点：切换到自选列表 → 验证已收藏 Token 出现
     #8 测试点：取消收藏 → 数量-1、自选列表移除

   录制 5 → 用例 #9「列表滚动加载」
     测试点：滚动到底部 → 加载更多、无重复

   录制 6 → 用例 #10「跨入口状态同步」
     测试点：在搜索/自选/详情/钱包首页验证收藏状态一致

   请确认编排方案，确认后开始逐段录制。
   ```
4. **用户确认编排后**，按录制段逐个引导录制
5. **生成脚本时**，每个 testCase 的 id 和 name 必须对应用例文档的原始序号：
   ```javascript
   // 覆盖映射：
   // 录制 2 → 用例 #2+#3+#4「搜索功能」
   //   #2 "输入 BTC 显示结果" → L45 searchAndAssertResult('BTC')
   //   #3 "模糊搜索 bt" → L52 searchAndAssertResult('bt')
   //   #4 "清空搜索恢复默认" → L58 clearAndAssertDefault()
   {
     id: 'MARKET-SEARCH-002',  // 以合并组的第一个用例编号命名
     name: '搜索功能（用例 #2+#3+#4）',
     covers: ['#2 精确搜索', '#3 模糊搜索', '#4 清空恢复'],
     fn: async (page) => { ... }
   }
   ```

### 断言编写标准
- **字段级验证**：不是"页面有内容"就行，要验证具体字段（名称、价格、数量、格式）
- **数值变化验证**：用精确的 delta 比较（`=== before + 1`），不用模糊比较（`!== before`）
- **跨入口状态验证**：用例要求"多入口状态同步"时，必须导航到每个入口逐一验证
- **边界场景验证**：用例文档中的异常输入（空字符串、特殊字符、超长字符串）必须逐个测试并验证具体行为，不是"不报错就行"
- **空状态判定**：版块/tab 下无代币但显示空状态提示（"未找到"/"暂无代币"）属于**正常**，不应标记为 failed。只有既没有代币列表也没有空状态提示才算异常

### 脚本结构规则
- **脚本必须连贯执行**：一个用例对应录制中的一段连贯操作流程，不得把连续动作拆成多个孤立用例
- **fn(page) 签名兼容**：所有 testCases 的 fn 只接收 `page` 一个参数（dashboard executor 兼容），前置条件用模块级缓存 `_preReport`
- **setup() 包含前置条件检查**：前置条件在 `setup(page)` 中运行并缓存，不在每个 fn 中重复运行
- **截图只在失败时**：正常通过的步骤不截图，截图会严重拖慢执行速度
- **Token 正则需兼容数字**：代币名可能包含数字（如 XYZ100），正则用 `/^[A-Z][A-Z0-9]{1,9}$/`
- **DOM 选择器要限定区域**：顶部行情栏的选择器必须加 `r.y < 100` 位置过滤

### Dashboard 实时日志规则（强制执行）
> 所有用例必须在 Dashboard 执行面板中显示实时步骤日志。QA 能及时看到每步的执行状态和报错，不用等整个用例跑完。

1. **必须使用 `createStepTracker` + `safeStep`**
   - 每个 testCase 的 `fn(page)` 必须用 `createStepTracker(testId)` 创建步骤跟踪器
   - 每个操作步骤用 `safeStep(page, t, '步骤名', async () => { ... }, SCREENSHOT_DIR)` 包裹
   - `fn` 最后必须 `return t.result()` 返回步骤结果
   - **禁止**使用自定义 `addStep()` 或直接 `console.log` 替代

2. **步骤粒度要求**
   - 每个有意义的操作（打开页面、输入搜索、点击按钮、验证结果）都必须是一个独立 step
   - step 名称简洁描述做了什么（如 `搜索 BTC 有结果`、`点击收藏按钮`、`验证价格格式`）
   - step detail 包含关键数据（如 `3 results`、`price=$1,234.56`、`navigated`）

3. **错误和跳过必须有 detail**
   - `t.add(name, 'failed', error.message)` — 失败步骤必须带错误信息
   - `t.add(name, 'skipped', '原因')` — 跳过步骤必须说明原因
   - **禁止**空 detail 的 failed/skipped 步骤

4. **标准模板**（新用例必须遵循）
   ```javascript
   import { createStepTracker, safeStep } from '../../helpers/components.mjs';

   async function testXxx001(page) {
     const t = createStepTracker('XXX-001');
     await safeStep(page, t, '步骤 1 描述', async () => {
       // ... 操作代码
       return '可选的 detail 信息';
     }, SCREENSHOT_DIR);
     await safeStep(page, t, '步骤 2 描述', async () => {
       // ... 断言代码
       return `found ${count} items`;
     }, SCREENSHOT_DIR);
     return t.result();
   }
   ```

5. **日志机制**
   - `t.add()` 输出 `[OK|FAIL|SKIP] name — detail` 被 executor 实时拦截 → SSE 推送到 Dashboard
   - 普通 `console.log` 也会实时显示在日志面板中
   - **只要用了 `createStepTracker` 就自动有实时日志**，无需额外配置

### 弹窗/Modal 交互规则（严格执行）
> 来源：Market 搜索脚本三大 bug 的复盘总结。

1. **区分"触发元素"与"弹窗内元素"**
   - OneKey 中很多交互是：点击头部/侧栏元素 → 弹出 `APP-Modal-Screen` 弹窗 → 弹窗内有独立的输入框/按钮。
   - **严禁**对同一个触发元素反复点击来"刷新"弹窗。打开弹窗后，后续所有操作必须定位到弹窗**内部**的元素。
   - 写脚本前必须先用 CDP 探测弹窗结构：`document.querySelector('[data-testid="APP-Modal-Screen"]')` 是否存在、内部有哪些可交互元素。

2. **输入方式：必须用 `locator.pressSequentially()`**
   - OneKey 基于 React，`nativeInputValueSetter` + `dispatchEvent` **无法触发 React 搜索/过滤**。
   - `page.keyboard.type()` 在 CDP 连接的 Electron 应用中也可能不生效。
   - **唯一可靠方式**：`locator.pressSequentially(value, { delay: 30~80 })`，通过 Playwright locator 逐字符分发真实按键事件。
   - 清空输入框用 `input.select()` + `Backspace`，**禁止用 `Meta+a`**（会触发 Electron 全局快捷键）。

3. **异步结果必须轮询等待**
   - 搜索/过滤结果通过 API 异步返回，固定 `sleep()` 不可靠。
   - **必须用轮询重试**：最多 N 次（建议 8~10），每次间隔 500ms，检查弹窗内容是否包含预期标志（`$` 符号、地址格式、空状态文本等）。
   - 首次打开弹窗（冷启动）可能需要更长时间加载热门数据，重试次数不能太少。

4. **弹窗 backdrop 会拦截外部点击**
   - `APP-Modal-Screen` 打开时，`app-modal-stacks-backdrop` 覆盖全屏，拦截所有弹窗外的点击。
   - 如果需要操作弹窗外的元素（如列表页的收藏按钮），**必须先关闭弹窗**，或者用 `page.evaluate()` 在弹窗内部查找等价元素并通过 JS 点击。

5. **Dashboard 热更新**
   - Dashboard (`src/dashboard/server.ts`) 使用 ESM `import()` 动态加载测试模块，Node.js 会缓存模块。
   - **修改测试脚本后必须重启 Dashboard**（`pkill -f "tsx src/dashboard"` 然后重新启动），否则执行的还是旧代码。
   - **每次启动 Dashboard 前必须先杀旧进程**：无论 5050 端口是否有响应，都先执行 `pkill -f "tsx src/dashboard"`，等待 1~2 秒后再启动新实例。旧进程可能残留上次的执行状态（running/卡住），导致新执行无法正常启动。

### 公共组件自动提取规则（严格执行）
> 来源：组件库建设和 Perps 图表录制过程中的经验总结。

1. **录制/写脚本时发现重复定位逻辑 → 自动提取到公共库**
   - 同一个元素定位代码出现在 2 个以上文件中 → 提取到 `components.mjs` 或对应的 Page Object
   - 不需要询问用户，直接提取并更新调用方
   - 提取后同步更新 `shared/ui-map.json`（如果是新元素）

2. **新发现的通用元素 → 自动加入 `ui-map.json` + `components.mjs`**
   - 录制过程中发现的可复用元素（侧栏 tab、弹窗按钮、设置开关等），直接加入 ui-map
   - 对应的操作函数加入 `components.mjs` 或 Page Object
   - 更新 `SIDEBAR_TAB_MAP` 等映射表

3. **TMPopover-ScrollView 必须遍历所有实例**
   - 页面有 8+ 个 TMPopover-ScrollView，`querySelector` 只返回第一个（隐藏的）
   - **必须** `querySelectorAll` 遍历找 `getBoundingClientRect().width > 0` 的
   - 公共方法：`isPopoverVisible(page)`、`dismissPopover(page)`、`FIND_VISIBLE_POPOVER_JS`

### 元素定位策略选择规则（严格执行）
> 根据元素所在的渲染层选择不同的定位和断言策略，避免卡住。

#### 策略决策树：
```
元素在哪里？
├── 主页面 DOM（有 data-testid 或文本）
│   → 用 registry.resolve() 或 page.locator()
│   → 断言：直接读 DOM 属性/文本
│
├── Electron <webview> 内（如 TradingView 图表）
│   → 用 page.evaluate → wv.executeJavaScript → iframe.contentDocument
│   → 封装为 tvEval(page, jsCode) helper
│   → DOM 可读元素（指标标签、按钮）：直接读文本
│   → Canvas 渲染内容（K线、持仓线、买卖点）：用 canvas hash 对比
│
├── TMPopover-ScrollView 弹窗
│   → 必须 querySelectorAll 遍历找可见的（width > 0）
│   → 弹窗内的 toggle 开关：读 data-state="checked"|"unchecked"
│
├── 被 overlay 拦截的按钮
│   → 先 dismissOverlays(page) / dismissPopover(page)
│   → 或用 clickWithPointerEvents(page, selector)
│   → 或用 page.evaluate 内部 JS click
│
└── 无法通过 DOM/Canvas 断言的内容
    → 标记 SKIP + 原因，不要硬编码假断言
```

#### Canvas Hash 断言规则（用于 TV 图表等 canvas 渲染内容）：
- **适用场景**：买卖点标记、持仓线/挂单线/爆仓线、画图工具绑制的图形——这些在 canvas 上渲染，DOM 不可见
- **方法**：`canvas.getContext('2d').getImageData()` 取像素数据计算 hash，开关前后对比
- **必须取 FULL canvas 尺寸**（`c.width, c.height`），不能只取 200x200 区域——持仓线可能在图表中下部
- **步长**：用 `step=100` 遍历避免 `executeJavaScript` 超时
- **等待时间**：toggle 后等 4 秒让 canvas 完成重绘
- **容错**：hash 不变可能表示当前账户无相关数据（无持仓/无交易历史），标记为 info 而非 fail

#### Webview 穿透规则（TradingView 图表）：
- Perps/Market 的 TV 图表是 Electron `<webview>`，不在 `page.frames()` 中
- 访问路径：`page.evaluate → wv.executeJavaScript → iframe.contentDocument`
- **executeJavaScript 内的代码不能太复杂**，否则会报 "Script failed to execute"，拆分为多次简单调用
- 录制器（listen.mjs）**无法捕获 webview 内部事件**，TV 图表内的操作需要用脚本直接操作
- 时间周期列表**动态获取**，不硬编码

#### 账户切换规则：
- 账户选择器（AccountSelectorTriggerBase）只在**钱包页**可见，操作前先 `clickSidebarTab(page, 'Wallet')`
- 搜索框被 overlay 拦截，用 `page.evaluate` 内部 `nativeInputValueSetter` 输入
- 搜索**只在当前选中的钱包类型内**生效，切换观察钱包需先点击「观察钱包」tab
- 公共方法：`switchToAccount(page, 'hl-99', '观察钱包')`

## Task Status Flow
pending → in_progress → completed | failed | blocked

## Result File Format

`shared/results/<TEST-ID>.json`:
```json
{
  "testId": "ADDR-ADD-001",
  "status": "passed",
  "duration": 12345,
  "steps": [{ "name": "...", "status": "passed", "detail": "..." }],
  "errors": [],
  "timestamp": "2026-04-14T05:30:00Z"
}
```

## CLI Runner & Dashboard API

```bash
# CLI Runner
node src/tests/run.mjs                    # 列出所有可用测试
node src/tests/run.mjs perps              # 运行整个模块
node src/tests/run.mjs settings/language  # 运行子路径
node src/tests/desktop/utility/address-book-add.test.mjs           # 单文件
node src/tests/desktop/utility/address-book-add.test.mjs ADDR-ADD-003  # 单用例

# Dashboard API
curl -s http://localhost:5050/api/status
curl -X POST http://localhost:5050/api/run \
  -H 'Content-Type: application/json' \
  -d '{"cases": ["ADDR-ADD-001", "ADDR-VALID-001"]}'
```

## QA Director 失败路由逻辑

| 根因分类 | 特征 | 路由到 | 处理方式 |
|---------|------|--------|---------|
| `selector_stale` | Element not found, selector timeout | Knowledge Builder | 更新 `ui-map.json` |
| `data_missing` | 余额为 0, Token 未添加 | Knowledge Builder | 更新 `preconditions.json` |
| `assertion_logic` | Expected X got Y, 正则不匹配 | 用户 | 提供修改建议（不自己改） |
| `environment` | ECONNREFUSED, Browser closed | 自动 | 重启 OneKey |
| `timing` | 间歇性失败, 加载中点击 | 用户 | 建议加 wait/轮询 |

## Reporter 格式规则

- 耗时格式：`MM:SS`（如 `3:45` = 3 分 45 秒）
- 通过率保留一位小数（如 `80.0%`）
- 失败用例必须附带错误信息摘要和截图路径
- 同一天多次运行覆盖同一报告文件
- **永远不删除历史报告**

## Do / Don't 清单

### Do
- 用 `chromium.connectOverCDP()` 连接 OneKey
- 启动前检查 CDP，无响应则 pkill + 重启
- `fn(page)` 单参数签名，兼容 Dashboard executor
- `_preReport` 模块级缓存前置条件
- DOM 选择器用 `.first()` / `.nth()` 限定
- 顶部栏选择器加 `r.y < 100` 位置过滤
- Token 正则 `/^[A-Z][A-Z0-9]{1,9}$/`
- 空状态（"未找到"/"暂无代币"）视为正常
- 截图只在失败时
- 脚本保持连贯执行流
- 修改脚本后重启 Dashboard
- 录制后列出操作清单，用户确认后才生成脚本
- 提交前执行 `/onekey-qa-review`

### Don't
- 不要硬编码 OneKey 路径，用 `ONEKEY_BIN` 环境变量
- 不要用 `open` 命令启动 OneKey 或打开浏览器页面
- 不要 spawn 第二个 OneKey 实例
- 不要调用 `page.setViewportSize()`
- 不要用 MCP Playwright 工具连接 OneKey
- 不要用未确认的录制结果生成用例
- 不要越权写入非指定 Writer 的 shared 文件
- 不要用 `nativeInputValueSetter` + `dispatchEvent`
- 不要在 CDP Electron 中用 `page.keyboard.type()`，用 `locator.pressSequentially()`
- 不要用 `Meta+a` 清空输入框
- 不要反复点击 Modal 触发元素
- 不要用固定 `sleep()` 等异步结果，用轮询重试
- 不要关闭 browser 连接
- 不要没有证据就猜测根因
- Bug 修复需用户审批，只输出诊断 + 修复建议
