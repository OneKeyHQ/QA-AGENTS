// D06 手动用例：docs/qa/testcases/cases/perps/2026-03-05_Perps-首页底部状态.md
// Desktop manual footer chapters 2/3/4. A changed ticker preference is always
// restored by clicking its original visible option and reading it independently.
import assert from "node:assert/strict";
import { projectReactAll } from "./react-projection.mjs";
import {
  locator,
  favoriteSnapshot,
  restorePair,
  currentPair,
  closePairs,
  clearFavorites,
  setFavorite,
} from "../../helpers/perps-ui.mjs";
import {
  dragFavorite,
  favoriteTopNames,
} from "./desktop-favorites-boundaries.mjs";
import { quotePrice } from "./favorite-quote-assertions.mjs";
import { createDesktopRowSuite } from "./desktop-row-suite.mjs";
import { closePop, pollForm } from "./non-order-ui.mjs";
import { markRestoreFailure, reloadPerps } from "./runtime.mjs";
import { PerpsPage } from "../../helpers/pages/perps.mjs";
const pop = (p) => locator(p, "perps.overlay.popover");
const settings = (p) =>
  locator(p, "perps.footer.settings").filter({ visible: true });
const labels = ["不展示预览", "热门", "自选"];
const loop = (p) => locator(p, "perps.footer.loop");
const row = (ids, name, check, extra = {}) => ({
  ids: ids.split(","),
  name,
  check,
  ...extra,
});
async function openSettings(p) {
  await closePairs(p);
  await closePop(p);
  assert.equal(await settings(p).count(), 1);
  await settings(p).click();
  await pop(p)
    .getByText(labels[0], { exact: true })
    .waitFor({ state: "visible" });
  assert.deepEqual(
    (await pop(p).innerText())
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    labels,
  );
}
export async function footerMode(p) {
  await openSettings(p);
  const checked = await pop(p)
    .locator('svg[data-sentry-component="SvgCheckLarge"]')
    .evaluateAll((es) => es.map((e) => e.parentElement.innerText.trim()));
  assert.equal(checked.length, 1, "Exactly one footer mode checked");
  assert.ok(labels.includes(checked[0]));
  await closePop(p);
  return checked[0];
}
export async function setFooterMode(p, label) {
  assert.ok(labels.includes(label));
  await openSettings(p);
  await pop(p).getByText(label, { exact: true }).click();
  await pop(p).waitFor({ state: "hidden" });
  assert.equal(await footerMode(p), label);
}
async function withMode(p, fn) {
  const before = await footerMode(p);
  try {
    return await fn();
  } finally {
    try {
      await setFooterMode(p, before);
      assert.equal(await footerMode(p), before);
    } catch (e) {
      throw markRestoreFailure(null, e, "恢复底部轮播模式");
    }
  }
}
export async function footerRows(p) {
  return projectReactAll(loop(p).locator("button"), (f, e) => {
    let props;
    for (; f; f = f.return)
      if (f.memoizedProps?.coinName) {
        props = f.memoizedProps;
        break;
      }
    return {
      text: e.innerText,
      name: e.innerText.split("\n")[0],
      coin: props?.coinName,
      mode: props?.mode,
      assetId: props?.assetId,
      markPrice: props?.markPrice,
      change: props?.change24hPercent,
      colors: [...e.querySelectorAll("span")]
        .filter(
          (n) =>
            !n.querySelector("span") &&
            n.innerText === e.innerText.split("\n")[1],
        )
        .map((n) => getComputedStyle(n).color),
    };
  });
}
async function assertRows(p, spot) {
  const rows = await pollForm(
    () => footerRows(p),
    (v) => v.length > 0,
    "Footer ticker rows",
  );
  assert.ok(
    rows.every((r) => r.coin && r.mode === (spot ? "spot" : "perp")),
    "Every ticker must carry a raw identity and correct asset type",
  );
  for (const r of rows) {
    const parts = r.text.split("\n");
    assert.equal(parts.length, 3);
    assert.match(parts[1], /^[+−-]?\d+(?:\.\d+)?%$/u);
    assert.match(parts[2], /^\d[\d,.]*$/u);
    assert.equal(
      parts[2].replaceAll(",", ""),
      quotePrice(r.markPrice),
      "Actual price text equals committed raw mark with independent decimal oracle",
    );
    assert.ok(Number.isFinite(r.change));
    assert.ok(
      Math.abs(Number(parts[1].slice(0, -1).replace("−", "-")) - r.change) <=
        0.005000001,
    );
    assert.equal(
      parts[1].startsWith("-") || parts[1].startsWith("−"),
      r.change < 0,
    );
    const colors = [...new Set(r.colors)];
    assert.equal(colors.length, 1, "Unique actual 24h color");
    const [red, green, blue] = colors[0].match(/\d+(?:\.\d+)?/gu).map(Number);
    assert.ok(
      r.change >= 0 ? green > red && green > blue : red > green && red > blue,
      "Direction color follows raw 24h change",
    );
    if (spot)
      assert.ok(r.name.includes("/"), "Spot ticker must preserve BASE/QUOTE");
    else assert.ok(!r.name.includes("/"));
  }
  return rows;
}

