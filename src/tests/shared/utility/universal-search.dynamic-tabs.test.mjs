import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyDynamicTabExpectation } from './universal-search.mjs';

test('dynamic search tab hidden is not a failure when modal has a valid search state', () => {
  const result = classifyDynamicTabExpectation({
    targetTab: '账户',
    availableTabs: ['全部', '市场'],
    modalState: 'results',
  });

  assert.equal(result.status, 'hidden');
  assert.equal(result.stepStatus, 'skipped');
  assert.match(result.detail, /动态隐藏/);
});

test('dynamic search tab hidden is a failure when modal state is unknown', () => {
  const result = classifyDynamicTabExpectation({
    targetTab: '设置',
    availableTabs: ['全部'],
    modalState: 'unknown',
  });

  assert.equal(result.status, 'invalid');
  assert.equal(result.stepStatus, 'failed');
});

test('visible dynamic search tab keeps normal assertions active', () => {
  const result = classifyDynamicTabExpectation({
    targetTab: 'dApps',
    availableTabs: ['全部', 'dApps'],
    modalState: 'results',
  });

  assert.equal(result.status, 'visible');
  assert.equal(result.stepStatus, 'passed');
});
