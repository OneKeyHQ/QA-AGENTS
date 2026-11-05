// Full actual picker: local published configuration/metadata boundary, actual
// search hook, category construction, filtering and rendered list. No admin API.
import test from "node:test";
import assert from "node:assert/strict";
import { selectorCompleteFixture } from "./selector-complete-fixture.mjs";
const categories = (f) => f.categories().map(({ id, name }) => ({ id, name }));
test("D05-72 D05-84 actual full picker receives added/renamed/reordered categories and survives remount", async () => {
  const f = await selectorCompleteFixture();
  try {
    assert.deepEqual(categories(f), [
      { id: "perps", name: "全部" },
      { id: "stocks", name: "股票" },
      { id: "metals", name: "贵金属" },
    ]);
    await f.update({
      tabs: [
        { tabId: "metals", name: "金属新版", tokens: ["xyz:GOLD"] },
        { tabId: "new", name: "新分类", tokens: ["ETH"] },
        { tabId: "stocks", name: "股票新版", tokens: ["xyz:NVDA"] },
      ],
    });
    const expected = [
      { id: "perps", name: "全部" },
      { id: "metals", name: "金属新版" },
      { id: "new", name: "新分类" },
      { id: "stocks", name: "股票新版" },
    ];
    assert.deepEqual(categories(f), expected);
    await f.tab("new");
    assert.deepEqual(f.names(), ["ETH"]);
    assert.equal(f.state.config.activeTab, "new");
    await f.remount();
    assert.deepEqual(categories(f), expected);
    assert.deepEqual(f.names(), ["ETH"]);
    assert.equal(f.categories().find((x) => x.id === "new").selected, true);
    assert.deepEqual(f.events.errors, []);
  } finally {
    await f.close();
  }
});
test("D05-82 actual picker recomputes membership, overlaps and removal without leaking another category", async () => {
  const f = await selectorCompleteFixture();
  try {
    await f.tab("stocks");
    assert.deepEqual(f.names(), ["xyz:NVDA"]);
    await f.tab("metals");
    assert.deepEqual(f.names(), ["xyz:GOLD"]);
    await f.update({
      tabs: [
        { tabId: "stocks", name: "股票", tokens: ["xyz:NVDA", "xyz:GOLD"] },
        { tabId: "metals", name: "贵金属", tokens: ["xyz:GOLD"] },
      ],
    });
    // Default dynamic categories follow configured tokens, rather than universe order.
    await f.tab("stocks");
    assert.deepEqual(f.names(), ["xyz:NVDA", "xyz:GOLD"]);
    await f.tab("metals");
    assert.deepEqual(f.names(), ["xyz:GOLD"]);
    await f.update({
      tabs: [
        { tabId: "stocks", name: "股票", tokens: ["xyz:NVDA"] },
        { tabId: "metals", name: "贵金属", tokens: [] },
      ],
    });
    assert.deepEqual(f.names(), []);
    await f.tab("stocks");
    assert.deepEqual(f.names(), ["xyz:NVDA"]);
  } finally {
    await f.close();
  }
});
test("D05-85 actual picker removes selected category and falls back to all, including across remount", async () => {
  const f = await selectorCompleteFixture();
  try {
    await f.tab("metals");
    assert.deepEqual(f.names(), ["xyz:GOLD"]);
    await f.update({
      tabs: [{ tabId: "stocks", name: "股票", tokens: ["xyz:NVDA"] }],
    });
    assert.deepEqual(categories(f), [
      { id: "perps", name: "全部" },
      { id: "stocks", name: "股票" },
    ]);
    assert.equal(f.state.config.activeTab, "perps");
    assert.deepEqual(f.names(), ["BTC", "ETH", "xyz:GOLD", "xyz:NVDA"]);
    await f.remount();
    assert.equal(f.state.config.activeTab, "perps");
    assert.deepEqual(f.names(), ["BTC", "ETH", "xyz:GOLD", "xyz:NVDA"]);
  } finally {
    await f.close();
  }
});
test("D05-72 actual picker search refresh discards old aliases, sees new metadata and preserves query", async () => {
  const f = await selectorCompleteFixture();
  try {
    await f.query("黄金");
    assert.deepEqual(f.names(), ["xyz:GOLD"]);
    await f.refresh({
      aliases: { "xyz:GOLD": { subtitle: "新黄金", aliases: ["新gold"] } },
      universes: [
        [
          { name: "BTC", assetId: 0, maxLeverage: 20 },
          { name: "SOL", assetId: 2, maxLeverage: 20 },
        ],
        f.state.universes[1],
      ],
    });
    assert.equal(f.state.filtered.query, "黄金");
    assert.deepEqual(f.names(), []);
    await f.query("新gold");
    assert.deepEqual(f.names(), ["xyz:GOLD"]);
    await f.query("SOL");
    assert.deepEqual(f.names(), ["SOL"]);
    await f.query("ETH");
    assert.deepEqual(f.names(), []);
    await f.query("");
    assert.deepEqual(f.names(), ["BTC", "SOL", "xyz:GOLD", "xyz:NVDA"]);
    assert.ok(f.events.requests.filter((x) => x === "aliases").length >= 2);
    assert.deepEqual(f.events.errors, []);
  } finally {
    await f.close();
  }
});
test("D05-72 actual picker malformed/duplicate tabs do not create blank or duplicate visible entries", async () => {
  const f = await selectorCompleteFixture();
  try {
    await f.update({
      tabs: [
        { tabId: " ", name: "空", tokens: [] },
        { tabId: "metals", name: "金属", tokens: ["xyz:GOLD"] },
        { tabId: "METALS", name: "重复", tokens: ["ETH"] },
        { tabId: "empty", name: " ", tokens: ["BTC"] },
      ],
    });
    assert.deepEqual(categories(f), [
      { id: "perps", name: "全部" },
      { id: "metals", name: "金属" },
    ]);
    await f.tab("metals");
    assert.deepEqual(f.names(), ["xyz:GOLD"]);
  } finally {
    await f.close();
  }
});
