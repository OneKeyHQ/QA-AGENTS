// D09 手动用例：docs/qa/testcases/cases/perps/2026-03-26_Perps-投资组合&盈亏.md
// Current-account Desktop portfolio controls. Financial field fixtures and
// permissions are reported separately; no account or position is mutated.
import assert from "node:assert/strict";
import { coherentChartProjection } from "./chart-projection.mjs";
import {
  portfolioHistoryProjection,
  expectedPortfolioHistory,
  assertPortfolioHistory,
} from "./portfolio-history-oracle.mjs";
import { locator } from "../../helpers/perps-ui.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import { closePop, clickVisibleChoice, pollForm } from "./non-order-ui.mjs";
import { closeFunds, accountFingerprint } from "./desktop-funds-boundaries.mjs";
import { projectReactAll } from "./react-projection.mjs";
import {
  hoverPortfolioChart,
  activePortfolioChartType,
} from "./portfolio-assertions.mjs";
import { markRestoreFailure } from "./runtime.mjs";
const chartControl = (p) => locator(p, "perps.portfolio.chart_type");
const periodControl = (p) => locator(p, "perps.portfolio.time_period");
const scope = (p) =>
  chartControl(p).locator(
    'xpath=ancestor::*[@data-testid="IN_PAGE_TAB_CONTAINER"][1]',
  );
