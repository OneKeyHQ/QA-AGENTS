import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  assertPerpSearchResultSet,
  projectSelectorStringStates,
  withSearchPageErrors,
} from "../search-evidence.mjs";
import { committedFiber } from "../react-projection.mjs";

const catalog = ["BTC", "AIXBT", "ETH", "GOLD"].map((coin) => ({
  coin,
  spot: false,
}));
catalog.push({ coin: "@1", spot: true });
const config = {
  tokenSearchAliases: {
    GOLD: { aliases: ["quote'asset", "比特金"] },
    BTC: { aliases: ["比特币"] },
  },
};
test("complete search oracle rejects omitted/duplicate/foreign/type-confused results, accepts literal and empty matches", () => {
  const check = (rows, q) =>
    assertPerpSearchResultSet(catalog, rows, q, config);
  check(catalog.slice(0, 2), "bt");
  for (const bad of [
    catalog.slice(0, 1),
    [catalog[0], catalog[0]],
    [catalog[0], catalog[1], catalog[2]],
    [{ ...catalog[0], spot: true }, catalog[1]],
  ]) {
    assert.throws(() => check(bad, "bt"));
  }
  check([catalog[3]], "'");
  assert.throws(() => check([], "'"));
  check([], "<");
  assert.throws(() => check([catalog[0]], "<"));
  check(
    catalog.filter((r) => !r.spot),
    " ",
  );
  check([catalog[0], catalog[3]], "比特");
  assert.throws(
    () => assertPerpSearchResultSet([], [], "<", config),
    /catalog required/,
  );
});

test("matching-state projection reads the committed selector owner, never a stale or unrelated owner", () => {
  const state = { current: null };
  const rootA = { tag: 3, stateNode: state },
    rootB = { tag: 3, stateNode: state };
  rootA.alternate = rootB;
  rootB.alternate = rootA;
  state.current = rootB;
  const owner = (value) => ({
    type: { name: "BasePerpTokenSelectorContent" },
    memoizedState: {
      memoizedState: value,
      next: { memoizedState: "A".repeat(200) },
    },
  });
  const a = { ...owner("OLD"), return: rootA },
    b = { ...owner("A".repeat(64)), return: rootB };
  a.alternate = b;
  b.alternate = a;
  rootA.child = a;
  rootB.child = b;
  assert.deepEqual(projectSelectorStringStates(committedFiber(a)), [
    "A".repeat(64),
    "A".repeat(200),
  ]);
  assert.throws(
    () =>
      projectSelectorStringStates({
        type: { name: "OtherSelector" },
        memoizedState: { memoizedState: "A".repeat(64) },
      }),
    /owner unavailable/,
  );
});

test("search pageerror observation rejects errors during the flow and removes listeners on every exit", async () => {
  const page = new EventEmitter();
  const baseline = () => {};
  page.on("pageerror", baseline);
  assert.equal(
    await withSearchPageErrors(page, async () => "healthy"),
    "healthy",
  );
  assert.equal(page.listenerCount("pageerror"), 1);
  await assert.rejects(
    withSearchPageErrors(page, async () => {
      page.emit("pageerror", Error("crash"));
      return "still rendered";
    }),
    /uncaught page error/,
  );
  assert.equal(page.listenerCount("pageerror"), 1);
  await assert.rejects(
    withSearchPageErrors(page, async () => {
      throw Error("UI assertion failed");
    }),
    /UI assertion failed/,
  );
  assert.equal(page.listenerCount("pageerror"), 1);
});

test("category oracle has one fixed All and never fabricates Hot/New; configured order/removal are exact", async () => {
  const { expectedSearchCategories } = await import("../search-evidence.mjs");
  assert.deepEqual(expectedSearchCategories(null), [
    { tabId: "perps", name: "全部", tokens: [] },
  ]);
  const raw = [
    { tabId: " Hot ", name: " 热门资产 ", tokens: ["BTC", "BTC", "ETH"] },
    { tabId: "hot", name: "duplicate", tokens: ["GOLD"] },
    { tabId: " ALL ", name: "server all", tokens: ["GOLD"] },
    { tabId: "new", name: "新上市", tokens: null },
    { tabId: "", name: "invalid" },
    { tabId: "stocks", name: " " },
  ];
  assert.deepEqual(expectedSearchCategories(raw), [
    { tabId: "perps", name: "全部", tokens: [] },
    { tabId: "Hot", name: "热门资产", tokens: ["BTC", "ETH"] },
    { tabId: "new", name: "新上市", tokens: [] },
  ]);
  assert.deepEqual(
    expectedSearchCategories([raw[3]]).map((t) => t.name),
    ["全部", "新上市"],
  );
});
