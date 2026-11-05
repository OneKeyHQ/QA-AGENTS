// Continuous Desktop list stress flow, restores complete original favorites.
import {favoriteStressSuite} from '../../shared/perps/desktop-favorites-stress.mjs';
import {runNonOrderCLI} from '../../shared/perps/non-order-ui.mjs';
export const platform='desktop';
export const displayName='大量收藏与滚动边界';
export const {testCases,setup}=favoriteStressSuite;
export const run=()=>runNonOrderCLI({testCases,setup,platform});
if(process.argv[1]&&import.meta.url===`file://${process.argv[1]}`)run().then(r=>process.exit(r.failed?1:0)).catch(e=>{console.error(e);process.exit(1);});
