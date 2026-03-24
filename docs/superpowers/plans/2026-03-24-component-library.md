# Component Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared UIRegistry + component functions + Page Objects library that eliminates duplicated element locator logic across all test files.

**Architecture:** UIRegistry singleton loads `shared/ui-map.json` with chokidar hot-reload, provides three-tier element resolution (primary → fallbacks → deep_search) with context awareness (page vs modal). Global component functions wrap common interactions (search, modal, sidebar). Lightweight Page Objects wrap page-specific operations.

**Tech Stack:** playwright-core, chokidar, Node.js ESM

**Spec:** `docs/superpowers/specs/2026-03-24-component-library-design.md`

---

## File Structure

```
src/tests/helpers/
├── constants.mjs           # NEW — sleep, WALLET_PASSWORD, ONEKEY_BIN, CDP_URL (breaks circular imports)
├── ui-registry.mjs         # NEW — UIRegistry class (singleton, lazy init)
├── components.mjs           # NEW — Global component functions (imports from constants.mjs)
├── pages/
│   ├── index.mjs            # NEW — Re-export all Page Objects
│   ├── market.mjs           # NEW — MarketPage
│   ├── perps.mjs            # NEW — PerpsPage
│   └── wallet.mjs           # NEW — WalletPage
├── index.mjs                # MODIFY — Re-export (NO top-level await)
├── navigation.mjs           # MODIFY — Delegate to components
├── market-search.mjs        # MODIFY — Delegate to components
└── market-chart.mjs         # MODIFY — Remove duplicate stepTracker
```

---

### Task 1: Install chokidar dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install chokidar**

```bash
cd /Users/chole/workspace/QA-AGENTS && npm install chokidar
```

- [ ] **Step 2: Verify installation**

```bash
node -e "import('chokidar').then(c => console.log('chokidar OK:', Object.keys(c)))"
```

Expected: prints `chokidar OK: [...]`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add chokidar for ui-map hot-reload"
```

---

### Task 2: Add missing ui-map entries

**Files:**
- Modify: `shared/ui-map.json`

The registry needs these entries that don't exist yet: `searchInput`, `sidebarMarket`, `sidebarPerps`, `sidebarWallet`.

- [ ] **Step 1: Add searchInput entry**

Add to `elements` object in `shared/ui-map.json`:

```json
"searchInput": {
  "primary": "[data-testid=\"nav-header-search\"]",
  "quick_fallbacks": [
    "input[placeholder*=\"搜索\"]",
    "input[placeholder*=\"Search\"]"
  ],
  "deep_search": {
    "enabled": true,
    "search_text": "搜索",
    "search_role": "textbox",
    "search_scope": "page"
  },
  "tier_stats": { "primary_hits": 0, "quick_hits": 0, "deep_hits": 0, "total_attempts": 0 },
  "page": "global-nav",
  "platform": ["desktop"],
  "success_rate": 0.9,
  "last_verified": "2026-03-24T00:00:00Z",
  "notes": "Exists in both header and modal — use context:'page' for header trigger, context:'modal' for modal input"
}
```

- [ ] **Step 2: Add sidebarMarket entry**

```json
"sidebarMarket": {
  "primary": "[data-testid=\"Desktop-AppSideBar-Content-Container\"] :text(\"Market\")",
  "quick_fallbacks": [
    "text=Market",
    "text=市场",
    "text=マーケット"
  ],
  "deep_search": {
    "enabled": true,
    "search_text": "Market",
    "search_role": "tab",
    "search_scope": "page"
  },
  "tier_stats": { "primary_hits": 0, "quick_hits": 0, "deep_hits": 0, "total_attempts": 0 },
  "page": "global-sidebar",
  "platform": ["desktop"],
  "success_rate": 0.9,
  "last_verified": "2026-03-24T00:00:00Z",
  "notes": "Multi-language: Market, 市场, マーケット, Mercado"
}
```

- [ ] **Step 3: Add sidebarPerps and sidebarWallet entries**

Follow same pattern as sidebarMarket with appropriate text labels:
- `sidebarPerps`: primary `[data-testid="Desktop-AppSideBar-Content-Container"] :text("Perps")`, fallbacks `text=Perps`, `text=合约`
- `sidebarWallet`: primary `[data-testid="Desktop-AppSideBar-Content-Container"] :text("Wallet")`, fallbacks `text=Wallet`, `text=钱包`

- [ ] **Step 4: Add searchClearButton entry**

```json
"searchClearButton": {
  "primary": "[data-testid=\"-clear\"]",
  "quick_fallbacks": [
    "[data-testid=\"APP-Modal-Screen\"] [data-testid=\"-clear\"]"
  ],
  "deep_search": { "enabled": false },
  "tier_stats": { "primary_hits": 0, "quick_hits": 0, "deep_hits": 0, "total_attempts": 0 },
  "page": "search-modal",
  "platform": ["desktop"],
  "success_rate": 0.9,
  "last_verified": "2026-03-24T00:00:00Z"
}
```

- [ ] **Step 5: Commit**

```bash
git add shared/ui-map.json
git commit -m "feat: add searchInput, sidebar, and searchClearButton entries to ui-map"
```

---

### Task 3: Extract constants.mjs (breaks circular imports)

**Files:**
- Create: `src/tests/helpers/constants.mjs`
- Modify: `src/tests/helpers/index.mjs` (import from constants instead of defining locally)

The critical problem: `components.mjs` imports `sleep` from `index.mjs`, and `index.mjs` re-exports `components.mjs` — creating a circular dependency. Extracting shared constants into a leaf module breaks this cycle.

- [ ] **Step 1: Create constants.mjs**

```javascript
// Shared constants and tiny utilities — leaf module, no internal imports
// All helpers import from here instead of index.mjs to avoid circular deps
import { resolve } from 'node:path';

export const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9222';
export const WALLET_PASSWORD = process.env.WALLET_PASSWORD || '1234567890-=';
export const ONEKEY_BIN = '/Applications/OneKey-3.localized/OneKey.app/Contents/MacOS/OneKey';
export const RESULTS_DIR = resolve(import.meta.dirname, '../../../shared/results');
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
```

- [ ] **Step 2: Update index.mjs to import from constants**

Replace the local definitions of `CDP_URL`, `WALLET_PASSWORD`, `ONEKEY_BIN`, `RESULTS_DIR`, `sleep` with:

```javascript
export { CDP_URL, WALLET_PASSWORD, ONEKEY_BIN, RESULTS_DIR, sleep } from './constants.mjs';
```

Keep `ensureOneKeyRunning`, `connectCDP`, `screenshot`, `clickTestId`, `waitForReload` in `index.mjs` — they import from `constants.mjs` now:

```javascript
import { CDP_URL, WALLET_PASSWORD, ONEKEY_BIN, sleep } from './constants.mjs';
```

- [ ] **Step 3: Verify no circular import**

```bash
cd /Users/chole/workspace/QA-AGENTS && node -e "import('./src/tests/helpers/constants.mjs').then(m => console.log('constants OK:', Object.keys(m)))"
```

- [ ] **Step 4: Commit**

```bash
git add src/tests/helpers/constants.mjs src/tests/helpers/index.mjs
git commit -m "refactor: extract constants.mjs to break circular import chain"
```

---

### Task 4: Create UIRegistry class

**Files:**
- Create: `src/tests/helpers/ui-registry.mjs`

This is the core of the entire library. All other modules depend on it.

- [ ] **Step 1: Create ui-registry.mjs with full implementation**

```javascript
// UIRegistry — singleton class for ui-map loading, hot-reload, and three-tier element resolution
// Uses lazy init: first resolve() call triggers loading + watcher setup
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import chokidar from 'chokidar';

