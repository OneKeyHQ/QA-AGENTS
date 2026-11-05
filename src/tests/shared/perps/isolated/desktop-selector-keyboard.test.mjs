import test from "node:test";
import assert from "node:assert/strict";
import {
  selectorKeyboardFixture,
  keyboardPerp,
  keyboardSpot,
} from "./selector-keyboard-fixture.mjs";
const plain = (x) => JSON.parse(JSON.stringify(x));
test("D05-122/124/129 actual selection expressions default to first, clamp bounds, follow identity after reorder and clear old query/tab", () => {
  const f = selectorKeyboardFixture();
  try {
    assert.equal(f.selection().keyboardSelectedIndex, 0);
    f.invoke("handleKeyboardNavigation", f.event("ArrowUp"));
    assert.equal(f.selection().keyboardSelectedIndex, 0);
    for (let i = 0; i < 5; i++)
      f.invoke("handleKeyboardNavigation", f.event("ArrowDown"));
    assert.equal(f.selection().keyboardSelectedKey, "perp-0-2-SOL");
    f.state.activeTabData.reverse();
    assert.equal(f.selection().keyboardSelectedIndex, 0);
    f.state.keyboardSelection = {
      key: "perp-0-1-ETH",
      index: 1,
      query: "OLD",
      tab: "perps",
    };
    assert.equal(f.selection().keyboardSelectedIndex, 0);
    f.state.keyboardSelection.query = "";
    f.state.keyboardSelection.tab = "spot";
    assert.equal(f.selection().keyboardSelectedIndex, 0);
    f.state.activeTabData = [keyboardSpot()];
    f.state.keyboardSelection = undefined;
    for (const key of ["ArrowUp", "ArrowDown"]) {
      f.invoke("handleKeyboardNavigation", f.event(key));
      assert.equal(f.selection().keyboardSelectedKey, "spot-@1");
    }
  } finally {
    f.close();
  }
});
for (const end of ["top", "bottom"])
  test(`D05-153/154 actual removed favorite ${end} selection chooses adjacent surviving row without extra key`, () => {
    const f = selectorKeyboardFixture();
    try {
      if (end === "bottom")
        for (let i = 0; i < 2; i++)
          f.invoke("handleKeyboardNavigation", f.event("ArrowDown"));
      const expected = end === "top" ? ["ETH", "SOL"] : ["ETH", "BTC"];
      for (const name of expected) {
        const index = f.selection().keyboardSelectedIndex;
        f.state.activeTabData.splice(index, 1);
        assert.equal(
          f.state.activeTabData[f.selection().keyboardSelectedIndex].tokenName,
          name,
        );
      }
      f.state.activeTabData = [];
      assert.equal(f.selection().keyboardSelectedIndex, -1);
      assert.equal(f.selection().keyboardSelectedKey, undefined);
    } finally {
      f.close();
    }
  });
for (const empty of [false, true])
  test(`D05-137/138/141 actual left/right loops primary tabs with query retained, empty=${empty}`, () => {
    const f = selectorKeyboardFixture({
      inputQuery: "BTC",
      searchQuery: "BTC",
      filteredQuery: "BTC",
      ...(empty ? { activeTabData: [] } : {}),
    });
    try {
      for (const [key, expected] of [
        ["ArrowLeft", "favorites"],
        ["ArrowLeft", "spot"],
        ["ArrowRight", "favorites"],
        ["ArrowRight", "perps"],
        ["ArrowRight", "spot"],
        ["ArrowRight", "favorites"],
      ]) {
        const e = f.event(key);
        f.invoke("handleKeyboardNavigation", e);
        assert.equal(f.state.displayPrimaryTab, expected);
        assert.equal(f.state.searchQuery, "BTC");
        assert.equal(f.input.value, "BTC");
        assert.equal(e.prevented, true);
      }
    } finally {
      f.close();
    }
  });
for (const flag of ["metaKey", "ctrlKey", "altKey", "shiftKey"])
  for (const key of ["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp"])
    test(`D05-172 actual modified ${flag}+${key} preserves editing and selection`, () => {
      const f = selectorKeyboardFixture();
      try {
        const before = plain(f.selection()),
          e = f.event(key, { [flag]: true, nativeEvent: { [flag]: true } });
        f.invoke("handleKeyboardNavigation", e);
        assert.deepEqual(plain(f.selection()), before);
        assert.equal(f.events.length, 0);
        assert.equal(e.prevented, undefined);
      } finally {
        f.close();
      }
    });
