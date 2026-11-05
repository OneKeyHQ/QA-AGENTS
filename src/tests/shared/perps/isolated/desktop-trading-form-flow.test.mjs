import test from "node:test";
import assert from "node:assert/strict";
import { confirmPanel } from "./twap-flow-fixture.mjs";
import { tradingFormFixture } from "./trading-form-fixture.mjs";
const plain = (v) => JSON.parse(JSON.stringify(v));
const typeSelect = (f) =>
  f.nodes("Select").find((n) => n.props.testID === "perp-select");
const check = (f, id) => f.nodes("Checkbox").find((n) => n.props.testID === id);
const underline = (f) =>
  f
    .nodes("YStack")
    .filter(
      (n) =>
        n.props.position === "absolute" &&
        n.props.bottom === 0 &&
        n.props.bg === "$text",
    );
const fields = (f) => f.nodes("PriceInput").map((n) => n.props);
test("D08-16/D11-30 complete Desktop form three tabs, remembered advanced type, exact options and selected underline", async () => {
  const f = await tradingFormFixture();
  try {
    assert.deepEqual(f.texts().slice(0, 3), [
      "市价单",
      "限价单",
      "市价止盈止损",
    ]);
    assert.equal(underline(f).length, 1);
    assert.deepEqual(
      plain(typeSelect(f).props.items).map((i) => [i.label, i.value]),
      [
        ["市价止盈止损", "triggerMarket"],
        ["限价止盈止损", "triggerLimit"],
        ["分段委托", "scale"],
        ["分时委托", "twap"],
      ],
    );
    assert.equal(typeSelect(f).props.value, "triggerMarket");
    assert.equal(fields(f).length, 0);
    await f.clickText("市价止盈止损");
    assert.equal(f.state.form.orderMode, "trigger");
    assert.equal(underline(f).length, 1);
    assert.equal(
      f.nodes("Icon").some((n) => n.props.name === "ChevronTopSmallOutline"),
      false,
    );
    await f.clickText("市价止盈止损");
    assert.ok(
      f.nodes("Icon").some((n) => n.props.name === "ChevronTopSmallOutline"),
    );
    await f.advanced("twap");
    await f.clickText("限价单");
    assert.equal(f.state.form.orderMode, "standard");
    assert.ok(f.texts().includes("分时委托"));
    await f.clickText("分时委托");
    assert.equal(f.state.form.orderMode, "twap");
    assert.equal(underline(f).length, 1);
  } finally {
    await f.close();
  }
});
for (const type of ["triggerMarket", "triggerLimit"])
  test(`D08-16 complete conditional fields, fresh reduce-only and no attached TPSL ${type}`, async () => {
    const f = await tradingFormFixture();
    try {
      await f.advanced(type);
      assert.deepEqual(
        fields(f).map((p) => [p.label ?? "", p.placeholder]),
        type === "triggerMarket"
          ? [["触发价格", "输入触发价格"]]
          : [
              ["触发价格", "输入触发价格"],
              ["", "输入执行价格"],
            ],
      );
      assert.equal(
        check(f, "perp-trigger-reduce-only-checkbox").props.value,
        true,
      );
      assert.equal(f.nodes("TpSlInput").length, 0);
      assert.equal(f.nodes("Checkbox").length, 1);
      await f.clickText("市价单");
      assert.equal(fields(f).length, 0);
      await f.clickText("限价单");
      assert.equal(fields(f).length, 1);
      assert.ok(!fields(f).some((p) => /触发|执行/.test(p.placeholder ?? "")));
    } finally {
      await f.close();
    }
  });
