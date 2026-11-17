// Serialized read-only projection. Inputs are committed hooks/props; all text
// evidence must come from the corresponding rendered DOM subtree.
export function projectBboPreview(start, button) {
  const name = (f) =>
    f.type?.displayName ||
    f.elementType?.displayName ||
    f.type?.type?.displayName ||
    f.type?.name ||
    f.type?.type?.name;
  let owner;
  for (let f = start; f; f = f.return)
    if (name(f)?.includes("SideButton")) {
      owner = f;
      break;
    }
  if (!owner) throw Error("Actual SideButton owner required");
  const childrenOf = (f) => {
    const children = [],
      visited = new Set();
    for (let c = f.child; c; c = c.sibling) {
      if (visited.has(c) || visited.size >= 10000)
        throw Error("Cyclic BBO sibling tree");
      visited.add(c);
      children.push(c);
    }
    return children;
  };
  const refs = [],
    books = new Map();
  const hooks = (fiber) => {
    const values = [],
      seen = new Set();
    for (let h = fiber.memoizedState; h; h = h.next) {
      if (seen.has(h) || seen.size >= 4096)
        throw Error("Invalid BBO hook chain");
      seen.add(h);
      values.push(h.memoizedState);
    }
    return values;
  };
  for (const h of hooks(owner)) {
    const v = h?.current;
    if (
      v?.activeTradeInstrument &&
      v.formData &&
      v.computedSizeForSide &&
      v.effectivePriceBN &&
      v.side
    )
      refs.push(v);
    const seen = new Set();
    const visit = (v, depth) => {
      if (!v || typeof v !== "object" || depth > 4 || seen.has(v)) return;
      seen.add(v);
      if (
        v.coin &&
        Array.isArray(v.bbo) &&
        v.bbo.length === 2 &&
        v.bbo.every((r) => r?.px != null)
      ) {
        const book = {
          coin: v.coin,
          time: v.time,
          bid: String(v.bbo[0].px),
          ask: String(v.bbo[1].px),
        };
        books.set(JSON.stringify(book), book);
      }
      for (const k of ["0", "1", "v", "value", "current"])
        if (Object.hasOwn(v, k)) visit(v[k], depth + 1);
    };
    visit(h, 0);
  }
  if (refs.length !== 1)
    throw Error(
      `Exactly one committed BBO panel ref required, got ${refs.length}`,
    );
  const v = refs[0],
    stack = [owner],
    costs = [],
    leaves = [],
    componentNames = new Set(),
    seenNodes = new Set();
  const hostFor = (f) => {
    const pending = [f],
      visited = new Set();
    while (pending.length && visited.size < 10000) {
      const n = pending.pop();
      if (visited.has(n)) throw Error("Cyclic BBO host tree");
      visited.add(n);
      if (typeof n.type === "string" && n.stateNode instanceof HTMLElement)
        return n.stateNode;
      const children = childrenOf(n);
      pending.push(...children.reverse());
    }
    throw Error("Visible BBO numeric field has no DOM host");
  };
  for (let count = 0; stack.length && count < 10000; count++) {
    const f = stack.pop(),
      p = f.memoizedProps;
    if (name(f)) componentNames.add(name(f));
    if (
      p?.formatter === "value" &&
      p.formatterOptions?.currency === "$" &&
      ["number", "string"].includes(typeof p.children)
    ) {
      const host = hostFor(f);
      if (!seenNodes.has(host)) {
        seenNodes.add(host);
        costs.push({ raw: String(p.children), text: host.innerText });
      }
    }
    if (name(f) === "EstLiqPriceLeaf") {
      const values = hooks(f).filter(
        (h) =>
          Array.isArray(h) &&
          h.length === 2 &&
          Array.isArray(h[1]) &&
          h[1].length === 18 &&
          h[1][16] === v.side &&
          typeof h[1][17]?.toFixed === "function",
      );
      if (values.length !== 1)
        throw Error("Actual liquidation hook dependency schema changed");
      const [raw, deps] = values[0];
      leaves.push({
        raw: raw?.toFixed() ?? null,
        text: hostFor(f).innerText,
        account: deps[0],
        maxLeverage: deps[1],
        mark: deps[2],
        assetData: deps[3],
        mode: deps[4],
        coin: deps[5],
        crossAvailable: deps[6]?.toFixed() ?? null,
        position: deps[7] ?? null,
        reduceOnly: Boolean(deps[10]),
        type: deps[13],
        tiers: deps[14],
        price: deps[15].toFixed(),
        side: deps[16],
        quantity: deps[17].toFixed(),
      });
      continue;
    }
    const children = childrenOf(f);
    stack.push(...children.reverse());
  }
  if (stack.length) throw Error("BBO preview tree scan limit reached");
  return {
    coin: v.activeTradeInstrument.coin,
    spot: v.isSpot,
    side: v.side,
    mode: v.formData.bboPriceMode,
    type: v.formData.type,
    orderMode: v.formData.orderMode,
    advanced: Boolean(v.isScaleMode || v.isTriggerMode || v.isTwapMode),
    price: v.effectivePriceBN.toFixed(),
    priceError: v.priceError,
    quantity: v.computedSizeForSide.toFixed(),
    rawSize: v.formData.size,
    sizeInputMode: v.formData.sizeInputMode,
    szDecimals: v.szDecimals,
    orderValue: v.orderValue.toFixed(),
    leverage: v.leverage,
    books: [...books.values()],
    now: Date.now(),
    buttonText: button.innerText,
    costs,
    liquidation: leaves,
    diagnostic: leaves.length ? null : {
      owner: name(owner),
      refKeys: Object.keys(v),
      components: [...componentNames],
      memoDependencies: hooks(owner).flatMap((h, i) =>
        Array.isArray(h) && Array.isArray(h[1]) && h[1].length >= 15
          ? [{ hook: i, length: h[1].length, kinds: h[1].map(x => typeof x) }]
          : []),
    },
  };
}

