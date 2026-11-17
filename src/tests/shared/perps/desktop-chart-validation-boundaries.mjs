// D12 手动用例：docs/qa/testcases/cases/perps/2026-07-01_Perps-画线下单.md
// D12 §2.4. Actual chart preview validation on empty quantities only.
// Independent calibrated CDP Network observation includes Desktop's co-located
// background HttpTransport; invalid inputs are checked again before each click.
import assert from "node:assert/strict";
import { locator, typeInput } from "../../helpers/perps-ui.mjs";
import { withLimitPreview } from "./desktop-limit-preview-boundaries.mjs";
import { openTradingViewLimit } from "./trading-view-order-preview.mjs";
import { readTradingPermission } from "./desktop-form-boundaries.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import { pollForm } from "./non-order-ui.mjs";
import {
  activeToasts,
  dismissCurrentValidationToasts,
} from "./validation-toasts.mjs";
import { assertInvalidChartPreview } from "./chart-preview-validation.mjs";
import { withDesktopRequestObservation } from "./desktop-request-observer.mjs";
const dialog = (p) => p.getByRole("dialog").filter({ visible: true });
const ui = (p, key) => locator(dialog(p), "perps.chart_order." + key);
async function reject(p, kind, side) {
  const permission = await readTradingPermission(p);
  if (!permission.canTrade)
    throw new SampleUnavailable(
      "当前Agent权限未就绪；不因无效输入校验进入启用交易或签名",
    );
  const before = {
    quantity: await ui(p, "size").inputValue(),
    price: await ui(p, "price").inputValue(),
    kind,
    canTrade: permission.canTrade,
  };
  assertInvalidChartPreview(before);
  await activeToasts(p).evaluateAll(dismissCurrentValidationToasts);
  await pollForm(
    () => activeToasts(p).count(),
    (n) => n === 0,
    "Old validation toast removed",
  );
  const attempted = [];
  const matches = (url) => /\/exchange\/?$/u.test(url.pathname);
  const handler = async (route) => {
    attempted.push(route.request().url());
    await route.abort("blockedbyclient");
  };
  await p.context().route(matches, handler);
  try {
    assertInvalidChartPreview({
      ...before,
      quantity: await ui(p, "size").inputValue(),
      price: await ui(p, "price").inputValue(),
    });
    const result = await withDesktopRequestObservation(p, async () => {
      const current = await readTradingPermission(p);
      assert.equal(
        current.canTrade,
        true,
        "Permission remained ready before invalid-input click",
      );
      assertInvalidChartPreview({
        quantity: await ui(p, "size").inputValue(),
        price: await ui(p, "price").inputValue(),
        kind,
        canTrade: current.canTrade,
      });
      await ui(p, "limit_" + side).click();
      const expected = kind === "price" ? "输入价格" : "输入数量";
      const toast = activeToasts(p).filter({ hasText: expected });
      await toast.waitFor({ state: "visible", timeout: 10000 });
      assert.equal(await toast.getByText(expected, { exact: true }).count(), 1);
      assert.equal(
        await dialog(p).count(),
        1,
        "Only the original chart preview remains",
      );
      assert.deepEqual(attempted, [], "No renderer exchange request");
      return `${side}/${kind}: ${expected}`;
    });
    return `${result.detail}; 已校准Desktop后台请求观察，exchange尝试=0`;
  } finally {
    await p.context().unroute(matches, handler);
  }
}
export const chartValidationDefinitions = [
  {
    id: "PERPS-DESKTOP-CHART-VALIDATION-001",
    name: "图表限价空值与价格过滤",
    rows: [
      {
        ids: ["D12-75"],
        name: "空数量与零数量双方向逐次独立提示",
        check: (p) =>
          withLimitPreview(p, async () => {
            await openTradingViewLimit(p);
            await typeInput(ui(p, "price"), "100");
            const details = [];
            for (const quantity of ["", "0"])
              for (const side of ["long", "short"]) {
                await typeInput(ui(p, "size"), quantity);
                details.push(await reject(p, "quantity", side));
              }
            return details.join("；");
          }),
      },
      {
        ids: ["D12-76"],
        name: "非数字与负号逐字拒绝，空价与零价双方向拦截",
        check: (p) =>
          withLimitPreview(p, async () => {
            await openTradingViewLimit(p);
            await typeInput(ui(p, "size"), "");
            for (const invalid of [
              "abc",
              "-",
              "NaN",
              "Infinity",
              "中文",
              "😀",
            ]) {
              await typeInput(ui(p, "price"), "");
              await ui(p, "price").pressSequentially(invalid, { delay: 35 });
              assert.equal(
                await ui(p, "price").inputValue(),
                "",
                "Invalid price characters rejected: " + invalid,
              );
            }
            const details = [];
            for (const price of ["", "0"])
              for (const side of ["long", "short"]) {
                await typeInput(ui(p, "price"), price);
                details.push(await reject(p, "price", side));
              }
            return details.join("；");
          }),
      },
    ],
  },
];
export const chartValidationSuite = createDesktopRowSuite(
  chartValidationDefinitions,
);
