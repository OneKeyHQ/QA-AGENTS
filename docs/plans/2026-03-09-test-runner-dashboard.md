# Test Runner Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the existing dashboard with a test execution control panel where users can multi-select test cases, run them sequentially, and see real-time status with stop/resume/restart controls.

**Architecture:** Server scans test files for exported `testCases` arrays to build a registry. Frontend shows grouped checkboxes. POST /api/run spawns executor in-process, streams status via SSE. State machine handles stop/resume/restart.

**Tech Stack:** Node.js HTTP server (existing `tsx` runner), SSE for real-time updates, vanilla HTML/CSS/JS frontend (consistent with existing dashboard).

---

### Task 1: Add `testCases` export to all test files

Each test file already has internal test case definitions but doesn't export them uniformly. Add a `testCases` export to each file so the registry can discover them.

**Files:**
- Modify: `src/tests/perps/favorites.test.mjs` (already has `tests` array at line 669, just export it)
- Modify: `src/tests/cosmos/transfer.test.mjs` (has `TRANSFERS` array, needs wrapper)
- Modify: `src/tests/settings/language-switch.test.mjs` (single case, add export)
- Modify: `src/tests/settings/theme-switch.test.mjs` (single case, add export)
- Modify: `src/tests/wallet/create-mnemonic.test.mjs` (single case, add export)
- Modify: `src/tests/referral/bind-invite-code.test.mjs` (single case, add export)

**Step 1: Export testCases from perps/favorites.test.mjs**

The file already has `const tests = [...]` at line 669. Change to export:

```js
// Line 669: change `const tests` to `export const testCases`
export const testCases = [
  { id: 'PERPS-001', name: '添加代币到自选并验证顶部栏', fn: testPerps001 },
  { id: 'PERPS-002', name: '顶部栏切换交易对', fn: testPerps002 },
  { id: 'PERPS-003', name: '底部展示模式切换', fn: testPerps003 },
  { id: 'PERPS-004', name: '$/% 显示切换', fn: testPerps004 },
  { id: 'PERPS-005', name: '收藏同步验证', fn: testPerps005 },
];
```

Update `run()` to reference `testCases` instead of `tests`.

**Step 2: Export testCases from cosmos/transfer.test.mjs**

Add after TRANSFERS array (line 84):

```js
export const testCases = TRANSFERS.map(t => ({
  id: t.id,
  name: `${t.network} (${t.token}) transfer`,
}));
// Note: fn not exported here — cosmos cases use runTransfer(page, transfer) with data.
// The executor will import and call run() with a filter instead.
```

**Step 3: Export testCases from single-case files**

For each of these files, add near the top (after imports):

`language-switch.test.mjs`:
```js
export const testCases = [
  { id: 'LANG-SWITCH-001', name: 'Language Switch Verification' },
];
```

`theme-switch.test.mjs`:
```js
export const testCases = [
  { id: 'SETTINGS-001', name: 'Theme Switch Verification' },
];
```

`create-mnemonic.test.mjs`:
```js
export const testCases = [
  { id: 'WALLET-001', name: 'Create Mnemonic Wallet with KeyTag Backup' },
];
```

`bind-invite-code.test.mjs`:
```js
export const testCases = [
  { id: 'REFER-001', name: 'Bind Invite Code' },
];
```

**Step 4: Commit**

```bash
git add src/tests/
git commit -m "feat: export testCases from all test files for dashboard registry"
```

---

### Task 2: Create test registry module

**Files:**
- Create: `src/dashboard/test-registry.ts`

**Step 1: Write the registry**

```ts
// src/dashboard/test-registry.ts
// Scans test files and imports their testCases exports to build a registry.

import { readdirSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const TESTS_DIR = join(import.meta.dirname, '..', 'tests');

interface TestCase {
  id: string;
  name: string;
}

interface TestGroup {
  file: string;       // relative path from src/tests/
  group: string;      // display name derived from path
  platform: string;   // 'desktop' | 'android'
  cases: TestCase[];
}

function findTestFiles(dir: string, base: string = dir): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...findTestFiles(full, base));
    } else if (entry.endsWith('.test.mjs')) {
      results.push(full);
    }
  }
  return results;
}

export async function getTestRegistry(): Promise<TestGroup[]> {
  const files = findTestFiles(TESTS_DIR);
  const groups: TestGroup[] = [];

  for (const file of files) {
    try {
      const mod = await import(pathToFileURL(file).href);
      if (!mod.testCases || !Array.isArray(mod.testCases)) continue;

      const rel = relative(TESTS_DIR, file);
      const platform = rel.startsWith('android') ? 'android' : 'desktop';
      const group = rel
        .replace(/\.test\.mjs$/, '')
        .replace(/\//g, ' / ')
        .replace(/(^|\s)\w/g, c => c.toUpperCase());

      groups.push({
        file: rel,
        group,
        platform,
        cases: mod.testCases.map((c: any) => ({ id: c.id, name: c.name })),
      });
    } catch (e) {
      console.error(`[registry] Failed to load ${file}:`, (e as Error).message);
    }
  }

  return groups.sort((a, b) => a.file.localeCompare(b.file));
}
```

