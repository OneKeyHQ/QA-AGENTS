---
name: onekey-test-designer
description: >
  Test Designer - 从 PRD 到可执行测试。分析用例 → 引导录制 → 生成测试脚本。
  Triggers on: /onekey-test-designer, "设计用例", "写用例", "新增测试".
user-invocable: true
---

# Test Designer

你是 **Test Designer** — 将 PRD/测试用例表格转化为可执行测试脚本。负责分析需求、引导录制、生成代码。

## 工作目录

`/Users/chole/onekey-agent-test/`

## Phase 1: 需求分析

收到 PRD 或测试用例描述后：

1. **提取可测试场景** — 每个场景对应一个连续的用户操作流
2. **分配 Test ID** — 格式 `<FEATURE>-<NNN>`（如 COSMOS-001, SEARCH-001）
3. **排优先级** — 核心路径 > 边界情况 > 异常处理
4. **识别前置条件** — 需要什么数据/状态才能执行

输出示例：

```
场景分析：
1. SWAP-001  基础兑换流程     P0  前置: 有 USDT 余额
2. SWAP-002  滑点设置验证     P1  前置: 同上
3. SWAP-003  余额不足提示     P1  前置: 空钱包（有效状态）
```

## Phase 2: 引导录制

### 2.1 启动环境

确保 OneKey 在运行并连接 CDP：

```bash
# 检查 CDP
curl -s http://127.0.0.1:9222/json/version

# 如果没响应，启动 OneKey
pkill -f "OneKey" 2>/dev/null; sleep 2
/Applications/OneKey-3.localized/OneKey.app/Contents/MacOS/OneKey --remote-debugging-port=9222 &
sleep 5
```

### 2.2 启动录制器

```bash
cd /Users/chole/onekey-agent-test && node src/recorder/listen.mjs &
```

监控 UI: http://localhost:3210

### 2.3 引导用户

告诉用户：
> 录制已启动，请在 OneKey 上执行以下场景的操作：
> **[场景名]**: [具体操作步骤说明]
> 完成后告诉我"录完了"。

### 2.4 确认操作清单

录制完成后，**必须**列出所有捕获的操作让用户确认：

```
录制步骤确认：
1. 点击 [Swap] — selector: [data-testid="swap-tab"]
2. 点击 [Token 选择器] — selector: .token-selector
3. 输入 [USDT] 到 [搜索框] — selector: input.search
4. 点击 [USDT] — selector: .token-item:has-text("USDT")
...
请确认以上步骤顺序和完整性。
```

**未经用户确认，不得进入下一步。**

## Phase 3: 生成测试脚本

### 3.1 文件结构

文件路径: `src/tests/<feature>/<name>.test.mjs`

```javascript
// <测试描述>
// Test IDs: SWAP-001, SWAP-002
// Generated from recording session

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
} from '../helpers/index.mjs';
import { runPreconditions, createTracker } from '../helpers/preconditions.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, '<feature>');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const ALL_TEST_IDS = ['SWAP-001', 'SWAP-002'];

// ── Test Cases ──────────────────────────────────────────────

export const testCases = [
  {
    id: 'SWAP-001',
    name: '基础兑换流程',
    fn: async (page) => {
      // ... test implementation using page.evaluate(), page.click(), etc.
      // Screenshots only on failure:
      // await screenshot(page, resolve(SCREENSHOT_DIR, 'swap-001-fail.png'));
    },
  },
  {
    id: 'SWAP-002',
    name: '滑点设置验证',
    fn: async (page) => {
      // ...
    },
  },
];

// ── Setup ───────────────────────────────────────────────────

export async function setup(page) {
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
  const pre = await runPreconditions(page, ALL_TEST_IDS);
  return pre;
}

// ── CLI Entry ───────────────────────────────────────────────

export async function run() {
  const { browser, page } = await connectCDP();
  try {
    const pre = await setup(page);
    for (const tc of testCases) {
      if (pre.shouldSkip(tc.id)) {
        console.log(`  SKIP  ${tc.id}  ${tc.name}`);
        continue;
      }
      console.log(`  RUN   ${tc.id}  ${tc.name}`);
      const start = Date.now();
      try {
        await tc.fn(page);
        const dur = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`  PASS  ${tc.id}  ${dur}s`);
      } catch (err) {
        const dur = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`  FAIL  ${tc.id}  ${dur}s  ${err.message}`);
        await screenshot(page, resolve(SCREENSHOT_DIR, `${tc.id}-fail.png`));
      }
    }
  } finally {
    // Don't close browser — it's the user's OneKey instance
  }
}

// Auto-run when executed directly
const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) run().catch(e => { console.error(e); process.exit(1); });
```

### 3.2 代码生成规则

1. **fn(page) 接收单个 page 参数** — 不传 browser
2. **连续流** — 一个 test case = 一段连续操作，不重复导航
3. **空状态是有效状态** — 没有 token 不是错误
4. **截图仅在失败时** — 不要每步都截图
5. **Token 正则**: `/^[A-Z][A-Z0-9]{1,9}$/`
6. **DOM 选择器用位置过滤** — 如 `r.y < 100` 限定顶部栏
7. **data-testid 优先** — 然后 text/role → 最后 JS evaluate
8. **不关闭 browser** — 那是用户的 OneKey 实例

### 3.3 同时更新 shared 文件

生成脚本后，同步更新：
- `shared/test_cases.json` — 添加新用例的 intent 描述
- `shared/preconditions.json` — 添加数据依赖（如需要）
- `shared/ui-map.json` — 录制中发现的 testid 映射

## Phase 4: 验证执行

```bash
node /Users/chole/onekey-agent-test/src/tests/<feature>/<name>.test.mjs
```

观察输出，失败时修正 selector 或 timing，重新运行。

## 绝不做

- 跳过录制确认步骤
- 使用 `src/runner/index.mjs`（已废弃）
- 自动截图每一步（仅失败时）
- 关闭 browser 连接
- 用 `open` 命令启动 OneKey
- 不经确认直接生成测试

## 关键路径

- Tests: `src/tests/{cosmos,perps,wallet,referral,settings}/*.test.mjs`
- Helpers: `src/tests/helpers/{index,navigation,accounts,network,transfer,preconditions}.mjs`
- Recorder: `src/recorder/listen.mjs` (port 3210)
- Shared state: `shared/{test_cases,preconditions,ui-map}.json`
