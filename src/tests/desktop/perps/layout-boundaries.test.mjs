import { layoutSuite } from '../../shared/perps/desktop-layout-boundaries.mjs';
import { runNonOrderCLI } from '../../shared/perps/non-order-ui.mjs';
export const platform='desktop';
export const displayName='桌面布局拖动与重置逐项断言';
export const {testCases,setup}=layoutSuite;
export const run=()=>runNonOrderCLI({testCases,setup});
if(process.argv[1]===new URL(import.meta.url).pathname)run().then(r=>{if(r.failed)process.exitCode=1;}).catch(e=>{console.error(e);process.exitCode=1;});
