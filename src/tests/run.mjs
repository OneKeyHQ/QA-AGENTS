#!/usr/bin/env node
// CLI runner for standalone test modules
// Usage:
//   node src/tests/run.mjs                          # list available tests
//   node src/tests/run.mjs desktop/settings/language-switch  # run specific test
//   node src/tests/run.mjs desktop/settings                  # run all tests in a feature folder

import { resolve, relative } from 'node:path';
import { glob } from 'node:fs';
import { promisify } from 'node:util';

const globAsync = promisify(glob);
const TESTS_DIR = import.meta.dirname;
const PROJECT_ROOT = resolve(TESTS_DIR, '../..');

async function discoverTests() {
  // Platform-first structure: only discover runnable desktop CDP tests here.
  // Android scripts (Midscene/ADB) are executed via their own entrypoints.
  const pattern = resolve(TESTS_DIR, 'desktop/**/*.test.mjs');
  const files = await globAsync(pattern);
  return files.map(f => {
    const rel = relative(TESTS_DIR, f);
    const name = rel.replace(/\.test\.mjs$/, '');
    return { name, path: f };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

async function runTest(test) {
  console.log(`\n  Running: ${test.name}`);
  console.log('  ' + '─'.repeat(40));
  const mod = await import(test.path);
  if (typeof mod.run !== 'function') {
    console.error(`  ✗ ${test.name}: no run() export found`);
    return { name: test.name, status: 'error', error: 'no run() export' };
  }
  const result = await mod.run();
  return { name: test.name, ...result };
}

async function main() {
  const filter = process.argv[2];
  const tests = await discoverTests();

  if (!filter) {
    console.log('\n  Available tests:');
    console.log('  ' + '─'.repeat(40));
    for (const t of tests) {
      console.log(`    ${t.name}`);
    }
    console.log(`\n  Usage: node src/tests/run.mjs <test-name>`);
    console.log('  Example: node src/tests/run.mjs desktop/settings/language-switch\n');
    return;
  }

  // Match by exact name or by feature folder prefix
  const matched = tests.filter(t =>
    t.name === filter || t.name.startsWith(filter + '/')
  );

  if (matched.length === 0) {
    console.error(`\n  ✗ No tests matching "${filter}"\n`);
    console.log('  Available:');
    for (const t of tests) console.log(`    ${t.name}`);
    process.exit(1);
  }

  console.log(`\n══════════════════════════════════════════`);
  console.log(`  Test Runner — ${matched.length} test(s) to run`);
  console.log(`══════════════════════════════════════════`);

  const results = [];
  for (const test of matched) {
    results.push(await runTest(test));
  }

  // Summary
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;

  console.log(`\n══════════════════════════════════════════`);
  console.log(`  Summary: ${passed} passed, ${failed} failed (${results.length} total)`);
  console.log(`══════════════════════════════════════════\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(`  ✗ Runner error: ${err.message}`);
  process.exit(1);
});
