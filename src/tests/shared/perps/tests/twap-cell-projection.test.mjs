import test from "node:test";
import assert from "node:assert/strict";
import { projectTwapCellRows } from "../twap-cell-projection.mjs";
class Host {
  constructor(innerText = "", children = [], color = "#218358") {
    this.innerText = innerText;
    this.children = children;
    this.color = color;
  }
  contains(child) {
    return this.children.some((c) => c === child || c.contains(child));
  }
  querySelectorAll() {
    return this.children.flatMap((c) => [c, ...c.querySelectorAll()]);
  }
}
function fiber(props = {}, children = [], type = function Layout() {}) {
  const n = { type, memoizedProps: props };
  children.forEach((child, i) => {
    child.return = n;
    child.sibling = children[i + 1];
  });
  n.child = children[0];
  return n;
}
function host(element) {
  const f = fiber({}, [], "div");
  f.stateNode = element;
  return f;
}
const trap = () => {
  throw Error("Read-only projection invoked callback");
};
function fixture() {
  const record = { twapId: 7, state: { coin: "BTC" } },
    columns = [{ key: "coin" }, { key: "terminate" }];
  function row(mode, key) {
    const text = new Host(key),
      cell = new Host(key, [text]);
    const span = host(text),
      styled = fiber({ color: "$green11", onPress: trap }, [span]);
    const outerHost = host(new Host(key, [cell]));
    outerHost.child = styled;
    styled.return = outerHost;
    const owner = fiber(
      {
        order: record,
        columnConfigs: columns,
        renderMode: mode,
        status: "activated",
        now: Date.now(),
        onTerminate: trap,
      },
      [outerHost],
      function TwapActiveRow() {},
    );
    return { owner, outerHost, text, cell };
  }
  const left = row("left", "BTC"),
    right = row("right", "终止");
  const table = fiber(
    {
      listViewDebugRenderTrackerProps: { name: "PerpTwapList_active" },
      columns,
      onRefresh: trap,
    },
    [left.owner, right.owner],
  );
  return { table, left, right };
}
function withHost(fn) {
  const prior = Object.fromEntries(
    ["HTMLElement", "getComputedStyle", "OffscreenCanvas"].map((k) => [
      k,
      globalThis[k],
    ]),
  );
  globalThis.HTMLElement = Host;
  globalThis.getComputedStyle = (el) => ({
    color: el.color,
    getPropertyValue: (key) => (key === "--green11" ? "#218358" : ""),
  });
  globalThis.OffscreenCanvas = class {
    getContext() {
      return { fillStyle: "#000000" };
    }
  };
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(prior))
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
  }
}
test("TWAP cell projection reads both fixed fragments, exact DOM cells and resolved theme colors without callbacks", () =>
  withHost(() => {
    const f = fixture(),
      rows = projectTwapCellRows(f.left.outerHost);
    assert.deepEqual(
      rows.map((r) => r.renderMode),
      ["left", "right"],
    );
    assert.deepEqual(
      rows.flatMap((r) => r.cells.map((c) => [c.key, c.text])),
      [
        ["coin", "BTC"],
        ["terminate", "终止"],
      ],
    );
    assert.deepEqual(rows[0].cells[0].semanticColors, [
      { token: "$green11", resolved: "#218358", actual: "#218358" },
    ]);
    f.left.text.color = "#e5484d";
    assert.equal(
      projectTwapCellRows(f.left.outerHost)[0].cells[0].semanticColors[0]
        .actual,
      "#e5484d",
      "Actual rendered color is separately read, not replaced by intended token",
    );
  }));
test("TWAP cell projection rejects missing hosts, mismatched counts and unknown owners", () =>
  withHost(() => {
    const a = fixture();
    a.left.outerHost.stateNode.children = [];
    assert.throws(() => projectTwapCellRows(a.left.outerHost), /DOM cells/);
    const b = fixture();
    b.left.owner.child = null;
    assert.throws(() => projectTwapCellRows(b.table), /no actual DOM host/);
    assert.throws(() => projectTwapCellRows(fiber()), /owner required/);
  }));
test("TWAP cell projection fails closed for cyclic ancestors and siblings", () =>
  withHost(() => {
    const a = fiber();
    a.return = a;
    assert.throws(() => projectTwapCellRows(a), /ancestor tree/);
    const b = fixture();
    b.right.owner.sibling = b.left.owner;
    assert.throws(() => projectTwapCellRows(b.table), /sibling tree/);
  }));
