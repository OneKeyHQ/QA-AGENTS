import { twapLocaleSuite } from "../../shared/perps/desktop-twap-locale.mjs";
import { runNonOrderCLI } from "../../shared/perps/non-order-ui.mjs";
export const platform = "desktop";
export const displayName = "分时委托语言设置与刷新";
export const { testCases, setup } = twapLocaleSuite;
export const run = () => runNonOrderCLI({ testCases, setup, platform });
if (process.argv[1] === new URL(import.meta.url).pathname)
  run()
    .then((r) => {
      process.exitCode = r.failed ? 1 : 0;
    })
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    });
