import test from "node:test";
import assert from "node:assert/strict";
import { footerTickerFixture } from "./footer-ticker-fixture.mjs";
const seq = (...entries) =>
  entries.map((entry) => {
    const [mode, coinName] = entry.split(":");
    return { mode, coinName };
  });
const plain = (x) => JSON.parse(JSON.stringify(x));
const coins = (f) => f.rows().map((r) => r.coin),
  track = (f) =>
    f.tree.root
      .findAllByType("XStack")
      .find((n) => n.props.testID === "perp-footer-ticker-track").props.ref
      .current.style.transform;
test("D06-44 actual settings has ordered modes, unique checked option, click updates exact mode then closes and none removes loops", async () => {
  const f = await footerTickerFixture();
  try {
    await f.settle();
    const items = () => f.tree.root.findAllByType("ListItem");
    assert.deepEqual(
      items().map((n) => n.findByType("Text").children.join("")),
      ["不展示预览", "热门", "自选"],
    );
    for (const [index, mode] of ["none", "popular", "favorites"].entries()) {
      await f.select(mode);
      await f.settle();
      assert.equal(f.state.footer.mode, mode);
      assert.deepEqual(f.events.settings.slice(-2), [mode, "closed"]);
      assert.deepEqual(
        items().map((n) => n.findAllByType("Icon").length),
        [0, 1, 2].map((i) => Number(i === index)),
      );
      assert.equal(f.rows().length === 0, mode === "none");
    }
    await f.select("none");
    assert.equal(f.frames.size, 0);
    assert.equal(f.events.observers.length, 0);
  } finally {
    await f.close();
  }
});
test("D06-45 actual popular perp hook ranks raw turnover, renders name/change/price with independent directions and routes exact raw identity", async () => {
  const f = await footerTickerFixture();
  try {
    await f.settle();
    assert.deepEqual(
      f.rows().map((r) => [r.coin, r.mode, r.text, r.colors[1]]),
      [
        ["BTC", "perp", ["BTC", "+25.00%", "100"], "$textSuccess"],
        ["ETH", "perp", ["ETH", "-50.00%", "50"], "$textCritical"],
      ],
    );
    await f.click(1);
    assert.deepEqual(plain(f.events.switches), [{ coin: "ETH", mode: "perp" }]);
  } finally {
    await f.close();
  }
});
test(
  "D06-46/79 actual popular spot preserves full BASE/QUOTE for same base different quotes",
  {
    todo: "Known B02: popular hook prefers base-only universe.displayName; preserve BASE/QUOTE expectation",
  },
  async () => {
    const f = await footerTickerFixture({ mode: "spot" });
    try {
      await f.settle();
      assert.deepEqual(
        f.rows().map((r) => r.name),
        ["BTC/USDC", "BTC/USDH"],
      );
    } finally {
      await f.close();
    }
  },
);
test("D06-46/79 actual popular spot complete raw quote identity, distinct prices/colors and clicks never select same-base other quote", async () => {
  const f = await footerTickerFixture({ mode: "spot" });
  try {
    await f.settle();
    assert.deepEqual(
      f
        .rows()
        .map((r) => [r.coin, r.mode, r.assetId, r.text.slice(1), r.colors[1]]),
      [
        ["@1", "spot", 10001, ["+20.00%", "120"], "$textSuccess"],
        ["@2", "spot", 10002, ["-40.00%", "60"], "$textCritical"],
      ],
    );
    await f.click(1);
    assert.deepEqual(plain(f.events.switches.at(-1)), {
      coin: "@2",
      mode: "spot",
    });
  } finally {
    await f.close();
  }
});
for (const [from, to] of [
  ["perp", "spot"],
  ["spot", "perp"],
])
  test(`D06-47/48 actual popular mode ${from} to ${to} pending metadata cannot render previous mode; late local result contains only target mode`, async () => {
    const f = await footerTickerFixture({ mode: from });
    try {
      await f.settle();
      assert.ok(f.rows().length > 0);
      const pending = f.delayMetadata();
      await f.update({ mode: to });
      assert.deepEqual(f.rows(), []);
      await f.settle();
      assert.deepEqual(f.rows(), []);
      pending.resolve();
      await f.releaseMetadata();
      await f.settle();
      assert.ok(f.rows().length > 0);
      assert.ok(f.rows().every((r) => r.mode === to));
      assert.deepEqual(
        f.events.subscriptions,
        to === "perp" ? ["on"] : ["on", "off"],
      );
    } finally {
      await f.close();
    }
  });
