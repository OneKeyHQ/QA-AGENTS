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
- **自动积累经验**：录制、测试、调试过程中遇到的坑（如选择器失效、CDP 断连、弹窗拦截、时序问题等），自动追加到 `shared/knowledge.json`，无需用户额外指令。ID 递增（K-NNN），category 用 `recording` / `quirk` / `locator` / `timing` 等分类
- **规则双写**：修改 `.claude/CLAUDE.md` 或 `.cursorrules` 中的规则时，必须同步更新另一个文件中的对应部分，保持两边一致。无需用户额外确认

## Default Workflow（写新用例时必须遵循，不要再问）
0. **录制前必读 `shared/knowledge.json`** — 包含历次录制和测试中积累的经验，避免重复犯错
1. 启动 OneKey 桌面端（CDP）
2. 启动录制器 `node src/recorder/listen.mjs`（有 Web 监控 UI http://localhost:3210）
3. 用户在 app 上操作，录制器自动捕获
4. 用户说"录制完了" → 停止录制，列出操作清单让用户确认
5. 确认后 → 生成测试用例 + 更新 ui-map + 写测试脚本
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
