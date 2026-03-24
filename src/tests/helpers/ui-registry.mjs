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
