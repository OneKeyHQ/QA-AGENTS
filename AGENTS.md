# AGENTS.md — OneKey Agent Test

## Project Context

Three-layer multi-agent UI automation testing system for OneKey wallet.
Supports **Desktop** (Electron), **Web** (app.onekeytest.com), **Extension** (Chrome plugin) platforms.
Connected via CDP (Chromium DevTools Protocol) using Playwright `connectOverCDP`.

| Platform | CDP Port | Target |
|----------|----------|--------|
| Desktop | 9222 | OneKey Electron app |
| Web | 9223 | Chrome → app.onekeytest.com |
| Extension | 9224 | Chrome + OneKey extension |
| Dashboard | 5050 | Test execution panel |
| Recorder (Desktop) | 3210 | Recording monitor UI |
| Recorder (Web) | 3211 | Web recording monitor UI |

## Agent Roles

| Agent | Responsibility |
|-------|---------------|
| **QA Director** | Test orchestration entry point. Precondition checks, skill loading, result summary, rollback decisions. |
| **Test Designer** | Converts PRD into recordings, then into intent-only test cases (`shared/test_cases.json`) and `.test.mjs` scripts. |
| **Knowledge Builder** | Sole writer of selectors, ui-map, precondition data. Runs three-phase memory pipeline (MemCells → MemScenes → Recall). |
| **QA Manager** | Failure diagnosis only. Classifies root causes, writes `shared/diagnosis.json`. Never modifies code or knowledge. |
| **Runner** | Executes tests via dashboard or CLI. Pure function `run_case(test_id, platform)`. State recovery + multi-strategy selectors. |
| **Recorder** | CDP-based interaction capture. Desktop: `listen.mjs` (port 3210), Web: `listen-web.mjs` (port 3211). Output requires user confirmation. |
| **Reporter** | Result aggregation, trend dashboards, quality reports to `shared/reports/`. |

## Workflows

### New Test
```
PRD → launch app with CDP → start recorder → user operates app
→ user says "done" → list all actions for confirmation
→ confirmed → generate test cases + update ui-map + write .test.mjs
```

### Regression
```
Check CDP responds → run test suite via dashboard or CLI → summarize results
```

### Failure Fix
```
Diagnose failure (QA Manager) → classify root cause → fix selectors (Knowledge Builder) → rerun (Runner)
```

## Critical Rules

### App Paths & CDP
- **OneKey Desktop**: `/Applications/OneKey-3.localized/OneKey.app/Contents/MacOS/OneKey --remote-debugging-port=9222`
- **Web**: Chrome auto-launched with `--remote-debugging-port=9223 --user-data-dir=/tmp/chrome-cdp-profile`
- **Extension**: Chrome auto-launched with `--remote-debugging-port=9224`, copies full Chrome data dir to preserve extension state
- Never use `open` command. Always invoke binaries directly.
- Never spawn duplicate instances. Check CDP before launching.
- Never call `page.setViewportSize()`.
- Never use MCP Playwright tools for OneKey — always `playwright-core` via Node.js.

### Test Execution
- Screenshots only on failure, not on every step.
- Test scripts must be continuous flow (no intermediate disconnects).
- Every test function signature: `fn(page)` — single parameter.
- Empty state (no tokens, but shows a message) is valid, not a failure.

### Modal/Popup Interaction
- Distinguish trigger elements from modal-internal elements. Never repeatedly click triggers.
- Input: use `locator.pressSequentially()`, NOT `nativeInputValueSetter` or `keyboard.type()`.
- Clear input: use `input.select()` + `Backspace`, NOT `Meta+a` (Electron shortcut conflict).
- Async results: poll 8-10 times × 500ms, not fixed `sleep()`.
- `APP-Modal-Screen` backdrop blocks outside clicks — close modal first or use `page.evaluate()`.

### Selectors & DOM
- Token name regex: `/^[A-Z][A-Z0-9]{1,9}$/`
- DOM selectors need position filtering when multiple matches exist.
- Selector strategy: data-testid primary → text/role fallback → JS evaluate (emergency only).

### Recording
- After recording, list all click/input actions with selectors for user confirmation.
- Never use unconfirmed recording results to generate test cases or update ui-map.

### Dashboard
- ESM `import()` caches modules. After modifying test scripts, restart Dashboard.

## Code Structure

```
src/
  tests/
    desktop/              # Desktop tests (CDP 9222)
      market/search.test.mjs
      perps/{favorites,token-search}.test.mjs
      settings/{lang,theme}.test.mjs
      transfer/cosmos.test.mjs
      wallet/create-mnemonic.test.mjs
      referral/bind-invite-code.test.mjs
    web/                  # Web tests (CDP 9223)
      market/{search,chart}.test.mjs
    extension/            # Extension tests (CDP 9224)
      market/search.test.mjs
    helpers/
      index.mjs           # CDP connection, screenshots, utils
      market-search.mjs   # Shared search logic (16 functions, 3-platform reuse)
      extension-cdp.mjs   # Extension CDP connection + auto-detect
      navigation.mjs      # Page navigation
      accounts.mjs        # Account/unlock helpers
      network.mjs         # Network operations
      transfer.mjs        # Transfer helpers
      preconditions.mjs   # Precondition framework
  dashboard/
    server.ts             # Dashboard server (port 5050)
    index.html            # UI with platform switcher (Desktop/Web/Extension)
    test-registry.ts      # Auto-discovers test files by platform
    test-executor.ts      # Executes tests, emits SSE events
  recorder/
    listen.mjs            # Desktop recorder (port 3210)
    listen-web.mjs        # Web recorder (port 3211, iframe support)
  runner/
    index.mjs             # Runner with state recovery
  knowledge/
    memory-pipeline.mjs   # Three-phase memory pipeline
shared/
  test_cases.json         # Intent-only test cases (writer: Test Designer)
  knowledge.json          # Curated patterns (writer: Knowledge Builder)
  ui-map.json             # Selector mappings (writer: Knowledge Builder)
  diagnosis.json          # Failure diagnosis (writer: QA Manager)
  results/{test-id}.json  # Execution results (writer: Runner)
  reports/*.md            # Quality reports (writer: Reporter)
```

## Test Module Contract

```js
export const testCases = [
  { id: 'XX-001', name: 'Test name', fn: async (page) => { /* test logic */ } }
];
export async function setup(page) { /* preconditions, navigation */ }
export async function run() { /* CLI entry: connect CDP, setup, iterate testCases */ }
```

## Test Case IDs

Format: `<FEATURE>-<NNN>` (e.g., `MARKET-SEARCH-001`, `COSMOS-003`)
- Web: `WEB-MARKET-SEARCH-001`
- Extension: `EXT-MARKET-SEARCH-001`

## Shared State Ownership

Each shared file has exactly one writer agent. Other agents read only.

| File | Exclusive Writer |
|------|-----------------|
| `shared/test_cases.json` | Test Designer |
| `shared/knowledge.json` | Knowledge Builder |
| `shared/ui-map.json` | Knowledge Builder |
| `shared/diagnosis.json` | QA Manager |
| `shared/results/*.json` | Runner |
| `shared/reports/*.md` | Reporter |
