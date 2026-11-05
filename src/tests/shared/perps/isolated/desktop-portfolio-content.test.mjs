import test from "node:test";
import assert from "node:assert/strict";
import {
  portfolioContentFixture,
  portfolioFill,
  portfolioHistory,
  portfolioFunding,
  portfolioNow,
} from "./portfolio-content-fixture.mjs";
const plain = (x) => JSON.parse(JSON.stringify(x));
test("D09-182/183 actual four periods independently change spot fills, chart and all scoped counts while final selected scope wins", async () => {
  const day = 86400000,
    history = portfolioHistory();
  const totals = { day: 1, week: 3, month: 7, allTime: 15 };
  for (const [key, value] of history)
    value.pnlHistory = [
      [portfolioNow - 50 * day, "0"],
      [portfolioNow - 1000, key.startsWith("perp") ? "0" : String(totals[key])],
    ];
  const fills = [1000, 2 * day, 10 * day, 40 * day].map((ago, i) =>
    portfolioFill("@107", 2 ** i, { time: portfolioNow - ago }),
  );
  fills.push(portfolioFill("BTC", 123, { time: portfolioNow - 1000 }));
  const f = await portfolioContentFixture({
    history,
    trades: { accountAddress: "0xaaa", fills },
  });
  try {
    await f.selectChart("pnl");
    for (const scope of ["all", "perps", "spot"]) await f.selectPnl(scope);
    for (const [i, period] of ["day", "week", "month", "allTime"].entries()) {
      await f.selectPeriod(period);
      assert.equal(f.chart().data.at(-1)[1], totals[period]);
      assert.equal(
        f.metric("总盈亏")[0].text,
        `+$${totals[period].toFixed(2)}`,
      );
      assert.equal(f.metric("总交易次数")[0].text, String(i + 1));
      assert.equal(f.metric("最多交易")[0].text, "HYPE/USDC");
      assert.equal(
        f.byType("ActionList")[0].props.items.filter((n) => n.extra).length,
        1,
      );
      assert.equal(
        f.byType("ActionList")[0].props.items[2].extra.props.name,
        "CheckLargeOutline",
      );
    }
  } finally {
    await f.close();
  }
});
for (const [score, lev, mmr, label] of [
  [2, 10, 20, "健康"],
  [3, 4, 50, "中等风险"],
  [5, 10, 50, "中等风险"],
  [6, 4, 70, "高风险"],
])
  test(`D09-126 actual weighted score ${score} renders exact translated health label`, async () => {
    const f = await portfolioContentFixture({
      summary: {
        totalNtlPos: String(lev * 100),
        totalMarginUsed: "50",
        totalUnrealizedPnl: "0",
      },
      mmr: { mmrPercent: String(mmr) },
    });
    try {
      const statuses = f
        .texts()
        .filter((s) => ["健康", "中等风险", "高风险"].includes(s));
      assert.deepEqual(statuses, [label]);
    } finally {
      await f.close();
    }
  });
