# OneKey Agent Architecture Redesign - Design Document

**Date**: 2026-02-13
**Status**: Approved
**Author**: Claude + User collaborative design

---

## 1. Problem Statement

Current agent architecture has 4 core issues:

1. **Fragility** — No domain model, relies on coordinate clicks and text matching
2. **Cascading failures** — One modal left open kills all subsequent tests
3. **No domain knowledge** — Agents don't understand wallet/network/account relationships
4. **Low debugging efficiency** — Patch-run-crash-patch cycle

## 2. Design Goals

- Regression tests run **fully automated**, with human intervention at key checkpoints
- Bug fixes only produce **diagnosis + repair proposal**, user decides whether to execute
- **Hybrid execution**: Playwright selectors as primary, AI vision as fallback + explorer
- **Recording tool** for script generation (exploration only, not production)
- Domain knowledge built from **source code extraction + runtime accumulation**

## 3. Three-Layer Architecture

```
+--------------------------------------------------+
|                   Decision Layer                  |
|  QA Director (sole entry point)                   |
|  - Throttle: max N auto-runs per task (default 2) |
|  - Rollback: patch.json before any modification   |
|  - Approval: bug fixes require user confirmation  |
|  - Reporting: final quality report output         |
+--------------------------------------------------+
|                   Intelligence Layer              |
|  Test Designer | QA Manager | Knowledge Builder   |
|  (strict boundaries, read/write permissions)      |
+--------------------------------------------------+
|                   Execution Layer                 |
|  Runner (unified entry: run_case)                 |
|  Recorder (exploration only, not production)      |
|  Pure functional tools, no business logic         |
+--------------------------------------------------+
```

## 4. Decision Layer: QA Director

### Responsibilities
- **Sole entry point** for all test requests
- Task dispatching to Intelligence Layer
- Approval gate for all modifications
- Final quality reporting

### Throttle Mechanism
- Each task triggers at most `N` auto-regression runs (default: 2)
- After N failures, mark task as `needs-human-review`
- Only output diagnosis report, stop auto-running

### Rollback Mechanism
- Before any YAML/code modification, generate `patch.json`:
  ```json
  {
    "id": "patch-001",
    "timestamp": "2026-02-13T10:00:00Z",
    "files": ["yamls/desktop-COSMOS-001.yaml"],
    "diff_summary": "Changed selector from text=xxx to data-testid=xxx",
    "expected_impact": "Fix COSMOS-001 recipient selection failure",
    "status": "pending_approval"
  }
  ```
- User approves → apply patch
- New version causes more failures → auto-rollback to previous patch

### Does NOT
- Write code
- Modify scripts
- Operate UI

## 5. Intelligence Layer: 3 Roles with Strict Boundaries

### 5.1 Test Designer

| Aspect | Detail |
|--------|--------|
| **Responsibility** | BDD scenario design, test intent description, test case structure |
| **Can Read** | .feature files, requirements docs, knowledge.json (read-only) |
| **Can Write** | test_cases.json (case structure only, no selectors) |
| **Never Does** | Write selectors, write YAML, touch ui-map.json |

**Output format**: Test cases with behavioral intent only:
```json
{
  "id": "COSMOS-001",
  "intent": "Transfer AKT on Akash network from Account 1 to Account 2",
  "preconditions": ["Wallet unlocked", "On Akash network"],
  "steps": [
    {"order": 1, "intent": "Open send form for AKT token"},
    {"order": 2, "intent": "Select Account 2 as recipient"},
    {"order": 3, "intent": "Enter max amount"},
    {"order": 4, "intent": "Submit and confirm transaction"}
  ],
  "expected": "Transaction submitted successfully"
}
```

### 5.2 QA Manager

| Aspect | Detail |
|--------|--------|
| **Responsibility** | Failure analysis, root cause classification, repair strategy suggestions |
| **Can Read** | results/, knowledge.json, ui-map.json, mem_scenes.json |
| **Can Write** | diagnosis.json (diagnosis report only) |
| **Never Does** | Modify scripts, modify YAML, modify knowledge |

