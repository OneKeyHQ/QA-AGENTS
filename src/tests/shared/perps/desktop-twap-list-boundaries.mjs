// D11 手动用例：docs/qa/testcases/cases/perps/2026-06-03_Perps-分时分段委托下单.md
// Existing TWAP records only. Never terminate, authorize, sign or create orders.
import assert from "node:assert/strict";
import {
  projectTwapTableState,
  projectTwapRenderedRows,
  ownsTwapTable,
} from "./twap-list-projection.mjs";
import { projectTwapCellRows } from "./twap-cell-projection.mjs";
import {
  assertTwapFieldRows,
  twapRowLocale,
  twapStatusLabels,
} from "./twap-row-evidence.mjs";
import { locator } from "../../helpers/perps-ui.mjs";
import { unlockWalletIfNeeded } from "../../helpers/index.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import { infoTabs, currentInfoTab, restoreInfoTab } from "./info-tab.mjs";
import { projectReactAll } from "./react-projection.mjs";
import { pollForm } from "./non-order-ui.mjs";
import { markRestoreFailure } from "./runtime.mjs";
import { recordBeforeRestore } from "./restore-diagnostics.mjs";
import { snapshotFinancialState } from "./order-observation.mjs";
import {
  twapSchemas,
  twapRecordKey,
  assertTwapRecords,
  twapPageRecords,
  expectedActiveTwapIds,
} from "./twap-list-evidence.mjs";

async function mainTab(p) {
  const tabs = await infoTabs(p),
    index = tabs.findIndex((t) => t.name === "TWAP");
  assert.ok(index >= 0, "Desktop TWAP main entry must exist");
  return locator(p, "perps.info.tab_items").nth(index);
}
export async function desktopTwapState(p) {
  const states = await projectReactAll(await mainTab(p), projectTwapTableState);
  assert.equal(states.length, 1);
  const s = states[0];
  assert.equal(s.tables.length, 1, "One committed TWAP table");
  assert.equal(s.subtabs.length, 1, "One actual three-entry TWAP subtab bar");
  assert.equal(
    s.tables[0].tab,
    s.subtabs[0].active,
    "Rendered table matches selected subtab",
  );
  return { ...s.tables[0], tabs: s.subtabs[0].tabs };
}
export async function selectSubtab(p, key) {
  await unlockWalletIfNeeded(p);
  const s = await desktopTwapState(p),
    label = s.tabs.find((t) => t.key === key)?.label;
  assert.ok(label);
  if (s.tab === key) return s;
  const candidates = p
    .getByText(label, { exact: true })
    .filter({ visible: true });
  const matches = await projectReactAll(candidates, (f) => {
    for (let n = f; n; n = n.return) {
      const v = n.memoizedProps;
      if (
        Array.isArray(v?.tabs) &&
        v.tabs.length === 3 &&
        ["active", "history", "fills"].every((key) =>
          v.tabs.some((t) => t.key === key),
        ) &&
        typeof v.onChange === "function"
      )
        return true;
    }
    return false;
  });
  const indices = matches.flatMap((match, i) => (match ? [i] : []));
  assert.equal(
    indices.length,
    1,
    "Unique visible control owned by actual TWAP subtabs",
  );
  await candidates.nth(indices[0]).click();
  return pollForm(
    () => desktopTwapState(p),
    (v) => v.tab === key,
    `TWAP subtab ${key}`,
  );
}
export async function assertRendered(p, state) {
  assert.deepEqual(
    state.columns.map((c) => c.key),
    twapSchemas[state.tab],
    "Exact Desktop columns and order",
  );
  const expected = twapPageRecords(
      state.tab,
      state.data,
      state.page,
      state.pageSize,
    ),
    body = locator(p, "perps.position.table_body");
  if (state.data.length === 0) {
    assert.equal(await body.count(), 0, "Empty state replaces TWAP table body");
    const title = p
      .getByText(state.empty, { exact: true })
      .filter({ visible: true });
    assert.equal(
      await title.count(),
      1,
      "Exact current entry empty title visible",
    );
    return [];
  }
  assert.equal(await body.count(), 1, "One visible TWAP body");
  const actual = await projectReactAll(body, projectTwapRenderedRows);
  assert.deepEqual(
    assertTwapRecords(
      state.tab,
      actual.flat().map((r) => r.record),
    ),
    expected.map((r) => twapRecordKey(state.tab, r)),
    "Rendered page exact ordered logical records; fixed right columns excluded",
  );
  for (const row of actual.flat()) {
    const coin = (row.record.state ?? row.record.fill).coin;
    let asset = coin.includes(":") ? coin.slice(coin.indexOf(":") + 1) : coin;
    if (coin.startsWith("@"))
      asset = row.spotPairDisplayNameMap[coin] ?? row.spotDisplayMap[coin];
    if (!asset)
      throw new SampleUnavailable(
        `缺少${coin}显示名元数据，不能跳过资产文本断言`,
      );
    assert.ok(
      row.text.includes(asset),
      `Actual DOM row must contain its own asset ${asset}`,
    );
  }
  const text = await body.innerText();
  assert.ok(text.trim().length > 0, "Rows contain visible cell text");
  return expected;
}
async function pageControl(p, key) {
  const candidates = locator(p, key),
    matches = await projectReactAll(candidates, (f) => {
      let footer = false,
        table = false;
      for (let n = f; n; n = n.return) {
        const v = n.memoizedProps;
        if (
          typeof v?.currentPage === "number" &&
          typeof v.onPreviousPage === "function" &&
          typeof v.onNextPage === "function"
        )
          footer = true;
        if (
          v?.listViewDebugRenderTrackerProps?.name?.startsWith(
            "PerpTwapList_",
          ) &&
          Array.isArray(v.columns)
        )
          table = true;
      }
      return footer && table;
    });
  const indices = matches.flatMap((yes, i) => (yes ? [i] : []));
  assert.equal(
    indices.length,
    1,
    "One pagination control owned by current TWAP table",
  );
  return candidates.nth(indices[0]);
}
const pageInput = (p) =>
  pageControl(p, "perps.perp-input-with-accessory-done-view-input");
