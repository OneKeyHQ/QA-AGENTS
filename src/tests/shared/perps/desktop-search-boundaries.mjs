// D03 手动用例：docs/qa/testcases/cases/perps/2026-01-20_Perps-收藏功能测试.md
// D05 手动用例：docs/qa/testcases/cases/perps/2026-02-03_Perps-搜索功能.md
import assert from "node:assert/strict";
import { aliasMatches } from "./search-alias-oracle.mjs";
import {
  assertPerpSearchResultSet,
  expectedSearchCategories,
  projectSelectorStringStates,
  withSearchPageErrors,
} from "./search-evidence.mjs";
import { projectReactAll } from "./react-projection.mjs";
import { desktopConfigRequestHeaders } from "./desktop-config-headers.mjs";
import {readCachedCatalog} from "./catalog-cache.mjs";
import {assertSearchCategoryWindow,projectAppliedSearchCategories,SearchCategoryWindowChanged} from "./search-category-window.mjs";
import { readFileSync } from "node:fs";
import {
  identifyMarketRow,
  marketCatalog,
  marketRowDOM,
} from "./market-identity.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { RESULTS_DIR } from "../../helpers/index.mjs";
import {
  locator,
  openPairs,
  closePairs,
  pairPopover,
  pairRows,
  clickPairTab,
} from "../../helpers/perps-ui.mjs";
import { pollForm } from "./non-order-ui.mjs";
import {
  spotMarketOracle,
  eligibleSpotMarkets,
  perpMarketOracle,
} from "./public-market-oracle.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";

