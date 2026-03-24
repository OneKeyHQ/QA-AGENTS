# Component Library Design — Public Element Locator Registry

**Date**: 2026-03-24
**Status**: Approved
**Problem**: Search input and other high-frequency elements fail to locate repeatedly across test files because each file reimplements its own locator logic. `ui-map.json` exists but is never consumed at runtime.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Mixed mode: global functions + lightweight Page Objects | Global for cross-page ops (modal, search, sidebar); Page Object for page-specific ops |
| ui-map loading | Startup load + chokidar hot-reload | Performance + flexibility; chokidar is reliable on macOS (fs.watch has known issues with kqueue/FSEvents) |
| Locator failure | Log + degrade (L1→L2→L3→error) with tier_stats update | Transparent debugging without blocking tests |
| Migration | One-step full migration | All existing test files updated to use the new library |

## Architecture Overview

```
src/tests/helpers/
├── ui-registry.mjs        # UIRegistry class (singleton)
├── components.mjs          # Global component functions
├── pages/
│   ├── index.mjs           # Re-export all Page Objects
│   ├── market.mjs           # MarketPage
│   ├── perps.mjs            # PerpsPage
│   └── wallet.mjs           # WalletPage
├── market-search.mjs        # Refactored → delegates to components
├── navigation.mjs           # Refactored → delegates to components
└── index.mjs                # Registry init + re-exports
```

## Module 1: UIRegistry (`ui-registry.mjs`)

Singleton class that manages ui-map loading, caching, hot-reload, and three-tier element resolution.

### API

```javascript
class UIRegistry {
  constructor(filePath)       // Path to shared/ui-map.json
  async init()                // Load file + start chokidar watcher + register process cleanup
  async resolve(page, elementName, opts = {})
    // opts.context: 'auto' | 'page' | 'modal' (default: 'auto')
    // opts.timeout: number (default: 5000)
    // opts.params: { N: 0 } — template variable substitution for selectors like "account-item-index-{N}"
    // Returns: Playwright Locator or { x, y } coordinates
  async resolveOrNull(page, elementName, opts = {})
    // Same as resolve() but returns null instead of throwing on failure
    // Use for optional interactions (e.g., dismissOverlays)
  async resolveMany(page, names, opts = {})
  reload()                    // Manual cache refresh
  destroy()                   // Cleanup watcher + flush pending stats
}
```

### Process Lifecycle

`init()` registers `process.on('exit')` and `process.on('SIGTERM')` handlers that call `destroy()` automatically. No manual cleanup needed in test files.

### Template Variables

Selectors containing `{VAR}` placeholders (e.g., `[data-testid="account-item-index-{N}"]`) are substituted at resolve time:

```javascript
await registry.resolve(page, 'accountItemByIndex', { params: { N: 0 } });
// → resolves [data-testid="account-item-index-0"]
```

### Three-Tier Resolution Strategy

| Tier | Strategy | Example |
|------|----------|---------|
| L1 primary | `page.locator(primary).first()` | `[data-testid="nav-header-search"]` |
| L2 quick_fallbacks | Try each fallback selector sequentially | `input[placeholder*="搜索"]` |
| L3 deep_search | `page.evaluate()` — text + role + scope | Find role=textbox with text "搜索" inside modal |

### Context Awareness

Solves the core problem of duplicate `data-testid="nav-header-search"` in header and modal:

- `context: 'modal'` — All selectors scoped to `[data-testid="APP-Modal-Screen"]`
- `context: 'page'` — Excludes elements inside Modal
- `context: 'auto'` — Detects modal visibility and chooses automatically

### L3 Deep Search Retry

L1/L2 use `page.locator()` with Playwright's built-in auto-wait. L3 uses `page.evaluate()` which is a one-shot DOM query. To compensate, L3 includes its own polling loop: up to 3 retries with 500ms intervals before declaring failure.

### Logging

Includes context (modal/page) for disambiguation:

```
[ui] searchInput (page) ✓ primary (3ms)
[ui] searchInput (modal) ✓ fallback#1 (15ms)
[ui] searchInput (modal) ✓ deep (45ms)
[ui] searchInput ✗ all strategies failed
```

