// Real search hook -> real context action -> real alias matcher, using local
// universe/alias/config atoms. No backend configuration or app UI is mutated.
import test from "node:test";
import assert from "node:assert/strict";
import { React, renderer, evaluateSource } from "./source.mjs";
import { sourceClass } from "./twap-flow-fixture.mjs";
const plain = (x) => JSON.parse(JSON.stringify(x));
async function fixture(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const state = {
    universes: [
      [
        { name: "BTC" },
        { name: "ETH" },
        { name: "AIXBT" },
        { name: "OLD", isDelisted: true },
      ],
      [{ name: "xyz:GOLD" }, { name: "xyz:BTC" }],
    ],
    aliases: {
      BTC: {
        subtitle: "比特币",
        aliases: ["比特币", "ビットコイン", "bitcoin", "btc-usdc"],
      },
      ETH: { subtitle: "以太坊", aliases: ["以太坊", "Ethereum"] },
      "xyz:GOLD": { aliases: ["黄金", "gold"] },
    },
    config: { activeTab: "perps" },
    pending: null,
    refreshFail: false,
    ...patch,
  };
  const atoms = { filtered: { assetsByDex: [], query: "" }, aliases: {} };
  let notify = () => {};
  const logs = [],
    requests = [];
  const { findTokensByAlias } = evaluateSource(
    "packages/shared/src/utils/perpsUtils.ts",
    { names: ["findTokensByAlias"] },
  );
  const Action = sourceClass(
    "packages/kit/src/states/jotai/contexts/hyperliquid/actions.ts",
    ["updateAllAssetsFiltered"],
    {
      contextAtomMethod: (fn) => (data) =>
        fn(
          (key) => atoms[key],
          (key, value) => {
            atoms[key] = value;
            if (key === "filtered") notify();
          },
          data,
        ),
      findTokensByAlias,
      perpsTokenSearchAliasesAtom: () => "aliases",
      perpsAllAssetsFilteredAtom: () => "filtered",
    },
  );
  const actions = { current: new Action() };
  // Debounce is only telemetry and not an assertion target; cancellation is kept
  // observable without creating real timers or pretending this verifies timing.
  const debounce = (fn) => {
    const callback = (...args) => {
      callback.pending = args;
    };
    callback.cancel = () => {
      callback.pending = null;
    };
    return callback;
  };
  const backgroundApiProxy = {
    serviceHyperliquid: {
      getTradingUniverse: async () => {
        requests.push("universe");
        if (state.pending) await state.pending;
        return { universesByDex: state.universes };
      },
      getTokenSearchAliases: async () => {
        requests.push("aliases");
        return state.aliases;
      },
      refreshTradingMeta: async () => {
        requests.push("refresh");
        if (state.refreshFail) throw Error("local metadata failed");
      },
    },
  };
  const { usePerpTokenSelector } = evaluateSource(
    "packages/kit/src/views/Perp/hooks/usePerpTokenSelector.ts",
    {
      mocks: {
        lodash: { debounce },
        "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid": {
          useHyperliquidActions: () => actions,
        },
        "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms": {
          usePerpsAllAssetsFilteredAtom: () => {
            const [, set] = React.useState(0);
            React.useEffect(() => {
              notify = () => set((v) => v + 1);
              return () => {
                notify = () => {};
              };
            }, []);
            return [atoms.filtered];
          },
        },
        "@onekeyhq/kit-bg/src/states/jotai/atoms": {
          usePerpsActiveAccountAtom: () => [{ walletType: "hd" }],
          usePerpTokenSelectorConfigPersistAtom: () => [state.config],
        },
        "@onekeyhq/shared/src/logger/logger": {
          defaultLogger: {
            perp: {
              hyperliquid: {
                coldStartInitializationError: (e) => logs.push(e.type),
              },
              tokenSelector: { perpTokenSelectorSearch: (e) => logs.push(e) },
            },
          },
        },
        "@onekeyhq/shared/src/utils/timerUtils": {
          getTimeDurationMs: () => 300000,
        },
        "@onekeyhq/shared/types/hyperliquid/perp.constants": evaluateSource(
          "packages/shared/types/hyperliquid/perp.constants.ts",
        ),
        "../../../background/instance/backgroundApiProxy": backgroundApiProxy,
      },
    },
  );
  let value, tree;
  function Probe() {
    value = usePerpTokenSelector();
    return null;
  }
  const mount = () =>
    renderer.act(async () => {
      tree = renderer.create(React.createElement(Probe));
    });
  await mount();
  return {
    state,
    atoms,
    logs,
    requests,
    get value() {
      return value;
    },
    names: () => atoms.filtered.assetsByDex.flat().map((x) => x.name),
    query: async (q) => renderer.act(async () => value.setSearchQuery(q)),
    clear: async () => renderer.act(async () => value.clearSearch()),
    refresh: async () => renderer.act(async () => value.refreshAllAssets()),
    update: async (next) => {
      Object.assign(state, next);
      await renderer.act(async () => tree.update(React.createElement(Probe)));
    },
    remount: async () => {
      await renderer.act(async () => tree.unmount());
      await mount();
    },
    close: async () => renderer.act(async () => tree.unmount()),
  };
}
for (const [query, names] of [
  ["bt", ["BTC", "AIXBT", "xyz:BTC"]],
  ["BTC", ["BTC", "xyz:BTC"]],
  ["比特", ["BTC"]],
  ["ビット", ["BTC"]],
  ["Ethereum", ["ETH"]],
  ["黄金", ["xyz:GOLD"]],
  ["ETHUSDC", []],
  ["btc-usdc", ["BTC"]],
  ["xyz:", ["xyz:GOLD", "xyz:BTC"]],
  ['%$<>"', []],
])
  test(`D05-27/28/30/31/35 actual search pipeline ${query} matches exact raw identities with local server aliases`, async () => {
    const f = await fixture();
    try {
      await f.query(query);
      assert.deepEqual(plain(f.names()), names);
      assert.equal(f.value.searchQuery, query);
      assert.equal(f.atoms.filtered.query, query);
      assert.ok(!f.names().includes("OLD"));
    } finally {
      await f.close();
    }
  });
