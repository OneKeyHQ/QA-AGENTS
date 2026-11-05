// D17-28/29/30: raw amount and actual production formatting. Component/source
// evidence only; Desktop has no mobile trade-detail navigation entry.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSource, perpsUtils } from "./source.mjs";
import { numberUtils } from "./number-format-source.mjs";
for (const locale of ["en-US", "zh-CN"]) {
  const nums = numberUtils(locale),
    calls = [];
  const format = {
    ...nums,
    numberFormat: (value, options) => {
      calls.push({ value, options });
      return nums.numberFormat(value, options);
    },
  };
  const trade = evaluateSource(
    "packages/kit/src/views/Perp/components/OrderInfoPanel/Components/tradeFillDisplay.ts",
    {
      mocks: {
        "@onekeyhq/shared/src/locale": {
          ETranslations: new Proxy({}, { get: (_, k) => k }),
        },
        "@onekeyhq/shared/src/utils/numberUtils": format,
        "@onekeyhq/shared/src/utils/perpsUtils": perpsUtils(),
        "../utils": {
          getFillDirectionDisplayInfo: () => {
            throw Error("Direction outside this fixture");
          },
        },
      },
    },
  );
  for (const [coin, price] of [
    ["@107", "0.0000006"],
    ["BTC", "0.000001"],
  ])
    test(`D17-28/30 ${locale}/${coin}: raw amount retains float tail and uses spot/perp precision`, () => {
      calls.length = 0;
      const result = trade.getTradeFillDisplayInfo({
        coin,
        px: "0.0000006",
        sz: "18333333.3000000007",
        fee: "0.125",
        feeToken: "USDC",
      });
      assert.equal(result.priceFormatted, price);
      assert.equal(result.sizeFormatted, "18,333,333.3");
      assert.equal(result.tradeValueFormatted, "$11.00");
      assert.equal(
        calls.find(
          (c) => c.options.formatter === "value" && c.value !== "0.125",
        )?.value,
        "10.99999998000000042",
        "raw px×raw sz, never the displayed rounded price/size",
      );
      assert.equal(result.feeFormatted, "$0.13");
      assert.doesNotMatch(JSON.stringify(result), /NaN|Infinity/);
    });
  for (const [feeToken, expected] of [
    ["USDC", "$0.13"],
    ["UBTC", "0.125 BTC"],
    ["USDT", "0.125 USDT"],
  ])
    test(`D17-29 ${locale} real formatter fee unit ${feeToken}`, () => {
      const result = trade.getTradeFillDisplayInfo({
        coin: "@142",
        px: "100000",
        sz: "0.001",
        fee: "0.125",
        feeToken,
      });
      assert.equal(result.feeFormatted, expected);
      assert.equal(
        trade
          .getTradeFillClosePnlBN({
            closedPnl: "-0.001",
            fee: "0.125",
            feeToken,
          })
          .toFixed(),
        feeToken === "USDC" ? "-0.126" : "-0.001",
      );
    });
  test(`D17-28 ${locale} raw large quantity excludes grouping before multiplication`, () => {
    calls.length = 0;
    const result = trade.getTradeFillDisplayInfo({
      coin: "xyz:BTC",
      px: "1.23",
      sz: "18333333.3000000007",
      fee: "0",
      feeToken: "USDC",
    });
    assert.equal(
      calls.find((c) => c.options.formatter === "value" && c.value !== "0")
        ?.value,
      "22549999.959000000861",
    );
    assert.equal(result.tradeValueFormatted, "$22,549,999.96");
  });
}
