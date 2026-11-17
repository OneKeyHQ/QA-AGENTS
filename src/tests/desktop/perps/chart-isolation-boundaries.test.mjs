// Manual D12 §4 state isolation; shared suite emits row assertions and restores drafts.
import { chartIsolationSuite } from "../../shared/perps/desktop-chart-isolation-boundaries.mjs";
import { runNonOrderCLI } from "../../shared/perps/non-order-ui.mjs";
export const platform = "desktop";
export const displayName = "图表预览状态隔离";
export const { testCases, setup } = chartIsolationSuite;
export const run = () => runNonOrderCLI({ testCases, setup, platform });
if (process.argv[1] === new URL(import.meta.url).pathname)
  run()
    .then((r) => {
      if (r.failed) process.exitCode = 1;
    })
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    });