test("D09-220/186 actual English funding includes Others, selected-period empty and total empty text without missing keys", async () => {
  const f = await portfolioContentFixture({
    locale: "en_US",
    funding: Array.from({ length: 7 }, (_, i) =>
      portfolioFunding("C" + i, i + 1),
    ),
  });
  try {
    await f.selectChart("funding");
    assert.deepEqual(
      plain(
        f
          .control("perp-portfolio-chart-type-selector")
          .props.options.map((x) => x.label),
      ),
      ["Value", "P&L", "Funding"],
    );
    assert.ok(f.texts().some((s) => s.startsWith("Others ")));
    await f.update({ funding: [portfolioFunding("BTC", 1, 40 * 86400000)] });
    assert.ok(f.texts().includes("No funding payments"));
    await f.update({ funding: [] });
    assert.ok(f.texts().includes("No funding payments yet"));
    assert.doesNotMatch(
      f.texts().join("|"),
      /perp_portfolio_|\{all\}|global\.others/,
    );
  } finally {
    await f.close();
  }
});
test("D09-175/184 actual net-value and funding data plus account health stay independent of pnl asset filter", async () => {
  const f = await portfolioContentFixture();
  try {
    const health = () =>
      f
        .tree()
        .root.findAll((n) => n.type?.name === "SemiCircleGauge")
        .map((n) => ({
          label: n.props.label,
          value: n.props.value,
          percentage: n.props.percentage,
          color: n.props.color,
        }));
    const originalHealth = plain(health());
    const unchangedMetrics = () =>
      ["账户资产", "可用", "净入金"].map((label) => f.metric(label)[0].text);
    const originalMetrics = unchangedMetrics();
    const netValue = plain(f.chart().data);
    await f.selectChart("funding");
    const funding = plain(f.chart().data);
    for (const scope of ["spot", "perps", "all"]) {
      await f.selectChart("pnl");
      await f.selectPnl(scope);
      assert.deepEqual(plain(health()), originalHealth);
      assert.deepEqual(unchangedMetrics(), originalMetrics);
      await f.selectChart("accountValue");
      assert.deepEqual(plain(f.chart().data), netValue);
      assert.equal(f.byType("ActionList").length, 0);
      await f.selectChart("funding");
      assert.deepEqual(plain(f.chart().data), funding);
      assert.equal(f.byType("ActionList").length, 0);
    }
  } finally {
    await f.close();
  }
});
test("D09-198/199/206 actual funding periods recompute histogram and both distributions while all three historical net summaries stay fixed", async () => {
  const day = 86400000;
  const f = await portfolioContentFixture({
    funding: [
      portfolioFunding("BTC", 3, 1000),
      portfolioFunding("ETH", -1, 2 * day),
      portfolioFunding("SOL", 5, 10 * day),
      portfolioFunding("HYPE", -2, 40 * day),
    ],
  });
  try {
    await f.selectChart("funding");
    for (const [period, net, received, paid] of [
      ["day", 3, 3, 0],
      ["week", 2, 3, 1],
      ["month", 7, 8, 1],
      ["allTime", 5, 8, 3],
    ]) {
      await f.selectPeriod(period);
      assert.equal(
        f.chart().data.reduce((n, [, v]) => n + v, 0),
        net,
        period,
      );
      assert.equal(f.metric("累计收取")[0].text, `$${received.toFixed(2)}`);
      assert.equal(f.metric("累计支付")[0].text, `$${paid.toFixed(2)}`);
      assert.deepEqual(
        ["24小时净额", "7天净额", "累计净额"].map(
          (label) => f.metric(label)[0].text,
        ),
        ["+$3.00", "+$2.00", "+$5.00"],
      );
      const labels = f.texts();
      assert.ok(labels.indexOf("24小时净额") < labels.indexOf("7天净额"));
      assert.ok(labels.indexOf("7天净额") < labels.indexOf("累计净额"));
      for (const label of [
        "未实现盈亏",
        "总盈亏",
        "当前持仓",
        "账户健康度",
        "总交易次数",
      ])
        assert.equal(labels.includes(label), false, label);
      for (const label of ["账户资产", "可用"])
        assert.ok(labels.includes(label), label);
      assert.equal(
        f
          .byType("Button")
          .filter((n) => n.props.testID === "perp-portfolio-buttons-btn")
          .length,
        2,
      );
    }
  } finally {
    await f.close();
  }
});
test("D09-210/217 actual repeated chart and period selection leaves only the final histogram/breakdown or pnl/stats subtree", async () => {
  const f = await portfolioContentFixture();
  try {
    for (const [type, period] of [
      ["funding", "week"],
      ["pnl", "month"],
      ["accountValue", "allTime"],
      ["funding", "day"],
    ]) {
      await f.selectChart(type);
      await f.selectPeriod(period);
    }
    assert.equal(f.chart().seriesType, "histogram");
    assert.equal(
      f.control("perp-portfolio-time-period-presets").props.value,
      "day",
    );
    assert.ok(f.texts().includes("累计收取"));
    assert.equal(f.texts().includes("总交易次数"), false);
    await f.selectChart("pnl");
    assert.equal(f.chart().seriesType, "baseline");
    assert.equal(f.texts().includes("累计收取"), false);
    for (const label of [
      "未实现盈亏",
      "总盈亏",
      "当前持仓",
      "账户健康度",
      "总交易次数",
    ])
      assert.ok(f.texts().includes(label), label);
    assert.equal(f.byType("ActionList").length, 1);
    assert.equal(f.byType("LightweightChart").length, 1);
  } finally {
    await f.close();
  }
});
test("D09-207/229 actual capped service records drive full content histogram, all three summaries and breakdown totals", async () => {
  const { fundingServiceFixture } =
    await import("./funding-service-fixture.mjs");
  const service = fundingServiceFixture();
  let f;
  try {
    // Three excluded old rows deliberately dwarf all retained values. Reusing
    // the unbounded transport response would make every expected total fail.
    service.state.records = Array.from({ length: 2003 }, (_, i) => ({
      time: portfolioNow - (i < 3 ? 2 : 1) * 1000,
      hash: String(i).padStart(5, "0"),
      delta: {
        coin: i % 2 ? "BTC" : "ETH",
        usdc: i < 3 ? "1000000" : i % 2 ? "2" : "-1",
        szi: "1",
        fundingRate: "0.0001",
      },
    }));
    const records = await service.service.getUserFundingHistory({
      accountAddress: "0xaaa",
    });
    assert.equal(service.requests.length, 1);
    assert.equal(records.length, 2000);
    assert.equal(new Set(records.map((r) => r.hash)).size, 2000);
    f = await portfolioContentFixture({ funding: records });
    await f.selectChart("funding");
    for (const label of ["24小时净额", "7天净额", "累计净额"])
      assert.equal(f.metric(label)[0].text, "+$1,000.00", label);
    assert.equal(f.metric("累计收取")[0].text, "$2,000.00");
    assert.equal(f.metric("累计支付")[0].text, "$1,000.00");
    assert.equal(
      f.chart().data.reduce((sum, [, n]) => sum + n, 0),
      1000,
    );
    assert.equal(f.byType("Svg").length, 2);
    assert.doesNotMatch(f.texts().join("|"), /1,000,000/);
  } finally {
    await f?.close();
    service.clear();
  }
});
test("D09-63/64/65/173/174/175 actual Desktop controls, chart options and pnl selector preserve scope", async () => {
  const f = await portfolioContentFixture();
  try {
    assert.deepEqual(
      plain(
        f
          .control("perp-portfolio-chart-type-selector")
          .props.options.map((x) => x.value),
      ),
      ["accountValue", "pnl", "funding"],
    );
    assert.equal(
      f.control("perp-portfolio-chart-type-selector").props.value,
      "accountValue",
    );
    assert.equal(f.chart().seriesType, "dotted-area");
    assert.equal(f.byType("ActionList").length, 0);
    await f.selectChart("pnl");
    assert.equal(f.chart().seriesType, "baseline");
    assert.equal(f.chart().baselineOptions.baseValue.price, 0);
    assert.equal(f.chart().baselineOptions.topLineColor, "#30a46c");
    assert.equal(f.chart().baselineOptions.bottomLineColor, "#e5484d");
    const trigger = f
      .byType("XStack")
      .find((n) => n.props.testID === "perp-portfolio-pnl-type-selector");
    assert.equal(trigger.findByType("SizableText").props.children, "全部");
    assert.equal(
      trigger.findByType("Icon").props.name,
      "ChevronDownSmallOutline",
    );
    assert.equal(
      f.byType("ActionList")[0].props.items[0].extra.props.name,
      "CheckLargeOutline",
    );
    assert.deepEqual(
      plain(f.byType("ActionList")[0].props.items.map((x) => x.label)),
      ["全部", "合约", "现货"],
    );
    assert.equal(
      f.byType("ActionList")[0].props.items.filter((x) => x.extra).length,
      1,
    );
    await f.selectPnl("spot");
    assert.equal(
      f.byType("ActionList")[0].props.items[2].extra.props.name,
      "CheckLargeOutline",
    );
    assert.equal(f.chart().data.at(-1)[1], 10);
    await f.selectChart("accountValue");
    assert.equal(f.byType("ActionList").length, 0);
    assert.equal(f.chart().data.at(-1)[1], 120);
  } finally {
    await f.close();
  }
});
for (const [row, fills, win, loss, rate] of [
  ["D09-95", [], "--", "--", "--"],
  ["D09-96", [portfolioFill("BTC", 20)], "+$20.00", "--", "100.0%"],
  ["D09-97", [portfolioFill("BTC", -20)], "--", "-$20.00", "0.0%"],
  [
    "D09-98",
    [portfolioFill("BTC", 20), portfolioFill("ETH", -10)],
    "+$20.00",
    "-$10.00",
    "50.0%",
  ],
])
  test(`${row} actual full Desktop stats render win/loss/empty values and finite outputs`, async () => {
    const f = await portfolioContentFixture({
      trades: { accountAddress: "0xaaa", fills },
      ...(!fills.length ? { history: [] } : {}),
    });
    try {
      assert.equal(f.metric("平均盈利")[0].text, win);
      assert.equal(f.metric("平均亏损")[0].text, loss);
      assert.equal(f.metric("胜率")[0].text, rate);
      assert.doesNotMatch(f.texts().join("|"), /NaN|Infinity/);
      if (!fills.length) {
        for (const label of ["盈利因子", "最多交易", "交易量"])
          assert.equal(f.metric(label)[0].text, "--", label);
        assert.equal(f.metric("总交易次数")[0].text, "0");
        assert.equal(
          f
            .byType("XStack")
            .filter((n) => n.props.bg === "$neutral5" && n.props.flex === 1)
            .length,
          1,
        );
      }
    } finally {
      await f.close();
    }
  });