for (const composing of [
  { isComposing: true },
  { keyCode: 229 },
  { which: 229 },
])
  for (const key of ["ArrowDown", "ArrowRight", "s"])
    test(`D05-171 actual IME ${JSON.stringify(composing)} suppresses ${key}`, () => {
      const f = selectorKeyboardFixture();
      try {
        const e = f.event(key, {
          metaKey: key === "s",
          nativeEvent: composing,
        });
        f.invoke(
          key === "s" ? "handleFavoriteShortcut" : "handleKeyboardNavigation",
          e,
        );
        assert.equal(f.state.keyboardSelection, undefined);
        assert.equal(f.state.displayPrimaryTab, "perps");
        assert.equal(f.requests.length, 0);
        assert.equal(e.prevented, undefined);
      } finally {
        f.close();
      }
    });
for (const stale of ["input", "atom", "results", "empty"])
  test(`D05-139/140/141 actual stale ${stale} cannot select or favorite old results`, () => {
    const f = selectorKeyboardFixture();
    try {
      if (stale === "input") f.input.value = "ETH";
      if (stale === "atom") {
        f.state.inputQuery = "ETH";
        f.inputQueryRef.current = "ETH";
        f.input.value = "ETH";
      }
      if (stale === "results") f.state.filteredQuery = "ETH";
      if (stale === "empty") f.state.activeTabData = [];
      f.invoke("handleKeyboardSubmit", f.event("Enter"));
      f.invoke("handleFavoriteShortcut", f.event("s", { metaKey: true }));
      f.invoke("handleKeyboardNavigation", f.event("ArrowDown"));
      assert.equal(f.events.filter((e) => e[0] === "select").length, 0);
      assert.equal(f.requests.length, 0);
      assert.equal(f.state.keyboardSelection, undefined);
    } finally {
      f.close();
    }
  });
for (const spot of [false, true])
  test(`D05-152/156/158/159 actual shortcut ${spot ? "spot" : "perp"} optimistic membership is isolated and pending/repeat guard prevents duplicates`, async () => {
    let release;
    const f = selectorKeyboardFixture({
      activeTabData: [spot ? keyboardSpot() : keyboardPerp("BTC")],
      perpFavorites: { favorites: spot ? ["BTC"] : [] },
      spotFavorites: { favorites: spot ? [] : ["@1"] },
      pending: new Promise((r) => {
        release = r;
      }),
    });
    try {
      const key = () => f.event("s", { metaKey: true });
      const first = key();
      f.invoke("handleFavoriteShortcut", first);
      assert.equal(first.prevented, true);
      assert.equal(first.stopped, true);
      f.invoke("handleFavoriteShortcut", key());
      f.invoke(
        "handleFavoriteShortcut",
        f.event("s", { metaKey: true, nativeEvent: { repeat: true } }),
      );
      assert.equal(f.requests.length, 1);
      assert.deepEqual(plain(f.requests[0]), {
        mode: spot ? "spot" : "perp",
        coin: spot ? "@1" : "BTC",
        action: "add",
      });
      assert.deepEqual(plain(f.state.perpFavorites.favorites), ["BTC"]);
      assert.deepEqual(plain(f.state.spotFavorites.favorites), ["@1"]);
      assert.equal(f.keyboardFavoritesPending.current.size, 1);
      release();
      await f.flush();
      assert.equal(f.keyboardFavoritesPending.current.size, 0);
      f.invoke("handleFavoriteShortcut", key());
      await f.flush();
      assert.equal(f.requests.length, 2);
      assert.equal(f.requests[1].action, "remove");
      assert.deepEqual(
        plain(f.state[spot ? "spotFavorites" : "perpFavorites"].favorites),
        [],
      );
      assert.deepEqual(
        plain(f.state[spot ? "perpFavorites" : "spotFavorites"].favorites),
        [spot ? "BTC" : "@1"],
      );
      assert.equal(f.events.filter((e) => e[0] === "select").length, 0);
    } finally {
      release();
      await f.flush();
      f.close();
    }
  });