export function projectBboFormState(start) {
  for (let f = start; f; f = f.return) {
    const name =
      f.type?.displayName || f.type?.type?.displayName || f.type?.name;
    if (!name?.includes("PerpTradingForm")) continue;
    const forms = [],
      instruments = [],
      seen = new Set();
    const visit = (v, depth) => {
      if (!v || typeof v !== "object" || depth > 4 || seen.has(v)) return;
      seen.add(v);
      if (
        ["market", "limit"].includes(v.type) &&
        Object.hasOwn(v, "bboPriceMode") &&
        Object.hasOwn(v, "sizeInputMode")
      )
        forms.push(v);
      if (
        ["perp", "spot"].includes(v.mode) &&
        typeof v.coin === "string" &&
        v.universe &&
        Object.hasOwn(v, "assetId")
      )
        instruments.push(v);
      for (const k of ["0", "1", "v", "value", "current"])
        if (Object.hasOwn(v, k)) visit(v[k], depth + 1);
    };
    const hookSeen = new Set();
    for (let h = f.memoizedState; h; h = h.next) {
      if (hookSeen.has(h) || hookSeen.size >= 4096)
        throw Error("Invalid trading form hooks");
      hookSeen.add(h);
      visit(h.memoizedState, 0);
    }
    const unique = (xs) => [
      ...new Map(xs.map((x) => [JSON.stringify(x), x])).values(),
    ];
    const fs = unique(forms),
      ins = unique(instruments);
    if (fs.length !== 1 || ins.length !== 1)
      throw Error(
        `One committed form/instrument required: ${fs.length}/${ins.length}; identities=${JSON.stringify(ins.map(x => ({mode:x.mode,coin:x.coin,assetId:x.assetId,keys:Object.keys(x)})))}`,
      );
    return { form: fs[0], instrument: ins[0] };
  }
  throw Error("Actual PerpTradingForm owner required");
}
