#!/usr/bin/env node
// 清理项目产物：录制截图、Android session、tsc 编译产物、MCP 日志、.DS_Store
// 保留：shared/results/*.json（Dashboard/Reporter 数据源）、midscene_run/picks/*.yaml

import { rmSync, existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

function sizeOf(path) {
  if (!existsSync(path)) return '0';
  try {
    return execSync(`du -sh "${path}" 2>/dev/null | cut -f1`).toString().trim();
  } catch {
    return '?';
  }
}

function removeDir(rel) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) return false;
  const before = sizeOf(abs);
  rmSync(abs, { recursive: true, force: true });
  console.log(`  ✓ ${rel} (${before})`);
  return true;
}

function clearChildren(rel) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) return;
  const before = sizeOf(abs);
  for (const entry of readdirSync(abs)) {
    rmSync(join(abs, entry), { recursive: true, force: true });
  }
  console.log(`  ✓ ${rel}/* (${before})`);
}

function deleteByPattern(rel, predicate) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) return 0;
  let count = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (predicate(entry, p)) {
        unlinkSync(p);
        count++;
      }
    }
  };
  walk(abs);
  return count;
}

console.log('🧹 Cleaning project artifacts...\n');

console.log('Removing build artifacts:');
removeDir('dist');

console.log('\nClearing recording outputs:');
removeDir('shared/results/recording');
clearChildren('midscene_run/recordings');

console.log('\nClearing screenshots (PNG only, keeps result JSONs):');
const pngCount = deleteByPattern('shared/results', (name) => name.endsWith('.png'));
console.log(`  ✓ ${pngCount} PNG files removed`);

console.log('\nClearing logs and OS metadata:');
const logCount = deleteByPattern('.playwright-mcp', (name) => name.startsWith('console-') && name.endsWith('.log'));
console.log(`  ✓ ${logCount} MCP console logs removed`);

let dsCount = 0;
const walkDS = (dir) => {
  if (dir.includes('node_modules') || dir.includes('.git')) return;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    try {
      const st = statSync(p);
      if (st.isDirectory()) walkDS(p);
      else if (entry === '.DS_Store') { unlinkSync(p); dsCount++; }
    } catch {}
  }
};
walkDS(ROOT);
console.log(`  ✓ ${dsCount} .DS_Store files removed`);

const jsonCount = deleteByPattern('shared/results', () => false) + readdirSync(join(ROOT, 'shared/results')).filter(f => f.endsWith('.json')).length;
console.log(`\n✅ Done. Preserved ${jsonCount} test result JSONs.`);
