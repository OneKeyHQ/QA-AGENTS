// Read actual cell DOM, including fixed right columns. No product callbacks.
export function projectTwapCellRows(start) {
  let owner;
  const ancestors = new Set();
  for (let f = start; f; f = f.return) {
    if (ancestors.has(f) || ancestors.size >= 10000)
      throw Error("Invalid TWAP ancestor tree");
    ancestors.add(f);
    if (
      f.memoizedProps?.listViewDebugRenderTrackerProps?.name?.startsWith(
        "PerpTwapList_",
      ) &&
      Array.isArray(f.memoizedProps.columns)
    ) {
      owner = f;
      break;
    }
  }
  if (!owner) throw Error("Actual TWAP table owner required");
  const out = [],
    stack = [owner],
    seen = new Set();
  const childrenOf = (f) => {
    const children = [],
      visited = new Set();
    for (let c = f.child; c; c = c.sibling) {
      if (visited.has(c) || visited.size >= 10000)
        throw Error("Cyclic TWAP sibling tree");
      visited.add(c);
      children.push(c);
    }
    return children;
  };
  const canvas = new OffscreenCanvas(1, 1).getContext("2d");
  if (!canvas) throw Error("TWAP CSS color normalization unavailable");
  const normalize = (color) => {
    if (!color.trim()) return null;
    canvas.fillStyle = "#010203";
    canvas.fillStyle = color;
    const normalized = canvas.fillStyle;
    canvas.fillStyle = "#040506";
    canvas.fillStyle = color;
    if (normalized !== canvas.fillStyle)
      throw Error("TWAP theme color cannot be parsed");
    return normalized;
  };
  const hostFor = (f) => {
    const pending = [f],
      visited = new Set();
    while (pending.length && visited.size < 10000) {
      const n = pending.pop();
      if (visited.has(n)) throw Error("Cyclic TWAP DOM host tree");
      visited.add(n);
      if (typeof n.type === "string" && n.stateNode instanceof HTMLElement)
        return n.stateNode;
      const children = childrenOf(n);
      pending.push(...children.reverse());
    }
    throw Error("TWAP cell has no actual DOM host");
  };
  while (stack.length && seen.size < 100000) {
    const f = stack.pop();
    if (seen.has(f)) throw Error("Cyclic TWAP cell tree");
    seen.add(f);
    const p = f.memoizedProps;
    const name = f.type?.displayName || f.type?.name;
    if (
      ["TwapActiveRow", "TwapHistoryRow", "TwapFillRow"].includes(name) &&
      Array.isArray(p.columnConfigs)
    ) {
      const host = hostFor(f),
        domCells = [...host.children];
      const indices =
        p.renderMode === "right"
          ? [p.columnConfigs.length - 1]
          : p.renderMode === "left"
            ? p.columnConfigs.slice(0, -1).map((_, i) => i)
            : p.columnConfigs.map((_, i) => i);
      if (domCells.length !== indices.length)
        throw Error(
          `TWAP ${name}/${p.renderMode}: ${domCells.length} DOM cells vs ${indices.length} columns`,
        );
      const propsByHost = new Map(),
        semanticByHost = new Map(),
        descendants = [f.child];
      for (let count = 0; descendants.length && count < 20000; count++) {
        const n = descendants.pop();
        if (!n) continue;
        if (n.memoizedProps?.color?.startsWith?.("$")) {
          const el = hostFor(n);
          for (let i = 0; i < domCells.length; i++)
            if (domCells[i] === el || domCells[i].contains(el)) {
              const token = n.memoizedProps.color;
              const values = propsByHost.get(domCells[i]) ?? new Set();
              values.add(token);
              propsByHost.set(domCells[i], values);
              const style = getComputedStyle(el),
                colors = semanticByHost.get(domCells[i]) ?? [];
              colors.push({
                token,
                resolved: normalize(
                  style.getPropertyValue("--" + token.slice(1)),
                ),
                actual: normalize(style.color),
              });
              semanticByHost.set(domCells[i], colors);
            }
        }
        if (n.sibling) descendants.push(n.sibling);
        if (n.child) descendants.push(n.child);
      }
      if (descendants.length) throw Error("TWAP color scan limit reached");
      out.push({
        record: p.order ?? p.record,
        renderMode: p.renderMode ?? "full",
        status: p.status,
        activatedAt: p.activatedAt,
        now: p.now,
        capturedAt: Date.now(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        spotDisplayMap: p.spotDisplayMap ?? {},
        spotPairDisplayNameMap: p.spotPairDisplayNameMap ?? {},
        cells: domCells.map((el, i) => ({
          key: p.columnConfigs[indices[i]].key,
          text: el.innerText,
          colorTokens: [...(propsByHost.get(el) ?? [])],
          semanticColors: semanticByHost.get(el) ?? [],
          domColors: [
            ...new Set(
              [el, ...el.querySelectorAll("*")].map(
                (child) => getComputedStyle(child).color,
              ),
            ),
          ],
        })),
      });
      continue;
    }
    const children = childrenOf(f);
    stack.push(...children.reverse());
  }
  if (stack.length) throw Error("TWAP cell scan limit reached");
  return out;
}
