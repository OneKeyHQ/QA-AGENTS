import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { JSDOM, VirtualConsole } from 'jsdom';
import { chartInteractions } from '../chart-interactions.mjs';

// Use the real script builder; only replace the external chart/transport boundary.
function savedDrawingProbe(sources) {
  let script;
  const doc = { defaultView: {
    tradingViewApi: { activeChart: () => ({ symbol: () => 'BTC' }) },
    localStorage: { getItem: key => {
      assert.equal(key, 'tradingview_drawings_perps_btc');
      return JSON.stringify({ sources, timestamp: 123 });
    } },
  } };
  const chart = chartInteractions(async (_page, code) => {
    script = code;
    return vm.runInNewContext(`(() => {${code}})()`, { doc });
  });
  const page = { waitForTimeout: async () => { throw Error('Drawing not saved'); } };
  return { chart, page, doc, script: () => script };
}

function assertScriptDataRoundTrip(code, doc, expectedIds) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(`<script>window.saved = (() => {${code}})()</script>`, {
    runScripts: 'dangerously', virtualConsole,
    beforeParse(window) { window.doc = doc; },
  });
  try {
    assert.equal(dom.window.injected, undefined, 'IDs must remain data in script context');
    assert.deepEqual(errors, []);
    assert.equal(dom.window.document.scripts.length, 1);
    assert.deepEqual(Array.from(dom.window.saved.savedIds), expectedIds);
    assert.equal(dom.window.saved.timestamp, 123);
  } finally {
    dom.window.close();
  }
}

const hostileId = '</script><script>window.injected = true</script>"\'\\\n\u2028\u2029<&';

test('saved drawing IDs preserve special characters without escaping the script element', async () => {
  const probe = savedDrawingProbe([[hostileId, { style: { linewidth: 3 } }]]);
  const result = await probe.chart.waitDrawingSaved(probe.page, [hostileId], { width: 3 });
  assert.deepEqual(Array.from(result.savedIds), [hostileId]);
  assertScriptDataRoundTrip(probe.script(), probe.doc, [hostileId]);
});

test('removed drawing IDs remain data and do not create script elements', async () => {
  const probe = savedDrawingProbe([['kept', {}]]);
  await probe.chart.waitDrawingSaved(probe.page, ['kept'], { removed: [hostileId] });
  assertScriptDataRoundTrip(probe.script(), probe.doc, ['kept']);
});

test('saved drawing evidence still rejects missing IDs, retained removals and wrong widths', async () => {
  const cases = [
    { sources: [], ids: ['missing'], options: {} },
    { sources: [['kept', {}], ['removed', {}]], ids: ['kept'], options: { removed: ['removed'] } },
    { sources: [['kept', { linewidth: 1 }]], ids: ['kept'], options: { width: 3 } },
  ];
  for (const { sources, ids, options } of cases) {
    const probe = savedDrawingProbe(sources);
    await assert.rejects(probe.chart.waitDrawingSaved(probe.page, ids, options), /Drawing not saved/);
  }
});