for (const [pnl, expected, color] of [
  ["42", "+$42.00", "$green11"],
  ["-25", "-$25.00", "$red11"],
  ["0", "$0.00", "$text"],
])
  test(`D09-93/94 actual history total pnl ${pnl} drives display and color without substituting fill sum`, async () => {
    const f = await portfolioContentFixture({ history: portfolioHistory(pnl) });
    try {
      const v = f.metric("总盈亏")[0];
      assert.equal(v.text, expected);
      assert.equal(v.props.color, color);
    } finally {
      await f.close();
    }
  });
test("D09-93/99 actual no-history fallback uses raw closed pnl sum, while empty fills ignore deposit activity", async () => {
  const f = await portfolioContentFixture({
    history: [],
    deposits: [
      { time: portfolioNow - 1000, delta: { type: "deposit", usdc: "1000" } },
    ],
  });
  try {
    assert.equal(f.metric("总盈亏")[0].text, "+$25.00");
    await f.update({ trades: { accountAddress: "0xaaa", fills: [] } });
    assert.equal(f.metric("总盈亏")[0].text, "$0.00");
    assert.equal(f.metric("总交易次数")[0].text, "0");
  } finally {
    await f.close();
  }
});
test("D09-176/177/178/179/182/183 actual pnl scopes update real fill stats, history, selector and preserve selection across chart switch", async () => {
  const f = await portfolioContentFixture();
  try {
    await f.selectChart("pnl");
    for (const [type, pnl, count] of [
      ["spot", 10, 1],
      ["perps", 15, 2],
      ["all", 25, 3],
    ]) {
      await f.selectPnl(type);
      assert.equal(f.chart().data.at(-1)[1], pnl);
      assert.equal(f.metric("总盈亏")[0].text, `+$${pnl.toFixed(2)}`);
      assert.equal(f.metric("总交易次数")[0].text, String(count));
    }
    await f.selectPnl("spot");
    await f.selectChart("accountValue");
    await f.selectChart("pnl");
    assert.equal(f.chart().data.at(-1)[1], 10);
    assert.ok(f.byType("ActionList")[0].props.items[2].extra);
    await f.selectPeriod("week");
    assert.equal(f.chart().data.at(-1)[1], 10);
    assert.ok(f.byType("ActionList")[0].props.items[2].extra);
  } finally {
    await f.close();
  }
});
test("D09-196/198/199/210/224/230 actual funding view switches histogram, net summaries and right panel, then restores stats", async () => {
  const f = await portfolioContentFixture();
  try {
    await f.selectChart("funding");
    assert.equal(f.chart().seriesType, "histogram");
    assert.equal(f.chart().priceScaleMinimumWidth, 64);
    assert.equal(f.byType("ActionList").length, 0);
    for (const label of ["24小时净额", "7天净额", "累计净额"])
      assert.equal(f.metric(label)[0].text, "+$2.00");
    assert.ok(!f.texts().includes("总交易次数"));
    assert.ok(!f.texts().includes("账户健康度"));
    for (const [period, max] of [
      ["day", 24],
      ["week", 7],
      ["month", 30],
      ["allTime", 30],
    ]) {
      await f.selectPeriod(period);
      assert.ok(f.chart().data.length <= max);
    }
    await f.selectChart("pnl");
    assert.equal(f.chart().seriesType, "baseline");
    assert.ok(f.texts().includes("总交易次数"));
    assert.ok(!f.texts().includes("累计收取"));
  } finally {
    await f.close();
  }
});

