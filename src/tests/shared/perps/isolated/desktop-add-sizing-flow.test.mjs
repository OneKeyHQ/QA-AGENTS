// Full actual AddPositionForm. UI leaf size/slider remain explicit boundaries;
// service output is local only. No OneKey/CDP/financial request can occur.
import test from "node:test";
import assert from "node:assert/strict";
import { mountAddForm, account } from "./add-position-fixture.mjs";
import {
  expectedAddMax,
  expectedAddPercent,
  assertAddRawCost,
} from "../add-position-evidence.mjs";
for (const isBuy of [true, false])
  for (const price of ["80", "100", "120"])
    for (const percent of [50, 100])
      test(`D13-35 actual add ${isBuy ? "long" : "short"} limit${price} slider${percent} exact quantity, cost and manual reset`, async () => {
        const f = await mountAddForm({ isBuy });
        try {
          await f.limit(price);
          assert.equal(f.one("PerpsSlider").props.disabled, false);
          await f.tick(() => f.one("PerpsSlider").props.onChange(percent));
          assert.equal(f.one("SizeInput").props.sizeInputMode, "slider");
          assert.equal(f.one("SizeInput").props.sliderPercent, percent);
          assert.equal(f.one("PerpsSlider").props.value, percent);
          const maximum = expectedAddMax({
            maximum: isBuy ? "10" : "8",
            mark: "100",
            price,
            type: "limit",
            side: isBuy ? "long" : "short",
            decimals: 5,
          });
          const size = expectedAddPercent({ maximum, percent, decimals: 5 });
          const labels = f
            .find("DashText")
            .filter((n) => n.props.children === "成本");
          assert.equal(labels.length, 1);
          let row = labels[0].parent;
          while (row && row.type !== "XStack") row = row.parent;
          assert.ok(row, "Cost label belongs to actual horizontal row");
          const costs = row.findAllByType("NumberSizeableText");
          assert.equal(
            costs.length,
            1,
            "Exact cost row, not another dollar amount",
          );
          assertAddRawCost(costs[0].props.children, {
            quantity: size,
            price,
            leverage: 10,
          });
          assert.equal(f.calls.orders.length, 0);
          await f.submit();
          assert.equal(f.calls.orders.length, 1);
          assert.equal(f.calls.orders[0].size, size);
          assert.equal(f.calls.orders[0].isBuy, isBuy);
          assert.equal(f.calls.orders[0].expectedAccountAddress, account);
          await f.amount("1");
          assert.equal(f.one("SizeInput").props.sizeInputMode, "manual");
          assert.equal(f.one("SizeInput").props.sliderPercent, 0);
          assert.equal(f.one("PerpsSlider").props.value, 0);
          assert.equal(f.calls.orders.length, 1, "Manual edit never submits");
        } finally {
          await f.close();
        }
      });
for (const isBuy of [true, false])
  test(`D13-52 actual add enable rejection ${isBuy} keeps form and stops local submit`, async () => {
    const f = await mountAddForm({ isBuy });
    try {
      await f.amount("1");
      f.state.ensure = async () => {
        throw Error("本地启用交易被拒绝");
      };
      await f.submit();
      assert.equal(f.calls.ensure, 1);
      assert.equal(f.calls.orders.length, 0);
      assert.equal(f.calls.closed, 0);
      assert.equal(f.one("Button").props.loading, false);
      assert.equal(f.one("SizeInput").props.value, "1");
      assert.equal(f.calls.toasts.at(-1).title, "本地启用交易被拒绝");
      f.state.ensure = async () => {};
      await f.submit();
      assert.equal(f.calls.orders.length, 1);
      assert.equal(f.calls.orders[0].isBuy, isBuy);
    } finally {
      await f.close();
    }
  });
