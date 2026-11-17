// Desktop advanced sizing only; positive amounts never reach an order action.
import { sizingSuite } from "../../shared/perps/desktop-sizing-boundaries.mjs";
import { runNonOrderCLI } from "../../shared/perps/non-order-ui.mjs";
export const platform = "desktop";
export const displayName = "分时分段数量与估值联动";
export const { testCases, setup } = sizingSuite;
export const run = () => runNonOrderCLI({ testCases, setup, platform });
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`)
  run()
    .then((r) => process.exit(r.failed ? 1 : 0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
