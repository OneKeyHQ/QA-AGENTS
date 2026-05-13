// extend-locators-from-index.mjs
//
// Bulk-add entries to shared/locators/<module>.json from the testid index.
// Classification is by source-file path (most reliable signal). Entries that
// can't be confidently classified are reported and skipped.
//
// Idempotent: skips IDs that are already present in any shared/locators file
// (whether under semantic key or by source_testid).

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const TESTID_INDEX = resolve(ROOT, 'shared/generated/app-monorepo-testid-index.json');
const LOCATORS_DIR = resolve(ROOT, 'shared/locators');

// View directory name → module. PR #10966 organized testIDs by view; the
// view dir is the strongest classification signal. Lowercased keys.
const VIEW_DIR_TO_MODULE = {
  accountmanagerstacks: 'wallet',
  actioncenter: 'global',
  addressbook: 'address-book',
  appupdate: 'settings',
  approvalmanagement: 'wallet',
  approveeditor: 'wallet',
  assetdetails: 'wallet',
  assetlist: 'wallet',
  assetselector: 'wallet',
  borrow: 'defi',
  bulkcopyaddresses: 'wallet',
  bulksend: 'wallet',
  chainselector: 'network-selector',
  cloudbackup: 'settings',
  dappconnection: 'browser',
  developer: 'settings',
  devicemanagement: 'hardware',
  discovery: 'browser',
  earn: 'defi',
  fiatcrypto: 'wallet',
  firmwareupdate: 'hardware',
  home: 'wallet',
  keytag: 'hardware',
  lightningnetwork: 'wallet',
  litecard: 'hardware',
  manualbackup: 'settings',
  market: 'market',
  networkdoctor: 'settings',
  notifications: 'global',
  onboarding: 'onboarding',
  onboardingv2: 'onboarding',
  permission: 'settings',
  perp: 'perps',
  perptrade: 'perps',
  prime: 'prime',
  receive: 'wallet',
  redemption: 'wallet',
  referfriends: 'referral',
  rewardcenter: 'wallet',
  rookieguide: 'global',
  scanqrcode: 'wallet',
  send: 'wallet',
  setting: 'settings',
  signandverifymessage: 'wallet',
  signatureconfirm: 'wallet',
  staking: 'defi',
  swap: 'swap',
  universalsearch: 'global',
  walletaddress: 'wallet',
  webview: 'browser',
};

