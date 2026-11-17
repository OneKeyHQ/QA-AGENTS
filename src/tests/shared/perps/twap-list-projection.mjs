// Read-only committed-fiber projections. No callbacks or atom setters are invoked.

export function projectTwapTableState(start) {
  let root = start;
  while (root.return) root = root.return;
  const tables = [],
    subtabs = [],
    stack = [root],
    seen = new Set(),
    subSeen = new Set();
  for (let count = 0; stack.length && count < 100000; count++) {
    const f = stack.pop(),
      v = f.memoizedProps;
    if (
      v?.listViewDebugRenderTrackerProps?.name?.startsWith("PerpTwapList_") &&
      Array.isArray(v.data) &&
      Array.isArray(v.columns) &&
      !seen.has(v)
    ) {
      seen.add(v);
      tables.push({
        tab: v.listViewDebugRenderTrackerProps.name.slice(
          "PerpTwapList_".length,
        ),
        data: v.data,
        page: v.currentListPage ?? 1,
        pageSize: v.pageSize ?? 20,
        columns: v.columns.map((c) => ({ key: c.key, title: c.title })),
        empty: v.emptyMessage,
      });
    }
    if (
      Array.isArray(v?.tabs) &&
      v.tabs.length === 3 &&
      ["active", "history", "fills"].every((key) =>
        v.tabs.some((t) => t.key === key),
      ) &&
      typeof v.onChange === "function" &&
      !subSeen.has(v)
    ) {
      subSeen.add(v);
      subtabs.push({
        active: v.activeTab,
        tabs: v.tabs.map((t) => ({ key: t.key, label: t.label })),
      });
    }
    if (f.sibling) stack.push(f.sibling);
    if (f.child) stack.push(f.child);
  }
  if (stack.length) throw Error("TWAP committed tree scan limit reached");
  return { tables, subtabs };
}

export function projectTwapRenderedRows(start) {
  const records = [],
    stack = [start];
  while (stack.length) {
    const f = stack.pop(),
      v = f.memoizedProps;
    if (
      Array.isArray(v?.columnConfigs) &&
      v.renderMode !== "right" &&
      (v.order?.twapId !== undefined || v.record?.twapId !== undefined)
    ) {
      const descendants = [f.child];
      let element;
      while (descendants.length) {
        const child = descendants.pop();
        if (!child) continue;
        if (
          typeof child.type === "string" &&
          child.stateNode instanceof HTMLElement
        ) {
          element = child.stateNode;
          break;
        }
        if (child.sibling) descendants.push(child.sibling);
        if (child.child) descendants.push(child.child);
      }
      if (!element) throw Error("TWAP rendered row has no DOM host");
      records.push({
        record: v.order ?? v.record,
        text: element.innerText,
        spotDisplayMap: v.spotDisplayMap ?? {},
        spotPairDisplayNameMap: v.spotPairDisplayNameMap ?? {},
      });
      continue;
    }
    if (f.sibling && f !== start) stack.push(f.sibling);
    if (f.child) stack.push(f.child);
  }
  return records;
}

export function ownsTwapTable(fiber) {
  for (let n = fiber; n; n = n.return) {
    const v = n.memoizedProps;
    if (
      v?.listViewDebugRenderTrackerProps?.name?.startsWith("PerpTwapList_") &&
      Array.isArray(v.columns)
    )
      return true;
  }
  return false;
}
