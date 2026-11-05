// D12 手动用例：docs/qa/testcases/cases/perps/2026-07-01_Perps-画线下单.md
// D12 §4: actual TradingView preview edits preserve existing chart drawings
// and the main order form. Never create, modify or delete a user drawing.
import assert from "node:assert/strict";
import { locator, typeInput } from "../../helpers/perps-ui.mjs";
import { desktopTvEval } from "../../helpers/perps-chart-eval.mjs";
import {
  withTradingViewChart,
  openTradingViewLimit,
} from "./trading-view-order-preview.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import {
  chooseMode,
  priceInput,
  snapshotNonOrderForm,
  closeDialog,
  closePop,
} from "./non-order-ui.mjs";
import { recordBeforeRestore } from "./restore-diagnostics.mjs";
import { markRestoreFailure } from "./runtime.mjs";

async function drawings(p) {
  let timer;
  try {
    return await Promise.race([
      desktopTvEval(
        p,
        `const chart=doc.defaultView.tradingViewApi.activeChart();return chart.getAllShapes().map(s=>{const shape=chart.getShapeById(s.id);return {id:s.id,name:s.name,points:shape.getPoints(),properties:shape.getProperties()};}).sort((a,b)=>String(a.id).localeCompare(String(b.id)));`,
      ),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(Error("Drawing snapshot timed out")),
          5000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export const chartIsolationDefinitions = [
  {
    id: "PERPS-DESKTOP-CHART-ISOLATION-001",
    name: "图表预览与已有画线和主表单隔离",
    rows: [
      {
        ids: ["D12-98"],
        name: "编辑实际TV限价面板并关闭，逐图核对完整几何样式及主表单",
        check: (p) =>
          withTradingViewChart(p, async () => {
            const beforeDrawings = await drawings(p);
            if (!beforeDrawings.some((s) => s.name !== "text"))
              throw new SampleUnavailable(
                "当前TradingView没有已有非文字画线，不将价格文字叠加层当作用户画线，不新建或删除用户图形",
              );
            await chooseMode(p, "限价单");
            await typeInput(await priceInput(p, "价格"), "12345");
            await typeInput(locator(p, "perps.form.size"), "12");
            const beforeForm = await snapshotNonOrderForm(p);
            let primary;
            try {
              await openTradingViewLimit(p);
              const d = p.getByRole("dialog").filter({ visible: true });
              await typeInput(locator(d, "perps.chart_order.price"), "23456");
              await typeInput(locator(d, "perps.chart_order.size"), "23");
              assert.equal(
                await locator(d, "perps.chart_order.price").inputValue(),
                "23456",
              );
              assert.equal(
                await locator(d, "perps.chart_order.size").inputValue(),
                "23",
              );
              await closeDialog(p);
              assert.equal(await d.count(), 0);
              assert.deepEqual(
                await snapshotNonOrderForm(p),
                beforeForm,
                "Main form including both price and size stays unchanged",
              );
              assert.deepEqual(
                await drawings(p),
                beforeDrawings,
                "All existing TradingView drawing IDs, points and properties stay unchanged",
              );
              return `实际TV限价预览23456/23关闭；主表单12345/12及所有草稿一致，${beforeDrawings.length}个已有图形的ID/类型/点位/完整样式逐项相同，未动用户画线`;
            } catch (e) {
              primary = e;
              await recordBeforeRestore(p, "chart-isolation", e);
              throw e;
            } finally {
              try {
                await closePop(p);
                await closeDialog(p);
                assert.deepEqual(
                  await drawings(p),
                  beforeDrawings,
                  "Existing drawings unchanged during preview cleanup",
                );
              } catch (e) {
                throw markRestoreFailure(
                  primary,
                  e,
                  "核对已有TradingView画线保留",
                );
              }
            }
          }),
      },
    ],
  },
];
export const chartIsolationSuite = createDesktopRowSuite(
  chartIsolationDefinitions,
);