### Stats Writeback

- On each successful resolve, increment the corresponding `tier_stats` counter
- Stats written to **separate file** `shared/results/ui-stats.json` (NOT `ui-map.json`)
- `ui-map.json` remains read-only from test runtime, respecting Knowledge Builder's exclusive write ownership
- Debounced flush every 5 seconds to avoid excessive IO
- Knowledge Builder can consume `ui-stats.json` to inform curation decisions

## Module 2: Global Component Functions (`components.mjs`)

Stateless async functions that call `registry.resolve()` internally. Replace duplicated logic across test files.

### Modal Management

```javascript
isModalVisible(page)          // Check APP-Modal-Screen visibility
waitForModal(page, timeout)   // Wait for modal to appear
closeModal(page)              // nav-header-close → Escape fallback
closeAllModals(page)          // Replaces navigation.mjs closeAllModals
dismissOverlays(page)         // Replaces navigation.mjs dismissOverlays
dismissBackdrop(page)         // Click app-modal-stacks-backdrop
```

### Search (core pain point)

```javascript
openSearchModal(page)         // Click header trigger → wait for modal
getSearchInput(page)          // Return modal search input locator
typeSearch(page, value)       // pressSequentially + async result polling
clearSearch(page)             // Clear button → select+Backspace fallback
closeSearch(page)             // Close search modal
```

Key behaviors:
- `openSearchModal` uses `registry.resolve(page, 'searchInput', { context: 'page' })` to locate the header trigger, excluding the modal's duplicate input
- `typeSearch` encapsulates `pressSequentially` + retry polling for async results (knowledge K-017/K-018)
- `getSearchInput` uses `registry.resolve(page, 'searchInput', { context: 'modal' })` for modal-scoped input

### Sidebar Navigation

```javascript
clickSidebarTab(page, name)
  // name: 'Market' | '市场' | 'Wallet' | '钱包' | 'Perps' | '合约' | ...
  // Multi-language matching via registry + text fallback
  // Replaces: goToMarket(), goToPerps(), resetToHome() across 5+ files
```

### Password / Unlock

```javascript
unlockIfNeeded(page)          // Replaces unlockWalletIfNeeded
handlePasswordPrompt(page)    // Replaces handlePasswordPromptIfPresent
enterPassword(page)           // Type password + confirm
```

### Network Selector

```javascript
openNetworkSelector(page)
selectNetwork(page, name)
```

## Module 3: Page Objects (`pages/`)

Thin wrappers for page-specific operations. All locator resolution delegated to `registry.resolve()`. Common operations delegated to `components.mjs`.

### Lifecycle: Page Object wraps `page`, global functions also accept `page`

Page Objects hold a `page` reference via constructor. If CDP reconnects (page becomes stale), call `pageObj.setPage(newPage)` to update. All Page Object methods internally pass `this.page` to global component functions, so the caller never passes `page` twice:

```javascript
const market = new MarketPage(page);
await market.navigate();           // internally: clickSidebarTab(this.page, 'Market')
await market.openSearch();         // internally: openSearchModal(this.page)
await market.typeSearch('BTC');    // internally: typeSearch(this.page, 'BTC')

// CDP reconnect scenario:
const { page: newPage } = await connectCDP();
market.setPage(newPage);
```

When using global functions directly (without Page Object), pass `page` as first arg as before.

### MarketPage (`pages/market.mjs`)

```javascript
class MarketPage {
  constructor(page)
  async navigate()                // clickSidebarTab(page, 'Market')
  async switchFilter(network)     // Horizontal scroll filter bar
  async clickTokenRow(index)
  async getTokenList()            // Return token name array
  async switchTab(name)           // 现货 / 自选 / ...
  async snapshotWatchlistCount()  // Replaces market-search.mjs version
  async toggleFavorite(index)     // Replaces toggleFavoriteOnFirstRow
}
```

### PerpsPage (`pages/perps.mjs`)

