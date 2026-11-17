import {portfolioBoundarySuite} from '../../shared/perps/desktop-portfolio-boundaries.mjs';
import {runNonOrderCLI} from '../../shared/perps/non-order-ui.mjs';
export const platform='desktop';
export const displayName='投资组合边界与筛选';
export const {testCases,setup}=portfolioBoundarySuite;
export const run=()=>runNonOrderCLI({testCases,setup,platform});
const isMain=process.argv[1]===new URL(import.meta.url).pathname;
if(isMain)run().then(r=>process.exit(r.failed?1:0)).catch(e=>{console.error(e);process.exit(1);});
