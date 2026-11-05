// Observe existing account-scoped IDs; no list mutation or order endpoint.
import assert from "node:assert/strict";
import { projectReactAll } from "./react-projection.mjs";
import { locator } from "../../helpers/perps-ui.mjs";
// Keep changing prices/PnL out of the baseline, but retain financial identity.
// This is an observation after each row, not a request/signature interceptor.
export function normalizeFinancialState(states) {
  const accounts = [...new Set(states.map((s) => s.account?.toLowerCase()))];
  assert.equal(accounts.length, 1, "One observed financial account required");
  assert.match(
    accounts[0] ?? "",
    /^0x[\da-f]{40}$/u,
    "Full financial account required",
  );
  const result = { account: accounts[0] };
  for (const kind of ["orders", "twap", "positions"]) {
    const variants = states
      .filter((s) => s.kind === kind)
      .map((s) => {
        assert.ok(Array.isArray(s.data), `Readable ${kind} store required`);
        const data = s.data
          .map((r) => {
            if (kind === "positions") {
              const p = r.position;
              assert.ok(
                p?.coin && p.szi !== undefined && p.entryPx !== undefined,
                "Complete position identity required",
              );
              return {
                coin: p.coin,
                size: String(p.szi),
                entry: String(p.entryPx),
              };
            }
            const id = r.oid ?? r.orderId ?? r.twapId;
            assert.ok(id !== undefined, "Every observed order has a stable ID");
            const record = { id: String(id) };
            if (kind === "orders" && s.scope) record.marketScope = s.scope;
            for (const key of [
              "coin",
              "side",
              "sz",
              "size",
              "limitPx",
              "triggerPx",
              "reduceOnly",
              "isTrigger",
            ])
              if (r[key] !== undefined) record[key] = r[key];
            return record;
          })
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
        return {
          scope: kind === "orders" ? (s.scope ?? "unclassified") : kind,
          data,
        };
      });
    assert.ok(variants.length, `Readable ${kind} baseline required`);
    const sources = new Map();
    for (const v of variants) {
      if (sources.has(v.scope))
        assert.deepEqual(
          v.data,
          sources.get(v.scope),
          `Conflicting ${kind}/${v.scope} snapshots`,
        );
      else sources.set(v.scope, v.data);
    }
    result[kind] = [...sources.values()]
      .flat()
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  return result;
}
export async function snapshotFinancialState(page) {
  const result = await projectReactAll(
    locator(page, "perps.position.tab"),
    (start) => {
      const states = [];
      for (let f = start; f; f = f.return) {
        const name =
          f.type?.displayName || f.type?.type?.displayName || f.type?.name;
        if (name !== "TabBarItem") continue;
        for (let h = f.memoizedState, i = 0; h && i < 250; h = h.next, i++) {
          const seen = new Set();
          function visit(v, d) {
            if (!v || typeof v !== "object" || d > 4 || seen.has(v)) return;
            seen.add(v);
            if (Object.hasOwn(v, "accountAddress"))
              for (const [key, kind] of [
                ["openOrders", "orders"],
                ["twapOrders", "twap"],
                ["activePositions", "positions"],
              ])
                if (Array.isArray(v[key]))
                  states.push({
                    account: v.accountAddress,
                    kind,
                    ...(kind === "orders"
                      ? {
                          scope: Object.hasOwn(v, "openOrdersByCoin")
                            ? "perp"
                            : h.memoizedState?.[2]?.name ===
                                "spotActiveOpenOrdersAtom"
                              ? "spot"
                              : (() => {
                                  throw Error(
                                    "Unrecognized open-order store; refuse to merge ambiguous snapshots",
                                  );
                                })(),
                        }
                      : {}),
                    data: v[key],
                  });
            for (const k of ["0", "1", "value", "current", "v"])
              if (Object.hasOwn(v, k)) visit(v[k], d + 1);
          }
          visit(h.memoizedState, 0);
        }
      }
      return states;
    },
  );
  assert.equal(result.length, 1, "One financial observation boundary");
  return normalizeFinancialState(result[0]);
}
export async function existingOrderIds(page) {
  const result = await projectReactAll(
    locator(page, "perps.position.tab"),
    (start) => {
      const states = [];
      for (let f = start; f; f = f.return) {
        const name =
          f.type?.displayName || f.type?.type?.displayName || f.type?.name;
        if (name !== "TabBarItem") continue;
        for (let h = f.memoizedState, i = 0; h && i < 250; h = h.next, i++) {
          const seen = new Set();
          function visit(v, d) {
            if (!v || typeof v !== "object" || d > 4 || seen.has(v)) return;
            seen.add(v);
            if (
              Object.hasOwn(v, "accountAddress") &&
              (Array.isArray(v.openOrders) || Array.isArray(v.twapOrders))
            )
              states.push({
                account: v.accountAddress,
                kind: Array.isArray(v.openOrders) ? "order" : "twap",
                ids: (v.openOrders ?? v.twapOrders).map((o) =>
                  String(o.oid ?? o.orderId ?? o.twapId),
                ),
              });
            for (const k of ["0", "1", "value", "current", "v"])
              if (Object.hasOwn(v, k)) visit(v[k], d + 1);
          }
          visit(h.memoizedState, 0);
        }
      }
      return states;
    },
  );
  assert.equal(result.length, 1);
  assert.ok(
    result[0].some((s) => s.kind === "order"),
    "Readable existing order store required",
  );
  assert.ok(
    result[0].some((s) => s.kind === "twap"),
    "Readable existing TWAP store required",
  );
  const states = [
    ...new Set(
      result[0].map((s) => JSON.stringify({ ...s, ids: [...s.ids].sort() })),
    ),
  ].map((s) => JSON.parse(s));
  assert.ok(
    states.every((s) => s.ids.every((id) => id !== "undefined")),
    "Every existing order has stable ID",
  );
  return states.sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b)),
  );
}
