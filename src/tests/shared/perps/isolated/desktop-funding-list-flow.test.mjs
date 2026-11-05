import test from "node:test";
import assert from "node:assert/strict";
import {
  fundingListFixture,
  fundingRecord as rec,
} from "./funding-list-fixture.mjs";
const plain = (v) => JSON.parse(JSON.stringify(v));
const records = [
  rec(1),
  rec(2, {
    delta: { coin: "ETH", szi: "-3", usdc: "-2.5", fundingRate: "-0.0000001" },
  }),
  rec(3, {
    delta: { coin: "xyz:SOXL", szi: "0", usdc: "0", fundingRate: "0" },
  }),
];
test("D09-240/241/242/258/259 actual funding Desktop columns, sorted identities and exact signed cells", async () => {
  const f = await fundingListFixture({ records });
  try {
    assert.deepEqual(
      Array.from(f.table().columns, (c) => c.key),
      ["time", "market", "size", "side", "payment", "rate"],
    );
    assert.deepEqual(
      Array.from(f.table().columns, (c) => c.title),
      ["时间", "市场", "数量", "方向", "资金费", "费率"],
    );
    assert.deepEqual(f.rows(), ["funding-3", "funding-2", "funding-1"]);
    assert.equal(f.table().pageSize, 20);
    assert.equal(f.cells("funding-1").time.text, "2027/01/15 / 16:00:01");
    assert.equal(f.cells("funding-1").size.text, "2 BTC");
    assert.deepEqual(f.cells("funding-1").side, {
      text: "做多",
      color: "$green11",
    });
    assert.deepEqual(f.cells("funding-1").payment, {
      text: "+$1.25",
      color: "$green11",
    });
    assert.equal(f.cells("funding-1").rate.text, "0.0100%");
    assert.equal(f.cells("funding-2").size.text, "3 ETH");
    assert.deepEqual(f.cells("funding-2").side, {
      text: "做空",
      color: "$red11",
    });
    assert.deepEqual(f.cells("funding-2").payment, {
      text: "-$2.50",
      color: "$red11",
    });
    assert.equal(f.cells("funding-2").rate.text, "-0.000010%");
    assert.equal(f.cells("funding-3").market.text, "SOXL");
    assert.deepEqual(f.cells("funding-3").side, {
      text: "--",
      color: "$textSubdued",
    });
    assert.deepEqual(f.cells("funding-3").payment, {
      text: "$0.00",
      color: "$text",
    });
    assert.ok(f.table().paginationAction);
    assert.equal(
      f
        .nodes("Button")
        .filter((n) => n.props.testID === "perp-funding-history-export").length,
      1,
    );
  } finally {
    await f.close();
  }
});
test("D09-243/244/245/246 actual funding toolbar checkmarks, code/display search and direction intersection", async () => {
  const f = await fundingListFixture({ records });
  try {
    await f.open("side");
    const sides = () =>
      f
        .nodes("XStack")
        .filter((n) =>
          /^perps-funding-history-side-(all|long|short)$/.test(
            n.props.testID ?? "",
          ),
        );
    assert.deepEqual(
      sides().map((n) => n.props.testID),
      [
        "perps-funding-history-side-all",
        "perps-funding-history-side-long",
        "perps-funding-history-side-short",
      ],
    );
    assert.deepEqual(
      sides().map((n) =>
        n
          .findAllByType("Icon")
          .some((i) => i.props.name === "CheckLargeOutline"),
      ),
      [true, false, false],
    );
    await f.choose("side", "short");
    await f.open("side");
    assert.deepEqual(
      sides().map((n) =>
        n
          .findAllByType("Icon")
          .some((i) => i.props.name === "CheckLargeOutline"),
      ),
      [false, false, true],
    );
    assert.deepEqual(f.rows(), ["funding-2"]);
    assert.equal(f.table().currentListPage, 1);
    await f.choose("side", "long");
    assert.deepEqual(f.rows(), ["funding-1"]);
    await f.choose("side", "all");
    assert.equal(f.rows().length, 3);
    assert.equal(
      f
        .byId("perps-funding-history-side-filter")
        .findAllByType("SizableText")[0]
        .children.join(""),
      "方向",
    );
    await f.open("market");
    assert.deepEqual(
      f
        .nodes("XStack")
        .map((n) => n.props.testID)
        .filter((s) =>
          /^perps-funding-history-market-(all|BTC|ETH|xyz:SOXL)$/.test(s ?? ""),
        ),
      [
        "perps-funding-history-market-all",
        "perps-funding-history-market-BTC",
        "perps-funding-history-market-ETH",
        "perps-funding-history-market-xyz:SOXL",
      ],
    );
    await f.choose("market", "xyz:SOXL");
    assert.equal(
      f
        .byId("perps-funding-history-market-filter")
        .findAllByType("SizableText")[0]
        .children.join(""),
      "SOXL (xyz)",
    );
    assert.deepEqual(f.rows(), ["funding-3"]);
    await f.choose("market", undefined);
    assert.equal(f.rows().length, 3);
    for (const q of ["sox", "sOxL", "xyz:SOXL"]) {
      await f.search(q);
      const ids = f
        .nodes("XStack")
        .map((n) => n.props.testID)
        .filter(
          (s) =>
            s?.startsWith("perps-funding-history-market-") &&
            !s.endsWith("filter"),
        );
      assert.deepEqual(ids, ["perps-funding-history-market-xyz:SOXL"]);
    }
    await f.search("NOT-A-MARKET");
    assert.ok(
      f.nodes("SizableText").some((n) => n.children.join("") === "未找到结果"),
    );
    assert.equal(
      f
        .nodes("XStack")
        .filter(
          (n) => n.props.testID === "perps-funding-history-market-xyz:SOXL",
        ).length,
      0,
    );
    await f.search("");
    assert.ok(
      f
        .nodes("XStack")
        .some((n) => n.props.testID === "perps-funding-history-market-BTC"),
    );
    await f.choose("side", "short");
    await f.choose("market", "BTC");
    assert.deepEqual(f.rows(), []);
    assert.equal(f.table().emptyMessage, "没有匹配的资金费");
    assert.equal(f.table().paginationAction, null);
  } finally {
    await f.close();
  }
});
test("D09-247 actual Desktop no-match branch renders Orders illustration and title only", async () => {
  const f = await fundingListFixture({ records, side: "short", market: "BTC" });
  try {
    assert.equal(f.nodes("Illustration").length, 1);
    assert.equal(f.nodes("Illustration")[0].props.name, "Orders");
    assert.deepEqual(
      f
        .nodes("SizableText")
        .filter((n) => n.props.size === "$headingSm")
        .map((n) => n.children.join("")),
      ["没有匹配的资金费"],
    );
    assert.equal(
      f
        .nodes("SizableText")
        .filter((n) => n.children.join("") === "请尝试其他筛选条件。").length,
      0,
    );
    assert.equal(f.table().paginationAction, null);
  } finally {
    await f.close();
  }
});
test("D09-248/260/261 actual loading, no-account empty and retry recover with controlled history arrival", async () => {
  const f = await fundingListFixture({
    account: undefined,
    records: [],
    isLoading: true,
  });
  try {
    assert.equal(f.table().listLoading, true);
    assert.equal(f.table().paginationAction, null);
    assert.equal(f.table().onViewAll, undefined);
    await f.update({ isLoading: false });
    assert.equal(f.table().listLoading, false);
    assert.equal(f.table().emptyMessage, "暂无资金费");
    assert.deepEqual(f.rows(), []);
    await f.update({ account: "0xaaa", isError: true });
    const b = f
      .nodes("Button")
      .find((n) => n.props.testID === "perp-funding-history-retry");
    assert.ok(b);
    await b.props.onPress();
    assert.equal(f.events.refresh, 1);
    await f.update({ isError: false, records });
    assert.equal(f.table().ListEmptyComponent, undefined);
    assert.equal(f.rows().length, 3);
  } finally {
    await f.close();
  }
});
for (const count of [20, 21, 41])
  test(`D09-256/257 actual page20/filter/account reset and view-all boundary ${count}`, async () => {
    const all = Array.from({ length: count }, (_, i) => rec(i));
    const f = await fundingListFixture({ records: all });
    try {
      assert.equal(f.rows().length, 20);
      assert.equal(
        typeof f.table().onViewAll,
        count > 20 ? "function" : "undefined",
      );
      if (count > 20) {
        f.table().onViewAll();
        assert.equal(f.events.viewAll, 1);
        await f.page(2);
        assert.equal(f.rows().length, Math.min(count - 20, 20));
      }
      await f.choose("side", "long");
      assert.equal(f.table().currentListPage, 1);
      await f.page(2);
      await f.update({
        account: "0xbbb",
        records: [
          rec(99, {
            delta: {
              coin: "ETH",
              szi: "-1",
              usdc: "-3",
              fundingRate: "0.0001",
            },
          }),
        ],
      });
      assert.equal(f.table().currentListPage, 1);
      // This list receives controlled filters; invalid market reset belongs to parent.
      assert.deepEqual(f.rows(), []);
      await f.choose("side", "all");
      assert.deepEqual(f.rows(), ["funding-99"]);
    } finally {
      await f.close();
    }
  });
