// Desktop 收藏用例逐项补齐，真实下单除外。
import { favoritesBoundarySuite } from '../../shared/perps/desktop-favorites-boundaries.mjs';
import { runNonOrderCLI } from '../../shared/perps/non-order-ui.mjs';
export const platform='desktop';
export const displayName='收藏逐项断言与边界';
export const {testCases,setup}=favoritesBoundarySuite;
export const run=()=>runNonOrderCLI({testCases,setup});
if(process.argv[1]===new URL(import.meta.url).pathname)run().then(r=>{if(r.failed)process.exitCode=1;}).catch(e=>{console.error(e);process.exitCode=1;});