const pageButton = (p, direction) =>
  pageControl(
    p,
    direction === "next"
      ? "perps.perp-icon-btn"
      : "perps.perp-handle-input-blur-icon-btn",
  );
export async function jump(p, value) {
  await unlockWalletIfNeeded(p);
  const input = await pageInput(p);
  assert.equal(await input.count(), 1, "One visible TWAP page input");
  await input.fill(String(value));
  await input.press("Enter");
}
export async function withTwap(p, callback) {
  const prior = await currentInfoTab(p);
  await restoreInfoTab(p, "TWAP");
  const initial = await desktopTwapState(p);
  let primary;
  try {
    return await callback(initial);
  } catch (e) {
    primary = e;
    await recordBeforeRestore(p, "twap-lists", e);
    throw e;
  } finally {
    try {
      await selectSubtab(p, initial.tab);
      let s = await desktopTwapState(p);
      if (s.page !== initial.page) {
        await jump(p, initial.page);
        s = await pollForm(
          () => desktopTwapState(p),
          (v) => v.page === initial.page,
          "Restore original TWAP page",
        );
      }
      assert.equal(s.tab, initial.tab);
      assert.equal(
        s.page,
        initial.page,
        "Independent TWAP subtab/page restore readback",
      );
      await restoreInfoTab(p, prior);
    } catch (e) {
      if (primary) e.message = `原步骤: ${primary.message}; 恢复: ${e.message}`;
      throw markRestoreFailure(null, e, "恢复TWAP子页签/页码");
    }
  }
}
export const twapListDefinitions = [
  {
    id: "PERPS-TWAP-001",
    name: "分时委托三个入口、计数及空状态",
    rows: [
      {
        ids: ["D11-204"],
        name: "三个独立入口及主计数与未结束订单ID对账",
        check: (p) =>
          withTwap(p, async () => {
            const financial = await snapshotFinancialState(p),
              rawIds = financial.twap.map((r) => r.id);
            const history = await selectSubtab(p, "history");
            await assertRendered(p, history);
            const fills = await selectSubtab(p, "fills");
            await assertRendered(p, fills);
            const active = await selectSubtab(p, "active");
            await assertRendered(p, active);
            const expected = expectedActiveTwapIds(rawIds, history.data);
            assert.deepEqual(
              active.data.map((r) => String(r.twapId)).sort(),
              expected,
              "Current list IDs equal raw active IDs minus terminal IDs",
            );
            const title = (await (await mainTab(p)).innerText()).trim();
            const base = title.replace(/\s*\(\d+\)$/u, "");
            assert.ok(
              ["分时委托", "TWAP Orders"].includes(base),
              "Known localized TWAP title",
            );
            assert.equal(
              title,
              expected.length ? `${base} (${expected.length})` : base,
              "Exact main count; no historical/fill count reused",
            );
            return `当前${active.data.length} / 历史${history.data.length} / 成交${fills.data.length}，独立读回三入口及计数`;
          }),
      },
      {
        ids: ["D11-207"],
        name: "三个入口各自精确空状态",
        check: (p) =>
          withTwap(p, async () => {
            const missing = [];
            for (const [tab, title] of [
              ["active", ["暂无分时委托", "No active TWAP"]],
              ["history", ["暂无分时委托历史", "No TWAP history"]],
              ["fills", ["暂无分时委托成交历史", "No TWAP fill history"]],
            ]) {
              const s = await selectSubtab(p, tab);
              if (s.data.length) {
                missing.push(`${tab}现有${s.data.length}条`);
                continue;
              }
              assert.ok(
                title.includes(s.empty),
                "Exact Chinese/English empty title for current entry",
              );
              await assertRendered(p, s);
            }
            if (missing.length)
              throw new SampleUnavailable(
                `已检查可执行空入口，其余需空记录账户：${missing.join("；")}；不创建或删除样本`,
              );
            return "三个空状态逐入口核对，无底层表格残留";
          }),
      },
      {
        ids: ["D11-249"],
        name: "Desktop三页签全部字段、六状态及颜色逐条对账",
        check: (p) =>
          withTwap(p, async () => {
            const history = await selectSubtab(p, "history"),
              statuses = new Set(),
              missing = [],
              counts = {};
            const rawHistory = history.data;
            for (const tab of ["history", "active", "fills"]) {
              let s = await selectSubtab(p, tab);
              counts[tab] = s.data.length;
              if (!s.data.length) {
                await assertRendered(p, s);
                missing.push(`${tab}无已有记录`);
                continue;
              }
              if (s.page !== 1) {
                await jump(p, 1);
                s = await pollForm(
                  () => desktopTwapState(p),
                  (v) => v.page === 1,
                  "TWAP fields first page",
                );
              }
              const keys = assertTwapRecords(tab, s.data),
                seen = [];
              const pages =
                tab === "active" ? 1 : Math.ceil(s.data.length / s.pageSize);
              for (let page = 1; page <= pages; page++) {
                s = await desktopTwapState(p);
                assert.equal(s.tab, tab);
                assert.equal(s.page, page);
                assert.deepEqual(
                  assertTwapRecords(tab, s.data),
                  keys,
                  "Stable record identities while checking all TWAP fields",
                );
                const records = await assertRendered(p, s);
                for (const c of s.columns) {
                  const candidates = p
                    .getByText(c.title, { exact: true })
                    .filter({ visible: true });
                  assert.ok(
                    (await projectReactAll(candidates, ownsTwapTable)).some(
                      Boolean,
                    ),
                    `Visible owned TWAP header ${c.key}`,
                  );
                }
                const fragments = (
                  await projectReactAll(
                    locator(p, "perps.position.table_body"),
                    projectTwapCellRows,
                  )
                ).flat();
                seen.push(
                  ...assertTwapFieldRows(tab, records, fragments, {
                    locale: twapRowLocale(s.tabs),
                    history: rawHistory,
                  }),
                );
                for (const row of fragments)
                  if (tab !== "fills")
                    statuses.add(
                      tab === "history" ? row.record.status.status : row.status,
                    );
                if (page < pages) {
                  await unlockWalletIfNeeded(p);
                  await (await pageButton(p, "next")).click();
                  await pollForm(
                    () => desktopTwapState(p),
                    (v) => v.page === page + 1,
                    "Next TWAP field page",
                  );
                }
              }
              assert.deepEqual(
                seen,
                keys,
                "Every actual TWAP field row checked exactly once",
              );
            }
            for (const status of Object.keys(twapStatusLabels.zh))
              if (!statuses.has(status)) missing.push(`缺少${status}状态样本`);
            if (missing.length)
              throw new SampleUnavailable(
                `已有记录全部字段已逐页检查；${missing.join("；")}；不创建/终止订单补样本`,
              );
            return `三入口全字段/固定列/金额/均价/手续费单位/净盈亏/时间/方向/主题颜色/六状态独立核对：${JSON.stringify(counts)}`;
          }),
      },
    ],
  },
  {
    id: "PERPS-TWAP-002",
    name: "分时历史分页与终态过滤",
    rows: [
      {
        ids: ["D11-206"],
        name: "历史逐页往返、跳页及终态不回当前",
        check: (p) =>
          withTwap(p, async () => {
            let s = await selectSubtab(p, "history");
            if (s.data.length <= s.pageSize)
              throw new SampleUnavailable(
                `需超过${s.pageSize}条已有历史，当前${s.data.length}；不下单制造样本`,
              );
            if (s.page !== 1) {
              await jump(p, 1);
              s = await pollForm(
                () => desktopTwapState(p),
                (v) => v.page === 1,
                "First TWAP history page",
              );
            }
            const baseline = s.data,
              keys = assertTwapRecords("history", baseline),
              pages = Math.ceil(keys.length / s.pageSize),
              seen = [];
            for (let page = 1; page <= pages; page++) {
              s = await desktopTwapState(p);
              assert.equal(s.page, page);
              assert.deepEqual(
                assertTwapRecords("history", s.data),
                keys,
                "Stable full history snapshot during paging",
              );
              seen.push(
                ...(await assertRendered(p, s)).map((r) =>
                  twapRecordKey("history", r),
                ),
              );
              const prev = await pageButton(p, "previous"),
                next = await pageButton(p, "next");
              assert.equal(await prev.isDisabled(), page === 1);
              assert.equal(await next.isDisabled(), page === pages);
              if (page < pages) {
                await unlockWalletIfNeeded(p);
                await next.click();
                await pollForm(
                  () => desktopTwapState(p),
                  (v) => v.page === page + 1,
                  "Next TWAP page",
                );
              }
            }
            assert.deepEqual(
              seen,
              keys,
              "Every history record once, exact sequence",
            );
            for (let page = pages - 1; page >= 1; page--) {
              await unlockWalletIfNeeded(p);
              await (await pageButton(p, "previous")).click();
              s = await pollForm(
                () => desktopTwapState(p),
                (v) => v.page === page,
                "Previous TWAP page",
              );
              await assertRendered(p, s);
            }
            await jump(p, pages);
            await pollForm(
              () => desktopTwapState(p),
              (v) => v.page === pages,
              "Jump last TWAP page",
            );
            for (const invalid of ["0", String(pages + 1), "-1", "abc", ""]) {
              await jump(p, invalid);
              s = await desktopTwapState(p);
              assert.equal(s.page, pages);
              assert.equal(
                await (await pageInput(p)).inputValue(),
                String(pages),
              );
              await assertRendered(p, s);
            }
            const terminals = new Set(
              baseline
                .filter((r) =>
                  ["finished", "terminated", "stopped", "error"].includes(
                    r.status.status,
                  ),
                )
                .map((r) => r.twapId),
            );
            for (const status of ["finished", "terminated", "stopped", "error"])
              if (!baseline.some((r) => r.status.status === status))
                throw new SampleUnavailable(
                  `分页已验证，仍缺${status}终态样本；整行不能记完整通过`,
                );
            const active = await selectSubtab(p, "active");
            await assertRendered(p, active);
            assert.ok(
              active.data.every((r) => !terminals.has(r.twapId)),
              "Four terminal statuses do not reappear in current",
            );
            return `历史${keys.length}条/${pages}页，往返/跳页/非法页码/四终态独立核对`;
          }),
      },
    ],
  },
];
export const twapListSuite = createDesktopRowSuite(twapListDefinitions);
