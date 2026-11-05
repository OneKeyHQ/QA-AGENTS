import test from "node:test";
import assert from "node:assert/strict";
import { minimumFlowFixture } from "./minimum-flow-fixture.mjs";
import { tradingFormFixture } from "./trading-form-fixture.mjs";
import { confirmPanel } from "./twap-flow-fixture.mjs";
const base = {
  orderMode: "scale",
  scaleLowerPrice: "90",
  scaleUpperPrice: "110",
  scaleOrderCount: "5",
};
for (const [patch, message] of [
  [{ scaleLowerPrice: "" }, "请填写分段委托价格区间"],
  [{ scaleUpperPrice: "" }, "请填写分段委托价格区间"],
  [{ scaleLowerPrice: "0" }, "请填写分段委托价格区间"],
  [{ scaleUpperPrice: "0" }, "请填写分段委托价格区间"],
  [{ scaleUpperPrice: "90" }, "分段委托下限和上限价格不能相同"],
  [{ scaleOrderCount: "" }, "分段委托笔数需为 2-100 笔"],
  [{ scaleOrderCount: "0" }, "分段委托笔数需为 2-100 笔"],
  [{ scaleOrderCount: "1" }, "分段委托笔数需为 2-100 笔"],
])
  test(`D11-113/114/117/131 actual scale panel validation ${JSON.stringify(patch)}`, async () => {
    const f = await minimumFlowFixture({
      token: "2",
      formOverrides: { ...base, ...patch },
    });
    try {
      assert.equal(f.validate(), "invalidScaleConfig");
      assert.equal(f.toasts.at(-1).title, message);
      assert.equal(f.focus.length, 0);
    } finally {
      await f.close();
    }
  });
for (const spot of [false, true])
  test(`D11-176/178/295 actual scale per-leg small notional hint+guard and corrected count ${spot ? "spot" : "perp"}`, async () => {
    const form = { ...base, scaleOrderCount: "10" },
      p = await tradingFormFixture({
        mode: spot ? "spot" : "perp",
        quantity: ".6",
        form,
      }),
      f = await minimumFlowFixture({ spot, token: ".6", formOverrides: form });
    try {
      const hint = "每笔分段委托金额至少为 $10。请减少委托笔数或增加数量。";
      const n = p
        .nodes("SizableText")
        .find((n) => n.children.join("") === hint);
      assert.ok(n);
      assert.equal(n.props.color, "$textSubdued");
      assert.equal(f.validate(), "invalidScaleConfig");
      assert.equal(f.toasts.at(-1).title, hint);
      await p.update({ form: { ...p.state.form, scaleOrderCount: "5" } });
      await f.update({ formOverrides: { ...form, scaleOrderCount: "5" } });
      assert.ok(!p.texts().includes(hint));
      assert.equal(f.validate(), undefined);
    } finally {
      await p.close();
      await f.close();
    }
  });
for (const spot of [false, true])
  test(`D11-64/180/296 actual advanced insufficient ${spot ? "balance" : "margin"} remains a distinct guard and deposit action`, async () => {
    const f = await minimumFlowFixture({
      spot,
      token: "2",
      formOverrides: base,
    });
    try {
      assert.equal(
        f.validate({ isNoEnoughMargin: true }),
        "insufficientMargin",
      );
      assert.equal(f.toasts.at(-1).title, spot ? "余额不足" : "保证金不足");
      assert.equal(f.toasts.at(-1).actions.props.children, "存款");
    } finally {
      await f.close();
    }
  });
for (const spot of [false, true])
  for (const size of ["", "0", ".9999", "1", "1.0001"])
    test(`D11-59/61/294 actual TWAP raw100 boundary ${spot}/${size}`, async () => {
      const f = await minimumFlowFixture({
        spot,
        token: size,
        precision: 4,
        formOverrides: { orderMode: "twap", twapDurationMinutes: "10" },
      });
      try {
        const bad = !size || Number(size) < 1;
        assert.equal(f.validate(), bad ? "invalidTwapConfig" : undefined);
        if (bad) {
          assert.equal(f.toasts.at(-1).actions.props.children, "填入最小金额");
          assert.match(f.toasts.at(-1).title, /100/);
          await f.fill();
          assert.equal(f.state.token, "1");
          assert.equal(f.validate(), undefined);
        }
      } finally {
        await f.close();
      }
    });
for (const mode of ["twap", "scale"])
  for (const [pos, size, valid] of [
    ["0", "2", false],
    ["2", "2", false],
    ["-2", "3", false],
    ["-2", "2", true],
  ])
    test(`D11-77/79/174/175/177 actual ${mode} reduce-only position ${pos} qty${size}`, async () => {
      const address = "0x" + "1".repeat(40),
        f = await confirmPanel({
          size,
          form: {
            ...base,
            orderMode: mode,
            size,
            twapDurationMinutes: "10",
            twapReduceOnly: mode === "twap",
            scaleReduceOnly: mode === "scale",
          },
          hookOverrides: {
            usePerpsActivePositionAtom: () => [
              {
                accountAddress: address,
                activePositions: [{ position: { coin: "BTC", szi: pos } }],
              },
            ],
          },
        });
      try {
        await f.submit();
        assert.equal(f.events.submits.length, valid ? 1 : 0);
        assert.equal(f.events.resets, valid ? 1 : 0);
        if (!valid) {
          const error = f.events.errors.at(-1);
          assert.equal(error.title, mode === "twap" ? "失败" : "Order Failed");
          assert.equal(
            error.message,
            Math.abs(Number(pos)) < Number(size) && Number(pos) < 0
              ? `只减仓${mode === "twap" ? "分时" : "分段"}委托数量超过当前持仓`
              : `只减仓${mode === "twap" ? "分时" : "分段"}委托需要有反向持仓`,
          );
        } else assert.equal(f.events.submits[0].formData.side, "long");
      } finally {
        await f.close();
      }
    });

for (const duration of ["0", "4", "", undefined, "5", "10080", "10081"])
  test(`D11-47/48 actual duration exact range guard ${String(duration)}`, async () => {
    const f = await minimumFlowFixture({
      token: "",
      formOverrides: { orderMode: "twap", twapDurationMinutes: duration },
    });
    try {
      const invalid =
        duration === undefined ||
        duration === "" ||
        Number(duration) < 5 ||
        Number(duration) > 10080;
      assert.equal(f.validate(), "invalidTwapConfig");
      if (invalid) {
        assert.equal(f.toasts.at(-1).title, "分时委托时长需为 5-10080 分钟");
        assert.equal(f.toasts.at(-1).actions, undefined);
      } else {
        assert.match(f.toasts.at(-1).title, /100/);
        assert.equal(f.toasts.at(-1).actions.props.children, "填入最小金额");
      }
    } finally {
      await f.close();
    }
  });
