// D12 手动用例：docs/qa/testcases/cases/perps/2026-07-01_Perps-画线下单.md
// Existing position TP/SL preview. Never click confirm, authorize or cancel an
// existing exchange order. Independent public account state supplies estimates.
import assert from "node:assert/strict";
import { locator, typeInput, currentPair, restorePair } from "../../helpers/perps-ui.mjs";
import {
  withTradingViewChart,
  openTradingViewTpsl,
} from "./trading-view-order-preview.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import { snapshotFinancialState } from "./order-observation.mjs";
import { waitInstrumentBoundary } from "./instrument-readiness.mjs";
import { pollForm, closeDialog, closePop } from "./non-order-ui.mjs";
import { expectedPositionTp, selectPreviewPosition } from "./position-tpsl-evidence.mjs";
import { recordBeforeRestore } from "./restore-diagnostics.mjs";
import { markRestoreFailure } from "./runtime.mjs";
const dialog = (p) => p.getByRole("dialog").filter({ visible: true });
const ui = (p, key) => locator(p, "perps.chart_order." + key);
async function position(p) {
  let instrument = await waitInstrumentBoundary(
    p,
    await currentPair(p),
    locator(p, "perps.form.root"),
  );
  const observed = await snapshotFinancialState(p),
    existing = selectPreviewPosition(observed.positions, instrument.instruments[0].coin);
  if (!existing || !Number(existing.size))
    throw new SampleUnavailable("当前市场无持仓且无可唯一选择的既有原生持仓；不猜DEX身份、不新建订单");
  if (existing.coin !== instrument.instruments[0].coin) {
    await restorePair(p, `${existing.coin}USDC`);
    instrument = await waitInstrumentBoundary(p, await currentPair(p), locator(p, "perps.form.root"));
  }
  const coin = instrument.instruments[0].coin;
  assert.equal(coin, existing.coin, "Selected preview market matches existing position identity");
  const response = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "clearinghouseState",
      user: observed.account,
      ...(coin.includes(":") ? { dex: coin.split(":")[0] } : {}),
    }),
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(response.status, 200);
  const pos = (await response.json()).assetPositions
    .map((r) => r.position)
    .find((r) => r.coin === coin);
  assert.ok(pos, "Independent public position required");
  assert.equal(pos.szi, existing.size);
  assert.equal(pos.entryPx, existing.entry);
  assert.ok(Number(pos.leverage?.value) > 0);
  return pos;
}
async function preview(p, fn) {
  // Set the existing-position market before initializing the chart; the outer
  // row transaction restores the original ticker/form even on sample failures.
  const pos = await position(p);
  return withTradingViewChart(p, async () => {
    let primary;
    try {
      const menu = await openTradingViewTpsl(p);
      return await fn(pos, menu);
    } catch (e) {
      primary = e;
      await recordBeforeRestore(p, "tpsl-preview", e);
      throw e;
    } finally {
      try {
        await closePop(p);
        await closeDialog(p);
        assert.equal(await dialog(p).count(), 0);
      } catch (e) {
        throw markRestoreFailure(primary, e, "关闭既有仓位止盈止损预览");
      }
    }
  });
}
export const tpslPreviewDefinitions = [
  {
    id: "PERPS-DESKTOP-TPSL-PREVIEW-001",
    name: "图表持仓止盈止损非下单预览",
    rows: [
      {
        ids: ["D12-84"],
        name: "TradingView持仓止盈入口、标题副标题与准确预填",
        check: (p) =>
          preview(p, async (pos, { selected }) => {
            const d = dialog(p);
            assert.equal(
              await d.getByText("仓位止盈/止损", { exact: true }).count(),
              1,
            );
            assert.equal(
              await d
                .getByText("设置触发止盈或止损订单的价格", { exact: true })
                .count(),
              1,
            );
            assert.equal(await ui(p, "tp_price").inputValue(), selected);
            assert.equal(
              await d.getByText(pos.coin, { exact: true }).count(),
              1,
            );
            return `${pos.coin}实际TV止盈菜单${selected}，对应标题、副标题及止盈字段准确预填`;
          }),
      },
      {
        ids: ["D12-85"],
        name: "资产仓位价格、双侧价格百分比及部分仓位和确认按钮",
        check: (p) =>
          preview(p, async (pos) => {
            const d = dialog(p);
            for (const label of [
              "资产",
              "仓位",
              "开仓价格",
              "标记价格",
              "预期利润:",
              "预期损失:",
              "部分仓位",
            ])
              assert.equal(
                await d.getByText(label, { exact: true }).count(),
                1,
                `Unique ${label}`,
              );
            assert.equal(
              await d.getByText(pos.coin, { exact: true }).count(),
              1,
            );
            const text = (await d.innerText()).replaceAll(",", "");
            assert.ok(
              text.includes(
                Math.abs(Number(pos.szi)).toString() + " " + pos.coin,
              ),
            );
            assert.ok(text.includes(String(Number(pos.entryPx))));
            for (const key of [
              "tp_price",
              "sl_price",
              "tp_percent",
              "sl_percent",
            ])
              assert.equal(await ui(p, key).count(), 1);
            assert.equal(await locator(d, "perps.perp-checkbox").count(), 1);
            const guard = locator(d, "perps.perp-is-disabled-btn");
            if (await guard.count())
              throw new SampleUnavailable(
                "当前Agent门禁替换确认订单按钮，字段已检查；不点击启用交易",
              );
            assert.equal(
              await locator(d, "perps.perp-processed-value-btn")
                .getByText("确认订单", { exact: true })
                .count(),
              1,
            );
            return `${pos.coin}资产/仓位/开仓与标记价、TP/SL价格百分比、预期盈亏、部分仓位和确认入口逐项核对，未点击提交`;
          }),
      },
      {
        ids: ["D12-86"],
        name: "修改多仓止盈价、百分比和预期利润独立算术对账",
        check: (p) =>
          preview(p, async (pos) => {
            if (Number(pos.szi) <= 0)
              throw new SampleUnavailable("本行要求既有多仓，当前方向不匹配");
            const samples = [];
            for (const delta of [1000, 2000]) {
              const exit = String(Math.ceil(Number(pos.entryPx)) + delta),
                expected = expectedPositionTp({
                  entry: pos.entryPx,
                  exit,
                  size: pos.szi,
                  leverage: String(pos.leverage.value),
                });
              await typeInput(ui(p, "tp_price"), exit);
              await pollForm(
                () => ui(p, "tp_percent").inputValue(),
                (v) => v === expected.percent,
                "TP percentage vs public position oracle",
              );
              const profit = dialog(p).getByText(
                `预期利润: ${expected.profit}`,
                { exact: true },
              );
              await profit.waitFor({ state: "visible" });
              assert.equal(await profit.count(), 1);
              assert.ok(Number(exit) > Number(pos.entryPx));
              assert.ok(!expected.profit.startsWith("-"));
              samples.push(`${exit}→${expected.percent}%/${expected.profit}`);
            }
            return `公开账户持仓size=${pos.szi}、entry=${pos.entryPx}、leverage=${pos.leverage.value}；BigInt独立计算：${samples.join("；")}，均未提交`;
          }),
      },
    ],
  },
];
export const tpslPreviewSuite = createDesktopRowSuite(tpslPreviewDefinitions);
