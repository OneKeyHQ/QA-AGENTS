# OneKey Agent Architecture Redesign - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the multi-agent testing system with three-layer architecture (Decision/Intelligence/Execution), strict role boundaries, and a three-phase memory pipeline.

**Architecture:** Three-layer system — QA Director (throttle + rollback) dispatches to Intelligence Layer (Test Designer, QA Manager, Knowledge Builder with strict read/write boundaries), which feeds the Execution Layer (Runner as pure functional tool, Recorder for exploration). Knowledge Builder is the sole authority for knowledge persistence via a three-phase memory pipeline (MemCells → MemScenes → Intelligent Recall).

**Tech Stack:** Node.js ESM, Playwright-core (CDP), JSON shared state files, Claude Code Skills (SKILL.md)

**Reference:** Design doc at `docs/plans/2026-02-13-agent-architecture-redesign.md`

---

## Phase 1: Shared State Schema + Knowledge Builder Foundation

### Task 1: Define shared state JSON schemas

**Files:**
- Create: `src/schemas/mem-cell.schema.json`
- Create: `src/schemas/mem-scene.schema.json`
- Create: `src/schemas/ui-map.schema.json`
- Create: `src/schemas/test-case.schema.json`
- Create: `src/schemas/diagnosis.schema.json`
- Create: `src/schemas/patch.schema.json`
- Create: `src/schemas/profile.schema.json`

**Step 1: Create schema directory and mem-cell schema**

```bash
mkdir -p src/schemas
```

```json
// src/schemas/mem-cell.schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "timestamp", "platform", "yaml_id", "status"],
  "properties": {
    "id": { "type": "string", "pattern": "^mc-\\d+$" },
    "timestamp": { "type": "string", "format": "date-time" },
    "platform": { "enum": ["desktop", "web", "android", "ios", "extension"] },
    "yaml_id": { "type": "string" },
    "status": { "enum": ["passed", "failed", "skipped"] },
    "screenshot_hash": { "type": "string" },
    "error_type": { "enum": ["selector_stale", "timeout", "modal_overlay", "network_mismatch", "element_not_found", "assertion_failed", "state_drift", "unknown"] },
    "selector_used": { "type": "string" },
    "selector_success": { "type": "boolean" },
    "fallback_used": { "type": ["string", "null"] },
    "fallback_success": { "type": ["boolean", "null"] },
    "duration_ms": { "type": "number" },
    "step_index": { "type": "number" },
    "error_message": { "type": "string" }
  }
}
```

**Step 2: Create mem-scene schema**

```json
// src/schemas/mem-scene.schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "name", "cluster_size", "first_seen", "last_seen", "pattern"],
  "properties": {
    "id": { "type": "string", "pattern": "^ms-\\d+$" },
    "name": { "type": "string" },
    "cluster_size": { "type": "number" },
    "first_seen": { "type": "string", "format": "date-time" },
    "last_seen": { "type": "string", "format": "date-time" },
    "pattern": { "type": "string" },
    "resolution": { "type": ["string", "null"] },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "related_cells": { "type": "array", "items": { "type": "string" } }
  }
}
```

**Step 3: Create ui-map schema**

```json
// src/schemas/ui-map.schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["version", "lastUpdated", "elements"],
  "properties": {
    "version": { "type": "string" },
    "lastUpdated": { "type": "string", "format": "date-time" },
    "elements": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["primary", "page"],
        "properties": {
          "primary": { "type": "string", "description": "data-testid or CSS selector" },
          "fallbacks": { "type": "array", "items": { "type": "string" } },
          "page": { "type": "string", "description": "Page/screen name" },
          "platform": { "type": "array", "items": { "type": "string" } },
          "success_rate": { "type": "number" },
          "last_verified": { "type": "string", "format": "date-time" }
        }
      }
    }
  }
}
```

**Step 4: Create test-case, diagnosis, patch, profile schemas**

```json
// src/schemas/test-case.schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "intent", "preconditions", "steps", "expected"],
  "properties": {
    "id": { "type": "string", "pattern": "^[A-Z]+-\\d{3}$" },
    "intent": { "type": "string" },
    "preconditions": { "type": "array", "items": { "type": "string" } },
    "steps": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["order", "intent"],
        "properties": {
          "order": { "type": "number" },
          "intent": { "type": "string" }
        }
      }
    },
    "expected": { "type": "string" },
    "priority": { "enum": ["P0", "P1", "P2"] },
    "tags": { "type": "array", "items": { "type": "string" } }
  }
}
```

```json
// src/schemas/diagnosis.schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["test_id", "failure_type", "root_cause", "evidence", "repair_strategy", "confidence"],
  "properties": {
    "test_id": { "type": "string" },
    "failure_type": { "enum": ["selector_stale", "modal_overlay", "timing", "state_drift", "network_issue", "app_bug", "test_design", "unknown"] },
    "root_cause": { "type": "string" },
    "evidence": { "type": "array", "items": { "type": "string" } },
    "repair_strategy": { "type": "string" },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "impact": { "type": "string" }
  }
}
```

```json
// src/schemas/patch.schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "timestamp", "files", "diff_summary", "expected_impact", "status"],
  "properties": {
    "id": { "type": "string", "pattern": "^patch-\\d+$" },
    "timestamp": { "type": "string", "format": "date-time" },
    "files": { "type": "array", "items": { "type": "string" } },
    "diff_summary": { "type": "string" },
    "expected_impact": { "type": "string" },
    "status": { "enum": ["pending_approval", "approved", "applied", "rolled_back", "rejected"] },
    "previous_patch": { "type": ["string", "null"] }
  }
}
```

```json
// src/schemas/profile.schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["version", "lastUpdated", "platforms"],
  "properties": {
    "version": { "type": "string" },
    "lastUpdated": { "type": "string", "format": "date-time" },
    "platforms": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "total_runs": { "type": "number" },
          "pass_rate": { "type": "number" },
          "common_failures": { "type": "array", "items": { "type": "string" } },
          "reliable_selectors": { "type": "array", "items": { "type": "string" } },
          "unreliable_selectors": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  }
}
```

**Step 5: Commit**

```bash
git add src/schemas/
git commit -m "feat: add JSON schemas for all shared state files"
```

---

### Task 2: Initialize shared state files with new schema

**Files:**
- Create: `shared/mem_cells.json`
- Create: `shared/mem_scenes.json`
- Create: `shared/ui-map.json`
- Create: `shared/profile.json`
- Modify: `shared/knowledge.json` (migrate to new format)

**Step 1: Create empty state files**

```json
// shared/mem_cells.json
{ "version": "1.0.0", "cells": [] }
```

```json
// shared/mem_scenes.json
{ "version": "1.0.0", "scenes": [] }
```

