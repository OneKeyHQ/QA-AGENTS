// src/dashboard/test-registry.ts
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const TESTS_DIR = join(import.meta.dirname, '..', 'tests');

interface TestCase {
  id: string;
  name: string;
}

interface TestGroup {
  file: string;       // relative path from src/tests/, e.g. "perps/favorites.test.mjs"
  group: string;      // display name, e.g. "Favorites"
  category: string;   // top-level directory, e.g. "Perps"
  platform: string;   // 'desktop' | 'android'
  cases: TestCase[];
}

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
      const mod = await import(pathToFileURL(file).href);
      if (!mod.testCases || !Array.isArray(mod.testCases)) continue;

      const rel = relative(TESTS_DIR, file);
      const parts = rel.replace(/\.test\.mjs$/, '').split('/');
      const platform = parts[0] === 'android' ? 'android' : 'desktop';

      // Normalize path: "{platform}/{module}/{feature}"
      // Example: "desktop/perps/favorites" → category: "Perps", group: "Favorites"
      // Example: "desktop/settings/theme-switch" → category: "Settings", group: "Theme Switch"
      const moduleSeg = parts[0] === 'desktop' || parts[0] === 'android' ? parts[1] : parts[0];
      const featureSeg = parts[0] === 'desktop' || parts[0] === 'android' ? parts[2] : parts[1];

      const category = moduleSeg ? capitalize(moduleSeg) : 'Other';
      const group = featureSeg ? titleizeSegment(featureSeg) : category;

      groups.push({
        file: rel,
        group,
        category,
        platform,
        cases: mod.testCases.map((c: any) => ({ id: c.id, name: c.name })),
      });
    } catch (e) {
      console.error(`[registry] Failed to load ${file}:`, (e as Error).message);
    }
  }

  return groups.sort((a, b) => a.file.localeCompare(b.file));
}