```javascript
class PerpsPage {
  constructor(page)
  async navigate()                // clickSidebarTab(page, 'Perps')
  async getCurrentPair()          // Replaces local getCurrentPair()
  async openPairSelector()        // Replaces openPairSelector + ensurePopoverOpen
  async searchPair(keyword)
  async selectPair(name)
}
```

### WalletPage (`pages/wallet.mjs`)

```javascript
class WalletPage {
  constructor(page)
  async navigate()                // clickSidebarTab(page, 'Wallet')
  async openReceive()
  async openSend()
  async selectAccount(index)
}
```

## Module 4: Migration — File Change List

### New Files (6)

| File | Role |
|------|------|
| `src/tests/helpers/ui-registry.mjs` | UIRegistry class |
| `src/tests/helpers/components.mjs` | Global component functions |
| `src/tests/helpers/pages/market.mjs` | MarketPage |
| `src/tests/helpers/pages/perps.mjs` | PerpsPage |
| `src/tests/helpers/pages/wallet.mjs` | WalletPage |
| `src/tests/helpers/pages/index.mjs` | Re-export Page Objects |

### Modified Files (14)

| File | Change |
|------|--------|
| `helpers/index.mjs` | Init registry singleton, re-export components + pages |
| `helpers/navigation.mjs` | Function bodies delegate to `components.mjs`, export names unchanged |
| `helpers/market-search.mjs` | Search functions delegate to `components.mjs`; move `createStepTracker`/`safeStep` to `components.mjs`; export names unchanged |
| `desktop/market/search.test.mjs` | Remove local `openSearchTrigger` + `goToMarket`, use components + MarketPage |
| `desktop/market/home.test.mjs` | Remove local `goToMarket` + `openSearchTrigger`, use MarketPage |
| `desktop/market/favorite.test.mjs` | Remove local `openSearchTrigger` variant, use components |
| `desktop/market/chart.test.mjs` | Remove local `goToMarket`, use MarketPage |
| `desktop/utility/universal-search.test.mjs` | Remove local `openSearchTrigger` + `resetToHome`, use components |
| `desktop/perps/token-search.test.mjs` | Remove local `goToPerps` + `getCurrentPair`, use PerpsPage |
| `desktop/perps/favorites.test.mjs` | Remove inline search input resolution, use components |
| `web/market/search.test.mjs` | Sync migration |
| `web/market/chart.test.mjs` | Sync migration |
| `web/perps/token-search.test.mjs` | Sync migration |
| `web/perps/favorites.test.mjs` | Sync migration |
| `web/utility/universal-search.test.mjs` | Sync migration |
| `extension/market/search.test.mjs` | Sync migration |
| `extension/market/chart.test.mjs` | Sync migration |
| `extension/perps/token-search.test.mjs` | Sync migration |
| `extension/perps/favorites.test.mjs` | Sync migration |
| `extension/utility/universal-search.test.mjs` | Sync migration |
| `helpers/market-chart.mjs` | Remove duplicate `createStepTracker`, import from `components.mjs` |

### Data Files to Update

| File | Change |
|------|--------|
| `shared/ui-map.json` | Add missing entries: `searchInput` (header+modal search), `sidebarMarket`, `sidebarPerps`, `sidebarWallet` |
| `shared/knowledge.json` | Unchanged |
| `helpers/preconditions.mjs` | Business preconditions, no component locators |
| `helpers/transfer.mjs` | Transfer-specific, future migration |
| `android/**` | Different platform, out of scope |

## Usage Examples

### Before (search.test.mjs)

```javascript
import { dismissOverlays, unlockWalletIfNeeded } from '../../helpers/index.mjs';
import { openSearchModal, setSearchValueStrict, ... } from '../../helpers/market-search.mjs';

// Local duplicate — 30 lines
async function goToMarket(page) { ... }
// Local duplicate — 15 lines
async function openSearchTrigger(page) { ... }
```

### After

```javascript
import {
  openSearchModal, typeSearch, clearSearch, closeSearch,
  unlockIfNeeded, dismissOverlays,
} from '../../helpers/components.mjs';
import { MarketPage } from '../../helpers/pages/index.mjs';

const market = new MarketPage(page);
await market.navigate();
await openSearchModal(page);
await typeSearch(page, 'BTC');
```
