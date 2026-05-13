// lookup-testid.mjs — selector lookup used at test-generation time.
//
// Reference order (matches CLAUDE.md):
//   1. shared/ui-semantic-map.json              (curated, cross-platform)
//   2. shared/generated/app-monorepo-testid-index.json  (source scan)
//   3. shared/ui-map.json                       (current runtime mappings)
//
// If all three miss, the caller should ask the user to record the element.
//
// Platform-aware: same source_testid renders to different selector forms
// depending on target platform (DOM-based vs native).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../../..');
const SEMANTIC_PATH = resolve(ROOT, 'shared/ui-semantic-map.json');
const TESTID_INDEX_PATH = resolve(ROOT, 'shared/generated/app-monorepo-testid-index.json');
const UI_MAP_PATH = resolve(ROOT, 'shared/ui-map.json');

const DOM_PLATFORMS = new Set(['desktop', 'web', 'ext']);
const NATIVE_PLATFORMS = new Set(['android', 'ios']);

let _cache = null;

function loadAll() {
  if (_cache) return _cache;
  const semantic = JSON.parse(readFileSync(SEMANTIC_PATH, 'utf8'));
  const testidIndex = JSON.parse(readFileSync(TESTID_INDEX_PATH, 'utf8'));
  const uiMap = JSON.parse(readFileSync(UI_MAP_PATH, 'utf8'));

  // Build a raw-testID → semantic-name reverse index for fast lookup
  const semanticByTestId = {};
  for (const [name, entry] of Object.entries(semantic.elements || {})) {
    if (entry.source_testid) semanticByTestId[entry.source_testid] = { name, entry };
  }

  _cache = { semantic, testidIndex, uiMap, semanticByTestId };
  return _cache;
}

/**
 * Convert a raw testID to a platform-specific selector.
 * The raw testID is what React Native source code writes; each platform
 * surfaces it differently.
 */
export function selectorForPlatform(rawTestId, platform) {
  if (!rawTestId) return null;
  if (DOM_PLATFORMS.has(platform)) {
    return `[data-testid="${rawTestId}"]`;
  }
  if (platform === 'android') {
    // RN testID becomes resource-id (with package prefix in some builds) OR
    // content-desc. Both fallbacks are common — return both as hints.
    return {
      resourceId: rawTestId,                          // exact match
      resourceIdEndsWith: `:id/${rawTestId}`,         // package-prefixed
      contentDesc: rawTestId,                          // some RN versions
    };
  }
  if (platform === 'ios') {
    return { accessibilityId: rawTestId };
  }
  throw new Error(`Unknown platform: ${platform}`);
}

/**
 * Look up an element by semantic name or raw testID.
 *
 * @param {string} query - semantic name (e.g. "address_book.add_button") OR raw testID (e.g. "address-book-add-icon")
 * @param {string} platform - desktop | web | ext | android | ios
 * @returns lookup result with found/source/selector/suggestions
 */
export function lookupTestId(query, platform) {
  if (!query) return { found: false, source: null, source_testid: null, selector: null, suggestions: [] };
  if (!DOM_PLATFORMS.has(platform) && !NATIVE_PLATFORMS.has(platform)) {
    throw new Error(`Invalid platform: ${platform}`);
  }
  const { semantic, testidIndex, uiMap, semanticByTestId } = loadAll();

  // 1) Semantic map — try direct key, then reverse lookup by source_testid
  let semHit = null;
  const semDirect = semantic.elements?.[query];
  if (semDirect) {
    semHit = formatHit('semantic', query, semDirect, platform, semDirect.source_testid);
  } else {
    const semByRaw = semanticByTestId[query];
    if (semByRaw) semHit = formatHit('semantic', semByRaw.name, semByRaw.entry, platform, query);
  }
  // If semantic supports this platform, return immediately.
  if (semHit?.found) return semHit;

  // 2) testID index (raw scan from app-monorepo source).
  // RN testIDs live in the cross-platform source tree, so a hit here implies
  // all platforms inherit it by default — but we mark `platform_unverified`
  // when semantic-map explicitly restricted the platform list.
  const rawId = semHit?.source_testid || query;
  const idxEntry = testidIndex.testIds?.[rawId];
  if (idxEntry) {
    if (semHit) {
      return {
        ...semHit,
        found: true,
        platform_unverified: true,
        verification_note: `Source file confirms RN testID exists, but semantic-map only verified for: ${semHit.platforms.join(', ')}. Verify on ${platform} before relying on this in regression.`,
      };
    }
    return {
      found: true,
      source: 'testid-index',
      source_testid: rawId,
      semantic_name: null,
      selector: selectorForPlatform(rawId, platform),
      metadata: {
        occurrences: idxEntry.occurrences,
        files: idxEntry.files,
        attributes: idxEntry.attributes,
      },
      platforms: ['desktop', 'web', 'ext', 'android', 'ios'],
      suggestions: [],
    };
  }

  // 3) ui-map (legacy / runtime-discovered) — only DOM platforms
  if (DOM_PLATFORMS.has(platform)) {
    const ui = uiMap.elements?.[query];
    if (ui?.primary) {
      return {
        found: true,
        source: 'ui-map',
        source_testid: null,
        semantic_name: query,
        selector: ui.primary,
        metadata: { fallbacks: ui.quick_fallbacks || [], deep: ui.deep_search },
        platforms: ['desktop', 'web', 'ext'],
        suggestions: [],
      };
    }
  }

  // 4) Miss — return fuzzy suggestions for the user
  return {
    found: false,
    source: null,
    source_testid: null,
    selector: null,
    suggestions: fuzzySuggest(query, { semantic, testidIndex, uiMap }, 5),
  };
}

