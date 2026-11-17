import test from "node:test";
import assert from "node:assert/strict";
import {
  projectBboPreview,
  projectBboFormState,
} from "../bbo-preview-projection.mjs";
import { assertBboPreviewEvidence } from "../bbo-preview-evidence.mjs";
class Host {
  constructor(innerText) {
    this.innerText = innerText;
  }
}
const bn = (value) => ({ toFixed: () => String(value) });
const trap = () => {
  throw Error("Projection invoked a callback");
};
function node(props = {}, children = [], type = function Layout() {}) {
  const n = { type, memoizedProps: props };
  children.forEach((c, i) => {
    c.return = n;
    c.sibling = children[i + 1];
  });
  n.child = children[0];
  return n;
}
function hookList(...values) {
  return values.reduceRight(
    (next, memoizedState) => ({ memoizedState, next }),
    null,
  );
}
function host(text) {
  const n = node({}, [], "span");
  n.stateNode = new Host(text);
  return n;
}
function fixture() {
  const assetData = {
    accountAddress: "A",
    coin: "BTC",
    leverage: { value: 10, type: "isolated" },
  };
  const panel = {
    activeTradeInstrument: { mode: "perp", coin: "BTC" },
    formData: {
      type: "limit",
      orderMode: "standard",
      bboPriceMode: { type: "counterparty", offsetTicks: 0 },
      size: "2",
      sizeInputMode: "manual",
    },
    side: "long",
    computedSizeForSide: bn(2),
    effectivePriceBN: bn(101),
    orderValue: bn(202),
    priceError: null,
    leverage: 10,
    isSpot: false,
    szDecimals: 4,
  };
  const button = host("买入 / 做多\n≈ $202.00"),
    costHost = host("$20.20"),
    liqHost = host("$92.77");
  const cost = node(
    { formatter: "value", formatterOptions: { currency: "$" }, children: 20.2 },
    [costHost],
  );
  const leaf = node({}, [liqHost], function EstLiqPriceLeaf() {});
  const expectedLiq = (100.5 * 0.9) / 0.975;
  leaf.memoizedState = hookList([
    bn(expectedLiq),
    [
      "A",
      20,
      "100.5",
      assetData,
      "perp",
      "BTC",
      bn(10),
      undefined,
      "",
      "standard",
      false,
      undefined,
      undefined,
      "limit",
      [{ lowerBound: "0", maxLeverage: 20 }],
      bn(101),
      "long",
      bn(2),
    ],
  ]);
  const owner = node(
    { onPress: trap },
    [button, cost, leaf],
    function SideButtonInternal() {},
  );
  owner.memoizedState = hookList(
    { current: panel },
    {
      v: { coin: "BTC", time: Date.now(), bbo: [{ px: "100" }, { px: "101" }] },
    },
  );
  return { owner, panel, button, cost, leaf, costHost, liqHost };
}
function withHost(fn) {
  const before = globalThis.HTMLElement;
  globalThis.HTMLElement = Host;
  try {
    return fn();
  } finally {
    if (before === undefined) delete globalThis.HTMLElement;
    else globalThis.HTMLElement = before;
  }
}
const sample = {
  coin: "BTC",
  label: "对手价 1",
  type: "counterparty",
  offsetTicks: 0,
};
test("BBO projection independently reads committed amounts, numeric DOM and liquidation inputs without callbacks", () =>
  withHost(() => {
    const f = fixture(),
      s = projectBboPreview(f.button, f.button.stateNode);
    assert.equal(s.costs[0].text, "$20.20");
    assert.equal(s.liquidation[0].price, "101");
    assert.equal(s.books[0].coin, "BTC");
    assert.equal(s.quantity, "2");
    assert.equal(
      assertBboPreviewEvidence(s, sample).numericLiquidationSample,
      true,
    );
  }));
test('Production memo leaf is named on elementType, not its anonymous inner type', () => withHost(() => {
  const f = fixture();
  f.leaf.type = (() => () => {})();
  f.leaf.elementType = { displayName: 'EstLiqPriceLeaf', type: f.leaf.type };
  const s = projectBboPreview(f.button, f.button.stateNode);
  assert.equal(s.liquidation.length, 1);
  assert.equal(assertBboPreviewEvidence(s, sample).numericLiquidationSample, true);
}));
test("BBO evidence refuses stale cost/secondary text, wrong account/side/mark and duplicate fields", () =>
  withHost(() => {
    const f = fixture(),
      s = projectBboPreview(f.button, f.button.stateNode);
    const changes = [
      { buttonText: "≈ $200.00" },
      { orderValue: "200" },
      { rawSize: "1" },
      { costs: [{ ...s.costs[0], raw: "20" }] },
      { costs: [{ ...s.costs[0], text: "$20.00" }] },
      { costs: [...s.costs, ...s.costs] },
      { liquidation: [] },
      { liquidation: [{ ...s.liquidation[0], text: "$100.00" }] },
      { liquidation: [{ ...s.liquidation[0], side: "short" }] },
      { liquidation: [{ ...s.liquidation[0], account: "B" }] },
      { liquidation: [{ ...s.liquidation[0], mark: "110" }] },
    ];
    for (const change of changes)
      assert.throws(() =>
        assertBboPreviewEvidence({ ...s, ...change }, sample),
      );
  }));
test("BBO numeric projection fails closed when leaf hook shape or DOM host changes", () =>
  withHost(() => {
    const f = fixture();
    f.leaf.memoizedState.memoizedState[1].pop();
    assert.throws(
      () => projectBboPreview(f.button, f.button.stateNode),
      /dependency schema/,
    );
    const g = fixture();
    g.cost.child = null;
    assert.throws(
      () => projectBboPreview(g.button, g.button.stateNode),
      /no DOM host/,
    );
    const h = fixture();
    h.owner.memoizedState.next = h.owner.memoizedState;
    assert.throws(
      () => projectBboPreview(h.button, h.button.stateNode),
      /hook chain/,
    );
  }));
test("BBO form projection reads switch result and refuses ambiguous or missing form/instrument snapshots", () => {
  const form = { type: "market", bboPriceMode: null, sizeInputMode: "manual" };
  const instrument = { mode: "spot", coin: "@107", assetId: 10107, universe: {baseName:'HYPE',quoteName:'USDC'} };
  const child = node({ onPress: trap }),
    owner = node({}, [child], function PerpTradingForm() {});
  owner.memoizedState = hookList([form, trap], { v: instrument });
  // Real TF hook245 memoizes display labels with mode/coin/assetId too. It
  // is not an activeTradeInstrument (no universe) and must not count twice.
  owner.memoizedState.next.next = hookList([{mode:'spot',coin:'@107',assetId:10107,displayName:'HYPE/USDC',rawBaseName:'HYPE'}, [instrument]]);
  assert.deepEqual(projectBboFormState(child), { form, instrument });
  owner.memoizedState.next.next = hookList({ v: { ...form, type: "limit" } });
  assert.throws(() => projectBboFormState(child), /One committed form/);
  assert.throws(() => projectBboFormState(node()), /owner required/);
});
