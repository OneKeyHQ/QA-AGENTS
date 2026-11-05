import { holdingsBoundarySuite } from "../../shared/perps/desktop-holdings-boundaries.mjs";
import { runNonOrderCLI } from "../../shared/perps/non-order-ui.mjs";
export const platform = "desktop";
export const displayName = "持有币种过滤、列与数据对账";
export const { testCases, setup } = holdingsBoundarySuite;
export const run = () => runNonOrderCLI({ testCases, setup, platform });
if (process.argv[1] === new URL(import.meta.url).pathname)
  run()
    .then((r) => process.exit(r.failed ? 1 : 0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
