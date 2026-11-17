// D17 手动用例：docs/qa/testcases/cases/perps/2026-10-27_Perps-历史成交筛选详情与分享.md
// History UI only; reads existing trades, never creates a sample order.
import assert from "node:assert/strict";
import { recordBeforeRestore } from "./restore-diagnostics.mjs";
import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RESULTS_DIR } from "../../helpers/index.mjs";
import { locator, currentPair, restorePair } from "../../helpers/perps-ui.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import { projectReactAll } from "./react-projection.mjs";
import { closePop, clickVisibleChoice, pollForm } from "./non-order-ui.mjs";
import {
  fillKey,
  historyIntersection,
  isSpotCoin,
  assertUniqueFillKeys,
  historyFilterIdentity,
} from "./history-oracle.mjs";
import { markRestoreFailure } from "./runtime.mjs";
import { spotMarketOracle } from "./public-market-oracle.mjs";
const aliases = JSON.parse(
  readFileSync(new URL("./data/spot-display-names.json", import.meta.url)),
).names;
async function spotNames() {
  return Object.fromEntries(
    (await spotMarketOracle()).map((r) => [
      r.coin,
      `${aliases[r.base] ?? r.base}/${r.quote}`,
    ]),
  );
}
const row = (ids, name, check, extra = {}) => ({
  ids: ids.split(","),
  name,
  check,
  ...extra,
});
const control = (p, key) => locator(p, `perps.history.${key}`);
const pop = (p) => locator(p, "perps.overlay.popover");
export async function historyState(p) {
  const snapshots = await projectReactAll(
    control(p, "type_filter"),
    (start) => {
      let root = start;
      while (root.return) root = root.return;
      const out = { tables: [], toolbars: [] };
      const stack = [root];
      for (let visited = 0; stack.length && visited < 100000; visited++) {
        const f = stack.pop(),
          props = f.memoizedProps;
        if (
          props?.listViewDebugRenderTrackerProps?.name ===
            "PerpTradesHistoryList" &&
          Array.isArray(props.data)
        )
          out.tables.push({
            data: props.data,
            page: props.currentListPage,
            pageSize: props.pageSize,
            loading: props.listLoading,
          });
        if (
          props?.filters &&
          typeof props.setFilters === "function" &&
          Array.isArray(props.marketOptions)
        )
          out.toolbars.push({
            filters: props.filters,
            options: props.marketOptions,
          });
        if (f.sibling) stack.push(f.sibling);
        if (f.child) stack.push(f.child);
      }
      return out;
    },
  );
  assert.equal(snapshots.length, 1);
  const s = snapshots[0];
  assert.equal(s.tables.length, 1, "Unique committed trade history table");
  assert.equal(s.toolbars.length, 1, "Unique trade toolbar");
  return { ...s.tables[0], ...s.toolbars[0] };
}
async function ready(p) {
  await control(p, "tab").click();
  await control(p, "type_filter").waitFor({ state: "visible" });
  return pollForm(
    () => historyState(p),
    (v) => !v.loading,
    "History loaded",
  );
}
async function choose(p, kind, value) {
  const key =
    kind === "type"
      ? "type_filter"
      : kind === "side"
        ? "side_filter"
        : "market_filter";
  await control(p, key).click();
  const target =
    kind === "type"
      ? control(p, `type_${value}`)
      : kind === "side"
        ? p
            .locator(`[data-testid="perps-funding-history-side-${value}"]`)
            .filter({ visible: true })
        : p
            .locator('[data-testid^="perps-funding-history-market-"]')
            .filter({ visible: true })
            .filter({ hasNot: p.locator("input") })
            .and(
              p.getByTestId(`perps-funding-history-market-${value ?? "all"}`),
            );
  await clickVisibleChoice(target);
  await pop(p).waitFor({ state: "hidden" });
  await pollForm(
    () => historyState(p),
    (s) => s.filters[kind] === value,
    `History ${kind}=${value}`,
  );
}
async function withHistory(p, fn) {
  const initial = await ready(p),
    original = initial.filters;
  writeFileSync(
    resolve(
      RESULTS_DIR,
      "perps-desktop-completion",
      `history-baseline-${Date.now()}.json`,
    ),
    JSON.stringify(initial, null, 2),
  );
  let primary;
  try {
    return await fn();
  } catch (e) {
    primary = e;
    await recordBeforeRestore(p, "history", e);
    throw e;
  } finally {
    try {
      await closePop(p);
      await choose(p, "type", original.type);
      await choose(p, "side", original.side);
      await choose(p, "market", original.market);
      assert.deepEqual(
        historyFilterIdentity((await historyState(p)).filters),
        historyFilterIdentity(original),
        "Independent history filter readback",
      );
    } catch (e) {
      if (primary) e.message = `原步骤: ${primary.message}; 恢复: ${e.message}`;
      throw markRestoreFailure(null, e, "恢复历史成交筛选");
    }
  }
}
async function reset(p) {
  await choose(p, "type", "all");
  await choose(p, "side", "all");
  await choose(p, "market", undefined);
  return historyState(p);
}
async function verifyRows(p, expected) {
  const s = await pollForm(
    () => historyState(p),
    (v) =>
      JSON.stringify(v.data.map(fillKey)) ===
      JSON.stringify(expected.map(fillKey)),
    "Exact filtered history identities",
  );
  assertUniqueFillKeys(s.data);
  assert.equal(s.page, 1, "Filter change resets first page");
  const body = locator(p, "perps.position.table_body");
  if (expected.length === 0) {
    const empty = locator(p, "perps.history.empty_state");
    assert.equal(
      await body.count(),
      0,
      "Empty Desktop history replaces table body",
    );
    assert.equal(await empty.count(), 1, "One visible history empty state");
    assert.equal(
      (await empty.innerText()).trim(),
      "未找到结果",
      "Filtered-empty title belongs to current history",
    );
    return s;
  }
  assert.equal(await body.count(), 1, "One visible desktop history body");
  const rendered = await projectReactAll(body, (f) => {
    const rows = [];
    const stack = [f];
    while (stack.length) {
      const n = stack.pop(),
        props = n.memoizedProps;
      if (
        props?.fill &&
        Array.isArray(props.columnConfigs) &&
        props.renderMode !== "right"
      ) {
        rows.push(props.fill);
        continue;
      }
      if (n.sibling && n !== f) stack.push(n.sibling);
      if (n.child) stack.push(n.child);
    }
    return rows;
  });
  // RenderMode full/left components may have memo wrappers: identity dedupe is
  // structural only after proving exactly one logical row per page index.
  const keys = rendered.flat().map(fillKey);
  assert.deepEqual(
    keys,
    expected.slice(0, s.pageSize).map(fillKey),
    "Rendered page rows match filtered raw records, in order",
  );
  return s;
}
async function renderedHistoryCells(p) {
  const groups = await projectReactAll(
    locator(p, "perps.position.table_body"),
    (f, body) => {
      const rows = [],
        stack = [f];
      while (stack.length) {
        const n = stack.pop(),
          v = n.memoizedProps;
        if (v?.fill && Array.isArray(v.columnConfigs)) {
          const hosts = [n];
          let host;
          while (hosts.length && !host) {
            const c = hosts.pop();
            if (
              c.stateNode instanceof HTMLElement &&
              body.contains(c.stateNode)
            )
              host = c.stateNode;
            else {
              const children = [];
              for (let child = c.child; child; child = child.sibling)
                children.push(child);
              hosts.push(...children.reverse());
            }
          }
          if (!host) throw Error("History row DOM unavailable");
          const columns =
            v.renderMode === "right"
              ? v.columnConfigs.slice(-1)
              : v.renderMode === "left"
                ? v.columnConfigs.slice(0, -1)
                : v.columnConfigs;
          if (host.children.length !== columns.length)
            throw Error(
              `History physical column mismatch ${host.children.length}/${columns.length}`,
            );
          rows.push({
            fill: v.fill,
            renderMode: v.renderMode ?? "full",
            cells: Object.fromEntries(
              columns.map((col, i) => [
                col.key,
                host.children[i].innerText.trim(),
              ]),
            ),
          });
          continue;
        }
        if (n.sibling && n !== f) stack.push(n.sibling);
        if (n.child) stack.push(n.child);
      }
      return rows;
    },
  );
  assert.equal(groups.length, 1);
  return groups[0];
}
export const historyDefinitions = [
  {
    id: "PERPS-DESKTOP-HISTORY-001",
    name: "Desktop 历史成交 §1 类型与方向交集",
    rows: [
      row("D17-18", "类型×方向组合、精确成交集合及类型清空市场", (p) =>
        withHistory(p, async () => {
          const all = await reset(p);
          assertUniqueFillKeys(all.data);
          if (!all.data.length)
            throw new SampleUnavailable(
              "当前账户无历史成交，需既有成交样本；不创建订单",
            );
          const results = [];
          const names = await spotNames();
          const groups = [
            all.options.find(
              (o) =>
                !o.coin.includes(":") &&
                all.data.some((f) => f.coin === o.coin),
            ),
            all.options.find(
              (o) => !o.coin.startsWith("spot:") && o.coin.includes(":"),
            ),
            all.options.find((o) => o.coin.startsWith("spot:")),
          ];
          if (groups.some((o) => !o))
            throw new SampleUnavailable(
              "交集复验需既有原生、DEX 与现货成交市场，不创建订单补样本",
            );
          for (const type of ["all", "perp", "spot"]) {
            await choose(p, "type", type);
            // Options intentionally follow type; select only markets actually
            // offered by that type, and verify all three side intersections.
            const available = (await historyState(p)).options;
            const markets = [
              undefined,
              ...groups
                .filter((o) => available.some((a) => a.coin === o.coin))
                .map((o) => o.coin),
            ];
            for (const market of markets) {
              await choose(p, "market", market);
              for (const side of ["all", "long", "short"]) {
                await choose(p, "side", side);
                const expected = historyIntersection(
                  all.data,
                  { type, side, market },
                  undefined,
                  names,
                );
                await verifyRows(p, expected);
                results.push({ type, side, market, count: expected.length });
              }
            }
          }
          assert.ok(
            all.data.some((f) => f.side === "B" && /close short/i.test(f.dir)),
            "既有平空买入样本须参与 B 方向对账",
          );
          await choose(p, "type", "all");
          await choose(p, "side", "long");
          await choose(p, "market", "active");
          await choose(p, "type", "perp");
          const state = (await historyState(p)).filters;
          assert.equal(state.type, "perp");
          assert.equal(state.side, "long");
          assert.equal(state.market, undefined);
          return JSON.stringify(results);
        }),
      ),
      row("D17-19", "当前市场跟随切币、固定市场保持", (p) =>
        withHistory(p, async () => {
          const all = await reset(p);
          const native = [
            ...new Set(
              all.data
                .filter((f) => !isSpotCoin(f.coin) && !f.coin.includes(":"))
                .map((f) => f.coin),
            ),
          ];
          if (native.length < 2)
            throw new SampleUnavailable(
              "至少两个不同原生永续的既有历史成交才可核对当前/固定市场跟随",
            );
          const original = await currentPair(p);
          try {
            await choose(p, "market", "active");
            await restorePair(p, `${native[0]}USDC`);
            await verifyRows(
              p,
              historyIntersection(all.data, { market: "active" }, native[0]),
            );
            await restorePair(p, `${native[1]}USDC`);
            await verifyRows(
              p,
              historyIntersection(all.data, { market: "active" }, native[1]),
            );
            await choose(p, "market", native[0]);
            await restorePair(p, `${native[0]}USDC`);
            await restorePair(p, `${native[1]}USDC`);
            await verifyRows(
              p,
              historyIntersection(all.data, { market: native[0] }),
            );
            const dexGroups = new Map();
            for (const option of all.options.filter(
              (o) => !o.coin.startsWith("spot:") && o.coin.includes(":"),
            )) {
              const base = option.coin.split(":").at(-1);
              dexGroups.set(base, [...(dexGroups.get(base) ?? []), option]);
            }
            const sameName = [...dexGroups.values()].find(
              (group) => group.length >= 2,
            );
            if (!sameName)
              throw new SampleUnavailable(
                "当前/固定市场已验证；同名不同 DEX 的既有成交样本缺失，不能替代该断言",
              );
            assert.notEqual(
              sameName[0].label,
              sameName[1].label,
              "同名 DEX 的可见筛选名称须可区分",
            );
            for (const option of sameName.slice(0, 2)) {
              await choose(p, "market", option.coin);
              const expected = historyIntersection(all.data, {
                market: option.coin,
              });
              assert.ok(expected.length > 0, "既有 DEX 样本不能以空集合通过");
              assert.ok(expected.every((f) => f.coin === option.coin));
              await verifyRows(p, expected);
            }
            return `当前跟随两原生市场；固定市场在顶部切到另一币后保持；${sameName
              .slice(0, 2)
              .map((o) => o.coin)
              .join(" / ")}逐笔隔离`;
          } finally {
            await restorePair(p, original);
          }
        }),
      ),
      row(
        "D17-20",
        "同基础币多报价聚合与可见完整交易对",
        (p) =>
          withHistory(p, async () => {
            const all = await reset(p),
              names = await spotNames();
            const bases = new Map();
            for (const fill of all.data.filter((f) => isSpotCoin(f.coin))) {
              const pair = names[fill.coin] ?? fill.coin;
              if (!pair.includes("/"))
                throw Error(`Missing independent spot metadata ${fill.coin}`);
              const base = pair.split("/")[0];
              bases.set(base, new Set([...(bases.get(base) ?? []), pair]));
            }
            const entry = [...bases].find(([, pairs]) => pairs.size > 1);
            if (!entry)
              throw new SampleUnavailable(
                "需同基础币不同报价币的既有现货成交，不创建订单",
              );
            const [base, pairs] = entry;
            assert.equal(
              all.options.filter((o) => o.coin === `spot:${base}`).length,
              1,
              "基础币筛选只出现一次",
            );
            await choose(p, "market", `spot:${base}`);
            const expected = historyIntersection(
              all.data,
              { market: `spot:${base}` },
              undefined,
              names,
            );
            await verifyRows(p, expected);
            const s = await historyState(p),
              rendered = await renderedHistoryCells(p);
            for (const item of rendered.filter(
              (r) => r.renderMode !== "right",
            )) {
              assert.equal(
                item.cells.asset,
                names[item.fill.coin] ?? item.fill.coin,
                "可见资产列须保留完整 BASE/QUOTE",
              );
            }
            assert.equal(
              rendered.filter((r) => r.renderMode !== "right").length,
              Math.min(expected.length, s.pageSize),
            );
            return `${base} 单一筛选聚合 ${[...pairs].join(" / ")}，逐笔身份和可见完整交易对对账`;
          }),
        {
          complete: false,
          missing:
            "此步骤完成现货列表/聚合；DEX选项标识由D17-19验证；Desktop源码未提供移动端详情入口，详情分支不能宣称实机覆盖",
        },
      ),
    ],
  },
];
export const historyBoundarySuite = createDesktopRowSuite(historyDefinitions);
