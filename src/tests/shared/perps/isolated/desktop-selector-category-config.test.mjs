// Actual category configuration transforms at the pinned source. No admin or
// Desktop UI changes; publication, transport and rendering are separate.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSource } from "./source.mjs";
import { expectedSearchCategories } from "../search-evidence.mjs";
const tabs = evaluateSource(
  "packages/kit/src/views/Perp/utils/tokenSelectorTabs.ts",
  {
    mocks: {
      "@onekeyhq/shared/src/utils/perpsUtils": {},
      "@onekeyhq/shared/types/hyperliquid/perp.constants": evaluateSource(
        "packages/shared/types/hyperliquid/perp.constants.ts",
      ),
    },
  },
);
const fixedTabNames = {
  favorites: "自选",
  all: "全部",
  perps: "永续合约",
  spot: "现货",
};
const scenarios = [
  ["no config", null],
  ["empty published config", []],
  [
    "configured Hot/New, no duplicates",
    [
      { tabId: "hot", name: "热门", tokens: ["BTC"] },
      { tabId: "new", name: "新上架", tokens: [] },
    ],
  ],
  [
    "rename and reorder",
    [
      { tabId: "new", name: "最新资产", tokens: [] },
      { tabId: "stocks", name: "股票", tokens: ["xyz:NVDA"] },
    ],
  ],
  [
    "remove category",
    [{ tabId: "stocks", name: "股票", tokens: ["xyz:NVDA"] }],
  ],
  [
    "invalid duplicate and reserved",
    [
      { tabId: " Stocks ", name: " 股票 ", tokens: [] },
      { tabId: "stocks", name: "旧名称", tokens: [] },
      { tabId: "", name: "invalid", tokens: [] },
      { tabId: " ALL ", name: "all from server", tokens: [] },
      { tabId: "unknown", name: " " },
    ],
  ],
];
for (const [name, serverTabs] of scenarios)
  test(`D05-45/47/72/84/85 actual category config ${name}`, () => {
    const result = tabs.buildPerpTokenSelectorCategoryTabs({
      serverTabs,
      fixedTabNames,
    });
    assert.deepEqual(
      JSON.parse(JSON.stringify(result)),
      expectedSearchCategories(serverTabs),
    );
    assert.equal(result[0].tabId, "perps");
    assert.equal(result[0].name, "全部");
    assert.equal(result.filter((t) => t.tabId === "perps").length, 1);
    assert.deepEqual(
      JSON.parse(
        JSON.stringify(
          tabs.buildPrimaryTabs(fixedTabNames).map((t) => t.tabId),
        ),
      ),
      ["favorites", "perps", "spot"],
    );
  });

for (const useSortedItemsOrder of [false, true])
  test(`D05-46/48/69/70/82/85 actual category membership update and search bypass sorted=${useSortedItemsOrder}`, () => {
    const items = ["BTC", "ETH", "xyz:GOLD", "xyz:NVDA"].map((tokenName) => ({
      tokenName,
    }));
    const select = (tokens, filteredQuery = "") =>
      JSON.parse(
        JSON.stringify(
          tabs.getPerpTokenSelectorDynamicTabItems({
            items,
            tokens,
            filteredQuery,
            useSortedItemsOrder,
          }),
        ),
      ).map((i) => i.tokenName);
    assert.deepEqual(select([" xyz:GOLD ", "xyz:GOLD", "missing", ""]), [
      "xyz:GOLD",
    ]);
    assert.deepEqual(select(["xyz:NVDA"]), ["xyz:NVDA"]);
    assert.deepEqual(select([]), []);
    assert.deepEqual(select(["BTC", "xyz:GOLD"]), ["BTC", "xyz:GOLD"]);
    assert.deepEqual(select(["BTC", "xyz:NVDA"]), ["BTC", "xyz:NVDA"]);
    assert.deepEqual(
      select(["ETH", "BTC"]),
      useSortedItemsOrder ? ["BTC", "ETH"] : ["ETH", "BTC"],
    );
    // Caller supplies already search-filtered items; a category must not narrow them again.
    assert.deepEqual(
      select(["xyz:GOLD"], "BTC"),
      items.map((i) => i.tokenName),
    );
    assert.deepEqual(
      select(["xyz:NVDA"], "ETH"),
      items.map((i) => i.tokenName),
    );
    assert.deepEqual(select(["xyz:GOLD"], " "), ["xyz:GOLD"]);
  });