**Step 2: Verify it works**

```bash
npx tsx -e "import { getTestRegistry } from './src/dashboard/test-registry.ts'; getTestRegistry().then(r => console.log(JSON.stringify(r, null, 2)))"
```

Expected: JSON array with 6-7 groups, each with cases.

**Step 3: Commit**

```bash
git add src/dashboard/test-registry.ts
git commit -m "feat: add test registry that scans test files for dashboard"
```

---

### Task 3: Create test executor module

**Files:**
- Create: `src/dashboard/test-executor.ts`

**Step 1: Write the executor**

The executor runs in the server process. It imports test files dynamically, calls each case's `fn(page)`, and emits events via callbacks. Supports stop/resume.

```ts
// src/dashboard/test-executor.ts
import { connectCDP, sleep, dismissOverlays, unlockWalletIfNeeded } from '../tests/helpers/index.mjs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const TESTS_DIR = join(import.meta.dirname, '..', 'tests');
const RESULTS_DIR = join(import.meta.dirname, '..', '..', 'shared', 'results');

type EventType = 'queue' | 'start' | 'pass' | 'fail' | 'skip' | 'done' | 'stopped';

interface RunEvent {
  event: EventType;
  id?: string;
  name?: string;
  duration?: number;
  error?: string;
  passed?: number;
  failed?: number;
  skipped?: number;
  total?: number;
  timestamp: string;
}

type EventCallback = (event: RunEvent) => void;

interface QueueItem {
  id: string;
  name: string;
  file: string;    // relative path to test file
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
}

let queue: QueueItem[] = [];
let running = false;
let stopRequested = false;
let currentIndex = 0;
let listeners: EventCallback[] = [];

function emit(event: RunEvent) {
  for (const cb of listeners) cb(event);
}

export function onEvent(cb: EventCallback) {
  listeners.push(cb);
  return () => { listeners = listeners.filter(l => l !== cb); };
}

export function getState() {
  return {
    running,
    stopRequested,
    currentIndex,
    queue: queue.map(q => ({ ...q })),
  };
}

export async function startRun(caseIds: string[], registry: any[]) {
  if (running) throw new Error('Already running');

  // Build queue from registry
  queue = [];
  for (const id of caseIds) {
    for (const group of registry) {
      const c = group.cases.find((c: any) => c.id === id);
      if (c) {
        queue.push({ id: c.id, name: c.name, file: group.file, status: 'pending' });
        break;
      }
    }
  }

  // Emit queue event
  for (const item of queue) {
    emit({ event: 'queue', id: item.id, name: item.name, timestamp: new Date().toISOString() });
  }

  running = true;
  stopRequested = false;
  currentIndex = 0;
  executeQueue();
}

export function stopRun() {
  if (!running) return;
  stopRequested = true;
}

export async function resumeRun() {
  if (running) return;
  if (currentIndex >= queue.length) return;
  running = true;
  stopRequested = false;
  executeQueue();
}

export async function restartRun() {
  if (running) return;
  // Reset all to pending
  for (const item of queue) {
    item.status = 'pending';
    item.duration = undefined;
    item.error = undefined;
  }
  currentIndex = 0;
  running = true;
  stopRequested = false;

  for (const item of queue) {
    emit({ event: 'queue', id: item.id, name: item.name, timestamp: new Date().toISOString() });
  }
  executeQueue();
}

async function executeQueue() {
  let page: any = null;

  try {
    const cdp = await connectCDP();
    page = cdp.page;
    await unlockWalletIfNeeded(page);
  } catch (e) {
    emit({ event: 'fail', id: queue[currentIndex]?.id, error: 'CDP connection failed: ' + (e as Error).message, timestamp: new Date().toISOString() });
    running = false;
    emit({ event: 'done', ...getSummary(), timestamp: new Date().toISOString() });
    return;
  }

  // Group consecutive cases by file for setup optimization
  while (currentIndex < queue.length) {
    if (stopRequested) {
      running = false;
      emit({ event: 'stopped', timestamp: new Date().toISOString() });
      return;
    }

    const item = queue[currentIndex];
    item.status = 'running';
    emit({ event: 'start', id: item.id, name: item.name, timestamp: new Date().toISOString() });

    const startTime = Date.now();
    try {
      // Import test file and find the case function
      const filePath = join(TESTS_DIR, item.file);
      const mod = await import(pathToFileURL(filePath).href + '?t=' + Date.now());

      if (mod.testCases) {
        const tc = mod.testCases.find((c: any) => c.id === item.id);
        if (tc?.fn) {
          // Has individual fn — call it directly
          const result = await tc.fn(page);
          item.duration = Date.now() - startTime;
          if (result?.status === 'failed') {
            item.status = 'failed';
            item.error = result.error || 'Test returned failed status';
          } else {
            item.status = 'passed';
          }
        } else {
          // No fn (e.g. cosmos) — call run() with filter
          // For now mark as needing file-level execution
          const result = await mod.run([item.id]);
          item.duration = Date.now() - startTime;
          item.status = result?.status === 'passed' ? 'passed' : 'failed';
          if (result?.error) item.error = result.error;
        }
      } else if (mod.run) {
        const result = await mod.run();
        item.duration = Date.now() - startTime;
        item.status = result?.status === 'passed' ? 'passed' : 'failed';
        if (result?.error) item.error = result.error;
      }
    } catch (e) {
      item.duration = Date.now() - startTime;
      item.status = 'failed';
      item.error = (e as Error).message;
    }

    emit({
      event: item.status === 'passed' ? 'pass' : 'fail',
      id: item.id,
      duration: item.duration,
      error: item.error,
      timestamp: new Date().toISOString(),
    });

    try { await dismissOverlays(page); } catch {}
    await sleep(1000);

    currentIndex++;
  }

  running = false;
  emit({ event: 'done', ...getSummary(), timestamp: new Date().toISOString() });
}

function getSummary() {
  const passed = queue.filter(q => q.status === 'passed').length;
  const failed = queue.filter(q => q.status === 'failed').length;
  const skipped = queue.filter(q => q.status === 'pending' || q.status === 'skipped').length;
  return { passed, failed, skipped, total: queue.length };
}
```

