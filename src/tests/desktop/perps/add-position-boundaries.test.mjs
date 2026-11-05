import { addPositionSuite } from "../../shared/perps/desktop-add-position-boundaries.mjs";
import { runNonOrderCLI } from "../../shared/perps/non-order-ui.mjs";
export const platform = "desktop";
export const displayName = "加仓单位滑杆与输入边界";
export const { testCases, setup } = addPositionSuite;
export const run = () => runNonOrderCLI({ testCases, setup, platform });
if (process.argv[1] === new URL(import.meta.url).pathname)
  run()
    .then((r) => process.exit(r.failed ? 1 : 0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
