import { tpslPreviewSuite } from "../../shared/perps/desktop-tpsl-preview-boundaries.mjs";
import { runNonOrderCLI } from "../../shared/perps/non-order-ui.mjs";
export const platform = "desktop";
export const displayName = "图表仓位止盈止损预览";
export const { testCases, setup } = tpslPreviewSuite;
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
