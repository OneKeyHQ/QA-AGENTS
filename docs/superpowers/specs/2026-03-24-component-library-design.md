# Component Library Design — Public Element Locator Registry

**Date**: 2026-03-24
**Status**: Approved
**Problem**: Search input and other high-frequency elements fail to locate repeatedly across test files because each file reimplements its own locator logic. `ui-map.json` exists but is never consumed at runtime.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Mixed mode: global functions + lightweight Page Objects | Global for cross-page ops (modal, search, sidebar); Page Object for page-specific ops |
| ui-map loading | Startup load + fs.watch hot-reload | Performance + flexibility during recording sessions |
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
  async init()                // Load file + start fs.watch
  async resolve(page, elementName, opts = {})
    // opts.context: 'auto' | 'page' | 'modal' (default: 'auto')
    // opts.timeout: number (default: 5000)
    // Returns: Playwright Locator or { x, y } coordinates
  async resolveMany(page, names, opts = {})
  reload()                    // Manual cache refresh
  destroy()                   // Cleanup watcher
}
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

### Logging

```
[ui] searchInput ✓ primary (3ms)
[ui] searchInput ✓ fallback#1 (15ms)
[ui] searchInput ✓ deep (45ms)
[ui] searchInput ✗ all strategies failed
```

### Stats Writeback

- On each successful resolve, increment the corresponding `tier_stats` counter
- Debounced flush to `ui-map.json` every 5 seconds to avoid excessive IO

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

### Modified Files (10)

| File | Change |
|------|--------|
| `helpers/index.mjs` | Init registry singleton, re-export components + pages |
| `helpers/navigation.mjs` | Function bodies delegate to `components.mjs`, export names unchanged |
| `helpers/market-search.mjs` | Search functions delegate to `components.mjs`, export names unchanged |
| `desktop/market/search.test.mjs` | Remove local `openSearchTrigger` + `goToMarket`, use components + MarketPage |
| `desktop/utility/universal-search.test.mjs` | Remove local `openSearchTrigger` + `resetToHome`, use components |
| `desktop/perps/token-search.test.mjs` | Remove local `goToPerps` + `getCurrentPair`, use PerpsPage |
| `web/market/search.test.mjs` | Sync migration |
| `extension/market/search.test.mjs` | Sync migration |
| `web/perps/token-search.test.mjs` | Sync migration |
| `extension/perps/token-search.test.mjs` | Sync migration |

### Untouched Files

| File | Reason |
|------|--------|
| `shared/ui-map.json` | Data unchanged, now consumed by UIRegistry |
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
