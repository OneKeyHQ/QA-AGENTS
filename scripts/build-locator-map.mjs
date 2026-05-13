// Build shared/ui-semantic-map.json from shared/locators/<module>.json files.
//
// Module files are the source of truth. The merged map is what runtime tools
// (lookupTestId, Dashboard executor, ui-registry) read.
//
// Run: node scripts/build-locator-map.mjs
//      node scripts/build-locator-map.mjs --check    (CI: fail if drift)

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const LOCATORS_DIR = resolve(ROOT, 'shared/locators');
const OUTPUT_PATH = resolve(ROOT, 'shared/ui-semantic-map.json');

function merge() {
  const files = readdirSync(LOCATORS_DIR).filter(f => f.endsWith('.json')).sort();
  const elements = {};
  const conflicts = [];

  for (const file of files) {
    const data = JSON.parse(readFileSync(resolve(LOCATORS_DIR, file), 'utf8'));
    if (!data.elements) continue;
    for (const [name, entry] of Object.entries(data.elements)) {
      if (elements[name]) {
        conflicts.push({ name, files: [elements[name].__source_file, file] });
      }
      elements[name] = { ...entry, __source_file: file };
    }
  }

  if (conflicts.length) {
    console.error('Duplicate element names across module files:');
    for (const c of conflicts) console.error(`  ${c.name} in ${c.files.join(', ')}`);
    process.exit(1);
  }

  // Strip __source_file before output (it's just internal tracking)
  for (const e of Object.values(elements)) delete e.__source_file;

  const output = {
    version: '1.2.0',
    lastUpdated: new Date().toISOString(),
    description: 'Generated from shared/locators/*.json. Edit module files, not this one. Run scripts/build-locator-map.mjs to rebuild.',
    elements,
  };
  return { output, fileCount: files.length, elemCount: Object.keys(elements).length };
}

const args = process.argv.slice(2);
const isCheck = args.includes('--check');

const { output, fileCount, elemCount } = merge();
const serialized = JSON.stringify(output, null, 2) + '\n';

if (isCheck) {
  const existing = existsSync(OUTPUT_PATH) ? readFileSync(OUTPUT_PATH, 'utf8') : '';
  // Compare ignoring lastUpdated which changes every run
  const stripStamp = (s) => s.replace(/"lastUpdated":\s*"[^"]+"/, '"lastUpdated":"X"');
  if (stripStamp(existing) !== stripStamp(serialized)) {
    console.error('FAIL ui-semantic-map.json is out of date. Run: node scripts/build-locator-map.mjs');
    process.exit(2);
  }
  console.log(`OK   ${fileCount} modules → ${elemCount} elements (in sync)`);
} else {
  writeFileSync(OUTPUT_PATH, serialized);
  console.log(`OK   wrote ${fileCount} modules → ${elemCount} elements → ${OUTPUT_PATH}`);
}