for (const count of [25, 2000])
  test(`D09-249 actual export all ${count} filtered rows beyond current page and filename`, async () => {
    const all = Array.from({ length: count }, (_, i) => rec(i));
    const f = await fundingListFixture({ records: all });
    try {
      await f.page(2);
      await f.export();
      assert.deepEqual(plain(f.events.loads), [
        { accountAddress: "0xaaa", force: true },
      ]);
      assert.equal(f.events.exports.length, 1);
      const ex = f.events.exports[0];
      assert.match(
        ex.filename,
        count >= 2000
          ? /^perp_funding_history_recent_\d{8}-\d{6}\.csv$/
          : /^perp_funding_history_\d{8}-\d{6}\.csv$/,
      );
      const lines = (await ex.blob.text()).split("\n");
      assert.equal(lines.length, count + 1);
      assert.equal(lines[0], "时间,市场,数量,方向,资金费,结算币种,费率");
      assert.equal(
        lines[1],
        `${new Date(all.at(-1).time).toISOString()},BTC,2,做多,1.25,USDC,0.0100%`,
      );
      assert.equal(
        lines.at(-1),
        `${new Date(all[0].time).toISOString()},BTC,2,做多,1.25,USDC,0.0100%`,
      );
      assert.deepEqual(f.events.toasts, [{ kind: "success", title: "成功" }]);
      assert.equal(f.byId("perp-funding-history-export").props.loading, false);
    } finally {
      await f.close();
    }
  });
