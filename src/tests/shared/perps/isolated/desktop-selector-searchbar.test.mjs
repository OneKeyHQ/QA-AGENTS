import test from "node:test";
import assert from "node:assert/strict";
import { selectorSearchbarFixture } from "./selector-searchbar-fixture.mjs";
import { keyboardPerp, keyboardSpot } from "./selector-keyboard-fixture.mjs";
const selects = (f) => f.keyboard.events.filter(([type]) => type === "select");
test("D05-139/140 actual SearchBar raw input immediately invalidates old selection, real 300ms debounce then current filtered result enables correct Enter", async () => {
  const f = await selectorSearchbarFixture();
  try {
    assert.equal(f.keyboard.selection().keyboardSelectedIndex, 0);
    await f.type("ETH");
    assert.equal(f.props.value, "ETH");
    assert.equal(f.keyboard.inputQueryRef.current, "ETH");
    assert.equal(f.keyboard.state.searchQuery, "");
    await f.submit();
    assert.equal(selects(f).length, 0);
    await f.tick(299);
    assert.equal(f.keyboard.state.searchQuery, "");
    await f.submit();
    assert.equal(selects(f).length, 0);
    await f.tick(1);
    assert.equal(f.keyboard.state.searchQuery, "ETH");
    await f.submit();
    assert.equal(selects(f).length, 0, "old result atom must still block");
    f.filtered("ETH", [keyboardPerp("ETH")]);
    await f.submit();
    assert.deepEqual(selects(f), [["select", "ETH"]]);
  } finally {
    await f.close();
  }
});
test("D05-140 actual rapid SearchBar edits only publish last query and reject late intermediate result", async () => {
  const f = await selectorSearchbarFixture();
  try {
    await f.type("B");
    await f.tick(200);
    await f.type("ET");
    await f.tick(200);
    await f.type("SOL");
    await f.tick(299);
    assert.equal(f.keyboard.state.searchQuery, "");
    await f.tick(1);
    assert.equal(f.keyboard.state.searchQuery, "SOL");
    f.filtered("ET", [keyboardPerp("ETH")]);
    await f.submit();
    assert.equal(selects(f).length, 0);
    f.filtered("SOL", [keyboardPerp("SOL")]);
    await f.submit();
    assert.deepEqual(selects(f), [["select", "SOL"]]);
  } finally {
    await f.close();
  }
});
for (const during of ["start", "afterEnd"])
  test(`D05-171 actual SearchBar IME ${during} submit suppressed, next turn Enter selects only committed result`, async () => {
    const f = await selectorSearchbarFixture();
    try {
      await f.startComposition();
      await f.type("比特币");
      await f.tick(300);
      f.filtered("比特币", [keyboardPerp("BTC")]);
      if (during === "afterEnd") await f.endComposition("比特币");
      await f.submit();
      assert.equal(selects(f).length, 0);
      if (during === "start") await f.endComposition("比特币");
      await f.tick(0);
      await f.submit();
      assert.deepEqual(selects(f), [["select", "BTC"]]);
      assert.equal(f.keyboard.requests.length, 0);
    } finally {
      await f.close();
    }
  });
test("D05-171 actual repeated IME composition clears prior unlock timer, no premature selection", async () => {
  const f = await selectorSearchbarFixture();
  try {
    await f.startComposition();
    await f.endComposition("");
    await f.startComposition();
    await f.tick(0);
    await f.submit();
    assert.equal(selects(f).length, 0);
    await f.endComposition("");
    await f.tick(0);
    await f.submit();
    assert.deepEqual(selects(f), [["select", "BTC"]]);
  } finally {
    await f.close();
  }
});
test("D05-139 actual SearchBar clear immediately removes text and blocks old filtered row until empty query arrives", async () => {
  const f = await selectorSearchbarFixture();
  try {
    await f.type("ETH");
    await f.tick(300);
    f.filtered("ETH", [keyboardPerp("ETH")]);
    await f.clear();
    f.keyboard.input.value = "";
    assert.equal(f.props.value, "");
    await f.submit();
    assert.equal(selects(f).length, 0);
    await f.tick(300);
    assert.equal(f.keyboard.state.searchQuery, "");
    await f.submit();
    assert.equal(selects(f).length, 0);
    f.filtered("", [keyboardPerp("BTC")]);
    await f.submit();
    assert.deepEqual(selects(f), [["select", "BTC"]]);
  } finally {
    await f.close();
  }
});
for (const items of [[], [keyboardSpot("@1")]])
  test(`D05-122/141 actual SearchBar Enter ${items.length ? "spot uses canonical identity" : "empty remains inert"}`, async () => {
    const f = await selectorSearchbarFixture({ activeTabData: items });
    try {
      await f.submit();
      assert.deepEqual(selects(f), items.length ? [["select", "@1"]] : []);
      assert.equal(f.keyboard.requests.length, 0);
    } finally {
      await f.close();
    }
  });
test("D05-171 actual unmount disposes delayed IME unlock and pending debounce cannot publish into closed picker", async () => {
  const f = await selectorSearchbarFixture();
  await f.type("ETH");
  await f.startComposition();
  await f.endComposition("ETH");
  await f.close();
  await f.tick(1000);
  assert.equal(f.keyboard.state.searchQuery, "");
  assert.equal(selects(f).length, 0);
  assert.equal(f.clock.countTimers(), 0);
});
test("D05-128 actual SearchBar delayed autofocus exactly 350ms, pending autofocus cancelled on close", async () => {
  const f = await selectorSearchbarFixture();
  try {
    assert.equal(f.props.autoFocus, false);
    assert.equal(f.props.blurOnSubmit, false);
    await f.tick(349);
    assert.equal(f.focus.length, 0);
    await f.tick(1);
    assert.deepEqual(f.focus, [1800000000350]);
  } finally {
    await f.close();
  }
  const g = await selectorSearchbarFixture();
  await g.close();
  await g.tick(350);
  assert.equal(g.focus.length, 0);
});
