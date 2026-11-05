// Bind the Desktop evidence oracle to actual pinned upstream form callbacks.
// Services are inert; this does not connect to OneKey or submit an order.
import test from "node:test";
import assert from "node:assert/strict";
import { formModeFixture } from "./form-mode-fixture.mjs";
import {
  assertAdvancedFormReset,
  assertReturnToStandard,
} from "../form-mode-evidence.mjs";
const plain = (value) => JSON.parse(JSON.stringify(value));
for (const primary of ["market", "limit"])
  for (const inputMode of ["manual", "slider"])
    for (const [value, label] of [
      ["triggerMarket", "市价止盈止损"],
      ["triggerLimit", "限价止盈止损"],
      ["scale", "分段委托"],
      ["twap", "分时委托"],
    ])
      test(`D08-16 actual ${primary}/${inputMode}→${value}→both standard tabs satisfies full reset oracle`, () => {
        const f = formModeFixture();
        Object.assign(f.state.form, {
          type: primary,
          orderMode: "standard",
          size: "0.5",
          sizePercent: inputMode === "slider" ? 50 : 0,
          sizeInputMode: inputMode,
          side: "short",
          price: "99",
          hasTpsl: true,
          bboPriceMode:
            primary === "limit" ? { type: "queue", offsetTicks: 5 } : null,
          tpValue: "120",
          slValue: "80",
          tpTriggerPx: "120",
          slTriggerPx: "80",
          tpGainPercent: "5",
          slLossPercent: "6",
          tpType: "percentage",
          slType: "percentage",
        });
        const before = { ...plain(f.state.form), coin: "BTC" };
        f.advanced(value);
        const advanced = { ...plain(f.state.form), coin: "BTC" };
        assertAdvancedFormReset(before, advanced, label);
        for (const [next, name] of [
          ["market", "市价单"],
          ["limit", "限价单"],
        ]) {
          f.primary(next);
          assertReturnToStandard(
            advanced,
            { ...plain(f.state.form), coin: "BTC" },
            name,
          );
        }
        assert.deepEqual(f.calls, [], "No external order or account action");
      });