```json
// shared/ui-map.json
{
  "version": "1.0.0",
  "lastUpdated": "2026-02-13T00:00:00Z",
  "elements": {
    "sidebarHome": {
      "primary": "[data-testid=\"home\"]",
      "fallbacks": [],
      "page": "global-sidebar",
      "platform": ["desktop"],
      "success_rate": 0.7,
      "last_verified": "2026-02-13T00:00:00Z"
    },
    "walletSelector": {
      "primary": "[data-testid=\"AccountSelectorTriggerBase\"]",
      "fallbacks": [],
      "page": "wallet-home",
      "platform": ["desktop"],
      "success_rate": 0.95,
      "last_verified": "2026-02-13T00:00:00Z"
    },
    "networkButton": {
      "primary": "[data-testid=\"account-network-trigger-button\"]",
      "fallbacks": [],
      "page": "wallet-home",
      "platform": ["desktop"],
      "success_rate": 0.95,
      "last_verified": "2026-02-13T00:00:00Z"
    },
    "networkButtonText": {
      "primary": "[data-testid=\"account-network-trigger-button-text\"]",
      "fallbacks": [],
      "page": "wallet-home",
      "platform": ["desktop"],
      "success_rate": 0.95,
      "last_verified": "2026-02-13T00:00:00Z"
    },
    "modal": {
      "primary": "[data-testid=\"APP-Modal-Screen\"]",
      "fallbacks": [],
      "page": "global-overlay",
      "platform": ["desktop"],
      "success_rate": 0.99,
      "last_verified": "2026-02-13T00:00:00Z"
    },
    "navBack": {
      "primary": "[data-testid=\"nav-header-back\"]",
      "fallbacks": [],
      "page": "global-nav",
      "platform": ["desktop"],
      "success_rate": 0.9,
      "last_verified": "2026-02-13T00:00:00Z"
    },
    "navClose": {
      "primary": "[data-testid=\"nav-header-close\"]",
      "fallbacks": [],
      "page": "global-nav",
      "platform": ["desktop"],
      "success_rate": 0.9,
      "last_verified": "2026-02-13T00:00:00Z"
    },
    "sendForm": {
      "primary": "[data-testid=\"send-recipient-amount-form\"]",
      "fallbacks": [],
      "page": "send-form",
      "platform": ["desktop"],
      "success_rate": 0.95,
      "last_verified": "2026-02-13T00:00:00Z"
    },
    "contactsIcon": {
      "primary": "[data-sentry-component=\"SvgPeopleCircle\"]",
      "fallbacks": [],
      "page": "send-form",
      "platform": ["desktop"],
      "success_rate": 0.8,
      "last_verified": "2026-02-13T00:00:00Z"
    },
    "walletTabHeader": {
      "primary": "[data-testid=\"Wallet-Tab-Header\"]",
      "fallbacks": [],
      "page": "wallet-home",
      "platform": ["desktop"],
      "success_rate": 0.95,
      "last_verified": "2026-02-13T00:00:00Z"
    },
    "chainSearchInput": {
      "primary": "[data-testid=\"nav-header-search-chain-selector\"]",
      "fallbacks": [],
      "page": "chain-selector",
      "platform": ["desktop"],
      "success_rate": 0.95,
      "last_verified": "2026-02-13T00:00:00Z"
    }
  }
}
```

```json
// shared/profile.json
{
  "version": "1.0.0",
  "lastUpdated": "2026-02-13T00:00:00Z",
  "platforms": {
    "desktop": {
      "total_runs": 0,
      "pass_rate": 0,
      "common_failures": [],
      "reliable_selectors": ["[data-testid=\"AccountSelectorTriggerBase\"]", "[data-testid=\"APP-Modal-Screen\"]"],
      "unreliable_selectors": ["[data-testid=\"home\"]"]
    }
  }
}
```

**Step 2: Migrate knowledge.json to curated patterns format**

```json
// shared/knowledge.json (replace existing)
{
  "version": "2.1.0",
  "lastUpdated": "2026-02-13T00:00:00Z",
  "patterns": [
    {
      "id": "K-001",
      "category": "locator",
      "platform": "desktop",
      "pattern": "data-testid selectors are most reliable on OneKey desktop",
      "details": "Prefer [data-testid=X] over text matching or CSS class selectors",
      "confidence": 0.95
    },
    {
      "id": "K-002",
      "category": "quirk",
      "platform": "desktop",
      "pattern": "Sidebar home click blocked by modal overlay",
      "details": "When APP-Modal-Screen is visible, [data-testid=home] click fails silently. Use page.evaluate() JS click to bypass.",
      "confidence": 0.92
    },
    {
      "id": "K-003",
      "category": "quirk",
      "platform": "desktop",
      "pattern": "Cosmos chains support memo field",
      "details": "Cosmos ecosystem chains (Osmosis, Cosmos, Akash, etc.) have a memo/tag input in send form. Placeholder contains 'Memo'.",
      "confidence": 0.9
    },
    {
      "id": "K-004",
      "category": "quirk",
      "platform": "desktop",
      "pattern": "page.mouse.click more reliable than page.evaluate click for recipient selection",
      "details": "Use page.evaluate to find element coordinates, then page.mouse.click(x,y) for actual click. JS .click() on container elements may not trigger React event handlers.",
      "confidence": 0.88
    },
    {
      "id": "K-005",
      "category": "quirk",
      "platform": "desktop",
      "pattern": "Modal scope required for element search",
      "details": "Always restrict element search to [data-testid=APP-Modal-Screen] when modal is open. Elements behind modal (wallet home) have matching text and are clickable but wrong.",
      "confidence": 0.95
    }
  ]
}
```

**Step 3: Commit**

```bash
git add shared/mem_cells.json shared/mem_scenes.json shared/ui-map.json shared/profile.json shared/knowledge.json
git commit -m "feat: initialize shared state files with new schema"
```

---

### Task 3: Create memory pipeline library

**Files:**
- Create: `src/knowledge/memory-pipeline.mjs`

This is the core of Knowledge Builder's three-phase memory system.

**Step 1: Write the memory pipeline**