function formatHit(source, semName, entry, platform, rawTestId) {
  const supportedPlatforms = entry.platform || ['desktop', 'web', 'ext', 'android', 'ios'];
  const platformOk = supportedPlatforms.includes(platform);

  return {
    found: platformOk,
    source,
    source_testid: rawTestId,
    semantic_name: semName,
    selector: rawTestId ? selectorForPlatform(rawTestId, platform) : entry.primary,
    metadata: {
      page: entry.page,
      feature: entry.feature,
      source_repo: entry.source,
    },
    platforms: supportedPlatforms,
    suggestions: platformOk ? [] : [`Element exists but does not declare support for "${platform}". Supported: ${supportedPlatforms.join(', ')}`],
  };
}

function fuzzySuggest(query, { semantic, testidIndex }, limit) {
  const q = query.toLowerCase().replace(/[._-]/g, '');
  const candidates = [];

  for (const name of Object.keys(semantic.elements || {})) {
    const normalized = name.toLowerCase().replace(/[._-]/g, '');
    if (normalized.includes(q) || q.includes(normalized)) {
      candidates.push({ name, source: 'semantic' });
    }
  }
  for (const id of Object.keys(testidIndex.testIds || {})) {
    const normalized = id.toLowerCase().replace(/[._-]/g, '');
    if (normalized.includes(q) || q.includes(normalized)) {
      candidates.push({ name: id, source: 'testid-index' });
    }
  }
  return candidates.slice(0, limit);
}

/**
 * Preflight check — given a list of elements a test case wants to use,
 * report what is already covered vs what needs recording.
 *
 * @param {Array<string|{name:string, required?:boolean}>} elements
 * @param {string} platform
 * @returns { hits, misses, hitRate, needsRecording }
 */
export function preflight(elements, platform) {
  const normalized = elements.map(e => typeof e === 'string' ? { name: e, required: true } : e);
  const hits = [];
  const misses = [];

  for (const el of normalized) {
    const r = lookupTestId(el.name, platform);
    if (r.found) {
      hits.push({ name: el.name, source: r.source, source_testid: r.source_testid, selector: r.selector });
    } else {
      misses.push({ name: el.name, required: el.required !== false, suggestions: r.suggestions });
    }
  }

  const requiredCount = normalized.filter(e => e.required !== false).length;
  const hitRate = normalized.length ? hits.length / normalized.length : 0;
  const needsRecording = misses.some(m => m.required);

  return { platform, hits, misses, hitRate, needsRecording, requiredCount };
}

// CLI mode: node lookup-testid.mjs <platform> <name1> [name2] ...
const isMain = process.argv[1] && process.argv[1].endsWith('lookup-testid.mjs');
if (isMain) {
  const [, , platform, ...names] = process.argv;
  if (!platform || !names.length) {
    console.error('Usage: node lookup-testid.mjs <desktop|web|ext|android|ios> <name1> [name2] ...');
    process.exit(1);
  }
  const report = preflight(names, platform);
  console.log(JSON.stringify(report, null, 2));
}
