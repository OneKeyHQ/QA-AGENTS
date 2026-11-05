// D12-105..109. Actual pinned hook; dialogs are monitored sinks. No order or
// signing service is imported. Source coverage is separate from TF UI evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { React, renderer, evaluateSource, perpsUtils } from './source.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const ids = { limit: 'perps-chart-limit-order', tp: 'perps-chart-take-profit', sl: 'perps-chart-stop-loss' };
const plain = value => JSON.parse(JSON.stringify(value));
async function fixture(patch = {}) {
  let state = {
    instrument: { mode: 'perp', coin: 'BTC', assetId: 0, universe: { szDecimals: 5 } },
    account: { accountId: 'A' }, loading: { selectAccountLoading: false },
    active: { ready: true, account: { id: 'A' } },
    positions: [{ position: { coin: 'BTC', szi: '1' } }], mid: '100', enabled: true,
    ...patch,
  }, value, tree;
  const menus = [], limits = [], stops = [], errors = [];
  let closedMenus = 0, closedDialogs = 0;
  const utils = perpsUtils();
  const accounts = evaluateSource('packages/kit/src/views/Perp/utils/accountScopedData.ts', { mocks: { '@onekeyhq/shared/src/utils/perpsUtils': utils } });
  const sourcePage = { hostKey: 'main', ownerKey: 'perps' };
  const dialog = () => ({ isExist: () => true, close: () => { closedDialogs++; } });
  const { usePerpsChartOrderMenu } = evaluateSource('packages/kit/src/views/Perp/hooks/usePerpsChartOrderMenu.ts', { mocks: {
    '@onekeyfe/react-native-native-overlay': { useOverlayPageScope: () => sourcePage },
    'react-intl': { useIntl: () => ({ formatMessage: ({ id }, vars) => `${id}:${JSON.stringify(vars ?? {})}` }) },
    '@onekeyhq/components': {
      ActionList: { show: menu => { menus.push(menu); return { close: () => { closedMenus++; } }; } },
      Toast: { error: error => errors.push(error) },
      runAfterActionListClose: (close, action) => { close(); return action(); },
    },
    '@onekeyhq/kit/src/states/jotai/contexts/accountSelector': { useActiveAccount: () => ({ activeAccount: state.active }) },
    '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid': { useActiveTradeInstrumentAtom: () => [state.instrument] },
    '@onekeyhq/kit-bg/src/states/jotai/atoms': {
      usePerpsActiveAccountAtom: () => [state.account], usePerpsAccountLoadingInfoAtom: () => [state.loading],
    },
    '@onekeyhq/shared/src/locale': { ETranslations: new Proxy({}, { get: (_, k) => k }) },
    '@onekeyhq/shared/src/utils/perpsUtils': utils,
    '../components/OrderInfoPanel/SetTpslModal': { showSetTpslDialog: args => { stops.push(args); return dialog(); } },
    '../components/TradingPanel/panels/LimitOrderForm': { showLimitOrderDialog: args => { limits.push(args); return dialog(); } },
    '../utils/accountScopedData': accounts,
    './useActiveTradeDisplay': { useActiveTradeDisplay: () => ({ displayName: state.instrument.mode === 'spot' ? 'BTC/USDC' : 'BTCUSDC', baseName: 'BTC' }) },
    './usePerpsAccountScopedActivePositions': { usePerpsAccountScopedActivePositions: () => state.positions },
    './usePerpsMidPrice': { usePerpsMidPrice: () => ({ mid: state.mid }) },
  } });
  function Probe() { value = usePerpsChartOrderMenu(state.enabled); return null; }
  async function render() { await renderer.act(async () => { if (tree) tree.update(React.createElement(Probe)); else tree = renderer.create(React.createElement(Probe)); }); }
  await render();
  return {
    menus, limits, stops, errors, sourcePage,
    get value() { return value; },
    get closedMenus() { return closedMenus; }, get closedDialogs() { return closedDialogs; },
    update: async changes => { state = { ...state, ...changes }; await render(); },
    select: async price => { let closed = 0; await renderer.act(async () => value.onPriceSelect?.({ price, screenX: 11, screenY: 22, onClose: () => closed++ })); return closed; },
    press: async item => renderer.act(async () => { await item.onPress(() => {}); }),
    close: async () => renderer.act(async () => tree.unmount()),
  };
}
for (const size of ['1', '-1']) for (const price of [99, 100, 101]) {
  test(`D12-106/107 ${size} position, selected=${price}`, async () => {
    const f = await fixture({ positions: [{ position: { coin: 'BTC', szi: size } }] });
    try {
      await f.select(price);
      const menu = f.menus.at(-1), expected = price === 100 ? [] : [(price > 100) === (Number(size) > 0) ? ids.tp : ids.sl];
      assert.deepEqual(plain(menu.items.map(i => i.testID)), [ids.limit, ...expected]);
      assert.equal(menu.title, `BTCUSDC · ${price}`);
      assert.deepEqual(plain(menu.triggerPosition), { x: 11, y: 22 });
      if (expected.length) {
        await f.press(menu.items[1]);
        assert.equal(f.stops.length, 1);
        assert.deepEqual(plain(f.stops[0]), { coin: 'BTC', szDecimals: 5, assetId: 0, presetTriggerPrice: String(price), presetTpsl: expected[0] === ids.tp ? 'tp' : 'sl', intl: {} });
        assert.equal(f.limits.length, 0);
      }
    } finally { await f.close(); }
  });
}
for (const invalid of [0, -1, NaN, Infinity, -Infinity, 1e-100]) {
  test(`D12-109 rejects selected price ${invalid}`, async () => {
    const f = await fixture();
    try { assert.equal(await f.select(invalid), 1); assert.equal(f.menus.length, 0); assert.equal(f.limits.length + f.stops.length, 0); }
    finally { await f.close(); }
  });
}
for (const patch of [
  { enabled: false }, { active: { ready: false, account: { id: 'A' } } },
  { loading: { selectAccountLoading: true } }, { account: { accountId: 'B' } },
  { instrument: { mode: 'perp', coin: 'BTC', assetId: 0, universe: {} } },
]) test(`D12-109 unresolved context ${JSON.stringify(patch)}`, async () => {
  const f = await fixture(patch);
  try { assert.equal(f.value.onPriceSelect, undefined); assert.equal(f.menus.length, 0); }
  finally { await f.close(); }
});
for (const patch of [
  { positions: [] }, { positions: [{ position: { coin: 'ETH', szi: '1' } }] },
  { positions: [{ position: { coin: 'BTC', szi: '0' } }] },
  { positions: [{ position: { coin: 'BTC', szi: 'NaN' } }] },
  { mid: '0' }, { mid: 'NaN' },
  { instrument: { mode: 'spot', coin: '@1', assetId: 10001, universe: { baseSzDecimals: 5 } } },
]) test(`D12-105 no TP/SL ${JSON.stringify(patch)}`, async () => {
  const f = await fixture(patch);
  try { await f.select(101); const menu = f.menus.at(-1); assert.deepEqual(plain(menu.items.map(i => i.testID)), [ids.limit]); await f.press(menu.items[0]); assert.equal(f.limits.length, 1); assert.equal(f.limits[0].sourcePage, f.sourcePage); assert.equal(f.limits[0].price, '101'); assert.equal(f.stops.length, 0); }
  finally { await f.close(); }
});
for (const patch of [
  { account: { accountId: 'B' }, active: { ready: true, account: { id: 'B' } } },
  { instrument: { mode: 'perp', coin: 'ETH', assetId: 1, universe: { szDecimals: 4 } } },
  { instrument: { mode: 'spot', coin: '@1', assetId: 10001, universe: { baseSzDecimals: 5 } } },
  { loading: { selectAccountLoading: true } },
]) test(`D12-108 stale menu rejected ${JSON.stringify(patch)}`, async () => {
  const f = await fixture();
  try {
    await f.select(101); const oldItems = f.menus.at(-1).items;
    await f.update(patch); assert.ok(f.closedMenus >= 1);
    for (const item of oldItems) await f.press(item);
    assert.equal(f.limits.length + f.stops.length, 0, 'Old handlers must not open a dialog for the new scope');
  } finally { await f.close(); }
});
for (const patch of [{ mid: '102' }, { positions: [] }, { positions: [{ position: { coin: 'BTC', szi: '-1' } }] }]) {
  test(`D12-108 revalidate same-scope TP ${JSON.stringify(patch)}`, async () => {
    const f = await fixture();
    try { await f.select(101); const old = f.menus.at(-1).items[1]; await f.update(patch); await f.press(old); assert.equal(f.stops.length, 0); assert.equal(f.errors.length, 1); assert.match(f.errors[0].title, /order_changed_try_again__msg/u); }
    finally { await f.close(); }
  });
}
test('D12-108 context switch closes an already-open limit dialog', async () => {
  const f = await fixture();
  try { await f.select(101); await f.press(f.menus.at(-1).items[0]); assert.equal(f.limits.length, 1); await f.update({ enabled: false }); assert.equal(f.closedDialogs, 1); }
  finally { await f.close(); }
});
