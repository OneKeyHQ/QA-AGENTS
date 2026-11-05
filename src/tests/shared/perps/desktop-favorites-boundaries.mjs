// D03 手动用例：docs/qa/testcases/cases/perps/2026-01-20_Perps-收藏功能测试.md
// D06 手动用例：docs/qa/testcases/cases/perps/2026-03-05_Perps-首页底部状态.md
// Desktop manual favorites chapters. All mutations use visible controls and
// the enclosing suite restores the original complete ordered favorite set.
import assert from "node:assert/strict";
import {
  locator,
  currentPair,
  openPairs,
  closePairs,
  pairPopover,
  pairRows,
  clickPairTab,
  favoriteSnapshot,
  clearFavorites,
  setFavorite,
  restorePair,
} from "../../helpers/perps-ui.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import {
  prepareSearch,
  visibleSearchRows,
  querySearch,
  collectSearchRows,
  revealSearchMarket,
} from "./desktop-search-boundaries.mjs";
import { pollForm } from "./non-order-ui.mjs";
import { projectReactAll } from "./react-projection.mjs";
import {
  assertFavoriteQuote,
  favoriteTopProjection,
} from "./favorite-quote-assertions.mjs";
import {
  favoriteListProjection,
  assertFavoriteListRow,
} from "./favorite-list-assertions.mjs";
import { reloadPerps } from "./runtime.mjs";
import { PerpsPage } from "../../helpers/pages/perps.mjs";
import { waitInstrumentBoundary } from "./instrument-readiness.mjs";
import { desktopTvEval } from "../../helpers/perps-chart-eval.mjs";
import { readNativeChartSnapshot } from "./desktop-native-boundaries.mjs";
import {
  projectFavoriteAppearance,
  assertFavoriteAppearance,
  projectTickerPrice,
  assertTickerPrice,
  assertFavoriteChart,
} from "./favorite-switch-evidence.mjs";
const names = [
  "BTCUSDC",
  "ETHUSDC",
  "BNBUSDC",
  "SOLUSDC",
  "HYPEUSDC",
  "XRPUSDC",
];
const top = (page) =>
  page
    .locator('[data-rbd-droppable-id="favorites-bar"]')
    .filter({ visible: true });