const row = (ids, name, check, extra = {}) => ({
  ids: ids.split(","),
  name,
  check,
  ...extra,
});
const chartTypes = [
  ["净值", "accountValue", "dotted-area"],
  ["盈亏", "pnl", "baseline"],
  ["资金费", "funding", "histogram"],
];
const periods = [
  ["1天", "day"],
  ["1周", "week"],
  ["1月", "month"],
  ["全部", "allTime"],
];
async function selection(control) {
  const rows = await projectReactAll(control, (f) => {
    for (; f; f = f.return) {
      const p = f.memoizedProps;
      if (
        Array.isArray(p?.options) &&
        p.options.every((o) => typeof o.value === "string") &&
        typeof p.value === "string"
      )
        return {
          value: p.value,
          options: p.options.map((o) => ({ label: o.label, value: o.value })),
        };
    }
    throw Error("Committed SegmentControl props unavailable");
  });
  assert.equal(rows.length, 1);
  return rows[0];
}
async function openPortfolio(p) {
  await locator(p, "perps.perp-portfolio-button").click();
  try {
    await chartControl(p).waitFor({ state: "visible", timeout: 12000 });
  } catch (e) {
    if (
      (await p.getByRole("dialog").filter({ visible: true }).count()) &&
      (await locator(p, "perps.perp-deposit-button").count())
    )
      throw new SampleUnavailable(
        "当前账户走充值引导，没有可展示的投资组合；需有资产/历史账户",
      );
    throw e;
  }
}
async function withPortfolio(p, fn) {
  const account = await accountFingerprint(p);
  try {
    await openPortfolio(p);
    return await fn();
  } finally {
    try {
      await p.mouse.move(0, 0);
      await closeFunds(p);
      assert.equal(await accountFingerprint(p), account);
    } catch (e) {
      throw markRestoreFailure(null, e, "关闭投资组合并保持原账户");
    }
  }
}
async function chooseChart(p, label) {
  await clickVisibleChoice(chartControl(p).getByText(label, { exact: true }));
  await pollForm(
    () => activePortfolioChartType(p),
    (v) => v === label,
    "Chart selection",
  );
}
async function choosePeriod(p, label, value) {
  await clickVisibleChoice(periodControl(p).getByText(label, { exact: true }));
  await pollForm(
    () => selection(periodControl(p)),
    (v) => v.value === value,
    "Time period",
  );
}
async function chartState(p) {
  const canvases = scope(p).locator("canvas").filter({ visible: true });
  const data = await projectReactAll(
    canvases,
    (f, e) => {
      for (; f; f = f.return) {
        const p = f.memoizedProps;
        if (
          Array.isArray(p?.data) &&
          ["dotted-area", "baseline", "histogram"].includes(p.seriesType)
        )
          return {
            data: p.data,
            series: p.seriesType,
            baseline: p.baselineOptions,
            histogram: p.histogramOptions,
            reference: p.referenceLine,
            axisWidth: p.priceScaleMinimumWidth,
            rect: {
              width: e.getBoundingClientRect().width,
              height: e.getBoundingClientRect().height,
            },
          };
      }
      return null;
    },
    { closestAncestor: true },
  );
  return coherentChartProjection(data);
}
async function seriesReady(p, type) {
  return pollForm(
    () => chartState(p),
    (v) => v?.series === type,
    "Expected chart series",
  );
}
async function historyReady(p, period) {
  const settled = await pollForm(
    async () => {
      let raw;
      try {
        raw = await projectReactAll(
          chartControl(p),
          portfolioHistoryProjection,
        );
      } catch (error) {
        if (
          String(error.message).includes("raw portfolio history result, got 0")
        )
          return null;
        throw error;
      }
      assert.equal(raw.length, 1);
      const expected = expectedPortfolioHistory(raw[0], period);
      if (!expected.length)
        throw new SampleUnavailable(
          `当前${period}无原始净值历史，需非空历史样本`,
        );
      const chart = await chartState(p);
      return { raw: raw[0], expected, chart };
    },
    (v) =>
      v?.chart?.series === "dotted-area" &&
      JSON.stringify(v.chart.data) === JSON.stringify(v.expected),
    "完整图表点及X轴时间与原始历史一致",
  );
  assertPortfolioHistory(settled.chart.data, settled.raw, period);
  return settled;
}
async function choosePnl(p, label) {
  const trigger = locator(p, "perps.portfolio.pnl_type");
  await trigger.click();
  const panel = locator(p, "perps.overlay.popover");
  await panel.waitFor({ state: "visible" });
  const menu = locator(p, "perps.overlay.popover");
  const target = (await menu.count()) ? menu : panel;
  await clickVisibleChoice(target.getByText(label, { exact: true }));
  await target.waitFor({ state: "hidden" });
  assert.equal((await trigger.innerText()).trim(), label);
}
export const portfolioBoundaryDefinitions = [
  {
    id: "PERPS-DESKTOP-PORTFOLIO-004",
    name: "Desktop 投资组合 §4 图表类型、时间及快速切换",
    rows: [
      row("D09-63", "类型顺序及默认净值", (p) =>
        withPortfolio(p, async () => {
          const state = await selection(chartControl(p));
          assert.deepEqual(
            state.options,
            chartTypes.map(([label, value]) => ({ label, value })),
          );
          let previousRight = -Infinity;
          for (const [label] of chartTypes) {
            const box = await chartControl(p)
              .getByText(label, { exact: true })
              .boundingBox();
            assert.ok(
              box && box.width > 0 && box.x >= previousRight,
              "Visible chart type order is left to right",
            );
            previousRight = box.x + box.width;
          }
          assert.equal(state.value, "accountValue");
          assert.equal(await activePortfolioChartType(p), "净值");
          return "三个选项按净值/盈亏/资金费排列，默认净值";
        }),
      ),
      row(
        "D09-64,D09-65",
        "净值面积/盈亏零轴及正负色",
        (p) =>
          withPortfolio(p, async () => {
            await chooseChart(p, "净值");
            const value = await seriesReady(p, "dotted-area");
            await chooseChart(p, "盈亏");
            const pnl = await seriesReady(p, "baseline");
            assert.equal(pnl.baseline.baseValue.price, 0);
            assert.notEqual(
              pnl.baseline.topLineColor,
              pnl.baseline.bottomLineColor,
            );
            assert.ok(
              pnl.baseline.topLineColor && pnl.baseline.bottomLineColor,
            );
            return JSON.stringify({
              valuePoints: value.data.length,
              pnlPoints: pnl.data.length,
              base: pnl.baseline,
            });
          }),
        {
          complete: false,
          missing:
            "真实曲线数据与底层账户历史逐点对账、像素正负颜色仍需独立 oracle；目前只核对已提交给图表的配置",
        },
      ),
      row("D09-66,D09-67", "四种时间范围及快速连续切换", (p) =>
        withPortfolio(p, async () => {
          const opts = await selection(periodControl(p));
          assert.deepEqual(
            opts.options,
            periods.map(([label, value]) => ({ label, value })),
          );
          const data = [];
          for (const [label, value] of periods) {
            await choosePeriod(p, label, value);
            const { chart: s, expected } = await historyReady(p, value);
            data.push({
              value,
              count: s.data.length,
              start: s.data[0]?.[0],
              end: s.data.at(-1)?.[0],
              rawStart: expected[0][0],
              rawEnd: expected.at(-1)[0],
            });
          }
          for (const [label] of periods)
            await clickVisibleChoice(
              periodControl(p).getByText(label, { exact: true }),
            );
          await pollForm(
            () => selection(periodControl(p)),
            (v) => v.value === "allTime",
            "Final time dimension",
          );
          await historyReady(p, "allTime");
          return JSON.stringify(data);
        }),
      ),
      row("D09-68", "类型快速切换最终净值且无柱图残留", (p) =>
        withPortfolio(p, async () => {
          for (const label of ["净值", "盈亏", "资金费", "净值"])
            await clickVisibleChoice(
              chartControl(p).getByText(label, { exact: true }),
            );
          await pollForm(
            () => activePortfolioChartType(p),
            (v) => v === "净值",
            "Final chart type",
          );
          assert.equal(
            (await seriesReady(p, "dotted-area")).series,
            "dotted-area",
          );
          assert.equal(await locator(p, "perps.portfolio.pnl_type").count(), 0);
          assert.equal(
            await scope(p).getByText("累计收取", { exact: true }).count(),
            0,
          );
          return "最终净值面积曲线，无资产筛选与资金费分布残留";
        }),
      ),
    ],
  },
  {
    id: "PERPS-DESKTOP-PORTFOLIO-012",
    name: "Desktop 投资组合 §12 盈亏资产类型",
    rows: [
      row("D09-173,D09-174", "盈亏默认全部、三项顺序与唯一勾选", (p) =>
        withPortfolio(p, async () => {
          await chooseChart(p, "盈亏");
          const trigger = locator(p, "perps.portfolio.pnl_type");
          assert.equal((await trigger.innerText()).trim(), "全部");
          const arrows = await trigger.locator("svg").evaluateAll((es) =>
            es
              .filter((e) =>
                /ChevronDownSmall/.test(
                  (e.dataset.sentryComponent ?? "") +
                    " " +
                    (e.dataset.sentrySourceFile ?? ""),
                ),
              )
              .map((e) => {
                const r = e.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
              }),
          );
          assert.deepEqual(
            arrows,
            [true],
            "One visible downward arrow on the asset-type trigger",
          );
          await trigger.click();
          const menu = locator(p, "perps.overlay.popover");
          await menu.waitFor({ state: "visible" });
          assert.deepEqual(
            (await menu.getByRole("button").allTextContents()).map((s) =>
              s.trim(),
            ),
            ["全部", "合约", "现货"],
          );
          const checked = menu.locator(
            'svg[data-sentry-component="SvgCheckLarge"]',
          );
          assert.equal(await checked.count(), 1);
          assert.match(await checked.locator("..").innerText(), /全部/u);
          await closePop(p);
          return "默认全部；菜单三项严格顺序及唯一勾选";
        }),
      ),
      row(
        "D09-175,D09-179",
        "切净值/资金费隐藏，返回盈亏保留现货",
        (p) =>
          withPortfolio(p, async () => {
            await chooseChart(p, "盈亏");
            await choosePnl(p, "现货");
            for (const label of ["净值", "资金费"]) {
              await chooseChart(p, label);
              assert.equal(
                await locator(p, "perps.portfolio.pnl_type").count(),
                0,
              );
            }
            await chooseChart(p, "盈亏");
            assert.equal(
              (await locator(p, "perps.portfolio.pnl_type").innerText()).trim(),
              "现货",
            );
            return "现货筛选仅作用于盈亏，返回保留选项；净值/资金费无触发器";
          }),
        {
          complete: false,
          missing:
            "资产类型完整图表/总盈亏/交易统计原始数据口径仍需与各账户记录对账",
        },
      ),
      row(
        "D09-182,D09-183",
        "现货跨时间保持及快速筛选最终值",
        (p) =>
          withPortfolio(p, async () => {
            await chooseChart(p, "盈亏");
            await choosePnl(p, "现货");
            for (const [label, value] of periods) {
              await choosePeriod(p, label, value);
              assert.equal(
                (
                  await locator(p, "perps.portfolio.pnl_type").innerText()
                ).trim(),
                "现货",
              );
            }
            for (const label of ["全部", "合约", "现货"])
              await choosePnl(p, label);
            assert.equal((await seriesReady(p, "baseline")).series, "baseline");
            return "四维度保留现货；全部→合约→现货最终现货与盈亏曲线";
          }),
        {
          complete: false,
          missing:
            "旧统计/曲线无残留必须补底层记录oracle；只读到最终筛选不能视为完整数据覆盖",
        },
      ),
    ],
  },
  {
    id: "PERPS-DESKTOP-PORTFOLIO-013",
    name: "Desktop 投资组合 §13 资金费视图",
    rows: [
      row(
        "D09-196,D09-199,D09-210",
        "资金费分布/统计互斥与切回无残留",
        (p) =>
          withPortfolio(p, async () => {
            await chooseChart(p, "资金费");
            assert.equal(
              await locator(p, "perps.portfolio.pnl_type").count(),
              0,
            );
            for (const name of ["累计收取", "累计支付"])
              assert.equal(
                await scope(p).getByText(name, { exact: true }).count(),
                1,
              );
            for (const name of [
              "胜率",
              "账户健康",
              "未实现盈亏",
              "总盈亏",
              "当前持仓",
            ])
              assert.equal(
                await scope(p).getByText(name, { exact: true }).count(),
                0,
              );
            for (const name of ["24小时净额", "7天净额", "累计净额"])
              assert.equal(
                await scope(p).getByText(name, { exact: true }).count(),
                1,
              );
            for (const name of ["账户资产", "可用"])
              assert.equal(
                await scope(p).getByText(name, { exact: true }).count(),
                1,
              );
            for (const label of ["盈亏", "净值"]) {
              await chooseChart(p, label);
              for (const name of ["累计收取", "累计支付", "24小时净额"])
                assert.equal(
                  await scope(p).getByText(name, { exact: true }).count(),
                  0,
                );
              for (const name of ["胜率", "未实现盈亏", "总盈亏", "当前持仓"])
                assert.equal(
                  await scope(p).getByText(name, { exact: true }).count(),
                  1,
                );
              assert.equal(
                await locator(p, "perps.portfolio.pnl_type").count(),
                label === "盈亏" ? 1 : 0,
              );
            }
            return "资金费独有汇总/分布与交易统计互斥，切回两曲线无残留，账户资产区保留";
          }),
        {
          complete: false,
          missing:
            "资金费柱/日期美元轴及账户资产数值不变仍需追加核对；当前只核对真实区块切换",
        },
      ),
      row(
        "D09-224,D09-225,D09-230",
        "资金费桶数、宽度档及固定Y轴",
        (p) =>
          withPortfolio(p, async () => {
            await chooseChart(p, "资金费");
            const result = [];
            for (const [label, value] of periods) {
              await choosePeriod(p, label, value);
              if (
                await scope(p)
                  .getByText("暂无资金费记录", { exact: true })
                  .count()
              )
                throw new SampleUnavailable(
                  `当前${label}无资金费记录；已实现源码受控桶数/宽度fixture，实机需该维度记录`,
                );
              const s = await seriesReady(p, "histogram");
              const limit = value === "day" ? 24 : value === "week" ? 7 : 30;
              assert.ok(s.data.length <= limit);
              const active = s.data.filter(([, v]) => v !== 0).length,
                ratio =
                  s.data.length <= 7 || active <= 2
                    ? 0.45
                    : s.data.length <= 24 || active <= 5
                      ? 0.4
                      : 0.35;
              assert.equal(s.histogram.barWidthRatio, ratio);
              assert.equal(s.axisWidth, 64);
              assert.equal(s.reference.price, 0);
              result.push({ value, buckets: s.data.length, active, ratio });
            }
            return JSON.stringify(result);
          }),
        {
          complete: false,
          missing:
            "全部起点需首笔原始记录独立比对；固定Y轴配置已核对，实际像素左右位移仍需测量",
        },
      ),
      row("D09-208", "资金费柱左右边缘 Tooltip", (p) =>
        withPortfolio(p, async () => {
          await chooseChart(p, "资金费");
          if (
            await scope(p).getByText("暂无资金费记录", { exact: true }).count()
          )
            throw new SampleUnavailable("当前维度无柱图可悬停；需资金费记录");
          const tips = [];
          for (const x of [0.01, 0.5, 0.99])
            tips.push(await hoverPortfolioChart(p, x, "净资金费"));
          return JSON.stringify(tips);
        }),
      ),
    ],
  },
];
export const portfolioBoundarySuite = createDesktopRowSuite(
  portfolioBoundaryDefinitions,
);
