import test from "node:test";
import assert from "node:assert/strict";
import { bboPreviewFixture } from "./bbo-preview-fixture.mjs";
import { evaluateSource } from "./source.mjs";
import { scopedCallback } from "./scoped-callback.mjs";
import { intl, ETranslations } from "./twap-source-fixture.mjs";
const file =
  "packages/kit/src/views/Perp/components/TradingPanel/TradingButtonGroup.tsx";
const guards = evaluateSource(
  "packages/kit/src/views/Perp/utils/perpsOrderPanelEnableTrading.ts",
  { names: ["shouldDisablePerpsOrderPanelTradingButton"] },
);
for (const kind of ["empty", "wrong coin", "invalid bid", "stale"])
  test(`D01-83 actual ${kind} book propagates to both button disabled and exact localized unavailable label`, async () => {
    const f = await bboPreviewFixture();
    try {
      if (kind === "stale") await f.expire();
      else
        await f.update((s) => {
          if (kind === "empty") s.book = null;
          else if (kind === "wrong coin") s.book = { ...s.book, coin: "ETH" };
          else s.book = { ...s.book, bbo: [{ px: "bad" }, { px: "bad" }] };
        });
      for (const side of ["long", "short"]) {
        assert.equal(f.values[side].error, "bbo_unavailable");
        const globals = {
          ...guards,
          intl,
          ETranslations,
          formData: f.state.form,
          side,
          priceError: f.values[side].error,
          shouldEnableTradingBeforeOrder: false,
          isTradingStatusDisabled: false,
          isNoEnoughMargin: false,
          shouldDisableForAccountLoading: false,
          isSubmitting: false,
          isServerActionDisabled: false,
          perpConfigCommon: {},
          isSpot: false,
          spotTradeSymbol: "",
        };
        assert.equal(
          scopedCallback(
            file,
            "SideButtonInternal",
            "buttonDisabled",
            globals,
          )(),
          true,
        );
        assert.equal(
          scopedCallback(file, "SideButtonInternal", "buttonText", globals)(),
          "最优价不可用",
        );
        const recovered = { ...globals, priceError: null };
        assert.equal(
          scopedCallback(
            file,
            "SideButtonInternal",
            "buttonDisabled",
            recovered,
          )(),
          false,
        );
        assert.notEqual(
          scopedCallback(file, "SideButtonInternal", "buttonText", recovered)(),
          "最优价不可用",
        );
      }
    } finally {
      await f.close();
    }
  });