test("D09-250/251/254 actual filtered CSV uses UTC/raw amounts/market settlement and conserves totals", async () => {
  const f = await fundingListFixture({ records });
  try {
    await f.choose("side", "short");
    await f.choose("market", "ETH");
    assert.equal(
      f
        .byId("perps-funding-history-side-filter")
        .findAllByType("SizableText")[0]
        .children.join(""),
      "做空",
    );
    assert.equal(
      f
        .byId("perps-funding-history-market-filter")
        .findAllByType("SizableText")[0]
        .children.join(""),
      "ETH",
    );
    await f.export();
    assert.equal(
      await f.events.exports[0].blob.text(),
      "时间,市场,数量,方向,资金费,结算币种,费率\n2027-01-15T08:00:02.000Z,ETH,3,做空,-2.5,USDC,-0.000010%",
    );
    assert.deepEqual(plain(f.events.metadata), [{ coins: ["ETH"] }]);
    await f.choose("side", "all");
    await f.choose("market", undefined);
    await f.export();
    const lines = (await f.events.exports[1].blob.text()).split("\n").slice(1);
    assert.equal(
      lines.reduce((s, l) => s + Number(l.split(",")[4]), 0),
      -1.25,
    );
    assert.ok(lines[0].includes(",USDH,"));
  } finally {
    await f.close();
  }
});
for (const reason of ["metadataError", "loadError", "exportError"])
  test(`D09-251 actual export ${reason} yields failure, no success and unlocks`, async () => {
    const f = await fundingListFixture({
      records,
      [reason]: new Error("local " + reason),
    });
    try {
      await f.export();
      assert.equal(f.events.exports.length, 0);
      assert.deepEqual(f.events.toasts, [{ kind: "error", title: "失败" }]);
      assert.equal(f.byId("perp-funding-history-export").props.loading, false);
      await f.update({ [reason]: undefined });
      await f.export();
      assert.equal(f.events.exports.length, 1);
    } finally {
      await f.close();
    }
  });
