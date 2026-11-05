import test from "node:test";
import assert from "node:assert/strict";
import { triggerOrderFixture } from "./trigger-order-fixture.mjs";
import { minimumFlowFixture } from "./minimum-flow-fixture.mjs";
for (const type of ["triggerMarket", "triggerLimit"])
  for (const side of ["long", "short"])
    for (const triggerPrice of ["90", "110"])
      for (const reduce of [false, true])
        test(`D08-49/50 actual conditional payload ${type}/${side}/${triggerPrice}/reduce=${reduce}`, async () => {
          const f = triggerOrderFixture();
          Object.assign(f.state.form, {
            triggerOrderType: type,
            side,
            triggerPrice,
            triggerReduceOnly: reduce,
          });
          const result = await f.run();
          const expectedTpsl =
            side === "long"
              ? triggerPrice === "110"
                ? "sl"
                : "tp"
              : triggerPrice === "110"
                ? "tp"
                : "sl";
          const market = type === "triggerMarket";
          const expectedPrice = market
            ? String(Number(triggerPrice) * (side === "long" ? 1.05 : 0.95))
            : "105";
          assert.equal(f.calls.length, 1);
          assert.deepEqual(f.calls[0].request, {
            orders: [
              {
                a: 7,
                b: side === "long",
                p: expectedPrice,
                s: "0.2",
                r: reduce,
                t: {
                  trigger: {
                    isMarket: market,
                    triggerPx: triggerPrice,
                    tpsl: expectedTpsl,
                  },
                },
              },
            ],
            grouping: "na",
          });
          assert.deepEqual(f.calls[0].log.extra, {
            triggerOrderType: type,
            isMarket: market,
            tpsl: expectedTpsl,
            reduceOnly: reduce,
          });
          assert.equal(f.calls[0].log.action, "orderTrigger");
          assert.equal(result.response.data.statuses[0].resting.oid, 123);
          assert.deepEqual(f.toastCalls, ["placeOrder"]);
          assert.deepEqual(f.events, [
            ["loading", true],
            "permission",
            ["loading", false],
          ]);
        });
for (const side of ["long", "short"])
  for (const type of ["triggerMarket", "triggerLimit"])
    test(`D08-49/50 actual slider uses side balance and effective price ${side}/${type}`, async () => {
      const f = triggerOrderFixture();
      Object.assign(f.state.form, {
        side,
        triggerOrderType: type,
        size: "999",
        sizeInputMode: "slider",
        sizePercent: 50,
        triggerPrice: "80",
        executionPrice: "125",
      });
      await f.run();
      const quantity =
        side === "long"
          ? type === "triggerMarket"
            ? "1"
            : "0.8"
          : type === "triggerMarket"
            ? "1.5"
            : "1.2";
      assert.equal(f.calls[0].request.orders[0].s, quantity);
      assert.notEqual(quantity, "999");
    });
