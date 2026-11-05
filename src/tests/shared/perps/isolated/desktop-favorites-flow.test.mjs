import test from "node:test";
import assert from "node:assert/strict";
import { favoritesFlowFixture } from "./favorites-flow-fixture.mjs";
import { renderer } from "./source.mjs";
const plain = (x) => JSON.parse(JSON.stringify(x));
const expected = ["BTC", "ETH", "BNB", "SOL", "HYPE", "XRP"];
const bar = (f) =>
  f
    .byType("FavoriteTokenItem")
    .map((n) => `${n.props.mode}:${n.props.coinName}`);
const membership = (f) => f.byType("Membership")[0].props;
const recommendationCards = (f) =>
  f.byType("XStack").filter((n) => n.props.width === "48%");
test("D03-24/28 actual recommendation has six selected two-column cards and no existing membership/bar", async () => {
  const f = await favoritesFlowFixture();
  try {
    assert.deepEqual(
      f.byType("Token").map((n) => n.props.tokenImageUri),
      expected.map((s) => "local:" + s),
    );
    const cards = recommendationCards(f);
    assert.equal(cards.length, 6);
    assert.ok(cards.every((n) => n.props.borderColor === "$borderActive"));
    assert.equal(
      f.byType("Icon").filter((n) => n.props.name === "CheckLargeOutline")
        .length,
      6,
    );
    assert.equal(f.byType("Button")[0].props.children, "添加到自选");
    assert.equal(f.byType("Button")[0].props.disabled, false);
    assert.deepEqual(plain(membership(f).perp), []);
    assert.deepEqual(bar(f), []);
    assert.equal(f.byType("DragDropContext").length, 0);
  } finally {
    await f.close();
  }
});
test("D03-25/29/79 actual quick-add deselects BTC/ETH then independently updates real membership hook, stars, bar and market mirror", async () => {
  const f = await favoritesFlowFixture();
  try {
    for (const i of [0, 1])
      await renderer.act(async () => recommendationCards(f)[i].props.onPress());
    await renderer.act(async () => f.byType("Button")[0].props.onPress());
    await f.flush();
    assert.deepEqual(plain(f.perp.read().favorites), [
      "BNB",
      "SOL",
      "HYPE",
      "XRP",
    ]);
    assert.deepEqual(plain(membership(f).perp), ["BNB", "SOL", "HYPE", "XRP"]);
    assert.deepEqual(bar(f), ["perp:BNB", "perp:SOL", "perp:HYPE", "perp:XRP"]);
    assert.deepEqual(plain(f.state.market), ["BNB", "SOL", "HYPE", "XRP"]);
    assert.equal(recommendationCards(f).length, 0);
    assert.deepEqual(
      f
        .tree()
        .root.findByType("perp-stars")
        .findAllByType("IconButton")
        .map((n) => n.props.icon),
      [
        "StarOutline",
        "StarOutline",
        "StarSolid",
        "StarSolid",
        "StarSolid",
        "StarSolid",
      ],
    );
  } finally {
    await f.close();
  }
});
test("D03-26 no selected recommendation disables add and callback itself cannot enqueue changes", async () => {
  const f = await favoritesFlowFixture();
  try {
    for (let i = 0; i < 6; i++)
      await renderer.act(async () => recommendationCards(f)[i].props.onPress());
    assert.equal(f.byType("Button")[0].props.disabled, true);
    await renderer.act(async () => f.byType("Button")[0].props.onPress());
    await f.flush();
    assert.equal(recommendationCards(f).length, 6);
    assert.equal(f.events.filter((e) => e[0] === "market-sync").length, 0);
    assert.deepEqual(bar(f), []);
  } finally {
    await f.close();
  }
});
test("D03-27/37/38/50/51/103 actual last removal restores fresh six selections and hides complete bar including toggles", async () => {
  const f = await favoritesFlowFixture();
  try {
    await f.star("BTC");
    assert.deepEqual(bar(f), ["perp:BTC"]);
    assert.equal(recommendationCards(f).length, 0);
    assert.equal(f.byType("DragDropContext").length, 1);
    await f.star("BTC");
    assert.deepEqual(bar(f), []);
    assert.equal(f.byType("DragDropContext").length, 0);
    assert.equal(recommendationCards(f).length, 6);
    assert.ok(
      recommendationCards(f).every(
        (n) => n.props.borderColor === "$borderActive",
      ),
    );
    assert.equal(
      f
        .byType("SizableText")
        .filter((n) => n.props.children === "$" || n.props.children === "%")
        .length,
      0,
    );
    assert.deepEqual(plain(f.state.market), []);
  } finally {
    await f.close();
  }
});
test("D03-39/41/80/81 rapid committed star presses are not debounced and independently update bar/list on every step", async () => {
  const f = await favoritesFlowFixture();
  try {
    for (let i = 1; i <= 5; i++) {
      await f.star("BTC");
      const want = i % 2 ? ["BTC"] : [];
      assert.deepEqual(plain(membership(f).perp), want);
      assert.deepEqual(
        bar(f),
        want.map((c) => "perp:" + c),
      );
      assert.deepEqual(plain(f.state.market), want);
    }
    assert.equal(f.events.filter((e) => e[0] === "market-sync").length, 5);
  } finally {
    await f.close();
  }
});
test("D03-64/65/71 actual Desktop mode toggle is shared across perp/spot and every committed tap wins", async () => {
  const f = await favoritesFlowFixture({ perp: ["BTC"], spot: ["@1"] });
  try {
    const toggle = () =>
      f
        .tree()
        .root.findAll((n) => n.type?.displayName === "DisplayModeToggle")[0];
    assert.ok(toggle());
    for (let i = 1; i <= 5; i++) {
      await renderer.act(async () => toggle().props.onToggle());
      assert.equal(f.perp.read().displayMode, i % 2 ? "percent" : "price");
      assert.ok(
        f
          .byType("FavoriteTokenItem")
          .every((n) => n.props.displayMode === f.perp.read().displayMode),
      );
      assert.equal(
        f
          .byType("SizableText")
          .filter(
            (n) =>
              ["$", "%"].includes(n.props.children) &&
              n.props.fontWeight === "600",
          ).length,
        1,
      );
    }
  } finally {
    await f.close();
  }
});
test("D03-66/117/119/131 actual mixed bar preserves membership/order while switching selected spot/perp, same-name spot remains after perp remove", async () => {
  const f = await favoritesFlowFixture({
    perp: ["BTC", "ETH"],
    spot: ["@1"],
    market: ["BTC", "ETH"],
  });
  try {
    assert.deepEqual(
      plain(f.state.market),
      ["BTC", "ETH"],
      "Explicit initial perpetual mirror precondition",
    );
    assert.deepEqual(bar(f), ["perp:BTC", "perp:ETH", "spot:@1"]);
    assert.equal(
      f.byType("FavoriteTokenItem")[2].props.displayName,
      "BTC/USDC",
    );
    for (const index of [2, 0])
      await renderer.act(async () =>
        f.byType("FavoriteTokenItem")[index].props.onPress(),
      );
    assert.deepEqual(
      f.events.filter((e) => e[0] === "select"),
      [
        ["select", "spot", "@1"],
        ["select", "perp", "BTC"],
      ],
    );
    assert.deepEqual(bar(f), ["perp:BTC", "perp:ETH", "spot:@1"]);
    await f.star("BTC");
    assert.deepEqual(bar(f), ["perp:ETH", "spot:@1"]);
    assert.deepEqual(
      plain(f.state.market),
      ["ETH"],
      "Market perpetual mirror removes BTC independently of same-base spot",
    );
    assert.deepEqual(plain(f.spot.read().favorites), ["@1"]);
    await f.star("@1", true);
    assert.deepEqual(bar(f), ["perp:ETH"]);
    assert.deepEqual(plain(f.perp.read().favorites), ["ETH"]);
    assert.deepEqual(
      plain(f.state.market),
      ["ETH"],
      "Removing spot must never synchronize perpsCoin BTC or change perpetual mirror",
    );
  } finally {
    await f.close();
  }
});
test("D03-49/67/68 actual bar insertion/removal preserves other positions and explicit mixed drag order", async () => {
  const f = await favoritesFlowFixture({ perp: ["BTC", "ETH"], spot: ["@1"] });
  try {
    await renderer.act(async () =>
      f
        .byType("DragDropContext")[0]
        .props.onDragEnd({ source: { index: 2 }, destination: { index: 0 } }),
    );
    assert.deepEqual(bar(f), ["spot:@1", "perp:BTC", "perp:ETH"]);
    await f.star("SOL");
    assert.deepEqual(bar(f), ["spot:@1", "perp:BTC", "perp:ETH", "perp:SOL"]);
    await f.star("BTC");
    assert.deepEqual(bar(f), ["spot:@1", "perp:ETH", "perp:SOL"]);
    assert.deepEqual(plain(f.order.read().sequence), [
      { mode: "spot", coinName: "@1" },
      { mode: "perp", coinName: "ETH" },
      { mode: "perp", coinName: "SOL" },
    ]);
  } finally {
    await f.close();
  }
});
test("D03-116/118/121 same local persisted stores remount restore spot identity and display mode independent of search", async () => {
  const f = await favoritesFlowFixture({
    perp: ["BTC"],
    spot: ["@1"],
    displayMode: "percent",
    search: "nonexistent",
  });
  try {
    assert.deepEqual(plain(membership(f).spot), ["@1"]);
    await f.update({ search: "ETH", mode: "spot" });
    await f.remount();
    assert.deepEqual(bar(f), ["perp:BTC", "spot:@1"]);
    assert.equal(
      f.byType("FavoriteTokenItem")[1].props.displayName,
      "BTC/USDC",
    );
    assert.ok(
      f
        .byType("FavoriteTokenItem")
        .every((n) => n.props.displayMode === "percent"),
    );
  } finally {
    await f.close();
  }
});
test("D03-82/130 actual failed sync rejects then serialized recovery preserves last confirmed operation without duplicate membership", async () => {
  const f = await favoritesFlowFixture({ perp: ["BTC"] });
  try {
    f.state.failSync = true;
    await assert.rejects(
      f.service.updateTokenSelectorFavorite({
        mode: "perp",
        coin: "BTC",
        action: "remove",
      }),
      /local sync failed/,
    );
    assert.deepEqual(plain(f.perp.read().favorites), ["BTC"]);
    f.state.failSync = false;
    await renderer.act(async () => {
      await Promise.all([
        f.service.updateTokenSelectorFavorite({
          mode: "perp",
          coin: "BTC",
          action: "remove",
        }),
        f.service.updateTokenSelectorFavorite({
          mode: "perp",
          coin: "BTC",
          action: "add",
        }),
        f.service.updateTokenSelectorFavorite({
          mode: "perp",
          coin: "BTC",
          action: "add",
        }),
      ]);
    });
    assert.deepEqual(plain(membership(f).perp), ["BTC"]);
    assert.deepEqual(bar(f), ["perp:BTC"]);
    assert.deepEqual(plain(f.state.market), ["BTC"]);
  } finally {
    await f.close();
  }
});