const UI_MAP_PATH = resolve(import.meta.dirname, '../../../shared/ui-map.json');
const UI_STATS_PATH = resolve(import.meta.dirname, '../../../shared/results/ui-stats.json');

/**
 * ClickablePoint — returned by resolve() when the element was found via
 * coordinates (L3 deep_search or page-context exclusion of modal elements).
 * Provides click(), fill(), and other common Playwright-like methods via page.mouse/keyboard.
 * This is a documented contract — callers should check `instanceof ClickablePoint`
 * or simply call `.click()` which works on both Locator and ClickablePoint.
 */
class ClickablePoint {
  constructor(page, x, y) {
    this.page = page;
    this.x = x;
    this.y = y;
  }
  async click() {
    await this.page.mouse.click(this.x, this.y);
  }
  async fill(value) {
    await this.page.mouse.click(this.x, this.y);
    await this.page.keyboard.press('Control+a');
    await this.page.keyboard.type(value);
  }
  async pressSequentially(value, opts = {}) {
    await this.page.mouse.click(this.x, this.y);
    // Select all and delete first
    await this.page.keyboard.press('Control+a');
    await this.page.keyboard.press('Backspace');
    for (const char of value) {
      await this.page.keyboard.press(char);
      if (opts.delay) await new Promise(r => setTimeout(r, opts.delay));
    }
  }
  // For compatibility: waitFor is a no-op (element was already found)
  async waitFor() {}
  // isVisible always true (we found it by coordinates)
  async isVisible() { return true; }
}

class UIRegistry {
  #cache = {};
  #watcher = null;
  #filePath;
  #stats = {};
  #statsFlushTimer = null;
  #initialized = false;

  constructor(filePath = UI_MAP_PATH) {
    this.#filePath = filePath;
  }

  /** Lazy init — called automatically on first resolve(). Safe to call multiple times. */
  async init() {
    if (this.#initialized) return;
    this.#initialized = true;

    this.reload();
    this.#watcher = chokidar.watch(this.#filePath, { ignoreInitial: true });
    this.#watcher.on('change', () => {
      console.log('[ui] ui-map.json changed, reloading...');
      this.reload();
    });

    // Auto-cleanup on process exit (synchronous handlers only)
    const cleanup = () => this.destroy();
    process.on('exit', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
  }