// These exercise real render/state transitions. Chart painting, popover geometry
// and the external funding request/cache are verified at their own boundaries.
for (const [type, expected] of [
  [
    "spot",
    {
      胜率: "100.0%",
      盈利因子: "--",
      平均盈利: "+$10.00",
      平均亏损: "--",
      已付手续费: "$0.1",
      最多交易: "HYPE/USDC",
      交易量: "$200",
      总交易次数: "1",
    },
  ],
  [
    "perps",
    {
      胜率: "50.0%",
      盈利因子: "4.00",
      平均盈利: "+$20.00",
      平均亏损: "-$5.00",
      已付手续费: "$0.2",
      最多交易: "BTC",
      交易量: "$400",
      总交易次数: "2",
    },
  ],
  [
    "all",
    {
      胜率: "66.7%",
      盈利因子: "6.00",
      平均盈利: "+$15.00",
      平均亏损: "-$5.00",
      已付手续费: "$0.3",
      最多交易: "BTC",
      交易量: "$12K",
      总交易次数: "3",
    },
  ],
])
  test(`D09-176/177/178 ${type} all eight displayed statistics derive from actual selected fill set`, async () => {
    const f = await portfolioContentFixture();
    try {
      await f.selectChart("pnl");
      await f.selectPnl(type);
      for (const [label, value] of Object.entries(expected))
        assert.equal(f.metric(label)[0].text, value, label);
      assert.equal(
        f.byType("ActionList")[0].props.items.filter((x) => x.extra).length,
        1,
      );
    } finally {
      await f.close();
    }
  });
