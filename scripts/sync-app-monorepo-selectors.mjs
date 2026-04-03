import { execFileSync } from 'node:child_process';
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

function runGit(appRoot, args) {
  return execFileSync('git', args, {
    cwd: appRoot,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function hasGitRef(appRoot, ref) {
  try {
    runGit(appRoot, ['rev-parse', '--verify', `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function resolveSourceRef(appRoot) {
  const candidates = [
    process.env.APP_MONOREPO_REF,
    'origin/x',
    'x',
  ].filter(Boolean);

  for (const ref of candidates) {
    if (hasGitRef(appRoot, ref)) {
      return ref;
    }
  }

  return null;
}

function shouldKeepFile(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  if (parts.some((part) => SKIP_DIRS.has(part))) {
    return false;
  }
  const ext = normalized.slice(normalized.lastIndexOf('.'));
  return CODE_EXTENSIONS.has(ext);
}

function listFilesFromGitRef(appRoot, ref, scanRoots) {
  const output = runGit(appRoot, ['ls-tree', '-r', '--name-only', ref, '--', ...scanRoots]);
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(shouldKeepFile);
}

function readFileFromGitRef(appRoot, ref, relPath) {
  return execFileSync('git', ['show', `${ref}:${relPath}`], {
    cwd: appRoot,
    encoding: 'utf-8',
    maxBuffer: 20 * 1024 * 1024,
  });
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

function listFilesFromWorkingTree(appRoot, scanRoots) {
  return scanRoots
    .map((segment) => resolve(appRoot, segment))
    .filter((dir) => existsSync(dir))
    .flatMap((dir) => walkFiles(dir).map((filePath) => relative(appRoot, filePath).replace(/\\/g, '/')));
}

function readFileFromWorkingTree(appRoot, relPath) {
  return readFileSync(resolve(appRoot, relPath), 'utf-8');
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
  const scanRoots = ['apps', 'packages'];
  const sourceRef = resolveSourceRef(appRoot);

  let relFiles = [];
  let readContent = null;
  let sourceMode = 'working-tree';

  if (sourceRef) {
    relFiles = listFilesFromGitRef(appRoot, sourceRef, scanRoots);
    readContent = (relPath) => readFileFromGitRef(appRoot, sourceRef, relPath);
    sourceMode = 'git-ref';
  } else {
    relFiles = listFilesFromWorkingTree(appRoot, scanRoots);
    readContent = (relPath) => readFileFromWorkingTree(appRoot, relPath);
  }

  if (relFiles.length === 0) {
    throw new Error(`No scan roots found under ${appRoot}`);
  }

  const entries = new Map();
  let filesScanned = 0;

  for (const relPath of relFiles) {
    filesScanned += 1;
    const content = readContent(relPath);
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

  const sortedEntries = [...entries.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .reduce((acc, entry) => {
      acc[entry.id] = toOutputEntry(entry);
      return acc;
    }, {});

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const payload = {
    version: '1.1.0',
    generatedAt: new Date().toISOString(),
    sourceMode,
    sourceRef,
    scanRoots,
    filesScanned,
    uniqueTestIds: Object.keys(sortedEntries).length,
    testIds: sortedEntries,
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2) + '\n');

  console.log(`Synced ${payload.uniqueTestIds} unique testIDs from ${appRoot}`);
  if (sourceRef) {
    console.log(`Source ref: ${sourceRef}`);
  } else {
    console.log('Source ref: working tree fallback');
  }
  console.log(`Output: ${relative(REPO_ROOT, OUTPUT_FILE)}`);
}

main();
