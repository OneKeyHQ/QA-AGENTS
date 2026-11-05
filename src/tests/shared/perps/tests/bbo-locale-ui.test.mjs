import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { markRestoreFailure } from '../../../helpers/execution-policy.mjs';

// Execute the real BBO row and its assertions. Only external App I/O is replaced.
const code = ts.transpileModule(readFileSync(new URL('../desktop-bbo-boundaries.mjs', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const zh = ['对手价 1', '对手价 5', '同向价 1', '同向价 5'];
const en = ['Counterparty 1', 'Counterparty 5', 'Queue 1', 'Queue 5'];
class SampleUnavailable extends Error {}
function fixture({ english = en, initialLocale = 'zh-CN', wrongCheck = false, wrongMode = false, failRestore = false } = {}) {
  let locale = initialLocale, active = false, selected = '', opened = false, changes = 0;
  const actual = () => locale === 'en' ? english : zh;
  const menu = {
    async innerText() { return actual().join('\n'); },
    getByText(label) { return {
      async waitFor() { assert.ok(actual().includes(label)); },
      async click() { selected = label; opened = false; },
    }; },
    locator() { return { async evaluateAll(fn) {
      return fn([{ parentElement: { innerText: wrongCheck && locale === 'en' ? 'Queue 5' : selected } }]);
    } }; },
    async waitFor({ state }) { assert.equal(opened, state === 'visible'); },
  };
  const trigger = {
    async count() { return active ? 1 : 0; },
    async click() { opened = true; },
    async innerText() { return selected; },
  };
  const form = { getByText() { return { async click() {} }; } };
  const mocks = {
    'node:assert/strict': assert,
    '../../helpers/perps-ui.mjs': {
      locator: (p, key) => {
        if (key === 'perps.form.bbo_selector') return trigger;
        if (key === 'perps.overlay.popover') return menu;
        if (key === 'perps.form.root') return form;
        if (key === 'perps.perp-bbo-toggle-button') return { async click() {
          active = !active;
          if (active) selected = actual()[0];
        } };
        throw Error(`Unexpected UI action: ${key}`);
      },
      restorePair: async () => {},
    },
    './non-order-ui.mjs': {
      closePop: async () => { opened = false; },
      pollForm: async (read, ready) => { const value = await read(); assert.ok(ready(value)); return value; },
    },
    './desktop-row-suite.mjs': { createDesktopRowSuite: definitions => definitions, SampleUnavailable },
    './react-projection.mjs': {},
    './bbo-price-evidence.mjs': {},
    './desktop-bbo-preview.mjs': { readBboForm: async () => {
      const states = [
        { type: 'counterparty', offsetTicks: 0 }, { type: 'counterparty', offsetTicks: 5 },
        { type: 'queue', offsetTicks: 0 }, { type: 'queue', offsetTicks: 5 },
      ];
      const index = actual().indexOf(selected);
      return { instrument: { mode: 'perp', coin: 'BTC' }, form: {
        type: 'limit', bboPriceMode: states[wrongMode && locale === 'en' ? 3 : index],
      } };
    } },
    './language-settings.mjs': {
      openLanguage: async () => ({ rawLocale: locale }),
      changeLocale: async (p, next) => {
        changes++;
        if (failRestore && changes >= 3) throw Error('restore locale failed');
        locale = next; active = false; opened = false;
      },
    },
    './runtime.mjs': { markRestoreFailure, reloadPerps: async () => {} },
    '../../helpers/index.mjs': { unlockWalletIfNeeded: async () => {} },
  };
  const exports = {};
  vm.runInThisContext(`(function(exports, module, require) {${code}\n})`)(exports, { exports }, key => {
    assert.ok(Object.hasOwn(mocks, key), `Unmocked import ${key}`);
    return mocks[key];
  });
  const row = exports.bboBoundaryDefinitions.flatMap(d => d.rows).find(r => r.ids.includes('D01-20'));
  assert.ok(row, 'Approved language scenario must have an actual executable check');
  return { run: () => row.check({}), locale: () => locale, changes: () => changes };
}

test('actual BBO language row checks four selectable options and restores the original language', async () => {
  const f = fixture();
  await f.run();
  assert.equal(f.locale(), 'zh-CN');
});
test('untranslated, missing, extra and reordered English options fail instead of inflating coverage', async () => {
  for (const english of [
    [en[0], en[1], 'Perps.BBO_Queue', en[3]], en.slice(0, 3),
    [...en, 'extra'], [en[1], en[0], en[2], en[3]],
  ]) {
    const f = fixture({ english });
    await assert.rejects(f.run());
    assert.equal(f.locale(), 'zh-CN', 'Assertion failure must still restore language');
  }
});
test('wrong selection mark fails and restoration failures remain fatal', async () => {
  const wrong = fixture({ wrongCheck: true });
  await assert.rejects(wrong.run());
  assert.equal(wrong.locale(), 'zh-CN');
  const failed = fixture({ failRestore: true });
  await assert.rejects(failed.run(), error => error.fatalRestore === true);
});
test('correct English labels cannot hide a wrong underlying BBO mode', async () => {
  const f = fixture({ wrongMode: true });
  await assert.rejects(f.run(), /corresponding actual BBO mode/);
  assert.equal(f.locale(), 'zh-CN');
});

test('English baselines are restored and unsupported languages are left unchanged', async () => {
  const english = fixture({ initialLocale: 'en' });
  await english.run();
  assert.equal(english.locale(), 'en');
  const unsupported = fixture({ initialLocale: 'ja' });
  await assert.rejects(unsupported.run(), SampleUnavailable);
  assert.equal(unsupported.locale(), 'ja');
  assert.equal(unsupported.changes(), 0);
});