// Fallback rules for files outside /views/<Name>/ (components, hooks, etc.).
const PATH_RULES = [
  ['prime',            [/\/prime\//]],
  ['referral',         [/referfriends|referral/]],
  ['hardware',         [/\/devicemanagement|\/litecard|\/hardware|\/firmware|\/keytag/]],
  ['onboarding',       [/\/onboarding/]],
  ['swap',             [/\/swap/]],
  ['perps',            [/\/perp/]],
  ['market',           [/\/market/]],
  ['settings',         [/\/setting|\/appupdate|\/cloudbackup|\/manualbackup|\/networkdoctor|\/permission|\/developer/]],
  ['defi',             [/\/earn|\/borrow|\/lending|\/defi|\/staking/]],
  ['address-book',     [/\/addressbook|\/address-book/]],
  ['browser',          [/\/browser|\/discovery|\/discover|\/dappconnection|\/webview/]],
  ['network-selector', [/\/chainselector|\/networkselector|\/network-selector/]],
  ['security',         [/\/password|\/passcode|\/lock|\/biology|\/security/]],
  ['wallet',           [
    /\/wallet|\/account|\/send|\/receive|\/asset|\/tokendetail|\/home|\/airgap|\/sign|\/bulksend|\/createaddress|\/tx|\/approval|\/approve|\/fiatcrypto|\/lightning|\/scanqrcode|\/rewardcenter|\/redemption|\/walletaddress/
  ]],
  ['global',           [
    /\/components\/|\/popup\/|\/layouts\/|\/provider\/|\/header|\/footer|\/modal|\/navigation|\/portal|\/hooks\/|\/actioncenter|\/notifications|\/rookieguide|\/universalsearch/
  ]],
];

function classifyByPath(filePath) {
  const p = filePath.replace(/\\/g, '/').toLowerCase();
  // 1) Strongest signal: file lives under /views/<Name>/
  const viewMatch = p.match(/\/views\/([^/]+)\//);
  if (viewMatch && VIEW_DIR_TO_MODULE[viewMatch[1]]) return VIEW_DIR_TO_MODULE[viewMatch[1]];
  // 2) Fallback to general path patterns
  for (const [mod, patterns] of PATH_RULES) {
    if (patterns.some(re => re.test(p))) return mod;
  }
  return null;
}

// Page hint from file path: keep the immediate parent dir of the file
function pageHintFromPath(filePath) {
  const segs = filePath.split('/');
  const fname = segs.pop() || '';
  // Take the closest "views/Foo" or "pages/Foo" or just parent directory
  for (let i = segs.length - 1; i >= 0; i--) {
    if (['views', 'pages', 'components'].includes(segs[i])) {
      return segs[i + 1] ? segs[i + 1].toLowerCase().replace(/[_\s]/g, '-') : null;
    }
  }
  return segs[segs.length - 1]?.toLowerCase().replace(/[_\s]/g, '-') || null;
}

// Generate a semantic key from raw testID under a module namespace.
// e.g. module=wallet, testID=asset-details-btn → wallet.asset-details-btn
function semanticKey(mod, rawTestId) {
  // strip leading module-related noise if any
  return `${mod}.${rawTestId}`;
}

function loadAllLocators() {
  const byModule = {};
  const seenTestIds = new Set();
  for (const fname of readdirSync(LOCATORS_DIR)) {
    if (!fname.endsWith('.json')) continue;
    const mod = fname.replace(/\.json$/, '');
    const data = JSON.parse(readFileSync(resolve(LOCATORS_DIR, fname), 'utf8'));
    byModule[mod] = data;
    for (const entry of Object.values(data.elements || {})) {
      if (entry.source_testid) seenTestIds.add(entry.source_testid);
    }
  }
  return { byModule, seenTestIds };
}

function main() {
  const idx = JSON.parse(readFileSync(TESTID_INDEX, 'utf8'));
  const { byModule, seenTestIds } = loadAllLocators();

  const skippedExisting = [];
  const skippedUnclassified = [];
  const addedPerModule = {};

  for (const [rawTestId, entry] of Object.entries(idx.testIds || {})) {
    if (seenTestIds.has(rawTestId)) { skippedExisting.push(rawTestId); continue; }

    const firstFile = entry.files?.[0];
    if (!firstFile) { skippedUnclassified.push([rawTestId, '(no file)']); continue; }

    // Skip internal dev pages — these aren't user-facing
    if (/\/testmodal\//i.test(firstFile)) { skippedExisting.push(rawTestId); continue; }

    const mod = classifyByPath(firstFile);
    if (!mod) { skippedUnclassified.push([rawTestId, firstFile]); continue; }

    // Map module name to filename convention (some are kebab-case)
    const fname = mod;
    if (!byModule[fname]) {
      // create a fresh module file
      byModule[fname] = {
        module: fname,
        description: `Locators for ${fname} module. source_testid values come from app-monorepo React Native source and are shared across all platforms.`,
        elements: {},
      };
    }

    const key = semanticKey(fname, rawTestId);
    const page = pageHintFromPath(firstFile);
    byModule[fname].elements[key] = {
      primary: `[data-testid="${rawTestId}"]`,
      source_testid: rawTestId,
      source: 'auto-classified',
      ...(page ? { page } : {}),
      platform: ['desktop', 'web', 'ext', 'android', 'ios'],
      feature: entry.featureHints?.length ? entry.featureHints : [fname],
      __source_file_hint: firstFile,
    };

    addedPerModule[fname] = (addedPerModule[fname] || 0) + 1;
  }

  // Strip the hint field before writing (it's helpful for debugging but not part of schema)
  for (const data of Object.values(byModule)) {
    for (const e of Object.values(data.elements)) delete e.__source_file_hint;
  }

  // Write modified module files
  for (const [fname, data] of Object.entries(byModule)) {
    // Only write if this module had additions OR is a new file
    if (addedPerModule[fname]) {
      const path = resolve(LOCATORS_DIR, `${fname}.json`);
      writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
    }
  }

  console.log('=== Added per module ===');
  for (const [m, c] of Object.entries(addedPerModule).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${m.padEnd(18)} +${c}`);
  }
  console.log(`\nSkipped (already in locators): ${skippedExisting.length}`);
  console.log(`Skipped (unclassified):        ${skippedUnclassified.length}`);
  if (skippedUnclassified.length) {
    console.log('\n=== Unclassified (review needed) ===');
    for (const [tid, fp] of skippedUnclassified.slice(0, 30)) {
      console.log(`  ${tid.padEnd(50)} ${fp.slice(0, 80)}`);
    }
    if (skippedUnclassified.length > 30) {
      console.log(`  ... +${skippedUnclassified.length - 30} more`);
    }
  }
}

main();
