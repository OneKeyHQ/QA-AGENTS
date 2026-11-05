// D05 手动用例：docs/qa/testcases/cases/perps/2026-02-03_Perps-搜索功能.md
// Desktop picker interactions; Enter is only sent to a focused picker input.
// No order/signature/authorization action. The shared suite restores drafts,
// full favorites and financial snapshots, including on assertion failures.
import assert from "node:assert/strict";
import {
  locator,
  openPairs,
  closePairs,
  pairPopover,
  pairRows,
  clickPairTab,
  searchPairs,
  currentPair,
  restoreFavorites,
} from "../../helpers/perps-ui.mjs";
import {
  collectSearchRows,
  visibleSearchRows,
} from "./desktop-search-boundaries.mjs";
import { projectReactAll } from "./react-projection.mjs";
import { instrumentProjection } from "./instrument-readiness.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import { pollForm } from "./non-order-ui.mjs";
const same = (a, b) => a.id === b.id && a.name === b.name && a.coin === b.coin;
const key = (r) => `${r.coin}:${r.name}`;
async function prepare(page, tab = "永续合约", query = "") {
  await openPairs(page);
  await searchPairs(page, "");
  await clickPairTab(page, tab);
  if (tab === "永续合约")
    await locator(page, "perps.selector.secondary_tabs")
      .getByText("全部", { exact: true })
      .click();
  await searchPairs(page, query);
  await page.mouse.move(0, 0);
  await pairPopover(page).locator("input").focus();
  const rows = await collectSearchRows(page);
  await page.mouse.move(0, 0);
  return rows;
}
async function press(page, keyName) {
  const popup = pairPopover(page);
  assert.equal(await popup.count(), 1, "Picker must be open before keys");
  const input = popup.locator("input");
  assert.equal(await input.count(), 1);
  await input.focus();
  assert.equal(
    await input.evaluate((e) => e === e.ownerDocument.activeElement),
    true,
    "Enter/navigation target is the picker input",
  );
  await input.press(keyName);
}
async function selected(page, expected) {
  const chosen = await pollForm(
    () => visibleSearchRows(page),
    (rows) =>
      rows.filter((r) => r.selected).length === 1 &&
      same(
        rows.find((r) => r.selected),
        expected,
      ),
    "Unique highlighted canonical market",
  );
  assert.equal(chosen.filter((r) => r.selected).length, 1);
  const found = chosen.find((r) => r.selected);
  assert.ok(same(found, expected));
  const row = pairRows(page)
    .and(page.getByTestId(expected.id))
    .filter({ has: page.getByText(expected.name, { exact: true }) });
  assert.equal(await row.count(), 1);
  const rect = await row.boundingBox(),
    outer = await pairPopover(page).boundingBox();
  assert.ok(
    rect &&
      outer &&
      rect.height > 0 &&
      rect.y >= outer.y &&
      rect.y + rect.height <= outer.y + outer.height,
    "Highlighted row stays visible inside picker",
  );
  return row;
}
async function choose(page, item) {
  await selected(page, item);
  await press(page, "Enter");
  await pairPopover(page).waitFor({ state: "hidden" });
  const pair = item.spot ? item.name : `${item.name}USDC`;
  await pollForm(
    () => currentPair(page),
    (value) => value === pair,
    "Header follows actual keyboard-selected market",
  );
  const form = locator(page, "perps.form.root");
  const state = await pollForm(
    async () => (await projectReactAll(form, instrumentProjection))[0],
    (value) =>
      value?.instruments.length > 0 &&
      value.instruments.every(
        (r) => r.coin === item.coin && r.mode === (item.spot ? "spot" : "perp"),
      ),
    "Committed form has the same canonical coin and market mode",
  );
  assert.ok(state.instruments.every((r) => r.coin === item.coin));
  return `${item.coin}/${item.spot ? "spot" : "perp"}`;
}
async function controlledFavorites(page, count = 4) {
  const fixtures = ["BTC", "ETH", "SOL", "BNB"].slice(0, count).map((name) => ({
    id: `perp-token-selector-row-${name.toLowerCase()}`,
    name,
  }));
  await closePairs(page);
  await restoreFavorites(page, fixtures);
  const rows = await prepare(page, "自选");
  assert.equal(rows.length, count);
  assert.deepEqual(
    rows.map((r) => r.name),
    fixtures.map((r) => r.name),
  );
  return rows;
}
const row = (ids, name, check, extra = {}) => ({
  ids: ids.split(","),
  name,
  check,
  ...extra,
});
export const keyboardBoundaryDefinitions = [
  {
    id: "PERPS-DESKTOP-KEYBOARD-001",
    name: "Desktop 键盘默认项、单条与首尾边界",
    favorites: true,
    selectorPreferences: true,
    rows: [
      row(
        "D05-122",
        "自选/永续/现货及有结果永续子分类默认唯一首项，直接Enter",
        async (page) => {
          await controlledFavorites(page);
          const completed = [];
          for (const tab of ["自选", "永续合约", "现货"]) {
            const list = await prepare(page, tab);
            if (!list.length) throw new SampleUnavailable(`${tab}需要有结果`);
            await selected(page, list[0]);
            completed.push(await choose(page, list[0]));
          }
          await prepare(page);
          const labels = await locator(page, "perps.selector.secondary_tabs")
            .locator("span")
            .evaluateAll((es) => [
              ...new Set(
                es
                  .filter((e) => !e.querySelector("span"))
                  .map((e) => e.textContent.trim())
                  .filter(Boolean),
              ),
            ]);
          assert.ok(labels.includes("全部"));
          for (const label of labels) {
            await prepare(page);
            await locator(page, "perps.selector.secondary_tabs")
              .getByText(label, { exact: true })
              .click();
            await page.mouse.move(0, 0);
            const list = await collectSearchRows(page);
            if (!list.length) {
              completed.push(`${label}:empty`);
              continue;
            }
            await selected(page, list[0]);
            completed.push(`${label}:${await choose(page, list[0])}`);
          }
          return JSON.stringify(completed);
        },
      ),
      row(
        "D05-124",
        "唯一结果反复上下和三项自选首尾越界，Enter精确选择",
        async (page) => {
          await controlledFavorites(page, 3);
          let list = await prepare(page, "自选", "BTC");
          assert.equal(list.length, 1);
          for (const arrow of [
            "ArrowUp",
            "ArrowDown",
            "ArrowDown",
            "ArrowUp",
          ]) {
            await press(page, arrow);
            await selected(page, list[0]);
          }
          await choose(page, list[0]);
          list = await prepare(page, "自选");
          assert.equal(list.length, 3);
          await selected(page, list[0]);
          for (let i = 0; i < 3; i++) {
            await press(page, "ArrowUp");
            await selected(page, list[0]);
          }
          for (let i = 1; i < list.length; i++) {
            await press(page, "ArrowDown");
            await selected(page, list[i]);
          }
          for (let i = 0; i < 3; i++) {
            await press(page, "ArrowDown");
            await selected(page, list.at(-1));
          }
          return choose(page, list.at(-1));
        },
      ),
      row("D05-129", "非首项关闭、异分类异关键词重开均回首项", async (page) => {
        const list = await controlledFavorites(page);
        await press(page, "ArrowDown");
        await press(page, "ArrowDown");
        await selected(page, list[2]);
        await closePairs(page);
        const reopened = await prepare(page, "自选");
        await selected(page, reopened[0]);
        for (const [tab, query] of [
          ["永续合约", "BTC"],
          ["现货", "BTC"],
          ["自选", ""],
        ]) {
          const current = await prepare(page, tab, query);
          assert.ok(current.length);
          await selected(page, current[0]);
        }
        return "关闭后重开、分类及关键词变化均独立核对当前完整身份的唯一首项";
      }),
    ],
  },
  {
    id: "PERPS-DESKTOP-KEYBOARD-002",
    name: "Desktop 长列表逐项与鼠标键盘接力",
    favorites: true,
    selectorPreferences: true,
    rows: [
      row(
        "D05-125",
        "独立完整列表对账25次向下和25次向上，每次精确目标且可见",
        async (page) => {
          const list = await prepare(page);
          if (list.length < 30)
            throw new SampleUnavailable("至少30项永续结果用于跨屏导航");
          assert.equal(new Set(list.map(key)).size, list.length);
          await selected(page, list[0]);
          for (let i = 1; i <= 25; i++) {
            await press(page, "ArrowDown");
            await selected(page, list[i]);
          }
          for (let i = 24; i >= 0; i--) {
            await press(page, "ArrowUp");
            await selected(page, list[i]);
          }
          await press(page, "ArrowDown");
          await selected(page, list[1]);
          return choose(page, list[1]);
        },
      ),
      row("D05-126", "四项A/B/C/D鼠标B再C，向下必须D并Enter", async (page) => {
        const list = await controlledFavorites(page);
        await selected(page, list[0]);
        for (const i of [1, 2]) {
          const target = pairRows(page)
            .and(page.getByTestId(list[i].id))
            .filter({ has: page.getByText(list[i].name, { exact: true }) });
          await target.hover();
          await selected(page, list[i]);
        }
        await press(page, "ArrowDown");
        await selected(page, list[3]);
        return choose(page, list[3]);
      }),
    ],
  },
  {
    id: "PERPS-DESKTOP-KEYBOARD-003",
    name: "Desktop 取消自选后自动跟随目标",
    favorites: true,
    selectorPreferences: true,
    rows: [
      ...["top", "bottom"].map((edge) =>
        row(
          edge === "top" ? "D05-153" : "D05-154",
          edge === "top" ? "连续取消顶部自动B再C" : "连续取消底部自动B再A",
          async (page) => {
            const list = await controlledFavorites(page, 3);
            let remaining = [...list];
            if (edge === "bottom")
              for (let i = 1; i < list.length; i++)
                await press(page, "ArrowDown");
            const shortcut =
              process.platform === "darwin" ? "Meta+s" : "Control+s";
            const removed = [];
            while (remaining.length) {
              const index = edge === "top" ? 0 : remaining.length - 1;
              await selected(page, remaining[index]);
              removed.push(key(remaining[index]));
              await press(page, shortcut);
              remaining.splice(index, 1);
              await pollForm(
                () => visibleSearchRows(page),
                (rows) =>
                  rows.length === remaining.length &&
                  rows.every((r, i) => same(r, remaining[i])),
                "Only exact target disappears; survivor order unchanged",
              );
              if (remaining.length)
                await selected(
                  page,
                  edge === "top" ? remaining[0] : remaining.at(-1),
                );
            }
            assert.equal(
              (await visibleSearchRows(page)).filter((r) => r.selected).length,
              0,
            );
            await press(page, shortcut);
            assert.equal((await visibleSearchRows(page)).length, 0);
            return JSON.stringify(removed);
          },
        ),
      ),
    ],
  },
];
export const keyboardBoundarySuite = createDesktopRowSuite(
  keyboardBoundaryDefinitions,
);
