import test from 'node:test';
import assert from 'node:assert/strict';
import { createStepTracker, safeStep } from './components.mjs';
import { createTracker } from './preconditions.mjs';

test('partial and empty runs cannot report passed', () => {
  const t = createStepTracker('PERPS-TEST');
  assert.notEqual(t.result().status, 'passed');
  t.add('ready', 'passed', 'ETH selected');
  t.skip('quote comparison', 'No quote sample');
  assert.equal(t.result().status, 'skipped');
  assert.equal(t.result().partial, true);
  t.add('restore', 'failed', 'Expected ETH, got BTC');
  assert.equal(t.result().status, 'failed');
});

test('legacy SKIP detail is not a successful assertion', () => {
  const t = createStepTracker('PERPS-TEST');
  t.add('data', 'passed', 'SKIP: missing position');
  assert.equal(t.result().summary.passed, 0);
  assert.equal(t.result().steps[0].status, 'skipped');
  assert.equal(t.result().status, 'skipped');
});

test('precondition-dependent skipped assertions retain actual evidence', () => {
  const t = createTracker('SEARCH-001', {
    shouldSkip: () => false,
    warnings: [{ message: 'BTC unavailable' }],
  });
  t.add('selector ready', 'passed', 'perps');
  t.add('BTC result', 'failed', 'Expected BTC, got []', { dataKey: 'BTC' });
  assert.equal(t.result().status, 'skipped');
  assert.equal(t.result().steps.length, 2);
  assert.match(t.result().steps[1].detail, /Expected BTC, got/);
});

test('real failure takes precedence over a skipped precondition', () => {
  const t = createTracker('SEARCH-001', { shouldSkip: () => true });
  t.add('restore', 'failed', 'Restore mismatch');
  assert.equal(t.result().status, 'failed');
});

test('screenshot failure cannot replace assertion failure or lose stack', async () => {
  const t = createStepTracker('PERPS-TEST');
  const error = new assert.AssertionError({ message: 'Expected ETH, got BTC' });
  const ok = await safeStep({}, t, 'market', async () => { throw error; }, async () => {
    throw Error('Screenshot unavailable');
  });
  assert.equal(ok, false);
  const step = t.result().steps[0];
  assert.match(step.stack, /AssertionError/);
  assert.match(step.detail, /Expected ETH, got BTC/);
  assert.match(step.evidenceError, /Screenshot unavailable/);
});

test('module summaries preserve skipped, unexecuted and cleanup boundaries', async () => {
  const policy = await import('./execution-policy.mjs');
  assert.equal(typeof policy.summarizeCaseResults, 'function');
  const mixed = policy.summarizeCaseResults([{status:'passed'}, {status:'skipped'}], 3);
  assert.equal(mixed.status, 'skipped');
  assert.equal(mixed.skipped, 1);
  assert.equal(mixed.notRun, 1);
  assert.equal(mixed.failed, 0);
  assert.equal(policy.summarizeCaseResults([], 0).status, 'skipped');
  assert.equal(policy.summarizeCaseResults([{status:'passed',fatalRestore:true}], 1).status, 'failed');
  assert.equal(policy.summarizeCaseResults([{status:'passed'}], 1).status, 'passed');
});

test('safeStep redacts credential assignments before reporting failure', async () => {
  const t = createStepTracker('PERPS-TEST');
  await safeStep({}, t, 'request', async () => {
    throw Error('authorization: Bearer fixture-credential');
  }, async () => {
    throw Error('walletPassword="fixture phrase"');
  });
  const serialized = JSON.stringify(t.result());
  assert.match(serialized, /\[REDACTED\]/);
  assert.doesNotMatch(serialized, /fixture-credential|fixture phrase/);
});