  reload() {
    try {
      const raw = readFileSync(this.#filePath, 'utf-8');
      const data = JSON.parse(raw);
      this.#cache = data.elements || {};
    } catch (e) {
      console.error(`[ui] Failed to load ui-map: ${e.message}`);
    }
  }

  /**
   * Three-tier element resolution with context awareness.
   * @param {import('playwright-core').Page} page
   * @param {string} elementName
   * @param {object} opts
   * @param {'auto'|'page'|'modal'} opts.context — 'auto' detects modal visibility
   * @param {number} opts.timeout — per-tier timeout in ms (default 3000)
   * @param {object} opts.params — template variable substitution { N: 0 }
   * @returns {Promise<import('playwright-core').Locator>}
   */
  async resolve(page, elementName, opts = {}) {
    await this.init(); // lazy init on first call
    const entry = this.#cache[elementName];
    if (!entry) throw new Error(`[ui] Element "${elementName}" not found in ui-map`);

    const context = opts.context || 'auto';
    const timeout = opts.timeout || 3000;
    const params = opts.params || {};
    const resolvedContext = context === 'auto' ? await this.#detectContext(page) : context;
    const start = Date.now();

    // Substitute template variables like {N}
    const substitute = (sel) => {
      let s = sel;
      for (const [k, v] of Object.entries(params)) {
        s = s.replaceAll(`{${k}}`, String(v));
      }
      return s;
    };

    const scope = resolvedContext === 'modal'
      ? page.locator('[data-testid="APP-Modal-Screen"]')
      : page;

    // L1: primary selector
    try {
      const sel = substitute(entry.primary);
      const locator = resolvedContext === 'page'
        ? await this.#resolveExcludingModal(page, sel, timeout)
        : scope.locator(sel).first();

      if (resolvedContext !== 'page') {
        await locator.waitFor({ state: 'visible', timeout });
      }

      this.#log(elementName, resolvedContext, 'primary', Date.now() - start);
      this.#recordStat(elementName, 'primary');
      return locator;
    } catch {}

    // L2: quick_fallbacks
    const fallbacks = entry.quick_fallbacks || [];
    for (let i = 0; i < fallbacks.length; i++) {
      try {
        const sel = substitute(fallbacks[i]);
        const locator = resolvedContext === 'page'
          ? await this.#resolveExcludingModal(page, sel, timeout)
          : scope.locator(sel).first();

        if (resolvedContext !== 'page') {
          await locator.waitFor({ state: 'visible', timeout });
        }

        this.#log(elementName, resolvedContext, `fallback#${i}`, Date.now() - start);
        this.#recordStat(elementName, 'quick');
        return locator;
      } catch {}
    }

    // L3: deep_search with retry polling
    if (entry.deep_search?.enabled) {
      for (let retry = 0; retry < 3; retry++) {
        try {
          const result = await page.evaluate(({ searchText, searchRole, searchScope, context: ctx }) => {
            const scopeEl = ctx === 'modal'
              ? document.querySelector('[data-testid="APP-Modal-Screen"]')
              : document.body;
            if (!scopeEl) return null;

            const allEls = scopeEl.querySelectorAll('*');
            for (const el of allEls) {
              const r = el.getBoundingClientRect();
              if (r.width === 0 || r.height === 0) continue;

              const role = el.getAttribute('role') || el.tagName.toLowerCase();
              const text = el.textContent?.trim() || '';
              const placeholder = el.getAttribute('placeholder') || '';
              const ariaLabel = el.getAttribute('aria-label') || '';

              const roleMatch = !searchRole || role === searchRole
                || (searchRole === 'textbox' && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'));
              const textMatch = text.includes(searchText) || placeholder.includes(searchText) || ariaLabel.includes(searchText);

              if (roleMatch && textMatch) {
                // For 'page' context, exclude elements inside modal
                if (ctx === 'page') {
                  const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
                  if (modal?.contains(el)) continue;
                }
                return { x: r.x + r.width / 2, y: r.y + r.height / 2, found: true };
              }
            }
            return null;
          }, {
            searchText: entry.deep_search.search_text,
            searchRole: entry.deep_search.search_role,
            searchScope: entry.deep_search.search_scope,
            context: resolvedContext,
          });

          if (result?.found) {
            this.#log(elementName, resolvedContext, 'deep', Date.now() - start);
            this.#recordStat(elementName, 'deep');
            // Return a ClickablePoint — documented contract for coordinate-based results
            return new ClickablePoint(page, result.x, result.y);
          }
        } catch {}
        if (retry < 2) await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log(`[ui] ${elementName} ✗ all strategies failed`);
    throw new Error(`[ui] Cannot resolve "${elementName}" — all strategies failed`);
  }

  /**
   * Same as resolve() but returns null instead of throwing.
   */
  async resolveOrNull(page, elementName, opts = {}) {
    try {
      return await this.resolve(page, elementName, opts);
    } catch {
      return null;
    }
  }

  /**
   * Resolve multiple elements in parallel.
   */
  async resolveMany(page, names, opts = {}) {
    return Promise.all(names.map(n => this.resolve(page, n, opts)));
  }

  destroy() {
    if (this.#watcher) {
      this.#watcher.close();
      this.#watcher = null;
    }
    this.#flushStats();
    if (this.#statsFlushTimer) {
      clearTimeout(this.#statsFlushTimer);
      this.#statsFlushTimer = null;
    }
  }

  // ── Private ──────────────────────────────────────────────────

  async #detectContext(page) {
    const visible = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return false;
      const r = modal.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    return visible ? 'modal' : 'page';
  }

  /**
   * Resolve a selector on the page, excluding elements inside APP-Modal-Screen.
   * Returns a locator or throws if not found/visible.
   */
  async #resolveExcludingModal(page, selector, timeout) {
    // Use evaluate to find the element outside the modal, then click by coordinates
    const info = await page.evaluate(({ sel }) => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (modal?.contains(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          return { found: true, x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
      }
      return { found: false };
    }, { sel: selector });

    if (!info.found) throw new Error(`Not found outside modal: ${selector}`);

    // Return a ClickablePoint — coordinates guaranteed to be outside the modal
    return new ClickablePoint(page, info.x, info.y);
  }

  #log(name, context, tier, ms) {
    console.log(`[ui] ${name} (${context}) ✓ ${tier} (${ms}ms)`);
  }

  #recordStat(elementName, tier) {
    if (!this.#stats[elementName]) {
      this.#stats[elementName] = { primary_hits: 0, quick_hits: 0, deep_hits: 0, total_attempts: 0 };
    }
    this.#stats[elementName][`${tier}_hits`]++;
    this.#stats[elementName].total_attempts++;

    // Debounced flush
    if (this.#statsFlushTimer) clearTimeout(this.#statsFlushTimer);
    this.#statsFlushTimer = setTimeout(() => this.#flushStats(), 5000);
  }

  #flushStats() {
    if (Object.keys(this.#stats).length === 0) return;
    try {
      mkdirSync(dirname(UI_STATS_PATH), { recursive: true });
      let existing = {};
      try { existing = JSON.parse(readFileSync(UI_STATS_PATH, 'utf-8')); } catch {}
      // Merge stats
      for (const [name, s] of Object.entries(this.#stats)) {
        if (!existing[name]) existing[name] = { primary_hits: 0, quick_hits: 0, deep_hits: 0, total_attempts: 0 };
        existing[name].primary_hits += s.primary_hits;
        existing[name].quick_hits += s.quick_hits;
        existing[name].deep_hits += s.deep_hits;
        existing[name].total_attempts += s.total_attempts;
      }
      writeFileSync(UI_STATS_PATH, JSON.stringify(existing, null, 2));
      this.#stats = {};
    } catch (e) {
      console.error(`[ui] Failed to flush stats: ${e.message}`);
    }
  }
}

// Singleton
export const registry = new UIRegistry();
export { UIRegistry, ClickablePoint };
```

- [ ] **Step 2: Verify the module loads without errors**

```bash
cd /Users/chole/workspace/QA-AGENTS && node -e "import('./src/tests/helpers/ui-registry.mjs').then(m => { console.log('UIRegistry loaded, methods:', Object.keys(m)); })"
```

Expected: `UIRegistry loaded, methods: [ 'registry', 'UIRegistry' ]`

- [ ] **Step 3: Commit**

```bash
git add src/tests/helpers/ui-registry.mjs
git commit -m "feat: add UIRegistry class with three-tier resolution and hot-reload"
```

---

### Task 5: Create components.mjs — global component functions

**Files:**
- Create: `src/tests/helpers/components.mjs`

**Dependencies:** Task 3 (constants.mjs) + Task 4 (UIRegistry must exist)

- [ ] **Step 1: Create components.mjs**

```javascript
// Global component functions — shared across all test files
// Each function calls registry.resolve() internally
// Imports from constants.mjs (NOT index.mjs) to avoid circular dependency
import { registry } from './ui-registry.mjs';
import { sleep, WALLET_PASSWORD } from './constants.mjs';

// ── Step Tracker (moved from market-search.mjs + market-chart.mjs) ──

export function createStepTracker(testId) {
  const steps = [];
  const errors = [];
  return {
    testId, steps, errors,
    add(name, status, detail = '') {
      steps.push({ name, status, detail, time: new Date().toISOString() });
      const icon = status === 'passed' ? 'OK' : 'FAIL';
      console.log(`  [${icon}] ${name}${detail ? ` — ${detail}` : ''}`);
      if (status === 'failed') errors.push(`${name}: ${detail}`);
    },
    result() {
      return { status: errors.length === 0 ? 'passed' : 'failed', steps, errors };
    },
  };
}

/**
 * Safe step wrapper — catches errors, logs result, takes screenshot on failure.
 * @param screenshotFnOrDir — accepts either:
 *   - a function (page, name) => void  (market-search.mjs style)
 *   - a directory string (market-chart.mjs style — auto-screenshots to that dir)
 */
export async function safeStep(page, t, name, fn, screenshotFnOrDir) {
  try {
    const detail = await fn();
    t.add(name, 'passed', detail || '');
    return true;
  } catch (e) {
    t.add(name, 'failed', e.message || String(e));
    const failName = `${t.testId || 'unknown'}-${name.replace(/\s+/g, '-').slice(0, 40)}-fail`;
    if (typeof screenshotFnOrDir === 'function') {
      await screenshotFnOrDir(page, failName);
    } else if (typeof screenshotFnOrDir === 'string') {
      // Directory string — use inline screenshot
      try {
        const { mkdirSync } = await import('node:fs');
        mkdirSync(screenshotFnOrDir, { recursive: true });
        await page.screenshot({ path: `${screenshotFnOrDir}/${failName}.png` });
      } catch {}
    }
    return false;
  }
}

// ── Modal Management ────────────────────────────────────────

export async function isModalVisible(page) {
  return page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return false;
    const r = modal.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

export async function waitForModal(page, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await isModalVisible(page)) return true;
    await sleep(200);
  }
  throw new Error('Modal did not appear within timeout');
}

export async function closeModal(page) {
  // Try nav-header-close first
  const closeLocator = await registry.resolveOrNull(page, 'navClose', { context: 'modal' });
  if (closeLocator) {
    try {
      await closeLocator.click();
      await sleep(500);
      return;
    } catch {}
  }
  // Fallback: Escape
  await page.keyboard.press('Escape');
  await sleep(500);
}

export async function closeAllModals(page) {
  await dismissOverlays(page);
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!(await isModalVisible(page))) break;
    await closeModal(page);
  }
  await sleep(300);
}

export async function dismissOverlays(page) {
  // Overlay popover (note: app has typo 'ovelay')
  const overlay = await registry.resolveOrNull(page, 'overlayPopover', { context: 'page', timeout: 500 });
  if (overlay) {
    try { await overlay.click(); await sleep(300); } catch {}
  }
  // Modal backdrop
  const backdrop = await registry.resolveOrNull(page, 'modalBackdrop', { context: 'page', timeout: 500 });
  if (backdrop) {
    try { await backdrop.click(); await sleep(300); } catch {}
  }
  await page.keyboard.press('Escape');
  await sleep(200);
}

export async function dismissBackdrop(page) {
  const backdrop = await registry.resolveOrNull(page, 'modalBackdrop', { context: 'page', timeout: 500 });
  if (backdrop) {
    try { await backdrop.click(); await sleep(300); } catch {}
  }
}

// ── Search ──────────────────────────────────────────────────

export async function openSearchModal(page) {
  await page.bringToFront().catch(() => {});
  if (await isModalVisible(page)) {
    // Check if it's already the search modal
    const hasSearchInput = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      return !!modal?.querySelector('input[data-testid="nav-header-search"]');
    });
    if (hasSearchInput) return;
  }

