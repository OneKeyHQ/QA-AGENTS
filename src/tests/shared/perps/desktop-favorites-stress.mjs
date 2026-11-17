// D03 手动用例：docs/qa/testcases/cases/perps/2026-01-20_Perps-收藏功能测试.md
// Real list fixtures are built only by clicking stars. No membership atoms or
// local storage are injected. A complete small original set is saved/restored
// by the enclosing row suite, including on a performance assertion failure.
import assert from "node:assert/strict";
import {
  locator,
  closePairs,
  pairRows,
  clearFavorites,
  currentPair,
  restorePair,
} from "../../helpers/perps-ui.mjs";
import {
  prepareSearch,
  querySearch,
  visibleSearchRows,
  collectSearchRows,
  readServerConfig,
  revealSearchMarket,
} from "./desktop-search-boundaries.mjs";
import {
  spotMarketOracle,
  eligibleSpotMarkets,
  perpMarketOracle,
} from "./public-market-oracle.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import { pollForm } from "./non-order-ui.mjs";
import {
  footerMode,
  setFooterMode,
  footerRows,
} from "./desktop-footer-boundaries.mjs";
import { markRestoreFailure, reloadPerps } from "./runtime.mjs";
import { activeToasts } from "./validation-toasts.mjs";
import { PerpsPage } from "../../helpers/pages/perps.mjs";
const topRows = (p) =>
  p
    .locator('[data-rbd-droppable-id="favorites-bar"] [data-rbd-draggable-id]')
    .filter({ visible: true });
const topNames = (p) =>
  topRows(p).evaluateAll((es) => es.map((e) => e.innerText.split("\n")[0]));
