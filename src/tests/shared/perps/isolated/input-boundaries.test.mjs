import test from "node:test";
import assert from "node:assert/strict";
import {
  React,
  renderer,
  perpsUtils,
  evaluateSource,
  BigNumber,
} from "./source.mjs";
const utils = perpsUtils();
test("搜索匹配词去首尾空白及64字符边界，不要求UI输入框截断", () => {
  const { normalizeSearchQuery } = evaluateSource(
    "packages/kit/src/views/Perp/hooks/usePerpTokenSelector.ts",
    { names: ["normalizeSearchQuery"] },
  );
  assert.equal(normalizeSearchQuery("   "), "");
  assert.equal(normalizeSearchQuery("  BTC  "), "BTC");
  assert.equal(normalizeSearchQuery("A".repeat(64)), "A".repeat(64));
  assert.equal(normalizeSearchQuery("A".repeat(64) + "ETH"), "A".repeat(64));
  assert.equal(
    normalizeSearchQuery("  " + "比".repeat(200) + "  "),
    "比".repeat(64),
  );
});
const inputs = [
  ["", true],
  ["0", true],
  ["0.", true],
  ["0.01", true],
  ["1", true],
  ["12.34", true],
  ["999999999999", true],
  ["-1", false],
  ["+1", false],
  ["00", false],
  ["01", false],
  ["1e3", false],
  ["1E-3", false],
  ["1,000", false],
  ["NaN", false],
  ["Infinity", false],
  ["∞", false],
  ["abc", false],
  ["1 2", false],
  ["1.2.3", false],
  ["1\n2", false],
  ["１２", false],
  ["0x10", false],
];
for (const [value, expected] of inputs)
  test(`数量格式（2位小数） ${JSON.stringify(value)}`, () =>
    assert.equal(utils.validateSizeInput(value, 2), expected));
for (const precision of [0, 1, 2, 5, 8])
  test(`数量精度截断及小于最小单位 ${precision}`, () => {
    const unit = new BigNumber(10).pow(-precision);
    assert.equal(utils.formatHlSize(unit.div(10), precision), "");
    assert.equal(utils.formatHlSize(unit, precision), unit.toFixed());
    assert.equal(
      utils.formatHlSize(unit.times(1.9), precision),
      unit.toFixed(),
    );
    assert.equal(
      utils.validateSizeInput(
        precision ? "1." + "1".repeat(precision + 1) : "1.1",
        precision,
      ),
      false,
    );
  });
for (const name of ["validatePriceInput", "validateSpotPriceInput"]) {
  for (const [value, expected] of inputs.filter(
    ([v]) => !["0.01", "12.34"].includes(v),
  ))
    test(`${name} 非法字符与空/零边界 ${JSON.stringify(value)}`, () =>
      assert.equal(utils[name](value, 2), expected));
}
test("价格有效位数、现货/合约精度、中文句号转换", () => {
  assert.equal(utils.validatePriceInput("12.345", 2), true);
  assert.equal(utils.validatePriceInput("12.3456", 2), false);
  assert.equal(utils.validatePriceInput("10000.0", 2), false);
  assert.equal(utils.validatePriceInput("100000", 2), true);
  assert.equal(utils.validatePriceInput("0.00001", 2), false);
  assert.equal(utils.validateSpotPriceInput("0.00001", 2), true);
  assert.equal(utils.validatePriceInput("1。2", 2), true);
});
const conversion = evaluateSource(
  "packages/kit/src/views/Perp/components/TradingPanel/inputs/sizeInputConversion.ts",
  { mocks: { "@onekeyhq/shared/src/utils/perpsUtils": utils } },
);
for (const minimumNotional of [10, 100])
  for (const price of ["0.0000123", "0.12", "79.905", "1843.5", "81300"])
    for (const precision of [0, 2, 5])
      for (const inputMode of ["usd", "token", "margin"])
        test(`最小金额不低估 ${minimumNotional}/${price}/${precision}/${inputMode}`, () => {
          const suggestion = conversion.getPerpsMinimumOrderSuggestion({
            price,
            szDecimals: precision,
            minimumNotional,
            inputMode,
            leverage: 20,
            symbol: "TEST",
          });
          assert.ok(suggestion);
          const sz = new BigNumber(
            inputMode === "token"
              ? suggestion.displayValue
              : conversion.convertPerpsSizeDisplayValueToToken({
                  displayValue: suggestion.displayValue,
                  inputMode,
                  referencePrice: price,
                  leverage: 20,
                  szDecimals: precision,
                }),
          );
          assert.ok(sz.times(price).gte(minimumNotional));
          // One less tradable lot must be too small: ensures upward rounding is minimal.
          if (inputMode === "token")
            assert.ok(
              sz
                .minus(new BigNumber(10).pow(-precision))
                .times(price)
                .lt(minimumNotional),
            );
        });
for (const price of ["", "0", "-1", "NaN", "Infinity"])
  test(`缺失/无效价格不得给出最小金额快捷值 ${price}`, () => {
    assert.equal(
      conversion.getPerpsMinimumOrderSuggestion({
        price,
        szDecimals: 2,
        minimumNotional: 10,
        inputMode: "usd",
        leverage: 20,
        symbol: "TEST",
      }),
      undefined,
    );
    assert.equal(
      conversion.convertPerpsSizeDisplayValueToToken({
        displayValue: "10",
        inputMode: "usd",
        referencePrice: price,
        leverage: 20,
        szDecimals: 2,
      }),
      "",
    );
  });
test("价格组件真实回调转换中文句号，非法字符不通过 validator", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const changes = [];
  const fakeIntl = { formatMessage: ({ id }) => id };
  const { PriceInput } = evaluateSource(
    "packages/kit/src/views/Perp/components/TradingPanel/inputs/PriceInput.tsx",
    {
      mocks: {
        "react-intl": { useIntl: () => fakeIntl },
        "@onekeyhq/shared/src/locale": { ETranslations: {} },
        "@onekeyhq/shared/src/utils/perpsUtils": utils,
        "./TradingFormInput": { TradingFormInput: "TradingFormInput" },
      },
    },
  );
  let tree;
  try {
    await renderer.act(async () => {
      tree = renderer.create(
        React.createElement(PriceInput, {
          value: "",
          onChange: (v) => changes.push(v),
          szDecimals: 2,
        }),
      );
    });
    const props = tree.root.findByType("TradingFormInput").props;
    assert.equal(props.validator("1。2"), true);
    assert.equal(props.validator("-2"), false);
    props.onChange("1。2");
    assert.deepEqual(changes, ["1.2"]);
  } finally {
    if (tree) await renderer.act(async () => tree.unmount());
  }
});
