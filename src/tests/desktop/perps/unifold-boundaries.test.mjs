// Desktop funds controls only. Never submits, signs or transfers.
import {unifoldBoundarySuite} from '../../shared/perps/desktop-unifold-boundaries.mjs';
import {runNonOrderCLI} from '../../shared/perps/non-order-ui.mjs';
export const platform='desktop';
export const displayName='链上存款非转账校验';
export const {testCases,setup}=unifoldBoundarySuite;
export const run=()=>runNonOrderCLI({testCases,setup,platform});
const isMain=process.argv[1]===new URL(import.meta.url).pathname;
if(isMain)run().then(r=>process.exit(r.failed?1:0)).catch(e=>{console.error(e);process.exit(1);});
