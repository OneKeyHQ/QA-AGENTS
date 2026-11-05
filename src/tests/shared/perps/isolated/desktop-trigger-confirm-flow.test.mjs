import test from "node:test";
import assert from "node:assert/strict";
import { triggerOrderFixture } from "./trigger-order-fixture.mjs";
import { scopedCallback } from "./scoped-callback.mjs";
import { evaluateSource } from "./source.mjs";
import { confirmPanel } from "./twap-flow-fixture.mjs";
const attach = (f) => ({
  useHyperliquidActions: () => ({ current: f.actions }),
  useActiveTradeInstrumentAtom: () => [f.state.instrument],
  useTradingFormAtom: () => [f.state.form],
  useTradingLoadingAtom: () => [f.state.loading],
});
for (const type of ["triggerMarket", "triggerLimit"])
  for (const side of ["long", "short"])
    test(`D08-121 actual confirmation -> reset -> submit snapshot -> local server rejection ${type}/${side}`, async () => {
      const f = triggerOrderFixture({
        rawError: new Error("local server HTTP 500"),
      });
      Object.assign(f.state.form, {
        type: type === "triggerMarket" ? "market" : "limit",
        side,
        leverage: 12,
        triggerOrderType: type,
        sizePercent: 35,
        hasTpsl: true,
        tpTriggerPx: "130",
        slTriggerPx: "70",
        tpGainPercent: "10",
        slLossPercent: "5",
        tpValue: "5",
        slValue: "5",
        triggerReduceOnly: false,
      });
      const before = { ...f.state.form };
      const c = await confirmPanel({
        form: before,
        hookOverrides: attach(f),
        mid: "100",
      });
      try {
        assert.ok(
          c
            .texts()
            .includes(
              `${type === "triggerMarket" ? "市价止盈止损" : "限价止盈止损"} / ${side === "long" ? "买入" : "卖出"}`,
            ),
        );
        assert.ok(c.texts().includes("$110"));
        await c.submit();
        await f.settleToasts();
        assert.equal(f.calls.length, 1);
        assert.equal(f.feedback.filter((x) => x.kind === "error").length, 1);
        assert.match(
          f.feedback.find((x) => x.kind === "error").title,
          /local server HTTP 500/,
        );
        assert.equal(f.feedback.filter((x) => x.kind === "success").length, 0);
        assert.equal(f.state.loading, false);
        assert.ok(c.events.closes >= 1);
        for (const key of [
          "size",
          "triggerPrice",
          "executionPrice",
          "tpTriggerPx",
          "slTriggerPx",
          "tpGainPercent",
          "slLossPercent",
          "tpValue",
          "slValue",
        ])
          assert.equal(f.state.form[key], "", key);
        assert.equal(f.state.form.sizePercent, 0);
        assert.equal(f.state.form.hasTpsl, false);
        assert.equal(f.state.form.sizeInputMode, "manual");
        for (const key of [
          "side",
          "leverage",
          "triggerReduceOnly",
          "triggerOrderType",
          "type",
          "orderMode",
        ])
          assert.equal(f.state.form[key], before[key], key);
        assert.equal(f.calls[0].request.orders[0].s, "0.2");
        assert.equal(f.calls[0].request.orders[0].t.trigger.triggerPx, "110");
        assert.equal(f.calls[0].request.orders[0].r, false);
        const resetIndex = f.events.findIndex(
          (e) => Array.isArray(e) && e[0] === "form",
        );
        assert.ok(
          resetIndex >= 0 &&
            resetIndex < f.events.findIndex((e) => e === "permission"),
        );
        assert.equal(f.clock.countTimers(), 0);
      } finally {
        await c.close();
      }
    });
for (const mode of ["perp", "spot"])
  test(`D08-121 actual submit dispatcher rejects changed asset or unsupported ${mode} before raw request`, async () => {
    const f = triggerOrderFixture();
    f.state.instrument.mode = mode;
    await assert.rejects(
      f.actions.submitOrder({ assetId: mode === "perp" ? 8 : 7, price: "0" }),
      mode === "perp" ? /Trading market changed/ : /not supported in spot/,
    );
    assert.deepEqual(f.calls, []);
    assert.equal(f.state.loading, false);
    assert.deepEqual(f.feedback, []);
  });
test("D08-121 actual delayed loading feedback opens at 300ms and closes before success", async () => {
  let release;
  const waitRaw = new Promise((r) => {
    release = r;
  });
  const f = triggerOrderFixture({ waitRaw });
  const task = f.run();
  for (let i = 0; i < 12 && !f.calls.length; i++) await Promise.resolve();
  await f.clock.tickAsync(299);
  assert.deepEqual(f.feedback, []);
  await f.clock.tickAsync(1);
  assert.equal(f.feedback[0].kind, "loading");
  assert.equal(f.feedback[0].title, "正在下单...");
  release();
  await task;
  assert.deepEqual(
    f.feedback.map((x) => x.kind),
    ["loading", "close", "success"],
  );
  assert.equal(f.clock.countTimers(), 0);
});

test("D08-121 actual live button disabled memo recovers after rejected submission", async () => {
  const f = triggerOrderFixture();
  const disabled = () =>
    scopedCallback(
      "packages/kit/src/views/Perp/components/TradingPanel/TradingButtonGroup.tsx",
      "SideButtonInternal",
      "buttonDisabled",
      {
        ...evaluateSource(
          "packages/kit/src/views/Perp/utils/perpsOrderPanelEnableTrading.ts",
          { names: ["shouldDisablePerpsOrderPanelTradingButton"] },
        ),
        isTradingStatusDisabled: false,
        shouldEnableTradingBeforeOrder: false,
        isNoEnoughMargin: false,
        shouldDisableForAccountLoading: false,
        isSubmitting: f.state.loading,
        priceError: undefined,
        isServerActionDisabled: false,
      },
    )();
  assert.equal(disabled(), false);
  let reject;
  f.state.waitRaw = new Promise((_, r) => {
    reject = r;
  });
  const task = f.run();
  for (let i = 0; i < 12 && !f.calls.length; i++) await Promise.resolve();
  assert.equal(disabled(), true);
  reject(new Error("local delayed HTTP 500"));
  await assert.rejects(task, /local delayed HTTP 500/);
  await f.settleToasts();
  assert.equal(disabled(), false);
  assert.equal(f.calls.length, 1);
  assert.equal(f.feedback.filter((x) => x.kind === "error").length, 1);
});
