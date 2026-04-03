import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const OUTPUT_DIR = resolve(REPO_ROOT, 'shared/generated');
const OUTPUT_FILE = resolve(OUTPUT_DIR, 'app-monorepo-testid-index.json');

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.expo',
]);

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const TEST_ID_PATTERN = /\b(testID|data-testid)\s*=\s*(["'`])([^"'`]+)\2/g;

function resolveAppMonorepoPath() {
  const candidates = [
    process.env.APP_MONOREPO_PATH,
    '/Users/onekey/Documents/Github/app-monorepo',
    '/Users/onekey/.openclaw/workspace/app-monorepo',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return resolve(candidate);
    }
  }

  throw new Error(
    [
      'app-monorepo not found.',
      'Set APP_MONOREPO_PATH or clone app-monorepo to one of:',
      '  - /Users/onekey/Documents/Github/app-monorepo',
      '  - /Users/onekey/.openclaw/workspace/app-monorepo',
    ].join('\n'),
  );
}

function walkFiles(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const fullPath = join(dir, name);
    const st = statSync(fullPath);
    if (st.isDirectory()) {
      walkFiles(fullPath, files);
      continue;
    }
    const ext = name.slice(name.lastIndexOf('.'));
    if (CODE_EXTENSIONS.has(ext)) {
      files.push(fullPath);
    }
  }
  return files;
}

function classifyFeature(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  const hints = [];

  const mappings = [
    ['/views/Home/', 'wallet-home'],
    ['/views/Send/', 'send'],
    ['/views/ChainSelector/', 'chain-selector'],
    ['/components/AccountSelector/', 'account-selector'],
    ['/layouts/Navigation/', 'global-navigation'],
    ['/views/Perp/', 'perps'],
    ['/views/Browser/', 'browser'],
    ['/views/Swap/', 'swap'],
    ['/views/Discovery/', 'discovery'],
    ['/views/Settings/', 'settings'],
    ['/views/OnBoarding/', 'onboarding'],
    ['/views/Me/', 'me'],
    ['/views/AddressBook/', 'address-book'],
    ['/views/Wallets/', 'wallets'],
    ['/views/Assets/', 'assets'],
  ];

  for (const [needle, label] of mappings) {
    if (normalized.includes(needle)) hints.push(label);
  }

  if (normalized.includes('.android.')) hints.push('android');
  if (normalized.includes('.ios.')) hints.push('ios');
  if (normalized.includes('/mobile/')) hints.push('mobile');
  if (normalized.includes('/desktop/')) hints.push('desktop');
  if (normalized.includes('/ext/')) hints.push('extension');

  return [...new Set(hints)];
}

function toOutputEntry(entry) {
  return {
    selector: `[data-testid="${entry.id}"]`,
    occurrences: entry.occurrences,
    attributes: [...entry.attributes].sort(),
    files: [...entry.files].sort(),
    featureHints: [...entry.featureHints].sort(),
  };
}

function main() {
  const appRoot = resolveAppMonorepoPath();
  const scanRoots = ['apps', 'packages']
    .map((segment) => resolve(appRoot, segment))
    .filter((dir) => existsSync(dir));

  if (scanRoots.length === 0) {
    throw new Error(`No scan roots found under ${appRoot}`);
  }

  const entries = new Map();
  let filesScanned = 0;

  for (const root of scanRoots) {
    const files = walkFiles(root);
    for (const filePath of files) {
      filesScanned += 1;
      const relPath = relative(appRoot, filePath).replace(/\\/g, '/');
      const content = readFileSync(filePath, 'utf-8');
      const featureHints = classifyFeature(relPath);

      for (const match of content.matchAll(TEST_ID_PATTERN)) {
        const attribute = match[1];
        const id = match[3].trim();
        if (!id || id.includes('${')) continue;

        const current = entries.get(id) || {
          id,
          occurrences: 0,
          attributes: new Set(),
          files: new Set(),
          featureHints: new Set(),
        };

        current.occurrences += 1;
        current.attributes.add(attribute);
        current.files.add(relPath);
        for (const hint of featureHints) current.featureHints.add(hint);
        entries.set(id, current);
      }
    }
  }

  const sortedEntries = [...entries.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .reduce((acc, entry) => {
      acc[entry.id] = toOutputEntry(entry);
      return acc;
    }, {});

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const payload = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    sourceRoot: appRoot,
    scanRoots: scanRoots.map((dir) => relative(appRoot, dir).replace(/\\/g, '/')),
    filesScanned,
    uniqueTestIds: Object.keys(sortedEntries).length,
    testIds: sortedEntries,
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2) + '\n');
  console.log(`Synced ${payload.uniqueTestIds} unique testIDs from ${appRoot}`);
  console.log(`Output: ${relative(REPO_ROOT, OUTPUT_FILE)}`);
}

main();