test("D08-16/D11-34 complete form mode changes clear populated TPSL and BBO while retaining independent parameters", async () => {
  const f = await tradingFormFixture({
    form: {
      side: "short",
      size: "2",
      sizePercent: 50,
      sizeInputMode: "slider",
      hasTpsl: true,
      tpTriggerPx: "130",
      slTriggerPx: "70",
      bboPriceMode: { type: "counterparty", offsetTicks: 0 },
      twapDurationMinutes: "360",
      twapRandomize: false,
      twapReduceOnly: true,
      scaleLowerPrice: "90",
      scaleUpperPrice: "110",
      scaleOrderCount: "10",
      scaleTif: "Ioc",
      scaleSizeDistribution: "increasing",
      scaleReduceOnly: true,
    },
  });
  try {
    for (const mode of ["triggerMarket", "scale", "twap", "triggerLimit"]) {
      await f.advanced(mode);
      assert.equal(f.state.form.side, "short");
      assert.equal(f.state.form.size, "2");
      assert.equal(f.state.form.sizePercent, 50);
      assert.equal(f.state.form.hasTpsl, false);
      assert.equal(f.state.form.tpTriggerPx, "");
      assert.equal(f.state.form.slTriggerPx, "");
      assert.equal(f.state.form.bboPriceMode, null);
      assert.equal(f.state.form.twapDurationMinutes, "360");
      assert.equal(f.state.form.twapRandomize, false);
      assert.equal(f.state.form.twapReduceOnly, true);
      assert.equal(f.state.form.scaleLowerPrice, "90");
      assert.equal(f.state.form.scaleUpperPrice, "110");
      assert.equal(f.state.form.scaleOrderCount, "10");
      assert.equal(f.state.form.scaleTif, "Ioc");
      assert.equal(f.state.form.scaleSizeDistribution, "increasing");
      assert.equal(f.state.form.scaleReduceOnly, true);
    }
  } finally {
    await f.close();
  }
});
for (const mode of ["perp", "spot"])
  for (const type of ["twap", "scale"])
    test(`D11-32/33/275/276 complete fresh Desktop ${mode}/${type} fields and defaults`, async () => {
      const f = await tradingFormFixture({ mode });
      try {
        await f.advanced(type);
        assert.equal(f.nodes("LeverageModal").length, mode === "spot" ? 0 : 1);
        assert.equal(f.nodes("MarginMode").length, mode === "spot" ? 0 : 1);
        assert.equal(f.texts().includes("当前持仓"), mode === "perp");
        assert.equal(f.nodes("SizeInput").length, 1);
        assert.equal(f.nodes("Slider").length, 1);
        assert.equal(
          f.nodes("SizeInput")[0].props.allowMarginInput,
          mode === "perp",
        );
        if (type === "twap") {
          assert.equal(
            check(f, "perp-twap-randomize-checkbox").props.value,
            true,
          );
          assert.equal(
            f
              .nodes("Input")
              .find((n) => n.props.testID === "perp-twap-duration-hours-input")
              .props.value,
            "0",
          );
          assert.equal(
            f
              .nodes("Input")
              .find(
                (n) => n.props.testID === "perp-twap-duration-minutes-input",
              ).props.value,
            "10",
          );
          assert.deepEqual(
            f.texts().filter((t) => ["6h", "12h", "24h", "7d"].includes(t)),
            ["6h", "12h", "24h", "7d"],
          );
          assert.equal(
            check(f, "perp-twap-reduce-only-checkbox")?.props.value,
            mode === "spot" ? undefined : false,
          );
          assert.ok(
            f
              .nodes("DashText")
              .some((n) =>
                n.children.some(
                  (c) => typeof c === "string" && c.includes("每笔子订单金额"),
                ),
              ),
          );
        } else {
          assert.deepEqual(
            fields(f).map((n) => n.label),
            ["价格下限", "价格上限"],
          );
          assert.equal(f.nodes("FormInput")[0].props.value, "5");
          assert.equal(f.state.form.scaleSizeDistribution, "fixed");
          assert.equal(
            check(f, "perp-scale-reduce-only-checkbox")?.props.value,
            mode === "spot" ? undefined : false,
          );
          assert.equal(
            f
              .nodes("Button")
              .filter((n) => n.props.testID === "perp-scale-tif-selector")
              .length,
            mode === "spot" ? 0 : 1,
          );
        }
      } finally {
        await f.close();
      }
    });
