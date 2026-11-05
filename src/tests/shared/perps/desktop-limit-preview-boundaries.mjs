// D12 手动用例：docs/qa/testcases/cases/perps/2026-07-01_Perps-画线下单.md
// Complete Desktop limit preview fields and actual hover help; no order click.
import assert from "node:assert/strict";
import { locator, restorePair } from "../../helpers/perps-ui.mjs";
import {
  withTradingViewChart,
  openTradingViewLimit,
} from "./trading-view-order-preview.mjs";
import { createDesktopRowSuite } from "./desktop-row-suite.mjs";
import {
  chooseMode,
  formRoot,
  closeDialog,
  closePop,
} from "./non-order-ui.mjs";
import { recordBeforeRestore } from "./restore-diagnostics.mjs";
import { markRestoreFailure } from "./runtime.mjs";
const dialog = (p) => p.getByRole("dialog").filter({ visible: true });
const description =
  "限价单是指仅按你设定的价格或更优价格成交，但不保证一定成交。";
export async function withLimitPreview(p, fn) {
  // These permanent field/empty-input fixtures explicitly use BTC. The outer
  // row transaction restores the originally selected market and its drafts.
  await restorePair(p, "BTCUSDC");
  return withTradingViewChart(p, async () => {
    let primary;
    try {
      return await fn();
    } catch (e) {
      primary = e;
      await recordBeforeRestore(p, "limit-fields", e);
      throw e;
    } finally {
      try {
        await p.mouse.move(2, 2);
        await closePop(p);
        await closeDialog(p);
        assert.equal(await dialog(p).count(), 0);
      } catch (e) {
        throw markRestoreFailure(primary, e, "关闭限价字段预览");
      }
    }
  });
}
export const limitPreviewDefinitions = [
  {
    id: "PERPS-DESKTOP-LIMIT-PREVIEW-001",
    name: "图表限价面板字段与说明",
    rows: [
      {
        ids: ["D12-45"],
        name: "余额仓位、价格数量滑杆、两开关TIF和双侧成本强平价",
        check: (p) =>
          withLimitPreview(p, async () => {
            await openTradingViewLimit(p);
            const d = dialog(p);
            const labels = [
              "可用余额",
              "当前持仓",
              "价格",
              "最优价",
              "数量",
              "只减仓",
              "止盈/止损",
              "TIF",
              "GTC",
            ];
            const boxes = {};
            for (const label of labels) {
              const element = d.getByText(label, { exact: true });
              assert.equal(await element.count(), 1, label);
              boxes[label] = await element.boundingBox();
              assert.ok(boxes[label]);
            }
            const price = locator(p, "perps.chart_order.price"),
              size = locator(p, "perps.chart_order.size");
            assert.equal(await price.count(), 1);
            assert.equal(await size.count(), 1);
            const slider = d.getByRole("slider");
            assert.equal(await slider.count(), 1);
            assert.equal(await slider.getAttribute("aria-valuemin"), "0");
            assert.equal(await slider.getAttribute("aria-valuemax"), "100");
            const pb = await price.boundingBox(),
              sb = await size.boundingBox(),
              slb = await slider.boundingBox();
            assert.ok(
              boxes["可用余额"].y < boxes["当前持仓"].y &&
                boxes["当前持仓"].y < pb.y,
            );
            assert.ok(pb.y < sb.y && sb.y < slb.y && slb.y < boxes["只减仓"].y);
            for (const [key, label] of [
              ["limit_long", "买入 / 做多"],
              ["limit_short", "卖出 / 做空"],
            ]) {
              const b = locator(d, "perps.chart_order." + key);
              assert.equal(await b.count(), 1);
              assert.equal((await b.innerText()).trim(), label);
            }
            for (const label of ["成本", "预估强平价"])
              assert.equal(
                await d.getByText(label, { exact: true }).count(),
                2,
              );
            assert.equal(
              await locator(d, "perps.chart_order.reduce").count(),
              1,
            );
            assert.equal(await locator(d, "perps.chart_order.tpsl").count(), 1);
            const t = (await d.innerText()).replaceAll(",", "");
            assert.match(t, /可用余额\s+\$\d+(?:\.\d+)?/u);
            assert.match(t, /当前持仓\s+-?\d+(?:\.\d+)? BTC/u);
            return "实际TV限价弹窗逐项核对全部字段、0–100%滑杆、纵向顺序、只减仓/止盈止损、GTC和双侧按钮/成本/强平价；未提交";
          }),
      },
      {
        ids: ["D12-46"],
        name: "实际悬停标题说明，与主限价面板逐字一致",
        check: (p) =>
          withLimitPreview(p, async () => {
            await chooseMode(p, "限价单");
            const help = p
              .getByText(description, { exact: false })
              .filter({ visible: true });
            const main = locator(formRoot(p), "perps.chart_order.info");
            assert.equal(await main.count(), 1);
            await main.hover();
            await help.waitFor({ state: "visible" });
            assert.equal(await help.count(), 1);
            assert.equal((await help.evaluate(e => [...e.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join(''))).trim(), description);
            assert.equal(await help.getByText('了解更多', {exact:true}).count(), 1);
            const expected = await help.innerText();
            await p.mouse.move(2, 2);
            await help.waitFor({ state: "hidden" });
            await openTradingViewLimit(p);
            const info = locator(dialog(p), "perps.chart_order.info");
            assert.equal(await info.count(), 1);
            await info.hover();
            await help.waitFor({ state: "visible" });
            assert.equal(await help.count(), 1);
            assert.equal((await help.evaluate(e => [...e.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join(''))).trim(), description);
            assert.equal(await help.getByText('了解更多', {exact:true}).count(), 1);
            assert.equal(await help.innerText(), expected);
            await p.mouse.move(2, 2);
            await help.waitFor({ state: "hidden" });
            return "主限价说明与图表弹窗标题图标均真实悬停，完整说明逐字一致，退出悬停后隐藏";
          }),
      },
    ],
  },
];
export const limitPreviewSuite = createDesktopRowSuite(limitPreviewDefinitions);
