import assert from 'node:assert/strict';
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const name = 'onekey-pr-preview-qa';
const canonical = join(root, '.agents/skills', name);
const mirror = join(root, '.claude/skills', name);
const cursor = join(root, '.cursor/rules', `${name}.mdc`);

function files(directory, prefix = '') {
  return readdirSync(directory).sort().flatMap(name => {
    const relative = join(prefix, name);
    return statSync(join(directory, name)).isDirectory()
      ? files(join(directory, name), relative) : [relative];
  });
}

function readEntry(path, isCursor = false) {
  const text = readFileSync(path, 'utf8');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  assert(match, `Missing frontmatter: ${path}`);
  const metadata = YAML.parse(match[1]);
  assert(metadata.description.includes('pr + 预览测试'), `Trigger missing: ${path}`);
  if (isCursor) assert.equal(metadata.alwaysApply, false);
  else assert.equal(metadata.name, name);
  return match[2].replaceAll(`../../.agents/skills/${name}/references/`, 'references/');
}

const relativeFiles = files(canonical);
assert.deepEqual(relativeFiles, files(mirror), 'Mirror resource inventory differs');
for (const path of relativeFiles) {
  const original = readFileSync(join(canonical, path));
  assert(original.equals(readFileSync(join(mirror, path))), `Mirror differs: ${path}`);
  if (!path.endsWith('.md')) continue;
  const text = original.toString('utf8');
  assert(text.endsWith('\n') && !text.endsWith('\n\n'), `Invalid final newline: ${path}`);
  assert(text.split('\n').every(line => line === line.trimEnd()), `Trailing whitespace: ${path}`);
  for (const [, href] of text.matchAll(/\]\(([^)]+)\)/g)) {
    if (/^(https?:|#)/.test(href)) continue;
    const target = resolve(dirname(join(canonical, path)), href.split('#')[0]);
    assert(statSync(target).isFile(), `Broken reference: ${path} -> ${href}`);
  }
}
assert.equal(readEntry(join(canonical, 'SKILL.md')), readEntry(join(mirror, 'SKILL.md')));
assert.equal(readEntry(join(canonical, 'SKILL.md')), readEntry(cursor, true));
for (const [, href] of readFileSync(cursor, 'utf8').matchAll(/\]\(([^)]+\.md)\)/g)) {
  assert(statSync(resolve(dirname(cursor), href)).isFile(), `Broken Cursor reference: ${href}`);
}
for (const path of ['AGENTS.md', '.cursorrules']) {
  assert.equal(realpathSync(join(root, path)), join(root, '.claude/CLAUDE.md'));
}
console.log(`PASS 三个入口、${relativeFiles.length} 个技能文件及引用路径`);
