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
$ONEKEY_BIN --remote-debugging-port=9222 &
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

### 3.2.x 弹窗交互编码规范（强制 — 来自 Market Search 复盘）

以下三类 bug 曾导致脚本完全无法执行，生成脚本时**必须逐条检查**：

#### Bug 1：触发元素 vs 弹窗内元素混淆

OneKey 的搜索、选择器等 UI 模式：点击头部元素 → 打开 `APP-Modal-Screen` 弹窗 → 弹窗内有**独立的**输入框和操作按钮。

**错误写法**（反复点击触发元素）：
```javascript
// ❌ 每次搜索都重新点击头部搜索框 → 反复关闭/重开弹窗
async function search(page, value) {
  await page.click('[data-testid="nav-header-search"]'); // 每次都打开新弹窗
  await page.fill('[data-testid="nav-header-search"]', value); // 填到了头部输入框
}
```

**正确写法**（分离打开 vs 操作）：
```javascript
// ✅ 只在弹窗未打开时点击触发元素，后续操作定位弹窗内部
async function openSearchModal(page) {
  const isOpen = await page.evaluate(() => {
    const m = document.querySelector('[data-testid="APP-Modal-Screen"]');
    return m && m.getBoundingClientRect().width > 0;
  });
  if (isOpen) return; // 已打开则不重复触发
  await page.click('[data-testid="nav-header-search"]');
  await sleep(800);
}

function getModalInput(page) {
  return page.locator('[data-testid="APP-Modal-Screen"] input').first();
}
```

**检查清单**：
- [ ] 脚本中是否有"触发弹窗的元素"被多次点击？
- [ ] 弹窗打开后，后续操作是否都定位到 `APP-Modal-Screen` 内部？
- [ ] 写脚本前是否用 CDP 探测过弹窗内部结构？

#### Bug 2：React 输入方式不兼容

OneKey 是 React 应用，常规的 `nativeInputValueSetter` 和 `page.keyboard.type()` 都无法可靠触发 React 状态更新。

**错误写法**：
```javascript
// ❌ nativeInputValueSetter — React 不响应
const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
nativeSet.call(input, 'BTC');
input.dispatchEvent(new Event('input', { bubbles: true }));

// ❌ page.keyboard.type — CDP Electron 中不可靠
await page.keyboard.type('BTC');

// ❌ Meta+a 清空 — 触发 Electron 全局快捷键
await page.keyboard.press('Meta+a');
```

**正确写法**：
```javascript
// ✅ locator.pressSequentially — 唯一可靠方式
const modalInput = page.locator('[data-testid="APP-Modal-Screen"] input').first();
await modalInput.click();
// 清空：用 input.select() + Backspace（不用 Meta+a）
await page.evaluate(() => {
  const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
  const input = modal?.querySelector('input');
  if (input) { input.focus(); input.select(); }
});
await page.keyboard.press('Backspace');
// 输入：用 pressSequentially
await modalInput.pressSequentially('BTC', { delay: 40 });
```

**检查清单**：
- [ ] 是否使用了 `nativeInputValueSetter`？→ 改为 `pressSequentially`
- [ ] 是否使用了 `page.keyboard.type()`？→ 改为 `locator.pressSequentially()`
- [ ] 是否使用了 `Meta+a` 清空？→ 改为 `input.select()` + `Backspace`

#### Bug 3：异步结果未轮询等待

搜索/过滤结果通过 API 异步返回，固定 `sleep()` 不可靠（尤其冷启动场景）。

**错误写法**：
```javascript
// ❌ 固定等待 — 网络慢时必然失败
await sleep(900);
const ok = hasContent(page);
if (!ok) throw new Error('No results');
```

**正确写法**：
```javascript
// ✅ 轮询重试 — 最多 10 次 × 500ms
for (let i = 0; i < 10; i++) {
  const ok = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    const text = modal?.textContent || '';
    return text.includes('$') || text.includes('未找到') || text.includes('暂无');
  });
  if (ok) return;
  await sleep(500);
}
throw new Error('Results not loaded');
```

**检查清单**：
- [ ] 搜索/过滤后的断言是否有重试机制？
- [ ] 重试次数是否 >= 8（覆盖冷启动场景）？
- [ ] 是否同时检测了"有结果"和"空状态"两种合法情况？

#### 附加：弹窗 backdrop 拦截

`APP-Modal-Screen` 打开时 `app-modal-stacks-backdrop` 覆盖全屏，拦截弹窗外点击。需要操作弹窗外元素时：
- 方案 A：先 `closeSearch(page)` 关闭弹窗
- 方案 B：用 `page.evaluate()` 在弹窗内找等价元素并 JS 点击

### 3.2.1 参数化覆盖（强制）

当同一场景存在多个“等价输入参数”（例如搜索 Symbol：BTC/ETH/SOL；异常输入：特殊字符/emoji/空格），**生成用例与脚本时必须参数化并展开覆盖**，不得只录制/只实现其中一个参数就宣称覆盖完成。

硬性要求：

1. **输出参数集**：为每个场景列出 `params`（建议以数组/对象结构表达），并说明每个参数的覆盖目的（主币优先/大小写不敏感/模糊匹配/多链大列表/无结果/异常输入等）。
2. **输出覆盖矩阵**：将“用例要求”逐条映射到“场景 + 参数 + 断言口径”，保证可追溯与可审计。
3. **脚本必须循环执行参数集**：同一场景的核心交互流复用一次录制的稳定定位点（如输入框 `data-testid`），对 `params` 逐个执行，并在每个参数下做对应断言。
4. **参数差异点分场景**：只有当输入会触发不同 UI 分支（如出现/不出现额外标识、不同列表结构、不同跳转链路）才拆成独立 test case；否则保持参数化循环，避免重复录制与重复代码。

### 3.2.2 录制一致性与定位门禁（强制）

生成脚本时必须满足以下要求：

1. **Strict Replay 默认开启**：对用户已确认的录制清单，脚本必须按相同顺序执行对应动作（click → input → click…），不得用“等价的更稳定逻辑流程”替换掉用户确认过的动作顺序。
2. **允许补充但不允许替换**：可以为不可录制的动作补充（如滚动到底、等待加载、空状态判定），但不能跳过/重排录制动作来“看起来更稳定”。
3. **定位必须收敛**：任何录制中出现的关键动作，如果最初落点无 `data-testid` 或不稳定，必须在生成脚本时用可稳定定位的等价落点替代（并保持动作顺序不变），直到能稳定执行。
4. **结束标准**：只有在本地至少跑通一次对应脚本（或该 feature 的关键用例集）并确认交互与录制一致，才允许标记“生成完成”。

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
- 用 `nativeInputValueSetter` 设置 React 输入框的值
- 用 `page.keyboard.type()` 替代 `locator.pressSequentially()`
- 用 `Meta+a` 清空输入框（Electron 快捷键冲突）
- 对弹窗触发元素反复点击（应检测弹窗是否已打开）
- 搜索/过滤后用固定 `sleep()` 代替轮询等待
- 修改脚本后不重启 Dashboard 就直接执行

## 关键路径

- Tests: `src/tests/{cosmos,perps,wallet,referral,settings}/*.test.mjs`
- Helpers: `src/tests/helpers/{index,navigation,accounts,network,transfer,preconditions}.mjs`
- Recorder: `src/recorder/listen.mjs` (port 3210)
- Shared state: `shared/{test_cases,preconditions,ui-map}.json`
