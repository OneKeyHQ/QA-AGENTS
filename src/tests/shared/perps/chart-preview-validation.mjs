// Pre-click invariant: no positive quantity ever reaches a chart validation click.
import assert from "node:assert/strict";
export function assertInvalidChartPreview({ quantity, price, kind, canTrade }) {
  assert.equal(
    canTrade,
    true,
    "Existing trading permission required; never enable during validation",
  );
  assert.ok(
    quantity === "" || /^0(?:\.0*)?$/u.test(quantity),
    "Only literal empty/zero quantity may reach a chart validation click",
  );
  assert.ok(["quantity", "price"].includes(kind));
  if (kind === "price")
    assert.ok(
      price === "" || /^0(?:\.0*)?$/u.test(price),
      "Price rejection requires literal empty/zero price",
    );
  else
    assert.ok(
      /^\d+(?:\.\d+)?$/u.test(price) && Number(price) > 0,
      "Quantity rejection requires valid positive price",
    );
}