const names = (x) => x.map((r) => r.name);
async function candidates(p, spot) {
  if (spot) {
    const rows = eligibleSpotMarkets(await spotMarketOracle());
    if (rows.length < 101)
      throw new SampleUnavailable(
        `只读现货元数据当前仅${rows.length}个市场达到1000 USDC成交额阈值，UI无法收藏第101个；需至少101个可见现货市场的行情夹具`,
      );
    // Derive exact display/quote identities from a full unfiltered UI scan.
    await prepareSearch(p, "现货", "");
    return (await collectSearchRows(p)).slice(0, 101);
  }
  const config = await readServerConfig(p),
    rows = (await perpMarketOracle(config.hip3Dexs ?? []))
      .filter((r) => !r.name.includes(":"))
      .slice(0, 101);
  assert.equal(
    rows.length,
    101,
    "At least 101 eligible native perpetual markets",
  );
  return rows.map((r) => ({ coin: r.name, name: r.name }));
}
async function setStar(p, item, want) {
  await querySearch(p, item.name);
  const row = await revealSearchMarket(p, item);
  assert.equal(await row.count(), 1, "Exact revealed favorite fixture");
  const star = row.locator('[data-testid="perp-already-favorite-icon-btn"]');
  const selected = () =>
    star
      .locator("svg")
      .evaluate(
        (e) =>
          e.getAttribute("data-sentry-source-file")?.includes("/solid/") ===
          true,
      );
  const before = await selected(),
    start = Date.now();
  if (before !== want) await star.click();
  await pollForm(selected, (v) => v === want, "Individual star state", 500);
  return Date.now() - start;
}
async function scrollPerformance(p, selector, horizontal = false) {
  return p.locator(selector).evaluate(async (root, horizontal) => {
    let target = root;
    if (!horizontal) {
      const first = root.querySelector(
        '[data-testid^="perp-token-selector-row-"]',
      );
      for (let e = first?.parentElement; e; e = e.parentElement) {
        if (
          /auto|scroll/.test(getComputedStyle(e).overflowY) &&
          e.scrollHeight > e.clientHeight + 2
        ) {
          target = e;
          break;
        }
      }
    } else
      for (let e = root; e; e = e.parentElement) {
        if (
          e.scrollWidth > e.clientWidth + 2 &&
          /auto|scroll/.test(getComputedStyle(e).overflowX)
        ) {
          target = e;
          break;
        }
      }
    const max = horizontal
      ? target.scrollWidth - target.clientWidth
      : target.scrollHeight - target.clientHeight;
    if (!(max > 0)) throw Error("Real overflowing scroll container required");
    const before = horizontal ? target.scrollLeft : target.scrollTop;
    let frames = 0,
      blankFrames = 0;
    const started = performance.now();
    await new Promise((resolve) => {
      function frame(now) {
        const elapsed = now - started,
          ratio = Math.min(1, elapsed / 1200);
        if (horizontal) target.scrollLeft = max * ratio;
        else target.scrollTop = max * ratio;
        frames++;
        if (!horizontal) {
          const r = target.getBoundingClientRect();
          const visible = [
            ...target.querySelectorAll(
              '[data-testid^="perp-token-selector-row-"]',
            ),
          ].some((e) => {
            const b = e.getBoundingClientRect();
            return b.height > 0 && b.bottom > r.top && b.top < r.bottom;
          });
          if (!visible) blankFrames++;
        }
        if (ratio === 1) resolve();
        else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    const elapsed = performance.now() - started,
      atEnd = horizontal ? target.scrollLeft : target.scrollTop;
    if (horizontal) target.scrollLeft = before;
    else target.scrollTop = before;
    return {
      frames,
      elapsed,
      fps: (frames * 1000) / elapsed,
      blankFrames,
      atEnd,
      max,
    };
  }, horizontal);
}
async function bulk(p, spot) {
  const items = await candidates(p, spot);
  assert.equal(items.length, 101);
  await clearFavorites(p);
  await prepareSearch(p, spot ? "现货" : "永续合约", "");
  let addResponse;
  for (let i = 0; i < items.length; i++) {
    const elapsed = await setStar(p, items[i], true);
    if (i === 100) {
      addResponse = elapsed;
      assert.ok(elapsed <= 500, `101st star addition ${elapsed}ms`);
      const notices = await activeToasts(p).allTextContents();
      assert.ok(
        !notices.some((t) => /收藏.*上限|上限.*收藏|favorite.*limit/iu.test(t)),
        "No favorite limit notice",
      );
    }
    if (i === 99 || i === 100) {
      await pollForm(
        () => topNames(p),
        (v) => v.length === i + 1,
        "Top count after 100th/101st real click",
      );
      console.log(
        `    Real favorite fixture ${spot ? "spot" : "perp"}: ${i + 1}`,
      );
    }
  }
  // Clearing a 101st-token search and clicking a tab starts two asynchronous
  // list replacements. Wait for the selected tab and debounced query to settle
  // before capturing the virtual-list scroll root.
  await prepareSearch(p, "自选", "");
  const actual = await collectSearchRows(p);
  assert.deepEqual(names(actual), names(items));
  assert.ok(actual.every((r) => r.favorite));
  const perf = await scrollPerformance(
    p,
    '[data-testid="TMPopover-ScrollView"]:visible',
  );
  assert.ok(
    perf.fps >= 30,
    `Vertical list measured ${perf.fps.toFixed(1)} FPS`,
  );
  assert.equal(
    perf.blankFrames,
    0,
    "No blank visible-list frames while scrolling",
  );
  assert.ok(Math.abs(perf.atEnd - perf.max) < 2);
  await closePairs(p);
  assert.deepEqual(await topNames(p), names(items));
  const horizontal = await scrollPerformance(
    p,
    '[data-rbd-droppable-id="favorites-bar"]',
    true,
  );
  assert.ok(
    horizontal.fps >= 30,
    `Top bar measured ${horizontal.fps.toFixed(1)} FPS`,
  );
  assert.ok(Math.abs(horizontal.atEnd - horizontal.max) < 2);
  if (spot) {
    const before = await footerMode(p);
    try {
      await setFooterMode(p, "自选");
      await restorePair(p, "HYPE/USDC");
      const expectedCoins = items.map((r) => r.coin).sort();
      assert.equal(
        new Set(expectedCoins).size,
        101,
        "101 distinct canonical spot identities",
      );
      const footer = await pollForm(
        () => footerRows(p),
        (rows) =>
          rows.length > 0 &&
          rows.every((r) => r.mode === "spot") &&
          JSON.stringify([...new Set(rows.map((r) => r.coin))].sort()) ===
            JSON.stringify(expectedCoins),
        "Exact 101 canonical spot favorites in independent footer, no stale or extra identities",
      );
      assert.deepEqual(
        [...new Set(footer.map((r) => r.coin))].sort(),
        expectedCoins,
      );
      assert.ok(
        footer.every((r) => r.mode === "spot"),
        "No perpetual identity in spot ticker",
      );
    } finally {
      try {
        await setFooterMode(p, before);
      } catch (e) {
        throw markRestoreFailure(null, e, "恢复101现货轮播设置");
      }
    }
  }
  await prepareSearch(p, spot ? "现货" : "永续合约", items.at(-1).name);
  const response = await setStar(p, items.at(-1), false);
  assert.ok(response <= 500, `Star cancellation ${response}ms`);
  await pollForm(
    () => topNames(p),
    (v) => JSON.stringify(v) === JSON.stringify(names(items.slice(0, -1))),
    "Top after 101st cancellation",
    500,
  );
  await closePairs(p);
  await reloadPerps(p, {
    navigate: async () => new PerpsPage(p).navigate(),
    ready: async () =>
      locator(p, "perps.perp-token-selector").waitFor({ state: "visible" }),
  });
  await prepareSearch(p, "自选", "");
  assert.deepEqual(
    names(await collectSearchRows(p)),
    names(items.slice(0, -1)),
  );
  return `真实点击收藏101项，列表全量/顶部独立对账，纵向${perf.fps.toFixed(1)}FPS、横向${horizontal.fps.toFixed(1)}FPS、无空白帧；第101项添加${addResponse}ms，取消${response}ms且刷新保留100项`;
}
export const favoriteStressDefinitions = [
  {
    id: "PERPS-DESKTOP-FAVORITES-STRESS-001",
    name: "Desktop 大量永续收藏与滚动边界",
    selectorPreferences: true,
    favorites: true,
    rows: [
      {
        ids: ["D03-52", "D03-70", "D03-84", "D03-102"],
        name: "第101个真实收藏、取消、完整长列表与FPS",
        check: (p) => bulk(p, false),
      },
    ],
  },
  {
    id: "PERPS-DESKTOP-FAVORITES-STRESS-002",
    name: "Desktop 第101个现货收藏与轮播",
    selectorPreferences: true,
    favorites: true,
    rows: [
      {
        ids: ["D03-122"],
        name: "101现货UI收藏及独立底部对账",
        check: (p) => bulk(p, true),
      },
    ],
  },
];
export const favoriteStressSuite = createDesktopRowSuite(
  favoriteStressDefinitions,
);
