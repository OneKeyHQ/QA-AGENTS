import test from "node:test";
import assert from "node:assert/strict";
import {
  expectedAddSize,
  expectedAddMax,
  expectedAddPercent,
  expectedAddCost,
  assertAddRawCost,
  expectedAddMinimum,
  assertAddCost,
  projectAddPositionEvidence,
  assertAddEvidence,
} from "../add-position-evidence.mjs";
import { assertInvalidAddClick } from "../desktop-add-position-boundaries.mjs";
test("加仓校验门禁拒绝任何正数量、未知权限和未就绪；不将非法展示冒充非法真实数量", () => {
  const state = {
    canTrade: true,
    ready: true,
    display: "",
    quantity: "",
    price: "100",
  };
  assertInvalidAddClick(state, "quantity");
  assertInvalidAddClick({ ...state, display: "0", quantity: "0" }, "quantity");
  for (const patch of [
    { display: "1" },
    { quantity: "1" },
    { display: "NaN" },
    { quantity: "0.00001" },
    { canTrade: false },
    { canTrade: undefined },
    { ready: false },
    { price: "0" },
  ])
    assert.throws(() =>
      assertInvalidAddClick({ ...state, ...patch }, "quantity"),
    );
});
test("加仓单位按币种精度向下取整，保证金换算使用当前持仓杠杆", () => {
  assert.equal(
    expectedAddSize({
      display: "10",
      unit: "token",
      price: "100",
      leverage: 17,
      decimals: 5,
    }),
    "10",
  );
  assert.equal(
    expectedAddSize({
      display: "10",
      unit: "usd",
      price: "100",
      leverage: 17,
      decimals: 5,
    }),
    "0.1",
  );
  assert.equal(
    expectedAddSize({
      display: "10",
      unit: "margin",
      price: "100",
      leverage: 17,
      decimals: 5,
    }),
    "1.7",
  );
  assert.equal(
    expectedAddSize({
      display: "10",
      unit: "usd",
      price: "81392",
      leverage: 17,
      decimals: 5,
    }),
    "0.00012",
  );
  assert.equal(
    expectedAddSize({
      display: "0.01",
      unit: "usd",
      price: "81392",
      leverage: 17,
      decimals: 5,
    }),
    "0",
  );
  assert.equal(
    expectedAddCost({ quantity: "0.01234", price: "81392", leverage: 17 }),
    "59.08",
  );
  assert.equal(
    expectedAddCost({ quantity: "0.1", price: "100", leverage: 17 }),
    "0.59",
  );
  assert.equal(
    expectedAddCost({ quantity: "1.005", price: "1", leverage: 1 }),
    "1.01",
  );
  assertAddCost("$1,000.00", "1000");
  for (const bad of ["$999.99", "--", "$1K", "NaN"])
    assert.throws(() => assertAddCost(bad, "1000"));
});
test("最小金额提示必须向上规整；成本原值不允许用相同两位小数蒙混", () => {
  const fixture = { price: "100", leverage: 17, decimals: 5, symbol: "BTC" };
  assert.equal(
    expectedAddMinimum({ ...fixture, unit: "token" }),
    "0.10000 BTC",
  );
  assert.equal(expectedAddMinimum({ ...fixture, unit: "usd" }), "$10.00");
  assert.equal(expectedAddMinimum({ ...fixture, unit: "margin" }), "$0.59");
  assert.equal(
    expectedAddMinimum({ ...fixture, price: "81392", unit: "token" }),
    "0.00013 BTC",
  );
  assert.equal(
    expectedAddMinimum({ ...fixture, price: "81392", unit: "usd" }),
    "$10.59",
  );
  assertAddRawCost("0.58823529411764705882", {
    quantity: "0.1",
    price: "100",
    leverage: 17,
  });
  assert.throws(() =>
    assertAddRawCost("0.5883", { quantity: "0.1", price: "100", leverage: 17 }),
  );
});
test("加仓滑杆独立上限覆盖多空和价格占用保证金差异，不超过原始容量", () => {
  const base = { maximum: "2.123456", mark: "100", price: "80", decimals: 5 };
  assert.equal(
    expectedAddMax({ ...base, type: "market", side: "long" }),
    "2.12345",
  );
  assert.equal(
    expectedAddMax({ ...base, type: "limit", side: "long" }),
    "2.65432",
  );
  assert.equal(
    expectedAddMax({ ...base, type: "limit", side: "short" }),
    "2.12345",
  );
  assert.equal(
    expectedAddMax({ ...base, price: "120", type: "limit", side: "short" }),
    "1.76954",
  );
  for (const [percent, want] of [
    [0, "0"],
    [50, "1.06172"],
    [100, "2.12345"],
  ])
    assert.equal(
      expectedAddPercent({ maximum: "2.12345", percent, decimals: 5 }),
      want,
    );
  for (const percent of [-1, 101, NaN, Infinity, 12.5])
    assert.throws(() =>
      expectedAddPercent({ maximum: "1", percent, decimals: 5 }),
    );
});
test("加仓只读投影拒绝错账户、错币、未就绪和冲突来源，绝不调用事件", () => {
  const account = "0x" + "1".repeat(40),
    sample = { coin: "BTC", szi: "1", leverage: { value: 17 } };
  const data = {
    coin: "BTC",
    user: account,
    markPx: "100",
    maxTradeSzs: ["2", "3"],
  };
  const parent = {
    type: { displayName: "AddPositionForm" },
    memoizedState: { memoizedState: data, next: null },
  };
  const f = {
    memoizedProps: {
      testID: "perp-add-position-amount-input",
      referencePrice: "100",
      value: "0.1",
      side: "long",
      leverage: 17,
      sizeInputMode: "manual",
      sliderPercent: 0,
      activeAsset: { coin: "BTC", universe: { szDecimals: 5 } },
      isAssetCtxReady: true,
      allowMarginInput: true,
      onChange() {
        throw Error("Must not call");
      },
    },
    return: parent,
  };
  const result = projectAddPositionEvidence(f, { value: "10" });
  assert.equal(result.quantity, "0.1");
  assert.equal(result.display, "10");
  assertAddEvidence(result, sample, account);
  for (const bad of [
    { ...result, coin: "ETH" },
    { ...result, ready: false },
    { ...result, raw: [] },
    { ...result, raw: [...result.raw, ...result.raw] },
    { ...result, raw: [{ ...result.raw[0], account: "0x" + "2".repeat(40) }] },
  ])
    assert.throws(() => assertAddEvidence(bad, sample, account));
  assert.throws(() => projectAddPositionEvidence({}, { value: "1" }));
});