**Output format**: Diagnosis report:
```json
{
  "test_id": "COSMOS-001",
  "failure_type": "selector_stale",
  "root_cause": "Modal overlay blocking sidebar click, closeAllModals() insufficient",
  "evidence": ["screenshot: COSMOS-001-error.png", "log: subtree intercepts pointer events"],
  "repair_strategy": "Use page.evaluate() JS click to bypass overlay for goToWalletHome()",
  "confidence": 0.85,
  "impact": "Affects all tests after first failure (cascading)"
}
```

### 5.3 Knowledge Builder (Upgraded Memory System)

| Aspect | Detail |
|--------|--------|
| **Responsibility** | Agent memory self-organization, UI mapping, knowledge curation |
| **Can Read** | app-monorepo source, runtime logs, all shared state |
| **Can Write** | knowledge.json, ui-map.json, mem_cells.json, mem_scenes.json, profile.json |
| **Special Authority** | **Sole role** authorized to modify knowledge base |
| **Never Does** | Design test cases, diagnose bugs |

**Three-Phase Memory Pipeline:**

#### Phase 1: Event Slicing
Every test result → MemCell:
```json
{
  "id": "mc-001",
  "timestamp": "2026-02-13T10:30:00Z",
  "platform": "desktop",
  "yaml_id": "COSMOS-001",
  "status": "failed",
  "screenshot_hash": "abc123",
  "error_type": "selector_stale",
  "selector_used": "[data-testid='home']",
  "selector_success": false,
  "fallback_used": "page.evaluate",
  "fallback_success": true,
  "duration_ms": 5000
}
```

#### Phase 2: Semantic Clustering
Similar MemCells → MemScene:
```json
{
  "id": "ms-001",
  "name": "Modal overlay blocking sidebar navigation",
  "cluster_size": 15,
  "first_seen": "2026-02-13T10:30:00Z",
  "last_seen": "2026-02-13T12:00:00Z",
  "pattern": "closeAllModals() fails when contacts/account modal is open",
  "resolution": "Use JS evaluate click instead of Playwright locator",
  "confidence": 0.92,
  "related_cells": ["mc-001", "mc-005", "mc-008"]
}
```

#### Phase 3: Intelligent Recall
When QA Manager queries, return relevant MemScene + reasoning chain:
```json
{
  "query": "Why did COSMOS-002 fail at goToWalletHome?",
  "relevant_scenes": ["ms-001"],
  "reasoning": "This matches the 'modal overlay' cluster (15 occurrences, 92% confidence). Previous resolution: JS evaluate click. Recommended action: apply same pattern.",
  "suggested_fix": "Replace page.locator(S.sidebarHome).click() with page.evaluate() JS click"
}
```