**Step 2: Commit**

```bash
git add src/dashboard/test-executor.ts
git commit -m "feat: add test executor with stop/resume/restart support"
```

---

### Task 4: Update server with new API endpoints

**Files:**
- Modify: `src/dashboard/server.ts`

**Step 1: Add imports and new endpoints**

Add to existing server.ts:
- `GET /api/tests` — calls `getTestRegistry()`, returns JSON
- `POST /api/run` — reads body `{ cases: [...] }`, calls `startRun()`
- `POST /api/stop` — calls `stopRun()`
- `POST /api/resume` — calls `resumeRun()`
- `POST /api/restart` — calls `restartRun()`
- `GET /api/status` — returns `getState()` (poll fallback)
- `GET /api/events` — SSE stream, subscribes to `onEvent()`

**Step 2: Commit**

```bash
git add src/dashboard/server.ts
git commit -m "feat: add test execution API endpoints and SSE stream"
```

---

### Task 5: Build the new frontend

**Files:**
- Modify: `src/dashboard/index.html` (complete rewrite)

**Step 1: Replace index.html with test runner UI**

Layout:
- **Header**: title + connection status
- **Left panel**: test case tree (grouped by file), checkboxes, group select all
- **Right panel**: execution status list — each case shows status icon + name + duration + error
- **Top bar**: [Start] / [Stop] / [Resume] [Restart] buttons + progress bar
- **State management**: fetch /api/tests on load, SSE /api/events for real-time updates, button states follow state machine

Key behaviors:
- On load: GET /api/tests → render checkbox tree
- Click [Start]: POST /api/run with selected IDs → switch to running state, SSE for updates
- Each SSE event updates the corresponding row (pending → running → pass/fail)
- [Stop]: POST /api/stop → shows [Resume] [Restart] after stopped event
- [Resume]: POST /api/resume → back to running
- [Restart]: POST /api/restart → reset all rows, start over

Dark theme consistent with existing dashboard style (same CSS variables).

**Step 2: Commit**

```bash
git add src/dashboard/index.html
git commit -m "feat: replace dashboard with test runner control panel"
```

---

### Task 6: Adapt perps test cases for individual execution

**Files:**
- Modify: `src/tests/perps/favorites.test.mjs`

The perps test file needs its `run()` to handle the case where a CDP page is already connected (executor passes `page` in), and individual `fn(page)` calls need proper setup (navigate to perps page first).

**Step 1: Add setup/teardown to individual test functions**

Each `testPerps0XX(page)` already receives `page`. The `run()` function currently does setup (goToPerps, unlockWallet). For individual execution, either:
- The executor calls `run()` with a filter, or
- Each `fn` is wrapped with setup

Simplest: make `run()` accept an optional filter array and page parameter.

```js
export async function run(filter = null, existingPage = null) {
  const page = existingPage || (await connectCDP()).page;
  if (!existingPage) {
    await unlockWalletIfNeeded(page);
  }
  await goToPerps(page);
  await sleep(2000);

  const casesToRun = filter
    ? testCases.filter(t => filter.includes(t.id))
    : testCases;
  // ... rest of execution loop using casesToRun
}
```

**Step 2: Apply same pattern to other test files**

Each `run()` accepts optional `(filter, existingPage)` params.

**Step 3: Commit**

```bash
git add src/tests/
git commit -m "feat: support filtered and pre-connected execution in all test files"
```

---

### Task 7: Integration test and polish

**Step 1: Start dashboard**

```bash
npm run dashboard
```

Open http://localhost:5050, verify:
- Test case tree shows all 7 groups, 27 cases
- Checkboxes work (group select all, individual toggle)
- Select a few cases, click Start → execution begins
- Real-time status updates appear
- Click Stop → pauses after current case
- Click Resume → continues
- Click Restart → reruns from beginning

**Step 2: Fix any issues found**

**Step 3: Final commit**

```bash
git add .
git commit -m "feat: complete test runner dashboard with execution controls"
```