test("D05-158 failed favorite request releases pending lock, retains last local operation and permits a later retry", async () => {
  const f = selectorKeyboardFixture({ fail: true });
  try {
    f.invoke("handleFavoriteShortcut", f.event("s", { ctrlKey: true }));
    await f.flush();
    assert.equal(f.keyboardFavoritesPending.current.size, 0);
    assert.deepEqual(plain(f.state.perpFavorites.favorites), ["BTC"]);
    assert.equal(f.events.filter((e) => e[0] === "error").length, 1);
    f.state.fail = false;
    f.invoke("handleFavoriteShortcut", f.event("s", { ctrlKey: true }));
    await f.flush();
    assert.equal(f.requests.length, 2);
    assert.equal(f.requests[1].action, "remove");
    assert.deepEqual(plain(f.state.perpFavorites.favorites), []);
  } finally {
    f.close();
  }
});
test("D05-139/173 actual shortcut ignores outside input and raw input changes clear stale selection and normalize query", () => {
  const f = selectorKeyboardFixture();
  try {
    f.invoke(
      "handleFavoriteShortcut",
      f.event("s", {
        metaKey: true,
        target: f.dom.window.document.getElementById("outside"),
      }),
    );
    assert.equal(f.requests.length, 0);
    f.invoke("handleSearchInputChange", {
      nativeEvent: { text: "  " + "x".repeat(70) + "  " },
    });
    assert.equal(f.inputQueryRef.current.length, 64);
    assert.equal(f.state.inputQuery, "x".repeat(64));
    assert.equal(f.state.keyboardSelection, undefined);
  } finally {
    f.close();
  }
});
test("D05-125/157 actual virtual target mounts, scrolls nearest, wheel cancels old pending scroll and mouse follows full row identity", () => {
  const f = selectorKeyboardFixture({
    activeTabData: Array.from({ length: 30 }, (_, i) =>
      keyboardPerp("T" + i, i),
    ),
  });
  try {
    for (let i = 0; i < 10; i++)
      f.invoke("handleKeyboardNavigation", f.event("ArrowDown"));
    assert.equal(f.selection().keyboardSelectedIndex, 10);
    assert.equal(f.pendingKeyboardScroll.current, "T10");
    assert.equal(f.events.at(-1)[1].offset, 336);
    const row = f.dom.window.document.createElement("div"),
      span = f.dom.window.document.createElement("span");
    row.append(span);
    f.root.append(row);
    const scrolled = [];
    row.scrollIntoView = (args) => scrolled.push(args);
    f.invoke("registerKeyboardRow", "unused"); // unknown nodes must not register
    assert.equal(f.keyboardRowRefs.current.has("unused"), false);
    f.invoke("registerKeyboardRow", "T10", row);
    assert.deepEqual(plain(scrolled), [{ block: "nearest" }]);
    assert.equal(f.pendingKeyboardScroll.current, undefined);
    f.invoke("handleKeyboardNavigation", f.event("ArrowDown"));
    assert.equal(f.pendingKeyboardScroll.current, "T11");
    f.invoke("cancelPendingKeyboardScroll");
    assert.equal(f.pendingKeyboardScroll.current, undefined);
    f.invoke("handleMouseMove", { target: span });
    assert.equal(f.selection().keyboardSelectedIndex, 10);
    assert.equal(f.pendingKeyboardScroll.current, undefined);
  } finally {
    f.close();
  }
});
test("D05-123/124 actual Enter selects current full identity once while pending, then can select again after completion", async () => {
  let release;
  const f = selectorKeyboardFixture({
    pending: new Promise((r) => {
      release = r;
    }),
  });
  try {
    f.invoke("handleKeyboardNavigation", f.event("ArrowDown"));
    for (let i = 0; i < 3; i++)
      f.invoke("handleKeyboardSubmit", f.event("Enter"));
    assert.deepEqual(plain(f.events.filter((e) => e[0] === "select")), [
      ["select", "ETH"],
    ]);
    assert.equal(f.keyboardSubmitPending.current, true);
    release();
    await f.flush();
    assert.equal(f.keyboardSubmitPending.current, false);
    f.invoke("handleKeyboardSubmit", f.event("Enter"));
    await f.flush();
    assert.equal(f.events.filter((e) => e[0] === "select").length, 2);
  } finally {
    release();
    await f.flush();
    f.close();
  }
});
