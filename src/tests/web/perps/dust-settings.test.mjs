// Shared CDP logic; only installed Desktop TF has been executed in this session.
import {
  createNonOrderTests,
  runNonOrderCLI,
} from "../../shared/perps/non-order-ui.mjs";
export const platform = 'web';
export const displayName = "现货碎币设置";
const group = createNonOrderTests({
  platform,
  prefix: "WEB-PERPS-FORM",
  settingsPrefix: "WEB-PERPS-SETTINGS",
});
export const testCases = group.settings;
export const setup = group.setup;
export const run = () => runNonOrderCLI({ testCases, setup, platform });
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`)
  run()
    .then((r) => process.exit(r.failed ? 1 : 0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