test("D11-35/277/278 actual spot form excludes conditional choices, falls back and preserves independent advanced drafts", async () => {
  const f = await tradingFormFixture();
  try {
    await f.advanced("triggerLimit");
    await f.update({ mode: "spot" });
    assert.equal(f.state.form.orderMode, "standard");
    assert.equal(f.state.form.type, "market");
    assert.deepEqual(
      plain(typeSelect(f).props.items).map((i) => i.value),
      ["scale", "twap"],
    );
    assert.ok(f.texts().includes("分段委托"));
    await f.advanced("twap");
    assert.equal(check(f, "perp-twap-reduce-only-checkbox"), undefined);
    await f.update({ mode: "perp" });
    assert.ok(check(f, "perp-twap-reduce-only-checkbox"));
    assert.equal(f.state.form.twapDurationMinutes, "10");
    assert.equal(f.state.form.twapRandomize, true);
  } finally {
    await f.close();
  }
});
for (const type of ["triggerMarket", "triggerLimit", "scale"])
  test(`D08-38/D11-116 real nested input pipeline rejects invalid price ${type}`, async () => {
    const f = await tradingFormFixture();
    try {
      await f.advanced(type);
      for (let i = 0; i < fields(f).length; i++) {
        for (const raw of [
          "-1",
          "abc",
          "00",
          "01",
          "NaN",
          "Infinity",
          "1e3",
          "1.2.3",
          "12.3456789",
        ]) {
          const input = () => f.nodes("Input")[i];
          const before = input().props.value;
          await f.action(() => input().props.onChangeText(raw));
          assert.equal(input().props.value, before, raw);
        }
        await f.action(() => f.nodes("Input")[i].props.onChangeText("1。2"));
        assert.equal(f.nodes("Input")[i].props.value, "1.2");
        await f.action(() => f.nodes("Input")[i].props.onChangeText("0"));
        assert.equal(f.nodes("Input")[i].props.value, "0");
      }
      assert.equal(underline(f).length, 1);
    } finally {
      await f.close();
    }
  });
