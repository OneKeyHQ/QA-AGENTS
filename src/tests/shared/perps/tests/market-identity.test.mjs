import test from "node:test";
import assert from "node:assert/strict";
import { marketCatalog, identifyMarketRow } from "../market-identity.mjs";
const catalog = marketCatalog(
  [{ name: "BTC" }, { name: "xyz:BTC" }],
  [
    { coin: "@142", base: "UBTC", quote: "USDC" },
    { coin: "@234", base: "UBTC", quote: "USDH" },
  ],
  { UBTC: "BTC" },
);
test("identical BTC base names retain raw DEX and quote identities", () => {
  for (const [id, name, spot, dex, coin] of [
    ["perp-token-selector-row-btc", "BTC", false, null, "BTC"],
    ["perp-token-selector-row-xyz-btc", "BTC", false, "xyz", "xyz:BTC"],
    ["perp-token-selector-row-btc", "BTC/USDC", true, null, "@142"],
    ["perp-token-selector-row-btc", "BTC/USDH", true, null, "@234"],
  ])
    assert.equal(
      identifyMarketRow({ id, name, spot, dex }, catalog).coin,
      coin,
    );
});
test("duplicate, unknown or mismatched raw identities fail instead of guessing", () => {
  const row = {
    id: "perp-token-selector-row-btc",
    name: "BTC/USDC",
    spot: true,
    dex: null,
  };
  assert.throws(
    () => identifyMarketRow(row, [...catalog, catalog[2]]),
    /not unique/,
  );
  assert.throws(
    () => identifyMarketRow({ ...row, name: "BTC/USDE" }, catalog),
    /not unique/,
  );
  assert.throws(
    () =>
      identifyMarketRow(
        {
          id: "perp-token-selector-row-xyz-btc",
          name: "BTC",
          spot: false,
          dex: "para",
        },
        catalog,
      ),
    /DEX badge/,
  );
});

test("offscreen row without innerText line breaks reads name span and keeps perp identity", async () => {
  const { marketRowDOM } = await import("../market-identity.mjs");
  const span = (text) => ({ textContent: text, querySelector: () => null });
  const e = {
    dataset: { testid: "perp-token-selector-row-btc" },
    innerText: "BTC20x80000-1 / -2%0.001%",
    querySelectorAll: () => [
      span("BTC"),
      span("20x"),
      span("80000"),
      span("-1 / -2%"),
    ],
    querySelector: () => null,
    classList: { contains: () => false },
  };
  const r = marketRowDOM(e);
  assert.equal(r.name, "BTC");
  assert.equal(r.spot, false);
  assert.equal(identifyMarketRow(r, catalog).coin, "BTC");
  e.querySelectorAll = () => [span("BTC/USDH"), span("现货"), span("80000")];
  assert.equal(identifyMarketRow(marketRowDOM(e), catalog).coin, "@234");
  e.querySelectorAll = () => [];
  assert.throws(() => marketRowDOM(e), /Missing market name/);
});