  // Click the header search trigger (NOT the one inside a modal)
  // registry.resolve returns either a Locator or ClickablePoint — both have .click()
  const trigger = await registry.resolve(page, 'searchInput', { context: 'page' });
  await trigger.click();
  await sleep(800);

  // Verify modal opened; retry once
  if (!(await isModalVisible(page))) {
    const trigger2 = await registry.resolve(page, 'searchInput', { context: 'page' });
    await trigger2.click();
    await sleep(1000);
  }
}

export async function getSearchInput(page) {
  return registry.resolve(page, 'searchInput', { context: 'modal' });
}

export async function typeSearch(page, value) {
  await openSearchModal(page);
  const input = await getSearchInput(page);
  await input.click();
  await sleep(200);

  // Clear existing content
  await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    const inp = modal?.querySelector('input');
    if (inp) { inp.focus(); inp.select(); }
  });
  await page.keyboard.press('Backspace');
  await sleep(200);

  if (value) {
    try {
      await input.pressSequentially(value, { delay: 40 });
    } catch {
      await input.type(value, { delay: 40 });
    }
  }
  await sleep(1500);
}

export async function clearSearch(page) {
  // Use registry for clear button
  const clearBtn = await registry.resolveOrNull(page, 'searchClearButton', { context: 'modal', timeout: 800 });
  if (clearBtn) {
    try { await clearBtn.click(); await sleep(500); return; } catch {}
  }
  // Fallback: select + backspace inside modal
  await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    const input = modal?.querySelector('input');
    if (input) { input.focus(); input.select(); }
  });
  await page.keyboard.press('Backspace');
  await sleep(500);
}

export async function closeSearch(page) {
  const closeBtn = await registry.resolveOrNull(page, 'navClose', { context: 'modal', timeout: 1200 });
  if (closeBtn) {
    try { await closeBtn.click(); await sleep(800); return; } catch {}
  }
  await page.keyboard.press('Escape');
  await sleep(800);
}

// ── Sidebar Navigation ──────────────────────────────────────

const SIDEBAR_TAB_MAP = {
  'Market': 'sidebarMarket', '市场': 'sidebarMarket', 'マーケット': 'sidebarMarket', 'Mercado': 'sidebarMarket',
  'Perps': 'sidebarPerps', '合约': 'sidebarPerps',
  'Wallet': 'sidebarWallet', '钱包': 'sidebarWallet',
  'Home': 'sidebarHome', '首页': 'sidebarHome',
};

export async function clickSidebarTab(page, name) {
  // Try registry-based resolution first
  const elementName = SIDEBAR_TAB_MAP[name];
  if (elementName) {
    try {
      const locator = await registry.resolve(page, elementName, { context: 'page', timeout: 3000 });
      // Both Locator and ClickablePoint have .click()
      await locator.click();
      await sleep(2000);
      return;
    } catch {}
  }

  // Fallback: text-based sidebar search
  const labels = [name, ...Object.keys(SIDEBAR_TAB_MAP).filter(k => SIDEBAR_TAB_MAP[k] === elementName)];
  const clicked = await page.evaluate((labelsArr) => {
    const sidebar = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
    if (!sidebar) return false;
    for (const sp of sidebar.querySelectorAll('span')) {
      const txt = sp.textContent?.trim();
      if (!txt) continue;
      for (const label of labelsArr) {
        if (txt === label || txt.includes(label)) {
          const r = sp.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { sp.click(); return true; }
        }
      }
    }
    return false;
  }, labels);

  if (!clicked) throw new Error(`Cannot find sidebar tab: ${name}`);
  await sleep(2000);
}

// ── Password / Unlock ───────────────────────────────────────

export async function unlockIfNeeded(page) {
  // Re-use existing logic from navigation.mjs but via registry
  try {
    await sleep(3000);
    const isLocked = await page.evaluate(() => {
      const bodyText = document.body?.textContent || '';
      if (bodyText.includes('欢迎回来') || bodyText.includes('输入密码') || bodyText.includes('忘记密码')) return true;
      const lockEl = document.querySelector('[data-sentry-source-file*="AppStateLock"]');
      if (lockEl && lockEl.getBoundingClientRect().width > 0) return true;
      const pwdInput = document.querySelector('input[placeholder*="密码"]');
      if (pwdInput && pwdInput.getBoundingClientRect().width > 0) return true;
      return false;
    });
    if (!isLocked) return false;
    console.log('  Wallet locked, unlocking...');

    const pwdInput = await registry.resolveOrNull(page, 'passwordInput', { context: 'page', timeout: 5000 });
    if (pwdInput) {
      await pwdInput.click();
      await sleep(300);
      await pwdInput.fill(WALLET_PASSWORD);
      await sleep(500);
      const submitBtn = await registry.resolveOrNull(page, 'verifyingPassword', { context: 'page', timeout: 1000 });
      if (submitBtn) {
        await submitBtn.click();
      } else {
        await page.keyboard.press('Enter');
      }
    } else {
      // Last resort fallback
      const fallback = page.locator('input[type="password"]').first();
      await fallback.fill(WALLET_PASSWORD);
      await sleep(500);
      await fallback.press('Enter');
    }

    console.log('  Waiting for wallet to load...');
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      const stillLocked = await page.evaluate(() => {
        const bodyText = document.body?.textContent || '';
        return bodyText.includes('欢迎回来') || bodyText.includes('输入密码');
      });
      if (!stillLocked) break;
    }
    await sleep(3000);

    const hasWallet = await page.locator('[data-testid="AccountSelectorTriggerBase"]').isVisible({ timeout: 10000 }).catch(() => false);
    console.log(hasWallet ? '  Unlocked successfully.' : '  Unlock: wallet selector not visible, but lock screen cleared.');
    return true;
  } catch (e) {
    console.log(`  Unlock error: ${e.message}`);
    return false;
  }
}

