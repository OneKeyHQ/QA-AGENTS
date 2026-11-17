// D12 §2.4: empty/zero quantities only; never submit a positive quantity.
import { chartValidationSuite } from "../../shared/perps/desktop-chart-validation-boundaries.mjs";
import { runNonOrderCLI } from "../../shared/perps/non-order-ui.mjs";
export const platform = "desktop";
export const displayName = "图表限价输入边界";
export const { testCases, setup } = chartValidationSuite;
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