const topRows = (page) => top(page).locator("[data-rbd-draggable-id]");
const row = (ids, name, check, extra = {}) => ({
  ids: ids.split(","),
  name,
  check,
  ...extra,
});
async function topNames(page) {
  return topRows(page).evaluateAll((es) =>
    es.map((e) => e.innerText.split("\n")[0].trim()),
  );
}
async function expectTop(page, expected, timeout = 1000) {
  await pollForm(
    () => topNames(page),
    (v) => JSON.stringify(v) === JSON.stringify(expected),
    `Independent top favorite membership/order ${expected.join(",")}`,
    timeout,
  );
}
async function favoriteAppearance(page) {
  // A click leaves the pointer hovering over the selected item. Hover is an
  // allowed style, so observe only after moving to the separate form region.
  await locator(page, "perps.form.root").hover();
  return projectReactAll(topRows(page), projectFavoriteAppearance);
}
async function favoriteMarketEvidence(page, pair) {
  await pollForm(
    () => currentPair(page),
    (value) => value === pair,
    `Favorite header ${pair}`,
  );
  const boundary = await waitInstrumentBoundary(
    page,
    pair,
    locator(page, "perps.form.root"),
  );
  const coin = boundary.instruments[0].coin;
  const engine = (
    await locator(page, "perps.chart.engine").innerText()
  ).includes("TradingView")
    ? "tradingView"
    : "native";
  const evidence = await pollForm(
    async () => {
      try {
        const prices = await projectReactAll(
          locator(page, "perps.perp-token-selector"),
          projectTickerPrice,
        );
        assert.equal(prices.length, 1);
        assertTickerPrice(prices[0], coin);
        const chart =
          engine === "tradingView"
            ? {
                engine,
                visibleCount: await page
                  .locator("webview")
                  .filter({ visible: true })
                  .count(),
                ...(await desktopTvEval(
                  page,
                  "const chart=doc.defaultView.tradingViewApi?.activeChart();return {ready:!!chart,symbol:chart?.symbol()};",
                )),
              }
            : {
                engine,
                visibleCount: await locator(
                  page,
                  "perps.chart.native_canvas",
                ).count(),
                ...(await readNativeChartSnapshot(page)),
              };
        assertFavoriteChart(chart, coin);
        return { coin, price: prices[0].text[0], chart: engine };
      } catch (error) {
        return { error: error.message };
      }
    },
    (state) => !state.error,
    `Independent ticker price and chart for ${coin}`,
    30000,
  );
  return evidence;
}
async function recommendations(page) {
  await openPairs(page);
  await querySearch(page, "");
  await clickPairTab(page, "自选");
  await pairPopover(page)
    .getByText("添加到自选", { exact: true })
    .waitFor({ state: "visible" });
}
async function card(page, label) {
  const text = pairPopover(page).getByText(label, { exact: true });
  assert.equal(await text.count(), 1);
  const handle = await text.evaluateHandle((e) => {
    for (let a = e.parentElement; a; a = a.parentElement) {
      const r = a.getBoundingClientRect();
      if (
        a.children.length === 2 &&
        r.width > 120 &&
        r.height >= 35 &&
        r.height < 110 &&
        getComputedStyle(a).borderTopWidth === "1px" &&
        a.textContent.replace(/\s/g, "") === `${e.textContent}PERPS`
      )
        return a;
    }
    return null;
  });
  assert.equal(
    await handle.evaluate((e) => !!e),
    true,
    `Source-aligned recommendation card ${label}`,
  );
  return handle;
}
async function checked(page, label) {
  const c = await card(page, label);
  try {
    return await c.evaluate(
      (e) => !!e.querySelector('svg[data-sentry-component="SvgCheckLarge"]'),
    );
  } finally {
    await c.dispose();
  }
}
async function check(page, label, value) {
  if ((await checked(page, label)) !== value) {
    const c = await card(page, label);
    try {
      await c.click();
    } finally {
      await c.dispose();
    }
  }
  assert.equal(await checked(page, label), value);
}
async function empty(page) {
  await clearFavorites(page);
  await recommendations(page);
  assert.equal(await pairRows(page).count(), 0);
}
async function fullRec(page) {
  await recommendations(page);
  const positions = [];
  for (const label of names) {
    assert.equal(
      await checked(page, label),
      true,
      `Recommended ${label} initially checked`,
    );
    const c = await card(page, label);
    positions.push(await c.boundingBox());
    await c.dispose();
  }
  for (let i = 0; i < 6; i += 2) {
    assert.ok(
      Math.abs(positions[i].y - positions[i + 1].y) < 2,
      "Two cards on each row",
    );
    assert.ok(
      positions[i + 1].x > positions[i].x + positions[i].width,
      "Two separate grid columns",
    );
  }
  assert.equal(
    new Set(positions.map((p) => Math.round(p.y))).size,
    3,
    "Three recommendation rows",
  );
}
async function addSelected(page) {
  const button = pairPopover(page).getByText("添加到自选", { exact: true });
  await button.click();
  await button.waitFor({ state: "hidden" });
}
async function exactRow(page, coin, name) {
  const list = await visibleSearchRows(page);
  const indexes = list.flatMap((r, i) =>
    r.coin === coin && r.name === name ? [i] : [],
  );
  assert.equal(
    indexes.length,
    1,
    `Unique raw coin ${coin} with display name ${name}`,
  );
  const match = list[indexes[0]];
  const target = pairRows(page)
    .and(page.getByTestId(match.id))
    .filter({ has: page.getByText(name, { exact: true }) });
  assert.equal(await target.count(), 1, `Stable DOM identity ${coin}/${name}`);
  return target;
}
async function starState(row) {
  return row
    .locator('[data-testid="perp-already-favorite-icon-btn"] svg')
    .evaluate(
      (e) =>
        e.getAttribute("data-sentry-source-file")?.includes("/solid/") === true,
    );
}
async function star(page, coin, name) {
  const target = await exactRow(page, coin, name);
  const icon = target.locator('[data-testid="perp-already-favorite-icon-btn"]');
  assert.equal(await icon.count(), 1);
  return { target, icon };
}
async function reload(page) {
  await closePairs(page);
  await reloadPerps(page, {
    navigate: async () => new PerpsPage(page).navigate(),
    ready: async () =>
      locator(page, "perps.perp-token-selector").waitFor({ state: "visible" }),
  });
}
async function fixture(page) {
  await clearFavorites(page);
  for (const name of ["BTC", "ETH", "XRP"])
    await setFavorite(page, { name }, true);
  await closePairs(page);
  await expectTop(page, ["BTC", "ETH", "XRP"]);
}
const defs = [
  {
    id: "PERPS-DESKTOP-FAVORITES-001",
    name: "Desktop 收藏 §1 推荐列表完整断言",
    selectorPreferences: true,
    favorites: true,
    rows: [
      row("D03-24", "六项推荐、默认全选、两列网格与添加入口", async (page) => {
        await empty(page);
        await fullRec(page);
        return "六个指定代币均选中，三行两列与添加入口逐项核对";
      }),
      row(
        "D03-25",
        "取消 BTC/ETH 后只添加其余四个，列表及顶部对账",
        async (page) => {
          await empty(page);
          await check(page, "BTCUSDC", false);
          await check(page, "ETHUSDC", false);
          await addSelected(page);
          const expected = ["BNB", "SOL", "HYPE", "XRP"];
          const actual = await favoriteSnapshot(page);
          assert.deepEqual(
            actual.map((r) => r.name),
            expected,
          );
          assert.equal(
            await pairPopover(page)
              .getByText("添加到自选", { exact: true })
              .count(),
            0,
          );
          await closePairs(page);
          await expectTop(page, expected);
          return "只添加BNB/SOL/HYPE/XRP，实际自选与独立顶部各为4项";
        },
      ),
      row("D03-26", "全取消推荐后按钮禁用且卡片保留", async (page) => {
        await empty(page);
        for (const name of names) await check(page, name, false);
        const button = pairPopover(page).getByRole("button", {
          name: "添加到自选",
          exact: true,
        });
        assert.equal(await button.isEnabled(), false);
        for (const name of names)
          assert.equal(await checked(page, name), false);
        return "六项全取消，按钮不可操作，六卡片均仍可读";
      }),
      row("D03-27,D03-51", "最后一项取消后重新出现推荐且全选", async (page) => {
        await fixture(page);
        await favoriteSnapshot(page);
        assert.equal(
          await pairPopover(page)
            .getByText("添加到自选", { exact: true })
            .count(),
          0,
        );
        await clearFavorites(page);
        await fullRec(page);
        assert.equal(await pairRows(page).count(), 0);
        assert.equal(
          await pairPopover(page)
            .getByText("暂无收藏", { exact: true })
            .count(),
          0,
        );
        return "非空无推荐；清空后六项全选且无暂无收藏旧文案";
      }),
      row("D03-28", "部分取消后切分类再返回，勾选重置", async (page) => {
        await empty(page);
        await check(page, "BTCUSDC", false);
        await check(page, "ETHUSDC", false);
        await clickPairTab(page, "永续合约");
        await clickPairTab(page, "自选");
        await fullRec(page);
        assert.equal(await pairRows(page).count(), 0);
        return "切分类返回后六项全选，自选仍为0";
      }),
      row("D03-29", "推荐添加后真实刷新持久化", async (page) => {
        await empty(page);
        await addSelected(page);
        const before = await favoriteSnapshot(page);
        assert.deepEqual(
          before.map((r) => r.name),
          names.map((n) => n.replace(/USDC$/u, "")),
        );
        await reload(page);
        assert.deepEqual(await favoriteSnapshot(page), before);
        assert.equal(
          await pairPopover(page)
            .getByText("添加到自选", { exact: true })
            .count(),
          0,
        );
        return "推荐六项在真实页面刷新后完整身份与顺序保留";
      }),
    ],
  },
  {
    id: "PERPS-DESKTOP-FAVORITES-002",
    name: "Desktop 收藏 §2 星标、精确增减和快速点击",
    selectorPreferences: true,
    favorites: true,
    rows: [
      row(
        "D03-37,D03-80",
        "原生 BTC 星标左侧、空实状态、数量+1及顶部1秒同步",
        async (page) => {
          await clearFavorites(page);
          const baseline = await favoriteSnapshot(page);
          await prepareSearch(page, "永续合约", "BTC");
          let { target, icon } = await star(page, "BTC", "BTC");
          assert.equal(await starState(target), false);
          const starBox = await icon.boundingBox();
          const nameBox = await target
            .getByText("BTC", { exact: true })
            .boundingBox();
          assert.ok(
            starBox.x + starBox.width <= nameBox.x,
            "Star must precede token name",
          );
          const start = Date.now();
          await icon.click();
          await pollForm(
            () => starState(target),
            (value) => value === true,
            "Clicked BTC star becomes solid",
            500,
          );
          await expectTop(
            page,
            ["BTC"],
            Math.max(1, 1000 - (Date.now() - start)),
          );
          assert.ok(
            Date.now() - start <= 1000,
            "顶部从真实收藏点击起1秒内更新",
          );
          const after = await favoriteSnapshot(page);
          assert.equal(after.length, baseline.length + 1);
          assert.deepEqual(
            after.map((r) => r.name),
            ["BTC"],
          );
          return "唯一原生BTC，空星→实星，自选精确+1，独立顶部在1秒内出现";
        },
      ),
      row("D03-38", "XRP 实星取消、数量-1及顶部删除", async (page) => {
        await fixture(page);
        const before = await favoriteSnapshot(page);
        await prepareSearch(page, "永续合约", "XRP");
        const { target, icon } = await star(page, "XRP", "XRP");
        assert.equal(await starState(target), true);
        await icon.click();
        await pollForm(
          () => starState(target),
          (value) => value === false,
          "Clicked XRP star becomes outline",
          500,
        );
        await expectTop(page, ["BTC", "ETH"]);
        const after = await favoriteSnapshot(page);
        assert.equal(after.length, before.length - 1);
        assert.ok(!after.some((r) => r.name === "XRP"));
        return "XRP实星→空星，自选精确-1，独立顶部移除";
      }),
      row("D03-41", "连续3次真实点击逐次切换，最终仅一条", async (page) => {
        await clearFavorites(page);
        await prepareSearch(page, "永续合约", "BTC");
        const { target, icon } = await star(page, "BTC", "BTC");
        assert.equal(await starState(target), false);
        for (const expected of [true, false, true]) {
          await icon.click({ delay: 0 });
          await pollForm(
            () => starState(target),
            (value) => value === expected,
            "Every individual click toggles after React commits",
            500,
          );
        }
        assert.deepEqual(
          (await favoriteSnapshot(page)).map((r) => r.name),
          ["BTC"],
        );
        return "3次点击分别实/空/实，自选唯一BTC，无重复";
      }),
    ],
  },
];
async function displayMode(page) {
  const percent = page
    .getByText("%", { exact: true })
    .filter({ visible: true });
  assert.equal(await percent.count(), 1);
  return percent.evaluate((e) =>
    Number(getComputedStyle(e).fontWeight) >= 600 ? "%" : "$",
  );
}
async function selectDisplayMode(page, value) {
  await closePairs(page);
  if ((await displayMode(page)) !== value)
    await page
      .getByText("%", { exact: true })
      .filter({ visible: true })
      .click();
  assert.equal(await displayMode(page), value);
  for (const label of ["$", "%"])
    assert.equal(
      await page
        .getByText(label, { exact: true })
        .filter({ visible: true })
        .evaluate((e) => Number(getComputedStyle(e).fontWeight) >= 600),
      label === value,
    );
}
async function withDisplayMode(page, fn) {
  await fixture(page);
  const before = await displayMode(page);
  try {
    return await fn();
  } finally {
    try {
      await selectDisplayMode(page, before);
      assert.equal(await displayMode(page), before);
    } catch (e) {
      const { markRestoreFailure } = await import("./runtime.mjs");
      throw markRestoreFailure(null, e, "恢复顶部价格显示模式");
    }
  }
}
async function topValues(page, mode, expected = ["BTC", "ETH", "XRP"]) {
  const rows = await projectReactAll(topRows(page), favoriteTopProjection);
  assert.equal(rows.length, expected.length);
  assert.deepEqual(
    rows.map((r) => r.name),
    expected,
  );
  for (const r of rows) assertFavoriteQuote(r, mode);
  return rows;
}
async function dragFavorite(page, from, to) {
  await closePairs(page);
  const before = await topNames(page),
    source = topRows(page).nth(from),
    target = topRows(page).nth(to);
  await source.scrollIntoViewIfNeeded();
  const a = await source.boundingBox(),
    b = await target.boundingBox();
  try {
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 30 });
  } finally {
    await page.mouse.up();
  }
  const expected = [...before],
    item = expected.splice(from, 1)[0];
  expected.splice(to, 0, item);
  await expectTop(page, expected, 3000);
  return expected;
}
defs.push(
  {
    id: "PERPS-DESKTOP-FAVORITES-003",
    name: "Desktop 收藏 §3 列表展示与取消",
    selectorPreferences: true,
    favorites: true,
    rows: [
      row("D03-49", "完整顺序、价格、涨跌幅和实心星", async (page) => {
        await fixture(page);
        const values = await favoriteSnapshot(page);
        assert.deepEqual(
          values.map((r) => r.name),
          ["BTC", "ETH", "XRP"],
        );
        const projected = await projectReactAll(
          pairRows(page),
          favoriteListProjection,
        );
        assert.equal(projected.length, 3);
        for (const [i, r] of (await pairRows(page).all()).entries()) {
          assert.equal(await starState(r), true);
          assertFavoriteListRow(projected[i], ["BTC", "ETH", "XRP"][i]);
        }
        return "自选顺序BTC/ETH/XRP；价格列与涨跌幅列逐项对账原始行情，星标位于名称左侧且实心";
      }),
      row("D03-50", "从自选取消后分类列表和顶部独立对账", async (page) => {
        await fixture(page);
        await favoriteSnapshot(page);
        const target = pairRows(page).filter({
          has: page.getByText("XRP", { exact: true }),
        });
        assert.equal(await target.count(), 1);
        await target
          .locator('[data-testid="perp-already-favorite-icon-btn"]')
          .click();
        assert.deepEqual(
          (await favoriteSnapshot(page)).map((r) => r.name),
          ["BTC", "ETH"],
        );
        await expectTop(page, ["BTC", "ETH"]);
        await prepareSearch(page, "永续合约", "");
        const category = (await collectSearchRows(page)).filter(
          (r) => r.coin === "XRP",
        );
        assert.equal(category.length, 1);
        assert.equal(
          category[0].favorite,
          false,
          "无关键词分类列表独立核对空星",
        );
        await querySearch(page, "XRP");
        const { target: row } = await star(page, "XRP", "XRP");
        assert.equal(await starState(row), false);
        return "自选精确减1，顶部移除XRP，分类搜索空星";
      }),
      row("D03-53", "收藏行跳转目标交易页并检查独立头部实星", async (page) => {
        await fixture(page);
        await favoriteSnapshot(page);
        await pairRows(page)
          .filter({ has: page.getByText("ETH", { exact: true }) })
          .click();
        assert.equal(await currentPair(page), "ETHUSDC");
        await closePairs(page);
        const head = locator(page, "perps.perp-already-favorite-icon-btn");
        assert.equal(
          await head.count(),
          1,
          "Only the independent ticker header star is visible after closing the selector",
        );
        assert.equal(
          await head
            .locator("svg")
            .evaluate((e) =>
              e.getAttribute("data-sentry-source-file")?.includes("/solid/"),
            ),
          true,
        );
        return "点击ETH自选行切为ETHUSDC，关闭选择器后独立页头实星";
      }),
    ],
  },
  {
    id: "PERPS-DESKTOP-FAVORITES-004",
    name: "Desktop 收藏 §4 显示模式、顶部跳转与拖动",
    selectorPreferences: true,
    favorites: true,
    rows: [
      row(
        "D03-64,D03-65,D06-21,D06-22",
        "价格/百分比逐项数值与互斥选中样式",
        (page) =>
          withDisplayMode(page, async () => {
            await selectDisplayMode(page, "%");
            for (const mode of ["$", "%"]) {
              await selectDisplayMode(page, mode);
              await pollForm(
                () => topValues(page, mode),
                (v) => v.length === 3,
                "Top favorite numeric values",
              );
            }
            return "BTC/ETH/XRP每项价格与原始标记价按5位有效数截断对账，百分比与原始24h涨跌对账，颜色按方向，选项互斥";
          }),
      ),
      row("D03-69", "百分比模式真实刷新保留", (page) =>
        withDisplayMode(page, async () => {
          await selectDisplayMode(page, "%");
          await reload(page);
          assert.equal(await displayMode(page), "%");
          await topValues(page, "%");
          return "真实刷新后%选中且三项均百分比";
        }),
      ),
      row("D03-71", "快速交替五次每次立即切换", (page) =>
        withDisplayMode(page, async () => {
          await selectDisplayMode(page, "$");
          for (const mode of ["%", "$", "%", "$", "%"]) {
            await selectDisplayMode(page, mode);
            await topValues(page, mode);
          }
          return "初始$后真实交替点击五次，每次断言选中态和三项数值格式，最终%";
        }),
      ),
      row("D06-20,D06-25", "两次实际拖动后列表及刷新顺序一致", async (page) => {
        await fixture(page);
        await dragFavorite(page, 0, 2);
        const expected = await dragFavorite(page, 0, 1);
        await topValues(page, await displayMode(page), expected);
        await reload(page);
        await expectTop(page, expected);
        await topValues(page, await displayMode(page), expected);
        assert.deepEqual(
          (await favoriteSnapshot(page)).map((r) => r.name),
          expected,
        );
        return `真实指针拖动两次，刷新后顶部与列表顺序=${expected.join(",")}，前后图标/名称/数值与原始行情逐项核对`;
      }),
      row(
        "D03-66",
        "顶部BTC→ETH切换，价格与K线同步且无选中高亮",
        async (page) => {
          await fixture(page);
          await restorePair(page, "BTCUSDC");
          await favoriteMarketEvidence(page, "BTCUSDC");
          const before = await topNames(page);
          const appearance = await favoriteAppearance(page);
          await topRows(page)
            .filter({ has: page.getByText("ETH", { exact: true }) })
            .click();
          const evidence = await favoriteMarketEvidence(page, "ETHUSDC");
          assert.deepEqual(await topNames(page), before);
          const after = await pollForm(
            async () => {
              const states = await favoriteAppearance(page);
              try {
                assertFavoriteAppearance(appearance, states);
                return { states };
              } catch (error) {
                return { error: error.message };
              }
            },
            (state) => !state.error,
            "No persistent selected favorite highlight",
          );
          assertFavoriteAppearance(appearance, after.states);
          return `顶部BTC→ETH；独立页头/表单/价格=${evidence.price}/图表=${evidence.chart}:ETH一致，完整顺序与非hover样式保持`;
        },
      ),
    ],
  },
  {
    id: "PERPS-DESKTOP-FAVORITES-005",
    name: "Desktop 收藏 §5 分类与顶部同步",
    selectorPreferences: true,
    favorites: true,
    rows: [
      row("D03-79", "推荐收藏后无词分类与有词搜索各自实星", async (page) => {
        await empty(page);
        await addSelected(page);
        await prepareSearch(page, "永续合约", "");
        const category = await collectSearchRows(page);
        for (const name of ["BTC", "ETH", "BNB", "SOL", "HYPE", "XRP"]) {
          const rows = category.filter((r) => r.coin === name);
          assert.equal(rows.length, 1);
          assert.equal(
            rows[0].favorite,
            true,
            `Unfiltered category ${name} star`,
          );
          await querySearch(page, name);
          const { target } = await star(page, name, name);
          assert.equal(await starState(target), true);
        }
        return "六项推荐先在无词分类长列表独立读回实星，再分别搜索独立核对";
      }),
      row("D03-81", "自选取消后分类、搜索与顶部1秒同步", async (page) => {
        await fixture(page);
        await favoriteSnapshot(page);
        const row = pairRows(page).filter({
          has: page.getByText("XRP", { exact: true }),
        });
        const start = Date.now();
        await row
          .locator('[data-testid="perp-already-favorite-icon-btn"]')
          .click();
        await expectTop(
          page,
          ["BTC", "ETH"],
          Math.max(1, 1000 - (Date.now() - start)),
        );
        assert.ok(Date.now() - start <= 1000, "从自选移除点击起1秒内顶部更新");
        await prepareSearch(page, "永续合约", "");
        const category = (await collectSearchRows(page)).filter(
          (r) => r.coin === "XRP",
        );
        assert.equal(category.length, 1);
        assert.equal(category[0].favorite, false);
        await querySearch(page, "XRP");
        assert.equal(
          await starState((await star(page, "XRP", "XRP")).target),
          false,
        );
        return "从自选取消XRP，顶部1秒内移除；无词分类和搜索分别读回空星";
      }),
    ],
  },
  {
    id: "PERPS-DESKTOP-FAVORITES-007",
    name: "Desktop 收藏 §7 空收藏边界",
    selectorPreferences: true,
    favorites: true,
    rows: [
      row("D03-103", "清空隐藏顶部整体，添加后重新出现", async (page) => {
        await clearFavorites(page);
        await closePairs(page);
        assert.equal(await top(page).count(), 0);
        for (const text of ["$", "%"])
          assert.equal(
            await page
              .getByText(text, { exact: true })
              .filter({ visible: true })
              .count(),
            0,
          );
        await setFavorite(page, { name: "BTC" }, true);
        await closePairs(page);
        await expectTop(page, ["BTC"]);
        for (const text of ["$", "%"])
          assert.equal(
            await page
              .getByText(text, { exact: true })
              .filter({ visible: true })
              .count(),
            1,
          );
        return "空收藏时列表和$/%整体均无；添加BTC后整体出现";
      }),
    ],
  },
  {
    id: "PERPS-DESKTOP-FAVORITES-008",
    name: "Desktop 收藏 §8 现货隔离与持久化",
    selectorPreferences: true,
    favorites: true,
    rows: [
      row(
        "D03-116,D03-117,D03-118",
        "永续现货独立收藏、混合顺序及刷新持久化",
        async (page) => {
          await clearFavorites(page);
          await setFavorite(page, { name: "BTC" }, true);
          await setFavorite(page, { name: "BTC/USDC" }, true);
          await setFavorite(page, { name: "HYPE/USDC" }, true);
          const expected = ["BTC", "BTC/USDC", "HYPE/USDC"];
          assert.deepEqual(
            (await favoriteSnapshot(page)).map((r) => r.name),
            expected,
          );
          const rows = await visibleSearchRows(page);
          assert.equal(rows.filter((r) => r.spot).length, 2);
          assert.equal(rows.filter((r) => !r.spot).length, 1);
          for (const r of rows.filter((r) => r.spot))
            assert.ok(r.text.split("\n").includes("现货"));
          await closePairs(page);
          await expectTop(page, expected);
          await reload(page);
          assert.deepEqual(
            (await favoriteSnapshot(page)).map((r) => r.name),
            expected,
          );
          return "BTC永续保留，两个现货显示完整交易对与徽标，列表与顶部3项，真实刷新保留";
        },
      ),
      row("D03-119,D03-121", "UBTC映射与取消只影响所选现货", async (page) => {
        await clearFavorites(page);
        await setFavorite(page, { name: "BTC" }, true);
        await setFavorite(page, { name: "BTC/USDC" }, true);
        assert.deepEqual(
          (await favoriteSnapshot(page)).map((r) => r.name),
          ["BTC", "BTC/USDC"],
        );
        await prepareSearch(page, "现货", "UBTC");
        const rows = await visibleSearchRows(page),
          item = rows.find((r) => r.name === "BTC/USDC");
        assert.ok(item && item.base === "UBTC");
        const target = await exactRow(page, item.coin, item.name);
        assert.equal(await starState(target), true);
        await target
          .locator('[data-testid="perp-already-favorite-icon-btn"]')
          .click();
        await pollForm(
          () => starState(target),
          (value) => value === false,
          "Clicked spot star becomes outline",
          500,
        );
        assert.deepEqual(
          (await favoriteSnapshot(page)).map((r) => r.name),
          ["BTC"],
        );
        await closePairs(page);
        await expectTop(page, ["BTC"]);
        return "UBTC现货显示BTC/USDC；取消后空星，永续BTC保留，顶部独立对账";
      }),
    ],
  },
);