export async function handlePasswordPrompt(page) {
  // Lightweight check for password dialog inside a modal
  const detection = await page.evaluate(() => {
    const bodyText = document.body?.textContent || '';
    const hasLockText = bodyText.includes('欢迎回来') || bodyText.includes('忘记密码');
    const lockEl = document.querySelector('[data-sentry-source-file*="AppStateLock"]');
    if (hasLockText || (lockEl && lockEl.getBoundingClientRect().width > 0)) return { type: 'lock_screen' };

    const pwdInputs = [
      document.querySelector('[data-testid="password-input"]'),
      ...document.querySelectorAll('input[type="password"]'),
      ...document.querySelectorAll('input[placeholder*="密码"]'),
    ].filter(Boolean);
    for (const input of pwdInputs) {
      const r = input.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const inModal = input.closest('[data-testid="APP-Modal-Screen"], [role="dialog"]');
      if (inModal) return { type: 'password_dialog' };
    }
    return { type: null };
  });

  if (!detection.type) return { handled: false, type: null };
  if (detection.type === 'lock_screen') {
    await unlockIfNeeded(page);
    return { handled: true, type: 'lock_screen' };
  }

  // Password dialog
  console.log('    [adaptive] Password re-verification dialog detected...');
  const pwdInput = await registry.resolveOrNull(page, 'passwordInput', { context: 'modal', timeout: 1000 });
  if (pwdInput) {
    await pwdInput.click();
    await sleep(200);
    await pwdInput.fill(WALLET_PASSWORD);
    await sleep(300);
    const submitBtn = await registry.resolveOrNull(page, 'verifyingPassword', { context: 'modal', timeout: 1000 });
    if (submitBtn) { await submitBtn.click(); } else { await page.keyboard.press('Enter'); }

    for (let i = 0; i < 10; i++) {
      await sleep(500);
      const stillVisible = await page.evaluate(() => {
        const inputs = [
          document.querySelector('[data-testid="password-input"]'),
          ...document.querySelectorAll('input[type="password"]'),
        ].filter(Boolean);
        return inputs.some(input => {
          const r = input.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && input.closest('[data-testid="APP-Modal-Screen"]');
        });
      });
      if (!stillVisible) break;
    }
    console.log('    [adaptive] Password dialog handled');
    return { handled: true, type: 'password_dialog' };
  }

  return { handled: false, type: null };
}

export async function enterPassword(page) {
  const pwdInput = await registry.resolve(page, 'passwordInput', { context: 'modal' });
  await pwdInput.click();
  await sleep(200);
  await pwdInput.fill(WALLET_PASSWORD);
  await sleep(300);
  const submitBtn = await registry.resolveOrNull(page, 'verifyingPassword', { context: 'modal', timeout: 1000 });
  if (submitBtn) { await submitBtn.click(); } else { await page.keyboard.press('Enter'); }
  await sleep(1000);
}

// ── Network Selector ────────────────────────────────────────

export async function openNetworkSelector(page) {
  const btn = await registry.resolve(page, 'networkButton', { context: 'page' });
  await btn.click();
  await sleep(1000);
}

export async function selectNetwork(page, name) {
  await openNetworkSelector(page);
  // Search for network by name inside the opened modal/popover
  const chainInput = await registry.resolveOrNull(page, 'chainSearchInput', { context: 'modal', timeout: 3000 });
  if (chainInput) {
    await chainInput.click();
    await sleep(200);
    await chainInput.pressSequentially(name, { delay: 40 });
    await sleep(1000);
  }
  // Click the first matching result
  const clicked = await page.evaluate((networkName) => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]') || document.body;
    for (const el of modal.querySelectorAll('span, div')) {
      if (el.textContent?.trim() === networkName && el.getBoundingClientRect().width > 0) {
        el.click();
        return true;
      }
    }
    return false;
  }, name);
  if (!clicked) throw new Error(`Network "${name}" not found`);
  await sleep(1000);
}
```

- [ ] **Step 2: Verify module loads**

```bash
cd /Users/chole/workspace/QA-AGENTS && node -e "import('./src/tests/helpers/components.mjs').then(m => { console.log('components loaded, exports:', Object.keys(m).join(', ')); })"
```

- [ ] **Step 3: Commit**

```bash
git add src/tests/helpers/components.mjs
git commit -m "feat: add global component functions (modal, search, sidebar, password, network)"
```

---

### Task 6: Create Page Objects

**Files:**
- Create: `src/tests/helpers/pages/market.mjs`
- Create: `src/tests/helpers/pages/perps.mjs`
- Create: `src/tests/helpers/pages/wallet.mjs`
- Create: `src/tests/helpers/pages/index.mjs`

**Dependencies:** Task 5 (components.mjs must exist)

- [ ] **Step 1: Create pages directory**

```bash
mkdir -p /Users/chole/workspace/QA-AGENTS/src/tests/helpers/pages
```

- [ ] **Step 2: Create pages/market.mjs**

```javascript
// MarketPage — page-specific operations for Market tab
import { clickSidebarTab, openSearchModal, typeSearch, clearSearch, closeSearch } from '../components.mjs';
import { registry } from '../ui-registry.mjs';
import { sleep } from '../index.mjs';

export class MarketPage {
  constructor(page) { this.page = page; }

  setPage(page) { this.page = page; }

  async navigate() {
    await clickSidebarTab(this.page, 'Market');
  }

  async openSearch() {
    await openSearchModal(this.page);
  }

  async typeSearch(value) {
    await typeSearch(this.page, value);
  }

  async clearSearch() {
    await clearSearch(this.page);
  }

  async closeSearch() {
    await closeSearch(this.page);
  }

  async switchFilter(network) {
    const clicked = await this.page.evaluate((name) => {
      const filters = document.querySelectorAll('button, [role="tab"]');
      for (const el of filters) {
        const r = el.getBoundingClientRect();
        if (r.y < 50 || r.y > 250 || r.width === 0) continue;
        if (el.textContent?.trim().includes(name)) {
          el.click();
          return true;
        }
      }
      return false;
    }, network);
    if (!clicked) throw new Error(`Filter "${network}" not found`);
    await sleep(1500);
  }

  async clickTokenRow(index) {
    const clicked = await this.page.evaluate((idx) => {
      const rows = document.querySelectorAll('[data-testid="list-column-name"]');
      let visibleIdx = 0;
      for (const row of rows) {
        const r = row.getBoundingClientRect();
        if (r.width > 0 && r.height > 30 && r.y > 200) {
          if (visibleIdx === idx) { row.click(); return true; }
          visibleIdx++;
        }
      }
      return false;
    }, index);
    if (!clicked) throw new Error(`Token row ${index} not found`);
    await sleep(1500);
  }