```javascript
// src/knowledge/memory-pipeline.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SHARED_DIR = resolve(import.meta.dirname, '../../shared');
const read = (file) => JSON.parse(readFileSync(resolve(SHARED_DIR, file), 'utf-8'));
const write = (file, data) => writeFileSync(resolve(SHARED_DIR, file), JSON.stringify(data, null, 2));

// ────────────────────────────────────────────
// Phase 1: Event Slicing — TestResult → MemCell
// ────────────────────────────────────────────
let cellCounter = 0;

export function createMemCell(testResult, stepDetail = {}) {
  const cells = read('mem_cells.json');
  cellCounter = cells.cells.length;

  const cell = {
    id: `mc-${String(++cellCounter).padStart(4, '0')}`,
    timestamp: new Date().toISOString(),
    platform: stepDetail.platform || 'desktop',
    yaml_id: testResult.testId,
    status: testResult.status,
    screenshot_hash: stepDetail.screenshot_hash || null,
    error_type: classifyError(testResult.error),
    selector_used: stepDetail.selector_used || null,
    selector_success: stepDetail.selector_success ?? null,
    fallback_used: stepDetail.fallback_used || null,
    fallback_success: stepDetail.fallback_success ?? null,
    duration_ms: testResult.duration,
    step_index: stepDetail.step_index ?? null,
    error_message: testResult.error || null,
  };

  cells.cells.push(cell);
  write('mem_cells.json', cells);
  return cell;
}

function classifyError(errorMsg) {
  if (!errorMsg) return null;
  const msg = errorMsg.toLowerCase();
  if (msg.includes('timeout')) return 'timeout';
  if (msg.includes('modal') || msg.includes('overlay') || msg.includes('intercept')) return 'modal_overlay';
  if (msg.includes('not found') || msg.includes('no element')) return 'element_not_found';
  if (msg.includes('selector') || msg.includes('stale') || msg.includes('detach')) return 'selector_stale';
  if (msg.includes('network') || msg.includes('disconnect')) return 'network_mismatch';
  if (msg.includes('assert') || msg.includes('expect')) return 'assertion_failed';
  if (msg.includes('drift') || msg.includes('navigate')) return 'state_drift';
  return 'unknown';
}

// ────────────────────────────────────────────
// Phase 2: Semantic Clustering — MemCells → MemScenes
// ────────────────────────────────────────────
export function clusterMemScenes() {
  const cells = read('mem_cells.json').cells;
  const scenes = read('mem_scenes.json');

  // Group failed cells by (platform, error_type)
  const groups = {};
  for (const c of cells) {
    if (c.status !== 'failed' || !c.error_type) continue;
    const key = `${c.platform}::${c.error_type}`;
    (groups[key] ??= []).push(c);
  }

  let sceneCounter = scenes.scenes.length;

  for (const [key, groupCells] of Object.entries(groups)) {
    if (groupCells.length < 2) continue; // Need at least 2 occurrences to form a scene

    const [platform, errorType] = key.split('::');
    const existing = scenes.scenes.find(s => s.name.includes(errorType) && s.name.includes(platform));

    if (existing) {
      // Update existing scene
      existing.cluster_size = groupCells.length;
      existing.last_seen = groupCells.at(-1).timestamp;
      existing.related_cells = groupCells.map(c => c.id);
      existing.confidence = calcConfidence(groupCells);
      existing.resolution = detectResolution(groupCells);
    } else {
      // Create new scene
      scenes.scenes.push({
        id: `ms-${String(++sceneCounter).padStart(3, '0')}`,
        name: `${platform} ${errorType} cluster`,
        cluster_size: groupCells.length,
        first_seen: groupCells[0].timestamp,
        last_seen: groupCells.at(-1).timestamp,
        pattern: detectPattern(groupCells),
        resolution: detectResolution(groupCells),
        confidence: calcConfidence(groupCells),
        related_cells: groupCells.map(c => c.id),
      });
    }
  }

  write('mem_scenes.json', scenes);
  return scenes;
}

function calcConfidence(cells) {
  // More occurrences + consistent error → higher confidence
  const n = cells.length;
  return Math.min(0.99, 0.5 + n * 0.05);
}

function detectPattern(cells) {
  // Find the most common error message substring
  const msgCounts = {};
  for (const c of cells) {
    if (!c.error_message) continue;
    // Extract key phrase (first 60 chars)
    const key = c.error_message.substring(0, 60);
    msgCounts[key] = (msgCounts[key] || 0) + 1;
  }
  const sorted = Object.entries(msgCounts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || 'Unknown pattern';
}

function detectResolution(cells) {
  // Check if any cell in the group had a successful fallback
  for (const c of cells) {
    if (c.fallback_used && c.fallback_success) {
      return `Fallback works: ${c.fallback_used}`;
    }
  }
  return null;
}

// ────────────────────────────────────────────
// Phase 3: Intelligent Recall
// ────────────────────────────────────────────
export function recallForTest(testId) {
  const cells = read('mem_cells.json').cells;
  const scenes = read('mem_scenes.json').scenes;

  // Find cells related to this test
  const testCells = cells.filter(c => c.yaml_id === testId);
  if (testCells.length === 0) return { query: testId, relevant_scenes: [], reasoning: 'No history for this test.' };

  // Find the most recent failure
  const lastFailure = testCells.filter(c => c.status === 'failed').at(-1);
  if (!lastFailure) return { query: testId, relevant_scenes: [], reasoning: 'No failures recorded.' };

  // Match failure to scenes
  const matched = scenes.filter(s =>
    s.related_cells.some(id => testCells.some(c => c.id === id)) ||
    (lastFailure.error_type && s.name.includes(lastFailure.error_type))
  );

  return {
    query: `Why did ${testId} fail?`,
    relevant_scenes: matched.map(s => s.id),
    reasoning: matched.length > 0
      ? `Matches ${matched.length} scene(s): ${matched.map(s => `"${s.name}" (${s.cluster_size} occurrences, ${(s.confidence * 100).toFixed(0)}% confidence)`).join(', ')}. ${matched[0].resolution ? `Known resolution: ${matched[0].resolution}` : 'No resolution yet.'}`
      : `Error type "${lastFailure.error_type}" has no matching scene yet.`,
    suggested_fix: matched.find(s => s.resolution)?.resolution || null,
  };
}

// ────────────────────────────────────────────
// UI Map helpers
// ────────────────────────────────────────────
export function getSelector(elementName) {
  const uiMap = read('ui-map.json');
  const el = uiMap.elements[elementName];
  if (!el) return null;
  return { primary: el.primary, fallbacks: el.fallbacks || [] };
}

export function updateSelectorStats(elementName, success) {
  const uiMap = read('ui-map.json');
  const el = uiMap.elements[elementName];
  if (!el) return;

  // Rolling average: weight recent results more
  const prev = el.success_rate || 0.5;
  el.success_rate = prev * 0.8 + (success ? 1 : 0) * 0.2;
  el.last_verified = new Date().toISOString();
  uiMap.lastUpdated = new Date().toISOString();
  write('ui-map.json', uiMap);
}

// ────────────────────────────────────────────
// Profile helpers
// ────────────────────────────────────────────
export function updateProfile(platform, testResult) {
  const profile = read('profile.json');
  const p = profile.platforms[platform] ??= { total_runs: 0, pass_rate: 0, common_failures: [], reliable_selectors: [], unreliable_selectors: [] };

  p.total_runs++;
  p.pass_rate = ((p.pass_rate * (p.total_runs - 1)) + (testResult.status === 'passed' ? 1 : 0)) / p.total_runs;

  if (testResult.error) {
    const errType = classifyError(testResult.error);
    if (errType && !p.common_failures.includes(errType)) {
      p.common_failures.push(errType);
      if (p.common_failures.length > 10) p.common_failures.shift();
    }
  }

  profile.lastUpdated = new Date().toISOString();
  write('profile.json', profile);
}
```