for (const [row, coin, opposite] of [
  ["D09-180", "BTC", "spot"],
  ["D09-181", "@107", "perps"],
])
  test(`${row} opposite asset type has empty statistics, grey win-rate and finite fallback zero`, async () => {
    const f = await portfolioContentFixture({
      history: [],
      trades: { accountAddress: "0xaaa", fills: [portfolioFill(coin, 20)] },
    });
    try {
      await f.selectChart("pnl");
      await f.selectPnl(opposite);
      assert.equal(f.metric("总盈亏")[0].text, "$0.00");
      for (const label of [
        "胜率",
        "盈利因子",
        "平均盈利",
        "平均亏损",
        "最多交易",
        "交易量",
      ])
        assert.equal(f.metric(label)[0].text, "--", label);
      assert.equal(f.metric("总交易次数")[0].text, "0");
      assert.equal(
        f
          .byType("XStack")
          .filter((n) => n.props.bg === "$neutral5" && n.props.flex === 1)
          .length,
        1,
      );
      assert.doesNotMatch(f.texts().join("|"), /NaN|Infinity/);
    } finally {
      await f.close();
    }
  });
for (const [mmr, color] of [
  ["39.99", "#30a46c"],
  ["40", "#30a46c"],
  ["40.01", "#eab308"],
  ["70", "#eab308"],
  ["70.01", "#e5484d"],
])
  test(`D09-110/111 actual MMR gauge ${mmr} uses inclusive 40 and 70 thresholds`, async () => {
    const f = await portfolioContentFixture({ mmr: { mmrPercent: mmr } });
    try {
      const gauge = f
        .tree()
        .root.findAll((n) => n.type?.name === "SemiCircleGauge")
        .find((n) => n.props.label === "MMR");
      assert.equal(gauge.props.value, mmr + "%");
      assert.equal(gauge.props.percentage, Number(mmr));
      assert.equal(gauge.props.color, color);
      const arc = gauge.findAllByType("Circle").at(-1).props;
      assert.equal(arc.stroke, color);
      assert.ok(Number.isFinite(arc.strokeDashoffset));
    } finally {
      await f.close();
    }
  });
for (const [row, lev, used, mmr, health] of [
  ["D09-123", 25, 80, 50, "高风险"],
  ["D09-124", 10, 70, 20, "中等风险"],
  ["D09-125", 4, 50, 20, "健康"],
])
  test(`${row} actual composite health label, leverage, MMR and margin amount/gauge are distinct units`, async () => {
    const f = await portfolioContentFixture({
      summary: {
        totalNtlPos: String(lev * 100),
        totalMarginUsed: String(used),
        totalUnrealizedPnl: "0",
      },
      mmr: { mmrPercent: String(mmr) },
    });
    try {
      const gauges = f
        .tree()
        .root.findAll((n) => n.type?.name === "SemiCircleGauge");
      assert.equal(gauges[0].props.value, lev.toFixed(2) + "x");
      assert.equal(gauges[1].props.value, "$" + used);
      assert.equal(gauges[1].props.percentage, used);
      assert.equal(gauges[2].props.value, mmr + "%");
      assert.ok(f.texts().includes(health));
      assert.ok(!f.texts().includes("NaN"));
    } finally {
      await f.close();
    }
  });
