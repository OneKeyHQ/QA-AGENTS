# Test Runner Dashboard Design

## Goal
Replace the existing dashboard with a test execution control panel. Users can multi-select test cases from a grouped list, execute them sequentially, and see real-time pass/fail status. Execution can be stopped, resumed, or restarted.

## Architecture

```
Browser (localhost:5050)          Server (dashboard/server.ts)          Runner (child process)
┌─────────────────────┐           ┌──────────────────────┐           ┌──────────────┐
│ Test case list       │  GET /api/tests  │ Scan test files       │           │              │
│ (grouped by file)    │◄────────►│ Return registry       │           │              │
│ ☑ multi-select       │           │                      │           │              │
│                     │  POST /api/run   │ Spawn child process   │──────────►│ node executor│
│ Control buttons      │           │                      │           │              │
│                     │  SSE /api/events │ Forward stdout events │◄──────────│ stdout JSON  │
│ Real-time status     │◄────────►│                      │           │              │
└─────────────────────┘           └──────────────────────┘           └──────────────┘
```

## Execution State Machine

```
[idle] ──start──► [running] ──all done──► [finished]
                      │                       │
                    stop                      │
                      ▼                       │
                  [paused]                    │
                   │    │                     │
                resume  restart               restart
                   │    │                     │
                   ▼    └─────────────────────┘
               [running]
```

### Button States

| State | Buttons | Notes |
|-------|---------|-------|
| idle (cases selected) | [Start] | Appears after selecting cases |
| running | [Stop] | Waits for current case to finish, then pauses |
| paused | [Resume] [Restart] | Resume = continue from where stopped; Restart = rerun all selected |
| finished | [Restart] | Rerun same selection |

## Components

### 1. Test Registry (`src/dashboard/test-registry.ts`)
- Scans `src/tests/**/*.test.mjs`
- Each test file exports `testCases` array: `[{ id, name, fn }]`
- Returns: `[{ file, group, cases: [{ id, name }] }]`

### 2. Test Executor (`src/dashboard/test-executor.ts`)
- Receives list of case IDs to run
- Dynamically imports test files, calls `fn(page)` sequentially
- Outputs JSON lines to stdout for each event
- Supports stop signal (finish current case, then pause)

### 3. Server API additions
- `GET /api/tests` — returns test registry
- `POST /api/run` — body: `{ cases: ["PERPS-001", ...] }`, starts execution
- `POST /api/stop` — graceful stop after current case
- `POST /api/resume` — continue from paused state
- `GET /api/events` — SSE stream for real-time status

### 4. Frontend UI (replaces `index.html`)
- Left panel: test case list grouped by file, group-level select all + case-level checkboxes
- Right panel: execution status — each case shows idle/running/pass/fail + duration + error
- Top bar: progress bar (X/N done, Y passed, Z failed) + control buttons
- Bottom: recent execution history summary

## Communication Protocol

Child process stdout JSON lines:
```json
{"event":"start","id":"PERPS-001","timestamp":"..."}
{"event":"pass","id":"PERPS-001","duration":18700,"timestamp":"..."}
{"event":"fail","id":"PERPS-003","duration":5100,"error":"settings not found","timestamp":"..."}
{"event":"done","passed":4,"failed":1,"total":5}
```

## Test File Changes

Each test file needs to export a `testCases` array:
```js
export const testCases = [
  { id: 'PERPS-001', name: '添加代币到自选并验证顶部栏', fn: testPerps001 },
  ...
];
```

The existing `run()` function stays for standalone execution (`node file.mjs`).

## Execution Details

- Sequential execution only (single CDP connection)
- Stop = graceful: current case finishes, remaining cases stay "pending"
- Resume = pick up from first pending case
- Restart = reset all to pending, run from beginning
- Results written to `shared/results/` as before
