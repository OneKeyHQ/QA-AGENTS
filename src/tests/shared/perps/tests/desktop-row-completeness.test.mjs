import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createStepTracker } from '../../../helpers/components.mjs';
import { markRestoreFailure } from '../../../helpers/execution-policy.mjs';

// Execute the production suite, replacing only UI and output dependencies.
// No CDP connection, wallet action, screenshot or report write is possible.
const file = new URL('../desktop-row-suite.mjs', import.meta.url);
const code = ts.transpileModule(readFileSync(file, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;

async function runRows(makeRows) {
  const form = { checkboxes: [] };
  const financial = { account: 'offline-fixture', orders: [] };
  const mocks = {
    'node:assert/strict': assert,
    'node:fs': { mkdirSync() {}, writeFileSync() {} },
    'node:path': { resolve: (...parts) => parts.join('/') },
    '../../helpers/index.mjs': {
      RESULTS_DIR: '/offline-output-disabled',
      unlockWalletIfNeeded: async () => {},
    },
    '../../helpers/components.mjs': {
      createStepTracker,
      safeStep: async (page, tracker, name, action) => {
        try {
          tracker.add(name, 'passed', await action());
          return true;
        } catch (error) {
          tracker.add(name, 'failed', error.message);
          return false;
        }
      },
    },
    '../../helpers/preconditions.mjs': {
      runPreconditions: async () => ({ shouldSkip: () => false }),
    },
    '../../helpers/pages/perps.mjs': {
      PerpsPage: class { async navigate() {} },
    },
    '../../helpers/platform-session.mjs': { assertTargetPage() {} },
    '../../helpers/perps-ui.mjs': {
      favoriteSnapshot: async () => [],
      restoreFavorites: async () => {},
      closePairs: async () => {},
    },
    './selector-preferences.mjs': {
      snapshotSelectorPreferences: async () => ({}),
      restoreSelectorPreferences: async () => {},
    },
    './info-tab.mjs': {
      currentInfoTab: async () => 'positions',
      restoreInfoTab: async () => {},
    },
    '../../helpers/execution-policy.mjs': { markRestoreFailure },
    './order-observation.mjs': {
      snapshotFinancialState: async () => financial,
    },
    './non-order-ui.mjs': {
      snapshotNonOrderForm: async () => form,
      beginFormTransaction() {},
      finishFormTransaction: async () => {},
      closeDialog: async () => {},
      closePop: async () => {},
    },
  };
  const exports = {};
  vm.runInNewContext(code, {
    module: { exports },
    exports,
    console: { log() {} },
    require: name => {
      assert.ok(Object.hasOwn(mocks, name), `Unmocked import: ${name}`);
      return mocks[name];
    },
  }, { filename: file.pathname });
  const suite = exports.createDesktopRowSuite([{
    id: 'OFFLINE-COMPLETENESS-001',
    name: 'Offline completeness fixture',
    rows: makeRows(exports.SampleUnavailable),
  }]);
  return suite.testCases[0].fn({ setDefaultTimeout() {} });
}

const passedRow = (id, extra = {}) => ({
  ids: [id],
  name: id,
  check: async () => 'verified fixture',
  ...extra,
});
const unavailableRow = SampleUnavailable => ({
  ids: ['missing-sample'],
  name: 'missing-sample',
  check: async () => { throw new SampleUnavailable('existing sample unavailable'); },
});

test('single incomplete row cannot count as a complete suite pass', async () => {
  const result = await runRows(() => [passedRow('one-direction', {
    complete: false,
    missing: 'opposite position direction remains unverified',
  })]);
  assert.equal(result.status, 'skipped');
  assert.equal(result.summary.failed, 0);
  assert.equal(result.rowResults[0].complete, false);
  assert.match(result.rowResults[0].missing, /opposite position/);
});

test('passed and SampleUnavailable rows produce an incomplete suite', async () => {
  const result = await runRows(SampleUnavailable => [
    passedRow('available-sample'),
    unavailableRow(SampleUnavailable),
  ]);
  assert.equal(result.status, 'skipped');
  assert.equal(result.summary.failed, 0);
  assert.equal(result.summary.skipped, 1);
  assert.deepEqual(Array.from(result.rowResults, row => row.status), ['passed', 'skipped']);
  assert.match(result.rowResults[1].detail, /sample unavailable/);
});

test('all complete verified rows retain a passing suite result', async () => {
  const result = await runRows(() => [passedRow('first'), passedRow('second')]);
  assert.equal(result.status, 'passed');
  assert.equal(result.summary.failed, 0);
  assert.equal(result.summary.skipped, 0);
  assert.deepEqual(Array.from(result.rowResults, row => [row.status, row.complete]), [
    ['passed', true],
    ['passed', true],
  ]);
});

test('an assertion failure takes precedence over incomplete and missing rows', async () => {
  const result = await runRows(SampleUnavailable => [
    passedRow('partial', { complete: false, missing: 'unverified branch' }),
    unavailableRow(SampleUnavailable),
    passedRow('failed-assertion', {
      check: async () => { throw Error('independent expected value mismatch'); },
    }),
  ]);
  assert.equal(result.status, 'failed');
  assert.equal(result.summary.failed, 1);
  assert.equal(result.summary.skipped, 1);
  assert.deepEqual(Array.from(result.rowResults, row => row.status), ['passed', 'skipped', 'failed']);
  assert.ok(result.errors.some(error => error.includes('independent expected value mismatch')));
});