defs.push({
  id: "PERPS-DESKTOP-FAVORITES-009",
  name: "Desktop 收藏增删与混合搜索联动",
  selectorPreferences: true,
  favorites: true,
  rows: [
    row(
      "D03-39",
      "USDC混合搜索分别添加和取消，独立自选/顶部对账",
      async (page) => {
        await clearFavorites(page);
        await prepareSearch(page, "现货", "USDC");
        const results = await collectSearchRows(page);
        const [selected, unselected] = results.filter(
          (r) => r.spot && !r.favorite,
        );
        if (!selected || !unselected)
          throw new SampleUnavailable(
            "USDC搜索不足两个独立现货交易对，无法构造部分已收藏的手动前置",
          );
        await revealSearchMarket(page, selected);
        await (await star(page, selected.coin, selected.name)).icon.click();
        await pollForm(
          () =>
            starState(
              pairRows(page)
                .and(page.getByTestId(selected.id))
                .filter({
                  has: page.getByText(selected.name, { exact: true }),
                }),
            ),
          (value) => value === true,
          "建立USDC混合星标前置",
        );
        await expectTop(page, [selected.name]);
        assert.deepEqual(
          (await favoriteSnapshot(page)).map((r) => r.name),
          [selected.name],
        );
        const original = [selected.name];
        for (const [item, want] of [
          [unselected, true],
          [selected, false],
        ]) {
          await prepareSearch(page, "现货", "USDC");
          await revealSearchMarket(page, item);
          const { target, icon } = await star(page, item.coin, item.name);
          assert.equal(await starState(target), !want);
          await icon.click();
          await pollForm(
            () => starState(target),
            (value) => value === want,
            "混合搜索实际星标切换",
            500,
          );
          const expected = [...original, unselected.name].filter(
            (name) => want || name !== selected.name,
          );
          await expectTop(page, expected);
          assert.deepEqual(
            (await favoriteSnapshot(page)).map((r) => r.name),
            expected,
          );
        }
        return "USDC现货搜索通过UI构造混合星标，未收藏转实心、已收藏转空心；两次均独立核对自选及顶部完整集合";
      },
    ),
    row("D03-67", "新增自选1秒内进入顶部且沿用当前显示模式", async (page) => {
      await fixture(page);
      const mode = await displayMode(page);
      await prepareSearch(page, "永续合约", "SOL");
      const { target, icon } = await star(page, "SOL", "SOL");
      assert.equal(await starState(target), false);
      const start = Date.now();
      await icon.click();
      await expectTop(
        page,
        ["BTC", "ETH", "XRP", "SOL"],
        Math.max(1, 1000 - (Date.now() - start)),
      );
      assert.ok(
        Date.now() - start <= 1000,
        "从实际添加点击到顶部完整集合读回不超过1秒",
      );
      await closePairs(page);
      assert.equal(await displayMode(page), mode);
      await topValues(page, mode, ["BTC", "ETH", "XRP", "SOL"]);
      assert.deepEqual(
        (await favoriteSnapshot(page)).map((r) => r.name),
        ["BTC", "ETH", "XRP", "SOL"],
      );
      return "顶部精确+1且1秒内出现；四个代币按原$/%模式逐一对账原始行情";
    }),
    row(
      "D03-68",
      "从自选取消后顶部1秒内精确减1，其余相对顺序不变",
      async (page) => {
        await fixture(page);
        const before = await topNames(page);
        await favoriteSnapshot(page);
        const target = pairRows(page).filter({
          has: page.getByText("ETH", { exact: true }),
        });
        assert.equal(await target.count(), 1);
        const start = Date.now();
        await target
          .locator('[data-testid="perp-already-favorite-icon-btn"]')
          .click();
        const expected = before.filter((name) => name !== "ETH");
        await expectTop(
          page,
          expected,
          Math.max(1, 1000 - (Date.now() - start)),
        );
        assert.ok(
          Date.now() - start <= 1000,
          "从实际取消点击到顶部完整集合读回不超过1秒",
        );
        assert.equal((await topNames(page)).length, before.length - 1);
        assert.deepEqual(
          (await favoriteSnapshot(page)).map((r) => r.name),
          expected,
        );
        return "ETH移除后独立顶部/自选精确减1，BTC/XRP相对顺序保持，1秒期限从点击开始计时";
      },
    ),
  ],
});

export const favoritesBoundaryDefinitions = defs;
export const favoritesBoundarySuite = createDesktopRowSuite(defs);

// Reuse actual pointer drag and independent top entry reads in footer flows.
export { dragFavorite, topNames as favoriteTopNames };
