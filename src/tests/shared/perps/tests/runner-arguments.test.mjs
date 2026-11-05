import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Run the actual CLI with a harmless module instead of connecting to a wallet.
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'perps-runner-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const path of ['src/tests/desktop/perps', 'src/tests/helpers', 'scripts'])
    mkdirSync(join(dir, path), { recursive: true });
  copyFileSync(new URL('../../../run.mjs', import.meta.url), join(dir, 'src/tests/run.mjs'));
  copyFileSync(new URL('../../../helpers/execution-policy.mjs', import.meta.url), join(dir, 'src/tests/helpers/execution-policy.mjs'));
  const executed = join(dir, 'executed');
  const planned = join(dir, 'planned');
  writeFileSync(join(dir, 'src/tests/desktop/perps/sentinel.test.mjs'),
    `import {writeFileSync} from 'node:fs'; export async function run(){writeFileSync(${JSON.stringify(executed)}, 'yes');return {status:'passed'};}`);
  writeFileSync(join(dir, 'scripts/plan-perps-desktop.mjs'),
    `import {writeFileSync} from 'node:fs'; export function main(){writeFileSync(${JSON.stringify(planned)}, 'yes');}`);
  return { executed, planned, run: args => spawnSync(process.execPath,
    [join(dir, 'src/tests/run.mjs'), ...args], { encoding: 'utf8', timeout: 10000 }) };
}

test('obsolete planning flags and unexpected arguments never execute a module', t => {
  const f = fixture(t);
  for (const args of [
    ['desktop/perps', '--plan'],
    ['desktop/perps', '--plan', '--request', 'local.json'],
    ['desktop/perps', '--unexpected'],
    ['desktop/perps', 'extra'],
  ]) {
    const result = f.run(args);
    assert.equal(result.status, 1, JSON.stringify(args));
    assert.match(result.stderr, /Unexpected arguments/);
    assert.equal(existsSync(f.executed), false);
    assert.equal(existsSync(f.planned), false);
  }
});

test('listing remains read-only and a valid exact module still executes', t => {
  const f = fixture(t);
  const listed = f.run([]);
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(listed.stdout, /desktop\/perps\/sentinel/);
  assert.equal(existsSync(f.executed), false);
  const result = f.run(['desktop/perps/sentinel']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(f.executed), true);
});