test("D05-32/33/34/70 actual search trims, caps matching at 64, recovers from no result and clears delisted rows", async () => {
  const f = await fixture();
  try {
    await f.query("  BTC  ");
    assert.equal(f.value.searchQuery, "BTC");
    await f.query("A".repeat(64) + "BTC");
    assert.equal(f.value.searchQuery, "A".repeat(64));
    assert.deepEqual(plain(f.names()), []);
    await f.query("ETH");
    assert.deepEqual(plain(f.names()), ["ETH"]);
    await f.clear();
    assert.equal(f.value.searchQuery, "");
    assert.deepEqual(plain(f.names()), [
      "BTC",
      "ETH",
      "AIXBT",
      "xyz:GOLD",
      "xyz:BTC",
    ]);
    await f.query("   ");
    assert.equal(f.value.searchQuery, "");
  } finally {
    await f.close();
  }
});
test("D05-72 actual alias metadata refresh replaces old aliases and reapplies current query", async () => {
  const f = await fixture();
  try {
    await f.query("黄金");
    assert.deepEqual(plain(f.names()), ["xyz:GOLD"]);
    f.state.aliases = { "xyz:GOLD": { aliases: ["金属"] } };
    await f.refresh();
    assert.equal(f.value.searchQuery, "黄金");
    assert.deepEqual(plain(f.names()), []);
    await f.query("金属");
    assert.deepEqual(plain(f.names()), ["xyz:GOLD"]);
  } finally {
    await f.close();
  }
});
test("D05-69/71 actual hook preserves normalized search when category config changes, selection wrapper must scope separately", async () => {
  const f = await fixture();
  try {
    await f.query("BTC");
    for (const activeTab of ["favorites", "spot", "perps", "stocks"]) {
      await f.update({ config: { activeTab } });
      assert.equal(f.value.searchQuery, "BTC");
      assert.deepEqual(plain(f.names()), ["BTC", "xyz:BTC"]);
    }
  } finally {
    await f.close();
  }
});
test("D05-72 metadata refresh failure clears throttle and remount retries; close clears filtered query without erasing universes", async () => {
  const f = await fixture({ refreshFail: true });
  try {
    assert.deepEqual(f.logs, ["refresh_trading_meta"]);
    await f.query("ETH");
    f.state.refreshFail = false;
    await f.remount();
    assert.equal(f.requests.filter((r) => r === "refresh").length, 2);
    assert.equal(f.value.searchQuery, "");
    assert.deepEqual(plain(f.names()), [
      "BTC",
      "ETH",
      "AIXBT",
      "xyz:GOLD",
      "xyz:BTC",
    ]);
  } finally {
    await f.close();
  }
});
