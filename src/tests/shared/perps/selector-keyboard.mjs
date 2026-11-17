// Manual search §§8–11. All Enter actions are scoped to an open asset picker.
// No order button, approval or trading submission is called.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { RESULTS_DIR, unlockWalletIfNeeded } from "../../helpers/index.mjs";
import { createStepTracker, safeStep } from "../../helpers/components.mjs";
import { PerpsPage } from "../../helpers/pages/perps.mjs";
import {
  locator,
  currentPair,
  openPairs,
  closePairs,
  pairPopover,
  pairRows,
  clickPairTab,
  searchPairs,
  favoriteSnapshot,
  restoreFavorites,
  setFavorite,
} from "../../helpers/perps-ui.mjs";
import { snapshotNonOrderForm, restoreNonOrderForm } from "./non-order-ui.mjs";
import {assertResultPopulation} from './runtime.mjs';

const dir = resolve(RESULTS_DIR, "perps-search-keyboard");
mkdirSync(dir, { recursive: true });
async function poll(read, predicate, message, timeout = 12000) {
  const end = Date.now() + timeout;
  let value;
  do {
    value = await read();
    if (predicate(value)) return value;
    await new Promise((r) => setTimeout(r, 100));
  } while (Date.now() < end);
  throw Error(`${message}: ${JSON.stringify(value)}`);
}
async function rows(page) {
  return pairRows(page).evaluateAll((es) =>
    es.map((e) => ({
      id: e.dataset.testid,
      name: e.innerText.split("\n")[0].trim(),
      // Actual product row uses a committed bg token for keyboard selection.
      // :hover CSS alone must not count as a selected keyboard target.
      selected: e.classList.contains("_bg-bgHover"),
    })),
  );
}
async function selected(page, expectedIndex) {
  const context = {
    tab: await primaryTab(page),
    query: await pairPopover(page).locator("input").inputValue(),
    expectedIndex,
  };
  const list = await poll(
      () => rows(page),
      (items) => items.filter((item) => item.selected).length === 1,
      `Exactly one selected row required after list update ${JSON.stringify(context)}`,
    ),
    highlighted = list.filter((e) => e.selected);
  assert.equal(
    highlighted.length,
    1,
    `Exactly one selected row required: ${JSON.stringify(list.slice(0, 5))}`,
  );
  if (expectedIndex !== undefined)
    assert.equal(
      list.findIndex(item=>item.selected),
      expectedIndex,
      `Selection follows displayed order and full row identity: ${JSON.stringify(highlighted[0])}`,
    );
  return highlighted[0];
}
async function primaryTab(page) {
  return locator(page, "perps.selector.primary_tabs").evaluate((el) =>
    [...el.children]
      .filter((e) => e.querySelector("span")?.classList.contains("_col-text"))
      .map((e) => e.innerText.trim()),
  );
}
async function expectPrimaryTab(page, expected) {
  const value = await poll(
    () => primaryTab(page),
    (tabs) => tabs.length === 1 && tabs[0] === expected,
    `Primary tab should settle at ${expected}`,
    4000,
  );
  assert.deepEqual(value, [expected]);
}
async function prepare(page, tab = "永续合约", query = "") {
  await openPairs(page);
  await searchPairs(page, "");
  await clickPairTab(page, tab);
  if (tab === "永续合约")
    await locator(page, "perps.selector.secondary_tabs")
      .getByText("全部", { exact: true })
      .click();
  await searchPairs(page, query);
  await pairPopover(page).locator("input").focus();
  await page.waitForTimeout(700);
}
async function pressInPicker(page, key) {
  assert.equal(
    await pairPopover(page).count(),
    1,
    "Refusing keyboard action outside asset picker",
  );
  await page.keyboard.press(key);
  await page.waitForTimeout(200);
}
async function chooseSelected(page, item) {
  await pressInPicker(page, "Enter");
  await pairPopover(page).waitFor({ state: "hidden" });
  const pair = item.name.includes("/") ? item.name : `${item.name}USDC`;
  await poll(
    () => currentPair(page),
    (value) => value === pair,
    "Enter chose highlighted asset",
  );
  return pair;
}
async function selectFirstWithKeyboard(page) {
  // Default selection has its own failing assertion in SEARCH-005. Establish
  // an explicit selection so that defect cannot block later shortcut checks.
  if (!(await rows(page)).some((item) => item.selected)) {
    await pressInPicker(page, "ArrowDown");
    console.log("  [fixture] ArrowDown explicitly selected the first result");
  }
  return selected(page, 0);
}
async function selectedRow(page, item) {
  const row = pairRows(page)
    .filter({ has: page.getByText(item.name, { exact: true }) })
    .and(page.getByTestId(item.id));
  assert.equal(await row.count(), 1, `Expected one row with full identity: ${JSON.stringify(item)}`);
  return row;
}
async function selectFixtureWithKeyboard(page, fixture) {
  const list = await rows(page);
  const matches = list.map((item,index) => ({ item,index })).filter(({item}) => item.id === fixture.id && item.name === fixture.name);
  assert.equal(matches.length, 1, `Exact keyboard fixture required: ${JSON.stringify(fixture)}`);
  await selectFirstWithKeyboard(page);
  for (let index = 0; index < matches[0].index; index++) await pressInPicker(page, 'ArrowDown');
  const item = await selected(page, matches[0].index);
  assert.equal(item.id, fixture.id);assert.equal(item.name, fixture.name);
  return item;
}
const favoriteKey = process.platform === "darwin" ? "Meta+s" : "Control+s";
const definitions = [
  [
    "005",
    "键盘导航、默认唯一选中与Enter选择",
    [
      [
        "各资产类型默认首项与上下导航",
        async (page) => {
          const detail = [];
          for (const tab of ["永续合约", "现货"]) {
            await prepare(page, tab);
            assert.ok(
              (await rows(page)).length >= 3,
              `${tab} requires three displayed samples`,
            );
            await selected(page, 0);
            for (const [key, index] of [
              ["ArrowDown", 1],
              ["ArrowDown", 2],
              ["ArrowUp", 1],
            ]) {
              await pressInPicker(page, key);
              await selected(page, index);
            }
            detail.push(await chooseSelected(page, await selected(page, 1)));
          }
          return detail.join(", ");
        },
      ],
      [
        "显式选中后上下导航与Enter独立验证",
        async (page) => {
          const detail = [];
          for (const tab of ["永续合约", "现货"]) {
            await prepare(page, tab);
            await selectFirstWithKeyboard(page);
            for (const [key, index] of [
              ["ArrowDown", 1],
              ["ArrowDown", 2],
              ["ArrowUp", 1],
            ]) {
              await pressInPicker(page, key);
              await selected(page, index);
            }
            detail.push(await chooseSelected(page, await selected(page, 1)));
          }
          return `显式键盘前置，不抵销默认高亮失败；Enter目标=${detail.join(", ")}`;
        },
      ],
      [
        "单条结果、空结果与Esc不选币",
        async (page) => {
          await prepare(page, "现货", "BTC/USDC");
          await poll(
            () => rows(page),
            (v) => v.length === 1,
            "Unique spot fixture",
          );
          for (const key of ["ArrowUp", "ArrowDown", "ArrowDown"]) {
            await pressInPicker(page, key);
            await selected(page, 0);
          }
          const before = await currentPair(page);
          await searchPairs(page, "XYZZZ999");
          await poll(
            () => rows(page),
            (v) => v.length === 0,
            "Empty search",
          );
          await pressInPicker(page, "Enter");
          assert.equal(await pairPopover(page).count(), 1);
          assert.equal(await currentPair(page), before);
          await pressInPicker(page, "Escape");
          await pairPopover(page).waitFor({ state: "hidden" });
          assert.equal(await currentPair(page), before);
          return "单条保持唯一选中；空结果Enter不选择，Esc关闭且交易对不变";
        },
      ],
      [
        "跨屏导航、鼠标接力与重新打开",
        async (page) => {
          await prepare(page);
          for (let i = 0; i < 25; i++) await pressInPicker(page, "ArrowDown");
          const item = await selected(page);
          const row = await selectedRow(page, item);
          const rect = await row.boundingBox(),
            outer = await pairPopover(page).boundingBox();
          assert.ok(
            rect &&
              outer &&
              rect.y >= outer.y &&
              rect.y + rect.height <= outer.y + outer.height,
            "Selected long-list row must be visible",
          );
          await prepare(page, "永续合约", "BT");
          assert.ok((await rows(page)).length >= 3);
          await pairRows(page).nth(1).hover();
          await selected(page, 1);
          await pairRows(page).nth(2).hover();
          await selected(page, 2);
          await closePairs(page);
          await prepare(page);
          await selected(page, 0);
          return "25次向下导航使高亮项可见；鼠标依展示顺序接力，重开回到首项";
        },
      ],
    ],
  ],
  [
    "006",
    "左右Tab循环、带词切换与输入边界",
    [
      [
        "带词及空词双向循环，搜索词保持",
        async (page) => {
          const failures = [],
            completed = [];
          for (const query of ["BTC", "比特", ""]) {
            for (const offset of new Set([
              0,
              Math.floor(query.length / 2),
              query.length,
            ])) {
              await prepare(page, "自选", query);
              const input = pairPopover(page).locator("input");
              await input.evaluate(
                (e, offset) => e.setSelectionRange(offset, offset),
                offset,
              );
              try {
                for (const [key, expected] of [
                  ["ArrowRight", "永续合约"],
                  ["ArrowRight", "现货"],
                  ["ArrowRight", "自选"],
                  ["ArrowLeft", "现货"],
                  ["ArrowLeft", "永续合约"],
                  ["ArrowLeft", "自选"],
                ]) {
                  await pressInPicker(page, key);
                  await expectPrimaryTab(page, expected);
                  assert.equal(await input.inputValue(), query);
                }
                completed.push({ query, offset });
              } catch (error) {
                failures.push({ query, offset, error: error.message });
              }
            }
          }
          writeFileSync(
            resolve(dir, "tab-query-matrix.json"),
            JSON.stringify({ completed, failures }, null, 2),
          );
          assert.equal(
            failures.length,
            0,
            JSON.stringify({ completed, failures }),
          );
          return "BTC/中文各3处光标与空词0处，共7个不同状态；正反向首尾循环，未丢搜索词";
        },
      ],
      [
        "超长、大小写、特殊字符及无结果按键保护",
        async (page) => {
          await prepare(page, "现货", "BTC");
          const upper = (await rows(page)).map((x) => x.name);
          await searchPairs(page, "btc");
          assert.deepEqual(
            (await rows(page)).map((x) => x.name),
            upper,
          );
          // The uncontrolled input retains the whole text. Only the matching
          // query is capped at 64; that boundary is verified in source isolation.
          await pairPopover(page).locator("input").fill("Z".repeat(200));
          assert.equal(
            (await pairPopover(page).locator("input").inputValue()).length,
            200,
          );
          for (const query of ["<", "'", "   ", "XYZZZ999"]) {
            await searchPairs(page, query);
            assert.equal(await pairPopover(page).count(), 1);
            if (!(await rows(page)).length) {
              assert.match(
                await pairPopover(page).innerText(),
                /未找到|暂无|No result/i,
              );
              const before = await currentPair(page);
              await pressInPicker(page, "Enter");
              await pressInPicker(page, favoriteKey);
              assert.equal(await currentPair(page), before);
              assert.equal(await pairPopover(page).count(), 1);
            }
          }
          return "现货大小写集合一致，200字符输入稳定；匹配词64字符边界另有真实源码断言；特殊字符可恢复，空结果不选币/收藏";
        },
      ],
    ],
  ],
  [
    "007",
    "快捷键收藏、连续取消定位与模式隔离",
    [
      [
        "自选顶部和底部连续取消后的高亮",
        async (page) => {
          const fixtures = ["BTC", "ETH", "BNB"].map((name) => ({
            name,
            id: `perp-token-selector-row-${name.toLowerCase()}`,
          }));
          for (const edge of ["top", "bottom"]) {
            await restoreFavorites(page, fixtures);
            await prepare(page, "自选");
            await selectFirstWithKeyboard(page);
            if (edge === "bottom")
              for (let i = 0; i < 2; i++)
                await pressInPicker(page, "ArrowDown");
            for (let remaining = 3; remaining > 1; remaining--) {
              const item = await selected(
                page,
                edge === "top" ? 0 : remaining - 1,
              );
              await pressInPicker(page, favoriteKey);
              await poll(
                () => rows(page),
                (v) =>
                  v.length === remaining - 1 &&
                  !v.some((x) => x.name === item.name),
                "Favorite removal",
              );
              await selected(page, edge === "top" ? 0 : remaining - 2);
            }
          }
          return "3条受控自选，顶部跟随下一项，底部跟随上一项；结束恢复原集合";
        },
      ],
      [
        "同名现货/永续隔离、双向快捷收藏与空列表保护",
        async (page) => {
          const fixtures = [
            { name: "BTC", id: "perp-token-selector-row-btc" },
            { name: "BTC/USDC", id: "perp-token-selector-row-btc" },
          ];
          await restoreFavorites(page, fixtures);
          await prepare(page, "自选", "BTC");
          const item = await selectFirstWithKeyboard(page);
          await pressInPicker(page, favoriteKey);
          await poll(
            () => rows(page),
            (v) => v.length === 1 && v[0].name !== item.name,
            "Only selected mode removed",
          );
          await selected(page, 0);
          await pressInPicker(page, favoriteKey);
          await poll(
            () => rows(page),
            (v) => v.length === 0,
            "Last matching favorite removed",
          );
          await pressInPicker(page, "Enter");
          await pressInPicker(page, favoriteKey);
          assert.equal(await pairPopover(page).count(), 1);
          assert.equal((await rows(page)).length, 0);
          await prepare(page, "永续合约", "BTC");
          await selectFixtureWithKeyboard(page, { id: 'perp-token-selector-row-btc', name: 'BTC' });
          await pressInPicker(page, favoriteKey);
          let favorites = await poll(() => favoriteSnapshot(page), items => items.some(item => item.name === "BTC"), "Shortcut favorite addition");
          assert.ok(favorites.some((x) => x.name === "BTC"));
          await prepare(page, "永续合约", "BTC");
          await selectFixtureWithKeyboard(page, { id: 'perp-token-selector-row-btc', name: 'BTC' });
          await pressInPicker(page, favoriteKey);
          favorites = await poll(() => favoriteSnapshot(page), items => !items.some(item => item.name === "BTC"), "Shortcut favorite removal");
          assert.ok(!favorites.some((x) => x.name === "BTC"));
          return "仅取消高亮模式；最后匹配项移除后按键无动作；同资产快捷键可添加再取消";
        },
      ],
      [
        "显式补齐选中后验证空结果保护和双向快捷收藏",
        async (page) => {
          const fixtures = [
            { name: "BTC", id: "perp-token-selector-row-btc" },
            { name: "BTC/USDC", id: "perp-token-selector-row-btc" },
          ];
          await restoreFavorites(page, fixtures);
          for (let remaining = 2; remaining > 0; remaining--) {
            await prepare(page, "自选", "BTC");
            const item = await selectFirstWithKeyboard(page);
            await pressInPicker(page, favoriteKey);
            await poll(
              () => rows(page),
              (items) =>
                items.length === remaining - 1 &&
                !items.some((row) => row.name === item.name),
              "Only highlighted favorite removed",
            );
          }
          await pressInPicker(page, "Enter");
          await pressInPicker(page, favoriteKey);
          assert.equal(await pairPopover(page).count(), 1);
          assert.equal((await rows(page)).length, 0);
          for (const enabled of [true, false]) {
            await prepare(page, "永续合约", "BTC");
            await selectFixtureWithKeyboard(page, { id: 'perp-token-selector-row-btc', name: 'BTC' });
            await pressInPicker(page, favoriteKey);
            const actual = await poll(() => favoriteSnapshot(page), items => items.some(item => item.name === 'BTC') === enabled, `Shortcut favorite BTC=${enabled}`);
            assert.equal(
              actual.some((item) => item.name === "BTC"),
              enabled,
            );
          }
          return "显式ArrowDown补齐前置，BTC永续/现货分别取消；空结果Enter/快捷键无动作；快捷键添加与取消均读回。自动高亮失败另行保留。";
        },
      ],
    ],
  ],
  [
    "008",
    "快捷键提示、弹层高度与复合输入保护",
    [
      [
        "三主Tab及多条/单条/空结果高度一致",
        async (page) => {
          const samples = [];
          // Favorites require the same population as the other tabs; keep the
          // original full identities for the outer finally to restore.
          await prepare(page,'永续合约','');
          const candidates=(await rows(page)).slice(0,3);
          assert.equal(candidates.length,3,'Three perpetual fixture assets required');
          for(const item of candidates) {
            await setFavorite(page,item,true);
          }
          for (const tab of ["自选", "永续合约", "现货"])
            for (const kind of ['multiple','single','empty']) {
              let query=kind==='empty'?'XYZZZ999':'';
              if(kind==='single') {
                await prepare(page,tab,'');
                const list=await rows(page);
                let unique;
                for(const candidate of list.filter(item=>list.filter(other=>other.name===item.name).length===1)) {
                  await searchPairs(page,candidate.name);
                  const matches=await rows(page);
                  if(matches.length===1 && matches[0].id===candidate.id) { unique=candidate;break; }
                }
                assert.ok(unique,`${tab} requires a query that actually returns one asset`);
                query=unique.name;
              }
              await prepare(page, tab, query);
              const resultCount=(await rows(page)).length;
              assertResultPopulation(kind,resultCount);
              const outer = await pairPopover(page).boundingBox(),
                input = await pairPopover(page).locator("input").boundingBox();
              samples.push({
                tab,
                query,
                kind,
                resultCount,
                height: outer.height,
                inputHeight: input.height,
              });
            }
          writeFileSync(
            resolve(dir, "height-samples.json"),
            JSON.stringify(samples, null, 2),
          );
          assert.ok(
            Math.max(...samples.map((x) => x.height)) -
              Math.min(...samples.map((x) => x.height)) <=
              1,
            `Popup heights: ${JSON.stringify(samples)}`,
          );
          assert.ok(
            Math.max(...samples.map((x) => x.inputHeight)) -
              Math.min(...samples.map((x) => x.inputHeight)) <=
              1,
          );
          return JSON.stringify(samples);
        },
      ],
      [
        "快捷提示、Shift编辑及10轮开关监听清理",
        async (page) => {
          await prepare(page, "永续合约", "BTC");
          const text = await pairPopover(page).innerText();
          for (const hint of [
            "↑↓",
            "←→",
            "Enter",
            "Esc",
            process.platform === "darwin" ? "⌘S" : "Ctrl",
          ])
            assert.ok(text.includes(hint), `Missing hint ${hint}`);
          const input = pairPopover(page).locator("input");
          await input.evaluate((e) => e.setSelectionRange(3, 3));
          const before = await primaryTab(page);
          await pressInPicker(page, "Shift+ArrowLeft");
          assert.deepEqual(await primaryTab(page), before);
          assert.equal(await input.inputValue(), "BTC");
          assert.equal(
            await input.evaluate((e) => e.selectionEnd - e.selectionStart),
            1,
          );
          for (let i = 0; i < 10; i++) {
            await closePairs(page);
            await prepare(page, "自选", "");
            await pressInPicker(page, "ArrowRight");
            await expectPrimaryTab(page, "永续合约");
            await pressInPicker(page, "Escape");
            await pairPopover(page).waitFor({ state: "hidden" });
          }
          return "macOS快捷提示齐全；Shift保留文本选择；10轮每次仅切换一个Tab并关闭";
        },
      ],
    ],
  ],
];
export function createSelectorKeyboardTests(prefix, namePrefix = "") {
  return definitions.map(([suffix, name, checks]) => ({
    id: `${prefix}-${suffix}`,
    name: `${namePrefix}Perps-搜索-${name}`,
    fn: async (page) => {
      const t = createStepTracker(`${prefix}-${suffix}`);
      let form, favorites;
      const ready = await safeStep(
        page,
        t,
        "前置：进入合约并记录表单、收藏完整身份与顺序",
        async () => {
          await unlockWalletIfNeeded(page);
          await closePairs(page);
          await new PerpsPage(page).navigate();
          form = await snapshotNonOrderForm(page);
          favorites = await favoriteSnapshot(page);
          await closePairs(page);
          writeFileSync(
            resolve(dir, `${prefix}-${suffix}-before.json`),
            JSON.stringify({ form, favorites }, null, 2),
          );
          return `原收藏${favorites.length}项，原交易对${form.pair}`;
        },
        dir,
      );
      if (!ready) return t.result();
      try {
        for (const [label, check] of checks)
          await safeStep(page, t, label, () => check(page), dir);
      } finally {
        await safeStep(
          page,
          t,
          "恢复原收藏、交易对及表单并核对",
          async () => {
            await closePairs(page);
            const after = await favoriteSnapshot(page);
            await closePairs(page);
            if (JSON.stringify(after) !== JSON.stringify(favorites))
              await restoreFavorites(page, favorites);
            assert.deepEqual(await favoriteSnapshot(page), favorites);
            await closePairs(page);
            await restoreNonOrderForm(page, form);
            return "原收藏完整身份/顺序与表单恢复，无交易提交";
          },
          dir,
        );
      }
      return t.result();
    },
  }));
}