  async getTokenList() {
    return this.page.evaluate(() => {
      const cells = document.querySelectorAll('[data-testid="list-column-name"]');
      const names = [];
      cells.forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 30 && r.y > 200) {
          const text = el.textContent?.trim();
          if (text) names.push(text);
        }
      });
      return names;
    });
  }

  async switchTab(name) {
    const clicked = await this.page.evaluate((tabName) => {
      const candidates = document.querySelectorAll('button, span, [role="tab"]');
      for (const el of candidates) {
        const txt = el.textContent?.trim();
        const r = el.getBoundingClientRect();
        if (txt === tabName && r.width > 0 && r.height > 0 && r.y > 50 && r.y < 250) {
          el.click();
          return true;
        }
      }
      return false;
    }, name);
    if (!clicked) throw new Error(`Tab "${name}" not found`);
    await sleep(1500);
  }

  async snapshotWatchlistCount() {
    await this.switchTab('自选');
    return this.page.evaluate(() => {
      const nameCells = document.querySelectorAll('[data-testid="list-column-name"]');
      let count = 0;
      nameCells.forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 30 && r.y > 200) count++;
      });
      return count;
    });
  }

  async toggleFavorite(index = 0) {
    const clicked = await this.page.evaluate((idx) => {
      // Try star buttons on the list page
      const starBtns = document.querySelectorAll('[data-testid="list-column-star"] button');
      let visibleIdx = 0;
      for (const btn of starBtns) {
        const r = btn.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          if (visibleIdx === idx) { btn.click(); return true; }
          visibleIdx++;
        }
      }
      return false;
    }, index);
    if (!clicked) throw new Error(`Favorite toggle at index ${index} not found`);
    await sleep(1000);
  }
}
```

- [ ] **Step 3: Create pages/perps.mjs**

```javascript
// PerpsPage — page-specific operations for Perps tab
import { clickSidebarTab } from '../components.mjs';
import { sleep } from '../index.mjs';

export class PerpsPage {
  constructor(page) { this.page = page; }

  setPage(page) { this.page = page; }

  async navigate() {
    await clickSidebarTab(this.page, 'Perps');
  }

  async getCurrentPair() {
    return this.page.evaluate(() => {
      const pairs = document.querySelectorAll('span, div');
      for (const el of pairs) {
        const text = el.textContent?.trim() || '';
        if (/^[A-Z]{2,10}\/[A-Z]{2,10}$/.test(text)) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.y < 200) return text;
        }
      }
      return null;
    });
  }

  async openPairSelector() {
    const pair = await this.getCurrentPair();
    if (!pair) throw new Error('Cannot find current pair to click');
    const clicked = await this.page.evaluate((pairText) => {
      for (const el of document.querySelectorAll('span, div')) {
        if (el.textContent?.trim() === pairText) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.y < 200) { el.click(); return true; }
        }
      }
      return false;
    }, pair);
    if (!clicked) throw new Error('Cannot click pair selector');
    await sleep(1000);
  }

  async searchPair(keyword) {
    await this.openPairSelector();
    const input = this.page.locator('[data-testid="ovelay-popover"] input, [role="dialog"] input').first();
    await input.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    await input.click();
    await input.pressSequentially(keyword, { delay: 40 });
    await sleep(1500);
  }

  async selectPair(name) {
    const clicked = await this.page.evaluate((pairName) => {
      const popover = document.querySelector('[data-testid="ovelay-popover"]') || document.body;
      for (const el of popover.querySelectorAll('span, div')) {
        if (el.textContent?.trim().includes(pairName)) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 20) { el.click(); return true; }
        }
      }
      return false;
    }, name);
    if (!clicked) throw new Error(`Pair "${name}" not found`);
    await sleep(1500);
  }
}
```

- [ ] **Step 4: Create pages/wallet.mjs**

```javascript
// WalletPage — page-specific operations for Wallet tab
import { clickSidebarTab } from '../components.mjs';
import { registry } from '../ui-registry.mjs';
import { sleep } from '../index.mjs';

export class WalletPage {
  constructor(page) { this.page = page; }

  setPage(page) { this.page = page; }

  async navigate() {
    await clickSidebarTab(this.page, 'Wallet');
  }

  async openReceive() {
    const clicked = await this.page.evaluate(() => {
      for (const el of document.querySelectorAll('button, [role="button"]')) {
        const text = el.textContent?.trim();
        if ((text === '收款' || text === 'Receive') && el.getBoundingClientRect().width > 0) {
          el.click();
          return true;
        }
      }
      return false;
    });
    if (!clicked) throw new Error('Receive button not found');
    await sleep(1500);
  }

  async openSend() {
    const clicked = await this.page.evaluate(() => {
      for (const el of document.querySelectorAll('button, [role="button"]')) {
        const text = el.textContent?.trim();
        if ((text === '发送' || text === 'Send') && el.getBoundingClientRect().width > 0) {
          el.click();
          return true;
        }
      }
      return false;
    });
    if (!clicked) throw new Error('Send button not found');
    await sleep(1500);
  }

  async selectAccount(index) {
    const selector = await registry.resolve(this.page, 'walletSelector', { context: 'page' });
    await selector.click();
    await sleep(1000);
    const account = await registry.resolve(this.page, 'accountItemByIndex', { context: 'modal', params: { N: index } });
    await account.click();
    await sleep(1500);
  }
}
```

- [ ] **Step 5: Create pages/index.mjs**

```javascript
// Re-export all Page Objects
export { MarketPage } from './market.mjs';
export { PerpsPage } from './perps.mjs';
export { WalletPage } from './wallet.mjs';
```

- [ ] **Step 6: Verify all Page Objects load**

```bash
cd /Users/chole/workspace/QA-AGENTS && node -e "import('./src/tests/helpers/pages/index.mjs').then(m => console.log('Pages loaded:', Object.keys(m)))"
```

Expected: `Pages loaded: [ 'MarketPage', 'PerpsPage', 'WalletPage' ]`

- [ ] **Step 7: Commit**

```bash
git add src/tests/helpers/pages/
git commit -m "feat: add MarketPage, PerpsPage, WalletPage page objects"
```

---

### Task 7: Update helpers/index.mjs — re-export (NO top-level await)

**Files:**
- Modify: `src/tests/helpers/index.mjs`

**Dependencies:** Tasks 3-6

Registry uses lazy init (first `resolve()` call triggers loading). No top-level `await` needed in `index.mjs` — this avoids blocking all importers and eliminates the circular import risk.

- [ ] **Step 1: Add re-exports to index.mjs**

At the end of `src/tests/helpers/index.mjs`, add:

```javascript
// ── UIRegistry + Components + Pages ──────────────────────────
// Registry uses lazy init — no top-level await needed
export { registry } from './ui-registry.mjs';
export * from './components.mjs';
export { MarketPage, PerpsPage, WalletPage } from './pages/index.mjs';
```

- [ ] **Step 2: Verify index.mjs loads with registry initialized**

```bash
cd /Users/chole/workspace/QA-AGENTS && node -e "import('./src/tests/helpers/index.mjs').then(m => { console.log('registry:', !!m.registry); console.log('openSearchModal:', typeof m.openSearchModal); console.log('MarketPage:', typeof m.MarketPage); process.exit(0); })"
```

- [ ] **Step 3: Commit**

```bash
git add src/tests/helpers/index.mjs
git commit -m "feat: init UIRegistry and re-export components + pages from helpers/index"
```

---

### Task 8: Refactor navigation.mjs to delegate to components

**Files:**
- Modify: `src/tests/helpers/navigation.mjs`

**Dependencies:** Task 7

Replace the function bodies in navigation.mjs to delegate to components.mjs. Keep all export names unchanged for backward compatibility during migration.

- [ ] **Step 1: Rewrite navigation.mjs**

Replace the entire file content. Key changes:
- `dismissOverlays` → delegates to `components.dismissOverlays`
- `closeAllModals` → delegates to `components.closeAllModals`
- `unlockWalletIfNeeded` → delegates to `components.unlockIfNeeded`
- `handlePasswordPromptIfPresent` → delegates to `components.handlePasswordPrompt`
- `goToWalletHome` → uses `components.closeAllModals` + `components.clickSidebarTab`

```javascript
// Navigation helpers — now delegates to components.mjs
// Export names preserved for backward compatibility
import {
  dismissOverlays as _dismissOverlays,
  closeAllModals as _closeAllModals,
  unlockIfNeeded,
  handlePasswordPrompt,
  clickSidebarTab,
} from './components.mjs';
import { sleep } from './constants.mjs';