async function query(page, text) {
  const input = pairPopover(page).locator("input");
  await input.fill(text);
  // The UI intentionally retains raw text; matching normalizes trim + 64 chars.
  assert.equal(await input.inputValue(), text);
  await page.waitForTimeout(650);
}
async function prepare(page, tab = "永续合约", text = "") {
  await openPairs(page);
  await query(page, "");
  await clickPairTab(page, tab);
  if (tab === "永续合约")
    await locator(page, "perps.selector.secondary_tabs")
      .getByText("全部", { exact: true })
      .click();
  await pollForm(
    () =>
      locator(page, "perps.selector.primary_tabs").evaluate((e) =>
        [...e.children]
          .filter((n) =>
            n.querySelector("span")?.classList.contains("_col-text"),
          )
          .map((n) => n.innerText.trim()),
      ),
    (v) => v.length === 1 && v[0] === tab,
    `Primary tab ${tab}`,
  );
  await query(page, text);
}
const catalogByPage = new WeakMap();
async function catalog(page) {
  return readCachedCatalog(catalogByPage,page,async () => {
        const config = await serverConfig(page);
        const [perps, spots] = await Promise.all([
          perpMarketOracle(config.hip3Dexs ?? []),
          spotMarketOracle(),
        ]);
        const names = JSON.parse(
          readFileSync(
            new URL("./data/spot-display-names.json", import.meta.url),
          ),
        ).names;
        return marketCatalog(perps, eligibleSpotMarkets(spots), names);
      });
}
export async function visibleSearchRows(page) {
  const raw = await catalog(page);
  const rendered = await pairRows(page).evaluateAll((es, source) => {
    const read = Function(`return (${source})`)();
    return es.map(read);
  }, marketRowDOM.toString());
  return rendered.map((r) => identifyMarketRow(r, raw));
}
const key = (r) => `${r.id}:${r.coin}:${r.name}`;
async function list(page) {
  return pollForm(
    () => visibleSearchRows(page),
    (rows) => rows.every((r) => r.coin),
    "Every rendered row must expose its canonical raw market identity",
    3000,
  );
}
async function expectEmpty(page, text = "未找到匹配的代币") {
  await pollForm(
    () => pairRows(page).count(),
    (n) => n === 0,
    "Empty result",
  );
  assert.equal(
    await pairPopover(page).getByText(text, { exact: true }).count(),
    1,
  );
  assert.equal(
    await pairPopover(page)
      .locator('[data-testid="perp-already-favorite-icon-btn"]')
      .count(),
    0,
  );
}
async function collect(page, { reveal } = {}) {
  if (!(await pairRows(page).count())) return [];
  const trace = process.env.PERPS_TRACE_SEARCH === "1" && !reveal;
  if (trace)
    console.log(
      "SEARCH_COLLECT_INITIAL " +
        JSON.stringify(
          await pairRows(page)
            .first()
            .evaluate((e) => {
              const parents = [];
              for (let p = e.parentElement; p; p = p.parentElement) {
                const s = getComputedStyle(p);
                parents.push({
                  tag: p.tagName,
                  tid: p.dataset.testid,
                  component: p.dataset.sentryComponent,
                  overflow: s.overflowY,
                  top: p.scrollTop,
                  height: p.clientHeight,
                  scroll: p.scrollHeight,
                });
              }
              return { parents };
            }),
        ),
    );
  // Scroll the real list, not the outer app or an inferred whole-page snapshot.
  const handle = await pairRows(page)
    .first()
    .evaluateHandle((e) => {
      for (let p = e.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (
          /auto|scroll/.test(s.overflowY) &&
          p.scrollHeight > p.clientHeight + 2
        )
          return p;
      }
      return null;
    });
  const hasScroll = await handle.evaluate((e) => !!e);
  const found = new Map();
  let priorTop = -1,
    revealed = false;
  const settled = async () => {
    if (!hasScroll) return;
    try {
      await page.waitForFunction(
        (el) => {
          const box = el.getBoundingClientRect(),
            rows = [
              ...el.querySelectorAll(
                '[data-testid^="perp-token-selector-row-"]',
              ),
            ]
              .map((e) => e.getBoundingClientRect())
              .filter(
                (r) => r.height > 0 && r.bottom > box.top && r.top < box.bottom,
              )
              .sort((a, b) => a.top - b.top);
          if (!rows.length) return false;
          const first = rows[0],
            last = rows.at(-1);
          return (
            first.top <= box.top + first.height &&
            last.bottom >= box.bottom - last.height
          );
        },
        handle,
        { timeout: 5000, polling: "raf" },
      );
    } catch (error) {
      let diagnostic;
      try {
        diagnostic = await handle.evaluate((el) => ({
          top: el.scrollTop,
          max: el.scrollHeight - el.clientHeight,
          height: el.clientHeight,
          focused: document.hasFocus(),
          visibility: document.visibilityState,
          box: (() => {
            const r = el.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, height: r.height };
          })(),
          rows: [
            ...el.querySelectorAll('[data-testid^="perp-token-selector-row-"]'),
          ].map((e) => {
            const r = e.getBoundingClientRect();
            return {
              id: e.dataset.testid,
              top: r.top,
              bottom: r.bottom,
              height: r.height,
            };
          }),
        }));
      } catch (readError) {
        diagnostic = { readError: readError.message };
      }
      console.error("SEARCH_SETTLE_FAILURE " + JSON.stringify(diagnostic));
      throw error;
    }
    await handle.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
  };
  if (hasScroll) await handle.evaluate((e) => (e.scrollTop = 0));
  try {
    for (let i = 0; i < 200; i++) {
      await settled();
      const rows = await list(page);
      for (const row of rows) found.set(key(row), row);
      if (
        reveal &&
        rows.some((r) => r.coin === reveal.coin && r.name === reveal.name)
      ) {
        revealed = true;
        break;
      }
      if (!hasScroll) break;
      const state = await handle.evaluate((e) => ({
        top: e.scrollTop,
        max: e.scrollHeight - e.clientHeight,
        height: e.clientHeight,
      }));
      if (trace)
        console.log(
          "SEARCH_COLLECT_SCROLL " +
            JSON.stringify({ i, count: found.size, ...state }),
        );
      if (state.top >= state.max - 1) break;
      assert.ok(state.top !== priorTop, "Search list scroll made no progress");
      priorTop = state.top;
      await handle.evaluate((e) => (e.scrollTop += e.clientHeight * 0.5));
      await page.waitForTimeout(100);
      if (i === 199) throw Error("Search list did not reach bottom");
    }
    return [...found.values()];
  } finally {
    if (hasScroll && !revealed) await handle.evaluate((e) => (e.scrollTop = 0));
    await handle.dispose();
  }
}
// Reveal a canonical identity through the real virtual list. A search can
// legitimately match many DEX/alias rows before the exact native token.
export async function revealSearchMarket(page, item) {
  const rows = await collect(page, { reveal: item });
  const matches = rows.filter(
    (r) => r.coin === item.coin && r.name === item.name,
  );
  assert.equal(
    matches.length,
    1,
    `Exact search market ${item.coin}/${item.name}`,
  );
  return pairRows(page)
    .and(page.getByTestId(matches[0].id))
    .filter({ has: page.getByText(item.name, { exact: true }) });
}
async function serverConfig(page) {
  const rawUrl = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .findLast((n) => n.includes("/utility/v1/perp-config?")),
  );
  if (!rawUrl)
    throw new SampleUnavailable("本会话没有可核对的 Perps 配置请求 URL");
  const url = new URL(rawUrl);
  assert.match(url.hostname, /^utility\.(onekeytest\.com|onekeycn\.com)$/u);
  const headers = await desktopConfigRequestHeaders(page);
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(response.status, 200, "Public configuration oracle");
  const body = await response.json();
  assert.equal(body.code, 0);
  assert.ok(Array.isArray(body.data.tokenSelectorTabs));
  assert.ok(body.data.tokenSearchAliases);
  const dir = resolve(RESULTS_DIR, "perps-desktop-completion");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    resolve(dir, "server-config-oracle.json"),
    JSON.stringify(
      { url: url.toString(), at: new Date().toISOString(), headers, data: body.data },
      null,
      2,
    ),
  );
  return body.data;
}
async function assertCompletePerpSearch(page, results, q, config) {
  assertPerpSearchResultSet(await catalog(page), results, q, config);
}
const row = (ids, name, check, extra = {}) => ({
  ids: ids.split(","),
  name,
  check,
  ...extra,
});
export const searchDefinitions = [
  {
    id: "PERPS-DESKTOP-SEARCH-001",
    name: "Desktop 搜索匹配与输入边界",
    selectorPreferences: true,
    rows: [
      row("D05-27", "英文 BT 与别名匹配范围", async (page) => {
        const config = await serverConfig(page);
        await prepare(page, "永续合约", "BT");
        const results = await collect(page);
        for (const coin of ["BTC", "AIXBT"])
          assert.ok(
            results.some((r) => r.coin === coin),
            `Missing ${coin}`,
          );
        assert.ok(
          results.every(
            (r) =>
              !r.spot &&
              (r.coin.toLowerCase().includes("bt") ||
                aliasMatches(r.coin, "bt", config)),
          ),
          "Each result must match name or configured alias",
        );
        await assertCompletePerpSearch(page, results, "BT", config);
        const tabs = await locator(
          page,
          "perps.selector.secondary_tabs",
        ).evaluate((e) =>
          [...e.children].map((c) => c.innerText.trim()).filter(Boolean),
        );
        for (const name of tabs) {
          await locator(page, "perps.selector.secondary_tabs")
            .getByText(name, { exact: true })
            .click();
          await page.waitForTimeout(400);
          assert.equal(
            await pairPopover(page).locator("input").inputValue(),
            "BT",
          );
          await assertCompletePerpSearch(
            page,
            await collect(page),
            "BT",
            config,
          );
        }

        return `${results.length} 个匹配项与独立原始市场/服务端别名完整集合一致`;
      }),
      row(
        "D05-28,D05-57",
        "中文关键词、中文标签及全部别名结果",
        async (page) => {
          const config = await serverConfig(page);
          for (const [q, coin, label] of [
            ["比特", "BTC", "比特币"],
            ["以太", "ETH", "以太坊"],
          ]) {
            await prepare(page, "永续合约", q);
            const results = await collect(page);
            await assertCompletePerpSearch(page, results, q, config);
            const own = results.find((r) => r.coin === coin);
            assert.ok(own);
            assert.ok(own.text.split("\n").includes(label));
            for (const r of results) {
              assert.ok(
                aliasMatches(r.coin, q, config),
                `${r.coin} must match configured Chinese alias`,
              );
              const subtitle = config.tokenSearchAliases[r.coin]?.subtitle;
              if (subtitle)
                assert.ok(
                  r.text.split("\n").includes(subtitle),
                  `${r.coin} subtitle`,
                );
            }
          }
          return "比特/以太全量结果均命中配置别名；BTC/ETH标签精确比对服务端";
        },
      ),
      row("D05-30", "日文配置关键词", async (page) => {
        const config = await serverConfig(page);
        const japanese = config.tokenSearchAliases.BTC?.aliases.find((a) =>
          /[ァ-ヺ]/u.test(a),
        );
        if (!japanese)
          throw new SampleUnavailable("服务端尚未配置可验证的 BTC 日文别名");
        await prepare(page, "永续合约", japanese);
        const results = await collect(page);
        assert.ok(results.some((r) => r.coin === "BTC"));
        await assertCompletePerpSearch(page, results, japanese, config);
        return `${japanese} → ${results.map((r) => r.coin).join(", ")}`;
      }),
      row(
        "D05-33,D03-40,D05-102",
        "空结果精确文案、无星标且可继续输入",
        async (page) => {
          for (const tab of ["永续合约", "现货"]) {
            for (const emptyText of ["ABCDEFG123", "XYZZZ999"]) {
              await prepare(page, tab, emptyText);
              await expectEmpty(page);
            }
            await query(page, "BTC");
            assert.ok(
              (await list(page)).some(
                (r) => r.name === (tab === "现货" ? "BTC/USDC" : "BTC"),
              ),
            );
          }
          return "永续/现货无结果→明确空状态且无收藏按钮→继续输入BTC恢复";
        },
      ),
      row("D05-34", "200 字符匹配词截断及页面继续输入", async (page) =>
        withSearchPageErrors(page, async () => {
          await prepare(page);
          await query(page, "A".repeat(200));
          await expectEmpty(page);
          const [strings] = await projectReactAll(
            pairPopover(page).locator("input"),
            projectSelectorStringStates,
          );
          assert.ok(
            strings.includes("A".repeat(64)),
            "Committed selector matching state must be truncated to 64",
          );
          await query(page, "BTC");
          assert.ok((await list(page)).some((r) => r.coin === "BTC"));
          return "输入保留200字符、committed匹配状态64字符；空状态后可继续搜索且无pageerror";
        }),
      ),
      row("D05-35", "特殊字符按文字匹配，空白按空输入处理", async (page) =>
        withSearchPageErrors(page, async () => {
          const config = await serverConfig(page);
          await prepare(page);
          const baseline = (await collect(page)).map(key).sort();
          for (const q of ["<", "'", " "]) {
            await query(page, q);
            const results = await collect(page);
            await assertCompletePerpSearch(page, results, q, config);
            if (q.trim() === "")
              assert.deepEqual(results.map(key).sort(), baseline);
            else if (!results.length) await expectEmpty(page);
          }
          await query(page, "BTC");
          assert.ok((await collect(page)).some((r) => r.coin === "BTC"));
          return "尖括号/引号逐项核对独立完整集合；空格恢复全部，继续BTC无pageerror";
        }),
      ),
    ],
  },
  {
    id: "PERPS-DESKTOP-SEARCH-002",
    name: "Desktop 服务端分类与范围隔离",
    selectorPreferences: true,
    rows: [
      row(
        "D05-45,D05-47",
        "服务端分类名称与顺序、不展示未配置分类",
        async (page) => {
          const config = await serverConfig(page);
          await prepare(page);
          const actual = await locator(
            page,
            "perps.selector.secondary_tabs",
          ).evaluate((e) =>
            [...e.children].map((c) => c.innerText.trim()).filter(Boolean),
          );
          assert.deepEqual(
            actual,
            expectedSearchCategories(config.tokenSelectorTabs).map(
              (t) => t.name,
            ),
          );
          return `与 ${config.configVersion} 配置名称及顺序逐项对比，无额外分类`;
        },
      ),
      row(
        "D05-32,D05-46,D05-48",
        "所有动态分类过滤、空类、往返不串数据",
        async (page) => {
          const config = await serverConfig(page);
          await prepare(page);
          const universe = await collect(page);
          const coins = new Set(
            (await catalog(page)).filter((r) => !r.spot).map((r) => r.coin),
          );
          assert.deepEqual(
            universe.map((r) => r.coin).sort(),
            [...coins].sort(),
            "All category must include every independently eligible raw perpetual market",
          );
          const results = [];
          for (const tab of expectedSearchCategories(
            config.tokenSelectorTabs,
          ).slice(1)) {
            let actual,stable;
            for(let attempt=0;attempt<3;attempt++) {
              const serverBefore=(await serverConfig(page)).tokenSelectorTabs;
              const [appliedBefore]=await projectReactAll(pairPopover(page).locator("input"),projectAppliedSearchCategories);
              await locator(page, "perps.selector.secondary_tabs").getByText(tab.name, { exact: true }).click();
              await page.waitForTimeout(400);
              actual=(await collect(page)).map(r=>r.coin).sort();
              const serverAfter=(await serverConfig(page)).tokenSelectorTabs;
              const [appliedAfter]=await projectReactAll(pairPopover(page).locator("input"),projectAppliedSearchCategories);
              const window={serverBefore,serverAfter,appliedBefore,appliedAfter,actual,name:tab.name};
              writeFileSync(resolve(RESULTS_DIR,"perps-desktop-completion",`search-category-window-${tab.tabId}-${attempt}.json`),JSON.stringify({at:new Date().toISOString(),...window},null,2));
              try {stable=assertSearchCategoryWindow({...window,coins});break;}
              catch(e) {
                if(!(e instanceof SearchCategoryWindowChanged))throw e;
                if(attempt===2)throw new SampleUnavailable(e.message+"; three bounded snapshot attempts recorded");
                await page.waitForTimeout(500);
              }
            }
            const expected=stable.tokens.filter(c=>coins.has(c));
            assert.equal(
              await pairPopover(page)
                .getByText("未找到匹配的代币", { exact: true })
                .count(),
              0,
              "Empty input uses category state, never search-not-found state",
            );
            if (!expected.length) {
              assert.equal(await pairRows(page).count(), 0);
              assert.equal(
                await pairPopover(page)
                  .getByText("暂无数据", { exact: true })
                  .count(),
                1,
              );
            }
            results.push(`${tab.name}:${actual.length}`);
            console.log(
              `    Category ${tab.name}: ${actual.length} raw identities matched`,
            );
            await locator(page, "perps.selector.secondary_tabs")
              .getByText("全部", { exact: true })
              .click();
            await page.waitForTimeout(300);
            const restored = await list(page);
            assert.ok(
              restored.length > 0 && restored.every((r) => coins.has(r.coin)),
              "Back to all visible rows belong to the original universe",
            );
          }
          assert.deepEqual(
            (await collect(page)).map((r) => r.coin).sort(),
            [...coins].sort(),
            "Final all-category full universe restored",
          );
          return results.join("；");
        },
      ),
      row("D05-49", "空分类有独立夹具时检查暂无数据且不串类", async (page) => {
        const config = await serverConfig(page);
        await prepare(page);
        const coins = new Set(
          (await catalog(page)).filter((r) => !r.spot).map((r) => r.coin),
        );
        const empty = expectedSearchCategories(config.tokenSelectorTabs)
          .slice(1)
          .find((t) => t.tokens.every((c) => !coins.has(c)));
        if (!empty)
          throw new SampleUnavailable(
            "服务端当前没有空分类；不能借非空分类循环通过来代表暂无数据分支",
          );
        await locator(page, "perps.selector.secondary_tabs")
          .getByText(empty.name, { exact: true })
          .click();
        await page.waitForTimeout(400);
        assert.deepEqual(await collect(page), []);
        assert.equal(await pairRows(page).count(), 0);
        assert.equal(
          await pairPopover(page)
            .getByText("暂无数据", { exact: true })
            .count(),
          1,
        );
        return `${empty.name}真实空分类、无其他分类行、精确暂无数据`;
      }),
      row("D05-69,D05-70", "跨子分类带词搜索及清空恢复", async (page) => {
        const config = await serverConfig(page);
        await prepare(page);
        const tabs = await locator(
          page,
          "perps.selector.secondary_tabs",
        ).evaluate((e) =>
          [...e.children].map((c) => c.innerText.trim()).filter(Boolean),
        );
        if (tabs.length < 2)
          throw new SampleUnavailable("当前只配置全部分类，缺带词跨分类样本");
        assert.equal(
          new Set(tabs).size,
          tabs.length,
          "Each category has a unique visible name",
        );
        const records = [];
        let outsideCategory = false;
        for (const [index, name] of tabs.entries()) {
          const select = async (target) => {
            await locator(page, "perps.selector.secondary_tabs")
              .getByText(target, { exact: true })
              .click();
            await page.waitForTimeout(400);
          };
          await select(name);
          await query(page, "");
          const baseline = (await collect(page)).map(key).sort();
          if (
            !["BTC", "ETH"].some((c) =>
              baseline.some((n) => n.includes(`:${c}:`)),
            )
          )
            outsideCategory = true;
          for (const q of ["BTC", "ETH"]) {
            await query(page, q);
            for (const target of [
              name,
              tabs[(index + 1) % tabs.length],
              name,
            ]) {
              await select(target);
              assert.equal(
                await pairPopover(page).locator("input").inputValue(),
                q,
              );
              const results = await collect(page);
              assert.ok(
                results.some((r) => r.coin === q),
                `${target} search ${q}`,
              );
              await assertCompletePerpSearch(page, results, q, config);
            }
          }
          await query(page, "");
          assert.deepEqual(
            (await collect(page)).map(key).sort(),
            baseline,
            `Clearing search restores exactly ${name}, without cross-category leftovers`,
          );
          records.push(`${name} BTC/ETH完整搜索、带词切换及清空`);
        }
        if (!outsideCategory)
          throw new SampleUnavailable(
            "当前分类均含BTC/ETH，缺分类外代币搜索的阳性样本",
          );
        return records.join("；");
      }),
    ],
  },
  {
    id: "PERPS-DESKTOP-SEARCH-003",
    name: "Desktop 现货名称、别名与大小写",
    selectorPreferences: true,
    rows: [
      row("D05-98", "现货 BTC 大小写结果集合及资产类型", async (page) => {
        await prepare(page, "现货", "BTC");
        const upper = await collect(page);
        assert.ok(upper.some((r) => r.name === "BTC/USDC"));
        const eligible = eligibleSpotMarkets(await spotMarketOracle()).filter(
          (r) => r.base.includes("BTC"),
        );
        assert.deepEqual(
          upper.map((r) => r.coin).sort(),
          eligible.map((r) => r.coin).sort(),
          "All volume-eligible BTC markets, including USDH when eligible",
        );
        assert.ok(upper.every((r) => r.spot && r.name.includes("/")));
        await query(page, "btc");
        assert.deepEqual(
          (await collect(page)).map(key).sort(),
          upper.map(key).sort(),
        );
        return `BTC/btc全量集合一致；按1000美元成交量门槛对账${eligible.map((r) => `${r.base}/${r.quote}`).join(", ")}，USDH低量时正确过滤`;
      }),
      row(
        "D05-99,D05-100,D05-101",
        "HYPE、多报价币、完整交易对与内部 UBTC",
        async (page) => {
          const markets = eligibleSpotMarkets(await spotMarketOracle());
          for (const [q, expected] of [
            [
              "HYPE",
              markets
                .filter((r) => r.base.includes("HYPE"))
                .map((r) => `${r.base}/${r.quote}`),
            ],
            ["BTC/USDC", ["BTC/USDC"]],
            ["UBTC", ["BTC/USDC"]],
          ]) {
            assert.ok(
              expected.length > 0,
              `${q} independent market samples required`,
            );
            await prepare(page, "现货", q);
            const rows = await collect(page);
            for (const name of expected)
              assert.ok(
                rows.some((r) => r.name === name),
                `${q} → ${name}`,
              );
            assert.ok(rows.every((r) => r.spot));
            assert.deepEqual(
              rows.map((r) => r.name).sort(),
              [...expected].sort(),
              `${q} full spot result identities, no extras`,
            );
          }
          return "HYPE全部达到成交量门槛的报价币均显示；完整BTC/USDC和内部UBTC命中映射显示名，低量USDH按规则过滤";
        },
      ),
      row("D05-111", "同币种永续中文标签与现货无中文标签", async (page) => {
        await prepare(page, "现货", "BTC/USDC");
        const spot = (await collect(page)).find((r) => r.name === "BTC/USDC");
        assert.ok(spot);
        assert.ok(
          !spot.text.split("\n").includes("比特币"),
          "Spot must not have the BTC Chinese asset subtitle; the 现货 type badge is allowed",
        );
        await prepare(page, "永续合约", "BTC");
        const perp = (await collect(page)).find((r) => r.coin === "BTC");
        assert.ok(perp);
        assert.match(perp.text, /比特币/u);
        return "BTC/USDC现货行无中文代币副标题，保留现货徽标；原生BTC永续含比特币标签";
      }),
    ],
  },
];
export const searchSuite = createDesktopRowSuite(searchDefinitions);
export {
  prepare as prepareSearch,
  collect as collectSearchRows,
  query as querySearch,
  serverConfig as readServerConfig,
};
