import { chartBoundarySuite } from "../../shared/perps/desktop-chart-boundaries.mjs";
import { runNonOrderCLI } from "../../shared/perps/non-order-ui.mjs";
export const platform = "desktop";
export const displayName = "统一指标面板完整断言";
export const { testCases, setup } = chartBoundarySuite;
export const run = () => runNonOrderCLI({ testCases, setup, platform });
if (process.argv[1] === new URL(import.meta.url).pathname)
  run()
    .then((r) => process.exit(r.failed ? 1 : 0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