for (const prefix of ["=", "+", "-", "@"])
  test(`D09-263 actual exported market and settlement neutralize formula prefix ${prefix}`, async () => {
    const coin = prefix + "TOKEN",
      token = prefix + "SETTLE";
    const f = await fundingListFixture({
      records: [
        rec(1, { delta: { coin, szi: "-2", usdc: "-1", fundingRate: "0" } }),
      ],
      tokens: { [coin]: token },
    });
    try {
      await f.export();
      assert.ok(
        (await f.events.exports[0].blob.text()).includes(
          `,'${coin},2,做空,-1,'${token},0.000000%`,
        ),
      );
    } finally {
      await f.close();
    }
  });
test("D09-264 actual export ref lock blocks double activation during pending fetch and releases after finish", async () => {
  let release;
  const wait = new Promise((r) => {
    release = r;
  });
  const f = await fundingListFixture({ records, waitExport: wait });
  try {
    const press = f.exportPress();
    let task;
    await (
      await import("./source.mjs")
    ).renderer.act(async () => {
      task = press();
      await press();
    });
    assert.equal(f.events.loads.length, 1);
    assert.equal(f.byId("perp-funding-history-export").props.loading, true);
    assert.equal(f.events.exports.length, 0);
    release();
    await (
      await import("./source.mjs")
    ).renderer.act(async () => {
      await task;
    });
    assert.equal(f.events.exports.length, 1);
    assert.equal(f.byId("perp-funding-history-export").props.loading, false);
  } finally {
    await f.close();
  }
});
test("D09-266 actual language switch updates table and export headers at invocation", async () => {
  const f = await fundingListFixture({ records });
  try {
    await f.update({ locale: "en_US" });
    assert.deepEqual(
      Array.from(f.table().columns, (c) => c.title),
      ["Time", "Market", "Size", "Side", "Payment", "Rate"],
    );
    await f.export();
    assert.equal(
      (await f.events.exports[0].blob.text()).split("\n")[0],
      "Time,Market,Size,Side,Payment,Settlement currency,Rate",
    );
    assert.equal(f.events.toasts[0].title, "Success");
  } finally {
    await f.close();
  }
});

test("D09-265 actual Desktop export no-account disables and callback refuses local request", async () => {
  const f = await fundingListFixture({ records });
  try {
    await f.update({ account: undefined });
    assert.equal(f.byId("perp-funding-history-export").props.disabled, true);
    await f.export();
    assert.deepEqual(f.events.loads, []);
    assert.deepEqual(f.events.exports, []);
  } finally {
    await f.close();
  }
});
test("D09-250 actual buy-side filtered CSV contains only chosen market and long rows", async () => {
  const f = await fundingListFixture({ records });
  try {
    await f.choose("side", "long");
    await f.choose("market", "BTC");
    await f.export();
    const lines = (await f.events.exports[0].blob.text()).split("\n");
    assert.equal(lines.length, 2);
    assert.equal(
      lines[1],
      "2027-01-15T08:00:01.000Z,BTC,2,做多,1.25,USDC,0.0100%",
    );
    assert.equal(
      f
        .byId("perps-funding-history-side-filter")
        .findAllByType("SizableText")[0]
        .children.join(""),
      "做多",
    );
    assert.equal(
      f
        .byId("perps-funding-history-market-filter")
        .findAllByType("SizableText")[0]
        .children.join(""),
      "BTC",
    );
  } finally {
    await f.close();
  }
});
test("D09-254 actual CSV and actual portfolio content agree on signed net and market receive/pay totals", async () => {
  const { portfolioContentFixture } =
    await import("./portfolio-content-fixture.mjs");
  const all = [
    rec(1, { time: 1799999999000 }),
    rec(2, {
      time: 1799999998000,
      delta: {
        coin: "ETH",
        szi: "-3",
        usdc: "-2.5",
        fundingRate: "-0.0000001",
      },
    }),
  ];
  const f = await fundingListFixture({ records: all }),
    p = await portfolioContentFixture({ funding: all });
  try {
    await f.export();
    const rows = (await f.events.exports[0].blob.text()).split("\n").slice(1);
    const net = rows.reduce((n, s) => n + Number(s.split(",")[4]), 0);
    assert.equal(net, -1.25);
    await p.selectChart("funding");
    await p.selectPeriod("allTime");
    assert.equal(p.metric("累计净额")[0].text, "-$1.25");
    assert.equal(p.metric("累计收取")[0].text, "$1.25");
    assert.equal(p.metric("累计支付")[0].text, "$2.50");
    assert.ok(p.texts().includes("BTC 100.00%"));
    assert.ok(p.texts().includes("ETH 100.00%"));
  } finally {
    await f.close();
    await p.close();
  }
});

