// D04 手动用例：docs/qa/testcases/cases/perps/2026-01-21_Perps-TV图表功能与设置.md
// Desktop TradingView: real indicator-menu clicks, read-only chart model oracle.
// Preserve the existing study set and engine; never create/modify orders.
import assert from "node:assert/strict";
import { locator, setChartMode } from "../../helpers/perps-ui.mjs";
import { desktopTvEval } from "../../helpers/perps-chart-eval.mjs";
import { projectReactAll } from "./react-projection.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import { closePop, pollForm } from "./non-order-ui.mjs";
import { markRestoreFailure } from "./runtime.mjs";
import { recordBeforeRestore } from "./restore-diagnostics.mjs";
const models = {
  MA: "Moving Average",
  EMA: "Moving Average Exponential",
  BOLL: "Bollinger Bands",
  SAR: "Parabolic SAR",
  VOL: "Volume",
  MACD: "MACD",
  RSI: "Relative Strength Index",
};
const items = (p) => locator(p, "perps.chart.indicator_items");
const panel = (p) =>
  locator(p, "perps.overlay.popover").filter({ has: items(p) });
const row = (ids, name, check, extra = {}) => ({
  ids: ids.split(","),
  name,
  check,
  ...extra,
});
async function studies(p) {
  return desktopTvEval(
    p,
    `const c=doc.defaultView.tradingViewApi?.activeChart();if(!c)throw Error('Chart model not ready');return c.getAllStudies().map(s=>({name:s.name,inputs:c.getStudyById(s.id).getInputValues()}));`,
  );
}
const sorted = (s) => s.map((r) => JSON.stringify(r)).sort();
async function openIndicators(p) {
  if (await panel(p).count()) return;
  const trigger = locator(p, "perps.chart.indicator_trigger");
  await trigger.hover();
  await p.waitForTimeout(400);
  await trigger.click();
  await panel(p).waitFor({ state: "visible" });
}
async function selected(p) {
  await openIndicators(p);
  const states = await projectReactAll(items(p), (f, e) => {
    for (; f; f = f.return) {
      const props = f.memoizedProps;
      if (props?.indicator && typeof props.isActive === "boolean" && typeof props.isDisabled === "boolean") {
        const style = getComputedStyle(e);
        const transparent = style.borderTopColor === "transparent" || /rgba\([^)]*,\s*0(?:\.0+)?\)$/u.test(style.borderTopColor);
        return {label: e.innerText.trim(), value: props.indicator.value, checked: props.isActive, disabled: props.isDisabled,
          painted: !transparent && parseFloat(style.borderTopWidth) >= 1};
      }
    }
    throw Error("Committed indicator pill state required");
  });
  assert.ok(states.length > 0, "Visible indicator states required");
  for (const state of states) assert.equal(state.painted, state.checked && !state.disabled, `${state.label} actual border must match selected state`);
  return states;
}
async function setSelected(p, label, want) {
  const before = await selected(p),
    current = before.filter((r) => r.label === label);
  assert.equal(current.length, 1, `Unique indicator ${label}`);
  if (current[0].checked !== want)
    await items(p)
      .filter({ has: p.getByText(label, { exact: true }) })
      .click();
  await pollForm(
    () => selected(p),
    (s) => s.find((r) => r.label === label)?.checked === want,
    `Indicator ${label} check=${want}`,
  );
}
async function withChart(p, check) {
  await closePop(p);
  const engine = (await locator(p, "perps.chart.engine").innerText()).includes(
    "TradingView",
  )
    ? "tradingView"
    : "original";
  let before, primary;
  try {
    await setChartMode(p, "tradingView");
    await pollForm(
      () => studies(p),
      (s) => Array.isArray(s),
      "TradingView ready",
      30000,
    );
    before = await studies(p);
    return await check(before);
  } catch (e) {
    primary = e;
    await recordBeforeRestore(p, "chart-boundary", e);
    throw e;
  } finally {
    try {
      await closePop(p);
      if (before)
        assert.deepEqual(
          sorted(await studies(p)),
          sorted(before),
          "Original studies and parameters restored",
        );
      await setChartMode(p, engine);
      assert.equal(
        (await locator(p, "perps.chart.engine").innerText()).includes(
          "TradingView",
        ),
        engine === "tradingView",
      );
    } catch (e) {
      throw markRestoreFailure(primary, e, "恢复图表指标及引擎");
    }
  }
}
async function withSelectionFixture(p, check) {
  const before = await selected(p);
  if (before.find((r) => r.label === "EMA")?.checked)
    throw new SampleUnavailable("当前用户EMA已启用；需要EMA未选中的图表样本，避免删除后重建丢失原参数/样式");
  try {
    await setSelected(p, "MA", true);
    await setSelected(p, "MACD", true);
    await setSelected(p, "EMA", false);
    await closePop(p);
    await pollForm(() => studies(p), s => s.some(v => v.name === models.MA) && s.some(v => v.name === models.MACD) && !s.some(v => v.name === models.EMA), "Exact MA/MACD fixture model");
    return await check();
  } finally {
    for (const label of ["MA", "MACD", "EMA"])
      await setSelected(p, label, before.find(r => r.label === label).checked);
    await closePop(p);
  }
}
async function modelSelection(p) {
  const actual = await studies(p),
    options = await selected(p);
  for (const [label, name] of Object.entries(models)) {
    const matches = options.filter((r) => r.label === label);
    assert.equal(matches.length, 1, `${label} listed once`);
    assert.equal(
      matches[0].checked,
      actual.some((r) => r.name === name),
      `${label} check must match independently read chart model`,
    );
  }
  return options;
}
export const chartBoundaryDefinitions = [
  {
    id: "PERPS-DESKTOP-CHART-BOUNDARY-001",
    name: "Desktop 统一指标面板与真实图表模型对账",
    rows: [
      row("D04-47", "主副图分类、全部七指标及无旧版星形入口", (p) =>
        withChart(p, async () => {
          await openIndicators(p);
          const text = await panel(p).innerText();
          assert.match(text, /主图指标/u);
          assert.match(text, /副图指标/u);
          const actual = await selected(p);
          for (const label of Object.keys(models))
            assert.equal(actual.filter((r) => r.label === label).length, 1);
          const mainBox = await panel(p).getByText("主图指标", { exact: true }).boundingBox();
          const subBox = await panel(p).getByText("副图指标", { exact: true }).boundingBox();
          assert.ok(mainBox && subBox && mainBox.y < subBox.y, "Visible classification headings in order");
          for (const label of Object.keys(models)) {
            const box = await items(p).filter({ has: p.getByText(label, {exact:true}) }).boundingBox();
            assert.ok(box && box.height > 0, `${label} visible`);
            if (["MA", "EMA", "BOLL", "SAR"].includes(label)) assert.ok(box.y > mainBox.y && box.y + box.height <= subBox.y, `${label} under main heading`);
            else assert.ok(box.y > subBox.y, `${label} under sub heading`);
          }
          assert.equal(
            await panel(p)
              .locator('svg[data-sentry-component*="Star"]')
              .count(),
            0,
          );
          return "MA/EMA/BOLL/SAR及VOL/MACD/RSI各出现一次，两个分类可见，无星形收藏";
        }),
      ),
      row("D04-48", "MA/MACD选中、EMA未选中，与真实study集合逐项一致", (p) =>
        withChart(p, async () => {
          return withSelectionFixture(p, async () => {
            await modelSelection(p);
            return "真实菜单选中MA/MACD、EMA未选中；全部七项边框及选中态与TradingView实际study集合一致";
          });
        }),
      ),
      row("D04-49", "关面板重开保持原指标与全部参数", (p) =>
        withChart(p, async () => {
          return withSelectionFixture(p, async () => {
            const before = await modelSelection(p), model = await studies(p);
            await closePop(p);
            assert.deepEqual(sorted(await studies(p)), sorted(model));
            assert.deepEqual(await modelSelection(p), before);
            assert.deepEqual(sorted(await studies(p)), sorted(model));
            return "独立准备MA/MACD，关闭与重开各读取菜单选中态、study名称及输入参数，均与基线一致";
          });
        }),
      ),
    ],
  },
];
export const chartBoundarySuite = createDesktopRowSuite(
  chartBoundaryDefinitions,
);
