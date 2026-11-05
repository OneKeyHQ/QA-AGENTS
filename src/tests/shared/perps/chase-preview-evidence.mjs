// No event/service calls. A missing/true confirmation preference forbids click.
import assert from "node:assert/strict";
export function canonicalChaseDecimal(value) {
  assert.match(
    String(value),
    /^\d+(?:\.\d+)?$/u,
    "Exact unsigned decimal required",
  );
  const [integer, fraction = ""] = String(value).split(".");
  const a = integer.replace(/^0+(?=\d)/u, ""),
    b = fraction.replace(/0+$/u, "");
  return a + (b ? "." + b : "");
}
export function expectedChaseEligibility(order) {
  assert.ok(order && typeof order.coin === "string");
  return (
    !order.coin.startsWith("@") &&
    !order.coin.includes("/") &&
    order.orderType === "Limit" &&
    order.tif === "Gtc" &&
    !order.isTrigger &&
    !order.isPositionTpsl &&
    /^\d+(?:\.\d+)?$/u.test(String(order.sz)) &&
    Number(order.sz) > 0
  );
}
export function projectChaseEntry(start, element) {
  for (let f = start; f; f = f.return) {
    const p = f.memoizedProps;
    if (
      p?.order &&
      typeof p.canChaseOrder === "boolean" &&
      typeof p.isChasingOrder === "boolean"
    )
      return {
        order: p.order,
        canChase: p.canChaseOrder,
        busy: p.isChasingOrder,
        // The cancel label is always rendered on the right-side row, even
        // when chase is missing. This does not inventory only positive buttons.
        renderedButtons: [
          ...element.parentElement.querySelectorAll(
            '[data-testid^="perp-chase-order-"][data-testid$="-button"]',
          ),
        ].map((e) => e.getAttribute("data-testid")),
      };
  }
  return null;
}
export function projectChasePreviewState(start) {
  let row;
  const skips = [];
  const accounts = [];
  for (let f = start; f; f = f.return) {
    const props = f.memoizedProps;
    if (
      props?.order &&
      typeof props.canChaseOrder === "boolean" &&
      typeof props.isChasingOrder === "boolean"
    ) {
      const candidate = {
        order: props.order,
        canChase: props.canChaseOrder,
        busy: props.isChasingOrder,
      };
      if (row && JSON.stringify(row) !== JSON.stringify(candidate))
        throw Error("Conflicting chase row identity");
      row = candidate;
    }
    const name =
      f.type?.displayName || f.type?.type?.displayName || f.type?.name;
    if (name !== "PerpOpenOrdersList") continue;
    const hooks = new Set();
    for (let h = f.memoizedState; h; h = h.next) {
      if (hooks.has(h) || hooks.size > 4096)
        throw Error("Invalid chase hook chain");
      hooks.add(h);
      const seen = new Set();
      const visit = (v, depth) => {
        if (!v || typeof v !== "object" || depth > 4 || seen.has(v)) return;
        seen.add(v);
        if (typeof v.skipOrderConfirm === "boolean")
          skips.push(v.skipOrderConfirm);
        if (typeof v.accountAddress === "string")
          accounts.push(v.accountAddress.toLowerCase());
        for (const key of ["0", "1", "value", "v", "current"])
          if (Object.hasOwn(v, key)) visit(v[key], depth + 1);
      };
      visit(h.memoizedState, 0);
    }
  }
  if (!row) throw Error("Committed OpenOrdersRow required");
  // Project only data needed by the assertion; do not return product handlers.
  const fields = [
    "oid",
    "coin",
    "side",
    "sz",
    "origSz",
    "limitPx",
    "reduceOnly",
    "orderType",
    "tif",
    "isTrigger",
    "isPositionTpsl",
  ];
  const order = Object.fromEntries(
    fields
      .filter((k) => Object.hasOwn(row.order, k))
      .map((k) => [k, row.order[k]]),
  );
  return {
    ...row,
    order,
    skipValues: [...new Set(skips)],
    accounts: [...new Set(accounts)],
  };
}
// Self-contained so the exact same deny rule can run in a DOM capture listener
// immediately before React's bubble handlers, without an asynchronous gap.
export function chasePreviewBlockReason(
  state,
  { account, financial, canTrade },
) {
  if (canTrade !== true) return "Trading must already be enabled";
  if (JSON.stringify(state.skipValues) !== "[false]")
    return "Explicit skipOrderConfirm=false required";
  if (state.canChase !== true || state.busy !== false)
    return "Order is not available for preview";
  const order = state.order;
  if (
    !order ||
    typeof order.coin !== "string" ||
    order.coin.startsWith("@") ||
    order.coin.includes("/") ||
    order.orderType !== "Limit" ||
    order.tif !== "Gtc" ||
    order.isTrigger ||
    order.isPositionTpsl ||
    !/^\d+(?:\.\d+)?$/u.test(String(order.sz)) ||
    Number(order.sz) <= 0
  )
    return "Ineligible order";
  if (
    typeof account !== "string" ||
    !/^0x[\da-f]{40}$/iu.test(account) ||
    financial.account?.toLowerCase() !== account.toLowerCase()
  )
    return "Account mismatch";
  if (
    !state.accounts?.length ||
    state.accounts.some((a) => a !== account.toLowerCase())
  )
    return "Current list account mismatch";
  const candidates = financial.orders.filter(
    (o) => o.marketScope === "perp" && o.id === String(state.order.oid),
  );
  if (candidates.length !== 1) return "Existing order identity mismatch";
  const raw = candidates[0];
  for (const key of [
    "coin",
    "side",
    "sz",
    "limitPx",
    "reduceOnly",
    "isTrigger",
  ])
    if (raw[key] !== state.order[key])
      return "Existing order field mismatch: " + key;
  return null;
}
export function assertSafeChasePreview(state, context) {
  assert.equal(
    chasePreviewBlockReason(state, context),
    null,
    "Unsafe chase preview blocked",
  );
}
export function chaseDirection(order) {
  assert.ok(["B", "A"].includes(order.side), "Exact exchange side required");
  assert.equal(
    typeof order.reduceOnly,
    "boolean",
    "Explicit reduce-only flag required",
  );
  return order.side === "B"
    ? order.reduceOnly
      ? "平空"
      : "做多"
    : order.reduceOnly
      ? "平多"
      : "做空";
}
export function missingChaseDirections(verifiedDirections) {
  const required = ["做多", "做空", "平多", "平空"];
  assert.ok(Array.isArray(verifiedDirections));
  for (const direction of verifiedDirections)
    assert.ok(
      required.includes(direction),
      "Only individually verified directions may be recorded",
    );
  const seen = new Set(verifiedDirections);
  return required.filter((direction) => !seen.has(direction));
}
