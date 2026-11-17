import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

async function executorFixture(cases, fileRun) {
  const file = new URL('../../../../dashboard/test-executor.ts', import.meta.url);
  const nodeRequire = createRequire(import.meta.url);
  const pages = { desktop: { url: () => 'file:///perps' }, web: { url: () => 'https://app.onekeytest.com/perps' }, extension: { url: () => 'chrome-extension://' + 'a'.repeat(32) + '/x' } };
  const connected = [];
  const source = readFileSync(file, 'utf8').replaceAll('import.meta.dirname', JSON.stringify(dirname(fileURLToPath(file))));
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const policies = await import('../../../helpers/execution-policy.mjs').catch(() => ({}));
  const platform = await import('../../../helpers/platform-session.mjs').catch(() => ({}));
  const exports = {};
  vm.runInNewContext(output, {
    module: { exports }, exports, console, setInterval, clearInterval, Date,
    require: name => {
      if (name.includes('helpers/platform-session.mjs')) return { ...platform, connectPlatform: async p => { connected.push(p); return { page: pages[p] }; } };
      if (name.includes('helpers/execution-policy.mjs')) return policies;
      if (name.includes('helpers/index.mjs')) return { connectCDP: async () => { connected.push('desktop'); return { page: pages.desktop }; }, unlockWalletIfNeeded: async () => {} };
      if (name.includes('.test.mjs')) return { setup: async () => {}, testCases: cases, run: fileRun };
      return nodeRequire(name);
    },
  });
  return { executor: exports, connected, pages };
}
async function run(executor, ids, file) {
  const done = new Promise(resolve => {
    const unsubscribe = executor.onEvent(event => { if (['done', 'stopped'].includes(event.event)) { unsubscribe(); resolve(event); } });
  });
  await executor.startRun(ids, [{ file, cases: ids.map(id => ({ id, name: id })) }]);
  await done;
  return executor.getState();
}
test('F01 Dashboard 的 Web 用例获得 Web page，绝不初始化 Desktop', async () => {
  let received;
  const fixture = await executorFixture([{ id: 'WEB-TEST', fn: async page => { received = page.url(); return { status: 'passed' }; } }]);
  await run(fixture.executor, ['WEB-TEST'], 'web/perps/fixture.test.mjs');
  assert.equal(received, fixture.pages.web.url());
  assert.deepEqual(fixture.connected, ['web']);
});
test('F06 Dashboard 恢复失败后不调用下一用例，并标出未执行原因', async () => {
  let nextCalled = false;
  const fixture = await executorFixture([
    { id: 'FIRST', fn: async () => ({ status: 'failed', fatalRestore: true, steps: [{ name: '恢复用户输入', status: 'failed', detail: 'fixture' }] }) },
    { id: 'SECOND', fn: async () => { nextCalled = true; return { status: 'passed' }; } },
  ]);
  const state = await run(fixture.executor, ['FIRST', 'SECOND'], 'desktop/perps/fixture.test.mjs');
  assert.equal(nextCalled, false);
  assert.equal(state.queue[1].status, 'skipped');
  assert.match(state.queue[1].error, /恢复/);
});

test('F06 Dashboard 仅导出 run 的兼容入口也必须在恢复失败后停止', async () => {
  let calls = 0;
  const fixture = await executorFixture([], async () => { calls++; return { status: 'failed', fatalRestore: true }; });
  const state = await run(fixture.executor, ['FIRST', 'SECOND'], 'desktop/perps/fixture.test.mjs');
  assert.equal(calls, 1);
  assert.equal(state.queue[1].status, 'skipped');
  assert.match(state.queue[1].error, /恢复/);
});

test('Dashboard preserves incomplete row evidence without counting a complete pass', async () => {
  const rows = [{ ids: ['fixture-row'], status: 'passed', detail: 'one direction', complete: false, missing: 'other direction' }];
  const fixture = await executorFixture([{ id: 'PARTIAL', fn: async () => ({ status: 'skipped', partial: true, error: 'incomplete', rowResults: rows }) }]);
  const state = await run(fixture.executor, ['PARTIAL'], 'desktop/perps/fixture.test.mjs');
  assert.equal(state.queue[0].status, 'skipped');
  assert.equal(state.queue[0].partial, true);
  assert.equal(state.queue[0].error, 'incomplete');
  assert.deepEqual(state.queue[0].rowResults, rows);
});
