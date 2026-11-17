// Desktop funds controls only. Never submits, signs or transfers.
import {fundsBoundarySuite} from '../../shared/perps/desktop-funds-boundaries.mjs';
import {runNonOrderCLI} from '../../shared/perps/non-order-ui.mjs';
export const platform='desktop';
export const displayName='存提现非提交校验';
export const {testCases,setup}=fundsBoundarySuite;
export const run=()=>runNonOrderCLI({testCases,setup,platform});
const isMain=process.argv[1]===new URL(import.meta.url).pathname;
if(isMain)run().then(r=>process.exit(r.failed?1:0)).catch(e=>{console.error(e);process.exit(1);});