**Step 2: Verify the module loads**

```bash
node -e "import('./src/knowledge/memory-pipeline.mjs').then(m => console.log('OK:', Object.keys(m)))"
```

Expected: `OK: [ 'createMemCell', 'clusterMemScenes', 'recallForTest', 'getSelector', 'updateSelectorStats', 'updateProfile' ]`

**Step 3: Commit**

```bash
git add src/knowledge/memory-pipeline.mjs
git commit -m "feat: implement three-phase memory pipeline (MemCell → MemScene → Recall)"
```

---

## Phase 2: Runner (Pure Functional Execution Tool)

### Task 4: Create Runner with unified `run_case` entry point

**Files:**
- Create: `src/runner/index.mjs`

**Step 1: Write the Runner**

```javascript
// src/runner/index.mjs
// Hard Constraint: Pure functional tool. No business logic. No decisions.
// Receives a test case + ui-map, executes it, returns TestResult.

import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { getSelector, updateSelectorStats, createMemCell, updateProfile } from '../knowledge/memory-pipeline.mjs';

const SHARED_DIR = resolve(import.meta.dirname, '../../shared');
const RESULTS_DIR = resolve(SHARED_DIR, 'results');
const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9222';
const MAX_STEP_RETRIES = 2;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ────────────────────────────────────────────
// Unified entry point
// ────────────────────────────────────────────
export async function run_case(test_id, platform = 'desktop') {
  mkdirSync(RESULTS_DIR, { recursive: true });

  const testCases = JSON.parse(readFileSync(resolve(SHARED_DIR, 'test_cases.json'), 'utf-8'));
  const testCase = (testCases.cases || testCases).find(tc => tc.id === test_id);
  if (!testCase) throw new Error(`Test case ${test_id} not found`);

  const browser = await chromium.connectOverCDP(CDP_URL);
  const page = browser.contexts()[0]?.pages()[0];
  if (!page) throw new Error('No page found via CDP');

  const startTime = Date.now();
  const stepResults = [];
  const screenshots = [];
  const stateRecoveries = [];

  try {
    for (const step of testCase.steps) {
      const stepResult = await executeStep(page, step, platform, stateRecoveries);
      stepResults.push(stepResult);

      // Screenshot after each step
      const ssPath = resolve(RESULTS_DIR, `${test_id}-step${step.order}.png`);
      await page.screenshot({ path: ssPath }).catch(() => {});
      screenshots.push(ssPath);

      if (!stepResult.success) {
        throw new Error(`Step ${step.order} failed: ${stepResult.error}`);
      }
    }

    const result = buildResult(test_id, 'passed', Date.now() - startTime, null, stepResults, screenshots, stateRecoveries);
    saveResult(test_id, result);
    createMemCell(result);
    updateProfile(platform, result);
    return result;

  } catch (error) {
    const errSS = resolve(RESULTS_DIR, `${test_id}-error.png`);
    await page.screenshot({ path: errSS }).catch(() => {});
    screenshots.push(errSS);

    const result = buildResult(test_id, 'failed', Date.now() - startTime, error.message, stepResults, screenshots, stateRecoveries);
    saveResult(test_id, result);
    createMemCell(result);
    updateProfile(platform, result);
    return result;

  } finally {
    await browser.close().catch(() => {});
  }
}

// ────────────────────────────────────────────
// Step execution with state recovery
// ────────────────────────────────────────────
async function executeStep(page, step, platform, recoveries) {
  for (let attempt = 0; attempt <= MAX_STEP_RETRIES; attempt++) {
    try {
      // Pre-step: state check
      const stateIssue = await detectStateIssue(page);
      if (stateIssue) {
        const recovery = await recoverState(page, stateIssue);
        recoveries.push({ step: step.order, issue: stateIssue, resolution: recovery });
      }

      // Execute the step intent (maps intent → concrete actions)
      await executeIntent(page, step.intent, platform);

      return { action: step.intent, success: true, attempt };

    } catch (error) {
      if (attempt === MAX_STEP_RETRIES) {
        return { action: step.intent, success: false, error: error.message, attempt };
      }
      // Wait before retry
      await sleep(1000);
    }
  }
}

// ────────────────────────────────────────────
// State detection and recovery
// ────────────────────────────────────────────
async function detectStateIssue(page) {
  // Check for modal overlay
  const hasModal = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    return modal && modal.getBoundingClientRect().width > 0;
  }).catch(() => false);

  if (hasModal) {
    // Check if this modal is expected (e.g., send form)
    const hasSendForm = await page.evaluate(() => {
      const form = document.querySelector('[data-testid="send-recipient-amount-form"]');
      return form && form.getBoundingClientRect().width > 0;
    }).catch(() => false);

    if (!hasSendForm) return 'unexpected_modal';
  }

  // Check for lock screen
  const isLocked = await page.evaluate(() =>
    document.body.textContent?.includes('欢迎回来')
  ).catch(() => false);
  if (isLocked) return 'wallet_locked';

  return null;
}

async function recoverState(page, issue) {
  switch (issue) {
    case 'unexpected_modal':
      // Close modals via JS
      await page.evaluate(() => {
        const close = document.querySelector('[data-testid="nav-header-close"]');
        if (close) { close.click(); return; }
        const back = document.querySelector('[data-testid="nav-header-back"]');
        if (back) { back.click(); return; }
      });
      await sleep(500);
      await page.keyboard.press('Escape');
      await sleep(500);
      return 'closed_modal';

    case 'wallet_locked':
      const password = process.env.WALLET_PASSWORD;
      if (!password) return 'no_password_configured';
      const input = page.locator('input[type="password"]').first();
      await input.fill(password);
      await input.press('Enter');
      await sleep(3000);
      return 'unlocked_wallet';

    default:
      return 'no_recovery';
  }
}

// ────────────────────────────────────────────
// Intent → Action mapping
// ────────────────────────────────────────────
async function executeIntent(page, intent, platform) {
  // This is where intent strings get mapped to Playwright actions.
  // The Runner reads ui-map.json for selectors.
  // Intent mapping is done via keyword matching — extensible by Knowledge Builder.

  const intentLower = intent.toLowerCase();

  if (intentLower.includes('click') || intentLower.includes('tap')) {
    const target = extractTarget(intent);
    await clickElement(page, target);
  } else if (intentLower.includes('fill') || intentLower.includes('type') || intentLower.includes('enter') || intentLower.includes('input')) {
    const { target, value } = extractFillParams(intent);
    await fillElement(page, target, value);
  } else if (intentLower.includes('wait')) {
    const ms = extractWaitTime(intent);
    await sleep(ms);
  } else if (intentLower.includes('assert') || intentLower.includes('verify') || intentLower.includes('check')) {
    const expected = extractAssertText(intent);
    await assertVisible(page, expected);
  } else if (intentLower.includes('navigate') || intentLower.includes('go to')) {
    await navigateToPage(page, intent);
  } else {
    // Fallback: treat as a text description, try AI vision if available
    throw new Error(`Unknown intent: "${intent}". Add mapping in Runner or use Knowledge Builder.`);
  }
}

// ────────────────────────────────────────────
// Action primitives
// ────────────────────────────────────────────
async function clickElement(page, target) {
  // Try 1: data-testid from ui-map
  const sel = getSelector(target);
  if (sel) {
    try {
      await page.locator(sel.primary).first().click({ timeout: 5000 });
      updateSelectorStats(target, true);
      return;
    } catch {
      updateSelectorStats(target, false);
    }
    // Try fallbacks
    for (const fb of sel.fallbacks) {
      try {
        await page.locator(fb).first().click({ timeout: 3000 });
        return;
      } catch { /* continue */ }
    }
  }

  // Try 2: JS evaluate (emergency)
  const clicked = await page.evaluate((t) => {
    const el = document.querySelector(`[data-testid="${t}"]`) ||
               document.querySelector(`[data-sentry-component="${t}"]`);
    if (el) { el.click(); return true; }
    // Text match
    const spans = document.querySelectorAll('span, button, a');
    for (const s of spans) {
      if (s.textContent?.trim() === t && s.getBoundingClientRect().width > 0) {
        s.click(); return true;
      }
    }
    return false;
  }, target);

  if (!clicked) throw new Error(`Element "${target}" not found by any strategy`);
}

async function fillElement(page, target, value) {
  const sel = getSelector(target);
  if (sel) {
    try {
      await page.locator(sel.primary).first().fill(value, { timeout: 5000 });
      return;
    } catch { /* fallback */ }
  }
  // Fallback: find input by placeholder
  const input = page.locator(`input[placeholder*="${target}"], textarea[placeholder*="${target}"]`).first();
  await input.fill(value, { timeout: 5000 });
}

async function assertVisible(page, text) {
  const visible = await page.evaluate((t) => {
    return document.body.textContent?.includes(t);
  }, text);
  if (!visible) throw new Error(`Expected text "${text}" not visible on page`);
}

async function navigateToPage(page, intent) {
  if (intent.includes('home') || intent.includes('wallet')) {
    await page.evaluate(() => {
      const home = document.querySelector('[data-testid="home"]');
      if (home) home.click();
    });
    await sleep(2000);
  }
}

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────
function extractTarget(intent) {
  // Extract target from intent like "Click send button" → "send"
  // or "Click [data-testid=home]" → "home"
  const testidMatch = intent.match(/\[data-testid[="]([^"\]]+)/);
  if (testidMatch) return testidMatch[1];
  const words = intent.replace(/^(click|tap)\s+/i, '').trim();
  return words;
}

function extractFillParams(intent) {
  const match = intent.match(/(?:fill|type|enter|input)\s+["']?(.+?)["']?\s+(?:with|into|=)\s+["']?(.+?)["']?$/i);
  if (match) return { target: match[1], value: match[2] };
  return { target: intent, value: '' };
}

function extractWaitTime(intent) {
  const match = intent.match(/(\d+)\s*(s|ms|sec)/i);
  if (match) return match[2].startsWith('m') ? Number(match[1]) : Number(match[1]) * 1000;
  return 2000;
}

function extractAssertText(intent) {
  return intent.replace(/^(assert|verify|check)\s+/i, '').trim();
}

function buildResult(test_id, status, duration, error, steps, screenshots, recoveries) {
  return {
    testId: test_id,
    status,
    duration,
    error,
    steps,
    screenshots,
    state_recoveries: recoveries,
    timestamp: new Date().toISOString(),
  };
}

function saveResult(test_id, result) {
  writeFileSync(resolve(RESULTS_DIR, `${test_id}.json`), JSON.stringify(result, null, 2));
}

// ────────────────────────────────────────────
// CLI entry
// ────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const [testId, platform] = process.argv.slice(2);
  if (!testId) { console.error('Usage: node src/runner/index.mjs <test_id> [platform]'); process.exit(1); }
  run_case(testId, platform || 'desktop')
    .then(r => { console.log(`${r.status}: ${r.testId} (${(r.duration / 1000).toFixed(1)}s)`); process.exit(r.status === 'passed' ? 0 : 1); })
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
```

