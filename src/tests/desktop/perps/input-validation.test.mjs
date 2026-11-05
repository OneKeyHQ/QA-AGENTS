// Shared CDP logic; only installed Desktop TF has been executed in this session.
import {
  createNonOrderTests,
  runNonOrderCLI,
} from "../../shared/perps/non-order-ui.mjs";
export const platform = 'desktop';
export const displayName = "非下单输入校验";
const group = createNonOrderTests({
  platform,
  prefix: "PERPS-FORM",
  settingsPrefix: "PERPS-SETTINGS",
});
export const testCases = group.testCases;
export const setup = group.setup;
export const run = () => runNonOrderCLI({ testCases, setup, platform });
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`)
  run()
    .then((r) => process.exit(r.failed ? 1 : 0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