test("D09-113/128 absent account/margin values render fallback gauges without NaN or Infinity", async () => {
  const f = await portfolioContentFixture({
    summary: null,
    value: null,
    mmr: null,
    positions: [],
  });
  try {
    const gauges = f
      .tree()
      .root.findAll((n) => n.type?.name === "SemiCircleGauge");
    assert.deepEqual(
      gauges.map((n) => n.props.value),
      ["--", "$0", "--"],
    );
    assert.ok(gauges.every((n) => Number.isFinite(n.props.percentage)));
    assert.doesNotMatch(f.texts().join("|"), /NaN|Infinity/);
  } finally {
    await f.close();
  }
});
test("D09-136/137/138 actual funds buttons dispatch selected tab and current account; outer modal is an adapter", async () => {
  const f = await portfolioContentFixture();
  try {
    for (const tab of ["deposit", "withdraw"]) {
      const label = tab === "deposit" ? "存款" : "提现";
      const button = f
        .byType("Button")
        .find(
          (n) =>
            n.props.testID === "perp-portfolio-buttons-btn" &&
            n.props.children === label,
        );
      assert.ok(button, label);
      await (
        await import("./source.mjs")
      ).renderer.act(async () => button.props.onPress());
    }
    assert.deepEqual(
      f.events.filter((e) => e[0] === "funds"),
      [
        ["funds", "deposit", "0xaaa"],
        ["funds", "withdraw", "0xaaa"],
      ],
    );
    assert.equal(f.state.account.accountAddress, "0xaaa");
  } finally {
    await f.close();
  }
});
test("D09-203 actual selected-window funding empty view restores all-time histogram through link", async () => {
  const f = await portfolioContentFixture({
    funding: [portfolioFunding("BTC", 5, 40 * 86400000)],
  });
  try {
    await f.selectChart("funding");
    assert.equal(f.chart(), undefined);
    const link = f
      .byType("SizableText")
      .find((n) => n.props.testID === "perp-portfolio-funding-view-all");
    assert.ok(link);
    assert.equal(link.props.color, "$green11");
    assert.equal(link.props.textDecorationLine, "underline");
    assert.deepEqual(
      f
        .byType("Illustration")
        .map((n) => ({ name: n.props.name, size: n.props.size })),
      [{ name: "Orders", size: 128 }],
    );
    assert.ok(f.texts().includes("暂无资金费记录"));
    const completeText = (n) =>
      typeof n === "string" || typeof n === "number"
        ? String(n)
        : n.children.map(completeText).join("");
    assert.ok(
      f
        .byType("SizableText")
        .some((n) => completeText(n) === "选择全部查看资金费历史记录"),
    );
    assert.equal(f.textOf(link), "全部");
    assert.equal(f.metric("累计净额")[0].text, "+$5.00");
    await (
      await import("./source.mjs")
    ).renderer.act(async () => link.props.onPress());
    assert.equal(
      f.control("perp-portfolio-time-period-presets").props.value,
      "allTime",
    );
    assert.equal(f.chart().seriesType, "histogram");
    assert.equal(
      f.chart().data.reduce((s, [, v]) => s + v, 0),
      5,
    );
  } finally {
    await f.close();
  }
});
test("D09-204 actual no-funding view has zero summary, no donut/link and start-trading dispatch", async () => {
  const f = await portfolioContentFixture({ funding: [] });
  try {
    await f.selectChart("funding");
    assert.equal(f.chart(), undefined);
    assert.ok(f.texts().includes("暂无资金费记录"));
    assert.equal(
      f
        .byType("SizableText")
        .filter((n) => n.props.testID === "perp-portfolio-funding-view-all")
        .length,
      0,
    );
    for (const label of [
      "24小时净额",
      "7天净额",
      "累计净额",
      "累计收取",
      "累计支付",
    ])
      assert.equal(f.metric(label)[0].text, "$0.00", label);
    assert.equal(f.byType("Svg").length, 0);
    await (
      await import("./source.mjs")
    ).renderer.act(async () =>
      f
        .byType("Button")
        .find((n) => n.props.testID === "perp-portfolio-funding-start-trading")
        .props.onPress(),
    );
    assert.deepEqual(
      f.events.filter((e) => e[0] === "start-trading"),
      [["start-trading"]],
    );
  } finally {
    await f.close();
  }
});
test("D09-214/215 actual funding skeleton, error and both retry actions recover view and summaries", async () => {
  const { renderer } = await import("./source.mjs");
  const f = await portfolioContentFixture({
    funding: [],
    fundingLoading: true,
  });
  try {
    await f.selectChart("funding");
    assert.equal(f.chart(), undefined);
    assert.ok(f.byType("Skeleton").length >= 16);
    await f.update({ fundingLoading: false, fundingError: true });
    assert.equal(f.byType("Skeleton").length, 0);
    assert.equal(f.chart(), undefined);
    for (const label of ["24小时净额", "7天净额", "累计净额"])
      assert.equal(f.metric(label)[0].text, "--");
    const buttons = f
      .byType("Button")
      .filter(
        (n) =>
          n.props.testID?.includes("funding") &&
          n.props.testID.includes("retry"),
      );
    assert.ok(buttons.length >= 1);
    for (const b of buttons) await renderer.act(async () => b.props.onPress());
    assert.equal(
      f.events.filter((e) => e[0] === "funding-refresh").length,
      buttons.length,
    );
    await f.update({
      fundingError: false,
      funding: [portfolioFunding("BTC", 3), portfolioFunding("ETH", -1)],
    });
    assert.equal(f.chart().seriesType, "histogram");
    assert.equal(f.metric("累计净额")[0].text, "+$2.00");
  } finally {
    await f.close();
  }
});
test("D09-149/186/220 actual component locale rerender uses translated selectors, summaries and tooltips", async () => {
  const f = await portfolioContentFixture();
  try {
    await f.selectChart("pnl");
    await f.update({ locale: "en_US" });
    assert.deepEqual(
      plain(f.byType("ActionList")[0].props.items.map((i) => i.label)),
      ["All", "Perps", "Spot"],
    );
    assert.ok(f.texts().includes("Total P&L"));
    for (const n of f.byType("DashText"))
      assert.ok(
        typeof n.props.tooltip === "string" && n.props.tooltip.length > 0,
      );
    await f.selectChart("funding");
    for (const label of [
      "Net 24h",
      "Net 7d",
      "Net all time",
      "Total received",
      "Total paid",
    ])
      assert.ok(f.texts().includes(label), label);
    assert.doesNotMatch(f.texts().join("|"), /perp_portfolio_|\{\w+\}/);
  } finally {
    await f.close();
  }
});