test("D09-240/256 actual full Desktop parent tab order, filter row, independent panes and account market reconciliation", async () => {
  const f = await fundingListFixture({
    parent: true,
    records: Array.from({ length: 25 }, (_, i) => rec(i)),
  });
  try {
    const tabs = f
      .nodes("XStack")
      .filter((n) => n.props.testID?.startsWith("perp-info-panel-tab-"));
    assert.deepEqual(
      tabs.map((n) => n.props.testID.replace("perp-info-panel-tab-", "")),
      [
        "Balances",
        "Positions",
        "Open Orders",
        "TWAP",
        "Trades History",
        "Funding",
        "Account",
      ],
    );
    assert.equal(
      tabs.filter((n) =>
        n.findAllByType("Stack").some((s) => s.props.bg === "$borderActive"),
      ).length,
      1,
    );
    assert.equal(
      f.byId("perp-info-panel-tab-Funding").findAllByType("Stack")[0].props.bg,
      "$borderActive",
    );
    const bar = f.nodes("OrderInfoTabBar")[0];
    assert.equal(bar.props.horizontal, true);
    let row = bar.parent;
    while (row && row.type !== "XStack") row = row.parent;
    assert.ok(row);
    assert.equal(
      row.findAll(
        (n) =>
          typeof n.type === "string" &&
          n.props.testID === "perps-funding-history-side-filter",
      ).length,
      1,
    );
    const visible = () =>
      f
        .nodes("Stack")
        .filter(
          (n) => n.props.position === "absolute" && n.props.display === "flex",
        );
    assert.equal(visible().length, 1);
    await f.page(2);
    await f.choose("market", "BTC");
    assert.equal(f.table().currentListPage, 1);
    await f.page(2);
    await f.update({
      account: "0xbbb",
      records: [
        rec(99, {
          delta: { coin: "ETH", szi: "-1", usdc: "-3", fundingRate: "0.001" },
        }),
      ],
    });
    assert.equal(f.table().currentListPage, 1);
    assert.deepEqual(f.rows(), ["funding-99"]);
    assert.equal(
      f
        .byId("perps-funding-history-market-filter")
        .findAllByType("SizableText")[0]
        .children.join(""),
      "市场",
    );
    await f.open("market");
    assert.deepEqual(
      f
        .nodes("XStack")
        .map((n) => n.props.testID)
        .filter((s) =>
          /^perps-funding-history-market-(all|BTC|ETH)$/.test(s ?? ""),
        ),
      ["perps-funding-history-market-all", "perps-funding-history-market-ETH"],
    );
    for (const tab of [
      "Positions",
      "Open Orders",
      "TWAP",
      "Trades History",
      "Account",
      "Funding",
    ]) {
      await f.tab(tab);
      assert.equal(visible().length, 1);
      assert.equal(f.events.routes.at(-1).infoPanelTab, tab);
      assert.equal(
        f
          .nodes("XStack")
          .filter((n) => n.props.testID === "perps-funding-history-side-filter")
          .length,
        tab === "Funding" ? 1 : 0,
      );
    }
    assert.equal(f.events.ledger, 1);
  } finally {
    await f.close();
  }
});
test("D09-248 actual empty Desktop account illustration, title-only and sole all-market option", async () => {
  const f = await fundingListFixture();
  try {
    assert.equal(f.nodes("Illustration")[0].props.name, "Orders");
    assert.deepEqual(
      f
        .nodes("SizableText")
        .filter((n) => n.props.size === "$headingSm")
        .map((n) => n.children.join("")),
      ["暂无资金费"],
    );
    assert.equal(
      f
        .nodes("SizableText")
        .some((n) => String(n.props.children).includes("收到")),
      false,
    );
    await f.open("market");
    assert.deepEqual(
      f
        .nodes("XStack")
        .map((n) => n.props.testID)
        .filter((s) =>
          /^perps-funding-history-market-(?!filter)/.test(s ?? ""),
        ),
      ["perps-funding-history-market-all"],
    );
    assert.equal(f.table().paginationAction, null);
  } finally {
    await f.close();
  }
});
