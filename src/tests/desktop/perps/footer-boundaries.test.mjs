import { footerSuite } from '../../shared/perps/desktop-footer-boundaries.mjs';
import { runNonOrderCLI } from '../../shared/perps/non-order-ui.mjs';
export const platform='desktop';
export const displayName='底部状态与轮播逐项断言';
export const {testCases,setup}=footerSuite;
export const run=()=>runNonOrderCLI({testCases,setup});
if(process.argv[1]===new URL(import.meta.url).pathname)run().then(r=>{if(r.failed)process.exitCode=1;}).catch(e=>{console.error(e);process.exitCode=1;});
