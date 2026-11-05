import test from "node:test";
import assert from "node:assert/strict";
import { assertInvalidChartPreview } from "../chart-preview-validation.mjs";
test("图表校验点击拒绝正数量、非法值、未授权及错误价格前置", () => {
  for (const quantity of ["", "0", "0.00"]) {
    assert.doesNotThrow(() =>
      assertInvalidChartPreview({
        quantity,
        price: "100",
        kind: "quantity",
        canTrade: true,
      }),
    );
    for (const price of ["", "0", "0.00"])
      assert.doesNotThrow(() =>
        assertInvalidChartPreview({
          quantity,
          price,
          kind: "price",
          canTrade: true,
        }),
      );
  }
  for (const quantity of ["1", "0.00001", "-1", "NaN", "Infinity", "0e0", " "])
    assert.throws(() =>
      assertInvalidChartPreview({
        quantity,
        price: "100",
        kind: "quantity",
        canTrade: true,
      }),
    );
  for (const canTrade of [false, undefined])
    assert.throws(() =>
      assertInvalidChartPreview({
        quantity: "",
        price: "100",
        kind: "quantity",
        canTrade,
      }),
    );
  assert.throws(() =>
    assertInvalidChartPreview({
      quantity: "",
      price: "",
      kind: "quantity",
      canTrade: true,
    }),
  );
  assert.throws(() =>
    assertInvalidChartPreview({
      quantity: "",
      price: "100",
      kind: "price",
      canTrade: true,
    }),
  );
});