#### Knowledge Builder Output Files:
- `mem_cells.json` — Raw events (append-only log)
- `mem_scenes.json` — Clustered knowledge (semantic groups)
- `ui-map.json` — UI element selector mapping (from source code + runtime)
- `knowledge.json` — Curated patterns (locators, best practices, quirks)
- `profile.json` — Agent capability profile (what works, what doesn't, per platform)

## 6. Execution Layer: Runner + Recorder

### 6.1 Runner

**Hard Constraint**: Pure functional tool. Does not decide what to test, makes no business judgments. Only executes the case it receives and returns results/screenshots/state to Intelligence and Decision layers.

**Unified Entry Point**:
```javascript
async function run_case(test_id, platform) → TestResult
```

Internal implementation selection (transparent to caller):
```
run_case(test_id, platform)
  │
  ├── Load test case from test_cases.json
  ├── Load selectors from ui-map.json
  ├── Select engine:
  │   ├── Primary: Playwright (data-testid + CSS selectors)
  │   ├── Fallback: AI Vision (Midscene / Qwen VL)
  │   └── Emergency: page.evaluate() JS execution
  │
  ├── State Recovery (per-step):
  │   ├── Pre-step: screenshot + state check
  │   ├── Detect modal overlay → auto-close (JS evaluate)
  │   ├── Detect page drift → navigate back to target state
  │   ├── Detect unexpected popup → screenshot + close + flag
  │   └── Max retries per step: 2
  │
  └── Output: TestResult {
        test_id, status, duration,
        steps: [{ action, selector, screenshot, success, error }],
        screenshots: [path],
        state_recoveries: [{ step, issue, resolution }]
      }
```

### 6.2 Recorder

**Purpose**: Exploration only, not production regression.

**When to use**: Exploring new flows, mapping new pages, building initial scripts for unfamiliar features.

**Workflow**:
```
1. Start recording (wraps playwright codegen + CDP connection)
2. User manually operates OneKey desktop app
3. Real-time capture → raw Playwright script
4. Smart optimization:
   ├── Coordinate clicks → data-testid selectors (via ui-map.json)
   ├── Text matching → stable selectors
   └── Add wait conditions and assertions
5. Output: draft .mjs script
6. Handoff to Knowledge Builder for selector extraction and storage
```

**Does NOT**: Run in production, make automated decisions, write to shared state.

## 7. Data Flow

```
User Request
    │
    v
QA Director (throttle check, task assignment)
    │
    ├──> Test Designer → test_cases.json (intent only, no selectors)
    │
    ├──> Knowledge Builder:
    │    ├── Reads test_cases.json (what to test)
    │    ├── Matches selectors from ui-map.json
    │    ├── Generates executable script (YAML or JS)
    │    └── Outputs to yamls/ or scripts/
    │
    ├──> Runner.run_case(test_id, platform)
    │    ├── Reads executable script
    │    ├── Reads ui-map.json for selectors
    │    ├── Executes with state recovery
    │    └── Writes results/ + screenshots/
    │
    ├──> Knowledge Builder:
    │    ├── Reads execution results
    │    ├── Phase 1: Create MemCells
    │    ├── Phase 2: Cluster into MemScenes
    │    └── Updates knowledge.json, ui-map.json
    │
    ├──> QA Manager:
    │    ├── Reads results + knowledge
    │    ├── Queries Knowledge Builder for related patterns
    │    └── Writes diagnosis.json (repair strategy)
    │
    └──> QA Director:
         ├── Presents diagnosis to user
         ├── User approves → Knowledge Builder updates → Runner re-runs
         ├── User rejects → mark needs-human-review
         └── Throttle exceeded → stop, output report only
```

## 8. Shared State Files

| File | Owner (Write) | Readers | Purpose |
|------|---------------|---------|---------|
| test_cases.json | Test Designer | KB, Runner | Test case intent |
| ui-map.json | Knowledge Builder | Runner, QA Manager | UI selector mapping |
| knowledge.json | Knowledge Builder | QA Manager, Test Designer | Curated patterns |
| mem_cells.json | Knowledge Builder | QA Manager | Raw event log |
| mem_scenes.json | Knowledge Builder | QA Manager | Clustered knowledge |
| profile.json | Knowledge Builder | QA Director | Agent capability profile |
| diagnosis.json | QA Manager | QA Director, User | Failure analysis |
| patch.json | QA Director | Runner, KB | Modification proposals |
| results/*.json | Runner | QA Manager, KB, Director | Execution results |

## 9. Agent Skill Updates Required

### Skills to Rewrite:
1. **onekey-qa-director** — Add throttle, rollback, approval gate
2. **onekey-test-designer** — Remove selector/YAML generation, focus on intent
3. **onekey-qa-manager** — Remove code modification, focus on diagnosis
4. **onekey-yaml-orchestrator** — Merge into Knowledge Builder (it generates scripts now)
5. **onekey-executor** — Replace with Runner (pure functional tool)
6. **onekey-bug-fixer** — Remove (functionality split between QA Manager diagnosis and Knowledge Builder updates)

### New Skills:
7. **onekey-knowledge-builder** — Memory pipeline, UI mapping, knowledge curation
8. **onekey-recorder** — Playwright codegen wrapper for exploration
9. **onekey-reporter** — Quality dashboard and trend analysis (from existing skill)

## 10. Implementation Priority

1. **Phase 1**: Knowledge Builder + ui-map.json (foundation for everything else)
2. **Phase 2**: Runner with state recovery (reliable execution)
3. **Phase 3**: Rewrite agent skills with strict boundaries
4. **Phase 4**: Recorder tool
5. **Phase 5**: QA Director throttle/rollback mechanism
