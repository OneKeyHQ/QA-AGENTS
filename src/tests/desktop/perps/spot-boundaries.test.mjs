// Desktop-only spot forms and ticker boundaries; no orders.
import {spotBoundarySuite} from '../../shared/perps/desktop-spot-boundaries.mjs';
import {runNonOrderCLI} from '../../shared/perps/non-order-ui.mjs';
export const platform='desktop';
export const displayName='现货输入与行情边界';
export const {testCases,setup}=spotBoundarySuite;
export const run=()=>runNonOrderCLI({testCases,setup,platform});
const isMain=process.argv[1]===new URL(import.meta.url).pathname;
if(isMain)run().then(r=>process.exit(r.failed?1:0)).catch(e=>{console.error(e);process.exit(1);});