test("D11-131/132/133 actual scale order count rejects >100, decimal and alphabet, accepts empty/0/1 for submit validation", async () => {
  const f = await tradingFormFixture();
  try {
    await f.advanced("scale");
    const input = () => f.nodes("FormInput")[0].findByType("Input");
    await f.action(() => input().props.onChangeText("10"));
    for (const raw of ["101", "1.5", "abc", "-1"]) {
      await f.action(() => input().props.onChangeText(raw));
      assert.equal(f.state.form.scaleOrderCount, "10");
    }
    for (const raw of ["0", "1", ""]) {
      await f.action(() => input().props.onChangeText(raw));
      assert.equal(f.state.form.scaleOrderCount, raw);
    }
    assert.equal(
      f.nodes("SizableText").filter((n) => n.props.color === "$red10").length,
      0,
    );
  } finally {
    await f.close();
  }
});
test("D11-143/147 actual distribution radios change only distribution and keep full draft", async () => {
  const f = await tradingFormFixture({
    form: { size: "2", scaleLowerPrice: "90", scaleUpperPrice: "110" },
  });
  try {
    await f.advanced("scale");
    const before = plain(f.state.form);
    for (const label of ["递增", "固定"]) {
      await f.clickText(label);
      assert.deepEqual(
        {
          ...plain(f.state.form),
          scaleSizeDistribution: before.scaleSizeDistribution,
        },
        before,
      );
      assert.equal(
        f.state.form.scaleSizeDistribution,
        label === "递增" ? "increasing" : "fixed",
      );
      const radios = f
        .nodes("XStack")
        .filter((n) => n.props.borderWidth === 1.5);
      assert.deepEqual(
        radios.map((n) => n.props.borderColor),
        label === "递增"
          ? ["$borderStrong", "$borderActive"]
          : ["$borderActive", "$borderStrong"],
      );
      assert.equal(
        f.nodes("XStack").filter((n) => n.props.bg === "$iconInverse").length,
        1,
      );
    }
    const tooltip = f
      .nodes("DashText")
      .find((n) => n.props.tooltip?.includes("固定："));
    assert.ok(tooltip);
    assert.equal(
      tooltip.props.tooltip,
      "固定：每笔委托数量相同；递增：价格越优的委托数量越大，买入价格更低、卖出价格更高。",
    );
  } finally {
    await f.close();
  }
});
test("D11-161/166/247 actual TIF title, three translated descriptions, unique checked item and close after select", async () => {
  const f = await tradingFormFixture();
  try {
    await f.advanced("scale");
    const trigger = () =>
      f
        .nodes("Button")
        .find((n) => n.props.testID === "perp-scale-tif-selector");
    await f.action(() => trigger().props.onPress());
    const pop = () =>
      f.nodes("Popover").find((n) => n.props.title === "订单有效期");
    assert.equal(pop().props.open, true);
    const options = () =>
      f.nodes("Button").filter((n) => n.props.testID?.includes("-option-"));
    assert.deepEqual(
      options().map((n) => n.findByType("Heading").children.join("")),
      ["GTC", "IOC", "ALO"],
    );
    assert.equal(
      options().filter((n) =>
        n.findAllByType("Icon").some((i) => i.props.name === "CheckRadioSolid"),
      ).length,
      1,
    );
    assert.deepEqual(
      options().map((n) =>
        n
          .findAllByType("SizableText")
          .map((t) => t.children.join(""))
          .find((t) => t.length > 8),
      ),
      [
        "GTC（取消前有效）：订单会一直保留，直到成交或被取消。",
        "IOC（立即成交否则取消）：未立即成交的部分会被取消。",
        "ALO（只做挂单）：订单只会以限价挂单方式留在订单簿中，也叫 Post-only。",
      ],
    );
    await f.action(() => options()[1].props.onPress());
    assert.equal(f.state.form.scaleTif, "Ioc");
    assert.equal(pop().props.open, false);
    await f.clickText("市价单");
    await f.advanced("scale");
    assert.equal(f.state.form.scaleTif, "Ioc");
  } finally {
    await f.close();
  }
});
test("D11-328/329 actual duration presets and text normalization produce one current form value", async () => {
  const f = await tradingFormFixture();
  try {
    await f.advanced("twap");
    for (const [label, value] of [
      ["6h", "360"],
      ["12h", "720"],
      ["24h", "1440"],
      ["7d", "10080"],
    ]) {
      await f.clickText(label);
      assert.equal(f.state.form.twapDurationMinutes, value);
    }
    const inp = (id) =>
      f
        .nodes("Input")
        .find((n) => n.props.testID === "perp-twap-duration-" + id + "-input");
    await f.action(() => inp("hours").props.onChangeText("0"));
    await f.action(() => inp("minutes").props.onChangeText("120"));
    await f.action(() => inp("minutes").props.onBlur());
    assert.equal(f.state.form.twapDurationMinutes, "120");
    assert.equal(inp("hours").props.value, "2");
    assert.equal(inp("minutes").props.value, "0");
    await f.action(() => inp("hours").props.onChangeText("-1"));
    assert.equal(inp("hours").props.value, "1");
    await f.action(() => inp("hours").props.onChangeText("1.5"));
    assert.equal(inp("hours").props.value, "15");
    await f.action(() => inp("hours").props.onChangeText("999999"));
    assert.equal(f.state.form.twapDurationMinutes, "10080");
  } finally {
    await f.close();
  }
});
test("D11-284/285/286 actual spot balance/max display and trade popover reset canonical target", async () => {
  const f = await tradingFormFixture({
    mode: "spot",
    mid: "11",
    form: { side: "long" },
  });
  try {
    assert.ok(f.texts().includes("100 USDC"));
    assert.ok(f.texts().includes("9.09 PURRDAT"));
    assert.equal(f.nodes("LeverageModal").length, 0);
    await f.action(() => f.nodes("SideToggle")[0].props.onChange("short"));
    assert.ok(f.texts().includes("35 PURRDAT"));
    assert.ok(f.texts().includes("385.00 USDC"));
    const p = f.nodes("Popover").find((n) => n.props.title === "添加资金");
    assert.ok(p);
    // Popover content is executed by the actual renderContent callback; layout is local.
    let content;
    await f.action(() => {
      content = p.props.renderContent({ closePopover: () => {} });
    });
    const entries = content.props.children;
    assert.equal(entries.length, 2);
    assert.equal(entries[0].props.title, "充值到账 USDC");
    assert.match(entries[1].props.title, /PURRDAT/);
    await f.action(() => entries[1].props.onPress());
    await Promise.resolve();
    assert.equal(f.events.at(-1)[0], "switch");
    assert.equal(f.events.at(-1)[1].coin, "@1");
    assert.equal(f.state.form.side, "long");
    assert.equal(f.state.form.size, "");
  } finally {
    await f.close();
  }
});