test("D06-24/49 actual favorites ordered by complete mixed sequence, filter current mode and include both quote names", async () => {
  const f = await footerTickerFixture({ footer: { mode: "favorites" } });
  try {
    await f.settle();
    assert.deepEqual(coins(f), ["ETH", "BTC"]);
    assert.deepEqual(
      f.rows().map((r) => r.text),
      [
        ["ETH", "-50.00%", "50"],
        ["BTC", "+25.00%", "100"],
      ],
    );
    await f.update({ mode: "spot" });
    await f.settle();
    assert.deepEqual(
      f.rows().map((r) => [r.coin, r.name, r.text.slice(1)]),
      [
        ["@2", "BTC/USDH", ["-40.00%", "60"]],
        ["@1", "BTC/USDC", ["+20.00%", "120"]],
      ],
    );
    await f.update({ spot: { favorites: [] } });
    assert.deepEqual(f.rows(), []);
    assert.deepEqual(f.state.perp.favorites, ["BTC", "ETH"]);
  } finally {
    await f.close();
  }
});
test("D06-50 actual add remove and reorder update rendered favorite rows without mutating other mode, clicking routes exact canonical coin", async () => {
  const f = await footerTickerFixture({ footer: { mode: "favorites" } });
  try {
    await f.settle();
    await f.update({
      order: { sequence: seq("perp:BTC", "perp:ETH", "spot:@1", "spot:@2") },
    });
    assert.deepEqual(coins(f), ["BTC", "ETH"]);
    await f.update({ perp: { favorites: ["ETH"] } });
    assert.deepEqual(coins(f), ["ETH"]);
    await f.update({ perp: { favorites: ["ETH", "BTC"] } });
    assert.deepEqual(coins(f), ["BTC", "ETH"]);
    await f.update({ mode: "spot" });
    await f.settle();
    assert.deepEqual(coins(f), ["@1", "@2"]);
    await f.click(1);
    assert.deepEqual(plain(f.events.switches.at(-1)), {
      mode: "spot",
      coin: "@2",
    });
    assert.deepEqual(f.state.perp.favorites, ["ETH", "BTC"]);
  } finally {
    await f.close();
  }
});
test("D06-45/49 active context overlays only identical mode+canonical coin and invalid prices retain batch snapshots", async () => {
  const f = await footerTickerFixture();
  try {
    await f.settle();
    await f.update({
      perpActive: {
        coin: "BTC",
        ctx: { markPrice: "101.23456", change24hPercent: -0.125 },
      },
      spotActive: {
        coin: "BTC",
        ctx: { markPrice: "999", change24hPercent: 999 },
      },
    });
    assert.deepEqual(f.rows()[0].text, ["BTC", "-0.13%", "101.23"]);
    assert.equal(f.rows()[0].colors[1], "$textCritical");
    assert.deepEqual(f.rows()[1].text, ["ETH", "-50.00%", "50"]);
    for (const price of ["0", "-1", "NaN", "Infinity", ""]) {
      await f.update({
        perpActive: { coin: "BTC", ctx: { markPrice: price } },
      });
      assert.equal(f.rows()[0].text[2], "100");
    }
  } finally {
    await f.close();
  }
});
test("D06-45/49 visible perp subscription is balanced across mode/none/unmount; spot never requests batch perps", async () => {
  const f = await footerTickerFixture({ footer: { mode: "none" } });
  try {
    assert.deepEqual(f.events.subscriptions, []);
    await f.select("popular");
    assert.deepEqual(f.events.subscriptions, ["on"]);
    await f.update({ mode: "spot" });
    assert.deepEqual(f.events.subscriptions, ["on", "off"]);
    await f.select("favorites");
    assert.deepEqual(f.events.subscriptions, ["on", "off"]);
    await f.update({ mode: "perp" });
    assert.deepEqual(f.events.subscriptions, ["on", "off", "on"]);
    await f.select("none");
    assert.deepEqual(f.events.subscriptions, ["on", "off", "on", "off"]);
  } finally {
    await f.close();
    assert.equal(f.frames.size, 0);
    assert.equal(f.events.observers.length, 0);
  }
});
test("D06-47/48 actual marquee live prices update during deferred popular reorder and structure commits exactly at loop wrap", async () => {
  const f = await footerTickerFixture({ containerWidth: 10, contentWidth: 28 });
  try {
    await f.settle();
    await f.frame(0);
    await f.frame(1000);
    assert.equal(track(f), "translate3d(-14px, 0, 0)");
    await f.update({
      all: {
        assetCtxsByDex: [
          [
            {
              markPx: "110",
              prevDayPx: "100",
              dayNtlVlm: "1",
              openInterest: "10",
            },
            {
              markPx: "55",
              prevDayPx: "50",
              dayNtlVlm: "999999",
              openInterest: "10",
            },
          ],
        ],
      },
    });
    assert.deepEqual(coins(f), ["BTC", "ETH"]);
    assert.equal(f.rows()[0].text[2], "110");
    await f.frame(2000);
    assert.deepEqual(coins(f), ["ETH", "BTC"]);
    assert.equal(track(f), "translate3d(0px, 0, 0)");
    const duplicate = f.tree.root
      .findAllByType("button")
      .filter((n) => n.props["aria-hidden"]);
    assert.equal(duplicate.length, 2);
    assert.ok(duplicate.every((n) => n.props.tabIndex === -1));
    await f.click(0, { duplicate: true });
    assert.deepEqual(plain(f.events.switches.at(-1)), {
      mode: "perp",
      coin: "ETH",
    });
  } finally {
    await f.close();
  }
});
for (const reducedMotion of [false, true])
  test(`D06-50 actual favorites structure updates immediately under scroll, hover pauses animation, reducedMotion=${reducedMotion}`, async () => {
    const f = await footerTickerFixture({
      footer: { mode: "favorites" },
      containerWidth: 10,
      contentWidth: 28,
      reducedMotion,
    });
    try {
      await f.settle();
      await f.frame(0);
      await f.frame(500);
      assert.equal(
        track(f),
        reducedMotion ? "translate3d(0, 0, 0)" : "translate3d(-7px, 0, 0)",
      );
      await f.hover(true);
      const before = track(f);
      await f.frame(1000);
      assert.equal(track(f), before);
      await f.update({ order: { sequence: seq("perp:BTC", "perp:ETH") } });
      assert.deepEqual(coins(f), ["BTC", "ETH"]);
      await f.hover(false);
      await f.frame(2000);
      await f.frame(2500);
      assert.equal(
        track(f),
        reducedMotion ? "translate3d(0, 0, 0)" : "translate3d(-7px, 0, 0)",
      );
    } finally {
      await f.close();
      assert.equal(f.frames.size, 0);
    }
  });
