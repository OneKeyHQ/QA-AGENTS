import test from "node:test";
import assert from "node:assert/strict";
import { tradeButtonFixture } from "./trade-button-fixture.mjs";
import { minimumFlowFixture } from "./minimum-flow-fixture.mjs";
for (const skipOrderConfirm of [false, true])
  test(`D08-121 actual live button debounce uses leading-only 1000ms, skip=${skipOrderConfirm}`, async () => {
    const f = await tradeButtonFixture({ skipOrderConfirm });
    const kind = skipOrderConfirm ? "submit" : "confirm";
    try {
      await f.press();
      assert.equal(f.events.filter((x) => x[0] === kind).length, 1);
      await f.press();
      await f.tick(500);
      await f.press();
      await f.tick(499);
      await f.press();
      assert.equal(f.events.filter((x) => x[0] === kind).length, 1);
      await f.tick(1000);
      assert.equal(
        f.events.filter((x) => x[0] === kind).length,
        1,
        "No trailing submission after the burst",
      );
      await f.press();
      assert.equal(f.events.filter((x) => x[0] === kind).length, 2);
      assert.deepEqual(
        f.events.filter((x) => x[0] === kind).map((x) => x[1]),
        ["long", "long"],
      );
    } finally {
      await f.close();
    }
  });
test("D08-121 actual button after unmount cannot emit delayed trailing action", async () => {
  const f = await tradeButtonFixture();
  await f.press();
  await f.press();
  await f.close();
  await f.tick(2000);
  assert.equal(f.events.filter((x) => x[0] === "confirm").length, 1);
});
test("D08-121 actual disabled trading permission is inert even with valid local validation", async () => {
  let validations = 0;
  const f = await tradeButtonFixture({
    validate: () => {
      validations++;
    },
  });
  try {
    f.state.canTrade = false;
    await f.press();
    assert.equal(validations, 0);
    assert.deepEqual(f.events, []);
  } finally {
    await f.close();
  }
});
for (const type of ["triggerMarket", "triggerLimit"])
  for (const size of ["", "0", "0.099999"])
    test(`D08-33/39/127/128 actual conditional validation blocks live press ${type}/${JSON.stringify(size)}`, async () => {
      const minimum = await minimumFlowFixture({
        token: size,
        referencePrice: "100",
        midPrice: "100",
        precision: 6,
        formOverrides: {
          orderMode: "trigger",
          triggerOrderType: type,
          triggerPrice: "110",
          executionPrice: "100",
        },
      });
      const f = await tradeButtonFixture({
        validate: () => minimum.validate(),
      });
      try {
        await f.press();
        assert.equal(minimum.toasts.length, 1);
        assert.match(minimum.toasts[0].title, /仓位大小必须至少/u);
        assert.equal(minimum.toasts[0].actions.props.children, "填入最小金额");
        assert.deepEqual(
          f.events.map((x) => x[0]),
          ["log"],
        );
        assert.equal(f.events[0][1], "invalid");
        assert.equal(f.events[0][2], size ? "minimumOrderNotMet" : "emptySize");
        await minimum.fill();
        await f.tick(1000);
        await f.press();
        assert.equal(
          f.events.filter((x) => x[0] === "confirm").length,
          1,
          "Positive control: filled minimum reaches confirmation sink only",
        );
        assert.equal(f.events.filter((x) => x[0] === "submit").length, 0);
      } finally {
        await f.close();
        await minimum.close();
      }
    });