export async function dismissOverlays(page) {
  return _dismissOverlays(page);
}

export async function closeAllModals(page) {
  return _closeAllModals(page);
}

export async function unlockWalletIfNeeded(page) {
  return unlockIfNeeded(page);
}

export async function handlePasswordPromptIfPresent(page) {
  return handlePasswordPrompt(page);
}

export async function goToWalletHome(page) {
  await closeAllModals(page);
  await clickSidebarTab(page, 'Home');
  await sleep(2000);
  const hasWalletSelector = await page.locator('[data-testid="AccountSelectorTriggerBase"]').isVisible({ timeout: 3000 }).catch(() => false);
  if (!hasWalletSelector) {
    await page.keyboard.press('Escape');
    await sleep(500);
    await clickSidebarTab(page, 'Home');
    await sleep(2000);
  }
}
```

- [ ] **Step 2: Verify module loads and exports match**

```bash
cd /Users/chole/workspace/QA-AGENTS && node -e "import('./src/tests/helpers/navigation.mjs').then(m => console.log('navigation exports:', Object.keys(m)))"
```

Expected: `navigation exports: [ 'dismissOverlays', 'closeAllModals', 'unlockWalletIfNeeded', 'handlePasswordPromptIfPresent', 'goToWalletHome' ]`

- [ ] **Step 3: Commit**

```bash
git add src/tests/helpers/navigation.mjs
git commit -m "refactor: navigation.mjs delegates to components.mjs"
```

---

### Task 9: Refactor market-search.mjs to delegate to components

**Files:**
- Modify: `src/tests/helpers/market-search.mjs`

**Dependencies:** Task 7

- [ ] **Step 1: Update market-search.mjs**

Replace the `createStepTracker`, `safeStep`, `isSearchModalOpen`, `getModalSearchInput`, `openSearchModal`, `clearSearch`, `closeSearch` functions to delegate to components. Keep the search-specific assertion helpers (`assertHasSomeTableLikeContent`, `scrollToBottomAndAssert`, `getSearchHistory`, etc.) as-is since they are domain-specific.

At the top of the file, replace the existing imports and function definitions:

```javascript
// Shared Market Search helpers — now delegates core functions to components.mjs
// Domain-specific assertion helpers remain here.
import { sleep } from './constants.mjs';
import {
  createStepTracker, safeStep,
  isModalVisible, openSearchModal as _openSearchModal, getSearchInput,
  typeSearch, clearSearch as _clearSearch, closeSearch as _closeSearch,
} from './components.mjs';

// Re-export from components for backward compatibility
export { createStepTracker, safeStep } from './components.mjs';

// ── Search Modal Primitives (delegates) ──────────────────────

export async function isSearchModalOpen(page) {
  return isModalVisible(page);
}

export function getModalSearchInput(page) {
  return page.locator('[data-testid="APP-Modal-Screen"] input[data-testid="nav-header-search"]').first();
}

export async function openSearchModal(page, triggerFn) {
  // If triggerFn provided (legacy callers), use old behavior
  // Otherwise delegate to components
  if (!triggerFn) {
    return _openSearchModal(page);
  }
  await page.bringToFront().catch(() => {});
  if (await isSearchModalOpen(page)) return;
  await triggerFn(page);
  await sleep(800);
  if (!(await isSearchModalOpen(page))) {
    await triggerFn(page);
    await sleep(1000);
  }
}