async function mixedFavorites(p) {
  await clearFavorites(p);
  for (const name of ["BTC", "BTC/USDC", "ETH", "HYPE/USDC"])
    await setFavorite(p, { name }, true);
  await closePairs(p);
  await pollForm(
    () => favoriteTopNames(p),
    (v) =>
      JSON.stringify(v) ===
      JSON.stringify(["BTC", "BTC/USDC", "ETH", "HYPE/USDC"]),
    "Independent mixed top favorite fixture",
  );
}
async function currentFavoriteFooter(p, spot) {
  const top = await favoriteTopNames(p),
    expected = top.filter((name) => name.includes("/") === spot);
  const rows = await pollForm(
    () => footerRows(p),
    (v) => JSON.stringify(v.map((r) => r.name)) === JSON.stringify(expected),
    "Footer independently follows current-mode top favorite order",
  );
  if (expected.length) await assertRows(p, spot);
  else
    assert.deepEqual(
      rows,
      [],
      "Current mode has no favorites; other-mode favorites must not leak",
    );
  return rows;
}

const definitions = [
  {
    id: "PERPS-DESKTOP-FOOTER-002",
    name: "Desktop 底部 §2 连接状态与提示",
    rows: [
      row("D06-33", "正常连接徽标、绿点、隐藏延迟及完整 Tooltip", async (p) => {
        const badge = p
          .locator('[data-sentry-component="NetworkStatusBadge"]')
          .filter({ visible: true });
        assert.equal(await badge.count(), 1);
        assert.equal((await badge.innerText()).trim(), "连线正常");
        assert.doesNotMatch(await badge.innerText(), /\d+ms/u);
        const dot = await badge.evaluate((e) =>
          [...e.querySelectorAll("div")]
            .filter(
              (n) =>
                Math.abs(n.getBoundingClientRect().width - 6) < 1 &&
                Math.abs(n.getBoundingClientRect().height - 6) < 1,
            )
            .map((n) => getComputedStyle(n).backgroundColor),
        );
        assert.equal(dot.length, 1);
        const rgb = dot[0].match(/\d+/gu).map(Number);
        assert.ok(
          rgb[1] > rgb[0] && rgb[1] > rgb[2],
          "Connected indicator green",
        );
        await badge.hover();
        const tooltip = p.getByRole("tooltip").filter({ visible: true });
        await tooltip.waitFor({ state: "visible" });
        const text = await tooltip.innerText();
        assert.match(text, /状态\s+连线正常\s+\d+ms/u);
        assert.match(text, /最后更新\s+\d{2}:\d{2}:\d{2}/u);
        const ms = Number(text.match(/(\d+)ms/u)[1]);
        assert.ok(ms >= 0 && ms <= 9999);
        await p.mouse.move(0, 0);
        return `徽标无延迟数值；绿色6px点；悬停含状态、${ms}ms及HH:mm:ss`;
      }),
    ],
  },
  {
    id: "PERPS-DESKTOP-FOOTER-003",
    name: "Desktop 底部 §3 轮播设置、资产隔离与持久化",
    rows: [
      row("D06-44", "三设置选项及不展示预览", (p) =>
        withMode(p, async () => {
          await setFooterMode(p, "不展示预览");
          assert.equal(await loop(p).count(), 0);
          assert.equal(await locator(p, "perps.footer.track").count(), 0);
          return "三项严格顺序；不展示预览时主列表和动画轨道都不存在";
        }),
      ),
      ...[
        ["D06-45", "BTCUSDC"],
        ["D06-46", "HYPE/USDC"],
      ].map(([id, pair]) =>
        row(
          id,
          `热门${pair.includes("/") ? "现货" : "永续"}数据格式与完整报价币`,
          (p) =>
            withMode(p, async () => {
              await setFooterMode(p, "热门");
              await restorePair(p, pair);
              const rows = await assertRows(p, pair.includes("/"));
              return `${pair}:${rows.length}项，资产类型、名称、涨跌幅和标记价分别核对`;
            }),
        ),
      ),
      row("D06-52", "三种设置分别真实刷新后保持", (p) =>
        withMode(p, async () => {
          const results = [];
          const favorites = await favoriteSnapshot(p);
          await closePairs(p);
          const spot = (await currentPair(p)).includes("/");
          const expectedFavoriteNames = favorites
            .filter((r) => r.name.includes("/") === spot)
            .map((r) => r.name);
          for (const label of labels) {
            await setFooterMode(p, label);
            await reloadPerps(p, {
              navigate: async () => new PerpsPage(p).navigate(),
              ready: async () =>
                locator(p, "perps.perp-token-selector").waitFor({
                  state: "visible",
                }),
            });
            assert.equal(await footerMode(p), label);
            if (label === "不展示预览") assert.equal(await loop(p).count(), 0);
            else if (label === "热门") await assertRows(p, spot);
            else {
              const rendered = await pollForm(
                () => footerRows(p),
                (v) =>
                  JSON.stringify(v.map((r) => r.name)) ===
                  JSON.stringify(expectedFavoriteNames),
                "Reloaded favorite footer exact current-mode identities",
              );
              assert.ok(
                rendered.every((r) => r.mode === (spot ? "spot" : "perp")),
              );
            }
            results.push(label);
          }
          return `真实刷新各自保持：${results.join("、")}`;
        }),
      ),
    ],
  },
  {
    id: "PERPS-DESKTOP-FOOTER-004",
    name: "Desktop 底部 §4 更多菜单",
    rows: [
      row("D06-61,D06-63", "五项菜单顺序及点击外部关闭", async (p) => {
        const actions = p
          .locator('[data-sentry-component="PerpFooterActions"]')
          .filter({ visible: true });
        assert.equal(await actions.count(), 1);
        await actions.locator('svg[data-sentry-component="SvgDotHor"]').click();
        const menu = pop(p);
        await menu.waitFor({ state: "visible" });
        const items = (await menu.getByRole("button").allTextContents()).map(
          (v) => v.trim(),
        );
        assert.deepEqual(items, [
          "关于",
          "帮助",
          "查看教程",
          "用户协议",
          "隐私政策",
        ]);
        await p.mouse.click(4, 4);
        await menu.waitFor({ state: "hidden" });
        return "菜单严格5项与顺序；点击菜单外真实关闭";
      }),
    ],
  },
];
definitions.push({
  id: "PERPS-DESKTOP-FOOTER-005",
  name: "Desktop 底部 §3 收藏同步与完整字段",
  favorites: true,
  selectorPreferences: true,
  rows: [
    row("D06-24", "实际拖动后底部仅当前永续且与独立顶部顺序一致", (p) =>
      withMode(p, async () => {
        await mixedFavorites(p);
        await setFooterMode(p, "自选");
        await restorePair(p, "BTCUSDC");
        await dragFavorite(p, 0, 3);
        const rows = await currentFavoriteFooter(p, false);
        assert.deepEqual(
          rows.map((r) => r.name),
          ["ETH", "BTC"],
        );
        return "真实混合四项拖动，底部永续仅ETH/BTC，独立顶部四项保留，完整行情逐列核对";
      }),
    ),
    row("D06-49", "永续/现货自选隔离、顺序、完整字段及当前模式空态", (p) =>
      withMode(p, async () => {
        await mixedFavorites(p);
        await setFooterMode(p, "自选");
        for (const pair of ["BTCUSDC", "BTC/USDC"]) {
          await restorePair(p, pair);
          await currentFavoriteFooter(p, pair.includes("/"));
        }
        await setFavorite(p, { name: "BTC" }, false);
        await setFavorite(p, { name: "ETH" }, false);
        await closePairs(p);
        await restorePair(p, "BTCUSDC");
        assert.deepEqual(await favoriteTopNames(p), ["BTC/USDC", "HYPE/USDC"]);
        await currentFavoriteFooter(p, false);
        await restorePair(p, "BTC/USDC");
        await currentFavoriteFooter(p, true);
        return "两种模式逐项名称/涨跌幅/标记价/方向色及独立顶部顺序；清空永续时仅底部为空，顶部两现货保留";
      }),
    ),
    row("D06-50", "真实新增取消拖动各自同步，并切换两种交易模式", (p) =>
      withMode(p, async () => {
        await mixedFavorites(p);
        await setFooterMode(p, "自选");
        await restorePair(p, "BTCUSDC");
        await currentFavoriteFooter(p, false);
        await setFavorite(p, { name: "SOL" }, true);
        await closePairs(p);
        assert.ok((await favoriteTopNames(p)).includes("SOL"));
        await currentFavoriteFooter(p, false);
        await setFavorite(p, { name: "ETH" }, false);
        await closePairs(p);
        assert.ok(!(await favoriteTopNames(p)).includes("ETH"));
        await currentFavoriteFooter(p, false);
        await dragFavorite(p, 3, 0);
        await currentFavoriteFooter(p, false);
        for (const pair of ["BTC/USDC", "BTCUSDC"]) {
          await restorePair(p, pair);
          await currentFavoriteFooter(p, pair.includes("/"));
        }
        return "新增SOL、删除ETH、真实指针重排均独立核对顶部与footer完整有序集合；现货/永续切换再次核对";
      }),
    ),
  ],
});

export const footerDefinitions = definitions;
export const footerSuite = createDesktopRowSuite(definitions);
