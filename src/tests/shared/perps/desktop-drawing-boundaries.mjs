// D04 手动用例：docs/qa/testcases/cases/perps/2026-01-21_Perps-TV图表功能与设置.md
// Native drawing lifecycle through real toolbar and pointer input. Never touch
// pre-existing drawings: identify our own new object before deleting it.
import assert from "node:assert/strict";
import { locator } from "../../helpers/perps-ui.mjs";
import { projectReactAll } from "./react-projection.mjs";
import { withNativeChart } from "./desktop-native-boundaries.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import { pollForm, closePop } from "./non-order-ui.mjs";
import { recordBeforeRestore } from "./restore-diagnostics.mjs";
import { markRestoreFailure } from "./runtime.mjs";
const canvas = (p) => locator(p, "perps.chart.native_canvas");
async function state(p) {
  const results = (
    await projectReactAll(canvas(p), (f) => {
      const values = [];
      for (; f; f = f.return)
        for (let h = f.memoizedState, n = 0; h && n < 4096; h = h.next, n++) {
          const s = h.memoizedState?.current;
          if (
            s?.history?.present &&
            typeof s.tool === "string" &&
            typeof s.ready === "boolean"
          )
            values.push({
              drawings: s.history.present,
              tool: s.tool,
              ready: s.ready,
              selected: s.selectedId,
              draft: !!s.draft,
              hidden: s.hidden,
              locked: s.locked,
              stay: s.stayInDrawingMode,
            });
        }
      return values;
    })
  ).flat();
  assert.equal(results.length, 1, "One committed drawing model");
  return results[0];
}
// Sample the actual drawing segment pixels, using pointer locations rather
// than the product renderer's own geometry calculation as the paint oracle.
async function strokeSamples(p, a, b, color) {
  return canvas(p).evaluate(
    (e, { a, b, color }) => {
      const hex = color.replace(/^#/u, "");
      if (!/^[0-9a-f]{6}$/iu.test(hex))
        throw Error("Six-digit drawing color required");
      const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
      const rect = e.getBoundingClientRect(),
        sx = e.width / rect.width,
        sy = e.height / rect.height;
      const ctx = e.getContext("2d");
      let matched = 0;
      for (let n = 1; n <= 10; n++) {
        const t = n / 11,
          x = Math.round((a.x + (b.x - a.x) * t) * sx),
          y = Math.round((a.y + (b.y - a.y) * t) * sy),
          r = Math.ceil(4 * Math.max(sx, sy));
        const pixels = ctx.getImageData(
          Math.max(0, x - r),
          Math.max(0, y - r),
          r * 2 + 1,
          r * 2 + 1,
        ).data;
        let found = false;
        for (let j = 0; j < pixels.length; j += 4)
          if (
            pixels[j + 3] > 200 &&
            rgb.every((v, k) => Math.abs(v - pixels[j + k]) <= 16)
          ) {
            found = true;
            break;
          }
        if (found) matched++;
      }
      return matched;
    },
    { a, b, color },
  );
}
const sorted = (xs) => xs.map((x) => JSON.stringify(x)).sort();
async function removeOwned(p, id) {
  const actual = await state(p);
  if (!actual.drawings.some((x) => x.id === id)) return;
  assert.equal(
    actual.selected,
    id,
    "Refuse deletion unless our own drawing is selected",
  );
  const button = locator(p, "perps.chart.drawing_delete");
  assert.equal(
    await button.count(),
    1,
    "Unique selected-drawing delete action",
  );
  await button.click();
  await pollForm(
    () => state(p),
    (s) => !s.drawings.some((x) => x.id === id),
    "Only owned drawing removed",
  );
}
export const drawingDefinitions = [
  {
    id: "PERPS-DESKTOP-DRAWING-001",
    name: "原生图真实趋势线增删与原图形保护",
    rows: [
      {
        ids: ["D04-193"],
        name: "原生绘图工具、实际两点趋势线与单图删除",
        check: (p) =>
          withNativeChart(p, async () => {
            const before = await pollForm(
              () => state(p),
              (s) => s.ready,
              "Drawing state ready",
              30000,
            );
            if (
              before.tool !== "cursor" ||
              before.draft ||
              before.hidden ||
              before.locked ||
              before.stay ||
              before.selected
            )
              throw new SampleUnavailable(
                "原生图当前非空闲光标状态；保留用户绘图编辑，不擅自取消",
              );
            const toolbar = locator(p, "perps.chart.drawing_toolbar");
            await toolbar.waitFor({ state: "visible" });
            const trend = toolbar.getByRole("button", {
              name: "趋势线",
              exact: true,
            });
            if ((await trend.count()) !== 1)
              throw new SampleUnavailable(
                "当前线条工具组默认项不是趋势线；未覆盖现有用户工具偏好",
              );
            let ownId, primary;
            try {
              await trend.click();
              assert.equal(
                await canvas(p).getAttribute("data-drawing-tool"),
                "trend",
              );
              const box = await canvas(p).boundingBox();
              assert.ok(box.width > 300 && box.height > 150);
              const properties = await locator(
                p,
                "perps.chart.drawing_properties",
              ).boundingBox();
              assert.ok(properties, "Visible tool property bar");
              const firstY = Math.max(
                100,
                properties.y + properties.height - box.y + 40,
              );
              const a = { x: box.width * 0.3, y: firstY },
                b = { x: box.width * 0.55, y: firstY + 60 };
              assert.ok(
                b.y < box.height * 0.75,
                "Two points outside property bar and axes",
              );
              const baselineColors = new Map();
              for (const color of new Set(
                before.drawings.map((x) => x.color).concat(["#2962FF"]),
              ))
                baselineColors.set(color, await strokeSamples(p, a, b, color));
              await canvas(p).click({ position: a });
              await canvas(p).click({ position: b });
              const after = await pollForm(
                () => state(p),
                (s) => s.drawings.length === before.drawings.length + 1,
                "Exactly one new drawing committed",
              );
              const added = after.drawings.filter(
                (x) => !before.drawings.some((y) => y.id === x.id),
              );
              assert.equal(added.length, 1);
              ownId = added[0].id;
              const paintBefore = baselineColors.get(added[0].color);
              if (paintBefore === undefined)
                throw new SampleUnavailable(
                  "当前绘图工具颜色非已有图形或默认色，缺独立绘制前基线",
                );
              const painted = await pollForm(
                () => strokeSamples(p, a, b, added[0].color),
                (n) => n >= 8 && n >= paintBefore + 5,
                "Actual segment stroke pixels",
              );
              assert.ok(painted >= 8);
              assert.equal(added[0].tool, "trend");
              assert.equal(added[0].points.length, 2);
              for (const point of added[0].points) {
                assert.ok(Number.isFinite(point.time));
                assert.ok(Number.isFinite(point.price) && point.price > 0);
              }
              assert.notDeepEqual(added[0].points[0], added[0].points[1]);
              assert.deepEqual(
                sorted(after.drawings.filter((x) => x.id !== ownId)),
                sorted(before.drawings),
                "Existing complete geometry and styles unchanged",
              );
              assert.equal(
                Number(await canvas(p).getAttribute("data-drawing-count")),
                before.drawings.length + 1,
                "Rendered canvas receives new drawing",
              );
              await removeOwned(p, ownId);
              const restored = await state(p);
              assert.deepEqual(
                sorted(restored.drawings),
                sorted(before.drawings),
              );
              assert.equal(
                Number(await canvas(p).getAttribute("data-drawing-count")),
                before.drawings.length,
              );
              return `真实工具栏选择趋势线、两次画布点击生成唯一两点图形、仅删除新增ID；原${before.drawings.length}条图形全部几何与样式逐字段一致`;
            } catch (e) {
              primary = e;
              await recordBeforeRestore(p, "native-drawing", e);
              throw e;
            } finally {
              try {
                await closePop(p);
                // A failed add may have committed before its assertion. Recover that one
                // ID only when it is unique; never fall back to delete-all.
                const current = await state(p),
                  created = current.drawings.filter(
                    (x) => !before.drawings.some((y) => y.id === x.id),
                  );
                assert.ok(
                  created.length <= 1,
                  "Unexpected extra drawings require inspection",
                );
                if (created.length) await removeOwned(p, created[0].id);
                await canvas(p).focus();
                await canvas(p).press("Escape");
                const final = await state(p);
                assert.deepEqual(
                  sorted(final.drawings),
                  sorted(before.drawings),
                );
                assert.equal(final.tool, before.tool);
                assert.equal(final.draft, false);
                assert.equal(final.selected, before.selected);
              } catch (e) {
                throw markRestoreFailure(
                  primary,
                  e,
                  "恢复原生图原图形与光标状态",
                );
              }
            }
          }),
      },
    ],
  },
];
export const drawingSuite = createDesktopRowSuite(drawingDefinitions);
