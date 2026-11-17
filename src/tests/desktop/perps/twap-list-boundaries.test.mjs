// Desktop only; existing records, no order creation/cancellation.
import { twapListSuite } from "../../shared/perps/desktop-twap-list-boundaries.mjs";
import { runNonOrderCLI } from "../../shared/perps/non-order-ui.mjs";
export const platform = "desktop";
export const displayName = "分时委托列表与分页边界";
export const { testCases, setup } = twapListSuite;
export const run = () => runNonOrderCLI({ testCases, setup, platform });
const isMain = process.argv[1] === new URL(import.meta.url).pathname;
if (isMain)
  run()
    .then((r) => process.exit(r.failed ? 1 : 0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