for (const mode of ["perp", "spot"])
  for (const side of ["long", "short"])
    test(`D11-32/275 actual complete ${mode}/${side} advanced TWAP toggle exposes current labels and clears hidden draft`, async () => {
      const f = await tradingFormFixture({
        mode,
        form: { orderMode: "twap", side },
      });
      try {
        const toggle = () =>
          f
            .nodes("Checkbox")
            .find(
              (n) => n.props.testID === "perp-twap-advanced-settings-checkbox",
            );
        assert.ok(toggle());
        assert.equal(toggle().props.value, false);
        assert.equal(fields(f).length, 0);
        await f.action(() => toggle().props.onChange(true));
        assert.equal(toggle().props.value, true);
        assert.deepEqual(
          fields(f).map((p) => p.label),
          ["触发价格", side === "long" ? "价格上限" : "价格下限"],
        );
        await f.action(() => fields(f)[0].onChange("110"));
        await f.action(() =>
          fields(f)[1].onChange(side === "long" ? "120" : "90"),
        );
        assert.equal(f.state.form.twapTriggerPrice, "110");
        assert.equal(
          f.state.form.twapStopPrice,
          side === "long" ? "120" : "90",
        );
        await f.action(() => toggle().props.onChange(false));
        assert.equal(fields(f).length, 0);
        assert.equal(f.state.form.twapTriggerPrice, "");
        assert.equal(f.state.form.twapStopPrice, "");
        assert.equal(
          f
            .nodes("Input")
            .find((n) => n.props.testID === "perp-twap-duration-minutes-input")
            .props.value,
          "10",
        );
      } finally {
        await f.close();
      }
    });
for (const [field, value] of [
  ["scaleLowerPrice", ""],
  ["scaleUpperPrice", ""],
  ["scaleLowerPrice", "0"],
  ["scaleUpperPrice", "0"],
  ["scaleOrderCount", ""],
  ["scaleOrderCount", "0"],
  ["scaleOrderCount", "1"],
])
  test(`D11-113/117/131 actual full form accepts ${field}=${value} without inline error`, async () => {
    const f = await tradingFormFixture({
      form: {
        orderMode: "scale",
        scaleLowerPrice: "90",
        scaleUpperPrice: "110",
        scaleOrderCount: "5",
        [field]: value,
      },
    });
    try {
      assert.equal(
        f.nodes("SizableText").filter((n) => n.props.color === "$red10").length,
        0,
      );
      assert.equal(f.state.form[field], value);
    } finally {
      await f.close();
    }
  });
test("D11-114 actual scale equal price red hint belongs below order-count input", async () => {
  const f = await tradingFormFixture({
    form: {
      orderMode: "scale",
      scaleLowerPrice: "90",
      scaleUpperPrice: "90",
      scaleOrderCount: "5",
    },
  });
  try {
    const err = f
      .nodes("SizableText")
      .find((n) => n.children.join("") === "分段委托下限和上限价格不能相同");
    assert.ok(err);
    assert.equal(err.props.color, "$red10");
    let container = err.parent;
    while (container && !container.findAllByType("FormInput").length)
      container = container.parent;
    assert.ok(container);
    assert.equal(container.findAllByType("FormInput")[0].props.value, "5");
  } finally {
    await f.close();
  }
});
for (const mode of ["perp", "spot"])
  for (const distribution of ["fixed", "increasing"])
    test(`D11-147/276 actual scale confirmation ${mode}/${distribution} has exact rows and conditional distribution`, async () => {
      const f = await confirmPanel({
        mode,
        form: {
          orderMode: "scale",
          scaleLowerPrice: "90",
          scaleUpperPrice: "110",
          scaleOrderCount: "5",
          scaleSizeDistribution: distribution,
        },
      });
      try {
        const texts = f.texts();
        assert.deepEqual(texts, [
          "订单类型",
          "分段委托 / 买入",
          "仓位",
          "2.00 BTC",
          "订单价值",
          "$200.00",
          "价格下限",
          "$90",
          "价格上限",
          "$110",
          ...(mode === "perp"
            ? ["数量分配", distribution === "fixed" ? "固定" : "递增"]
            : []),
          "OneKey 费用",
          "0 手续费",
        ]);
        assert.equal(f.events.submits.length, 0);
      } finally {
        await f.close();
      }
    });
