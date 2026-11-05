// Actual confirmation view + order-confirm callback + actual BBO price/calculation hooks.
// Submission ends at an in-memory action sink. No exchange, wallet or signing code loads.
import test from "node:test";
import assert from "node:assert/strict";
import { bboPreviewFixture } from "./bbo-preview-fixture.mjs";
import { confirmPanel } from "./twap-flow-fixture.mjs";
import { expectedBboPrice } from "../bbo-price-evidence.mjs";
for (const spot of [false, true])
  for (const type of ["counterparty", "queue"])
    for (const offsetTicks of [0, 5]) {
      test(`D01-46/56/66/104 actual ${spot ? "spot" : "perp"} ${type}/${offsetTicks} confirmation label and latest raw-book submit price`, async () => {
        const f = await bboPreviewFixture();
        let c;
        try {
          await f.update((s) => {
            s.form = {
              ...s.form,
              side: "long",
              bboPriceMode: { type, offsetTicks },
            };
            if (spot) {
              s.instrument = {
                mode: "spot",
                coin: "@local",
                assetId: 10001,
                universe: {
                  szDecimals: 4,
                  baseSzDecimals: 4,
                  baseName: "HYPE",
                },
              };
              s.book = { ...s.book, coin: "@local" };
            }
          });
          c = await confirmPanel({
            mode: spot ? "spot" : "perp",
            form: f.state.form,
            hookOverrides: f.hooks,
          });
          const label =
            (type === "counterparty" ? "对手价" : "同向价") +
            " " +
            (offsetTicks === 5 ? "5" : "1");
          assert.ok(
            c.texts().includes(label),
            `Actual confirmation must display ${label}`,
          );
          for (const [bid, ask, coin] of [
            ["100", "101", spot ? "@local" : "BTC"],
            ["200", "201", spot ? "@other" : "ETH"],
          ]) {
            await f.update((s) => {
              s.instrument = {
                ...s.instrument,
                coin,
                assetId: spot ? 10002 : 1,
              };
              s.asset = { ...s.asset, coin };
              s.book = { ...s.book, coin, bbo: [{ px: bid }, { px: ask }] };
            });
            for (const side of ["long", "short"]) {
              await f.update((s) => {
                s.form = { ...s.form, side };
              });
              await c.update({ form: f.state.form });
              const expected = expectedBboPrice({
                bid,
                ask,
                side,
                type,
                offsetTicks,
                szDecimals: 4,
                spot,
              });
              const before = c.events.submits.length;
              await c.submit();
              assert.equal(c.events.submits.length, before + 1);
              const submission = c.events.submits.at(-1);
              assert.equal(submission.price, expected);
              assert.equal(submission.formData.price, expected);
              assert.equal(submission.formData.side, side);
              assert.equal(submission.assetId, spot ? 10002 : 1);
              assert.deepEqual(submission.formData.bboPriceMode, {
                type,
                offsetTicks,
              });
              assert.notEqual(
                submission.price,
                "777",
                "Old manual price must not reach local sink",
              );
              assert.ok(c.texts().includes(label));
            }
          }
          assert.equal(c.events.errors.length, 0);
        } finally {
          if (c) await c.close();
          await f.close();
        }
      });
    }
test("D01-46/66 stale BBO confirmation refuses submission until a fresh matching book arrives", async () => {
  const f = await bboPreviewFixture();
  let c;
  try {
    c = await confirmPanel({ form: f.state.form, hookOverrides: f.hooks });
    await f.expire();
    await c.update({});
    await c.submit();
    assert.equal(c.events.submits.length, 0);
    assert.ok(c.events.errors.length > 0);
    await f.update((s) => {
      s.book = { ...s.book, time: s.now, bbo: [{ px: "110" }, { px: "111" }] };
    });
    await c.update({});
    await c.submit();
    assert.equal(c.events.submits.length, 1);
    assert.equal(c.events.submits[0].price, "111");
  } finally {
    if (c) await c.close();
    await f.close();
  }
});
