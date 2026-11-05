// Serialized read-only evidence. No callback or atom writer is invoked.
export function projectSizingInput(start, element) {
  const seen = new Set();
  let size;
  for (let f = start; f; f = f.return) {
    if (seen.has(f) || seen.size >= 4096)
      throw Error("Invalid sizing parent chain");
    seen.add(f);
    const p = f.memoizedProps;
    if (
      p?.activeAsset?.universe &&
      typeof p.referencePrice === "string" &&
      typeof p.leverage === "number" &&
      typeof p.onRequestManualMode === "function"
    ) {
      const candidate = {
        token: p.value,
        display: element.value,
        reference: p.referencePrice,
        leverage: p.leverage,
        decimals: p.activeAsset.universe.szDecimals,
        symbol: p.symbol,
        ready: p.isAssetCtxReady,
        mode: p.sizeInputMode,
        percent: p.sliderPercent,
      };
      if (size && JSON.stringify(candidate) !== JSON.stringify(size))
        throw Error("Ambiguous SizeInput evidence");
      size = candidate;
    }
  }
  if (!size) throw Error("Actual main SizeInput props missing");
  return size;
}
export function projectSizingSide(start, element) {
  const parents = new Set();
  for (let f = start; f; f = f.return) {
    if (parents.has(f) || parents.size >= 4096)
      throw Error("Invalid sizing button parent chain");
    parents.add(f);
    const name =
      f.type?.displayName ||
      f.type?.type?.displayName ||
      f.type?.name ||
      f.type?.type?.name;
    if (!name?.includes("SideButton")) continue;
    const refs = [],
      feeds = [],
      seenHooks = new Set();
    for (let h = f.memoizedState; h; h = h.next) {
      if (seenHooks.has(h) || seenHooks.size >= 4096)
        throw Error("Invalid sizing hook chain");
      seenHooks.add(h);
      const v = h.memoizedState?.current;
      if (
        v?.activeTradeInstrument &&
        v.formData &&
        v.computedSizeForSide &&
        v.effectivePriceBN &&
        v.orderValue &&
        v.side
      )
        refs.push(v);
      const seen = new Set();
      const visit = (x, depth) => {
        if (!x || typeof x !== "object" || depth > 4 || seen.has(x)) return;
        seen.add(x);
        if (
          x.coin &&
          (x.accountAddress || x.user) &&
          Array.isArray(x.maxTradeSzs) &&
          x.markPx !== undefined
        ) {
          if (x.accountAddress && x.user && x.accountAddress.toLowerCase() !== x.user.toLowerCase())
            throw Error('Conflicting max feed account identities');
          feeds.push({
            coin: x.coin,
            account: x.accountAddress ?? x.user,
            mark: String(x.markPx),
            maxima: x.maxTradeSzs.map(String),
            leverage: x.leverage?.value,
          });
        }
        for (const k of ["0", "1", "value", "current", "v"])
          if (Object.hasOwn(x, k)) visit(x[k], depth + 1);
      };
      visit(h.memoizedState, 0);
    }
    if (refs.length !== 1)
      throw Error("Expected one committed side sizing ref");
    const v = refs[0];
    return {
      coin: v.activeTradeInstrument.coin,
      account: v.perpsAccount?.accountAddress,
      spot: v.isSpot,
      side: v.side,
      type: v.formData.type,
      orderMode: v.formData.orderMode,
      mode: v.formData.sizeInputMode,
      percent: v.formData.sizePercent,
      unit: v.resolvedSizeInputUnit,
      quantity: v.computedSizeForSide.toFixed(),
      // TWAP calculations intentionally use the market-wide mark, not the effective mid.
      price: (v.formData.orderMode === "twap"
        ? v.twapReferencePriceBN
        : v.effectivePriceBN
      )?.toFixed(),
      twapMark: v.twapTriggerReferencePriceBN?.toFixed(),
      value: v.orderValue.toFixed(),
      leverage: v.leverage,
      decimals: v.szDecimals,
      reduceOnly: Boolean(
        v.formData.orderMode === "twap"
          ? v.formData.twapReduceOnly
          : v.formData.scaleReduceOnly,
      ),
      feeds: [...new Map(feeds.map((x) => [JSON.stringify(x), x])).values()],
      text: element.innerText,
    };
  }
  throw Error("Actual SideButton sizing owner missing");
}
