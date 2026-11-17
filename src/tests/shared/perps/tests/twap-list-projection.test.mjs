import test from "node:test";
import assert from "node:assert/strict";
import {
  projectTwapTableState,
  projectTwapRenderedRows,
  ownsTwapTable,
} from "../twap-list-projection.mjs";
const trap = () => {
  throw Error("Read-only projection invoked a product callback");
};
function node(props = {}, children = []) {
  const n = { memoizedProps: props };
  children.forEach((child, i) => {
    child.return = n;
    child.sibling = children[i + 1];
  });
  n.child = children[0];
  return n;
}
const table = (tab = "history", data = []) => ({
  listViewDebugRenderTrackerProps: { name: `PerpTwapList_${tab}` },
  data,
  columns: [{ key: "coin", title: "资产" }],
  currentListPage: 2,
  pageSize: 20,
  emptyMessage: "空",
  setCurrentListPage: trap,
});
const subtabs = () => ({
  tabs: ["active", "history", "fills"].map((key) => ({ key, label: key })),
  activeTab: "history",
  onChange: trap,
});
test("TWAP table projection excludes unrelated tables and keeps current subtab/page without callbacks", () => {
  const t = node(table()),
    s = node(subtabs()),
    other = node({
      data: [{ coin: "OTHER" }],
      columns: [],
      listViewDebugRenderTrackerProps: { name: "PerpTradesHistoryList" },
    }),
    root = node({}, [t, s, other]);
  const value = projectTwapTableState(t);
  assert.equal(value.tables.length, 1);
  assert.equal(value.tables[0].tab, "history");
  assert.equal(value.tables[0].page, 2);
  assert.equal(value.subtabs[0].active, "history");
  assert.equal(root.child, t);
});
test("TWAP table projection deduplicates identical wrapper props but exposes distinct duplicate tables", () => {
  const props = table(),
    a = node(props),
    wrapper = node(props, [a]),
    b = node(table());
  node({}, [wrapper, b, node(subtabs())]);
  assert.equal(
    projectTwapTableState(a).tables.length,
    2,
    "A distinct second table remains visible to the UI uniqueness gate",
  );
});
test("TWAP header ownership rejects same text in another module", () => {
  const header = node({ children: "资产" }),
    t = node(table(), [header]),
    unrelated = node({ children: "资产" });
  node({}, [t, unrelated]);
  assert.equal(ownsTwapTable(header), true);
  assert.equal(ownsTwapTable(unrelated), false);
});
test("TWAP row projection counts one logical row, excludes fixed right duplicate and outside siblings", () => {
  class Host {}
  const prior = globalThis.HTMLElement;
  globalThis.HTMLElement = Host;
  try {
    const record = { twapId: 7, state: { coin: "BTC" } },
      host = node();
    host.type = "div";
    host.stateNode = Object.assign(new Host(), { innerText: "BTC 2 BTC" });
    const left = node({ record, columnConfigs: [], renderMode: "left" }, [
        host,
      ]),
      right = node({ record, columnConfigs: [], renderMode: "right" }),
      body = node({}, [left, right]);
    body.sibling = node({
      record: { twapId: 99 },
      columnConfigs: [],
      renderMode: "left",
    });
    const rows = projectTwapRenderedRows(body);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].record.twapId, 7);
    assert.equal(rows[0].text, "BTC 2 BTC");
  } finally {
    if (prior === undefined) delete globalThis.HTMLElement;
    else globalThis.HTMLElement = prior;
  }
});
test("TWAP row projection fails when a logical row has no actual DOM host", () => {
  class Host {}
  const prior = globalThis.HTMLElement;
  globalThis.HTMLElement = Host;
  try {
    assert.throws(
      () =>
        projectTwapRenderedRows(
          node({}, [
            node({
              order: { twapId: 7 },
              columnConfigs: [],
              renderMode: "left",
            }),
          ]),
        ),
      /no DOM host/,
    );
  } finally {
    if (prior === undefined) delete globalThis.HTMLElement;
    else globalThis.HTMLElement = prior;
  }
});
test("TWAP tree scan limit fails closed instead of accepting a partial traversal", () => {
  const root = node();
  root.child = root;
  assert.throws(() => projectTwapTableState(root), /scan limit/);
});