test("D09-66/67/68 actual period selectors select distinct history data and final chart wins after repeated transitions", async () => {
  const history = portfolioHistory();
  for (let i = 0; i < history.length; i++) {
    history[i][1].accountValueHistory = [
      [portfolioNow - 10000 - i * 100000, "100"],
      [portfolioNow - 1000, String(200 + i)],
    ];
    history[i][1].pnlHistory = [
      [portfolioNow - 10000 - i * 100000, "0"],
      [portfolioNow - 1000, String(i + 1)],
    ];
  }
  const f = await portfolioContentFixture({ history });
  try {
    for (const [period, last] of [
      ["day", 200],
      ["week", 201],
      ["month", 202],
      ["allTime", 203],
    ]) {
      await f.selectPeriod(period);
      assert.equal(
        f.control("perp-portfolio-time-period-presets").props.value,
        period,
      );
      assert.equal(f.chart().data.at(-1)[1], last);
      assert.equal(
        f.chart().data[0][0],
        (portfolioNow - 10000 - (last - 200) * 100000) / 1000,
      );
    }
    for (const type of [
      "pnl",
      "accountValue",
      "funding",
      "pnl",
      "accountValue",
    ])
      await f.selectChart(type);
    assert.equal(f.chart().seriesType, "dotted-area");
    assert.equal(f.chart().data.at(-1)[1], 203);
    assert.equal(
      f.control("perp-portfolio-chart-type-selector").props.value,
      "accountValue",
    );
  } finally {
    await f.close();
  }
});
test("D09-80/81/208 actual hover callbacks format time/value and clamp tooltip coordinates within controlled layout, leave clears tooltip", async () => {
  const { renderer } = await import("./source.mjs");
  const f = await portfolioContentFixture();
  try {
    const container = () =>
      f
        .byType("YStack")
        .find(
          (n) =>
            n.props.position === "relative" &&
            typeof n.props.onLayout === "function",
        );
    await renderer.act(async () =>
      container().props.onLayout({
        nativeEvent: { layout: { width: 600, height: 480 } },
      }),
    );
    for (const type of ["accountValue", "pnl", "funding"]) {
      await f.selectChart(type);
      for (const [x, y] of [
        [0, 0],
        [599, 479],
        [300, 240],
      ]) {
        await renderer.act(async () =>
          f.chart().onHover({ time: portfolioNow / 1000, price: -1.25, x, y }),
        );
        const tooltip = () =>
          f
            .byType("YStack")
            .find(
              (n) =>
                n.props.pointerEvents === "none" &&
                n.props.position === "absolute",
            );
        assert.ok(tooltip());
        await renderer.act(async () =>
          tooltip().props.onLayout({ nativeEvent: { layout: { height: 70 } } }),
        );
        const p = tooltip().props;
        const left = p.left + p.transform[0].translateX;
        assert.ok(left >= 8 && left + p.width <= 592);
        assert.ok(p.top >= 8 && p.top + 70 <= 472);
        assert.ok(f.texts().includes("-$1.25"));
        assert.ok(f.texts().includes(new Date(portfolioNow).toISOString()));
      }
      await renderer.act(async () => f.chart().onHover({}));
      assert.equal(
        f
          .byType("YStack")
          .filter(
            (n) =>
              n.props.pointerEvents === "none" &&
              n.props.position === "absolute",
          ).length,
        0,
      );
    }
  } finally {
    await f.close();
  }
});
for (const [amount, text, color] of [
  [2, "+$2.00", "$green11"],
  [-2, "-$2.00", "$red11"],
  [0, "$0.00", "$text"],
])
  test(`D09-197/198 actual funding ${amount} summary sign/color and zero reference/axis formatter`, async () => {
    const f = await portfolioContentFixture({
      funding: [portfolioFunding("BTC", amount)],
    });
    try {
      await f.selectChart("funding");
      for (const label of ["24小时净额", "7天净额", "累计净额"]) {
        assert.equal(f.metric(label)[0].text, text);
        assert.equal(f.metric(label)[0].props.color, color);
      }
      if (amount !== 0) {
        assert.equal(f.chart().histogramOptions.positiveColor, "#30a46c");
        assert.equal(f.chart().histogramOptions.negativeColor, "#e5484d");
        assert.equal(f.chart().histogramOptions.base, 0);
        assert.equal(f.chart().referenceLine.price, 0);
        assert.equal(f.chart().priceFormatter(0), "$0");
      }
      for (const label of ["未实现盈亏", "总盈亏", "当前持仓"])
        assert.ok(!f.texts().includes(label));
    } finally {
      await f.close();
    }
  });

