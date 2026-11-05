// D12 手动用例：docs/qa/testcases/cases/perps/2026-07-01_Perps-画线下单.md
// Actual right-click menu and limit preview only. No order/approval action.
import assert from "node:assert/strict";
import { locator, typeInput, currentPair } from "../../helpers/perps-ui.mjs";
import { recordBeforeRestore } from "./restore-diagnostics.mjs";
import { markRestoreFailure } from "./runtime.mjs";
import { projectReactAll } from "./react-projection.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import { snapshotFinancialState } from "./order-observation.mjs";
import { waitInstrumentBoundary } from "./instrument-readiness.mjs";
import { withNativeChart } from "./desktop-native-boundaries.mjs";
import {
  withTradingViewChart,
  openTradingViewLimit as openLimit,
} from "./trading-view-order-preview.mjs";
import {
  chooseMode,
  priceInput,
  closePop,
  closeDialog,
  pollForm,
  snapshotNonOrderForm,
} from "./non-order-ui.mjs";
const dialogs = (p) => p.getByRole("dialog").filter({ visible: true });
const loc = (p, key) => locator(p, "perps.chart_order." + key);
async function openMenu(p, fraction = 0.5) {
  const canvas = locator(p, "perps.chart.native_canvas");
  await canvas.waitFor({ state: "visible", timeout: 30000 });
  const readLayouts = async () => {
    const [result] = await projectReactAll(canvas, (f) => {
      const results = [];
      for (; f; f = f.return) {
        for (let h = f.memoizedState, n = 0; h && n < 4096; h = h.next, n++) {
          const v = h.memoizedState?.current?.layout;
          if (
            v &&
            Number.isFinite(v.minPrice) &&
            Number.isFinite(v.maxPrice) &&
            v.priceChartHeight > 0 &&
            v.priceAxisX > 0
          )
            results.push({
              minPrice: v.minPrice,
              maxPrice: v.maxPrice,
              height: v.priceChartHeight,
              axisX: v.priceAxisX,
            });
        }
      }
      return results;
    });
    return result;
  };
  const layouts = await pollForm(
    readLayouts,
    (s) => s.length > 0,
    "Native rendered price projection",
    30000,
  );
  assert.ok(layouts.length, "Actual rendered price projection required");
  const layout = layouts[0];
  assert.ok(layout.maxPrice > layout.minPrice && layout.minPrice > 0);
  const box = await canvas.boundingBox();
  assert.ok(box);
  await canvas.click({
    button: "right",
    position: {
      x: Math.min(layout.axisX / 2, box.width / 2),
      y: 24 + layout.height * fraction,
    },
  });
  await loc(p, "limit").waitFor({ state: "visible" });
  const label = (await loc(p, "limit").innerText()).trim();
  const match = label.match(/@\s*([\d,.]+)\s*限价/u);
  assert.ok(match, `Visible limit menu price: ${label}`);
  const selected = match[1].replaceAll(",", "");
  assert.ok(Number(selected) > 0);
  return { selected, label };
}
async function preview(p, check, engine = "native") {
  const withEngine =
    engine === "TradingView" ? withTradingViewChart : withNativeChart;
  return withEngine(p, async () => {
    let primary;
    try {
      return await check();
    } catch (e) {
      primary = e;
      await recordBeforeRestore(p, "chart-order", e);
      throw e;
    } finally {
      try {
        await closePop(p);
        await closeDialog(p);
      } catch (e) {
        throw markRestoreFailure(primary, e, "关闭图表限价弹窗");
      }
    }
  });
}
export const chartOrderDefinitions = [
  {
    id: "PERPS-DESKTOP-CHART-ORDER-001",
    name: "图表限价弹窗非下单流程",
    rows: [
      {
        ids: ["D12-44", "D12-47", "D12-53", "D12-56"],
        name: "真实菜单价格预填、BBO往返、关闭及主表单隔离",
        check: (p) =>
          preview(
            p,
            async () => {
              await chooseMode(p, "限价单");
              await typeInput(await priceInput(p, "价格"), "12345");
              await typeInput(locator(p, "perps.form.size"), "12");
              const before = await snapshotNonOrderForm(p),
                { selected } = await openLimit(p),
                dialog = dialogs(p);
              assert.match(await dialog.innerText(), /限价单\s*·\s*BTC/u);
              assert.equal(
                await loc(p, "price").inputValue(),
                selected,
                "Selected menu price prefilled exactly",
              );
              assert.equal(
                await dialog.getByText("Mid", { exact: true }).count(),
                0,
                "No Mid action in chart limit dialog",
              );
              const toggle = dialog.getByText("最优价", { exact: true });
              assert.equal(await toggle.count(), 1);
              await toggle.click();
              await loc(p, "price").waitFor({ state: "hidden" });
              const selector = dialog
                .locator('[data-testid="select-trigger"]')
                .filter({ hasText: "对手价 1" });
              assert.equal(await selector.count(), 1);
              await selector.click();
              const pop = locator(p, "perps.overlay.popover");
              const labels = (await pop.innerText())
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean);
              assert.deepEqual(labels, [
                "对手价 1",
                "对手价 5",
                "同向价 1",
                "同向价 5",
              ]);
              await closePop(p);
              await toggle.click();
              await loc(p, "price").waitFor({ state: "visible" });
              assert.equal(
                await loc(p, "price").inputValue(),
                selected,
                "Disabling BBO restores original chart price",
              );
              await typeInput(loc(p, "price"), "12346");
              await typeInput(loc(p, "size"), "3");
              await closeDialog(p);
              assert.equal(await dialogs(p).count(), 0);
              await p
                .locator("webview")
                .filter({ visible: true })
                .click({ trial: true, position: { x: 100, y: 100 } });
              assert.equal(
                await locator(p, "perps.overlay.popover").count(),
                0,
              );
              assert.deepEqual(
                await snapshotNonOrderForm(p),
                before,
                "Dialog edits must not contaminate main order form",
              );
              return `真实右键菜单${selected}预填，BBO四选项与价格恢复，价格/数量编辑后关闭；主表单12345/12及所有草稿独立一致，无弹窗残留，入口已通过真实TradingView右键菜单`;
            },
            "TradingView",
          ),
      },
    ],
  },
  {
    id: "PERPS-DESKTOP-CHART-ORDER-002",
    name: "原生图持仓止盈止损菜单预览",
    rows: [
      {
        ids: ["D12-106"],
        name: "实际多仓上下价位的互斥菜单与对应字段预填",
        complete: false,
        missing:
          "已实现当前持仓方向两种价位；另一持仓方向需真实已有样本，未开仓构造。",
        check: (p) =>
          preview(p, async () => {
            const state = await waitInstrumentBoundary(
              p,
              await currentPair(p),
              locator(p, "perps.form.root"),
            );
            const coin = state.instruments[0].coin;
            const financial = await snapshotFinancialState(p);
            const position = financial.positions.find((r) => r.coin === coin);
            if (!position || !Number(position.size))
              throw new SampleUnavailable("当前市场没有已有持仓，未新建持仓");
            const seen = [];
            for (const fraction of [0.05, 0.95]) {
              const response = await fetch("https://api.hyperliquid.xyz/info", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "allMids" }),
                signal: AbortSignal.timeout(15000),
              });
              assert.equal(response.status, 200);
              const mid = Number((await response.json())[coin]);
              assert.ok(mid > 0);
              const { selected } = await openMenu(p, fraction);
              // Sample far from the mid. Drift into the boundary is missing data,
              // never an alternate assertion that would accept either menu.
              if (Math.abs(Number(selected) / mid - 1) < 0.001)
                throw new SampleUnavailable(
                  "所选价位距独立中间价不足0.1%，不作方向判定",
                );
              const kind =
                Number(selected) > mid === Number(position.size) > 0
                  ? "take_profit"
                  : "stop_loss";
              const other =
                kind === "take_profit" ? "stop_loss" : "take_profit";
              assert.equal(await loc(p, "limit").count(), 1);
              assert.equal(
                await loc(p, kind).count(),
                1,
                "Exactly the expected position action",
              );
              assert.equal(
                await loc(p, other).count(),
                0,
                "Opposite position action absent",
              );
              const label = await loc(p, kind).innerText();
              assert.ok(
                label.replaceAll(",", "").includes(selected),
                "Both menu actions use the same selected price",
              );
              await loc(p, kind).click();
              const dialog = dialogs(p);
              await dialog.waitFor({ state: "visible" });
              assert.equal(
                await dialog
                  .getByText("仓位止盈/止损", { exact: true })
                  .count(),
                1,
              );
              assert.equal(
                await dialog
                  .getByText("设置触发止盈或止损订单的价格", { exact: true })
                  .count(),
                1,
              );
              const input = kind === "take_profit" ? "tp_price" : "sl_price";
              assert.equal(
                await loc(p, input).inputValue(),
                selected,
                "Corresponding leg receives exactly the selected price",
              );
              await closeDialog(p);
              assert.equal(await dialogs(p).count(), 0);
              seen.push(kind);
            }
            assert.deepEqual([...new Set(seen)].sort(), [
              "stop_loss",
              "take_profit",
            ]);
            return `${coin}已有${Number(position.size) > 0 ? "多" : "空"}仓；独立公开中间价判定两侧菜单，限价保留、TP/SL互斥、对应价格精确预填及标题副标题；均仅关闭，未提交`;
          }),
      },
    ],
  },
];
export const chartOrderSuite = createDesktopRowSuite(chartOrderDefinitions);