test("D08-37 exact current price rejects before any raw request and releases loading", async () => {
  const f = triggerOrderFixture();
  f.state.form.triggerPrice = "100";
  await assert.rejects(f.run(), /Trigger price must differ from current price/);
  assert.deepEqual(f.calls, []);
  assert.equal(f.state.loading, false);
  assert.deepEqual(f.events, [
    ["loading", true],
    ["loading", false],
  ]);
});
test("D08-50 default trigger type/reduce-only and explicit parameters override stale atom form", async () => {
  const f = triggerOrderFixture();
  await f.run({
    assetId: 12,
    formData: {
      side: "short",
      size: "0.12345",
      sizeInputMode: "manual",
      triggerPrice: "90",
    },
  });
  assert.deepEqual(f.calls[0].request.orders[0], {
    a: 12,
    b: false,
    p: "85.5",
    s: "0.12345",
    r: true,
    t: { trigger: { isMarket: true, triggerPx: "90", tpsl: "sl" } },
  });
  assert.equal(f.state.form.side, "long");
});
test("D08-50 execution and trigger prices are independently formatted by the actual exchange builder", async () => {
  const f = triggerOrderFixture();
  Object.assign(f.state.form, {
    triggerOrderType: "triggerLimit",
    triggerPrice: "123.456789",
    executionPrice: "98.7654321",
  });
  await f.run();
  assert.equal(f.calls[0].request.orders[0].t.trigger.triggerPx, "123.45");
  assert.equal(f.calls[0].request.orders[0].p, "98.765");
});
test("D08-34 missing execution price cannot reach the raw-order sink", async () => {
  const f = triggerOrderFixture();
  Object.assign(f.state.form, {
    triggerOrderType: "triggerLimit",
    executionPrice: "",
  });
  await assert.rejects(
    f.run(),
    /Limit trigger orders require an execution price/,
  );
  assert.deepEqual(f.calls, []);
  assert.equal(f.state.loading, false);
});
test("D08-121 permission failure reaches neither raw sink nor successful response", async () => {
  const f = triggerOrderFixture({
    gateError: new Error("local permission rejected"),
  });
  await assert.rejects(f.run(), /local permission rejected/);
  assert.deepEqual(f.calls, []);
  assert.equal(f.state.loading, false);
});
test("D08-40/41/121 local server error propagates once, releases loading and permits retry", async () => {
  const f = triggerOrderFixture({
    rawError: new Error(
      "Order price cannot be more than 95% away from reference price",
    ),
  });
  const before = JSON.stringify(f.state.form);
  await assert.rejects(
    f.run(),
    /Failed to place trigger order: Error: Order price cannot be more than 95%/,
  );
  assert.equal(f.calls.length, 1);
  assert.equal(f.state.loading, false);
  assert.equal(JSON.stringify(f.state.form), before); // Action itself does not reset; outer UI reset is separately audited.
  f.state.rawError = undefined;
  await f.run();
  assert.equal(f.calls.length, 2);
  assert.equal(f.state.loading, false);
});
test("D08-121 actual loading remains set until local raw response resolves", async () => {
  let resolve;
  const f = triggerOrderFixture({
    waitRaw: new Promise((r) => {
      resolve = r;
    }),
  });
  const task = f.run();
  for (let i = 0; i < 10 && f.calls.length === 0; i++) await Promise.resolve();
  assert.equal(f.calls.length, 1);
  assert.equal(f.state.loading, true);
  resolve();
  await task;
  assert.equal(f.state.loading, false);
});
for (const type of ["triggerMarket", "triggerLimit"])
  for (const side of ["long", "short"])
    for (const unit of ["usd", "token", "margin"])
      test(`D08-33/39/127 actual conditional minimum fill ${type}/${side}/${unit}`, async () => {
        const price = type === "triggerMarket" ? "33" : "40";
        const f = await minimumFlowFixture({
          referencePrice: price,
          midPrice: "33",
          precision: 2,
          side,
          unit,
          leverage: 10,
          formOverrides: {
            orderMode: "trigger",
            triggerOrderType: type,
            triggerPrice: "110",
            executionPrice: "40",
          },
        });
        try {
          assert.equal(f.market.values[side].price, price);
          assert.equal(f.validate(), "emptySize");
          const toast = f.toasts.at(-1);
          assert.equal(
            toast.title,
            unit === "token"
              ? `仓位大小必须至少 ${type === "triggerMarket" ? "0.31" : "0.25"} BTC`
              : `仓位大小必须至少 $${unit === "margin" ? (type === "triggerMarket" ? "1.03" : "1.00") : type === "triggerMarket" ? "10.23" : "10.00"}`,
          );
          assert.equal(toast.message, undefined);
          assert.equal(toast.actions.props.children, "填入最小金额");
          await f.fill();
          assert.equal(
            f.state.token,
            type === "triggerMarket" ? "0.31" : "0.25",
          );
          assert.equal(f.validate(), undefined);
          assert.equal(f.toasts.length, 1);
        } finally {
          await f.close();
        }
      });
for (const type of ["triggerMarket", "triggerLimit"])
  for (const [size, expected] of [
    ["0.099999", "minimumOrderNotMet"],
    ["0.1", undefined],
    ["0.100001", undefined],
  ])
    test(`D08-128 raw conditional notional boundary ${type}/${size}`, async () => {
      const f = await minimumFlowFixture({
        referencePrice: "100",
        midPrice: "100",
        precision: 6,
        token: size,
        formOverrides: {
          orderMode: "trigger",
          triggerOrderType: type,
          triggerPrice: "110",
          executionPrice: "100",
        },
      });
      try {
        assert.equal(f.validate(), expected);
        assert.equal(f.market.values.long.notional, String(Number(size) * 100));
      } finally {
        await f.close();
      }
    });

for (const type of ["triggerMarket", "triggerLimit"]) {
  test(`D08-33/34/37 actual formal trigger guards ${type}`, async () => {
    const f = await minimumFlowFixture({
      referencePrice: "70000",
      midPrice: "70000",
      precision: 5,
      token: "0.01",
      formOverrides: {
        orderMode: "trigger",
        triggerOrderType: type,
        triggerPrice: "",
        executionPrice: "71000",
      },
    });
    try {
      assert.equal(f.validate(), "invalidTriggerPrice");
      assert.equal(f.toasts.at(-1).title, "请输入触发价格");
      await f.update({
        formOverrides: { ...f.state.formOverrides, triggerPrice: "70000" },
      });
      assert.equal(f.validate(), "invalidTriggerPrice");
      assert.equal(
        f.toasts.at(-1).title,
        "Trigger price must differ from current price",
      );
      await f.update({
        formOverrides: {
          ...f.state.formOverrides,
          triggerPrice: "70001",
          executionPrice: type === "triggerLimit" ? "" : "71000",
        },
      });
      assert.equal(
        f.validate(),
        type === "triggerLimit" ? "invalidLimitPrice" : undefined,
      );
      if (type === "triggerLimit") {
        assert.equal(f.toasts.at(-1).title, "输入价格");
        await f.update({
          formOverrides: { ...f.state.formOverrides, executionPrice: "71000" },
        });
        assert.equal(f.validate(), undefined);
      }
    } finally {
      await f.close();
    }
  });
}
