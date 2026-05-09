// src/dashboard/test-registry.ts
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const TESTS_DIR = join(import.meta.dirname, '..', 'tests');

interface TestCase {
  id: string;
  name: string;
  skipSteps?: string[];  // Steps that will be skipped (shown before execution)
}

interface TestGroup {
  file: string;       // relative path from src/tests/, e.g. "perps/favorites.test.mjs"
  group: string;      // display name (Chinese), e.g. "收藏"
  category: string;   // top-level directory (Chinese), e.g. "合约"
  platform: string;   // 'desktop' | 'web' | 'extension' (mobile uses a separate framework — see docs/skills/android-recorder/)
  cases: TestCase[];
}

// Chinese display labels for module + feature kebab-case slugs.
// Frontend renders these directly; missing keys fall back to titleized English.
// New tests: add a slug here — keep keys lowercase kebab.
const ZH_LABELS: Record<string, string> = {
  // Top-level modules (categories)
  market: '市场',
  perps: '合约',
  referral: '返佣',
  settings: '设置',
  swap: '兑换',
  transfer: '转账',
  utility: '通用',
  wallet: '钱包',

  // Feature groups (file slug)
  'chart': '图表',
  'favorite': '收藏',
  'favorites': '收藏',
  'home': '首页',
  'search': '搜索',
  'token-search': '代币搜索',
  'portfolio': '投资组合',
  'bind-invite-code': '绑定邀请码',
  'currency-switch': '币种切换',
  'language-switch': '语言切换',
  'theme-switch': '主题切换',
  'cosmos': 'Cosmos',
  '0x-polygon': '0x Polygon',
  'address-book-add': '地址簿添加',
  'address-book-validation': '地址簿验证',
  'universal-search': '通用搜索',
  'create-mnemonic': '创建助记词',
  'receive-from-exchange': '从交易所接收',
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function titleizeSegment(seg: string) {
  // "token-search" -> "Token Search"
  return seg
    .split('-')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function zhOrFallback(slug: string, fallback: string): string {
  return ZH_LABELS[slug] || fallback;
}

// Track slugs that fell back to English so we can warn the user once per scan.
const _missingZhWarned = new Set<string>();
function warnMissingZh(scope: 'category' | 'group', slug: string, fallback: string) {
  const key = `${scope}:${slug}`;
  if (_missingZhWarned.has(key)) return;
  _missingZhWarned.add(key);
  if (scope === 'group') {
    console.warn(`[registry] No Chinese name for ${scope} "${slug}". Using "${fallback}". Add `
      + `export const displayName = '中文名';\n  to the test file, or extend ZH_LABELS.`);
  } else {
    console.warn(`[registry] No Chinese name for ${scope} "${slug}". Using "${fallback}". Add to ZH_LABELS in test-registry.ts.`);
  }
}

function findTestFiles(dir: string, base: string = dir): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // Skip android directory — those tests use ADB, not CDP
      const rel = relative(base, full);
      if (rel === 'android') continue;
      results.push(...findTestFiles(full, base));
    } else if (entry.endsWith('.test.mjs')) {
      results.push(full);
    }
  }
  return results;
}

export async function getTestRegistry(): Promise<TestGroup[]> {
  const files = findTestFiles(TESTS_DIR, TESTS_DIR);
  const groups: TestGroup[] = [];

  for (const file of files) {
    try {
      const mod = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
      if (!mod.testCases || !Array.isArray(mod.testCases)) continue;

      const rel = relative(TESTS_DIR, file);
      const parts = rel.replace(/\.test\.mjs$/, '').split('/');
      const knownPlatforms = ['desktop', 'web', 'extension'];
      const platform = knownPlatforms.includes(parts[0]) ? parts[0] : 'desktop';

      // Normalize path: "{platform}/{module}/{feature}"
      // Example: "desktop/perps/favorites" → category: "Perps", group: "Favorites"
      // Example: "web/market/chart" → category: "Market", group: "Chart"
      const isPlatformDir = knownPlatforms.includes(parts[0]);
      const moduleSeg = isPlatformDir ? parts[1] : parts[0];
      const featureSeg = isPlatformDir ? parts[2] : parts[1];

      // Resolution priority for category / group display names:
      //   1. mod.categoryTitle / mod.displayName  (test file owns its own name — preferred for new tests)
      //   2. ZH_LABELS[slug]                      (centralized fallback for legacy/shared slugs)
      //   3. titleized English                    (last resort + console warn)
      const moduleFallback = moduleSeg ? capitalize(moduleSeg) : 'Other';
      const featureFallback = featureSeg ? titleizeSegment(featureSeg) : (moduleFallback);

      let category: string;
      if (typeof mod.categoryTitle === 'string' && mod.categoryTitle.trim()) {
        category = mod.categoryTitle.trim();
      } else if (moduleSeg && ZH_LABELS[moduleSeg]) {
        category = ZH_LABELS[moduleSeg];
      } else {
        category = moduleFallback;
        if (moduleSeg) warnMissingZh('category', moduleSeg, moduleFallback);
      }

      let group: string;
      if (typeof mod.displayName === 'string' && mod.displayName.trim()) {
        group = mod.displayName.trim();
      } else if (featureSeg && ZH_LABELS[featureSeg]) {
        group = ZH_LABELS[featureSeg];
      } else {
        group = featureFallback;
        if (featureSeg) warnMissingZh('group', featureSeg, featureFallback);
      }

      groups.push({
        file: rel,
        group,
        category,
        platform,
        cases: mod.testCases.map((c: any) => ({
          id: c.id,
          name: c.name,
          ...(c.skipSteps?.length > 0 ? { skipSteps: c.skipSteps } : {}),
        })),
      });
    } catch (e) {
      console.error(`[registry] Failed to load ${file}:`, (e as Error).message);
    }
  }

  return groups.sort((a, b) => a.file.localeCompare(b.file));
}
