import { keyboardBoundarySuite } from "../../shared/perps/desktop-keyboard-boundaries.mjs";
import { runNonOrderCLI } from "../../shared/perps/non-order-ui.mjs";
export const platform = "desktop";
export const displayName = "搜索键盘完整目标与边界";
export const { testCases, setup } = keyboardBoundarySuite;
export const run = () => runNonOrderCLI({ testCases, setup, platform });
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`)
  run()
    .then((r) => process.exit(r.failed ? 1 : 0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