**Step 2: Commit**

```bash
git add src/runner/index.mjs
git commit -m "feat: implement Runner with unified run_case entry, state recovery, and multi-strategy selectors"
```

---

## Phase 3: Rewrite Agent Skills

### Task 5: Rewrite onekey-knowledge-builder skill (NEW)

**Files:**
- Create: `~/.claude/skills/onekey-knowledge-builder/SKILL.md`
- Delete: `~/.claude/skills/onekey-yaml-orchestrator/SKILL.md` (merged into KB)
- Delete: `~/.claude/skills/onekey-bug-fixer/SKILL.md` (removed)

**Step 1: Write the Knowledge Builder skill**

```markdown
---
name: onekey-knowledge-builder
description: >
  Knowledge Builder - Agent memory self-organization, UI mapping, and knowledge curation.
  The SOLE role authorized to modify knowledge base files.
  Triggers on: /onekey-knowledge-builder, "update knowledge", "build ui-map", "memory pipeline",
  or when QA Director dispatches knowledge update tasks.
---

# Knowledge Builder Agent

## Identity
You are the **Knowledge Builder** — the sole authority for the OneKey test system's knowledge persistence. You own the three-phase memory pipeline and are the only role that writes to knowledge files.

## Responsibilities
- Agent memory self-organization (MemCell → MemScene → Recall)
- UI element selector mapping (from source code + runtime)
- Knowledge curation (patterns, best practices, quirks)
- Generate executable scripts from test case intents + ui-map selectors

## Can Read
- `shared/test_cases.json` (what to test — from Test Designer)
- `shared/results/*.json` (execution results — from Runner)
- App-monorepo source code (for data-testid extraction)
- Runtime logs, screenshots
- All shared state files

## Can Write (EXCLUSIVE — no other role may write these)
- `shared/knowledge.json` — Curated patterns
- `shared/ui-map.json` — UI selector mapping
- `shared/mem_cells.json` — Raw event log (Phase 1)
- `shared/mem_scenes.json` — Clustered knowledge (Phase 2)
- `shared/profile.json` — Agent capability profile

## NEVER Does
- Design test cases (Test Designer's job)
- Diagnose bugs (QA Manager's job)
- Make execution decisions (QA Director's job)

## Three-Phase Memory Pipeline

### Phase 1: Event Slicing
Every test result → MemCell. Use `createMemCell()` from `src/knowledge/memory-pipeline.mjs`.

### Phase 2: Semantic Clustering
Group similar MemCells → MemScene. Use `clusterMemScenes()` after batch runs.

### Phase 3: Intelligent Recall
When QA Manager queries, use `recallForTest(testId)` to return relevant scenes + reasoning.

## Workflow

1. **After test execution**: Read `shared/results/`, create MemCells, cluster into MemScenes
2. **After diagnosis**: Update `knowledge.json` with new patterns from QA Manager's diagnosis
3. **UI mapping**: Extract data-testid selectors from app source, update `ui-map.json`
4. **Script generation**: Read `test_cases.json` intents, match selectors from `ui-map.json`, generate runner-compatible scripts

## Output Format
All writes use JSON. Schema files at `src/schemas/`.
```

**Step 2: Remove merged/obsolete skills**

Remove `onekey-yaml-orchestrator` (merged into Knowledge Builder) and `onekey-bug-fixer` (removed — diagnosis by QA Manager, updates by Knowledge Builder, approval by user).

**Step 3: Commit**

```bash
git add ~/.claude/skills/onekey-knowledge-builder/SKILL.md
git rm ~/.claude/skills/onekey-yaml-orchestrator/SKILL.md
git rm ~/.claude/skills/onekey-bug-fixer/SKILL.md
git commit -m "feat: add Knowledge Builder skill, remove yaml-orchestrator and bug-fixer"
```

---

### Task 6: Rewrite onekey-test-designer skill

**Files:**
- Modify: `~/.claude/skills/onekey-test-designer/SKILL.md`

**Step 1: Rewrite to intent-only output**

Replace the entire SKILL.md content. Key changes:
- **Removed**: Selector generation, YAML output, multi-candidate strategies
- **Added**: Behavioral intent only, BDD scenario → structured steps

```markdown
---
name: onekey-test-designer
description: >
  Test Designer - BDD scenario design and test case structure.
  Outputs behavioral intent only (no selectors, no YAML).
  Triggers on: /onekey-test-designer, "design test", "create test cases",
  or when QA Director dispatches test design tasks.
---

# Test Designer Agent

## Identity
You are the **Test Designer** — responsible for BDD scenario design, test intent description, and test case structure.

## Responsibilities
- Read .feature files and requirements docs
- Design test cases as behavioral intents
- Define preconditions, steps (as intents), and expected outcomes
- Classify priorities (P0/P1/P2)

## Can Read
- `.feature` files in `scenarios/`
- Requirements documents
- `shared/knowledge.json` (read-only, for understanding domain quirks)

## Can Write
- `shared/test_cases.json` (case structure only, **no selectors**)

## NEVER Does
- Write CSS selectors or data-testid values
- Write YAML scripts
- Touch `shared/ui-map.json`
- Modify knowledge base files

## Output Format

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
  "expected": "Transaction submitted successfully",
  "priority": "P1",
  "tags": ["cosmos", "transfer", "akash"]
}
```

Each step `intent` is a human-readable behavioral description. The Knowledge Builder will map intents to selectors. The Runner will execute them.
```

**Step 2: Commit**

```bash
git add ~/.claude/skills/onekey-test-designer/SKILL.md
git commit -m "refactor: rewrite test-designer to intent-only output (no selectors)"
```

---

### Task 7: Rewrite onekey-qa-manager skill

**Files:**
- Modify: `~/.claude/skills/onekey-qa-manager/SKILL.md`

**Step 1: Rewrite to diagnosis-only**

Key changes:
- **Removed**: Write access to `shared/knowledge.json` (now Knowledge Builder exclusive)
- **Added**: Query Knowledge Builder for memory recall, structured diagnosis output

```markdown
---
name: onekey-qa-manager
description: >
  QA Manager - Failure analysis, root cause classification, repair strategy suggestions.
  Outputs diagnosis only (no code changes, no knowledge writes).
  Triggers on: /onekey-qa-manager, "diagnose failures", "analyze results",
  or when QA Director dispatches diagnosis tasks.
---

# QA Manager Agent

## Identity
You are the **QA Manager** — the sole diagnosis authority. You analyze failures, classify root causes, and suggest repair strategies.

## Responsibilities
- Read execution results and classify failures
- Query Knowledge Builder's memory (MemScenes) for related patterns
- Produce structured diagnosis reports
- Suggest repair strategies (but **never** execute them)

## Can Read
- `shared/results/*.json` (execution results from Runner)
- `shared/knowledge.json` (curated patterns, read-only)
- `shared/ui-map.json` (selector mapping, read-only)
- `shared/mem_scenes.json` (clustered knowledge, read-only)

## Can Write
- `shared/diagnosis.json` (diagnosis report only)

## NEVER Does
- Modify scripts, YAML, or test code
- Write to `shared/knowledge.json` or `shared/ui-map.json`
- Execute tests
- Make repair decisions (QA Director + user decide)

## Diagnosis Output Format

```json
{
  "test_id": "COSMOS-001",
  "failure_type": "selector_stale",
  "root_cause": "Modal overlay blocking sidebar click",
  "evidence": ["screenshot: COSMOS-001-error.png", "log: subtree intercepts pointer events"],
  "repair_strategy": "Use page.evaluate() JS click to bypass overlay",
  "confidence": 0.85,
  "impact": "Affects all tests after first failure (cascading)",
  "related_scenes": ["ms-001"],
  "memory_recall": "Matches 'modal overlay' cluster (15 occurrences, 92% confidence)"
}
```

## Workflow

1. Read all `shared/results/*.json` for the current run
2. For each failure, use `recallForTest(testId)` from memory pipeline
3. Classify failure type and root cause
4. Write diagnosis to `shared/diagnosis.json`
5. Report to QA Director — do NOT take action
```

**Step 2: Commit**

```bash
git add ~/.claude/skills/onekey-qa-manager/SKILL.md
git commit -m "refactor: rewrite qa-manager to diagnosis-only (no knowledge writes)"
```

---

### Task 8: Rewrite onekey-qa-director skill [DONE]

**Status**: Completed. QA Director already rewritten with progressive skill loading, serial execution order, throttle + rollback + approval gate.

**Files:**
- Modified: `~/.claude/skills/onekey-qa-director/SKILL.md`

**Key changes applied:**
- Progressive skill disclosure (LOAD_SKILL pattern, max 2 at a time)
- Serial fixed order for Intelligence Layer (Test Designer → Knowledge Builder → QA Manager)
- Throttle mechanism (max N=2 auto runs)
- Rollback with patch.json
- Approval gate for all modifications

```markdown
---
name: onekey-qa-director
description: >
  QA Director - Sole entry point for all test requests. Task dispatching,
  throttle control, rollback mechanism, approval gate, final reporting.
  Triggers on: /onekey-qa-director, /onekey-test, "run tests", "QA pipeline".
---

# QA Director Agent

## Identity
You are the **QA Director** — the sole entry point for all test requests. You coordinate all other agents, enforce quality gates, and ensure human oversight.

## Responsibilities
- **Sole entry point** for all test requests
- Task dispatching to Intelligence Layer (Test Designer, QA Manager, Knowledge Builder)
- Throttle mechanism (max N auto-runs per task)
- Rollback mechanism (patch.json before modifications)
- Approval gate (user confirms before any modification is applied)
- Final quality reporting

## Does NOT
- Write code or scripts
- Modify YAML files
- Operate UI directly
- Make knowledge base changes

## Throttle Mechanism

Each task triggers at most `N` auto-regression runs (default: 2).
- Run 1: Execute → if failed, dispatch to QA Manager for diagnosis
- Run 2: Apply approved fix → re-execute → if failed again, STOP
- After N failures: mark task as `needs-human-review`, output diagnosis report only

```
run_count = 0
MAX_RUNS = 2

while run_count < MAX_RUNS:
    result = dispatch Runner.run_case(test_id, platform)
    run_count++
    if result.passed: break
    diagnosis = dispatch QA Manager.diagnose(result)
    repair = dispatch Knowledge Builder.suggest_repair(diagnosis)
    present repair to user
    if user.approves(repair):
        dispatch Knowledge Builder.apply_repair(repair)
    else:
        mark needs-human-review
        break

if run_count >= MAX_RUNS and not passed:
    output final diagnosis report
    mark needs-human-review
```

## Rollback Mechanism

Before ANY modification (YAML, selector, knowledge), generate `shared/patch.json`:

```json
{
  "id": "patch-001",
  "timestamp": "2026-02-13T10:00:00Z",
  "files": ["shared/ui-map.json"],
  "diff_summary": "Changed sidebarHome fallback to use JS evaluate",
  "expected_impact": "Fix sidebar click blocked by modal overlay",
  "status": "pending_approval"
}
```

- `pending_approval` → present to user
- User approves → `approved` → Knowledge Builder applies
- New version causes more failures → auto-rollback to previous state
- User rejects → `rejected` → no change

## Dispatch Table

| Task | Dispatched To | Expected Output |
|------|---------------|----------------|
| Design test cases | Test Designer | `shared/test_cases.json` |
| Execute tests | Runner (`run_case`) | `shared/results/<id>.json` |
| Diagnose failures | QA Manager | `shared/diagnosis.json` |
| Update knowledge | Knowledge Builder | `shared/knowledge.json`, `shared/ui-map.json` |
| Generate report | Reporter | `shared/reports/` |

## Pipeline Flow

1. Receive user request
2. Throttle check (has this task exceeded max runs?)
3. Dispatch Test Designer if new cases needed
4. Dispatch Runner for execution
5. If failures: dispatch QA Manager for diagnosis
6. Present diagnosis + repair proposal to user
7. If approved: dispatch Knowledge Builder to apply
8. If re-run needed: go to step 4 (throttle check)
9. Final report via Reporter
```

**Step 2: Commit**

```bash
git add ~/.claude/skills/onekey-qa-director/SKILL.md
git commit -m "refactor: rewrite qa-director with throttle, rollback, and approval gate"
```

---

### Task 9: Rewrite onekey-executor → onekey-runner skill

**Files:**
- Delete: `~/.claude/skills/onekey-executor/SKILL.md`
- Create: `~/.claude/skills/onekey-runner/SKILL.md`

**Step 1: Write Runner skill**

```markdown
---
name: onekey-runner
description: >
  Runner - Pure functional test execution tool.
  Unified entry: run_case(test_id, platform).
  No business logic, no decisions.
  Triggers on: /onekey-runner, "execute test", "run case".
---

# Runner Agent

## Identity
You are the **Runner** — a pure functional execution tool. You execute test cases and return results. You make no business judgments.

## Hard Constraint
Pure functional tool. Does not decide what to test. Makes no business judgments. Only executes the case it receives and returns results/screenshots/state.

## Unified Entry Point

```
run_case(test_id, platform) → TestResult
```

## Implementation

Use `src/runner/index.mjs` which provides:
1. Load test case from `shared/test_cases.json`
2. Load selectors from `shared/ui-map.json`
3. Select engine (Playwright primary → JS evaluate fallback)
4. State recovery per step (modal detection, lock screen, page drift)
5. Output TestResult to `shared/results/<test_id>.json`

## Execution

```bash
node src/runner/index.mjs <test_id> [platform]
```

## Can Read
- `shared/test_cases.json`
- `shared/ui-map.json`

## Can Write
- `shared/results/<test_id>.json`
- `shared/results/<test_id>-*.png` (screenshots)

## NEVER Does
- Design tests
- Diagnose failures
- Modify knowledge or selectors
- Make retry/abort decisions (QA Director decides)
```

**Step 2: Commit**

```bash
git add ~/.claude/skills/onekey-runner/SKILL.md
git rm ~/.claude/skills/onekey-executor/SKILL.md
git commit -m "refactor: replace executor with runner (pure functional, unified entry)"
```

---

### Task 10: Update onekey-reporter skill

**Files:**
- Modify: `~/.claude/skills/onekey-reporter/SKILL.md`

**Step 1: Update to work with new data flow**

Minor update: add references to new shared state files (mem_scenes.json, profile.json, diagnosis.json).

**Step 2: Commit**

```bash
git add ~/.claude/skills/onekey-reporter/SKILL.md
git commit -m "refactor: update reporter to reference new shared state files"
```

---

## Phase 4: Recorder Tool

### Task 11: Create onekey-recorder skill

**Files:**
- Create: `~/.claude/skills/onekey-recorder/SKILL.md`
- Create: `src/recorder/index.mjs`

**Step 1: Write Recorder skill**

```markdown
---
name: onekey-recorder
description: >
  Recorder - Exploration tool for mapping new flows and generating draft scripts.
  NOT for production regression. Wraps Playwright codegen + CDP.
  Triggers on: /onekey-recorder, "record flow", "explore UI", "map new page".
---

# Recorder Agent

## Identity
You are the **Recorder** — an exploration tool for mapping new UI flows. You capture user interactions and generate draft Playwright scripts.

## Purpose
Exploration ONLY. Not production regression.

## When to Use
- Exploring new flows in the OneKey app
- Mapping new pages for ui-map.json
- Building initial scripts for unfamiliar features
- Discovering data-testid values in new screens

## Workflow
1. Connect to OneKey via CDP (`http://127.0.0.1:9222`)
2. User manually operates the app
3. Capture real-time page state (DOM snapshot, data-testid values, visible text)
4. Output findings for Knowledge Builder to process

## Can Read
- Live DOM via CDP connection
- `shared/ui-map.json` (to identify unknown elements)

## Can Write
- `shared/recordings/<timestamp>.json` (raw recording data)

## NEVER Does
- Run in production regression
- Make automated decisions
- Write to shared knowledge files (Knowledge Builder's job)
- Execute test cases

## Usage

```bash
node src/recorder/index.mjs
```

Connects via CDP and captures a DOM snapshot with all data-testid elements, visible text, and interactive elements. Outputs to `shared/recordings/`.
```

**Step 2: Write Recorder script**

```javascript
// src/recorder/index.mjs
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9222';
const OUTPUT_DIR = resolve(import.meta.dirname, '../../shared/recordings');

async function captureSnapshot() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.connectOverCDP(CDP_URL);
  const page = browser.contexts()[0]?.pages()[0];
  if (!page) throw new Error('No page found');

  const snapshot = await page.evaluate(() => {
    const result = { testids: [], texts: [], inputs: [], buttons: [], svgs: [] };

    // Capture all data-testid elements
    document.querySelectorAll('[data-testid]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0) {
        result.testids.push({
          testid: el.getAttribute('data-testid'),
          tag: el.tagName,
          text: el.textContent?.trim().substring(0, 80),
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        });
      }
    });

    // Capture visible text spans
    document.querySelectorAll('span').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && el.textContent?.trim()) {
        result.texts.push({
          text: el.textContent.trim().substring(0, 60),
          rect: { x: Math.round(r.x), y: Math.round(r.y) },
        });
      }
    });

    // Capture inputs
    document.querySelectorAll('input, textarea').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0) {
        result.inputs.push({
          type: el.type || 'text',
          placeholder: el.placeholder,
          testid: el.getAttribute('data-testid'),
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) },
        });
      }
    });

    // Capture buttons
    document.querySelectorAll('button, [role="button"]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0) {
        result.buttons.push({
          text: el.textContent?.trim().substring(0, 40),
          testid: el.getAttribute('data-testid'),
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        });
      }
    });

    return result;
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const ssPath = resolve(OUTPUT_DIR, `${timestamp}.png`);
  await page.screenshot({ path: ssPath });
  snapshot.screenshot = ssPath;
  snapshot.timestamp = new Date().toISOString();
  snapshot.url = page.url();
  snapshot.title = await page.title();

  const outPath = resolve(OUTPUT_DIR, `${timestamp}.json`);
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  console.log(`Snapshot saved: ${outPath}`);
  console.log(`Screenshot: ${ssPath}`);
  console.log(`Found: ${snapshot.testids.length} data-testid, ${snapshot.texts.length} text spans, ${snapshot.inputs.length} inputs, ${snapshot.buttons.length} buttons`);

  await browser.close();
}

captureSnapshot().catch(e => { console.error('Fatal:', e); process.exit(1); });
```

**Step 3: Commit**

```bash
git add ~/.claude/skills/onekey-recorder/SKILL.md src/recorder/index.mjs
git commit -m "feat: add Recorder tool for UI exploration and DOM snapshot capture"
```

---

## Phase 5: Update Project Configuration

### Task 12: Update CLAUDE.md project instructions

**Files:**
- Modify: `/Users/chole/onekey-agent-test/.claude/CLAUDE.md`

**Step 1: Rewrite to reflect new architecture**

Replace the entire file to match the three-layer architecture with updated agent roles, shared state files, and conventions.

Key sections:
- Three-layer architecture overview
- Updated agent skills list (Knowledge Builder, Runner, Recorder)
- Updated shared state files (mem_cells, mem_scenes, ui-map, profile, diagnosis, patch)
- Role boundaries table
- Test case ID conventions
- File path conventions

**Step 2: Commit**

```bash
git add .claude/CLAUDE.md
git commit -m "docs: update project instructions for three-layer architecture"
```

---

### Task 13: Clean up obsolete files

**Files:**
- Review: `scripts/debug-*.mjs` (keep as reference or archive)
- Review: `scripts/run-cosmos-tests.mjs` (superseded by Runner)
- Review: `src/converters/` (some may be obsolete)

**Step 1: Archive debug scripts**

Move debug scripts to `scripts/archive/` — they contain valuable domain knowledge about OneKey UI behavior.

```bash
mkdir -p scripts/archive
mv scripts/debug-*.mjs scripts/archive/
mv scripts/run-cosmos-tests.mjs scripts/archive/
```

**Step 2: Commit**

```bash
git add scripts/
git commit -m "chore: archive debug scripts (preserved as domain knowledge reference)"
```

---

## Implementation Order Summary

| Phase | Tasks | Dependencies |
|-------|-------|-------------|
| **Phase 1** | Tasks 1-3 (schemas, state files, memory pipeline) | None |
| **Phase 2** | Task 4 (Runner) | Phase 1 (needs memory pipeline) |
| **Phase 3** | Tasks 5-10 (skill rewrites) | Phase 1-2 (skills reference new files) |
| **Phase 4** | Task 11 (Recorder) | Phase 1 (needs ui-map) |
| **Phase 5** | Tasks 12-13 (config, cleanup) | Phase 3 (needs final skill names) |

## Verification Checklist

After all tasks complete:
- [ ] `node src/knowledge/memory-pipeline.mjs` loads without errors
- [ ] `node src/runner/index.mjs --help` shows usage
- [ ] `node src/recorder/index.mjs` captures DOM snapshot (requires CDP)
- [ ] All 7 skill files follow strict boundary rules
- [ ] `shared/` contains all required JSON files with valid schema
- [ ] No skill writes outside its permitted files
- [ ] QA Director throttle stops after 2 failures
- [ ] Patch.json generated before any knowledge modification

---

## Current Status

- [x] Phase 0: QA Director skill rewrite (done - progressive skill loading + serial order + throttle/rollback)
- [x] Phase 1: Schemas + state files + memory pipeline (7 schemas, 5 state files, memory-pipeline.mjs smoke tested)
- [x] Phase 2: Runner (pure functional `run_case`, state recovery, multi-strategy selectors)
- [x] Phase 3: Intelligence layer skills (Test Designer intent-only, Knowledge Builder new, QA Manager diagnosis-only)
- [x] Phase 4: Recorder tool + Execution layer skills (Runner/Recorder/Reporter skills)
- [x] Phase 5: Project config + cleanup (CLAUDE.md updated, obsolete skills deleted, debug scripts archived)
- **Decision maker**: QA Director
- **Intelligence layer order**: Test Designer → Knowledge Builder → QA Manager (serial, fixed)
- **Deleted skills**: onekey-yaml-orchestrator, onekey-bug-fixer, onekey-executor
- **Archived scripts**: debug-*.mjs → scripts/archive/
