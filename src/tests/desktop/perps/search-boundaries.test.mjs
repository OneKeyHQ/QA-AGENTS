import {searchSuite} from '../../shared/perps/desktop-search-boundaries.mjs';
import {runNonOrderCLI} from '../../shared/perps/non-order-ui.mjs';
export const platform='desktop';
export const displayName='搜索边界与服务端配置对账';
export const {testCases,setup}=searchSuite;
export const run=()=>runNonOrderCLI({testCases,setup,platform});
if(process.argv[1]&&import.meta.url===`file://${process.argv[1]}`)run().then(r=>process.exit(r.failed?1:0)).catch(e=>{console.error(e);process.exit(1)});
