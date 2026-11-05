// Pinned production arithmetic/formatter cross-check. No TF/CDP coverage claim.
import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateSource,
  evaluateCallback,
  perpsUtils,
  BigNumber,
} from "./source.mjs";
import { numberUtils } from "./number-format-source.mjs";
import {
  expectedAddSize,
  expectedAddMax,
  expectedAddMinimum,
  expectedAddCost,
} from "../add-position-evidence.mjs";
const utils = perpsUtils();
const add = evaluateSource(
  "packages/kit/src/views/Perp/components/OrderInfoPanel/utils/addPosition.ts",
  { mocks: { "@onekeyhq/shared/src/utils/perpsUtils": utils } },
);
const convert = evaluateSource(
  "packages/kit/src/views/Perp/components/TradingPanel/inputs/sizeInputConversion.ts",
  { mocks: { "@onekeyhq/shared/src/utils/perpsUtils": utils } },
);
const number = numberUtils("zh-CN");
test("D13-24/35 独立加仓oracle与固定源码对照：三单位、价格量级、多空与精度", () => {
  for (const price of ["0.00123", "100", "81392"])
    for (const decimals of [0, 2, 5, 8])
      for (const unit of ["token", "usd", "margin"]) {
        const expected = expectedAddSize({
          display: "10",
          unit,
          price,
          leverage: 17,
          decimals,
        });
        let actual;
        const noop = () => {};
        const callback = evaluateCallback(
          "packages/kit/src/views/Perp/components/TradingPanel/inputs/SizeInput.tsx",
          "applyManualInputValue",
          {
            inputMode: unit,
            setIsUserTyping: noop,
            onRequestManualMode: noop,
            setTokenAmount: noop,
            setUsdAmount: noop,
            setMarginAmount: noop,
            onDisplayValueChange: noop,
            onChange: (value) => {
              actual = value;
            },
            preserveRawInputOnEmptyValueRef: { current: null },
            calcTokenFromUsd: (value) =>
              convert.convertPerpsSizeDisplayValueToToken({
                displayValue: value,
                inputMode: "usd",
                referencePrice: price,
                leverage: 17,
                szDecimals: decimals,
              }),
            calcTokenFromMargin: (value) =>
              convert.convertPerpsSizeDisplayValueToToken({
                displayValue: value,
                inputMode: "margin",
                referencePrice: price,
                leverage: 17,
                szDecimals: decimals,
              }),
          },
        );
        callback("10");
        // Production intentionally represents a sub-lot manual result as ''.
        assert.equal(actual || "0", expected);
      }
  for (const price of ["80", "100", "120"])
    for (const side of ["long", "short"])
      for (const type of ["market", "limit"]) {
        const input = {
          maximum: "2.123456",
          mark: "100",
          price,
          type,
          side,
          decimals: 5,
        };
        assert.equal(
          add.computeAddPositionMaxSize({
            isBuy: side === "long",
            orderType: type,
            limitPrice: price,
            markPrice: "100",
            maxTradeSzs: ["2.123456", "2.123456"],
            leverage: 17,
            szDecimals: 5,
          }),
          expectedAddMax(input),
        );
      }
});
test("D13-47 最小金额上取整与成本半入展示分开，边界值逐项对照固定源码", () => {
  for (const price of ["0.00123", "100", "81392"])
    for (const decimals of [0, 2, 5, 8])
      for (const unit of ["token", "usd", "margin"]) {
        const input = { price, leverage: 17, decimals, unit, symbol: "BTC" };
        assert.equal(
          add.buildAddPositionMinimumAmountLabel({
            price,
            leverage: 17,
            szDecimals: decimals,
            sizeInputUnit: unit,
            symbol: "BTC",
          }),
          expectedAddMinimum(input),
        );
      }
  for (const [quantity, price, leverage] of [
    ["0.1", "100", 17],
    ["1.005", "1", 1],
    ["0.01234", "81392", 17],
  ]) {
    const raw = new BigNumber(quantity)
      .times(price)
      .dividedBy(leverage)
      .toFixed();
    const formatted = number
      .numberFormat(raw, {
        formatter: "value",
        formatterOptions: { currency: "$" },
      })
      .replace(/[$,]/gu, "");
    assert.equal(
      Number(formatted),
      Number(expectedAddCost({ quantity, price, leverage })),
    );
  }
});