// ── Input Helpers ────────────────────────────────────────────
// Keep setSearchValueStrict and setSearchValue as-is (they accept triggerFn)
```

Keep the rest of the file (from `setSearchValueStrict` onward) unchanged. Only the top section (stepTracker, modal primitives) changes.

- [ ] **Step 2: Verify module loads**

```bash
cd /Users/chole/workspace/QA-AGENTS && node -e "import('./src/tests/helpers/market-search.mjs').then(m => console.log('market-search exports:', Object.keys(m).length, 'functions'))"
```

- [ ] **Step 3: Commit**

```bash
git add src/tests/helpers/market-search.mjs
git commit -m "refactor: market-search.mjs delegates core functions to components.mjs"
```

---

### Task 10: Refactor market-chart.mjs — remove duplicate stepTracker

**Files:**
- Modify: `src/tests/helpers/market-chart.mjs`

**Dependencies:** Task 5

- [ ] **Step 1: Replace local stepTracker with import from components**

At the top of `market-chart.mjs`, remove the local `createStepTracker`, `safeStep`, and `screenshot` definitions (lines 6-48). Replace with:

```javascript
import { createStepTracker, safeStep } from './components.mjs';
import { screenshot } from './index.mjs';
```

Keep everything below (TradingView frame access and chart-specific helpers) unchanged.

- [ ] **Step 2: Verify module loads**

```bash
cd /Users/chole/workspace/QA-AGENTS && node -e "import('./src/tests/helpers/market-chart.mjs').then(m => console.log('market-chart exports:', Object.keys(m).length, 'functions'))"
```

- [ ] **Step 3: Commit**

```bash
git add src/tests/helpers/market-chart.mjs
git commit -m "refactor: market-chart.mjs imports stepTracker from components.mjs"
```

---

### Task 11: Migrate desktop test files

**Files:**
- Modify: `src/tests/desktop/market/search.test.mjs`
- Modify: `src/tests/desktop/market/home.test.mjs`
- Modify: `src/tests/desktop/market/favorite.test.mjs`
- Modify: `src/tests/desktop/market/chart.test.mjs`
- Modify: `src/tests/desktop/utility/universal-search.test.mjs`
- Modify: `src/tests/desktop/perps/token-search.test.mjs`
- Modify: `src/tests/desktop/perps/favorites.test.mjs`

**Dependencies:** Tasks 7, 8, 9

For each file, the migration pattern is:

1. Remove local `goToMarket()` / `goToPerps()` / `resetToHome()` / `openSearchTrigger()` function definitions
2. Replace with imports from `components.mjs` or use Page Objects
3. Replace local trigger wrapper functions (`_open`, `_ensure`, `_setStrict`) with direct calls

- [ ] **Step 1: Migrate desktop/market/search.test.mjs**

Remove lines 45-100 (local `goToMarket`, `openSearchTrigger`, wrapper functions). Replace with:

```javascript
import { MarketPage } from '../../helpers/pages/index.mjs';
import { openSearchModal, typeSearch, clearSearch, closeSearch } from '../../helpers/components.mjs';
```

In `setup()`, replace `await goToMarket(page)` with:
```javascript
const market = new MarketPage(page);
await market.navigate();
```

Replace `_open(page)` calls with `await openSearchModal(page)`.
Replace `_setStrict(page, 'BTC')` with `await typeSearch(page, 'BTC')`.
Replace `_scrollBottom(page, opts)` with the existing `scrollToBottomAndAssert` from market-search.mjs (that one stays).

Note: `setSearchValueStrict` and similar helpers that are market-search-specific should still be imported from `market-search.mjs`. Only the duplicated navigation/trigger functions are replaced.

- [ ] **Step 2: Migrate desktop/market/home.test.mjs**

Read the file, identify local `goToMarket`/`openSearchTrigger`, replace with MarketPage + components imports.

- [ ] **Step 3: Migrate desktop/market/favorite.test.mjs**

Read the file, replace local `openSearchTrigger` variant with `openSearchModal` from components.

- [ ] **Step 4: Migrate desktop/market/chart.test.mjs**

Read the file, replace local `goToMarket` with `MarketPage.navigate()`.

- [ ] **Step 5: Migrate desktop/utility/universal-search.test.mjs**

Read the file, replace local `openSearchTrigger`/`resetToHome` with components.

- [ ] **Step 6: Migrate desktop/perps/token-search.test.mjs**

Read the file, replace local `goToPerps`/`getCurrentPair`/`openPairSelector` with PerpsPage.

- [ ] **Step 7: Migrate desktop/perps/favorites.test.mjs**

Read the file, replace inline search input resolution with components.

- [ ] **Step 8: Verify all desktop test modules load without import errors**

```bash
cd /Users/chole/workspace/QA-AGENTS
for f in src/tests/desktop/market/search.test.mjs src/tests/desktop/market/home.test.mjs src/tests/desktop/market/favorite.test.mjs src/tests/desktop/market/chart.test.mjs src/tests/desktop/utility/universal-search.test.mjs src/tests/desktop/perps/token-search.test.mjs src/tests/desktop/perps/favorites.test.mjs; do
  node -e "import('./$f').then(() => console.log('OK: $f')).catch(e => console.log('FAIL: $f:', e.message))" 2>&1
done
```

- [ ] **Step 9: Commit**

```bash
git add src/tests/desktop/
git commit -m "refactor: migrate desktop test files to use components + Page Objects"
```

---

### Task 12: Migrate web and extension test files

**Files:**
- Modify: `src/tests/web/market/search.test.mjs`
- Modify: `src/tests/web/market/chart.test.mjs`
- Modify: `src/tests/web/perps/token-search.test.mjs`
- Modify: `src/tests/web/perps/favorites.test.mjs`
- Modify: `src/tests/web/utility/universal-search.test.mjs`
- Modify: `src/tests/extension/market/search.test.mjs`
- Modify: `src/tests/extension/market/chart.test.mjs`
- Modify: `src/tests/extension/perps/token-search.test.mjs`
- Modify: `src/tests/extension/perps/favorites.test.mjs`
- Modify: `src/tests/extension/utility/universal-search.test.mjs`

**Dependencies:** Task 11

Same migration pattern as Task 10. Web and extension files typically mirror desktop files with minor CDP connection differences.

- [ ] **Step 1: Migrate web test files**

For each file under `src/tests/web/`, apply the same pattern: remove local duplicates, import from components + Page Objects.

- [ ] **Step 2: Migrate extension test files**

For each file under `src/tests/extension/`, apply the same pattern.

- [ ] **Step 3: Verify all web/extension test modules load**

```bash
cd /Users/chole/workspace/QA-AGENTS
for f in src/tests/web/market/search.test.mjs src/tests/web/market/chart.test.mjs src/tests/web/perps/token-search.test.mjs src/tests/web/perps/favorites.test.mjs src/tests/web/utility/universal-search.test.mjs src/tests/extension/market/search.test.mjs src/tests/extension/market/chart.test.mjs src/tests/extension/perps/token-search.test.mjs src/tests/extension/perps/favorites.test.mjs src/tests/extension/utility/universal-search.test.mjs; do
  node -e "import('./$f').then(() => console.log('OK: $f')).catch(e => console.log('FAIL: $f:', e.message))" 2>&1
done
```

- [ ] **Step 4: Commit**

```bash
git add src/tests/web/ src/tests/extension/
git commit -m "refactor: migrate web + extension test files to use components + Page Objects"
```

---

### Task 13: Smoke test with OneKey CDP

**Dependencies:** All previous tasks

Run a quick smoke test to verify the component library works end-to-end with a real OneKey connection.

- [ ] **Step 1: Create a minimal smoke test**

Create `src/tests/helpers/__smoke__.mjs` (temporary, will be deleted after verification):

```javascript
import { connectCDP, sleep } from './index.mjs';
import { registry } from './ui-registry.mjs';
import { openSearchModal, closeSearch, clickSidebarTab, unlockIfNeeded, dismissOverlays } from './components.mjs';
import { MarketPage } from './pages/index.mjs';

const { page } = await connectCDP();
console.log('Connected to OneKey via CDP');

// Test 1: Unlock if needed
await unlockIfNeeded(page);
console.log('\n--- Test: dismissOverlays ---');
await dismissOverlays(page);

// Test 2: Navigate via sidebar
console.log('\n--- Test: clickSidebarTab("Market") ---');
await clickSidebarTab(page, 'Market');
await sleep(2000);

// Test 3: Open search modal
console.log('\n--- Test: openSearchModal ---');
await openSearchModal(page);
await sleep(1000);

// Test 4: Close search
console.log('\n--- Test: closeSearch ---');
await closeSearch(page);

// Test 5: MarketPage
console.log('\n--- Test: MarketPage ---');
const market = new MarketPage(page);
const tokens = await market.getTokenList();
console.log(`Token list: ${tokens.length} items`);

console.log('\n✓ All smoke tests passed');
registry.destroy();
process.exit(0);
```

- [ ] **Step 2: Run smoke test**

```bash
cd /Users/chole/workspace/QA-AGENTS && node src/tests/helpers/__smoke__.mjs
```

Expected: All tests pass, logs show `[ui]` resolution messages.

- [ ] **Step 3: Delete smoke test file**

```bash
rm src/tests/helpers/__smoke__.mjs
```

- [ ] **Step 4: Final commit**

```bash
git add src/tests/ shared/results/
git commit -m "refactor: component library migration complete — all test files using shared UIRegistry"
```