for (const [name, patch, expected] of [
  ["mmr object", { mmr: null }, ["4.00x", "$50", "--"]],
  ["mmr field", { mmr: {} }, ["4.00x", "$50", "--"]],
  [
    "position value",
    { summary: { totalMarginUsed: "50", totalUnrealizedPnl: "0" } },
    ["--", "$50", "20%"],
  ],
  [
    "used margin",
    { summary: { totalNtlPos: "400", totalUnrealizedPnl: "0" } },
    ["4.00x", "$0", "20%"],
  ],
  ["account value", { value: {} }, ["--", "$50", "20%"]],
  ["summary object", { summary: null }, ["--", "$0", "20%"]],
])
  test(`D09-128 actual individual missing ${name} falls back without poisoning the other gauges`, async () => {
    const f = await portfolioContentFixture({
      summary: {
        totalNtlPos: "400",
        totalMarginUsed: "50",
        totalUnrealizedPnl: "0",
      },
      ...patch,
    });
    try {
      const gauges = f
        .tree()
        .root.findAll((n) => n.type?.name === "SemiCircleGauge");
      assert.deepEqual(
        gauges.map((n) => n.props.value),
        expected,
      );
      assert.ok(gauges.every((n) => Number.isFinite(n.props.percentage)));
      assert.doesNotMatch(f.texts().join("|"), /NaN|Infinity/);
    } finally {
      await f.close();
    }
  });

test("D09-93/95 actual empty local fill list preserves independent nonempty portfolio history totals", async () => {
  const f = await portfolioContentFixture({
    trades: { accountAddress: "0xaaa", fills: [] },
  });
  try {
    assert.equal(f.metric("交易量")[0].text, "$12K");
    assert.equal(f.metric("总盈亏")[0].text, "+$25.00");
    assert.equal(f.metric("总交易次数")[0].text, "0");
    assert.equal(f.metric("胜率")[0].text, "--");
  } finally {
    await f.close();
  }
});
